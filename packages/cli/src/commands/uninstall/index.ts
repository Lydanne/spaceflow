import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { UninstallModule } from "./uninstall.module";

export const uninstallMetadata: SpaceflowExtensionMetadata = {
  name: "uninstall",
  commands: ["uninstall", "un"],
  version: "1.0.0",
  description: t("uninstall:extensionDescription"),
};

export class UninstallExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return uninstallMetadata;
  }

  getModule(): ExtensionModuleType {
    return UninstallModule;
  }
}

export * from "./uninstall.module";
export * from "./uninstall.command";
export * from "./uninstall.service";
