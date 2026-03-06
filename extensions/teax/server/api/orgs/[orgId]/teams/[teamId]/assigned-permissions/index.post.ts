import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../../../db";
import { requireTeamOwnerOrAdmin } from "../../../../../../utils/team-owner";
import { assignPermissionBodySchema } from "../../../../../../shared/dto";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const teamId = getRouterParam(event, "teamId");

  if (!orgId || !teamId) {
    throw createError({ statusCode: 400, message: "Missing orgId or teamId" });
  }

  await requireTeamOwnerOrAdmin(event, teamId);
  const db = useDB();

  const body = await readValidatedBody(event, assignPermissionBodySchema.parse);

  // 验证权限组属于该组织
  const [group] = await db
    .select({ id: schema.permissionGroups.id })
    .from(schema.permissionGroups)
    .where(
      and(
        eq(schema.permissionGroups.id, body.permission_group_id),
        eq(schema.permissionGroups.organization_id, orgId),
      ),
    )
    .limit(1);

  if (!group) {
    throw createError({ statusCode: 404, message: "Permission group not found in this organization" });
  }

  const [assignment] = await db
    .insert(schema.teamPermissions)
    .values({
      team_id: teamId,
      permission_group_id: body.permission_group_id,
    })
    .onConflictDoNothing()
    .returning();

  return { data: assignment, success: true };
});
