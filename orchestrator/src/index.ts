import express from "express";
import loaders from "./loaders";
import logger from "./loaders/logger";
import config from "./config";

async function startServer() {
  const app = express();
  await loaders({ expressApp: app });

  const port = Number(config.PORT) || 3002;
  const server = app.listen(port, "0.0.0.0", () => {
    logger.info(`🛡️  Orchestrator listening on port: ${port}  🛡️`);
  }).on("error", (err) => {
    logger.error("Error in server", err);
    process.exit(1);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, closing server gracefully...`);
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

startServer();
