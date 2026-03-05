import { removeSession } from "../../utils/session";

export default defineEventHandler(async (event) => {
  const session = await getUserSession(event);

  if (session?.user?.id && session?.sessionId) {
    await removeSession(session.user.id, session.sessionId);
  }

  await clearUserSession(event);
  return { success: true };
});
