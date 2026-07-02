import { Request, Response } from "express";
import * as casGcService from "../../services/cas_gc_service";
import asyncHandler from "../../utils/asyncHandler";
import ApiResponse from "../../utils/ApiResponse";

export const runCasGc = asyncHandler(async (req: Request, res: Response) => {
  const { graceHours, batchSize, dryRun } = req.body;
  
  const result = await casGcService.runCasGcOnce(
    graceHours !== undefined && graceHours !== null ? graceHours : undefined,
    dryRun,
    batchSize !== undefined && batchSize !== null ? batchSize : undefined
  );
  
  res.status(200).json(new ApiResponse(200, "CAS GC execution completed.", result));
});
