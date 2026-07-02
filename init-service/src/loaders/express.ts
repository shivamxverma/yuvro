import cors from "cors";
import express, { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import config from "../config";
import routes from "../api";
import logger from "./logger";
import ApiError from "../utils/ApiError";

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin || config.allowedClientOrigins.indexOf(origin) !== -1 || !config.allowedClientOrigins.length) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Admin-Token"],
};

export default ({ app }: { app: express.Application }): void => {
  app.use(express.json());
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(cookieParser());

  app.get("/health", (req, res) => {
    res.json({
      statusCode: 200,
      success: true,
      message: "OK",
      timestamp: new Date(),
      uptime: process.uptime(),
      application: "yuvro-init-service",
    });
  });

  app.set("trust proxy", 1);

  // Hook up API routes
  app.use("/", routes());

  // 404 Route
  app.use((req, res, next) => {
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
