import cors from "cors";
import express, { Request, Response, NextFunction } from "express";
import routes from "../api";
import logger from "./logger";

export default ({ app }: { app: express.Application }): void => {
  app.use(express.json());
  
  app.use(
    cors({
      origin: "*",
      credentials: true,
      methods: "*",
      allowedHeaders: "*",
    })
  );

  app.get("/health", (req: Request, res: Response) => {
    res.json({
      statusCode: 200,
      success: true,
      message: "OK",
      timestamp: new Date(),
      uptime: process.uptime(),
      application: "yuvro-orchestrator",
    });
  });

  app.set("trust proxy", 1);

  // Hook up API routes
  app.use("/", routes());

  // 404 Route
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: "Resource not found",
    });
  });

  // Global Error Handler
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    if (statusCode === 500) {
      logger.error("Unhandled API Error:", err);
    } else {
      logger.warn(`API Warning (${statusCode}): ${message}`);
    }

    res.status(statusCode).json({
      success: false,
      message,
      data: err.data || null,
    });
  });
};
