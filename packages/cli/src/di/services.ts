import {
  ConfigReader,
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

/**
 * 从环境变量解析 Git Token
 */
function resolveGitToken(provider: string): string {
  if (process.env.GIT_PROVIDER_TOKEN) {
    return process.env.GIT_PROVIDER_TOKEN;
  }
  switch (provider) {
    case "github":
      return process.env.GITHUB_TOKEN || "";
    case "gitlab":
      return process.env.GITLAB_TOKEN || process.env.CI_JOB_TOKEN || "";
    case "gitea":
      return process.env.GITEA_TOKEN || process.env.GITHUB_TOKEN || "";
    default:
      return "";
  }
}

/**
 * 初始化服务容器
 */
export function initializeContainer(container: ServiceContainer, cwd?: string): void {
  const workDir = cwd || process.cwd();
  // 加载环境变量
  loadEnvFiles(getEnvFilePaths(workDir));
  // 初始化核心服务
  const config = new ConfigReader(workDir);
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
  // GitProvider - 依赖配置
  container.registerFactory("gitProvider", (c) => {
    const config = c.config.get<any>("gitProvider");
    if (!config?.provider) {
      throw new Error("缺少 gitProvider 配置");
    }
    const token = config.token || resolveGitToken(config.provider);
    const baseUrl = config.serverUrl || config.baseUrl;
    return new GitProviderService({ ...config, baseUrl, token });
  });
  // LlmProxy - 依赖配置
  container.registerFactory("llmProxy", (c) => {
    const config = c.config.get<any>("llm");
    if (!config) {
      throw new Error("缺少 llm 配置");
    }
    return new LlmProxyService(config);
  });
}
