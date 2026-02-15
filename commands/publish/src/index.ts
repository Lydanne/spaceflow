import "./locales";
import { SpaceflowExtension, SpaceflowExtensionMetadata, t } from "@spaceflow/core";
import { PublishModule } from "./publish.module";
import { publishSchema } from "./publish.config";
/** publish Extension 元数据 */
export const publishMetadata: SpaceflowExtensionMetadata = {
  name: "publish",
  commands: ["publish"],
  configKey: "publish",
  configSchema: () => publishSchema,
  version: "1.0.0",
  description: t("publish:extensionDescription"),
};

export class PublishExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return publishMetadata;
  }

  getModule() {
    return PublishModule;
  }
}

export default PublishExtension;

export * from "./publish.command";
export * from "./publish.service";
export * from "./publish.module";
export * from "./monorepo.service";
