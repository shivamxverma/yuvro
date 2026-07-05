import { Router } from "express";
import { validate } from "../../shared/middleware";
import { startSchema, runCppSchema, portParamsSchema, portQuerySchema } from "./workspace-schema";
import * as workspaceController from "./workspace-controller";

const router = Router();

router.post("/start", validate("body", startSchema), workspaceController.startWorkspace);
router.post("/run/cpp", validate("body", runCppSchema), workspaceController.runCpp);
router.get(
  "/port/:repl_id",
  validate("params", portParamsSchema),
  validate("query", portQuerySchema),
  workspaceController.getPort
);
router.all("/proxy/:repl_id/:container_port/:path(*)", workspaceController.proxy);
router.all("/proxy/:repl_id/:path(*)", workspaceController.proxyLegacy);

export default router;
