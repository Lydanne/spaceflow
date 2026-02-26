import * as i18nextModule from "i18next";
import type { i18n } from "i18next";
import {
  setGlobalT,
  setGlobalAddLocaleResources,
  detectLocale,
  coreZhCN,
  coreEn,
} from "@spaceflow/core";

// 兼容 CJS/ESM 混合环境
const i18next: i18n =
  (i18nextModule as unknown as { default: i18n }).default || (i18nextModule as unknown as i18n);

// ---- CLI 命令翻译 ----
import buildZhCN from "./zh-cn/build.json";
import buildEn from "./en/build.json";
import clearZhCN from "./zh-cn/clear.json";
import clearEn from "./en/clear.json";
import commitZhCN from "./zh-cn/commit.json";
import commitEn from "./en/commit.json";
import createZhCN from "./zh-cn/create.json";
import createEn from "./en/create.json";
import devZhCN from "./zh-cn/dev.json";
import devEn from "./en/dev.json";
import installZhCN from "./zh-cn/install.json";
import installEn from "./en/install.json";
import listZhCN from "./zh-cn/list.json";
import listEn from "./en/list.json";
import mcpZhCN from "./zh-cn/mcp.json";
import mcpEn from "./en/mcp.json";
import runxZhCN from "./zh-cn/runx.json";
import runxEn from "./en/runx.json";
import schemaZhCN from "./zh-cn/schema.json";
import schemaEn from "./en/schema.json";
import setupZhCN from "./zh-cn/setup.json";
import setupEn from "./en/setup.json";
import uninstallZhCN from "./zh-cn/uninstall.json";
import uninstallEn from "./en/uninstall.json";
import updateZhCN from "./zh-cn/update.json";
import updateEn from "./en/update.json";

type LocaleResource = Record<string, Record<string, string>>;

/** 所有内部命令 i18n 资源映射（命名空间 → 语言 → 翻译） */
const allLocales: Record<string, LocaleResource> = {
  build: { "zh-CN": buildZhCN, en: buildEn },
  clear: { "zh-CN": clearZhCN, en: clearEn },
  commit: { "zh-CN": commitZhCN, en: commitEn },
  create: { "zh-CN": createZhCN, en: createEn },
  dev: { "zh-CN": devZhCN, en: devEn },
  install: { "zh-CN": installZhCN, en: installEn },
  list: { "zh-CN": listZhCN, en: listEn },
  mcp: { "zh-CN": mcpZhCN, en: mcpEn },
  runx: { "zh-CN": runxZhCN, en: runxEn },
  schema: { "zh-CN": schemaZhCN, en: schemaEn },
  setup: { "zh-CN": setupZhCN, en: setupEn },
  uninstall: { "zh-CN": uninstallZhCN, en: uninstallEn },
  update: { "zh-CN": updateZhCN, en: updateEn },
};

/** 默认命名空间 */
const DEFAULT_NS = "translation";

/**
 * 初始化 CLI 的 i18n 系统
 * 1. 初始化 i18next（core 基础翻译 + CLI 命令翻译）
 * 2. 通过 setGlobalT 挂载翻译函数到 globalThis
 */
export function initCliI18n(lang?: string): void {
  const lng = lang || detectLocale();

  void i18next.init({
    lng,
    fallbackLng: "zh-CN",
    defaultNS: DEFAULT_NS,
    ns: [DEFAULT_NS, ...Object.keys(allLocales)],
    resources: {
      "zh-CN": { [DEFAULT_NS]: coreZhCN },
      en: { [DEFAULT_NS]: coreEn },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    returnEmptyString: false,
    initImmediate: false,
    showSupportNotice: false,
  });

  // 注册 CLI 命令翻译到各自命名空间
  for (const [ns, resources] of Object.entries(allLocales)) {
    for (const [lngKey, translations] of Object.entries(resources)) {
      i18next.addResourceBundle(lngKey, ns, translations, true, true);
    }
  }

  // 挂载到 globalThis，让 core 和扩展的 t() / addLocaleResources() 调用都能生效
  setGlobalT((key, options) => i18next.t(key, options) as string);
  setGlobalAddLocaleResources(addLocaleResources);
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
  for (const [lng, translations] of Object.entries(resources)) {
    i18next.addResourceBundle(lng, ns, translations, true, true);
  }
  if (!i18next.options.ns) {
    i18next.options.ns = [DEFAULT_NS, ns];
  } else if (Array.isArray(i18next.options.ns) && !i18next.options.ns.includes(ns)) {
    i18next.options.ns.push(ns);
  }
}
