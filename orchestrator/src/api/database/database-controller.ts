import { Request, Response } from "express";
import * as databaseService from "./database-service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

export const startDatabase = asyncHandler(async (req: Request, res: Response) => {
  const { workspaceId, projectId, engine } = req.body;
  const result = await databaseService.startDatabase({ workspaceId, projectId, engine });
  res.status(200).json(new ApiResponse(200, "Database started successfully.", result));
});
