import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { ListModule } from "./list.module";

export const listMetadata: SpaceflowExtensionMetadata = {
  name: "list",
  commands: ["list", "ls"],
  version: "1.0.0",
  description: t("list:extensionDescription"),
};

export class ListExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return listMetadata;
  }

  getModule(): ExtensionModuleType {
    return ListModule;
  }
}

export * from "./list.module";
export * from "./list.command";
export * from "./list.service";
