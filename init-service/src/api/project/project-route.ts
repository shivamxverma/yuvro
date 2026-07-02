import { Router } from "express";
import { validate, verifyJWT } from "../../shared/middleware";
import {
  bootstrapTemplateSchema,
  bootstrapCloneSchema,
  existingTemplateSchema,
  existingCloneSchema,
} from "./project-schema";
import * as projectController from "./project-controller";

const router = Router();

// Apply authentication globally to project routes
router.use(verifyJWT);

router.get("/workspaces", projectController.listWorkspaces);

router.post(
  "/workspaces/bootstrap/template",
  validate("body", bootstrapTemplateSchema),
  projectController.createTemplateProject
);

router.post(
  "/workspaces/bootstrap/clone",
  validate("body", bootstrapCloneSchema),
  projectController.cloneProject
);

router.post(
  "/workspaces/:workspace_id/projects/template",
  validate("body", existingTemplateSchema),
  projectController.createProjectInWorkspace
);

router.post(
  "/workspaces/:workspace_id/projects/clone",
  validate("body", existingCloneSchema),
  projectController.cloneProjectInWorkspace
);

router.get("/projects/:project_id", projectController.getProjectDetail);
router.get("/projects/:project_id/nodes", projectController.getProjectNodes);

export default router;
