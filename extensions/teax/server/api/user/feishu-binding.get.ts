import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const [binding] = await db
    .select({
      id: schema.userFeishu.id,
      feishu_open_id: schema.userFeishu.feishu_open_id,
      feishu_name: schema.userFeishu.feishu_name,
      feishu_avatar: schema.userFeishu.feishu_avatar,
      notify_publish: schema.userFeishu.notify_publish,
      notify_approval: schema.userFeishu.notify_approval,
      notify_agent: schema.userFeishu.notify_agent,
      notify_system: schema.userFeishu.notify_system,
      created_at: schema.userFeishu.created_at,
    })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.user_id, session.user.id))
    .limit(1);

  return { data: binding || null };
});
