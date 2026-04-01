import { eq, and, asc, sql } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { findConsumer, type TaskQueue, type TaskQueueItem } from "./registry";

// ─── Types ───────────────────────────────────────────────

export interface FindOrCreateQueueOpts {
  /** 队列唯一标识 */
  queueKey: string;
  /** 显示名称 */
  name: string;
  /** 自动运行（默认 true） */
  autoRun?: boolean;
  /** 并发上限（默认 1） */
  concurrency?: number;
  /** 队列级元数据 */
  metadata?: Record<string, unknown>;
  /** 创建者 */
  createdBy?: string;
}

export interface EnqueueOpts {
  /** 队列 ID */
  queueId: string;
  /** 任务元数据 */
  payload: Record<string, unknown>;
  /** 创建者 */
  createdBy?: string;
}

export interface EnqueueResult {
  itemId: string;
  position: number;
}

// ─── 队列管理 ─────────────────────────────────────────────

/**
 * 查找或创建队列（幂等）
 */
export async function findOrCreateQueue(opts: FindOrCreateQueueOpts): Promise<TaskQueue> {
  const db = useDB();

  // 先查
  const [existing] = await db
    .select()
    .from(schema.taskQueues)
    .where(eq(schema.taskQueues.queue_key, opts.queueKey))
    .limit(1);

  if (existing) return existing;

  // 创建
  const [created] = await db
    .insert(schema.taskQueues)
    .values({
      queue_key: opts.queueKey,
      name: opts.name,
      auto_run: opts.autoRun ?? true,
      concurrency: opts.concurrency ?? 1,
      metadata: opts.metadata ?? {},
      created_by: opts.createdBy,
    })
    .onConflictDoNothing({ target: schema.taskQueues.queue_key })
    .returning();

  // onConflictDoNothing 可能返回空，再查一次
  if (!created) {
    const [found] = await db
      .select()
      .from(schema.taskQueues)
      .where(eq(schema.taskQueues.queue_key, opts.queueKey))
      .limit(1);
    return found!;
  }

  return created;
}

/**
 * 按 key 获取队列
 */
export async function getQueueByKey(queueKey: string): Promise<TaskQueue | null> {
  const db = useDB();
  const [queue] = await db
    .select()
    .from(schema.taskQueues)
    .where(eq(schema.taskQueues.queue_key, queueKey))
    .limit(1);
  return queue ?? null;
}

/**
 * 按 ID 获取队列
 */
export async function getQueueById(queueId: string): Promise<TaskQueue | null> {
  const db = useDB();
  const [queue] = await db
    .select()
    .from(schema.taskQueues)
    .where(eq(schema.taskQueues.id, queueId))
    .limit(1);
  return queue ?? null;
}

/**
 * 更新队列配置
 */
export async function updateQueue(
  queueId: string,
  data: { name?: string; auto_run?: boolean; concurrency?: number; metadata?: Record<string, unknown> },
): Promise<TaskQueue | null> {
  const db = useDB();
  const [updated] = await db
    .update(schema.taskQueues)
    .set({ ...data, updated_at: new Date() })
    .where(eq(schema.taskQueues.id, queueId))
    .returning();
  return updated ?? null;
}

// ─── 任务管理 ─────────────────────────────────────────────

/**
 * 添加任务到队列（FIFO）
 * 事务保护：position 计算 + insert 在同一事务内，防止集群并发下 position 冲突
 */
export async function enqueue(opts: EnqueueOpts): Promise<EnqueueResult> {
  const db = useDB();

  return db.transaction(async (tx) => {
    // 获取当前最大 position
    const [maxPos] = await tx
      .select({ max: sql<number>`coalesce(max(${schema.taskQueueItems.position}), 0)` })
      .from(schema.taskQueueItems)
      .where(
        and(
          eq(schema.taskQueueItems.queue_id, opts.queueId),
          eq(schema.taskQueueItems.status, "waiting"),
        ),
      );

    const nextPosition = (maxPos?.max ?? 0) + 1;

    const [item] = await tx
      .insert(schema.taskQueueItems)
      .values({
        queue_id: opts.queueId,
        position: nextPosition,
        status: "waiting",
        payload: opts.payload,
        created_by: opts.createdBy,
      })
      .returning({ id: schema.taskQueueItems.id, position: schema.taskQueueItems.position });

    if (!item) {
      throw new Error("Failed to insert queue item");
    }

    return { itemId: item.id, position: nextPosition };
  });
}

