import { useDB, schema } from "../../db";
import { requireAuth, createGiteaServiceWithRefresh } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const gitea = await createGiteaServiceWithRefresh(event, session);
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
