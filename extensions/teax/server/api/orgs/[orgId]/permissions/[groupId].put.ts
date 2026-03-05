import { eq, and } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireAdmin } from "../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();
  const orgId = getRouterParam(event, "orgId");
  const groupId = getRouterParam(event, "groupId");

  if (!orgId || !groupId) {
    throw createError({ statusCode: 400, message: "Missing orgId or groupId" });
  }

  const body = await readBody<{
    name?: string;
    description?: string;
    permissions?: string[];
  }>(event);

  const [updated] = await db
    .update(schema.permissionGroups)
    .set({
      ...(body.name !== undefined ? { name: body.name.trim() } : {}),
      ...(body.description !== undefined ? { description: body.description.trim() || null } : {}),
      ...(body.permissions !== undefined ? { permissions: body.permissions } : {}),
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
