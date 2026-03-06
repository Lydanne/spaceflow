import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireTeamOwnerOrAdmin } from "~~/server/utils/team-owner";
import { resolveTeamId } from "~~/server/utils/resolve-team";

export default defineEventHandler(async (event) => {
  const { teamId } = await resolveTeamId(event);
  const assignmentId = getRouterParam(event, "assignmentId");

  if (!assignmentId) {
    throw createError({ statusCode: 400, message: "Missing assignmentId" });
  }

  await requireTeamOwnerOrAdmin(event, teamId);
  const db = useDB();

  const [deleted] = await db
    .delete(schema.teamPermissions)
    .where(eq(schema.teamPermissions.id, assignmentId))
    .returning({ id: schema.teamPermissions.id });

  if (!deleted) {
    throw createError({ statusCode: 404, message: "Permission assignment not found" });
  }

  return { success: true };
});
