# 定时任务系统设计文档

## 1. 概述

### 1.1 背景

Teax 平台需要多种后台定时任务来维护系统状态和自动化运维：

- **预设组子预设自动解锁**：锁定超时后自动释放
- **CI 状态同步**：定期检查 GitHub Actions 运行状态
- **数据清理**：清理过期的临时数据、日志等
- **统计聚合**：生成每日/每周统计报表
- **健康检查**：监控外部服务（Gitea、飞书）连接状态

### 1.2 技术选型

使用 **Nitro Tasks**（Nuxt 3 内置）作为定时任务框架：

| 方案 | 优点 | 缺点 |
|------|------|------|
| Nitro Tasks | 零依赖、与 Nuxt 深度集成、支持 cron | 实验性功能、无持久化 |
| BullMQ | 成熟稳定、支持重试/死信 | 需要 Redis、额外依赖 |
| node-cron | 简单轻量 | 无任务管理、无持久化 |

**选择 Nitro Tasks 的理由**：
1. 项目已启用 `nitro.experimental.tasks`
2. 当前任务场景简单，不需要复杂的队列功能
3. 与 Nuxt 生态无缝集成
4. 未来可平滑迁移到 BullMQ（如需要）

---

## 2. 架构设计

### 2.1 目录结构

```
server/
├── tasks/                          # 定时任务定义
│   ├── presets/
│   │   └── unlock-expired.ts       # 子预设自动解锁
│   ├── sync/
│   │   └── ci-status.ts            # CI 状态同步
│   ├── cleanup/
│   │   └── temp-data.ts            # 临时数据清理
│   └── health/
│       └── external-services.ts    # 外部服务健康检查
├── utils/
│   └── task-logger.ts              # 任务日志工具
└── db/schema/
    └── task-log.ts                 # 任务执行日志表
```

### 2.2 任务生命周期

```
┌─────────────┐    cron 触发    ┌─────────────┐    执行完成    ┌─────────────┐
│  scheduled  │ ──────────────→ │   running   │ ─────────────→ │  completed  │
│  (已调度)   │                 │  (运行中)   │                │  (已完成)   │
└─────────────┘                 └─────────────┘                └─────────────┘
                                      │
                                      │ 执行失败
                                      ↓
                                ┌─────────────┐
                                │   failed    │
                                │  (已失败)   │
                                └─────────────┘
```

### 2.3 配置方式

在 `nuxt.config.ts` 中统一配置调度计划：

```typescript
export default defineNuxtConfig({
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      // 每分钟检查过期的子预设
      '* * * * *': ['presets:unlock-expired'],
      
      // 每 5 分钟同步 CI 状态
      '*/5 * * * *': ['sync:ci-status'],
      
      // 每天凌晨 3 点清理临时数据
      '0 3 * * *': ['cleanup:temp-data'],
      
      // 每 10 分钟健康检查
      '*/10 * * * *': ['health:external-services'],
    },
  },
});
```

---

## 3. 任务定义规范

### 3.1 基础模板

```typescript
// server/tasks/example/my-task.ts
export default defineTask({
  meta: {
    name: 'example:my-task',
    description: '任务描述',
  },
  async run({ payload }) {
    const startTime = Date.now();
    const logger = useTaskLogger('example:my-task');
    
    try {
      logger.info('Task started');
      
      // 任务逻辑
      const result = await doSomething();
      
      const duration = Date.now() - startTime;
      logger.info(`Task completed in ${duration}ms`, { result });
      
      return { result: 'success', duration, ...result };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Task failed', { error, duration });
      
      // 记录失败日志到数据库
      await logTaskFailure('example:my-task', error, duration);
      
      throw error;
    }
  },
});
```

### 3.2 命名规范

任务名称格式：`{category}:{action}`

| 分类 | 前缀 | 示例 |
|------|------|------|
| 预设相关 | `presets:` | `presets:unlock-expired` |
| 数据同步 | `sync:` | `sync:ci-status` |
| 数据清理 | `cleanup:` | `cleanup:temp-data` |
| 健康检查 | `health:` | `health:external-services` |
| 统计报表 | `stats:` | `stats:daily-summary` |

### 3.3 错误处理

1. **重试策略**：Nitro Tasks 不内置重试，需在任务内部实现
2. **告警通知**：关键任务失败时发送飞书通知
3. **日志记录**：所有任务执行记录写入数据库

