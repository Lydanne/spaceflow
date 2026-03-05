import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireOrgOwnerOrAdmin } from "../../../../utils/org-owner";
import { writeAuditLog } from "../../../../utils/audit";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const groupId = getRouterParam(event, "groupId");

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: "Missing orgId or groupId" });
  }

  const session = await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const [deleted] = await db
    .delete(schema.permissionGroups)
    .where(
      and(
        eq(schema.permissionGroups.id, groupId),
        eq(schema.permissionGroups.organizationId, orgId),
      ),
    )
    .returning({ id: schema.permissionGroups.id });

  if (!deleted) {
    throw createError({ statusCode: 404, message: "Permission group not found" });
  }

  await writeAuditLog(event, {
    userId: session.user.id,
    organizationId: orgId,
    action: "permission_group.delete",
    resourceType: "permission_group",
    resourceId: groupId,
  });

  return { success: true };
});
