import dotenv from "dotenv";
dotenv.config();

import app from "./api/index";
import path from "path";
import fs from "fs";
import express from "express";

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;
  const isProduction = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), "dist", "index.html"));

  // Vite middleware setup for local development
  if (!isProduction) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn("Vite middleware initialization warning:", err);
    }
  } else {
    // Production static file serving
    const distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(200).send("RiceAggregator Portal is ready.");
        }
      });
    } else {
      app.get("*", (req, res) => {
        res.status(200).send("RiceAggregator Portal is ready.");
      });
    }
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully listening on http://0.0.0.0:${PORT} in ${isProduction ? "production" : "development"} mode`);
  });

  server.on("error", (err: any) => {
    console.error("Server listen error:", err);
  });

  // Graceful shutdown handling for Cloud Run container lifecycle
  process.on("SIGTERM", () => {
    console.log("SIGTERM signal received: gracefully closing HTTP server");
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT signal received: closing HTTP server");
    server.close(() => {
      console.log("HTTP server closed.");
      process.exit(0);
    });
  });
}

startServer().catch((err) => {
  console.error("Fatal error starting server:", err);
  process.exit(1);
});

