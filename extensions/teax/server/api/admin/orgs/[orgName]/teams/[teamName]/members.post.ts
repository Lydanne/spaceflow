import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAdmin } from "~~/server/utils/auth";
import { addTeamMemberBodySchema } from "~~/server/shared/dto";
import { resolveTeamId } from "~~/server/utils/resolve-team";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const { teamId } = await resolveTeamId(event);
  const db = useDB();

  const { user_id, role } = await readValidatedBody(event, addTeamMemberBodySchema.parse);

  // 验证用户存在
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, user_id))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  const [member] = await db
    .insert(schema.teamMembers)
    .values({
      team_id: teamId,
      user_id,
      role,
    })
    .onConflictDoUpdate({
      target: [schema.teamMembers.team_id, schema.teamMembers.user_id],
      set: { role },
    })
    .returning();

  return member;
});
