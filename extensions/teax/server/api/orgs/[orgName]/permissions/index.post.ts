import { useDB, schema } from "~~/server/db";
import { requireOrgOwnerOrAdmin } from "~~/server/utils/org-owner";
import { writeAuditLog } from "~~/server/utils/audit";
import { createPermissionGroupBodySchema } from "~~/server/shared/dto";
import { resolveOrgId } from "~~/server/utils/resolve-org";

export default defineEventHandler(async (event) => {
  const { orgId } = await resolveOrgId(event);
  const session = await requireOrgOwnerOrAdmin(event, orgId);
  const db = useDB();

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
