import "./locales";
import { defineExtension } from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { reviewSchema } from "./review.config";

export const extension = defineExtension({
  name: "review",
  version: "1.0.0",
  description: t("review:extensionDescription"),
  configKey: "review",
  configSchema: reviewSchema,
  commands: [
    {
      name: "review",
      description: t("review:description"),
      options: [
        {
          flags: "-d, --dry-run",
          description: t("common.options.dryRun"),
        },
      ],
      run: async (args, options, ctx) => {
        ctx.output.info("review 命令暂未实现");
        // TODO: 实现 review 命令逻辑
      },
    },
  ],
});

export default extension;