```typescript
// 带重试的任务执行
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (i < maxRetries - 1) {
        await new Promise(r => setTimeout(r, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}
```

---

## 4. 数据库设计

### 4.1 任务执行日志表

```sql
CREATE TABLE task_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- 任务信息
  task_name VARCHAR(128) NOT NULL,      -- 'presets:unlock-expired'
  
  -- 执行状态
  status VARCHAR(32) NOT NULL,          -- 'running', 'completed', 'failed'
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- 执行结果
  result JSONB,                         -- 成功时的返回值
  error_message TEXT,                   -- 失败时的错误信息
  error_stack TEXT,                     -- 失败时的堆栈
  
  -- 元数据
  payload JSONB,                        -- 任务输入参数
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_task_logs_name ON task_execution_logs(task_name);
CREATE INDEX idx_task_logs_status ON task_execution_logs(status);
CREATE INDEX idx_task_logs_started ON task_execution_logs(started_at);

-- 自动清理 30 天前的日志
-- 通过 cleanup:task-logs 任务实现
```

### 4.2 Drizzle Schema

```typescript
// server/db/schema/task-log.ts
import { pgTable, uuid, varchar, timestamp, integer, text, jsonb } from 'drizzle-orm/pg-core';

export const taskExecutionLogs = pgTable('task_execution_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  taskName: varchar('task_name', { length: 128 }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
  
  result: jsonb('result'),
  errorMessage: text('error_message'),
  errorStack: text('error_stack'),
  
  payload: jsonb('payload'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
```

---

## 5. 具体任务设计

### 5.1 子预设自动解锁

**任务名称**：`presets:unlock-expired`  
**调度频率**：每分钟  
**功能**：检查并解锁超过 `auto_unlock_at` 时间的子预设

```typescript
// server/tasks/presets/unlock-expired.ts
export default defineTask({
  meta: {
    name: 'presets:unlock-expired',
    description: '自动解锁过期的子预设',
  },
  async run() {
    const db = useDB();
    const now = new Date();
    
    // 查找过期的子预设
    const expired = await db
      .select({ id: schema.workflowPresets.id, name: schema.workflowPresets.name })
      .from(schema.workflowPresets)
      .where(
        and(
          isNotNull(schema.workflowPresets.groupId),
          isNotNull(schema.workflowPresets.autoUnlockAt),
          lte(schema.workflowPresets.autoUnlockAt, now),
        ),
      );
    
    if (expired.length === 0) {
      return { result: 'success', unlockedCount: 0 };
    }
    
    // 批量解锁并记录历史
    for (const preset of expired) {
      await db.transaction(async (tx) => {
        await tx
          .update(schema.workflowPresets)
          .set({
            lockedBy: null,
            lockedAt: null,
            autoUnlockAt: null,
          })
          .where(eq(schema.workflowPresets.id, preset.id));
        
        await tx.insert(schema.workflowPresetHistory).values({
          presetId: preset.id,
          action: 'unlock',
          actorId: SYSTEM_USER_ID,
          details: { reason: 'timeout' },
        });
      });
    }
    
    return { result: 'success', unlockedCount: expired.length };
  },
});
```

### 5.2 CI 状态同步

**任务名称**：`sync:ci-status`  
**调度频率**：每 5 分钟  
**功能**：同步正在运行的 CI 任务状态

```typescript
// server/tasks/sync/ci-status.ts
export default defineTask({
  meta: {
    name: 'sync:ci-status',
    description: '同步 CI 运行状态',
  },
  async run() {
    const db = useDB();
    
    // 查找有 current_run_id 的预设
    const runningPresets = await db
      .select({
        id: schema.workflowPresets.id,
        repositoryId: schema.workflowPresets.repositoryId,
        currentRunId: schema.workflowPresets.currentRunId,
      })
      .from(schema.workflowPresets)
      .where(isNotNull(schema.workflowPresets.currentRunId));
    
    let syncedCount = 0;
    let completedCount = 0;
    
    for (const preset of runningPresets) {
      try {
        // 获取仓库信息
        const repo = await db.query.repositories.findFirst({
          where: eq(schema.repositories.id, preset.repositoryId),
        });
        
        if (!repo) continue;
        
        // 调用 GitHub API 检查运行状态
        const runStatus = await getWorkflowRunStatus(
          repo.owner,
          repo.name,
          preset.currentRunId,
        );
        
        // 如果已完成，清除 current_run_id
        if (runStatus.status === 'completed') {
          await db
            .update(schema.workflowPresets)
            .set({ currentRunId: null })
            .where(eq(schema.workflowPresets.id, preset.id));
          completedCount++;
        }
        
        syncedCount++;
      } catch (error) {
        console.error(`Failed to sync CI status for preset ${preset.id}:`, error);
      }
    }
    
    return { result: 'success', syncedCount, completedCount };
  },
});
```

