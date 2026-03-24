import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";

interface FeishuUserInfo {
  open_id: string;
  union_id: string;
  user_id: string;
  name: string;
  en_name: string;
  avatar_url: string;
  email: string;
  mobile: string;
}

export interface FeishuBoundUser {
  id: string;
  gitea_username: string;
  email: string;
  avatar_url: string | null;
  is_admin: boolean | null;
  gitea_id: number;
}

export async function findUsersByFeishuOpenId(openId: string): Promise<FeishuBoundUser[]> {
  const db = useDB();
  const bindings = await db
    .select({
      user: schema.users,
    })
    .from(schema.userFeishu)
    .innerJoin(schema.users, eq(schema.userFeishu.user_id, schema.users.id))
    .where(eq(schema.userFeishu.feishu_open_id, openId));

  return bindings.map((b) => b.user);
}

export async function findUserByFeishuOpenId(openId: string) {
  const users = await findUsersByFeishuOpenId(openId);
  return users[0] || null;
}

export async function bindFeishuToUser(
  user_id: string,
  feishuUser: FeishuUserInfo,
  accessToken: string,
  tokenExpiresAt: Date,
  refreshToken?: string,
) {
  const db = useDB();

  // 查找该用户是否已绑定此飞书账号（按 user_id + open_id 组合查找）
  const [existing] = await db
    .select()
    .from(schema.userFeishu)
    .where(and(
      eq(schema.userFeishu.user_id, user_id),
      eq(schema.userFeishu.feishu_open_id, feishuUser.open_id),
    ))
    .limit(1);

  if (existing) {
    // 更新已有绑定
    await db
      .update(schema.userFeishu)
      .set({
        feishu_name: feishuUser.name,
        feishu_avatar: feishuUser.avatar_url,
        feishu_union_id: feishuUser.union_id,
        access_token: accessToken,
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
      })
      .where(eq(schema.userFeishu.id, existing.id));
    return existing;
  }

  // 创建新绑定（允许同一飞书绑定不同用户）
  const [binding] = await db
    .insert(schema.userFeishu)
    .values({
      user_id,
      feishu_open_id: feishuUser.open_id,
      feishu_union_id: feishuUser.union_id,
      feishu_name: feishuUser.name,
      feishu_avatar: feishuUser.avatar_url,
      access_token: accessToken,
      refresh_token: refreshToken,
      token_expires_at: tokenExpiresAt,
    })
    .returning();

  return binding;
}
