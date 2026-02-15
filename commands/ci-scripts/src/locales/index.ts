import { addLocaleResources } from "@spaceflow/core";
import zhCN from "./zh-cn/ci-scripts.json";
import en from "./en/ci-scripts.json";

/** ci-scripts 命令 i18n 资源 */
export const ciScriptsLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

addLocaleResources("ci-scripts", ciScriptsLocales);
