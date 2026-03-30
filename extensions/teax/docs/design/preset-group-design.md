# 预设组功能设计文档

## 1. 概述

### 1.1 背景

当前的工作流预设（`workflow_presets`）是单预设模式：
- 一个预设对应一个固定的工作流配置（分支、参数）
- 多人共享同一个预设，但同一时间只能有一个 CI 在运行
- 适合简单的发布流程

新需求是**抢占预设组**模式：
- 一个预设组包含多个"子预设"（类似多个房间）
- 每个子预设可以被用户"锁定"，锁定后其他用户无法修改配置
- 适合多测试环境、多测试机等需要资源抢占的场景

### 1.2 典型使用场景

1. **多测试机场景**：团队有 3 台测试机，开发者需要抢占一台来部署测试
2. **多环境场景**：dev/staging/preview 等多个环境，不同人负责不同环境
3. **并行测试场景**：同一个 CI 流程需要在多个配置下并行运行

---

## 2. 功能设计

### 2.1 两种预设模式对比

| 特性 | 单预设模式（现有） | 预设组模式（新增） |
|------|-------------------|-------------------|
| 结构 | 1 预设 = 1 配置 | 1 预设组 = N 子预设 |
| 并发 | 同时只能 1 个 CI | 每子预设独立，可并行 N 个 CI |
| 配置 | 固定分支/参数 | 每子预设可独立配置 |
| 占用机制 | 无锁概念 | 用户可锁定子预设 |
| URL | `/workflows/{token}` | `/workflows/{token}` (组) 或 `/workflows/{token}/{index}` (子预设) |

### 2.2 子预设状态机

```
┌─────────┐    用户锁定    ┌─────────┐    触发CI    ┌─────────┐
│  idle   │ ─────────────→ │ locked  │ ───────────→ │ running │
│ (空闲)  │                │ (已锁定) │              │ (运行中) │
└─────────┘                └─────────┘              └─────────┘
     ↑                          │                       │
     │                          │ 手动解锁/超时解锁      │ CI完成
     │                          ↓                       │
     └──────────────────────────────────────────────┘
```

**状态说明**：
- **idle**：子预设空闲，任何人可以锁定
- **locked**：已被用户锁定，锁定者可修改配置和触发 CI，其他人只能触发（使用锁定者的配置）
- **running**：CI 正在运行，任何人都不能触发新的 CI

### 2.3 锁定规则

1. **锁定**：
   - 任何有权限的用户可以锁定空闲子预设
   - 锁定时可设置自动解锁时间（可选，默认使用预设组配置）
   - 锁定后可修改该子预设的分支和参数

2. **解锁**：
   - 锁定者可随时手动解锁
   - 达到自动解锁时间后系统自动解锁
   - 他人可申请解锁，通过审批流程处理

3. **触发 CI**：
   - 锁定者：可修改配置后触发
   - 非锁定者：只能使用当前配置触发，不能修改
   - 任何人：子预设有 CI 运行时都不能触发新的

### 2.4 权限控制

预设组复用现有的场景权限系统（`scene_permissions`）：
- 创建预设组需要仓库写权限
- 访问预设组页面需要通过场景权限验证
- 锁定/触发操作需要通过场景权限验证
- 申请解锁通过现有审批流程处理

---

## 3. 数据库设计

### 3.1 方案：复用 workflow_presets 表

子预设复用现有的 `workflow_presets` 表，通过 `group_id` 字段区分：
- `group_id = NULL` → 单预设（现有模式）
- `group_id != NULL` → 子预设，属于某个预设组

