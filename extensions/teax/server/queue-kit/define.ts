import { registerConsumer, type ConsumerHandler, type TaskQueue, type TaskQueueItem } from "./registry";
import { findOrCreateQueue, enqueue, enqueueAndTrigger, completeItem, failItem, type FindOrCreateQueueOpts, type EnqueueResult } from "./service";

// ─── 模板字符串类型推导 ───────────────────────────────────────
//
// 从 "workflow:{repositoryId}:{workflowPath}" 提取出
// { repositoryId: string; workflowPath: string }

/* eslint-disable @typescript-eslint/no-empty-object-type */
type ExtractParams<T extends string>
  = T extends `${infer _Pre}{${infer Param}}${infer Rest}`
    ? { [K in Param]: string } & ExtractParams<Rest>
    : {};
/* eslint-enable @typescript-eslint/no-empty-object-type */

/** 将交叉类型扁平化为单一对象类型 */
type Simplify<T> = { [K in keyof T]: T[K] };

/** 从 id 模板提取的参数类型 */
export type QueueParams<T extends string> = Simplify<ExtractParams<T>>;

/** 从 id 模板提取占位符名数组的顺序 */
type ParamNames<T extends string>
  = T extends `${infer _Pre}{${infer Param}}${infer Rest}`
    ? [Param, ...ParamNames<Rest>]
    : [];

/** 将字符串元组转为同等长度的 string 参数元组 */
type StringTuple<T extends string[]>
  = T extends [string, ...infer Rest extends string[]]
    ? [string, ...StringTuple<Rest>]
    : [];

// ─── 队列错误 ─────────────────────────────────────────────

/** 队列处理错误，throw 后框架自动调用 failItem */
export class QueueError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QueueError";
  }
}

/** 快捷抛出队列错误 */
export function fail(message: string): never {
  throw new QueueError(message);
}

// ─── Handler Context ───────────────────────────────────────

/** Handler 上下文，包含队列/任务信息和操作方法 */
export interface QueueContext {
  /** 队列信息 */
  queue: TaskQueue;
  /** 任务信息 */
  item: TaskQueueItem;
  /** 标记任务完成 */
  complete: (result?: Record<string, unknown>) => Promise<void>;
  /** 标记任务失败 */
  fail: (message: string) => never;
}

// ─── 定义类型 ─────────────────────────────────────────────

/** 队列默认配置 */
export interface QueueDefaults {
  concurrency?: number;
  autoRun?: boolean;
}

/** 队列定义对象（完整） */
export interface QueueDefinition<TId extends string, TPayload extends object = Record<string, unknown>> {
  /** 队列 key 模板 */
  id: TId;
  /** 队列默认配置 */
  defaults?: QueueDefaults;
  /** 消费者处理函数 */
  handler: (params: QueueParams<TId>, payload: TPayload, ctx: QueueContext) => Promise<void>;
}

export interface QueueInstance<TId extends string, TPayload> {
  /** queue_key 前缀（第一个占位符之前的固定部分） */
  readonly prefix: string;

  /** 注册 consumer 到全局注册表（在 plugin 中调用） */
  register: () => void;

  /** 构建完整 queue_key，参数顺序与 id 模板中占位符出现顺序一致 */
  buildQueueKey: (...args: StringTuple<ParamNames<TId>>) => string;

  /** 从完整 queue_key 解析业务参数 */
  parseQueueKey: (queueKey: string) => QueueParams<TId> | null;

  /** 查找或创建队列 */
  findOrCreate: (
    keyArgs: StringTuple<ParamNames<TId>>,
    opts?: { name?: string; createdBy?: string },
  ) => Promise<TaskQueue>;

  /** 入队 */
  enqueue: (queueId: string, payload: TPayload, createdBy?: string) => Promise<EnqueueResult>;

  /** 入队并自动触发 */
  enqueueAndTrigger: (queueId: string, payload: TPayload, createdBy?: string) => Promise<EnqueueResult & { triggered: boolean }>;
}

// ─── 运行时模板解析 ──────────────────────────────────────────

interface ParsedTemplate {
  /** 第一个占位符之前的固定前缀 */
  prefix: string;
  /** 占位符名称，按出现顺序 */
  paramNames: string[];
  /** 固定分隔符片段（paramNames.length + 1 个元素） */
  segments: string[];
}

function parseTemplate(id: string): ParsedTemplate {
  const paramNames: string[] = [];
  const segments: string[] = [];
  let remaining = id;

  while (remaining.length > 0) {
    const start = remaining.indexOf("{");
    if (start === -1) {
      segments.push(remaining);
      break;
    }
    const end = remaining.indexOf("}", start);
    if (end === -1) {
      segments.push(remaining);
      break;
    }
    segments.push(remaining.slice(0, start));
    paramNames.push(remaining.slice(start + 1, end));
    remaining = remaining.slice(end + 1);
  }

  // 确保 segments 比 paramNames 多一个
  if (segments.length === paramNames.length) {
    segments.push("");
  }

  return {
    prefix: segments[0] ?? "",
    paramNames,
    segments,
  };
}

function buildKeyFromTemplate(tmpl: ParsedTemplate, args: string[]): string {
  let result = tmpl.segments[0] ?? "";
  for (let i = 0; i < tmpl.paramNames.length; i++) {
    result += args[i] + (tmpl.segments[i + 1] ?? "");
  }
  return result;
}

