import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  const orgName = getRouterParam(event, "orgName");
  if (!orgName) {
    throw createError({ statusCode: 400, message: "Missing orgName" });
  }

  const db = useDB();

  const [org] = await db
    .select({
      id: schema.organizations.id,
      name: schema.organizations.name,
      full_name: schema.organizations.full_name,
      avatar_url: schema.organizations.avatar_url,
    })
    .from(schema.organizations)
    .where(eq(schema.organizations.name, orgName))
    .limit(1);

  if (!org) {
    throw createError({ statusCode: 404, message: "Organization not found" });
  }

  return org;
});
