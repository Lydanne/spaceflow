import { defineExtension, type SpaceflowContext } from "@spaceflow/core";
import { spawn } from "child_process";
import { resolve } from "path";

const teaxRoot = resolve(import.meta.dirname, "..");

function runNuxtCommand(command: string, ctx: Pick<SpaceflowContext, "output">): Promise<void> {
  return new Promise((resolve, reject) => {
    ctx.output.info(`Starting nuxt ${command}...`);

    const child = spawn("npx", ["nuxt", command], {
      cwd: teaxRoot,
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`nuxt ${command} exited with code ${code}`));
      }
    });

    child.on("error", (err: Error) => {
      ctx.output.error(`Failed to start nuxt ${command}: ${err.message}`);
      reject(err);
    });
  });
}

export const extension = defineExtension({
  name: "teax",
  version: "0.1.0",
  description: "Spaceflow Web UI 服务",
  commands: [
    {
      name: "teax",
      description: "Teax Web UI 命令",
      subcommands: [
        {
          name: "dev",
          description: "启动 Teax 开发服务器",
          options: [
            {
              flags: "-p, --port <port>",
              description: "指定端口号",
              default: "3000",
            },
          ],
          run: async (
            _args: string[],
            _options: Record<string, unknown>,
            ctx: SpaceflowContext,
          ) => {
            await runNuxtCommand("dev", ctx);
          },
        },
        {
          name: "build",
          description: "构建 Teax 生产版本",
          run: async (
            _args: string[],
            _options: Record<string, unknown>,
            ctx: SpaceflowContext,
          ) => {
            await runNuxtCommand("build", ctx);
          },
        },
        {
          name: "preview",
          description: "预览 Teax 生产构建",
          run: async (
            _args: string[],
            _options: Record<string, unknown>,
            ctx: SpaceflowContext,
          ) => {
            await runNuxtCommand("preview", ctx);
          },
        },
      ],
      run: async (_args: string[], _options: Record<string, unknown>, ctx: SpaceflowContext) => {
        ctx.output.info("Usage: spaceflow teax <dev|build|preview>");
      },
    },
  ],
});

export default extension;
