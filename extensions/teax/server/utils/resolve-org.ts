import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { H3Event } from "h3";

/**
 * 从路由参数 orgName 解析出 orgId。
 * 路由目录为 [orgName]，参数名为 "orgName"。
 * 找不到时抛 404。
 */
export async function resolveOrgId(event: H3Event): Promise<{ orgId: string; orgName: string }> {
  const orgName = getRouterParam(event, "orgName");
  if (!orgName) {
    throw createError({ statusCode: 400, message: "Missing orgName" });
  }

  const db = useDB();
  const [org] = await db
    .select({ id: schema.organizations.id })
    .from(schema.organizations)
    .where(eq(schema.organizations.name, orgName))
    .limit(1);

  if (!org) {
    throw createError({ statusCode: 404, message: "Organization not found" });
  }

  return { orgId: org.id, orgName };
}