```sql
-- 预设组表（仅存储组的元信息）
CREATE TABLE workflow_preset_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  workflow_path VARCHAR(512) NOT NULL,
  
  -- 默认配置（新子预设继承）
  default_branch VARCHAR(255) NOT NULL,
  default_inputs JSONB DEFAULT '{}',
  
  -- 自动解锁配置
  auto_unlock_minutes INTEGER DEFAULT 60,  -- 默认60分钟自动解锁，NULL表示不自动解锁
  
  -- 分享
  share_token VARCHAR(32) NOT NULL UNIQUE,
  
  -- 权限
  created_by UUID NOT NULL REFERENCES users(id),
  
  -- 基础字段
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 修改 workflow_presets 表，增加子预设相关字段
ALTER TABLE workflow_presets ADD COLUMN
  group_id UUID REFERENCES workflow_preset_groups(id) ON DELETE CASCADE,  -- NULL=单预设, 非NULL=子预设
  preset_index INTEGER,           -- 子预设在组内的序号
  locked_by UUID REFERENCES users(id),  -- 锁定者
  locked_at TIMESTAMPTZ,
  auto_unlock_at TIMESTAMPTZ;

CREATE INDEX idx_presets_group ON workflow_presets(group_id);
CREATE INDEX idx_presets_locked_by ON workflow_presets(locked_by);

-- 子预设历史记录表
CREATE TABLE workflow_preset_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id UUID NOT NULL REFERENCES workflow_presets(id) ON DELETE CASCADE,
  
  -- 操作类型
  action VARCHAR(32) NOT NULL,  -- 'lock', 'unlock', 'trigger', 'config_change', 'unlock_request'
  
  -- 操作者
  actor_id UUID NOT NULL REFERENCES users(id),
  
  -- 操作详情（JSON）
  details JSONB DEFAULT '{}',
  -- lock: { auto_unlock_at }
  -- unlock: { reason: 'manual' | 'timeout' | 'approved' }
  -- trigger: { run_id, branch, inputs }
  -- config_change: { old_branch, new_branch, old_inputs, new_inputs }
  -- unlock_request: { approval_id, status: 'pending' | 'approved' | 'rejected' }
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_preset_history_preset ON workflow_preset_history(preset_id);
CREATE INDEX idx_preset_history_actor ON workflow_preset_history(actor_id);

-- 索引
CREATE INDEX idx_preset_groups_repo ON workflow_preset_groups(repository_id);
CREATE INDEX idx_preset_groups_token ON workflow_preset_groups(share_token);
```

### 3.2 数据关系

```
workflow_preset_groups (1) ----< workflow_presets (N)
                                      |
                                      v
                              workflow_preset_history
```

- 单预设：`workflow_presets.group_id = NULL`
- 子预设：`workflow_presets.group_id = <group_id>`
- 子预设复用现有的 `name`, `workflow_path`, `branch`, `inputs`, `share_token`, `current_run_id` 等字段

---

## 4. API 设计

### 4.1 预设组管理

```
POST   /api/repos/{owner}/{repo}/workflow-preset-groups
       创建预设组

GET    /api/repos/{owner}/{repo}/workflow-preset-groups
       获取仓库下所有预设组

GET    /api/workflow-preset-groups/{token}
       通过 token 获取预设组详情（含所有槽位状态）

PATCH  /api/workflow-preset-groups/{token}
       更新预设组配置

DELETE /api/workflow-preset-groups/{token}
       删除预设组
```

### 4.2 子预设操作

```
POST   /api/workflow-preset-groups/{token}/slots/{index}/lock
       锁定子预设
       Body: { auto_unlock_minutes?: number }

POST   /api/workflow-preset-groups/{token}/slots
       添加子预设
       Body: { name?: string }

DELETE /api/workflow-preset-groups/{token}/slots/{index}
       删除子预设（仅空闲状态可删除）

POST   /api/workflow-preset-groups/{token}/slots/{index}/unlock
       解锁子预设（锁定者）

POST   /api/workflow-preset-groups/{token}/slots/{index}/request-unlock
       申请解锁子预设（非锁定者，触发审批流程）
       Body: { reason?: string }

PATCH  /api/workflow-preset-groups/{token}/slots/{index}/config
       更新子预设配置（仅锁定者）
       Body: { name?: string, branch?: string, inputs?: Record<string, string> }

POST   /api/workflow-preset-groups/{token}/slots/{index}/trigger
       触发 CI
       Body: { branch?: string, inputs?: Record<string, string> }
       注：非锁定者的 branch/inputs 会被忽略

GET    /api/workflow-preset-groups/{token}/slots/{index}/status
       获取子预设运行状态（轮询用）

GET    /api/workflow-preset-groups/{token}/slots/{index}/history
       获取子预设操作历史
```

