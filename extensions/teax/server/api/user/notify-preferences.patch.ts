import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";
import { updateNotifyPreferencesBodySchema } from "~~/server/shared/dto";
import { normalizeNotifyPreferences } from "~~/shared/notify-events";
import { normalizeUserSettings, type UserSettings } from "~~/shared/user-settings";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const body = await readValidatedBody(event, updateNotifyPreferencesBodySchema.parse);

  const [currentUser] = await db
    .select({
      settings: schema.users.settings,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  if (!currentUser) {
    throw createError({ statusCode: 404, message: "用户不存在" });
  }

  const currentSettings = normalizeUserSettings(currentUser.settings);
  const mergedPreferences = normalizeNotifyPreferences({
    ...currentSettings.notifyPreferences,
    ...body.notifyPreferences,
    repoEvents: {
      ...(currentSettings.notifyPreferences?.repoEvents || {}),
      ...(body.notifyPreferences?.repoEvents || {}),
    },
    personalEvents: {
      ...(currentSettings.notifyPreferences?.personalEvents || {}),
      ...(body.notifyPreferences?.personalEvents || {}),
    },
  });

  const nextSettings: UserSettings = {
    ...currentSettings,
    notifyPreferences: mergedPreferences,
  };

  const [updated] = await db
    .update(schema.users)
    .set({
      settings: nextSettings,
      updated_at: new Date(),
    })
    .where(eq(schema.users.id, session.user.id))
    .returning({
      settings: schema.users.settings,
    });

  const normalized = normalizeUserSettings(updated?.settings);
  return {
    data: {
      settings: normalized,
      notifyPreferences: normalized.notifyPreferences,
    },
  };
});
