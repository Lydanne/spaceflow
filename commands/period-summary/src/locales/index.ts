import { addLocaleResources } from "@spaceflow/core";
import zhCN from "./zh-cn/period-summary.json";
import en from "./en/period-summary.json";

/** period-summary 命令 i18n 资源 */
export const periodSummaryLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

addLocaleResources("period-summary", periodSummaryLocales);
