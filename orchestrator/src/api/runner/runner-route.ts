import { Router } from "express";
import { validate } from "../../shared/middleware";
import { startRunnerSchema } from "./runner-schema";
import * as runnerController from "./runner-controller";

const router = Router();

router.post("/start", validate("body", startRunnerSchema), runnerController.startRunner);

export default router;
