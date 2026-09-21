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
    path.join(cwd, "build"),
    path.resolve(cwd, "..", "dist"),
    path.resolve(cwd, "..", "build"),
    path.join("/app/applet", "dist"),
    path.join("/app/applet", "build"),
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
  const isBundled = typeof __filename !== "undefined" && __filename.endsWith(".cjs");
  const isProduction = process.env.NODE_ENV === "production" || isBundled;
  console.log(`Initializing server (NODE_ENV: ${process.env.NODE_ENV || "development"}, isProduction: ${isProduction})`);

  // Vite middleware setup for development only when not running bundled production
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

  // Port Binding Strategy:
  // - In Cloud Run production deployment (where K_SERVICE or NODE_ENV=production is set),
  //   Cloud Run routes external ingress and container health checks to process.env.PORT (defaults to 8080).
  // - In AI Studio development sandbox, an internal Nginx reverse proxy routes traffic to port 3000.
  // We determine the primary port dynamically, and also bind secondary ports (with graceful EADDRINUSE handling)
  // so the service responds seamlessly in Cloud Run, AI Studio preview, and container deployments.
  const isCloudRun = !!(process.env.K_SERVICE || process.env.K_REVISION);
  const configuredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

  // Primary port determination:
  // In production / Cloud Run: prefer process.env.PORT (8080), fallback to 8080 or 3000
  // In development: prefer 3000 (as required by AI Studio dev proxy)
  const primaryPort = (isProduction || isCloudRun)
    ? (configuredPort || 8080)
    : 3000;

  const portsToListen: number[] = [primaryPort];

  // Also listen on 3000 if primary is different (e.g., in Cloud Run production where primary is 8080)
  if (!portsToListen.includes(3000)) {
    portsToListen.push(3000);
  }

  // If in production and PORT was not 8080, also listen on 8080
  if ((isProduction || isCloudRun) && configuredPort && configuredPort !== 8080 && !portsToListen.includes(8080)) {
    portsToListen.push(8080);
  }

  const activeServers: any[] = [];

  for (const port of portsToListen) {
    try {
      const s = app.listen(port, "0.0.0.0", () => {
        console.log(`Server successfully listening on http://0.0.0.0:${port}`);
      });

      s.on("error", (err: any) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`Port ${port} is in use, skipping.`);
        } else {
          console.error(`Listen error on port ${port}:`, err);
        }
      });

      activeServers.push(s);
    } catch (bindErr: any) {
      console.warn(`Failed to bind on port ${port}:`, bindErr);
    }
  }

  const handleShutdown = (signal: string) => {
    console.log(`${signal} signal received: closing HTTP server(s)`);
    activeServers.forEach((srv) => {
      try {
        srv.close();
      } catch {}
    });
    setTimeout(() => process.exit(0), 1000).unref();
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});
