import { addLocaleResources } from "@spaceflow/core";
import zhCN from "./zh-cn/review-summary.json";
import en from "./en/review-summary.json";

/** review-summary 命令 i18n 资源 */
export const reviewSummaryLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

addLocaleResources("review-summary", reviewSummaryLocales);
