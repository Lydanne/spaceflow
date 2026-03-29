import { readAgentRuntimeGlobalsFiles } from "~~/server/services/agent-runtime-globals.service";
import { requireAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const snapshot = await readAgentRuntimeGlobalsFiles();

  return {
    paths: snapshot.paths,
    dockerfile: snapshot.dockerfile,
    opencode_config: snapshot.opencodeConfig,
  };
});
