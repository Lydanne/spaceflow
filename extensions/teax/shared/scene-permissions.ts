/**
 * 场景权限定义
 * 前后端共享的场景配置
 */

export interface SceneDefinition {
  /** 场景唯一标识 */
  key: string;
  /** 场景显示名称 */
  name: string;
  /** 场景描述 */
  description: string;
  /** 所需权限列表 */
  permissions: string[];
}

/**
 * 预定义场景注册表
 * 新增场景时在此添加
 */
export const SCENE_REGISTRY: Record<string, SceneDefinition> = {
  "preset-workflow": {
    key: "preset-workflow",
    name: "预设工作流",
    description: "使用预设工作流触发 CI/CD 流程",
    permissions: ["actions:trigger"],
  },
  "repo-settings": {
    key: "repo-settings",
    name: "仓库设置",
    description: "修改仓库配置和发布设置",
    permissions: ["repo:settings"],
  },
  "deploy-production": {
    key: "deploy-production",
    name: "生产环境发布",
    description: "发布到生产环境",
    permissions: ["deploy:production"],
  },
  "view-audit-logs": {
    key: "view-audit-logs",
    name: "审计日志",
    description: "查看组织审计日志",
    permissions: ["audit:view"],
  },
};

/**
 * 获取场景定义
 */
export function getSceneDefinition(sceneKey: string): SceneDefinition | undefined {
  return SCENE_REGISTRY[sceneKey];
}

/**
 * 获取场景所需权限
 */
export function getScenePermissions(sceneKey: string): string[] {
  return SCENE_REGISTRY[sceneKey]?.permissions ?? [];
}

/**
 * 获取场景显示名称
 */
export function getSceneName(sceneKey: string): string {
  return SCENE_REGISTRY[sceneKey]?.name ?? sceneKey;
}

/**
 * 权限申请跳转参数
 */
export interface PermissionRequestParams {
  scene: string;
  permissions: string;
  org_id: string;
  team_id?: string;
  redirect: string;
}

/**
 * 构建权限申请页面 URL
 */
export function buildPermissionRequestUrl(params: PermissionRequestParams): string {
  const query = new URLSearchParams();
  query.set("scene", params.scene);
  query.set("permissions", params.permissions);
  query.set("org_id", params.org_id);
  if (params.team_id) {
    query.set("team_id", params.team_id);
  }
  query.set("redirect", params.redirect);
  return `/request-permission?${query.toString()}`;
}
