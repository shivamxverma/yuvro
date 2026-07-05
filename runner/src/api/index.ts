import { Router } from "express";
import workspaceRouter from "./workspace/workspace-route";
import dbRouter from "./db/db-route";

const router = Router();

router.use(workspaceRouter);
router.use("/api/db", dbRouter);

export default router;
