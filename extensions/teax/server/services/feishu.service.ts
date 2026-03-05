import { eq } from "drizzle-orm";
import { useDB, schema } from "../db";
import type { FeishuUserInfo } from "../utils/feishu";

export async function findUserByFeishuOpenId(openId: string) {
  const db = useDB();
  const [binding] = await db
    .select()
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishuOpenId, openId))
    .limit(1);

  if (!binding?.userId) {
    return null;
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, binding.userId))
    .limit(1);

  return user || null;
}

export async function bindFeishuToUser(
  userId: string,
  feishuUser: FeishuUserInfo,
  accessToken: string,
  tokenExpiresAt: Date,
) {
  const db = useDB();

  const [existing] = await db
    .select()
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.feishuOpenId, feishuUser.open_id))
    .limit(1);

  if (existing) {
    await db
      .update(schema.userFeishu)
      .set({
        feishuName: feishuUser.name,
        feishuAvatar: feishuUser.avatar_url,
        feishuUnionId: feishuUser.union_id,
        accessToken,
        tokenExpiresAt,
      })
      .where(eq(schema.userFeishu.feishuOpenId, feishuUser.open_id));
    return existing;
  }

  const [binding] = await db
    .insert(schema.userFeishu)
    .values({
      userId,
      feishuOpenId: feishuUser.open_id,
      feishuUnionId: feishuUser.union_id,
      feishuName: feishuUser.name,
      feishuAvatar: feishuUser.avatar_url,
      accessToken,
      tokenExpiresAt,
    })
    .returning();

  return binding;
}
