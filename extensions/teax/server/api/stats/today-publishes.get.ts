import { requireAuth } from "../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);

  // TODO: 对接 Gitea Actions API 统计今日 workflow runs 数量
  // 目前返回占位数据，后续可通过 Gitea API 聚合各项目的 workflow runs
  return { count: 0 };
});
