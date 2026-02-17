import { addLocaleResources } from "@spaceflow/core";
import zhCN from "./zh-cn/scripts.json";
import en from "./en/scripts.json";

/** scripts 命令 i18n 资源 */
export const scriptsLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

addLocaleResources("scripts", scriptsLocales);
