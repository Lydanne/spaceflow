import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { updateRepoSettingsBodySchema } from "~~/server/shared/dto";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  await requirePermission(event, orgId, "repo:settings", repoId);
  const db = useDB();

  const body = await readValidatedBody(event, updateRepoSettingsBodySchema.parse);

  const [project] = await db
    .select({ settings: schema.repositories.settings })
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  const currentSettings = (project.settings || {}) as Record<string, unknown>;
  const newSettings = { ...currentSettings };

  if (body.notifyOnSuccess !== undefined) newSettings.notifyOnSuccess = body.notifyOnSuccess;
  if (body.notifyOnFailure !== undefined) newSettings.notifyOnFailure = body.notifyOnFailure;
  if (body.feishuChatId !== undefined) newSettings.feishuChatId = body.feishuChatId;
  if (body.approvalRequired !== undefined) newSettings.approvalRequired = body.approvalRequired;
  if (body.notifyBranches !== undefined) newSettings.notifyBranches = body.notifyBranches;

  const [updated] = await db
    .update(schema.repositories)
    .set({ settings: newSettings, updated_at: new Date() })
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)))
    .returning({
      id: schema.repositories.id,
      settings: schema.repositories.settings,
      updated_at: schema.repositories.updated_at,
    });

  return { data: updated };
});
