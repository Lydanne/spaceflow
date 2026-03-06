import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../../../db";
import { requireOrgAccess } from "../../../../../../utils/org-access";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const teamId = getRouterParam(event, "teamId");

  if (!orgId || !teamId) {
    throw createError({ statusCode: 400, message: "Missing orgId or teamId" });
  }

  await requireOrgAccess(event, orgId);
  const db = useDB();

  const assignments = await db
    .select({
      id: schema.teamPermissions.id,
      team_id: schema.teamPermissions.team_id,
      permission_group_id: schema.teamPermissions.permission_group_id,
      created_at: schema.teamPermissions.created_at,
      groupName: schema.permissionGroups.name,
      groupDescription: schema.permissionGroups.description,
      permissions: schema.permissionGroups.permissions,
    })
    .from(schema.teamPermissions)
    .innerJoin(
      schema.permissionGroups,
      eq(schema.teamPermissions.permission_group_id, schema.permissionGroups.id),
    )
    .where(eq(schema.teamPermissions.team_id, teamId));

  return { data: assignments };
});
