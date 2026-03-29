import { ensureRuntimeTeaxDefaultsSynced } from "~~/server/services/agent-runtime-defaults.service";

export default defineNitroPlugin(async () => {
  try {
    const result = await ensureRuntimeTeaxDefaultsSynced();
    if (result.missingSource) {
      console.warn("[agent-runtime-defaults] defaults source not found, skip sync", {
        source_dir: result.sourceDir,
      });
      return;
    }

    if (result.copiedFiles.length > 0) {
      console.info("[agent-runtime-defaults] synced missing runtime .teax files", {
        source_dir: result.sourceDir,
        target_dir: result.targetDir,
        copied_files: result.copiedFiles,
      });
    } else {
      console.info("[agent-runtime-defaults] runtime .teax defaults already complete", {
        source_dir: result.sourceDir,
        target_dir: result.targetDir,
      });
    }
  } catch (error) {
    console.error("[agent-runtime-defaults] failed to sync defaults", {
      message: (error as { message?: string })?.message || "unknown",
    });
  }
});
