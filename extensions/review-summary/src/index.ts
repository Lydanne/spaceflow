import "./locales";
import { defineExtension } from "@spaceflow/core";
import { t } from "@spaceflow/core";

export const extension = defineExtension({
  name: "review-summary",
  version: "1.0.0",
  description: t("review-summary:extensionDescription"),
  configKey: "review-summary",
  commands: [
    {
      name: "review-summary",
      description: t("review-summary:description"),
      options: [
        {
          flags: "-d, --days",
          description: "天数",
        },
      ],
      run: async (args, options, ctx) => {
        ctx.output.info("review-summary 命令暂未实现");
        // TODO: 实现 review-summary 命令逻辑
      },
    },
  ],
});

export default extension;
