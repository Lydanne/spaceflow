import { Module } from "@spaceflow/core";
import { McpCommand } from "./mcp.command";
import { McpService } from "./mcp.service";
import { ExtensionLoaderService } from "../../extension-loader";

@Module({
  providers: [ExtensionLoaderService, McpService, McpCommand],
})
export class McpModule {}