### 5.3 临时数据清理

**任务名称**：`cleanup:temp-data`  
**调度频率**：每天凌晨 3 点  
**功能**：清理过期的临时数据

```typescript
// server/tasks/cleanup/temp-data.ts
export default defineTask({
  meta: {
    name: 'cleanup:temp-data',
    description: '清理过期的临时数据',
  },
  async run() {
    const db = useDB();
    const results: Record<string, number> = {};
    
    // 1. 清理 30 天前的任务执行日志
    const taskLogsDeleted = await db
      .delete(schema.taskExecutionLogs)
      .where(
        lt(
          schema.taskExecutionLogs.createdAt,
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        ),
      )
      .returning({ id: schema.taskExecutionLogs.id });
    results.taskLogs = taskLogsDeleted.length;
    
    // 2. 清理 90 天前的预设操作历史
    const historyDeleted = await db
      .delete(schema.workflowPresetHistory)
      .where(
        lt(
          schema.workflowPresetHistory.createdAt,
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        ),
      )
      .returning({ id: schema.workflowPresetHistory.id });
    results.presetHistory = historyDeleted.length;
    
    // 3. 清理 180 天前的审计日志
    const auditLogsDeleted = await db
      .delete(schema.auditLogs)
      .where(
        lt(
          schema.auditLogs.createdAt,
          new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        ),
      )
      .returning({ id: schema.auditLogs.id });
    results.auditLogs = auditLogsDeleted.length;
    
    return { result: 'success', deleted: results };
  },
});
```

### 5.4 外部服务健康检查

**任务名称**：`health:external-services`  
**调度频率**：每 10 分钟  
**功能**：检查 Gitea、飞书等外部服务连接状态

```typescript
// server/tasks/health/external-services.ts
export default defineTask({
  meta: {
    name: 'health:external-services',
    description: '检查外部服务健康状态',
  },
  async run() {
    const config = useRuntimeConfig();
    const results: Record<string, { healthy: boolean; latency?: number; error?: string }> = {};
    
    // 1. 检查 Gitea
    try {
      const start = Date.now();
      const response = await fetch(`${config.giteaUrl}/api/v1/version`, {
        headers: { Authorization: `token ${config.giteaServiceToken}` },
        signal: AbortSignal.timeout(5000),
      });
      results.gitea = {
        healthy: response.ok,
        latency: Date.now() - start,
      };
    } catch (error) {
      results.gitea = { healthy: false, error: String(error) };
    }
    
    // 2. 检查 Redis
    try {
      const start = Date.now();
      const redis = useRedis();
      await redis.ping();
      results.redis = {
        healthy: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      results.redis = { healthy: false, error: String(error) };
    }
    
    // 3. 检查数据库
    try {
      const start = Date.now();
      const db = useDB();
      await db.execute(sql`SELECT 1`);
      results.database = {
        healthy: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      results.database = { healthy: false, error: String(error) };
    }
    
    // 如果有服务不健康，发送告警
    const unhealthy = Object.entries(results).filter(([, v]) => !v.healthy);
    if (unhealthy.length > 0) {
      await sendHealthAlert(unhealthy);
    }
    
    return { result: 'success', services: results };
  },
});
```

---

## 6. 监控与告警

### 6.1 任务监控指标

| 指标 | 说明 | 告警阈值 |
|------|------|----------|
| 执行时长 | 任务执行耗时 | > 60s 告警 |
| 失败率 | 最近 1 小时失败次数 / 总次数 | > 10% 告警 |
| 连续失败 | 连续失败次数 | > 3 次告警 |
| 积压数量 | 待执行任务数 | > 100 告警 |

### 6.2 告警通知

