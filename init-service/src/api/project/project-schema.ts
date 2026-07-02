import * as yup from "yup";

export const bootstrapTemplateSchema = yup.object().shape({
  workspaceName: yup.string().required("workspaceName is required"),
  projectName: yup.string().required("projectName is required"),
  type: yup.string().required("type (project template type) is required"),
});

export const bootstrapCloneSchema = yup.object().shape({
  workspaceName: yup.string().required("workspaceName is required"),
  projectName: yup.string().required("projectName is required"),
  githubUrl: yup.string().url("Must be a valid URL").required("githubUrl is required"),
});

export const existingTemplateSchema = yup.object().shape({
  projectName: yup.string().required("projectName is required"),
  type: yup.string().required("type is required"),
});

export const existingCloneSchema = yup.object().shape({
  projectName: yup.string().required("projectName is required"),
  githubUrl: yup.string().url("Must be a valid URL").required("githubUrl is required"),
});
