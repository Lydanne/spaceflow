import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { resolveRepoId } from "~~/server/utils/resolve-repo";
import { requirePermission } from "~~/server/utils/permission";
import { requireAuth } from "~~/server/utils/auth";
import { createApprovalBodySchema } from "~~/server/shared/dto";
import { createApprovalRequest } from "~~/server/services/approval.service";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const { repoId, orgId } = await resolveRepoId(event);
  await requirePermission(event, orgId, "actions:trigger", repoId);

  const body = await readValidatedBody(event, createApprovalBodySchema.parse);

  // 查找发起者的飞书 open_id
  const db = useDB();
  const [binding] = await db
    .select({ feishu_open_id: schema.userFeishu.feishu_open_id })
    .from(schema.userFeishu)
    .where(eq(schema.userFeishu.user_id, session.user.id))
    .limit(1);

  const result = await createApprovalRequest({
    organizationId: orgId,
    repositoryId: body.repository_id || repoId,
    requesterId: session.user.id,
    requesterOpenId: binding?.feishu_open_id || "",
    type: body.type,
    title: body.title,
    description: body.description,
    metadata: body.metadata,
  });

  return { data: result };
});
