/**
 * 系统权限定义（单一数据源）。
 * 前端通过 /api/permissions/definitions 获取，后端 requirePermission 也引用此定义。
 */

export interface PermissionDefinition {
  key: string;
  label: string;
  group: string;
  pattern?: boolean;
  description?: string;
  examples?: string[];
}

export const PERMISSION_GROUPS = [
  { key: "repo", label: "仓库" },
  { key: "actions", label: "Actions" },
  { key: "agent", label: "Agent" },
  { key: "page", label: "Pages" },
  { key: "miniapp", label: "小程序" },
  { key: "team", label: "团队" },
  { key: "settings", label: "设置" },
] as const;

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  // 仓库权限
  { key: "repo:view", label: "查看仓库", group: "repo" },
  { key: "repo:create", label: "创建仓库", group: "repo" },
  { key: "repo:delete", label: "删除仓库", group: "repo" },
  { key: "repo:settings", label: "仓库设置", group: "repo" },

  // Actions 权限 - 基础
  { key: "actions:view", label: "查看所有 Actions", group: "actions", description: "查看所有 workflow 运行记录" },
  { key: "actions:trigger", label: "触发所有 Workflow", group: "actions", description: "可以触发任意 workflow" },

  // Actions 权限 - 模式匹配
  {
    key: "actions:view:test-*",
    label: "查看测试 Actions",
    group: "actions",
    pattern: true,
    description: "只能查看测试相关的 workflow",
    examples: ["test-unit", "test-integration", "test-e2e"],
  },
  {
    key: "actions:trigger:test-*",
    label: "触发测试 Workflow",
    group: "actions",
    pattern: true,
    description: "只能触发测试相关的 workflow",
    examples: ["test-unit", "test-integration", "test-e2e"],
  },
  {
    key: "actions:trigger:publish-*",
    label: "触发发布 Workflow",
    group: "actions",
    pattern: true,
    description: "只能触发发布相关的 workflow",
    examples: ["publish-npm", "publish-docker", "publish-pypi"],
  },
  {
    key: "actions:trigger:deploy-*-staging",
    label: "触发 Staging 部署",
    group: "actions",
    pattern: true,
    description: "只能触发 staging 环境的部署",
    examples: ["deploy-api-staging", "deploy-web-staging"],
  },
  {
    key: "actions:trigger:deploy-*-production",
    label: "触发 Production 部署",
    group: "actions",
    pattern: true,
    description: "只能触发 production 环境的部署",
    examples: ["deploy-api-production", "deploy-web-production"],
  },

  // Agent 权限
  { key: "agent:start", label: "启动所有 Agent", group: "agent" },
  { key: "agent:stop", label: "停止所有 Agent", group: "agent" },
  {
    key: "agent:start:dev-*",
    label: "启动开发环境 Agent",
    group: "agent",
    pattern: true,
    description: "只能启动开发环境的 agent",
    examples: ["dev-api", "dev-web"],
  },
  {
    key: "agent:start:prod-*",
    label: "启动生产环境 Agent",
    group: "agent",
    pattern: true,
    description: "只能启动生产环境的 agent",
    examples: ["prod-api", "prod-web"],
  },
  {
    key: "agent:stop:prod-*",
    label: "停止生产环境 Agent",
    group: "agent",
    pattern: true,
    description: "只能停止生产环境的 agent",
    examples: ["prod-api", "prod-web"],
  },

  // Pages 权限
  { key: "page:deploy", label: "部署所有环境", group: "page" },
  {
    key: "page:deploy:staging",
    label: "部署到 Staging",
    group: "page",
    pattern: true,
    description: "只能部署到 staging 环境",
  },
  {
    key: "page:deploy:production",
    label: "部署到 Production",
    group: "page",
    pattern: true,
    description: "只能部署到 production 环境",
  },

  // 其他权限
  { key: "miniapp:manage", label: "小程序管理", group: "miniapp" },
  { key: "team:manage", label: "团队管理", group: "team" },
  { key: "settings:manage", label: "组织设置", group: "settings" },
];

/**
 * 所有预定义的权限 key 集合。
 * 注意：用户可以创建自定义模式权限（如 actions:trigger:my-custom-*），
 * 所以权限校验不应该严格限制在此集合中。
 */
export const PREDEFINED_PERMISSION_KEYS = new Set(
  PERMISSION_DEFINITIONS.map((d) => d.key),
);

/**
 * 验证权限 key 的格式是否合法。
 * 格式：<group>:<action>[:<pattern>]
 */
export function isValidPermissionFormat(key: string): boolean {
  const parts = key.split(":");
  if (parts.length < 2 || parts.length > 3) return false;
  if (parts.some((p) => !p || p.trim() === "")) return false;
  return true;
}
