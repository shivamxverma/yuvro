import * as yup from "yup";

export const addConnectionSchema = yup.object({
  id: yup.string().optional(),
  name: yup.string().optional(),
  type: yup.string().oneOf(["postgres", "mysql", "sqlite"]).required("type is required"),
  host: yup.string().optional(),
  port: yup.number().optional(),
  user: yup.string().optional(),
  password: yup.string().optional(),
  database: yup.string().optional(),
  path: yup.string().optional(),
});

export const deleteConnectionSchema = yup.object({
  conn_id: yup.string().required("conn_id is required"),
});

export const tablesSchema = yup.object({
  db_path: yup.string().required("db_path query parameter is required"),
});

export const schemaSchema = yup.object({
  db_path: yup.string().required("db_path query parameter is required"),
  table: yup.string().required("table query parameter is required"),
});

export const rowsSchema = yup.object({
  db_path: yup.string().required("db_path query parameter is required"),
  table: yup.string().required("table query parameter is required"),
  page: yup.string().optional(),
  page_size: yup.string().optional(),
});

export const runQuerySchema = yup.object({
  db_path: yup.string().required("db_path is required"),
  query: yup.string().required("query is required"),
});
