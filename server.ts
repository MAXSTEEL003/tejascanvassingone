import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import app from "./api/index.ts";

// Process-level unhandled exception safety
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

// Robust distPath resolution supporting both local and container environments
function resolveDistPath(): string {
  const cwd = process.cwd();
  const candidates = [
    path.join(cwd, "dist"),
    path.resolve(cwd, "..", "dist"),
    path.join("/app/applet", "dist"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }
  return path.join(cwd, "dist");
}

function setupStaticServing() {
  const distPath = resolveDistPath();
  console.log(`Configuring static asset serving from: ${distPath}`);

  app.use(
    express.static(distPath, {
      maxAge: "1d",
      index: "index.html",
    })
  );

  // Cloud Run / container health check endpoint aliases
  app.all(["/health", "/healthz", "/_ah/health", "/readyz", "/livez", "/api/health"], (req, res) => {
    res.status(200).json({ status: "ok", mode: process.env.NODE_ENV || "development", timestamp: new Date().toISOString() });
  });

  // SPA fallback: Route all non-API GET requests to index.html
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) {
      return next();
    }
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(200).send("Tejas Canvassing Store is operational.");
    }
  });
}

async function startServer() {
  const isProduction = process.env.NODE_ENV === "production";
  console.log(`Initializing server (NODE_ENV: ${process.env.NODE_ENV || "development"})`);

  // Vite middleware setup for development
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Vite development middleware mounted successfully.");
    } catch (err) {
      console.warn("Vite middleware initialization error, falling back to static serving:", err);
      setupStaticServing();
    }
  } else {
    setupStaticServing();
  }

  // Bind strictly to Port 3000 and Host 0.0.0.0 as required by the infrastructure
  const PORT = 3000;
  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully running and listening on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`Port ${PORT} is currently in use (e.g. dev server running).`);
    } else {
      console.error(`Server listen error:`, err);
    }
  });

  const handleShutdown = (signal: string) => {
    console.log(`${signal} signal received: closing HTTP server`);
    try {
      server.close();
    } catch {}
    setTimeout(() => process.exit(0), 1000).unref();
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
