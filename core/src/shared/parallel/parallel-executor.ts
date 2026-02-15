export interface ParallelTask<T, R> {
  id: string;
  data: T;
  execute: (data: T) => Promise<R>;
}

export interface ParallelResult<R> {
  id: string;
  success: boolean;
  result?: R;
  error?: Error;
}

export interface ParallelExecutorOptions {
  concurrency?: number;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  onProgress?: (completed: number, total: number, taskId: string) => void;
  onTaskStart?: (taskId: string) => void;
  onTaskComplete?: (taskId: string, success: boolean) => void;
  onRetry?: (taskId: string, attempt: number, error: Error) => void;
  stopOnError?: boolean;
}

export class ParallelExecutor {
  private readonly concurrency: number;
  private readonly timeout?: number;
  private readonly retries: number;
  private readonly retryDelay: number;
  private readonly onProgress?: (completed: number, total: number, taskId: string) => void;
  private readonly onTaskStart?: (taskId: string) => void;
  private readonly onTaskComplete?: (taskId: string, success: boolean) => void;
  private readonly onRetry?: (taskId: string, attempt: number, error: Error) => void;
  private readonly stopOnError: boolean;

  constructor(options: ParallelExecutorOptions = {}) {
    this.concurrency = options.concurrency ?? 5;
    this.timeout = options.timeout;
    this.retries = options.retries ?? 0;
    this.retryDelay = options.retryDelay ?? 1000;
    this.onProgress = options.onProgress;
    this.onTaskStart = options.onTaskStart;
    this.onTaskComplete = options.onTaskComplete;
    this.onRetry = options.onRetry;
    this.stopOnError = options.stopOnError ?? false;
  }

  async execute<T, R>(tasks: ParallelTask<T, R>[]): Promise<ParallelResult<R>[]> {
    if (tasks.length === 0) {
      return [];
    }

    const results: ParallelResult<R>[] = [];
    const total = tasks.length;
    let completed = 0;
    let shouldStop = false;

    const executeTask = async (task: ParallelTask<T, R>): Promise<ParallelResult<R>> => {
      if (shouldStop) {
        return { id: task.id, success: false, error: new Error("Execution stopped") };
      }

      this.onTaskStart?.(task.id);

      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= this.retries; attempt++) {
        if (attempt > 0) {
          this.onRetry?.(task.id, attempt, lastError!);
          await this.delay(this.retryDelay);
        }

        try {
          const result = await this.executeWithTimeout(task, task.data);
          completed++;
          this.onProgress?.(completed, total, task.id);
          this.onTaskComplete?.(task.id, true);
          return { id: task.id, success: true, result };
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      completed++;
      this.onProgress?.(completed, total, task.id);
      this.onTaskComplete?.(task.id, false);

      if (this.stopOnError) {
        shouldStop = true;
      }

      return {
        id: task.id,
        success: false,
        error: lastError,
      };
    };

    // 使用滑动窗口并发控制
    const pending: Promise<void>[] = [];
    const taskQueue = [...tasks];

    while (taskQueue.length > 0 || pending.length > 0) {
      // 填充到并发上限
      while (pending.length < this.concurrency && taskQueue.length > 0 && !shouldStop) {
        const task = taskQueue.shift()!;
        const promise = executeTask(task).then((result) => {
          results.push(result);
          // 从 pending 中移除
          const index = pending.indexOf(promise);
          if (index > -1) {
            pending.splice(index, 1);
          }
        });
        pending.push(promise);
      }

      // 等待任意一个完成
      if (pending.length > 0) {
        await Promise.race(pending);
      }
    }

    // 按原始顺序排序结果
    const taskIdOrder = new Map(tasks.map((t, i) => [t.id, i]));
    results.sort((a, b) => (taskIdOrder.get(a.id) ?? 0) - (taskIdOrder.get(b.id) ?? 0));

    return results;
  }

  async map<T, R>(
    items: T[],
    fn: (item: T, index: number) => Promise<R>,
    getId?: (item: T, index: number) => string,
  ): Promise<ParallelResult<R>[]> {
    const tasks: ParallelTask<{ item: T; index: number }, R>[] = items.map((item, index) => ({
      id: getId ? getId(item, index) : String(index),
      data: { item, index },
      execute: async ({ item, index }) => fn(item, index),
    }));

    return this.execute(tasks);
  }

  private async executeWithTimeout<T, R>(task: ParallelTask<T, R>, data: T): Promise<R> {
    if (!this.timeout) {
      return task.execute(data);
    }

    return Promise.race([
      task.execute(data),
      new Promise<R>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Task ${task.id} timed out after ${this.timeout}ms`)),
          this.timeout,
        ),
      ),
    ]);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export function parallel(options?: ParallelExecutorOptions): ParallelExecutor {
  return new ParallelExecutor(options);
}
