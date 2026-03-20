import { desc, eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  const presets = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      workflow_path: schema.workflowPresets.workflow_path,
      branch: schema.workflowPresets.branch,
      share_token: schema.workflowPresets.share_token,
      allow_input_override: schema.workflowPresets.allow_input_override,
      allow_branch_override: schema.workflowPresets.allow_branch_override,
      created_at: schema.workflowPresets.created_at,
      repository: {
        id: schema.repositories.id,
        full_name: schema.repositories.full_name,
      },
    })
    .from(schema.workflowPresets)
    .innerJoin(
      schema.repositories,
      eq(schema.workflowPresets.repository_id, schema.repositories.id),
    )
    .where(eq(schema.workflowPresets.created_by, session.user.id))
    .orderBy(desc(schema.workflowPresets.created_at));

  return { data: presets };
});
