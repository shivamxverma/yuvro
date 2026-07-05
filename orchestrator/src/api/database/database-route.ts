import { Router } from "express";
import { validate } from "../../shared/middleware";
import { startDatabaseSchema } from "./database-schema";
import * as databaseController from "./database-controller";

const router = Router();

router.post("/db/start", validate("body", startDatabaseSchema), databaseController.startDatabase);

export default router;
