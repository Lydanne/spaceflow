import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../../../../db";
import { requireAdmin } from "../../../../../../../utils/auth";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();
  const memberId = getRouterParam(event, "memberId");

  if (!memberId) {
    throw createError({ statusCode: 400, message: "Missing memberId" });
  }

  const body = await readBody(event);
  const { role } = body as { role: string };

  if (!role || !["owner", "member"].includes(role)) {
    throw createError({ statusCode: 400, message: "Invalid role, must be 'owner' or 'member'" });
  }

  const [updated] = await db
    .update(schema.teamMembers)
    .set({ role })
    .where(eq(schema.teamMembers.id, memberId))
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, message: "Team member not found" });
  }

  return updated;
});
