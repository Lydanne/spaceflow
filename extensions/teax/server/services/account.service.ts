/**
 * 用户账户管理服务
 * 卡片交互逻辑已迁移到 CardKit card-pages（account-home / account-guide / account-unbound）
 */

import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { getActiveAccountId, setActiveAccountId } from "~~/server/utils/feishu-active-account";

/**
 * 获取飞书用户当前活跃的 Teax 账户
 * 如果没有设置或已失效，返回第一个绑定的账户
 */
export async function getActiveAccount(openId: string) {
  const db = useDB();

  // 查询所有绑定
  const bindings = await db
    .select({ user_id: schema.userFeishu.user_id })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, openId));

  if (bindings.length === 0) {
    return null;
  }

  const userIds = bindings.map((b) => b.user_id!);

  // 获取当前活跃账户
  const activeId = await getActiveAccountId(openId);

  // 验证活跃账户是否仍在绑定列表中
  const validActiveId = activeId && userIds.includes(activeId) ? activeId : userIds[0];

  // 如果活跃账户失效，更新为第一个
  if (activeId && !userIds.includes(activeId)) {
    await setActiveAccountId(openId, userIds[0]!);
  }

  // 查询用户信息
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, validActiveId!))
    .limit(1);

  return user || null;
}
