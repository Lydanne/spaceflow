import "./locales";
import { defineExtension } from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { publishSchema } from "./publish.config";

export const extension = defineExtension({
  name: "publish",
  version: "1.0.0",
  description: t("publish:extensionDescription"),
  configKey: "publish",
  configSchema: () => publishSchema,
  commands: [
    {
      name: "publish",
      description: t("publish:description"),
      options: [
        {
          flags: "-d, --dry-run",
          description: t("common.options.dryRun"),
        },
      ],
      run: async (args, options, ctx) => {
        ctx.output.info("publish 命令暂未实现");
        // TODO: 实现 publish 命令逻辑
      },
    },
  ],
});

export default extension;