### 4.3 用户预设组管理

```
GET    /api/user/workflow-preset-groups
       获取用户创建的所有预设组

DELETE /api/user/workflow-preset-groups/{id}
       删除预设组
```

---

## 5. 前端设计

### 5.1 页面结构

```
/workflows/{token}
├── 单预设模式 → 现有 WorkflowRunner 组件
└── 预设组模式 → 新 PresetGroupRunner 组件
    ├── 头部：预设组名称、描述、仓库信息
    ├── 子预设网格：N 个子预设卡片
    └── 底部：创建者信息、分享按钮、添加子预设按钮
```

### 5.2 子预设卡片设计

```
┌─────────────────────────────────────┐
│ 测试机 1                    🟢 空闲 │
├─────────────────────────────────────┤
│                                     │
│  [进入并锁定]                       │
│                                     │
│  分支: main                         │
│  最后触发: -                        │
│                                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 测试机 2                    🔒 已锁定│
├─────────────────────────────────────┤
│  👤 张三                            │
│  锁定于: 10分钟前                   │
│  自动解锁: 50分钟后                 │
│                                     │
│  分支: feature/xxx                  │
│  参数: version=1.2.0                │
│                                     │
│  [触发 CI]  [查看配置]              │
│                                     │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 测试机 3                    🔄 运行中│
├─────────────────────────────────────┤
│  👤 李四 (锁定者)                   │
│  运行 #42 · 进行中                  │
│  开始于: 5分钟前                    │
│                                     │
│  分支: develop                      │
│  参数: env=staging                  │
│                                     │
│  [查看运行详情]                     │
│                                     │
└─────────────────────────────────────┘
```

### 5.3 锁定者视角

当用户是子预设锁定者时，显示额外操作：
- 修改分支/参数
- 触发 CI
- 解锁子预设
- 设置自动解锁时间

### 5.4 非锁定者视角

当子预设被他人锁定时：
- 只能查看当前配置
- 可以触发 CI（使用锁定者的配置）
- 不能修改配置
- 可申请解锁（触发审批流程）

---

## 6. 自动解锁机制

> 详细的定时任务系统设计请参考 [定时任务系统设计文档](./scheduled-tasks-design.md)

### 6.1 实现方案

使用 Nitro Tasks 定时任务框架，任务名称：`presets:unlock-expired`，调度频率：每分钟。

详细实现见 `scheduled-tasks-design.md` 第 5.1 节。

### 6.2 配置

- 预设组级别：`auto_unlock_minutes` 设置默认自动解锁时间
- 子预设级别：锁定时可覆盖默认值
- 设为 `null` 表示不自动解锁

---

## 7. 实现计划

### Phase 1: 基础功能
1. 数据库 schema 和迁移（修改 workflow_presets 表 + 新增预设组表 + 历史记录表）
2. 预设组 CRUD API
3. 子预设锁定/解锁 API
4. 子预设触发 CI API
5. 申请解锁 API（集成审批流程）

### Phase 2: 前端 UI
1. PresetGroupRunner 组件
2. 子预设卡片组件
3. 锁定/解锁/申请解锁交互
4. 配置修改弹窗
5. 添加/删除子预设

### Phase 3: 完善功能
1. 自动解锁定时任务
2. 用户设置页面管理
3. 操作历史记录查看
4. 运行状态轮询

---

## 8. 设计决策（已确认）

1. **子预设数量**：✅ 允许动态增减子预设
2. **子预设命名**：✅ 支持自定义子预设名称
3. **申请解锁**：✅ 他人可申请解锁，通过现有审批流程处理
4. **CI 完成后**：✅ CI 完成后不自动解锁，保持锁定状态
5. **历史记录**：✅ 记录所有操作历史
6. **数据库设计**：✅ 子预设复用 workflow_presets 表
