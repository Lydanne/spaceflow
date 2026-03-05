import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireOrgOwnerOrAdmin } from "../../../../utils/org-owner";
import { writeAuditLog } from "../../../../utils/audit";

export default defineEventHandler(async (event) => {
  const orgId = getRouterParam(event, "orgId");
  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

  const session = await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

  // 验证组织存在
  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.id, orgId))
    .limit(1);

  if (!org) {
    throw createError({ statusCode: 404, message: "Organization not found" });
  }

  const body = await readBody<{
    name: string;
    description?: string;
    permissions?: string[];
    projectIds?: string[] | null;
  }>(event);

  if (!body.name?.trim()) {
    throw createError({ statusCode: 400, message: "Name is required" });
  }

  const [group] = await db
    .insert(schema.permissionGroups)
    .values({
      organizationId: orgId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      permissions: body.permissions || [],
      projectIds: body.projectIds ?? null,
    })
    .returning();

  await writeAuditLog(event, {
    userId: session.user.id,
    organizationId: orgId,
    action: "permission_group.create",
    resourceType: "permission_group",
    resourceId: group?.id,
    detail: { name: body.name },
  });

  return { data: group };
});
