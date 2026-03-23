import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";

/**
 * 任务日志记录器
 * 用于记录定时任务的执行状态和结果
 */
export function useTaskLogger(taskName: string) {
  return {
    info: (message: string, data?: Record<string, unknown>) => {
      console.log(`[${taskName}] ${message}`, data ? JSON.stringify(data) : "");
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      console.warn(`[${taskName}] ${message}`, data ? JSON.stringify(data) : "");
    },
    error: (message: string, data?: Record<string, unknown>) => {
      console.error(`[${taskName}] ${message}`, data ? JSON.stringify(data) : "");
    },
  };
}

/**
 * 开始任务执行记录
 * 返回日志 ID，用于后续更新状态
 */
export async function startTaskLog(
  taskName: string,
  payload?: Record<string, unknown>,
): Promise<string> {
  const db = useDB();

  const [log] = await db
    .insert(schema.taskExecutionLogs)
    .values({
      task_name: taskName,
      status: "running",
      started_at: new Date(),
      payload: payload || null,
    })
    .returning({ id: schema.taskExecutionLogs.id });

  return log!.id;
}

/**
 * 完成任务执行记录
 */
export async function completeTaskLog(
  logId: string,
  result: Record<string, unknown>,
): Promise<void> {
  const db = useDB();
  const now = new Date();

  const [log] = await db
    .select({ started_at: schema.taskExecutionLogs.started_at })
    .from(schema.taskExecutionLogs)
    .where(eq(schema.taskExecutionLogs.id, logId));

  const durationMs = log ? now.getTime() - log.started_at.getTime() : null;

  await db
    .update(schema.taskExecutionLogs)
    .set({
      status: "completed",
      finished_at: now,
      duration_ms: durationMs,
      result,
    })
    .where(eq(schema.taskExecutionLogs.id, logId));
}

/**
 * 记录任务执行失败
 */
export async function failTaskLog(
  logId: string,
  error: Error,
): Promise<void> {
  const db = useDB();
  const now = new Date();

  const [log] = await db
    .select({ started_at: schema.taskExecutionLogs.started_at })
    .from(schema.taskExecutionLogs)
    .where(eq(schema.taskExecutionLogs.id, logId));

  const durationMs = log ? now.getTime() - log.started_at.getTime() : null;

  await db
    .update(schema.taskExecutionLogs)
    .set({
      status: "failed",
      finished_at: now,
      duration_ms: durationMs,
      error_message: error.message,
      error_stack: error.stack,
    })
    .where(eq(schema.taskExecutionLogs.id, logId));
}

/**
 * 包装任务执行，自动记录日志
 */
export async function withTaskLogging<T>(
  taskName: string,
  fn: () => Promise<T>,
  payload?: Record<string, unknown>,
): Promise<T> {
  const logId = await startTaskLog(taskName, payload);
  const logger = useTaskLogger(taskName);

  try {
    logger.info("Task started");
    const result = await fn();
    await completeTaskLog(logId, result as Record<string, unknown>);
    logger.info("Task completed", result as Record<string, unknown>);
    return result;
  } catch (error) {
    const err = error as Error;
    await failTaskLog(logId, err);
    logger.error("Task failed", { error: err.message });
    throw error;
  }
}
