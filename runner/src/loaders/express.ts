import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import apiRouter from "../api";
import { handleProxy } from "../api/workspace/workspace-helper";
import logger from "../utils/logger";

export default async ({ app }: { app: express.Application }): Promise<void> => {
  app.use(express.json());
  app.use(
    cors({
      origin: "*",
      credentials: true,
      methods: "*",
      allowedHeaders: "*",
    })
  );

  // Register all API routes
  app.use(apiRouter);

  // Wildcard 404 Handler for referer-based proxy forwarding
  app.use(async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const referer = req.headers.referer;
    if (referer) {
      try {
        const parsedUrl = new URL(referer);
        const pathname = parsedUrl.pathname;

        // Match /proxy/:replId/:port/...
        const match = pathname.match(/^\/proxy\/([^/]+)\/(\d+)/);
        if (match) {
          const replId = match[1];
          const containerPort = parseInt(match[2], 10);
          const reqPath = req.path.replace(/^\//, "");
          return await handleProxy(replId, containerPort, reqPath, req, res);
        }

        // Match legacy /proxy/:replId/...
        const matchLegacy = pathname.match(/^\/proxy\/([^/]+)/);
        if (matchLegacy) {
          const replId = matchLegacy[1];
          const containerPort = 8000;
          const reqPath = req.path.replace(/^\//, "");
          return await handleProxy(replId, 8000, reqPath, req, res);
        }
      } catch (e) {
        // Ignore URL parsing errors
      }
    }

    res.status(404).json({ detail: "Not Found" });
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction): any => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error(`[API Error] ${statusCode} - ${message}`);
    if (err.stack) {
      logger.error(err.stack);
    }

    if (req.path.startsWith("/api/db/")) {
      // Original db-route sent raw error message strings with response status 500 / 400
      return res.status(statusCode).send(message);
    }

    return res.status(statusCode).json({
      statusCode,
      success: false,
      message,
      detail: message, // Maintain compatibility with client expecting payload.detail
    });
  });
};
