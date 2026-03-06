import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const deleted = await db
    .delete(schema.userFeishu)
    .where(eq(schema.userFeishu.user_id, session.user.id))
    .returning({ id: schema.userFeishu.id });

  if (deleted.length === 0) {
    throw createError({ statusCode: 404, message: "No Feishu binding found" });
  }

  return { data: { unbound: true } };
});
