#!/usr/bin/env node
declare const __CLI_VERSION__: string;

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import { execSync } from "child_process";
import { homedir } from "os";
import {
  SPACEFLOW_DIR,
  RC_FILE_NAME,
  ensureSpaceflowPackageJson,
  ensureDependencies,
  getDependencies,
  loadEnvFiles,
  getEnvFilePaths,
} from "@spaceflow/shared";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

/**
 * Spaceflow CLI — 壳子入口
 *
 * 职责：
 * 1. 确保 .spaceflow/ 目录、package.json、.gitignore 完整
 * 2. 确保依赖已安装（pnpm install）
 * 3. 读取外部扩展列表
 * 4. 生成 .spaceflow/bin/index.js（静态 import 入口文件）
 * 5. spawn 子进程执行 node .spaceflow/bin/index.js
 */

/**
 * 获取有效工作目录
 * 优先使用 SPACEFLOW_CWD 环境变量（MCP 场景由编辑器注入），否则 process.cwd()
 */
function getEffectiveCwd(): string {
  return resolve(process.env.SPACEFLOW_CWD || process.cwd());
}

/**
 * 获取 .spaceflow 目录路径
 * 1. 从 cwd 向上遍历查找 .spaceflowrc，找到则在同级目录下使用 .spaceflow
 * 2. 都没找到则回退到 ~/.spaceflow
 */
function getSpaceflowDir(cwd: string): string {
  let current = resolve(cwd);
  const home = homedir();

  while (true) {
    // 检查当前目录是否有 .spaceflowrc
    if (existsSync(join(current, RC_FILE_NAME))) {
      return join(current, SPACEFLOW_DIR);
    }
    const parent = dirname(current);
    if (parent === current) break; // 文件系统根
    current = parent;
  }

  // 没有找到 .spaceflowrc，回退到全局目录 ~/.spaceflow
  return join(home, SPACEFLOW_DIR);
}

/**
 * 从 spaceflow.json / .spaceflowrc 读取外部扩展包名列表
 */
function readExternalExtensions(cwd: string): string[] {
  const deps = getDependencies(cwd, { local: true });
  return Object.keys(deps);
}

/**
 * 生成 .spaceflow/bin/index.js 内容
 *
 * 使用 dynamic import 加载扩展，确保 i18n 在扩展模块执行前已初始化
 * （扩展在 import 阶段就会调用 t() 获取 description，必须先初始化 i18n）
 */
function generateIndexContent(extensions: string[], version: string): string {
  const dynamicImports = extensions
    .map((name) => `    import('${name}').then(m => m.default || m.extension || m),`)
    .join("\n");

  return `import { exec, initCliI18n } from '@spaceflow/core';

async function bootstrap() {
  // 初始化 i18n，再加载扩展（扩展 import 时会调用 t() 获取翻译）
  initCliI18n();

  const extensions = await Promise.all([
${dynamicImports}
  ]);

  await exec(extensions, { cliVersion: '${version}' });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
`;
}

/**
 * 生成 .spaceflow/bin/index.js 文件
 */
function generateBinFile(spaceflowDir: string, extensions: string[], version: string): string {
  const binDir = join(spaceflowDir, "bin");
  const indexPath = join(binDir, "index.js");

  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  const content = generateIndexContent(extensions, version);

  // 仅在内容变化时写入
  if (existsSync(indexPath)) {
    const existing = readFileSync(indexPath, "utf-8");
    if (existing === content) {
      return indexPath;
    }
  }

  writeFileSync(indexPath, content, "utf-8");
  return indexPath;
}

/**
 * 执行生成的 index.js
 */
function executeIndexFile(indexPath: string, cwd: string): void {
  try {
    execSync(`node "${indexPath}" ${process.argv.slice(2).join(" ")}`, {
      cwd,
      stdio: "inherit",
      env: { ...process.env, SPACEFLOW_CWD: cwd },
    });
  } catch (error: any) {
    // execSync 在子进程非零退出时抛出错误
    // 子进程的 stdout/stderr 已通过 stdio: "inherit" 输出
    process.exit(error.status || 1);
  }
}

/**
 * 检测是否为 MCP 代理模式（纯 mcp，不带 --inspector）
 * 纯 mcp → 启动 meta-tool MCP server（代理模式）
 * mcp --inspector → 走正常命令调用流程
 */
function isMcpCommand(): boolean {
  const args = process.argv.slice(2);
  // SPACEFLOW_MCP_PROXY=1 表示当前是被 meta-tool 代理 spawn 的子进程，走正常命令调用流程
  return args.includes("mcp") && !args.includes("--inspector") && !process.env.SPACEFLOW_MCP_PROXY;
}

/**
 * 创建一个连接到指定项目 mcp server 的 MCP Client
 * spawn cli.js 自身，子进程走完整命令调用流程（初始化 .spaceflow → mcp server）
 * @param cwd 项目根目录
 */
