import { Router, Request, Response, NextFunction } from "express";
import { validate } from "../../shared/middleware";
import { casGcRunSchema } from "./admin-schema";
import * as adminController from "./admin-controller";
import config from "../../config";
import ApiError from "../../utils/ApiError";

const router = Router();

// Middleware to verify the custom admin token
function requireAdminToken(req: Request, res: Response, next: NextFunction) {
  if (!config.ADMIN_API_TOKEN) {
    throw new ApiError("Admin API token is not configured.", 503);
  }
  const token = req.headers["x-admin-token"];
  if (token !== config.ADMIN_API_TOKEN) {
    throw new ApiError("Invalid admin token.", 403);
  }
  next();
}

router.post("/cas-gc", requireAdminToken, validate("body", casGcRunSchema), adminController.runCasGc);

export default router;
