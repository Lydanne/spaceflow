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

### Agent 系统

#### agent_sessions - Agent 会话表

```typescript
{
  id: uuid (PK),
  repository_id: uuid (FK -> repositories.id),
  status: enum('running', 'completed', 'stopped', 'failed'),
  prompt: text,
  system_prompt: text,
  model: string,
  provider_id: string,
  steps: integer (default: 0),
  tokens_used: integer (default: 0),
  cost: decimal (default: 0),
  pr_url: string (nullable),
  error_message: text (nullable),
  started_at: timestamp,
  completed_at: timestamp (nullable),
  created_at: timestamp,
  updated_at: timestamp,
  row_creator: string
}
```

#### session_logs - Agent 日志表

```typescript
{
  id: uuid (PK),
  session_id: uuid (FK -> agent_sessions.id),
  type: enum('stdout', 'stderr', 'tool', 'reasoning', 'system'),
  content: text,
  timestamp: timestamp,
  created_at: timestamp
}
```

#### agent_secrets - Agent 密钥表

```typescript
{
  id: uuid (PK),
  repository_id: uuid (FK -> repositories.id),
  provider_id: string,
  encrypted_api_key: string (AES-256-GCM 加密),
  iv: string (初始化向量),
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

-- agent_sessions 表
CREATE INDEX idx_agent_sessions_repository_id ON agent_sessions(repository_id);
CREATE INDEX idx_agent_sessions_status ON agent_sessions(status);

-- session_logs 表
CREATE INDEX idx_session_logs_session_id ON session_logs(session_id);

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
  ├─ agent_sessions (row_creator)
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
  ├─ agent_sessions (repository_id)
  ├─ agent_secrets (repository_id)
  └─ approval_requests (repository_id)

agent_sessions
  └─ session_logs (session_id)
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

- [架构概览](./overview.md) - 系统整体架构
- [权限系统](./permission-system.md) - 权限相关表结构
- [部署配置](./deployment.md) - 数据库部署配置
