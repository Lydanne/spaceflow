import { z } from "zod";

const inputsSchema = z.object({}).catchall(z.union([z.string(), z.boolean(), z.number()]));

export const createWorkflowPresetBodySchema = z.object({
  name: z.string().min(1).max(255),
  workflow_path: z.string().min(1).max(512),
  branch: z.string().min(1).max(255),
  inputs: inputsSchema.optional().default({}),
  allow_input_override: z.boolean().optional().default(false), // 已废弃，保留兼容
  locked_inputs: z.array(z.string()).optional().default([]), // 被锁定不可修改的参数名列表
  allow_branch_override: z.boolean().optional().default(false),
});

export const updateWorkflowPresetBodySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  inputs: inputsSchema.optional(),
  allow_input_override: z.boolean().optional(), // 已废弃，保留兼容
  locked_inputs: z.array(z.string()).optional(), // 被锁定不可修改的参数名列表
  allow_branch_override: z.boolean().optional(),
});
