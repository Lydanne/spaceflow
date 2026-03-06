import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { writeAuditLog } from "~~/server/utils/audit";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  const groupId = getRouterParam(event, "groupId");
  if (!groupId) {
    throw createError({ statusCode: 400, message: "Missing groupId" });
  }

  const session = await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  // 禁止删除默认权限组
  const [target] = await db
    .select({ type: schema.permissionGroups.type })
    .from(schema.permissionGroups)
    .where(and(eq(schema.permissionGroups.id, groupId), eq(schema.permissionGroups.organization_id, orgId)))
    .limit(1);

  if (target?.type === "default") {
    throw createError({ statusCode: 403, message: "默认权限组不允许删除" });
  }

  const [deleted] = await db
    .delete(schema.permissionGroups)
    .where(
      and(
        eq(schema.permissionGroups.id, groupId),
        eq(schema.permissionGroups.organization_id, orgId),
      ),
    )
    .returning({ id: schema.permissionGroups.id });

  if (!deleted) {
    throw createError({ statusCode: 404, message: "Permission group not found" });
  }

  await writeAuditLog(event, {
    user_id: session.user.id,
    organization_id: orgId,
    action: "permission_group.delete",
    resource_type: "permission_group",
    resource_id: groupId,
  });

  return { success: true };
});
