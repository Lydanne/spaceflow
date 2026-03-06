import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { updateNotifyPreferencesBodySchema } from "~~/server/shared/dto";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const body = await readValidatedBody(event, updateNotifyPreferencesBodySchema.parse);

  const [binding] = await db
    .select({ id: schema.userFeishu.id })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.user_id, session.user.id))
    .limit(1);

  if (!binding) {
    throw createError({ statusCode: 404, message: "请先绑定飞书账号" });
  }

  const updateData: Record<string, unknown> = { updated_at: new Date() };
  if (body.notify_publish !== undefined) updateData.notify_publish = body.notify_publish;
  if (body.notify_approval !== undefined) updateData.notify_approval = body.notify_approval;
  if (body.notify_agent !== undefined) updateData.notify_agent = body.notify_agent;
  if (body.notify_system !== undefined) updateData.notify_system = body.notify_system;

  const [updated] = await db
    .update(schema.userFeishu)
    .set(updateData)
    .where(eq(schema.userFeishu.user_id, session.user.id))
    .returning({
      notify_publish: schema.userFeishu.notify_publish,
      notify_approval: schema.userFeishu.notify_approval,
      notify_agent: schema.userFeishu.notify_agent,
      notify_system: schema.userFeishu.notify_system,
    });

  return { data: updated };
});