async function connectProjectMcpClient(cwd: string): Promise<Client> {
  const resolvedCwd = resolve(cwd);
  const cliPath = process.argv[1];
  const transport = new StdioClientTransport({
    command: "node",
    args: [cliPath, "mcp"],
    cwd: resolvedCwd,
    env: { ...process.env, SPACEFLOW_CWD: resolvedCwd, SPACEFLOW_MCP_PROXY: "1" },
  });
  const client = new Client({ name: "spaceflow-meta", version: __CLI_VERSION__ });
  await client.connect(transport);
  return client;
}

/**
 * 启动 Meta-tool MCP Server
 * 注册 list_tools 和 call_tool 两个元工具
 * 通过 MCP Client SDK 与子进程 mcp server 通信
 */
async function startMcpMetaServer(): Promise<void> {
  const server = new McpServer({ name: "spaceflow", version: __CLI_VERSION__ });

  // 缓存已连接的项目 MCP Client（按 cwd）
  const clientCache = new Map<string, Client>();

  async function getProjectClient(cwd: string): Promise<Client> {
    const resolvedCwd = resolve(cwd);
    let client = clientCache.get(resolvedCwd);
    if (!client) {
      client = await connectProjectMcpClient(resolvedCwd);
      clientCache.set(resolvedCwd, client);
    }
    return client;
  }

  // Meta-tool 1: list_tools
  server.registerTool(
    "list_tools",
    {
      description: "列出指定项目目录下可用的 Spaceflow MCP 工具列表",
      inputSchema: z.object({
        cwd: z.string().describe("项目根目录的绝对路径"),
      }),
    },
    async ({ cwd }) => {
      try {
        const resolvedCwd = resolve(cwd);
        if (!existsSync(resolvedCwd)) {
          return {
            content: [{ type: "text" as const, text: `Error: 目录不存在: ${resolvedCwd}` }],
            isError: true,
          };
        }
        const client = await getProjectClient(resolvedCwd);
        const { tools } = await client.listTools();
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                tools.map((t) => ({
                  name: t.name,
                  description: t.description,
                  inputSchema: t.inputSchema,
                })),
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // Meta-tool 2: call_tool
  server.registerTool(
    "call_tool",
    {
      description: "调用指定项目目录下的 Spaceflow MCP 工具",
      inputSchema: z.object({
        cwd: z.string().describe("项目根目录的绝对路径"),
        tool_name: z.string().describe("要调用的工具名称"),
        tool_args: z.string().optional().describe("工具参数（JSON 字符串）"),
      }),
    },
    async ({ cwd, tool_name, tool_args }) => {
      try {
        const resolvedCwd = resolve(cwd);
        if (!existsSync(resolvedCwd)) {
          return {
            content: [{ type: "text" as const, text: `Error: 目录不存在: ${resolvedCwd}` }],
            isError: true,
          };
        }
        const client = await getProjectClient(resolvedCwd);
        const args = tool_args ? JSON.parse(tool_args) : {};
        const result = await client.callTool({ name: tool_name, arguments: args });
        // 直接返回底层 mcp server 的结果
        return result as any;
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );

  // 启动 stdio 传输
  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error(`[spaceflow] MCP Meta Server 已启动 (v${__CLI_VERSION__})`);

  // 保持进程运行
  await new Promise<void>((resolve) => {
    process.stdin.on("close", resolve);
    process.on("SIGINT", () => {
      resolve();
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      resolve();
      process.exit(0);
    });
  });
}

// ---- 主流程 ----

// 检测是否为 mcp 命令：直接启动 meta-tool MCP server
if (isMcpCommand()) {
  startMcpMetaServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  // 正常 CLI 流程
  // 0. 解析有效工作目录（优先 SPACEFLOW_CWD 环境变量）
  const effectiveCwd = getEffectiveCwd();

  // 1. 先加载 .env 文件，确保 process.env 在子进程（含 schema 模块求值）前已就绪
  loadEnvFiles(getEnvFilePaths(effectiveCwd));

  // 2. 确保 .spaceflow/ 目录结构完整（目录 + package.json + .gitignore）
  const spaceflowDir = getSpaceflowDir(effectiveCwd);
  ensureSpaceflowPackageJson(spaceflowDir, effectiveCwd);

  // 3. 确保依赖已安装
  // MCP 代理模式下使用 pipe 避免 pnpm install 输出污染 stdout（MCP 协议通道）
  ensureDependencies(spaceflowDir, process.env.SPACEFLOW_MCP_PROXY ? { stdio: "pipe" } : undefined);

  // 4. CLI 版本号（由 rspack DefinePlugin 在构建时注入）
  const cliVersion = __CLI_VERSION__;

  // 5. 读取外部扩展列表
  const extNames = readExternalExtensions(effectiveCwd);

  // 6. 生成 .spaceflow/bin/index.js
  const indexPath = generateBinFile(spaceflowDir, extNames, cliVersion);

  // 7. 执行生成的入口文件
  executeIndexFile(indexPath, effectiveCwd);
}
