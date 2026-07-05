import expressLoader from "./express";
import socketLoader from "./socket";
import http from "http";
import express from "express";
import logger from "../utils/logger";

export default async ({
  expressApp,
  httpServer,
}: {
  expressApp: express.Application;
  httpServer: http.Server;
}): Promise<void> => {
  await expressLoader({ app: expressApp });
  logger.info("✌️ Express loaded successfully");

  await socketLoader({ httpServer });
  logger.info("✌️ Socket.IO loaded successfully");
};
