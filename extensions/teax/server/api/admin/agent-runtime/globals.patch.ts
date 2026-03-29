import { z } from "zod";
import { updateAgentRuntimeGlobalsFiles } from "~~/server/services/agent-runtime-globals.service";
import { requireAdmin } from "~~/server/utils/auth";

const updateGlobalsSchema = z.object({
  dockerfile: z.string().min(1).max(500_000).optional(),
  opencode_config: z.string().min(1).max(500_000).optional(),
}).refine((value) => value.dockerfile !== undefined || value.opencode_config !== undefined, {
  message: "At least one field must be provided",
});

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const body = await readValidatedBody(event, updateGlobalsSchema.parse);
  const snapshot = await updateAgentRuntimeGlobalsFiles({
    dockerfile: body.dockerfile,
    opencodeConfig: body.opencode_config,
  });

  return {
    paths: snapshot.paths,
    dockerfile: snapshot.dockerfile,
    opencode_config: snapshot.opencodeConfig,
  };
});
