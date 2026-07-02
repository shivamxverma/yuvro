import * as yup from "yup";

export const createNodeSchema = yup.object().shape({
  parent_id: yup.string().required("parent_id is required"),
  name: yup.string().required("name is required"),
  type: yup.string().oneOf(["FILE", "FOLDER"], "type must be FILE or FOLDER").required("type is required"),
});

export const updateContentSchema = yup.object().shape({
  content: yup.string().ensure().required("content is required"),
});

export const renameNodeSchema = yup.object().shape({
  name: yup.string().required("name is required"),
});

export const moveNodeSchema = yup.object().shape({
  parent_id: yup.string().required("parent_id is required"),
});
