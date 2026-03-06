import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAdmin } from "~~/server/utils/auth";
import { resolveTeamId } from "~~/server/utils/resolve-team";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { teamId } = await resolveTeamId(event);
  const db = useDB();
  const memberId = getRouterParam(event, "memberId");

  if (!memberId) {
    throw createError({ statusCode: 400, message: "Missing memberId" });
  }

  const [deleted] = await db
    .delete(schema.teamMembers)
    .where(
      and(
        eq(schema.teamMembers.id, memberId),
        eq(schema.teamMembers.team_id, teamId),
      ),
    )
    .returning();

  if (!deleted) {
    throw createError({ statusCode: 404, message: "Team member not found" });
  }

  return { success: true };
});