/**
 * 获取队列任务列表
 */
export async function getQueueItems(
  queueId: string,
  status?: string,
): Promise<TaskQueueItem[]> {
  const db = useDB();
  const conditions = [eq(schema.taskQueueItems.queue_id, queueId)];
  if (status) {
    conditions.push(eq(schema.taskQueueItems.status, status));
  }

  return db
    .select()
    .from(schema.taskQueueItems)
    .where(and(...conditions))
    .orderBy(asc(schema.taskQueueItems.position));
}

/**
 * 获取单个任务项
 */
export async function getQueueItem(itemId: string): Promise<TaskQueueItem | null> {
  const db = useDB();
  const [item] = await db
    .select()
    .from(schema.taskQueueItems)
    .where(eq(schema.taskQueueItems.id, itemId))
    .limit(1);
  return item ?? null;
}

/**
 * 获取队列当前运行中的任务数
 */
export async function getRunningCount(queueId: string): Promise<number> {
  const db = useDB();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.taskQueueItems)
    .where(
      and(
        eq(schema.taskQueueItems.queue_id, queueId),
        eq(schema.taskQueueItems.status, "running"),
      ),
    );
  return Number(row?.count ?? 0);
}

/**
 * 获取队列等待中的任务数
 */
export async function getWaitingCount(queueId: string): Promise<number> {
  const db = useDB();
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.taskQueueItems)
    .where(
      and(
        eq(schema.taskQueueItems.queue_id, queueId),
        eq(schema.taskQueueItems.status, "waiting"),
      ),
    );
  return Number(row?.count ?? 0);
}

// ─── 触发 / 完成 / 失败 / 取消 ──────────────────────────────

/**
 * 触发队列中下一个等待的任务
 * 集群安全：使用事务 + FOR UPDATE SKIP LOCKED，同一任务只会被一个节点获取
 */
