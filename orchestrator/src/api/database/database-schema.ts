import * as yup from "yup";

export const startDatabaseSchema = yup.object().shape({
  workspaceId: yup.string().required("workspaceId is required").trim(),
  projectId: yup.string().required("projectId is required").trim(),
  engine: yup
    .string()
    .required("engine is required")
    .trim()
    .lowercase()
    .oneOf(["postgres", "mysql"], "engine must be 'postgres' or 'mysql'"),
});
