import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { DevModule } from "./dev.module";

export const devMetadata: SpaceflowExtensionMetadata = {
  name: "dev",
  commands: ["dev"],
  version: "1.0.0",
  description: t("dev:extensionDescription"),
};

export class DevExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return devMetadata;
  }

  getModule(): ExtensionModuleType {
    return DevModule;
  }
}

export * from "./dev.module";
export * from "./dev.command";
