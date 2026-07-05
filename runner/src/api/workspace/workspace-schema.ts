import * as yup from "yup";

export const startSchema = yup.object({
  projectId: yup.string().optional(),
  projectType: yup.string().optional(),
});

export const runCppSchema = yup.object({
  entryPath: yup.string().required("Entry file path is required"),
});

export const portParamsSchema = yup.object({
  repl_id: yup.string().required("repl_id parameter is required"),
});

export const portQuerySchema = yup.object({
  container_port: yup.string().optional(),
});
