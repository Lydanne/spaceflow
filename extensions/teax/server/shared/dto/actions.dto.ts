import { z } from "zod";

// ==================== Workflow Run ====================

export const workflowRunActorSchema = z.object({
  login: z.string(),
  avatar_url: z.string().nullable(),
});

export type WorkflowRunActor = z.infer<typeof workflowRunActorSchema>;

export const workflowRunSchema = z.object({
  id: z.number(),
  run_number: z.number(),
  display_title: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  event: z.string(),
  head_branch: z.string(),
  head_sha: z.string(),
  path: z.string(),
  html_url: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  workflow_id: z.number().optional(),
  actor: workflowRunActorSchema.nullable(),
});

export type WorkflowRun = z.infer<typeof workflowRunSchema>;

export const workflowRunsResponseSchema = z.object({
  total_count: z.number(),
  workflow_runs: z.array(workflowRunSchema),
});

export type WorkflowRunsResponse = z.infer<typeof workflowRunsResponseSchema>;

// ==================== Workflow Run Detail ====================

export const workflowRunDetailSchema = z.object({
  id: z.number(),
  run_number: z.number(),
  display_title: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  event: z.string(),
  head_branch: z.string(),
  head_sha: z.string(),
  path: z.string(),
  html_url: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  workflow_id: z.number(),
  actor: workflowRunActorSchema.nullable(),
});

export type WorkflowRunDetail = z.infer<typeof workflowRunDetailSchema>;

// ==================== Job ====================

export const jobStepSchema = z.object({
  name: z.string(),
  number: z.number(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
});

export type JobStep = z.infer<typeof jobStepSchema>;

export const jobSchema = z.object({
  id: z.number(),
  run_id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  started_at: z.string().nullable(),
  completed_at: z.string().nullable(),
  runner_name: z.string().nullable(),
  labels: z.array(z.string()),
  steps: z.array(jobStepSchema),
});

export type Job = z.infer<typeof jobSchema>;

export const jobsResponseSchema = z.object({
  total_count: z.number(),
  jobs: z.array(jobSchema),
});

export type JobsResponse = z.infer<typeof jobsResponseSchema>;

// ==================== Workflow Definition ====================

export const workflowInputDefSchema = z.object({
  description: z.string().optional(),
  required: z.boolean().optional(),
  default: z.string().optional(),
  type: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export type WorkflowInputDef = z.infer<typeof workflowInputDefSchema>;

export const workflowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  state: z.string(),
  description: z.string(),
  triggers: z.array(z.string()),
  schedules: z.array(z.string()),
  inputs: z.record(z.string(), workflowInputDefSchema),
});

export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;

export const workflowsResponseSchema = z.object({
  data: z.array(workflowDefinitionSchema),
});

export type WorkflowsResponse = z.infer<typeof workflowsResponseSchema>;
