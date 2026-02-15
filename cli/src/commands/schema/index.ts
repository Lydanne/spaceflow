import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { SchemaModule } from "./schema.module";

export const schemaMetadata: SpaceflowExtensionMetadata = {
  name: "schema",
  commands: ["schema"],
  version: "1.0.0",
  description: t("schema:extensionDescription"),
};

export class SchemaExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return schemaMetadata;
  }

  getModule(): ExtensionModuleType {
    return SchemaModule;
  }
}

export * from "./schema.command";
export * from "./schema.module";
