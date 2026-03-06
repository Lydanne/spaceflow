import { eq } from "drizzle-orm";
import { useDB, schema } from "../../../../../../../db";
import { requireAdmin } from "../../../../../../../utils/auth";
import { updateMemberRoleBodySchema } from "../../../../../../../shared/dto";

export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  const db = useDB();
  const memberId = getRouterParam(event, "memberId");

  if (!memberId) {
    throw createError({ statusCode: 400, message: "Missing memberId" });
  }

  const { role } = await readValidatedBody(event, updateMemberRoleBodySchema.parse);

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