function parseKeyFromTemplate(tmpl: ParsedTemplate, queueKey: string): Record<string, string> | null {
  if (!queueKey.startsWith(tmpl.prefix)) return null;

  let rest = queueKey.slice(tmpl.prefix.length);
  const params: Record<string, string> = {};

  for (let i = 0; i < tmpl.paramNames.length; i++) {
    const nextSeg = tmpl.segments[i + 1] ?? "";

    if (i === tmpl.paramNames.length - 1) {
      // 最后一个占位符：去掉尾部固定后缀
      if (nextSeg && rest.endsWith(nextSeg)) {
        params[tmpl.paramNames[i]!] = rest.slice(0, rest.length - nextSeg.length);
      } else if (!nextSeg) {
        params[tmpl.paramNames[i]!] = rest;
      } else {
        return null;
      }
      rest = "";
    } else {
      // 中间占位符：找下一个分隔符
      if (!nextSeg) return null;
      const idx = rest.indexOf(nextSeg);
      if (idx === -1) return null;
      params[tmpl.paramNames[i]!] = rest.slice(0, idx);
      rest = rest.slice(idx + nextSeg.length);
    }
  }

  return params;
}

// ─── QueueInstanceImpl ──────────────────────────────────────────

class QueueInstanceImpl<TId extends string, TPayload extends object>
implements QueueInstance<TId, TPayload> {
  readonly prefix: string;

  private readonly tmpl: ParsedTemplate;
  private readonly queueDefaults: QueueDefaults | undefined;
  private readonly consumerHandler: ConsumerHandler;

  constructor(
    tmpl: ParsedTemplate,
    defaults: QueueDefaults | undefined,
    handler: (params: QueueParams<TId>, payload: TPayload, ctx: QueueContext) => Promise<void>,
  ) {
    this.tmpl = tmpl;
    this.prefix = tmpl.prefix;
    this.queueDefaults = defaults;

    this.consumerHandler = async (item, queue) => {
      const params = parseKeyFromTemplate(tmpl, queue.queue_key);
      if (!params) {
        await failItem(item.id, `Invalid queue_key: ${queue.queue_key}`);
        return;
      }

      const ctx: QueueContext = {
        queue,
        item,
        async complete(result) {
          await completeItem(item.id, result);
        },
        fail(message) {
          throw new QueueError(message);
        },
      };

      try {
        await handler(params as QueueParams<TId>, item.payload as TPayload, ctx);
      } catch (err) {
        const message = err instanceof Error ? err.message.slice(0, 2048) : "Unknown error";
        await failItem(item.id, message);
      }
    };
  }

  register(): void {
    registerConsumer(this.prefix, this.consumerHandler);
  }

  buildQueueKey(...args: StringTuple<ParamNames<TId>>): string {
    return buildKeyFromTemplate(this.tmpl, args);
  }

  parseQueueKey(queueKey: string): QueueParams<TId> | null {
    return parseKeyFromTemplate(this.tmpl, queueKey) as QueueParams<TId> | null;
  }

  async findOrCreate(
    keyArgs: StringTuple<ParamNames<TId>>,
    opts?: { name?: string; createdBy?: string },
  ): Promise<TaskQueue> {
    const queueKey = buildKeyFromTemplate(this.tmpl, keyArgs);
    const fOpts: FindOrCreateQueueOpts = {
      queueKey,
      name: opts?.name ?? queueKey,
      autoRun: this.queueDefaults?.autoRun ?? true,
      concurrency: this.queueDefaults?.concurrency ?? 1,
      createdBy: opts?.createdBy,
    };
    return findOrCreateQueue(fOpts);
  }

  async enqueue(queueId: string, payload: TPayload, createdBy?: string): Promise<EnqueueResult> {
    return enqueue({ queueId, payload: payload as Record<string, unknown>, createdBy });
  }

  async enqueueAndTrigger(queueId: string, payload: TPayload, createdBy?: string): Promise<EnqueueResult & { triggered: boolean }> {
    return enqueueAndTrigger({ queueId, payload: payload as Record<string, unknown>, createdBy });
  }
}

// ─── defineQueue Builder ─────────────────────────────────────────

/** Builder 中间状态：已设置 defaults */
interface QueueBuilderWithDefaults<TId extends string> {
  handler<TPayload extends object>(
    handler: (params: QueueParams<TId>, payload: TPayload, ctx: QueueContext) => Promise<void>
  ): QueueInstance<TId, TPayload>;
}

/** Builder 中间状态：未设置 defaults */
interface QueueBuilderWithoutDefaults<TId extends string> {
  defaults(defaults: QueueDefaults): QueueBuilderWithDefaults<TId>;
  handler<TPayload extends object>(
    handler: (params: QueueParams<TId>, payload: TPayload, ctx: QueueContext) => Promise<void>
  ): QueueInstance<TId, TPayload>;
}

/** 创建队列 builder */
export function defineQueue<TId extends string>(
  id: TId,
): QueueBuilderWithoutDefaults<TId> {
  const tmpl = parseTemplate(id);
  let defaults: QueueDefaults | undefined;

  const build = <TPayload extends object>(
    handler: (params: QueueParams<TId>, payload: TPayload, ctx: QueueContext) => Promise<void>,
  ): QueueInstance<TId, TPayload> => new QueueInstanceImpl(tmpl, defaults, handler);

  return {
    defaults(d: QueueDefaults): QueueBuilderWithDefaults<TId> {
      defaults = d;
      return { handler: build };
    },
    handler: build,
  };
}
