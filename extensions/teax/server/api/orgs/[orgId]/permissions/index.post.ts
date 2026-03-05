import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../db";
import { requireAdmin } from "../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();
  const orgId = getRouterParam(event, "orgId");

  if (!orgId) {
    throw createError({ statusCode: 400, message: "Missing orgId" });
  }

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
    })
    .returning();

  return { data: group };
});
