import "./locales";
import { defineExtension } from "@spaceflow/core";
import { t } from "@spaceflow/core";

export const extension = defineExtension({
  name: "period-summary",
  version: "1.0.0",
  description: t("period-summary:extensionDescription"),
  configKey: "period-summary",
  commands: [
    {
      name: "period-summary",
      description: t("period-summary:description"),
      options: [
        {
          flags: "-d, --days",
          description: "天数",
        },
      ],
      run: async (args, options, ctx) => {
        ctx.output.info("period-summary 命令暂未实现");
        // TODO: 实现 period-summary 命令逻辑
      },
    },
  ],
});

export default extension;
