import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { InstallModule } from "./install.module";

export const installMetadata: SpaceflowExtensionMetadata = {
  name: "install",
  commands: ["install", "i"],
  version: "1.0.0",
  description: t("install:extensionDescription"),
};

export class InstallExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return installMetadata;
  }

  getModule(): ExtensionModuleType {
    return InstallModule;
  }
}

export * from "./install.module";
export { InstallCommand, type InstallCommandOptions } from "./install.command";
export {
  InstallService,
  type InstallOptions,
  type InstallContext,
  type SourceType,
} from "./install.service";
