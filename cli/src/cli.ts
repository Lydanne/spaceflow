import { initI18n } from "@spaceflow/core";

// 必须在所有命令模块 import 之前初始化 i18n，装饰器在 import 时执行
initI18n();

// 注册所有内部命令的 i18n 资源（side-effect），必须在 internal-extensions 之前
import "./locales";

import { CommandFactory } from "nest-commander";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { OutputService, loadSpaceflowConfig } from "@spaceflow/core";
import type { ExtensionModuleType } from "@spaceflow/core";
import { ExtensionLoaderService } from "./extension-loader";
import { CliModule } from "./cli.module";
import { parseRunxArgs } from "./commands/runx/runx.utils";
import { internalExtensions } from "./internal-extensions";

/**
 * 预处理 runx/x 命令的参数
 * 将 source 后的所有参数转换为 -- 分隔格式，避免被 commander 解析
 */
function preprocessRunxArgs(): void {
  const argv = process.argv;
  // 检查是否已经有 -- 分隔符
  if (argv.includes("--")) return;
  const { cmdIndex, sourceIndex } = parseRunxArgs(argv);
  if (cmdIndex === -1 || sourceIndex === -1) return;
  // 如果 source 后还有参数，插入 -- 分隔符
  if (sourceIndex + 1 < argv.length) {
    process.argv = [...argv.slice(0, sourceIndex + 1), "--", ...argv.slice(sourceIndex + 1)];
  }
}

async function bootstrap() {
  // 预处理 runx/x 命令参数
  preprocessRunxArgs();

  await ConfigModule.envVariablesLoaded;

  // 1. 加载 spaceflow.json 配置（运行时配置）
  loadSpaceflowConfig();

  // 2. 注册内部 Extension
  const extensionLoader = new ExtensionLoaderService();
  const internalLoaded = extensionLoader.registerInternalExtensions(internalExtensions);

  // 3. 从 .spaceflow/package.json 发现并加载外部 Extension
  const externalLoaded = await extensionLoader.discoverAndLoad();

  // 合并所有 Extension 模块
  const extensionModules: ExtensionModuleType[] = [...internalLoaded, ...externalLoaded].map(
    (e) => e.module,
  );

  // 4. 动态创建 CLI Module
  @Module({
    imports: [CliModule, ...extensionModules],
  })
  class DynamicCliModule {}

  // 4. 创建并运行 CLI
  const app = await CommandFactory.createWithoutRunning(DynamicCliModule);
  const output = app.get(OutputService);

  await CommandFactory.runApplication(app);

  // Flush outputs after command execution
  output.flush();
}

bootstrap()
  .then(() => {
    // console.log("Bootstrap completed");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
