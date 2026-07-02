import * as yup from "yup";

export const casGcRunSchema = yup.object().shape({
  graceHours: yup.number().integer().nullable().optional(),
  batchSize: yup.number().integer().nullable().optional(),
  dryRun: yup.boolean().default(false),
});
