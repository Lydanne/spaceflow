import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { SetupModule } from "./setup.module";

export const setupMetadata: SpaceflowExtensionMetadata = {
  name: "setup",
  commands: ["setup"],
  version: "1.0.0",
  description: t("setup:extensionDescription"),
};

export class SetupExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return setupMetadata;
  }

  getModule(): ExtensionModuleType {
    return SetupModule;
  }
}

export * from "./setup.command";
export * from "./setup.service";
export * from "./setup.module";
