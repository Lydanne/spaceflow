import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../../../db";
import { requireAdmin } from "../../../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();
  const teamId = getRouterParam(event, "teamId");

  if (!teamId) {
    throw createError({ statusCode: 400, message: "Missing teamId" });
  }

  const members = await db
    .select({
      id: schema.teamMembers.id,
      team_id: schema.teamMembers.team_id,
      user_id: schema.teamMembers.user_id,
      role: schema.teamMembers.role,
      joined_at: schema.teamMembers.joined_at,
      username: schema.users.gitea_username,
      email: schema.users.email,
      avatar_url: schema.users.avatar_url,
      gitea_id: schema.users.gitea_id,
    })
    .from(schema.teamMembers)
    .innerJoin(schema.users, eq(schema.teamMembers.user_id, schema.users.id))
    .where(eq(schema.teamMembers.team_id, teamId));

  return { data: members };
});
