import dotenv from "dotenv";
dotenv.config();

import app from "./api/index";
import path from "path";
import fs from "fs";
import express from "express";

async function startServer() {
  const PORT = 3000;

  // Vite middleware setup for local development
  if (process.env.NODE_ENV !== "production") {
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
      app.use(express.static(distPath, { maxAge: "1d", index: false }));
      app.get("*", (req, res) => {
        const indexPath = path.join(distPath, "index.html");
        if (fs.existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send("Application build files not found.");
        }
      });
    } else {
      app.get("*", (req, res) => {
        res.status(200).send("RiceAggregator Portal is starting up in production mode...");
      });
    }
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully listening on http://0.0.0.0:${PORT} in ${process.env.NODE_ENV || "development"} mode`);
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

