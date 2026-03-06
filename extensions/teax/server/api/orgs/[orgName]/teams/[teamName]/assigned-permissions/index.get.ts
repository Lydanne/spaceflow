import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireOrgAccess } from "~~/server/utils/org-access";
import { resolveTeamId } from "~~/server/utils/resolve-team";

export default defineEventHandler(async (event) => {
  const { teamId, orgId } = await resolveTeamId(event);
  await requireOrgAccess(event, orgId);
  const db = useDB();

  const assignments = await db
    .select({
      id: schema.teamPermissions.id,
      team_id: schema.teamPermissions.team_id,
      permission_group_id: schema.teamPermissions.permission_group_id,
      created_at: schema.teamPermissions.created_at,
      group_name: schema.permissionGroups.name,
      group_description: schema.permissionGroups.description,
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
