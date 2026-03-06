import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { updatePermissionGroupBodySchema } from "~~/server/shared/dto";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  const groupId = getRouterParam(event, "groupId");

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: "Missing orgId or groupId" });
  }

  await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  const body = await readValidatedBody(event, updatePermissionGroupBodySchema.parse);

  const [updated] = await db
    .update(schema.permissionGroups)
    .set({
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
      ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
      ...(body.repository_ids !== undefined ? { repository_ids: body.repository_ids } : {}),
    })
    .where(
      and(
        eq(schema.permissionGroups.id, groupId),
        eq(schema.permissionGroups.organization_id, orgId),
      ),
    )
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, message: "Permission group not found" });
  }

  return { data: updated };
});
