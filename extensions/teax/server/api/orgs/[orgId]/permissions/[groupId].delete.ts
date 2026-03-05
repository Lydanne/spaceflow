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

  return { success: true };
});