```typescript
// server/utils/task-alert.ts
export async function sendTaskAlert(
  taskName: string,
  error: Error,
  context: Record<string, unknown>,
) {
  const { sendFeishuMessage } = await import('~~/server/services/feishu.service');
  
  await sendFeishuMessage({
    chatId: process.env.ALERT_CHAT_ID,
    msgType: 'interactive',
    content: {
      header: {
        title: { content: `⚠️ 定时任务失败: ${taskName}`, tag: 'plain_text' },
        template: 'red',
      },
      elements: [
        {
          tag: 'div',
          text: { content: `**错误信息**: ${error.message}`, tag: 'lark_md' },
        },
        {
          tag: 'div',
          text: { content: `**上下文**: ${JSON.stringify(context)}`, tag: 'lark_md' },
        },
      ],
    },
  });
}
```

---

## 7. 开发与调试

### 7.1 手动触发任务

```bash
# 通过 CLI 触发
npx nitro task run presets:unlock-expired

# 通过 API 触发（仅开发环境）
curl -X POST http://localhost:3000/api/_tasks/presets:unlock-expired
```

### 7.2 本地开发

开发环境下可以禁用定时调度，改为手动触发：

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    scheduledTasks: process.env.NODE_ENV === 'production' 
      ? { /* 生产环境调度配置 */ }
      : {}, // 开发环境不自动调度
  },
});
```

### 7.3 任务日志查看

```typescript
// server/api/admin/tasks/logs.get.ts
export default defineEventHandler(async (event) => {
  await requireAdmin(event);
  
  const query = getQuery(event);
  const taskName = query.taskName as string | undefined;
  const status = query.status as string | undefined;
  const limit = Number(query.limit) || 50;
  
  const db = useDB();
  
  let conditions = [];
  if (taskName) conditions.push(eq(schema.taskExecutionLogs.taskName, taskName));
  if (status) conditions.push(eq(schema.taskExecutionLogs.status, status));
  
  const logs = await db
    .select()
    .from(schema.taskExecutionLogs)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(schema.taskExecutionLogs.startedAt))
    .limit(limit);
  
  return logs;
});
```

---

## 8. 部署注意事项

### 8.1 单实例执行

Nitro Tasks 在多实例部署时会在每个实例上执行。如需单实例执行，需要：

1. **使用分布式锁**：通过 Redis 实现任务锁
2. **指定主节点**：通过环境变量指定哪个实例执行定时任务

```typescript
// server/utils/task-lock.ts
export async function withTaskLock<T>(
  taskName: string,
  fn: () => Promise<T>,
  ttlSeconds: number = 60,
): Promise<T | null> {
  const redis = useRedis();
  const lockKey = `task:lock:${taskName}`;
  
  // 尝试获取锁
  const acquired = await redis.set(lockKey, '1', 'EX', ttlSeconds, 'NX');
  if (!acquired) {
    console.log(`[${taskName}] Lock not acquired, skipping`);
    return null;
  }
  
  try {
    return await fn();
  } finally {
    await redis.del(lockKey);
  }
}
```

### 8.2 生产环境配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      '* * * * *': ['presets:unlock-expired'],
      '*/5 * * * *': ['sync:ci-status'],
      '0 3 * * *': ['cleanup:temp-data'],
      '*/10 * * * *': ['health:external-services'],
    },
  },
});
```

---

## 9. 任务清单

| 任务名称 | 调度频率 | 优先级 | 状态 |
|----------|----------|--------|------|
| `presets:unlock-expired` | 每分钟 | 高 | 待实现 |
| `sync:ci-status` | 每 5 分钟 | 高 | 待实现 |
| `cleanup:temp-data` | 每天 3:00 | 中 | 待实现 |
| `health:external-services` | 每 10 分钟 | 中 | 待实现 |
| `stats:daily-summary` | 每天 0:00 | 低 | 待规划 |

---

## 10. 实现计划

### Phase 1: 基础设施
1. 创建 `task_execution_logs` 表和 schema
2. 实现 `useTaskLogger` 工具函数
3. 实现 `withTaskLock` 分布式锁
4. 配置 `nuxt.config.ts` 调度计划

### Phase 2: 核心任务
1. 实现 `presets:unlock-expired` 任务
2. 实现 `sync:ci-status` 任务
3. 实现 `cleanup:temp-data` 任务

### Phase 3: 监控告警
1. 实现 `health:external-services` 任务
2. 实现任务失败告警通知
3. 添加管理后台任务日志查看页面
