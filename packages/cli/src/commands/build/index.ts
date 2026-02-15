import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { BuildModule } from "./build.module";

export const buildMetadata: SpaceflowExtensionMetadata = {
  name: "build",
  commands: ["build"],
  version: "1.0.0",
  description: t("build:extensionDescription"),
};

export class BuildExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return buildMetadata;
  }

  getModule(): ExtensionModuleType {
    return BuildModule;
  }
}

export * from "./build.module";
export * from "./build.command";
export * from "./build.service";
