import express from "express";
import http from "http";
import loaders from "./loaders";
import logger from "./utils/logger";
import { terminalManager } from "./services/terminal-service";

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Initialize all startup configurations using loaders
  await loaders({ expressApp: app, httpServer: server });

  const port = Number(process.env.PORT) || 3002;
  
  const activeServer = server.listen(port, "0.0.0.0", () => {
    logger.info(`🛡️ Runner agent listening on port: ${port} 🛡️`);
  }).on("error", (err) => {
    logger.error("Error in server start", err);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, closing server gracefully...`);
    activeServer.close(async () => {
      try {
        logger.info("Closing active PTY sessions...");
        terminalManager.killAll();
        process.exit(0);
      } catch (error: any) {
        logger.error("Error during shutdown:", error);
        process.exit(1);
      }
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
