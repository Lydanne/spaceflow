import type {
  LogRenderer,
  Spinner,
  ProgressBar,
  ProgressBarOptions,
  TaskItem,
  TaskControl,
} from "../logger.interface";

/** 时间戳格式化 */
const timestamp = (): string => {
  const now = new Date();
  return `${now.toLocaleTimeString()}`;
};

/** plain 模式渲染器：纯文本输出，适合 CI / 管道 */
export class PlainRenderer implements LogRenderer {
  info(prefix: string, message: string): void {
    console.log(`${timestamp()} ${prefix} ${message}`);
  }

  success(prefix: string, message: string): void {
    console.log(`${timestamp()} ${prefix} ✅ ${message}`);
  }

  warn(prefix: string, message: string): void {
    console.warn(`${timestamp()} ${prefix} ⚠️ ${message}`);
  }

  error(prefix: string, message: string): void {
    console.error(`${timestamp()} ${prefix} ❌ ${message}`);
  }

  debug(prefix: string, message: string): void {
    console.log(`${timestamp()} ${prefix} [DEBUG] ${message}`);
  }

  verbose(prefix: string, message: string): void {
    console.log(`${timestamp()} ${prefix} ${message}`);
  }

  createSpinner(prefix: string, message: string): Spinner {
    console.log(`${timestamp()} ${prefix} ⏳ ${message}`);
    return {
      update: (msg: string) => {
        console.log(`${timestamp()} ${prefix} ⏳ ${msg}`);
      },
      succeed: (msg?: string) => {
        console.log(`${timestamp()} ${prefix} ✅ ${msg ?? message}`);
      },
      fail: (msg?: string) => {
        console.error(`${timestamp()} ${prefix} ❌ ${msg ?? message}`);
      },
      stop: () => {},
    };
  }

  createProgressBar(prefix: string, options: ProgressBarOptions): ProgressBar {
    const { total, label = "" } = options;
    const tag = label ? `${label} ` : "";
    console.log(`${timestamp()} ${prefix} ${tag}0/${total}`);
    return {
      update: (current: number, msg?: string) => {
        const pct = Math.round((current / total) * 100);
        const suffix = msg ? ` ${msg}` : "";
        console.log(`${timestamp()} ${prefix} ${tag}${current}/${total} (${pct}%)${suffix}`);
      },
      finish: (msg?: string) => {
        const suffix = msg ? ` ${msg}` : "";
        console.log(`${timestamp()} ${prefix} ✅ ${tag}${total}/${total} (100%)${suffix}`);
      },
    };
  }

  async runTasks<T>(prefix: string, items: TaskItem<T>[]): Promise<T[]> {
    const results: T[] = [];
    for (const item of items) {
      if (item.enabled === false) {
        console.log(`${timestamp()} ${prefix} ⏭️ [跳过] ${item.title}`);
        continue;
      }
      console.log(`${timestamp()} ${prefix} ▶ ${item.title}`);
      let skipped = false;
      let skipReason = "";
      const control: TaskControl = {
        update: (msg: string) => {
          console.log(`${timestamp()} ${prefix}   ${msg}`);
        },
        skip: (reason?: string) => {
          skipped = true;
          skipReason = reason ?? "";
        },
      };
      try {
        const ctx = (results.length > 0 ? results[results.length - 1] : undefined) as T;
        const result = await item.task(ctx, control);
        if (skipped) {
          const suffix = skipReason ? `: ${skipReason}` : "";
          console.log(`${timestamp()} ${prefix} ⏭️ ${item.title}${suffix}`);
        } else {
          console.log(`${timestamp()} ${prefix} ✅ ${item.title}`);
        }
        results.push(result);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`${timestamp()} ${prefix} ❌ ${item.title}: ${errMsg}`);
        throw err;
      }
    }
    return results;
  }

  table(_prefix: string, data: Record<string, unknown>[]): void {
    console.table(data);
  }
}
