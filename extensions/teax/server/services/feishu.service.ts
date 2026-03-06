import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { FeishuUserInfo } from "~~/server/utils/feishu";

export async function findUserByFeishuOpenId(openId: string) {
  const db = useDB();
  const [binding] = await db
    .select()
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, openId))
    .limit(1);

  if (!binding?.user_id) {
    return null;
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, binding.user_id))
    .limit(1);

  return user || null;
}

export async function bindFeishuToUser(
  user_id: string,
  feishuUser: FeishuUserInfo,
  accessToken: string,
  tokenExpiresAt: Date,
) {
  const db = useDB();

  const [existing] = await db
    .select()
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishu_open_id, feishuUser.open_id))
    .limit(1);

  if (existing) {
    await db
      .update(schema.userFeishu)
      .set({
        feishu_name: feishuUser.name,
        feishu_avatar: feishuUser.avatar_url,
        feishu_union_id: feishuUser.union_id,
        access_token: accessToken,
        token_expires_at: tokenExpiresAt,
      })
      .where(eq(schema.userFeishu.feishu_open_id, feishuUser.open_id));
    return existing;
  }

  const [binding] = await db
    .insert(schema.userFeishu)
    .values({
      user_id,
      feishu_open_id: feishuUser.open_id,
      feishu_union_id: feishuUser.union_id,
      feishu_name: feishuUser.name,
      feishu_avatar: feishuUser.avatar_url,
      access_token: accessToken,
      token_expires_at: tokenExpiresAt,
    })
    .returning();

  return binding;
}
