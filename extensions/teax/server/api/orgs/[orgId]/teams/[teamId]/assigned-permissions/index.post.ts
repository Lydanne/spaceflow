import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../../db";
import { requireTeamOwnerOrAdmin } from "../../../../../../utils/team-owner";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const teamId = getRouterParam(event, "teamId");

  if (!orgId || !teamId) {
    throw createError({ statusCode: 400, message: "Missing orgId or teamId" });
  }

  await requireTeamOwnerOrAdmin(event, teamId);
  const db = useDB();

  const body = await readBody<{ permissionGroupId: string }>(event);

  if (!body.permissionGroupId) {
    throw createError({ statusCode: 400, message: "permissionGroupId is required" });
  }

  // 验证权限组属于该组织
  const [group] = await db
    .select({ id: schema.permissionGroups.id })
    .from(schema.permissionGroups)
    .where(
      and(
        eq(schema.permissionGroups.id, body.permissionGroupId),
        eq(schema.permissionGroups.organizationId, orgId),
      ),
    )
    .limit(1);

  if (!group) {
    throw createError({ statusCode: 404, message: "Permission group not found in this organization" });
  }

  const [assignment] = await db
    .insert(schema.teamPermissions)
    .values({
      teamId,
      permissionGroupId: body.permissionGroupId,
    })
    .onConflictDoNothing()
    .returning();

  return { data: assignment, success: true };
});
