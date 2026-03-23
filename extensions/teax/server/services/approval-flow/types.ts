import type { H3Event } from "h3";
import type { ApprovalFlow } from "~~/server/db/schema/approval-flow";

/**
 * 审批策略接口
 * 每种审批类型实现一个 Strategy
 */
export interface ApprovalStrategy<TPayload = Record<string, unknown>> {
  /**
   * 流程类型标识
   * 例如: 'permission:scene', 'deploy:production'
   */
  readonly flowType: string;

  /**
   * 校验申请数据
   * @throws 如果校验失败抛出错误
   */
  validateRequest(
    event: H3Event,
    payload: TPayload,
    organizationId?: string,
  ): Promise<void>;

  /**
   * 生成申请标题
   */
  buildTitle(payload: TPayload): Promise<string>;

  /**
   * 查找审批人列表
   * @returns 审批人的飞书 open_id 数组
   */
  findApprovers(
    organizationId: string | undefined,
    payload: TPayload,
  ): Promise<string[]>;

  /**
   * 构建卡片展示字段
   * 用于飞书审批卡片的内容展示
   */
  buildCardFields(
    flow: ApprovalFlow,
    payload: TPayload,
  ): Promise<Array<{ label: string; value: string }>>;

  /**
   * 审批通过后的业务操作
   * 例如：创建团队成员、触发部署等
   */
  onApproved(
    flow: ApprovalFlow,
    payload: TPayload,
    approverId: string,
  ): Promise<void>;

  /**
   * 审批拒绝后的业务操作（可选）
   * 默认不做任何操作
   */
  onRejected?(
    flow: ApprovalFlow,
    payload: TPayload,
    approverId: string,
    comment?: string,
  ): Promise<void>;

  /**
   * 申请过期后的业务操作（可选）
   */
  onExpired?(flow: ApprovalFlow, payload: TPayload): Promise<void>;

  /**
   * 获取申请人通知内容（可选）
   * 用于审批完成后通知申请人
   */
  getRequesterNotification?(
    flow: ApprovalFlow,
    payload: TPayload,
    result: "approved" | "rejected",
  ): Promise<{
    title: string;
    fields: Array<{ label: string; value: string }>;
  }>;
}

/**
 * 场景权限申请 Payload
 */
export interface ScenePermissionPayload {
  sceneName: string;
  permissions: string[];
  repositoryIds?: string[];
  teamId: string;
}

/**
 * 部署审批 Payload
 */
export interface DeployPayload {
  repositoryId: string;
  owner: string;
  repo: string;
  branch: string;
  workflow: string;
  commitSha?: string;
}
