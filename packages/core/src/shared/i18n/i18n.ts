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

/** 是否已初始化 */
let initialized = false;

/**
 * 初始化 i18n
 * 当提供 resources 且无后端加载器时，i18next.init() 同步完成
 * @param lang 指定语言，不传则自动检测
 */
export function initI18n(lang?: string): void {
  if (initialized) return;
  const lng = lang || detectLocale();
  // i18next v25+ 移除了 initSync，但提供内联 resources 时 init() 同步完成
  void i18next.init({
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
  initialized = true;
}

/**
 * 重置 i18n 状态（仅用于测试）
 */
export function resetI18n(): void {
  initialized = false;
}

/**
 * 翻译函数
 * 装饰器和运行时均可使用
 * @param key 翻译 key
 * @param options 插值参数
 */
export function t(key: string, options?: TOptions): string {
  if (!initialized) {
    initI18n();
  }
  return i18next.t(key, options) as string;
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
  if (!initialized) {
    initI18n();
  }
  for (const [lng, translations] of Object.entries(resources)) {
    i18next.addResourceBundle(lng, ns, translations, true, true);
  }
  if (!i18next.options.ns) {
    i18next.options.ns = [DEFAULT_NS, ns];
  } else if (Array.isArray(i18next.options.ns) && !i18next.options.ns.includes(ns)) {
    i18next.options.ns.push(ns);
  }
}
