import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  await requireAuth(event);
  const flowId = getRouterParam(event, "flowId");

  if (!flowId) {
    throw createError({ statusCode: 400, message: "Missing flowId" });
  }

  const db = useDB();
  const [flow] = await db
    .select()
    .from(schema.approvalFlows)
    .where(eq(schema.approvalFlows.id, flowId))
    .limit(1);

  if (!flow) {
    throw createError({ statusCode: 404, message: "Approval flow not found" });
  }

  return flow;
});
