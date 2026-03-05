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
      teamId: schema.teamPermissions.teamId,
      permissionGroupId: schema.teamPermissions.permissionGroupId,
      createdAt: schema.teamPermissions.createdAt,
      groupName: schema.permissionGroups.name,
      groupDescription: schema.permissionGroups.description,
      permissions: schema.permissionGroups.permissions,
    })
    .from(schema.teamPermissions)
    .innerJoin(
      schema.permissionGroups,
      eq(schema.teamPermissions.permissionGroupId, schema.permissionGroups.id),
    )
    .where(eq(schema.teamPermissions.teamId, teamId));

  return { data: assignments };
});
