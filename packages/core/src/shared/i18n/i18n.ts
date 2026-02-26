import * as i18nextModule from "i18next";
import type { TOptions, i18n } from "i18next";

// 兼容 CJS/ESM 混合环境
const i18next: i18n =
  (i18nextModule as unknown as { default: i18n }).default || (i18nextModule as unknown as i18n);
import { detectLocale } from "./locale-detect";
import zhCN from "../../locales/zh-cn/translation.json";
import en from "../../locales/en/translation.json";

/** 默认命名空间 */
const DEFAULT_NS = "translation";

/** globalThis 上的 key，确保多份 core 实例共享同一个 i18n 状态 */
const GLOBAL_I18N_KEY = "__spaceflow_i18n__";

interface GlobalI18nState {
  instance: i18n;
  initialized: boolean;
}

/**
 * 获取全局 i18n 状态（单例）
 * 无论有几份 @spaceflow/core 实例，都共享同一个 i18next 实例
 */
function getGlobalState(): GlobalI18nState {
  const g = globalThis as Record<string, unknown>;
  if (!g[GLOBAL_I18N_KEY]) {
    g[GLOBAL_I18N_KEY] = {
      instance: i18next,
      initialized: false,
    } satisfies GlobalI18nState;
  }
  return g[GLOBAL_I18N_KEY] as GlobalI18nState;
}

/**
 * 初始化 i18n
 * 当提供 resources 且无后端加载器时，i18next.init() 同步完成
 * @param lang 指定语言，不传则自动检测
 */
export function initI18n(lang?: string): void {
  const state = getGlobalState();
  if (state.initialized) return;
  const lng = lang || detectLocale();
  // i18next v25+ 移除了 initSync，但提供内联 resources 时 init() 同步完成
  void state.instance.init({
    lng,
    fallbackLng: "zh-CN",
    defaultNS: DEFAULT_NS,
    ns: [DEFAULT_NS],
    resources: {
      "zh-CN": { [DEFAULT_NS]: zhCN },
      en: { [DEFAULT_NS]: en },
    },
    interpolation: {
      escapeValue: false,
    },
    returnNull: false,
    returnEmptyString: false,
    // 确保 init 同步完成（默认 initImmediate: true 会将加载推到 setTimeout）
    initImmediate: false,
    // i18next v25.8+ 会在 init 时输出 locize.com 推广日志
    showSupportNotice: false,
  });
  state.initialized = true;
}

/**
 * 重置 i18n 状态（仅用于测试）
 */
export function resetI18n(): void {
  const state = getGlobalState();
  state.initialized = false;
}

/**
 * 翻译函数
 * 通过 globalThis 共享 i18next 实例，确保多份 core 实例下翻译一致
 * @param key 翻译 key
 * @param options 插值参数
 */
export function t(key: string, options?: TOptions): string {
  const state = getGlobalState();
  if (!state.initialized) {
    initI18n();
  }
  return state.instance.t(key, options) as string;
}

/**
 * 为外部 Extension 注册语言资源
 * @param ns 命名空间（通常为 Extension name）
 * @param resources 语言资源，key 为语言代码，值为翻译对象
 */
export function addLocaleResources(
  ns: string,
  resources: Record<string, Record<string, unknown>>,
): void {
  const state = getGlobalState();
  if (!state.initialized) {
    initI18n();
  }
  for (const [lng, translations] of Object.entries(resources)) {
    state.instance.addResourceBundle(lng, ns, translations, true, true);
  }
  if (!state.instance.options.ns) {
    state.instance.options.ns = [DEFAULT_NS, ns];
  } else if (Array.isArray(state.instance.options.ns) && !state.instance.options.ns.includes(ns)) {
    state.instance.options.ns.push(ns);
  }
}
