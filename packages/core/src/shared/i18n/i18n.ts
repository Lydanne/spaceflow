/** globalThis 上的 key */
const GLOBAL_T_KEY = "__spaceflow_t__";
const GLOBAL_ADD_LOCALE_KEY = "__spaceflow_add_locale__";

/** 翻译函数类型 */
export type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

/** 注册翻译资源函数类型 */
export type AddLocaleResourcesFn = (
  ns: string,
  resources: Record<string, Record<string, unknown>>,
) => void;

/**
 * 设置全局翻译函数
 * 由 CLI 在启动时调用，将 i18next 的 t 函数挂载到 globalThis
 */
export function setGlobalT(fn: TranslateFn): void {
  (globalThis as Record<string, unknown>)[GLOBAL_T_KEY] = fn;
}

/**
 * 设置全局翻译资源注册函数
 * 由 CLI 在启动时调用
 */
export function setGlobalAddLocaleResources(fn: AddLocaleResourcesFn): void {
  (globalThis as Record<string, unknown>)[GLOBAL_ADD_LOCALE_KEY] = fn;
}

/**
 * 获取全局翻译函数
 */
function getGlobalT(): TranslateFn | undefined {
  return (globalThis as Record<string, unknown>)[GLOBAL_T_KEY] as TranslateFn | undefined;
}

/**
 * 简单的模板插值（fallback 用）
 * 支持 {{key}} 格式
 */
function interpolate(template: string, options?: Record<string, unknown>): string {
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => {
    const val = options[k];
    return val !== undefined ? String(val) : `{{${k}}}`;
  });
}

/**
 * 翻译函数
 * 优先使用 CLI 通过 setGlobalT 挂载的翻译函数
 * 未挂载时回退到返回 key（带插值）
 * @param key 翻译 key
 * @param options 插值参数
 */
export function t(key: string, options?: Record<string, unknown>): string {
  const globalT = getGlobalT();
  if (globalT) {
    return globalT(key, options);
  }
  // fallback: 直接返回 key（带插值）
  return interpolate(key, options);
}

/**
 * 为外部 Extension 注册语言资源
 * 委托给 CLI 通过 setGlobalAddLocaleResources 挂载的实际实现
 * @param ns 命名空间（通常为 Extension name）
 * @param resources 语言资源，key 为语言代码，值为翻译对象
 */
export function addLocaleResources(
  ns: string,
  resources: Record<string, Record<string, unknown>>,
): void {
  const fn = (globalThis as Record<string, unknown>)[GLOBAL_ADD_LOCALE_KEY] as
    | AddLocaleResourcesFn
    | undefined;
  if (fn) {
    fn(ns, resources);
  }
}

/**
 * 重置全局翻译函数（仅用于测试）
 */
export function resetI18n(): void {
  (globalThis as Record<string, unknown>)[GLOBAL_T_KEY] = undefined;
  (globalThis as Record<string, unknown>)[GLOBAL_ADD_LOCALE_KEY] = undefined;
}
