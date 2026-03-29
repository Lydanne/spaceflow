# 数据库设计文档

> 完整的数据库 Schema 和表结构设计

## 技术栈

- **数据库**：PostgreSQL 14+
- **ORM**：Drizzle ORM
- **迁移工具**：Drizzle Kit

## 核心表结构

### 用户相关

#### users - 用户表

```typescript
{
  id: uuid (PK),
  gitea_id: integer (unique),
  gitea_username: string,
  gitea_email: string,
  gitea_avatar_url: string,
  feishu_open_id: string (nullable),
  feishu_user_id: string (nullable),
  is_admin: boolean (default: false),
  notify_preferences: jsonb (default: {}),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

### 组织和团队

#### organizations - 组织表

```typescript
{
  id: uuid (PK),
  gitea_id: integer (unique),
  name: string (unique),
  display_name: string,
  avatar_url: string,
  settings: jsonb (default: {}),
  last_synced_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### teams - 团队表

```typescript
{
  id: uuid (PK),
  organization_id: uuid (FK -> organizations.id),
  gitea_id: integer (unique),
  name: string,
  description: string,
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### team_members - 团队成员表

```typescript
{
  id: uuid (PK),
  team_id: uuid (FK -> teams.id),
  user_id: uuid (FK -> users.id),
  role: enum('owner', 'admin', 'member'),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

### 权限系统

#### permission_groups - 权限组表

```typescript
{
  id: uuid (PK),
  organization_id: uuid (FK -> organizations.id),
  type: enum('system', 'custom'),
  name: string,
  description: string,
  permissions: text[] (权限 key 数组),
  repository_ids: uuid[] (nullable, 限定仓库范围),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### team_permissions - 团队权限绑定表

```typescript
{
  id: uuid (PK),
  team_id: uuid (FK -> teams.id),
  permission_group_id: uuid (FK -> permission_groups.id),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

### 项目相关

#### repositories - 项目/仓库表

```typescript
{
  id: uuid (PK),
  organization_id: uuid (FK -> organizations.id),
  gitea_id: integer (unique),
  owner: string,
  name: string,
  full_name: string (unique),
  description: string,
  default_branch: string,
  html_url: string,
  clone_url: string,
  webhook_id: integer (nullable),
  settings: jsonb (default: {}),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

### 工作区

#### workspaces - 工作区表

```typescript
{
  id: uuid (PK),
  repository_id: uuid (FK -> repositories.id),
  name: string (unique, 全局唯一),
  type: enum('ci', 'project', 'personal'), // 工作区类型
  visibility: enum('project', 'personal'),  // 可见性：project=项目级，personal=用户级
  branch: string,
  container_id: string (nullable),
  container_host: string (default: 'localhost'),
  ide_port: integer (nullable),
  app_port: integer (nullable),
  status: enum('creating', 'running', 'stopping', 'stopped', 'starting', 'failed', 'deleting'),
  creator_id: uuid (FK -> users.id),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

**字段说明：**
- `type`: 工作区类型
  - `ci`: CI 工作区（系统自动创建，不可删除）
  - `project`: 项目工作区（项目成员创建，所有成员可见）
  - `personal`: 个人工作区（用户创建，仅自己可见）
- `visibility`: 可见性级别
  - `project`: 项目级 - 所有项目成员可见和访问
  - `personal`: 用户级 - 仅创建者可见（管理员和 Owner 例外）

### Agent 系统

#### agent_runtimes - 仓库 Runtime 表

```typescript
{
  id: uuid (PK),
  scope: string (default: 'repo'),
  repository_id: uuid (FK -> repositories.id),
  provider: string (default: 'docker'),
  runtime_key: string (nullable),   // 例如容器名
  status: string,                   // starting/running/stopped/failed
  last_heartbeat_at: timestamp (nullable),
  last_error: text (nullable),
  metadata: jsonb,
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### agent_sessions - Agent 会话表

```typescript
{
  id: uuid (PK),
  runtime_id: uuid (nullable),
  scope: string (default: 'repo'),
  parent_session_id: uuid (nullable),
  title: string (nullable),
  prompt: text (nullable),
  base_branch: string (default: 'main'),
  working_branch: string (nullable),
  session_path: text (nullable),
  visibility: enum('public', 'private'),
  creator_id: uuid (FK -> users.id),
  status: string,                   // created/preparing/running/failed/stopped/completed
  opencode_session_id: string (nullable),
  auto_commit: boolean,
  auto_pr: boolean,
  pr_url: text (nullable),
  started_at: timestamp (nullable),
  finished_at: timestamp (nullable),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### agent_session_worktrees - 会话目录生命周期表

```typescript
{
  id: uuid (PK),
  session_id: uuid (FK -> agent_sessions.id),
  repository_id: uuid (FK -> repositories.id),
  runtime_id: uuid (FK -> agent_runtimes.id, nullable),
  base_branch: string,
  working_branch: string,
  worktree_path: text,
  status: string,                   // preparing/active/failed/removed
  prepared_at: timestamp (nullable),
  removed_at: timestamp (nullable),
  last_error: text (nullable),
  metadata: jsonb,
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### agent_session_participants - 会话参与者表

```typescript
{
  id: uuid (PK),
  session_id: uuid (FK -> agent_sessions.id),
  user_id: uuid (FK -> users.id),
  role: enum('owner', 'collaborator', 'viewer'),
  can_chat: boolean,
  invited_by: uuid (FK -> users.id, nullable),
  joined_at: timestamp,
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### agent_session_messages - 会话消息表

```typescript
{
  id: uuid (PK),
  session_id: uuid (FK -> agent_sessions.id),
  seq: integer,                     // 会话内单调递增
  actor_type: enum('user', 'agent', 'system', 'bot'),
  actor_id: string,
  message_type: enum('user_prompt', 'agent_reply', 'system_note', 'tool_summary'),
  content: text,
  metadata: jsonb,
  pinned: boolean,
  pinned_by: uuid (FK -> users.id, nullable),
  pinned_at: timestamp (nullable),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### agent_session_events - 会话事件表

```typescript
{
  id: uuid (PK),
  session_id: uuid (FK -> agent_sessions.id),
  seq: integer,                     // 会话内单调递增
  type: string,                     // 例如 session_created/message_created/worktree_prepared
  payload: jsonb,
  actor_type: enum('user', 'agent', 'system', 'bot'),
  actor_id: string,
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

### Workflow 预设

#### workflow_presets - Workflow 预设表

```typescript
{
  id: uuid (PK),
  repository_id: uuid (FK -> repositories.id),
  name: string,                    // 预设名称
  workflow_path: string,           // workflow 文件路径
  branch: string,                  // 固定分支
  inputs: jsonb,                   // 预设的 input 值
  share_token: string (unique),    // 分享 token（16 位 nanoid）
  created_by: uuid (FK -> users.id),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

### 审批系统

#### approval_requests - 审批请求表

```typescript
{
  id: uuid (PK),
  repository_id: uuid (FK -> repositories.id),
  type: enum('deployment', 'config_change'),
  title: string,
  description: text,
  requester_id: uuid (FK -> users.id),
  status: enum('pending', 'approved', 'rejected', 'cancelled'),
  feishu_instance_code: string (nullable),
  feishu_approval_code: string (nullable),
  approved_by: uuid (FK -> users.id, nullable),
  approved_at: timestamp (nullable),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

### 审计日志

#### audit_logs - 审计日志表

```typescript
{
  id: uuid (PK),
  user_id: uuid (FK -> users.id),
  organization_id: uuid (FK -> organizations.id, nullable),
  action: string,
  resource_type: string,
  resource_id: string,
  details: jsonb,
  ip_address: string,
  user_agent: string,
  created_at: timestamp
}
```

## 索引设计

### 性能优化索引

```sql
-- users 表
CREATE INDEX idx_users_gitea_id ON users(gitea_id);
CREATE INDEX idx_users_feishu_open_id ON users(feishu_open_id);

-- organizations 表
CREATE INDEX idx_organizations_gitea_id ON organizations(gitea_id);
CREATE INDEX idx_organizations_name ON organizations(name);

-- teams 表
CREATE INDEX idx_teams_organization_id ON teams(organization_id);
CREATE INDEX idx_teams_gitea_id ON teams(gitea_id);

-- team_members 表
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);

-- permission_groups 表
CREATE INDEX idx_permission_groups_organization_id ON permission_groups(organization_id);

-- team_permissions 表
CREATE INDEX idx_team_permissions_team_id ON team_permissions(team_id);
CREATE INDEX idx_team_permissions_permission_group_id ON team_permissions(permission_group_id);

-- repositories 表
CREATE INDEX idx_repositories_organization_id ON repositories(organization_id);
CREATE INDEX idx_repositories_gitea_id ON repositories(gitea_id);
CREATE INDEX idx_repositories_full_name ON repositories(full_name);

-- workspaces 表
CREATE INDEX idx_workspaces_repository_id ON workspaces(repository_id);
CREATE INDEX idx_workspaces_creator_id ON workspaces(creator_id);
CREATE INDEX idx_workspaces_name ON workspaces(name);

-- agent_runtimes 表
CREATE UNIQUE INDEX agent_runtimes_repository_unique ON agent_runtimes(repository_id);
CREATE INDEX idx_agent_runtimes_status ON agent_runtimes(status);

-- agent_sessions 表
CREATE INDEX idx_agent_sessions_repository_id ON agent_sessions(repository_id);
CREATE INDEX idx_agent_sessions_runtime_id ON agent_sessions(runtime_id);
CREATE INDEX idx_agent_sessions_creator_id ON agent_sessions(creator_id);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);
CREATE INDEX idx_agent_sessions_visibility ON agent_sessions(visibility);

-- agent_session_worktrees 表
CREATE UNIQUE INDEX agent_session_worktrees_session_unique ON agent_session_worktrees(session_id);
CREATE INDEX idx_agent_session_worktrees_repository_id ON agent_session_worktrees(repository_id);
CREATE INDEX idx_agent_session_worktrees_runtime_id ON agent_session_worktrees(runtime_id);
CREATE INDEX idx_agent_session_worktrees_status ON agent_session_worktrees(status);

-- agent_session_participants 表
CREATE UNIQUE INDEX agent_session_participants_session_user ON agent_session_participants(session_id, user_id);
CREATE INDEX idx_agent_session_participants_session_id ON agent_session_participants(session_id);
CREATE INDEX idx_agent_session_participants_user_id ON agent_session_participants(user_id);

-- agent_session_messages 表
CREATE UNIQUE INDEX agent_session_messages_session_seq ON agent_session_messages(session_id, seq);
CREATE INDEX idx_agent_session_messages_session_id ON agent_session_messages(session_id);
CREATE INDEX idx_agent_session_messages_actor ON agent_session_messages(actor_type, actor_id);

-- agent_session_events 表
CREATE UNIQUE INDEX agent_session_events_session_seq ON agent_session_events(session_id, seq);
CREATE INDEX idx_agent_session_events_session_id ON agent_session_events(session_id);
CREATE INDEX idx_agent_session_events_type ON agent_session_events(type);

-- approval_requests 表
CREATE INDEX idx_approval_requests_repository_id ON approval_requests(repository_id);
CREATE INDEX idx_approval_requests_requester_id ON approval_requests(requester_id);
CREATE INDEX idx_approval_requests_status ON approval_requests(status);

-- audit_logs 表
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);
```

## 表关系图

```text
users
  ├─ team_members (user_id)
  ├─ workspaces (creator_id)
  ├─ agent_sessions (creator_id)
  ├─ agent_session_participants (user_id)
  ├─ agent_session_messages (pinned_by)
  ├─ approval_requests (requester_id, approved_by)
  └─ audit_logs (user_id)

organizations
  ├─ teams (organization_id)
  ├─ permission_groups (organization_id)
  ├─ repositories (organization_id)
  └─ audit_logs (organization_id)

teams
  ├─ team_members (team_id)
  └─ team_permissions (team_id)

permission_groups
  └─ team_permissions (permission_group_id)

repositories
  ├─ workspaces (repository_id)
  ├─ agent_runtimes (repository_id)
  ├─ agent_sessions (repository_id)
  ├─ agent_session_worktrees (repository_id)
  ├─ workflow_presets (repository_id)
  └─ approval_requests (repository_id)

agent_runtimes
  ├─ agent_sessions (runtime_id)
  └─ agent_session_worktrees (runtime_id)

agent_sessions
  ├─ agent_session_worktrees (session_id)
  ├─ agent_session_participants (session_id)
  ├─ agent_session_messages (session_id)
  └─ agent_session_events (session_id)
```

## 数据迁移

### 使用 Drizzle Kit

```bash
# 生成迁移文件
pnpm drizzle-kit generate:pg

# 执行迁移
pnpm drizzle-kit push:pg

# 查看迁移状态
pnpm drizzle-kit up:pg
```

### 迁移文件位置

```
server/db/migrations/
├── 0000_initial.sql
├── 0001_add_settings_column.sql
└── meta/
    └── _journal.json
```

## 数据备份策略

### 自动备份

- **频率**：每日凌晨 2:00
- **保留**：最近 30 天
- **存储**：对象存储（S3/MinIO）

### 备份脚本

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="teax_backup_${DATE}.sql"

pg_dump -h localhost -U teax -d teax > "/backups/${BACKUP_FILE}"
gzip "/backups/${BACKUP_FILE}"

# 上传到对象存储
aws s3 cp "/backups/${BACKUP_FILE}.gz" "s3://teax-backups/${BACKUP_FILE}.gz"

# 清理 30 天前的备份
find /backups -name "*.gz" -mtime +30 -delete
```

## 相关文档

- [架构概览](./overview/index.md) - 系统整体架构
- [权限系统](./permission-system.md) - 权限相关表结构
- [部署配置](./deployment.md) - 数据库部署配置
