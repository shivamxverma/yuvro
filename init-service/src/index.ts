import express from "express";
import loaders from "./loaders";
import logger from "./loaders/logger";
import config from "./config";
import { closeDatabaseConnection } from "./loaders/postgres";
import { startCasGcLoop } from "./api/admin/cas-gc-service";

async function startServer() {
  const app = express();
  await loaders({ expressApp: app });

  const port = Number(config.PORT) || 3001;
  const server = app
    .listen(port, "0.0.0.0", () => {
      logger.info(`🛡️ Server listening on port: ${port} 🛡️`);
      
      // Start CAS Garbage Collector Loop if enabled
      startCasGcLoop();
    })
    .on("error", (err) => {
      logger.error("Error in server start:", err);
      process.exit(1);
    });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, closing server gracefully...`);
    server.close(async () => {
      try {
        await closeDatabaseConnection();
        process.exit(0);
      } catch (error) {
        logger.error("Error during database shutdown:", error);
        process.exit(1);
      }
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
