import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { UpdateModule } from "./update.module";

export const updateMetadata: SpaceflowExtensionMetadata = {
  name: "update",
  commands: ["update"],
  version: "1.0.0",
  description: t("update:extensionDescription"),
};

export class UpdateExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return updateMetadata;
  }

  getModule(): ExtensionModuleType {
    return UpdateModule;
  }
}

export * from "./update.module";
export { UpdateCommand, type UpdateCommandOptions } from "./update.command";
export { UpdateService, type UpdateOptions } from "./update.service";
