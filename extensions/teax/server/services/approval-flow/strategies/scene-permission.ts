import { eq, and } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import type { ApprovalStrategy, ScenePermissionPayload } from "../types";

/**
 * 场景权限申请策略
 *
 * 用户描述场景名称和所需权限，系统自动查找/创建 scene 类型权限组
 */
export const scenePermissionStrategy: ApprovalStrategy<ScenePermissionPayload> = {
  flowType: "permission:scene",

  async validateRequest(_event, payload, organizationId) {
    // 校验权限列表非空
    if (!payload.permissions?.length) {
      throw createError({ statusCode: 400, message: "权限列表不能为空" });
    }
    // 校验场景名称非空
    if (!payload.sceneName?.trim()) {
      throw createError({ statusCode: 400, message: "场景名称不能为空" });
    }
    // 校验团队存在且属于同一组织
    if (!payload.teamId) {
      throw createError({ statusCode: 400, message: "团队 ID 不能为空" });
    }

    const db = useDB();
    const [team] = await db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, payload.teamId))
      .limit(1);

    if (!team) {
      throw createError({ statusCode: 404, message: "团队不存在" });
    }

    if (organizationId && team.organization_id !== organizationId) {
      throw createError({ statusCode: 400, message: "团队不属于该组织" });
    }

    // 检查是否有重复的待处理申请
    const [existingFlow] = await db
      .select()
      .from(schema.approvalFlows)
      .where(
        and(
          eq(schema.approvalFlows.flow_type, "permission:scene"),
          eq(schema.approvalFlows.status, "pending"),
          eq(schema.approvalFlows.organization_id, organizationId!),
        ),
      )
      .limit(1);

    if (existingFlow) {
      const existingPayload = existingFlow.payload as ScenePermissionPayload;
      if (
        existingPayload.sceneName === payload.sceneName &&
        existingPayload.teamId === payload.teamId
      ) {
        throw createError({
          statusCode: 400,
          message: "已存在相同场景的待处理申请",
        });
      }
    }
  },

  async buildTitle(payload) {
    return `申请场景权限「${payload.sceneName}」`;
  },

  async findApprovers(organizationId, _payload) {
    if (!organizationId) return [];

    const db = useDB();
    // 查找组织 Owner 的飞书 open_id
    const admins = await db
      .select({ openId: schema.userFeishu.feishu_open_id })
      .from(schema.teamMembers)
      .innerJoin(schema.teams, eq(schema.teams.id, schema.teamMembers.team_id))
      .innerJoin(schema.userFeishu, eq(schema.userFeishu.user_id, schema.teamMembers.user_id))
      .where(
        and(
          eq(schema.teams.organization_id, organizationId),
          eq(schema.teamMembers.role, "owner"),
        ),
      );

    return admins.map((a) => a.openId).filter(Boolean) as string[];
  },

  async buildCardFields(_flow, payload) {
    return [
      { label: "场景名称", value: payload.sceneName },
      { label: "申请权限", value: payload.permissions.join(", ") },
      ...(payload.repositoryIds?.length
        ? [{ label: "仓库范围", value: `${payload.repositoryIds.length} 个仓库` }]
        : [{ label: "仓库范围", value: "全部仓库" }]),
    ];
  },

  async onApproved(flow, payload, _approverId) {
    const db = useDB();

    // 1. 按场景名称查找已有的场景权限组
    const [existingGroup] = await db
      .select()
      .from(schema.permissionGroups)
      .where(
        and(
          eq(schema.permissionGroups.organization_id, flow.organization_id!),
          eq(schema.permissionGroups.type, "scene"),
          eq(schema.permissionGroups.name, payload.sceneName),
        ),
      )
      .limit(1);

    let groupId = existingGroup?.id;

    // 2. 未找到则创建，找到则更新权限（合并新申请的权限）
    if (!groupId) {
      const [newGroup] = await db
        .insert(schema.permissionGroups)
        .values({
          organization_id: flow.organization_id,
          type: "scene",
          name: payload.sceneName,
          description: `场景权限：${payload.sceneName}`,
          permissions: payload.permissions,
          repository_ids: payload.repositoryIds || null,
        })
        .returning();
      groupId = newGroup?.id;
    } else {
      // 合并权限：将新申请的权限添加到现有权限组
      const existingPerms = (existingGroup!.permissions as string[]) || [];
      const mergedPerms = [...new Set([...existingPerms, ...payload.permissions])];

      // 只有权限有变化时才更新
      if (mergedPerms.length !== existingPerms.length ||
        !mergedPerms.every((p) => existingPerms.includes(p))) {
        await db
          .update(schema.permissionGroups)
          .set({
            permissions: mergedPerms,
            updated_at: new Date(),
          })
          .where(eq(schema.permissionGroups.id, groupId));
      }
    }

    if (!groupId) {
      throw createError({ statusCode: 500, message: "创建权限组失败" });
    }

    // 3. 为团队绑定权限组（忽略重复）
    await db
      .insert(schema.teamPermissions)
      .values({
        team_id: payload.teamId,
        permission_group_id: groupId,
      })
      .onConflictDoNothing();
  },

  async getRequesterNotification(flow, payload, result) {
    const isApproved = result === "approved";
    return {
      title: isApproved
        ? `✅ 场景权限「${payload.sceneName}」已通过`
        : `❌ 场景权限「${payload.sceneName}」已拒绝`,
      fields: [
        { label: "申请内容", value: flow.title },
        { label: "申请权限", value: payload.permissions.join(", ") },
      ],
    };
  },
};
