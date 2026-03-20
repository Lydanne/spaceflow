import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { useGiteaSdk } from "~~/server/utils/gitea";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const gitea = await useGiteaSdk(event).role("user");
  const db = useDB();

  // 获取用户所有组织名称
  const orgs = await db
    .select({ name: schema.organizations.name })
    .from(schema.organizations);

  // 并发查询每个组织的仓库数量
  const results = await Promise.allSettled(
    orgs.map((org) => gitea.getOrgRepoCount(org.name)),
  );

  let total = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      total += result.value;
    }
  }

  return { count: total };
});
