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

  const body = await readBody(event);
  const { user_id, role = "member" } = body as { user_id: string; role?: string };

  if (!user_id) {
    throw createError({ statusCode: 400, message: "Missing user_id" });
  }

  if (!["owner", "member"].includes(role)) {
    throw createError({ statusCode: 400, message: "Invalid role, must be 'owner' or 'member'" });
  }

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
