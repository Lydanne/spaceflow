import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { ClearModule } from "./clear.module";

export const clearMetadata: SpaceflowExtensionMetadata = {
  name: "clear",
  commands: ["clear"],
  version: "1.0.0",
  description: t("clear:extensionDescription"),
};

export class ClearExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return clearMetadata;
  }

  getModule(): ExtensionModuleType {
    return ClearModule;
  }
}

export * from "./clear.command";
export * from "./clear.service";
export * from "./clear.module";
