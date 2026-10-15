import dotenv from "dotenv";
dotenv.config();

import express from "express";
import http from "http";
import path from "path";
import fs from "fs";
import app from "./api/index";

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

function listenWithFallback(
  server: http.Server,
  startPort: number,
  host = "0.0.0.0",
  maxAttempts = 20
): Promise<number> {
  return new Promise((resolve, reject) => {
    let port = startPort;
    let attempts = 0;

    function attempt() {
      const onListening = () => {
        cleanup();
        resolve(port);
      };

      const onError = (err: any) => {
        cleanup();
        if (err.code === "EADDRINUSE" && attempts < maxAttempts) {
          console.warn(`Port ${port} is in use, trying next available port ${port + 1}...`);
          port++;
          attempts++;
          attempt();
        } else {
          reject(err);
        }
      };

      const cleanup = () => {
        server.removeListener("listening", onListening);
        server.removeListener("error", onError);
      };

      server.once("listening", onListening);
      server.once("error", onError);
      server.listen(port, host);
    }

    attempt();
  });
}

async function startServer() {
  const isBundled = typeof __filename !== "undefined" && __filename.endsWith(".cjs");
  const isProduction = process.env.NODE_ENV === "production" || isBundled;
  console.log(`Initializing server (NODE_ENV: ${process.env.NODE_ENV || "development"}, isProduction: ${isProduction})`);

  const httpServer = http.createServer(app);

  // Vite middleware setup for development only when not running bundled production
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: {
          middlewareMode: true,
          hmr: {
            server: httpServer,
          },
        },
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
  // - In local / AI Studio development sandbox, attempts startPort (default 3000),
  //   and gracefully auto-increments to the next available port if port 3000 is occupied.
  const isCloudRun = !!(process.env.K_SERVICE || process.env.K_REVISION);
  const configuredPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;

  const activeServers: http.Server[] = [httpServer];

  if (isProduction || isCloudRun) {
    const primaryPort = configuredPort || 8080;
    httpServer.listen(primaryPort, "0.0.0.0", () => {
      console.log(`Server successfully listening on http://0.0.0.0:${primaryPort}`);
    });

    if (primaryPort !== 3000) {
      try {
        const secondaryServer = http.createServer(app);
        secondaryServer.listen(3000, "0.0.0.0", () => {
          console.log(`Secondary listener ready on http://0.0.0.0:3000`);
        });
        secondaryServer.on("error", (err: any) => {
          if (err.code === "EADDRINUSE") {
            console.warn(`Secondary port 3000 is in use, skipping.`);
          }
        });
        activeServers.push(secondaryServer);
      } catch (e) {
        // Ignore secondary listener failure
      }
    }
  } else {
    const startPort = configuredPort || 3000;
    try {
      const boundPort = await listenWithFallback(httpServer, startPort, "0.0.0.0");
      console.log(`\n  ➜  Local:   http://localhost:${boundPort}/`);
      console.log(`  ➜  Network: http://0.0.0.0:${boundPort}/\n`);
    } catch (err) {
      console.error("Failed to bind server to any available port:", err);
      process.exit(1);
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
