/**
 * 系统权限定义（单一数据源）。
 * 前端通过 /api/permissions/definitions 获取，后端 requirePermission 也引用此定义。
 */

export interface PermissionDefinition {
  key: string;
  label: string;
  group: string;
}

export const PERMISSION_GROUPS = [
  { key: "project", label: "项目" },
  { key: "publish", label: "发布" },
  { key: "agent", label: "Agent" },
  { key: "page", label: "Pages" },
  { key: "miniapp", label: "小程序" },
  { key: "team", label: "团队" },
  { key: "settings", label: "设置" },
] as const;

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  { key: "project:create", label: "创建项目", group: "project" },
  { key: "project:delete", label: "删除项目", group: "project" },
  { key: "project:settings", label: "项目设置", group: "project" },
  { key: "publish:trigger", label: "触发发布", group: "publish" },
  { key: "publish:approve", label: "审批发布", group: "publish" },
  { key: "publish:rollback", label: "回滚发布", group: "publish" },
  { key: "agent:start", label: "启动 Agent", group: "agent" },
  { key: "agent:stop", label: "停止 Agent", group: "agent" },
  { key: "page:deploy", label: "部署 Pages", group: "page" },
  { key: "miniapp:manage", label: "小程序管理", group: "miniapp" },
  { key: "team:manage", label: "团队管理", group: "team" },
  { key: "settings:manage", label: "组织设置", group: "settings" },
];

/** 所有合法的权限 key 集合，用于校验 */
export const VALID_PERMISSION_KEYS = new Set(
  PERMISSION_DEFINITIONS.map((d) => d.key),
);
