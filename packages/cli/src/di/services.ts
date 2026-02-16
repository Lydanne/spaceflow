import {
  OutputService,
  StorageService,
  GitSdkService,
  GitProviderService,
  LlmProxyService,
  loadEnvFiles,
  getEnvFilePaths,
  FileAdapter,
} from "@spaceflow/core";
import { join } from "path";
import type { ServiceContainer } from "./container";
import { UnifiedConfigReader } from "./config";

/**
 * 初始化服务容器
 */
export function initializeContainer(container: ServiceContainer, cwd?: string): void {
  const workDir = cwd || process.cwd();
  // 加载环境变量
  loadEnvFiles(getEnvFilePaths(workDir));
  // 初始化核心服务
  const config = new UnifiedConfigReader(workDir);
  const output = new OutputService();
  const storageDir = join(workDir, ".spaceflow", "cache");
  const storage = new StorageService(new FileAdapter(storageDir));
  container.setCoreServices(config, output, storage);
  // 注册服务工厂
  registerServiceFactories(container);
}

/**
 * 注册所有服务工厂
 */
function registerServiceFactories(container: ServiceContainer): void {
  // Config - 返回已初始化的 config
  container.registerFactory("config", (c) => c.config);
  // GitSdk - 无依赖
  container.registerFactory("gitSdk", () => new GitSdkService());
  // GitProvider - 依赖配置（环境变量已在 UnifiedConfigReader 中合并）
  container.registerFactory("gitProvider", (c) => {
    const config = c.config.get<any>("gitProvider");
    if (!config?.provider) {
      throw new Error("缺少 gitProvider 配置");
    }
    const baseUrl = config.serverUrl || config.baseUrl;
    return new GitProviderService({ ...config, baseUrl });
  });
  // LlmProxy - 依赖配置（环境变量已在 UnifiedConfigReader 中合并）
  container.registerFactory("llmProxy", (c) => {
    const config = c.config.get<any>("llm");
    if (!config || (!config.openai && !config.gemini && !config.claudeCode && !config.openCode)) {
      throw new Error("缺少 llm 配置，请在 spaceflow.json 中配置或设置 OPENAI_API_KEY 环境变量");
    }
    return new LlmProxyService(config);
  });
}
