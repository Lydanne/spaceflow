import { Injectable, Scope } from "@nestjs/common";
import { randomUUID } from "crypto";

const OUTPUT_MARKER_START = "::spaceflow-output::";
const OUTPUT_MARKER_END = "::end::";

/**
 * OutputService - 用于标准化命令输出
 *
 * 命令可以通过此服务设置输出值，这些值会在命令执行完成后
 * 以特定格式输出到 stdout，供 CI 流程中的其他步骤使用。
 *
 * 输出格式: ::spaceflow-output::{"key":"value","_cacheId":"uuid"}::end::
 *
 * _cacheId 用于 actions/cache 在不同 job 之间传递数据
 *
 * 使用示例:
 * ```typescript
 * @Injectable()
 * export class MyService {
 *   constructor(protected readonly output: OutputService) {}
 *
 *   async execute() {
 *     // ... 执行逻辑
 *     this.output.set("version", "1.0.0");
 *     this.output.set("tag", "v1.0.0");
 *   }
 * }
 * ```
 */
@Injectable({ scope: Scope.DEFAULT })
export class OutputService {
  protected outputs: Record<string, string> = {};
  protected cacheId: string = randomUUID();

  /**
   * 设置单个输出值
   */
  set(key: string, value: string | number | boolean): void {
    this.outputs[key] = String(value);
  }

  /**
   * 批量设置输出值
   */
  setAll(values: Record<string, string | number | boolean>): void {
    for (const [key, value] of Object.entries(values)) {
      this.set(key, value);
    }
  }

  /**
   * 获取所有输出值
   */
  getAll(): Record<string, string> {
    return { ...this.outputs };
  }

  /**
   * 清空所有输出值
   */
  clear(): void {
    this.outputs = {};
  }

  /**
   * 输出所有值到 stdout（带标记格式）
   * 通常在命令执行完成后调用
   * _cacheId 会被 actions 捕获并用于 actions/cache
   */
  flush(): void {
    if (Object.keys(this.outputs).length === 0) {
      return;
    }

    // 输出到 stdout，包含 cacheId 供 actions/cache 使用
    const outputWithCache = { ...this.outputs, _cacheId: this.cacheId };
    const json = JSON.stringify(outputWithCache);
    console.log(`${OUTPUT_MARKER_START}${json}${OUTPUT_MARKER_END}`);
  }

  /**
   * 检查是否有输出值
   */
  hasOutputs(): boolean {
    return Object.keys(this.outputs).length > 0;
  }

  /**
   * 获取当前 cacheId
   */
  getCacheId(): string {
    return this.cacheId;
  }
}

export { OUTPUT_MARKER_START, OUTPUT_MARKER_END };
