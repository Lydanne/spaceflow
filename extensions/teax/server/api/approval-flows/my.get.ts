import { eq, and, desc } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const query = getQuery(event);

  const db = useDB();

  // 支持按 flow_type 和 status 过滤
  const conditions = [eq(schema.approvalFlows.requester_id, session.user.id)];

  if (query.flow_type) {
    conditions.push(eq(schema.approvalFlows.flow_type, String(query.flow_type)));
  }
  if (query.status) {
    conditions.push(eq(schema.approvalFlows.status, String(query.status)));
  }
  if (query.organization_id) {
    conditions.push(eq(schema.approvalFlows.organization_id, String(query.organization_id)));
  }

  const flows = await db
    .select()
    .from(schema.approvalFlows)
    .where(and(...conditions))
    .orderBy(desc(schema.approvalFlows.created_at))
    .limit(50);

  return flows;
});
