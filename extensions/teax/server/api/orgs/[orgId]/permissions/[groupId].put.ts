import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireOrgOwnerOrAdmin } from "../../../../utils/org-owner";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const groupId = getRouterParam(event, "groupId");

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: "Missing orgId or groupId" });
  }

  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const body = await readBody<{
    name?: string;
    description?: string;
    permissions?: string[];
    projectIds?: string[] | null;
  }>(event);

  const [updated] = await db
    .update(schema.permissionGroups)
    .set({
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
      ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
      ...(body.projectIds !== undefined ? { projectIds: body.projectIds } : {}),
    })
    .where(
      and(
        eq(schema.permissionGroups.id, groupId),
        eq(schema.permissionGroups.organizationId, orgId),
      ),
    )
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, message: "Permission group not found" });
  }

  return { data: updated };
});
