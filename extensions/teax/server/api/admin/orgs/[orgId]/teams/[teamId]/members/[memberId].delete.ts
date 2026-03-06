import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAdmin } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();
  const memberId = getRouterParam(event, "memberId");

  if (!memberId) {
    throw createError({ statusCode: 400, message: "Missing memberId" });
  }

  const [deleted] = await db
    .delete(schema.teamMembers)
    .where(eq(schema.teamMembers.id, memberId))
    .returning();

  if (!deleted) {
    throw createError({ statusCode: 404, message: "Team member not found" });
  }

  return { success: true };
});
