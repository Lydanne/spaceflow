import { z } from "zod";

const inputsSchema = z.object({}).catchall(z.union([z.string(), z.boolean(), z.number()]));

export const createWorkflowPresetBodySchema = z.object({
  name: z.string().min(1).max(255),
  workflow_path: z.string().min(1).max(512),
  branch: z.string().min(1).max(255),
  inputs: inputsSchema.optional().default({}),
  allow_input_override: z.boolean().optional().default(false),
});

export const updateWorkflowPresetBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  inputs: inputsSchema.optional(),
  allow_input_override: z.boolean().optional(),
});
