// ---- 基础 i18n 设施（globalThis 桥接） ----
export {
  t,
  setGlobalT,
  setGlobalAddLocaleResources,
  addLocaleResources,
  resetI18n,
  type TranslateFn,
  type AddLocaleResourcesFn,
} from "./i18n";

// ---- 语言检测 ----
export { detectLocale } from "./locale-detect";

// ---- CLI i18n 初始化（i18next） ----
export { initCliI18n, addI18nextResources } from "./init";

// ---- core 基础翻译资源 ----
export { default as coreZhCN } from "../../locales/zh-cn/translation.json";
export { default as coreEn } from "../../locales/en/translation.json";
