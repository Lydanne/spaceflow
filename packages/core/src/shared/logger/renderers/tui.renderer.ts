import chalk from "chalk";
import ora from "ora";
import logUpdate from "log-update";
import type {
  LogRenderer,
  Spinner,
  ProgressBar,
  ProgressBarOptions,
  TaskItem,
  TaskControl,
  TaskStatus,
} from "../logger.interface";

/** 进度条默认宽度 */
const DEFAULT_BAR_WIDTH = 30;

/** 任务状态图标 */
const TASK_ICONS: Record<TaskStatus, string> = {
  pending: chalk.gray("○"),
  running: chalk.cyan("◌"),
  success: chalk.green("✔"),
  failed: chalk.red("✖"),
  skipped: chalk.yellow("⊘"),
};

/** 渲染进度条字符串 */
const renderBar = (current: number, total: number, width: number): string => {
  const ratio = Math.min(current / total, 1);
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = chalk.green("█".repeat(filled)) + chalk.gray("░".repeat(empty));
  const pct = Math.round(ratio * 100);
  return `${bar} ${pct}%`;
};

/** TUI 模式渲染器：富交互输出，适合终端 */
export class TuiRenderer implements LogRenderer {
  info(prefix: string, message: string): void {
    console.log(`${chalk.gray(prefix)} ${message}`);
  }

  success(prefix: string, message: string): void {
    console.log(`${chalk.gray(prefix)} ${chalk.green("✔")} ${message}`);
  }

  warn(prefix: string, message: string): void {
    console.warn(`${chalk.gray(prefix)} ${chalk.yellow("⚠")} ${chalk.yellow(message)}`);
  }

  error(prefix: string, message: string): void {
    console.error(`${chalk.gray(prefix)} ${chalk.red("✖")} ${chalk.red(message)}`);
  }

  debug(prefix: string, message: string): void {
    console.log(`${chalk.gray(prefix)} ${chalk.magenta("[DEBUG]")} ${chalk.gray(message)}`);
  }

  verbose(prefix: string, message: string): void {
    console.log(`${chalk.gray(prefix)} ${chalk.gray(message)}`);
  }

  createSpinner(prefix: string, message: string): Spinner {
    const spinner = ora({
      text: `${chalk.gray(prefix)} ${message}`,
      prefixText: "",
    }).start();
    return {
      update: (msg: string) => {
        spinner.text = `${chalk.gray(prefix)} ${msg}`;
      },
      succeed: (msg?: string) => {
        spinner.succeed(`${chalk.gray(prefix)} ${msg ?? message}`);
      },
      fail: (msg?: string) => {
        spinner.fail(`${chalk.gray(prefix)} ${msg ?? message}`);
      },
      stop: () => {
        spinner.stop();
      },
    };
  }

  createProgressBar(prefix: string, options: ProgressBarOptions): ProgressBar {
    const { total, label = "", width = DEFAULT_BAR_WIDTH } = options;
    const tag = label ? `${label} ` : "";
    logUpdate(`${chalk.gray(prefix)} ${tag}${renderBar(0, total, width)} 0/${total}`);
    return {
      update: (current: number, msg?: string) => {
        const suffix = msg ? ` ${chalk.gray(msg)}` : "";
        logUpdate(
          `${chalk.gray(prefix)} ${tag}${renderBar(current, total, width)} ${current}/${total}${suffix}`,
        );
      },
      finish: (msg?: string) => {
        const suffix = msg ? ` ${msg}` : "";
        logUpdate.done();
        console.log(
          `${chalk.gray(prefix)} ${chalk.green("✔")} ${tag}${total}/${total} (100%)${suffix}`,
        );
      },
    };
  }

  async runTasks<T>(prefix: string, items: TaskItem<T>[]): Promise<T[]> {
    const enabledItems = items.filter((item) => item.enabled !== false);
    const statuses: TaskStatus[] = enabledItems.map(() => "pending");
    const messages: string[] = enabledItems.map((item) => item.title);
    const results: T[] = [];
    const renderTaskList = (): string => {
      return enabledItems
        .map((item, i) => {
          const icon = TASK_ICONS[statuses[i]];
          const title = statuses[i] === "running" ? chalk.cyan(item.title) : item.title;
          const suffix = messages[i] !== item.title ? chalk.gray(` ${messages[i]}`) : "";
          return `${chalk.gray(prefix)} ${icon} ${title}${suffix}`;
        })
        .join("\n");
    };
    logUpdate(renderTaskList());
    for (let i = 0; i < enabledItems.length; i++) {
      statuses[i] = "running";
      logUpdate(renderTaskList());
      let skipped = false;
      let skipReason = "";
      const control: TaskControl = {
        update: (msg: string) => {
          messages[i] = msg;
          logUpdate(renderTaskList());
        },
        skip: (reason?: string) => {
          skipped = true;
          skipReason = reason ?? "";
        },
      };
      try {
        const ctx = (results.length > 0 ? results[results.length - 1] : undefined) as T;
        const result = await enabledItems[i].task(ctx, control);
        if (skipped) {
          statuses[i] = "skipped";
          messages[i] = skipReason
            ? `${enabledItems[i].title} (${skipReason})`
            : enabledItems[i].title;
        } else {
          statuses[i] = "success";
          messages[i] = enabledItems[i].title;
        }
        results.push(result);
      } catch (err) {
        statuses[i] = "failed";
        messages[i] = err instanceof Error ? err.message : String(err);
        logUpdate(renderTaskList());
        logUpdate.done();
        throw err;
      }
      logUpdate(renderTaskList());
    }
    logUpdate.done();
    return results;
  }

  table(_prefix: string, data: Record<string, unknown>[]): void {
    console.table(data);
  }
}
