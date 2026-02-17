import { addLocaleResources } from "@spaceflow/core";
import zhCN from "./zh-cn/shell.json";
import en from "./en/shell.json";

/** shell 命令 i18n 资源 */
export const shellLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

addLocaleResources("shell", shellLocales);
