import { Command, CommandRunner, Option, getPackageManager, t } from "@spaceflow/core";
import { McpService } from "./mcp.service";
import type { VerboseLevel } from "@spaceflow/core";

export interface McpOptions {
  verbose?: VerboseLevel;
  inspector?: boolean;
}

/**
 * MCP 命令
 * 启动 MCP Server，聚合所有已安装 flow 包的 MCP 工具
 *
 * 使用方式: spaceflow mcp
 */
@Command({
  name: "mcp",
  description: t("mcp:description"),
})
export class McpCommand extends CommandRunner {
  constructor(private readonly mcpService: McpService) {
    super();
  }

  async run(_passedParams: string[], options: McpOptions): Promise<void> {
    if (options.inspector) {
      await this.runInspector();
    } else {
      await this.mcpService.startServer(options.verbose);
    }
  }

  private async runInspector(): Promise<void> {
    const { spawn } = await import("child_process");

    console.error(t("mcp:inspectorStarting"));
    console.error(t("mcp:inspectorDebugCmd"));

    const pm = getPackageManager();
    const dlxCmd = pm === "pnpm" ? "pnpm" : "npx";
    const dlxArgs = pm === "pnpm" ? ["dlx"] : ["-y"];
    const inspector = spawn(
      dlxCmd,
      [...dlxArgs, "@modelcontextprotocol/inspector", pm, "space", "mcp"],
      {
        stdio: "inherit",
        shell: true,
        env: { ...process.env, MODELCONTEXT_PROTOCOL_INSPECTOR: "true" },
        cwd: process.cwd(),
      },
    );

    inspector.on("error", (err) => {
      console.error(t("mcp:inspectorFailed", { error: err.message }));
      process.exit(1);
    });

    await new Promise<void>((_resolve) => {
      inspector.on("close", (code) => {
        process.exit(code || 0);
      });
    });
  }

  @Option({
    flags: "-v, --verbose",
    description: t("common.options.verboseDebug"),
  })
  parseVerbose(_val: string, previous: VerboseLevel = 0): VerboseLevel {
    const current = typeof previous === "number" ? previous : previous ? 1 : 0;
    return Math.min(current + 1, 3) as VerboseLevel;
  }

  @Option({
    flags: "-i, --inspector",
    description: t("mcp:options.inspector"),
  })
  parseInspector(): boolean {
    return true;
  }
}