export async function triggerNext(queueId: string, opts?: { force?: boolean }): Promise<TaskQueueItem | null> {
  const db = useDB();

  const queue = await getQueueById(queueId);
  if (!queue) return null;

  // 在事务中原子地：检查并发 → 锁定 waiting 项 → 标记 running
  const claimedItem = await db.transaction(async (tx) => {
    if (!opts?.force) {
      // 事务内计数运行中任务，保证一致性
      const [runningRow] = await tx
        .select({ count: sql<number>`count(*)` })
        .from(schema.taskQueueItems)
        .where(
          and(
            eq(schema.taskQueueItems.queue_id, queueId),
            eq(schema.taskQueueItems.status, "running"),
          ),
        );
      const running = Number(runningRow?.count ?? 0);
      if (running >= queue.concurrency) return null;
    }

    // FOR UPDATE SKIP LOCKED: 被其他节点锁定的行会被跳过，避免重复执行
    const rows = await tx.execute(
      sql`SELECT * FROM task_queue_items
          WHERE queue_id = ${queueId} AND status = 'waiting'
          ORDER BY position ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
    );
    const nextItem = rows[0] as TaskQueueItem | undefined;
    if (!nextItem) return null;

    // 在同一事务中标记为 running
    const now = new Date();
    await tx
      .update(schema.taskQueueItems)
      .set({ status: "running", started_at: now })
      .where(eq(schema.taskQueueItems.id, nextItem.id));

    return { ...nextItem, status: "running" as const, started_at: now };
  });

  if (!claimedItem) return null;

  // 事务提交后再异步执行消费者
  const consumer = findConsumer(queue.queue_key);
  if (consumer) {
    consumer(claimedItem, queue).catch(async (err) => {
      console.error(`[queue] Consumer error for item ${claimedItem.id}:`, err);
      await failItem(claimedItem.id, (err as Error).message?.slice(0, 2048) || "Consumer error");
    });
  } else {
    console.warn(`[queue] No consumer registered for queue_key: ${queue.queue_key}`);
  }

  return claimedItem;
}

/**
 * 标记任务完成
 * 集群安全：事务 + FOR UPDATE 确保状态只被转换一次
 * 如果队列 auto_run=true，自动触发下一个
 */
export async function completeItem(
  itemId: string,
  result?: Record<string, unknown>,
): Promise<void> {
  const db = useDB();

  const queueId = await db.transaction(async (tx) => {
    // FOR UPDATE 锁定行，防止并发节点同时完成
    const rows = await tx.execute(
      sql`SELECT * FROM task_queue_items
          WHERE id = ${itemId} AND status = 'running'
          LIMIT 1
          FOR UPDATE`,
    );
    const item = rows[0] as TaskQueueItem | undefined;
    if (!item) return null;

    await tx
      .update(schema.taskQueueItems)
      .set({
        status: "completed",
        result: result ?? null,
        completed_at: new Date(),
      })
      .where(eq(schema.taskQueueItems.id, itemId));

    return item.queue_id;
  });

  if (!queueId) return;
  console.log(`[queue] Item ${itemId} completed`);

  // auto_run: 触发下一个（事务外执行，triggerNext 有自己的事务保护）
  const queue = await getQueueById(queueId);
  if (queue?.auto_run) {
    await triggerNext(queue.id);
  }
}

/**
 * 标记任务失败
 * 集群安全：事务 + FOR UPDATE 确保状态只被转换一次
 * 如果队列 auto_run=true，自动触发下一个（跳过失败项）
 */
export async function failItem(
  itemId: string,
  error: string,
): Promise<void> {
  const db = useDB();

  const queueId = await db.transaction(async (tx) => {
    // FOR UPDATE 锁定行，防止并发节点同时标记失败
    const rows = await tx.execute(
      sql`SELECT * FROM task_queue_items
          WHERE id = ${itemId} AND status = 'running'
          LIMIT 1
          FOR UPDATE`,
    );
    const item = rows[0] as TaskQueueItem | undefined;
    if (!item) return null;

    await tx
      .update(schema.taskQueueItems)
      .set({
        status: "failed",
        error: error.slice(0, 2048),
        completed_at: new Date(),
      })
      .where(eq(schema.taskQueueItems.id, itemId));

    return item.queue_id;
  });

  if (!queueId) return;
  console.log(`[queue] Item ${itemId} failed: ${error}`);

  // auto_run: 触发下一个（事务外执行）
  const queue = await getQueueById(queueId);
  if (queue?.auto_run) {
    await triggerNext(queue.id);
  }
}

/**
 * 取消任务
 * 集群安全：事务 + FOR UPDATE 确保只取消一次
 */
export async function cancelItem(itemId: string): Promise<void> {
  const db = useDB();
  await db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT id FROM task_queue_items
          WHERE id = ${itemId} AND status = 'waiting'
          LIMIT 1
          FOR UPDATE SKIP LOCKED`,
    );
    if (!rows[0]) return;

    await tx
      .update(schema.taskQueueItems)
      .set({ status: "cancelled", completed_at: new Date() })
      .where(eq(schema.taskQueueItems.id, itemId));
  });
}

/**
 * 重置队列：强制完成所有 running items，取消所有 waiting items
 * 用于队列卡住时的手动恢复
 * @returns 被重置的 item 数量
 */
