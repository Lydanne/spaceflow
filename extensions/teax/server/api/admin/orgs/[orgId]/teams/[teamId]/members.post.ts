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
  const { userId, role = "member" } = body as { userId: string; role?: string };

  if (!userId) {
    throw createError({ statusCode: 400, message: "Missing userId" });
  }

  if (!["owner", "member"].includes(role)) {
    throw createError({ statusCode: 400, message: "Invalid role, must be 'owner' or 'member'" });
  }

  // 验证用户存在
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);

  if (!user) {
    throw createError({ statusCode: 404, message: "User not found" });
  }

  const [member] = await db
    .insert(schema.teamMembers)
    .values({
      teamId,
      userId,
      role,
    })
    .onConflictDoUpdate({
      target: [schema.teamMembers.teamId, schema.teamMembers.userId],
      set: { role },
    })
    .returning();

  return member;
});
