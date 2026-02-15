import { addLocaleResources } from "@spaceflow/core";
import zhCN from "./zh-cn/review.json";
import en from "./en/review.json";

/** review 命令 i18n 资源 */
export const reviewLocales: Record<string, Record<string, string>> = {
  "zh-CN": zhCN,
  en,
};

addLocaleResources("review", reviewLocales);
