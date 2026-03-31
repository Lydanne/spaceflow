import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requirePermission } from "~~/server/utils/permission";
import { writeAuditLog } from "~~/server/utils/audit";
import { resolveRepoId } from "~~/server/utils/resolve-repo";

export default defineEventHandler(async (event) => {
  const { repoId, orgId } = await resolveRepoId(event);
  const session = await requirePermission(event, orgId, "repo:delete", repoId);
  const db = useDB();

  const [project] = await db
    .select()
    .from(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)))
    .limit(1);

  if (!project) {
    throw createError({ statusCode: 404, message: "Project not found" });
  }

  // 当前统一使用系统级 webhook，删除项目时不再删除项目级 webhook（字段仅保留兼容）

  await db
    .delete(schema.repositories)
    .where(and(eq(schema.repositories.id, repoId), eq(schema.repositories.organization_id, orgId)));

  await writeAuditLog(event, {
    user_id: session.user.id,
    organization_id: orgId,
    action: "project.delete",
    resource_type: "project",
    resource_id: repoId,
    detail: { full_name: project.full_name },
  });

  return { success: true };
});
