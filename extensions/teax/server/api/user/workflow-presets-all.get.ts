import { asc, desc, eq, inArray } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { requireAuth } from "~~/server/utils/auth";

export default defineEventHandler(async (event) => {
  const session = await requireAuth(event);
  const db = useDB();

  // 1. 获取用户创建的预设组
  const groups = await db
    .select({
      id: schema.workflowPresetGroups.id,
      name: schema.workflowPresetGroups.name,
      description: schema.workflowPresetGroups.description,
      workflow_path: schema.workflowPresetGroups.workflow_path,
      default_branch: schema.workflowPresetGroups.default_branch,
      share_token: schema.workflowPresetGroups.share_token,
      created_at: schema.workflowPresetGroups.created_at,
      repository: {
        id: schema.repositories.id,
        full_name: schema.repositories.full_name,
      },
    })
    .from(schema.workflowPresetGroups)
    .innerJoin(
      schema.repositories,
      eq(schema.workflowPresetGroups.repository_id, schema.repositories.id),
    )
    .where(eq(schema.workflowPresetGroups.created_by, session.user.id))
    .orderBy(desc(schema.workflowPresetGroups.created_at));

  const groupIds = groups.map((g) => g.id);
  const groupPresets: Array<{
    id: string;
    name: string;
    branch: string;
    share_token: string | null;
    preset_index: number | null;
    group_id: string | null;
    locked_by: string | null;
    locked_at: Date | null;
    current_run_id: number | null;
  }> = [];

  if (groupIds.length > 0) {
    const allGroupPresets = await db
      .select({
        id: schema.workflowPresets.id,
        name: schema.workflowPresets.name,
        branch: schema.workflowPresets.branch,
        share_token: schema.workflowPresets.share_token,
        preset_index: schema.workflowPresets.preset_index,
        group_id: schema.workflowPresets.group_id,
        locked_by: schema.workflowPresets.locked_by,
        locked_at: schema.workflowPresets.locked_at,
        current_run_id: schema.workflowPresets.current_run_id,
      })
      .from(schema.workflowPresets)
      .where(inArray(schema.workflowPresets.group_id, groupIds))
      .orderBy(asc(schema.workflowPresets.preset_index));
    groupPresets.push(...allGroupPresets);
  }

  // 3. 获取独立预设（group_id 为 null）
  const standalonePresets = await db
    .select({
      id: schema.workflowPresets.id,
      name: schema.workflowPresets.name,
      branch: schema.workflowPresets.branch,
      share_token: schema.workflowPresets.share_token,
      preset_index: schema.workflowPresets.preset_index,
      locked_by: schema.workflowPresets.locked_by,
      locked_at: schema.workflowPresets.locked_at,
      current_run_id: schema.workflowPresets.current_run_id,
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

  // 4. 按 group_id 分组子预设
  const presetsByGroup = new Map<string, typeof groupPresets>();
  for (const preset of groupPresets) {
    if (!preset.group_id) continue;
    const list = presetsByGroup.get(preset.group_id) ?? [];
    list.push(preset);
    presetsByGroup.set(preset.group_id, list);
  }

  // 5. 组装返回数据
  const groupsWithPresets = groups.map((group) => ({
    ...group,
    presets: presetsByGroup.get(group.id) ?? [],
  }));

  return {
    data: {
      groups: groupsWithPresets,
      standalone: standalonePresets,
    },
  };
});
