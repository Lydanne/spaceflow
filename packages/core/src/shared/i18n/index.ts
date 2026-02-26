export {
  t,
  setGlobalT,
  setGlobalAddLocaleResources,
  addLocaleResources,
  resetI18n,
  type TranslateFn,
  type AddLocaleResourcesFn,
} from "./i18n";
export { detectLocale } from "./locale-detect";

// 导出 core 基础翻译资源，供 CLI 注册
export { default as coreZhCN } from "../../locales/zh-cn/translation.json";
export { default as coreEn } from "../../locales/en/translation.json";