export async function resetQueue(queueId: string): Promise<{ completedCount: number; cancelledCount: number }> {
  const db = useDB();
  const now = new Date();

  // 强制完成所有 running items
  const completed = await db
    .update(schema.taskQueueItems)
    .set({ status: "completed", result: { reset: true }, completed_at: now })
    .where(
      and(
        eq(schema.taskQueueItems.queue_id, queueId),
        eq(schema.taskQueueItems.status, "running"),
      ),
    )
    .returning({ id: schema.taskQueueItems.id });

  // 取消所有 waiting items
  const cancelled = await db
    .update(schema.taskQueueItems)
    .set({ status: "cancelled", completed_at: now })
    .where(
      and(
        eq(schema.taskQueueItems.queue_id, queueId),
        eq(schema.taskQueueItems.status, "waiting"),
      ),
    )
    .returning({ id: schema.taskQueueItems.id });

  console.log(`[queue] Reset queue ${queueId}: completed ${completed.length} running, cancelled ${cancelled.length} waiting`);

  return { completedCount: completed.length, cancelledCount: cancelled.length };
}

// ─── 辅助：入队并自动触发 ─────────────────────────────────

/**
 * 入队 + 如果没有达到并发上限则立即触发
 * 常用于"有空位就直接跑，满了就排队"的场景
 */
export async function enqueueAndTrigger(opts: EnqueueOpts): Promise<EnqueueResult & { triggered: boolean }> {
  const result = await enqueue(opts);

  const queue = await getQueueById(opts.queueId);
  if (!queue) return { ...result, triggered: false };

  const running = await getRunningCount(opts.queueId);
  if (running < queue.concurrency) {
    const triggered = await triggerNext(opts.queueId);
    return { ...result, triggered: !!triggered };
  }

  return { ...result, triggered: false };
}

// ─── 按 payload 查询 / 操作 ──────────────────────────────

export interface ItemStatusResult {
  itemId: string;
  status: "waiting" | "running";
  position: number | null;
}

/**
 * 按 queue_key + payload 字段匹配，查找 waiting/running 的 item
 * @param queueKey  队列唯一标识
 * @param payloadField  payload 中要匹配的 JSON 字段名
 * @param payloadValue  字段值（将转为字符串比较）
 */
export async function getItemByPayload(
  queueKey: string,
  payloadField: string,
  payloadValue: string,
): Promise<ItemStatusResult | null> {
  const db = useDB();
  const rows = await db.execute(
    sql`SELECT tqi.id, tqi.status, tqi.position
        FROM task_queue_items tqi
        JOIN task_queues tq ON tq.id = tqi.queue_id
        WHERE tq.queue_key = ${queueKey}
          AND tqi.payload->>  ${payloadField} = ${payloadValue}
          AND tqi.status IN ('waiting', 'running')
        ORDER BY tqi.created_at DESC
        LIMIT 1`,
  );
  const row = rows[0] as { id: string; status: string; position: number } | undefined;
  if (!row) return null;
  return {
    itemId: row.id,
    status: row.status as "waiting" | "running",
    position: row.status === "waiting" ? row.position : null,
  };
}

/**
 * Complete 指定 queue_key 下 payload 字段匹配的 running item
 * @returns 是否成功 complete 了一个 item
 */
export async function completeRunningByPayload(
  queueKey: string,
  payloadField: string,
  payloadValue: string,
  result?: Record<string, unknown>,
): Promise<boolean> {
  const db = useDB();

  // 找到队列
  const [queue] = await db
    .select({ id: schema.taskQueues.id })
    .from(schema.taskQueues)
    .where(eq(schema.taskQueues.queue_key, queueKey))
    .limit(1);
  if (!queue) return false;

  // 找到 running 的 item
  const rows = await db.execute(
    sql`SELECT id FROM task_queue_items
        WHERE queue_id = ${queue.id}
          AND status = 'running'
          AND payload->>  ${payloadField} = ${payloadValue}
        LIMIT 1`,
  );
  const item = rows[0] as { id: string } | undefined;
  if (!item) return false;

  await completeItem(item.id, result);
  return true;
}
