import { addLocaleResources } from "@spaceflow/core";
import zhCN from "./zh-cn/publish.json";
import en from "./en/publish.json";

/** publish 命令 i18n 资源 */
export const publishLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

addLocaleResources("publish", publishLocales);
