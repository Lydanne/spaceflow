import { z } from "zod";
import { upsertWatchState } from "~~/server/services/repository-watch.service";
import { useGiteaSdk } from "~~/server/utils/gitea";
import { requirePermission } from "~~/server/utils/permission";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

const updateWatchBodySchema = z.object({
  watching: z.boolean(),
});

export default defineEventHandler(async (event) => {
  const { repoId, orgId, owner, repo } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "repo:view", repoId);

  const body = await readValidatedBody(event, updateWatchBodySchema.parse);
  const gitea = await useGiteaSdk(event).role("user");

  if (body.watching) {
    await gitea.watchRepo(owner, repo);
  } else {
    await gitea.unwatchRepo(owner, repo);
  }

  const updated = await upsertWatchState(session.user.id, repoId, body.watching);

  return {
    data: {
      repository_id: repoId,
      watching: updated.watching,
      synced_at: updated.syncedAt,
    },
  };
});
