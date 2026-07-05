import * as yup from "yup";

export const startRunnerSchema = yup.object().shape({
  workspaceId: yup.string().required("workspaceId is required").trim(),
  projectId: yup.string().required("projectId is required").trim(),
  projectType: yup.string().required("projectType is required").trim().lowercase(),
});
