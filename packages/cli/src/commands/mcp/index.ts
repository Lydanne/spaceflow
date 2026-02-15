import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { McpModule } from "./mcp.module";

export const mcpMetadata: SpaceflowExtensionMetadata = {
  name: "mcp",
  commands: ["mcp"],
  version: "1.0.0",
  description: t("mcp:extensionDescription"),
};

export class McpExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return mcpMetadata;
  }

  getModule(): ExtensionModuleType {
    return McpModule;
  }
}

export * from "./mcp.command";
export * from "./mcp.service";
export * from "./mcp.module";
