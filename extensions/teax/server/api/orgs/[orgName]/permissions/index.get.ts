import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireOrgAccess } from "~~/server/utils/org-access";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  await requireOrgAccess(event, orgId);
  const db = useDB();

  const groups = await db
    .select()
    .from(schema.permissionGroups)
    .where(eq(schema.permissionGroups.organization_id, orgId))
    .orderBy(schema.permissionGroups.created_at);

  return { data: groups };
});
