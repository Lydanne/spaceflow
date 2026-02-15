import { addLocaleResources } from "@spaceflow/core";
import zhCN from "./zh-cn/ci-shell.json";
import en from "./en/ci-shell.json";

/** ci-shell 命令 i18n 资源 */
export const ciShellLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

addLocaleResources("ci-shell", ciShellLocales);
