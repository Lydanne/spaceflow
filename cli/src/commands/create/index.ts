import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { CreateModule } from "./create.module";

export const createMetadata: SpaceflowExtensionMetadata = {
  name: "create",
  commands: ["create"],
  version: "1.0.0",
  description: t("create:extensionDescription"),
};

export class CreateExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return createMetadata;
  }

  getModule(): ExtensionModuleType {
    return CreateModule;
  }
}

export * from "./create.module";
export { CreateCommand } from "./create.command";
export { CreateService } from "./create.service";
