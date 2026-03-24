import { inArray } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { getFeishuSelectData } from "~~/server/utils/feishu-select-token";

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const token = query.token as string;

  if (!token) {
    throw createError({
      statusCode: 400,
      message: "Missing token",
    });
  }

  const data = await getFeishuSelectData(token);
  if (!data) {
    throw createError({
      statusCode: 400,
      message: "Invalid or expired token",
    });
  }

  const db = useDB();
  const users = await db
    .select({
      id: schema.users.id,
      gitea_username: schema.users.gitea_username,
      email: schema.users.email,
      avatar_url: schema.users.avatar_url,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, data.userIds));

  return {
    feishu_name: data.feishuName,
    feishu_avatar: data.feishuAvatar,
    users,
  };
});
