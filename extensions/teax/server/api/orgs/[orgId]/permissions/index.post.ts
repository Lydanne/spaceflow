import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { writeAuditLog } from "~~/server/utils/audit";
import { createPermissionGroupBodySchema } from "~~/server/shared/dto";

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

  const body = await readValidatedBody(event, createPermissionGroupBodySchema.parse);

  const [group] = await db
    .insert(schema.permissionGroups)
    .values({
      organization_id: orgId,
      name: body.name.trim(),
      description: body.description?.trim() || null,
      permissions: body.permissions || [],
      repository_ids: body.repository_ids ?? null,
    })
    .returning();

  await writeAuditLog(event, {
    user_id: session.user.id,
    organization_id: orgId,
    action: "permission_group.create",
    resource_type: "permission_group",
    resource_id: group?.id,
    detail: { name: body.name },
  });

  return { data: group };
});
