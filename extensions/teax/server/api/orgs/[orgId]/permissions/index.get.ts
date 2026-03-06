import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireOrgAccess } from "~~/server/utils/org-access";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

  await requireOrgAccess(event, orgId);
  const db = useDB();

  const groups = await db
    .select()
    .from(schema.permissionGroups)
    .where(eq(schema.permissionGroups.organization_id, orgId))
    .orderBy(schema.permissionGroups.created_at);

  return { data: groups };
});
