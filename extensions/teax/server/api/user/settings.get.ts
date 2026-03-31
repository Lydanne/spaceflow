import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { normalizeUserSettings } from "~~/shared/user-settings";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const [row] = await db
    .select({ settings: schema.users.settings })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  if (!row) {
    throw createError({ statusCode: 404, message: "用户不存在" });
  }

  const settings = normalizeUserSettings(row.settings);
  return {
    data: {
      settings,
      notifyPreferences: settings.notifyPreferences,
    },
  };
});
