import {
  ConfigReader,
  loadEnvFiles,
  getEnvFilePaths,
  OutputService,
  StorageService,
  GitSdkService,
  GitProviderService,
  LlmProxyService,
  type IConfigReader,
  type IOutputService,
  type IStorageService,
  type SpaceflowContext,
} from "@spaceflow/core";
import { FileAdapter } from "@spaceflow/core";
import { join } from "path";

/**
 * 服务容器
 * 管理所有服务实例，提供 SpaceflowContext
 */
export class ServiceContainer implements SpaceflowContext {
  private services = new Map<string, unknown>();
  private _config: ConfigReader;
  private _output: OutputService;
  private _storage: StorageService;

  constructor(cwd?: string) {
    // 加载 .env 文件
    loadEnvFiles(getEnvFilePaths(cwd));

    // 初始化核心服务
    this._config = new ConfigReader(cwd);
    this._output = new OutputService();

    // 初始化存储服务
    const storagePath = join(cwd || process.cwd(), ".spaceflow", "storage");
    const storageAdapter = new FileAdapter(storagePath);
    this._storage = new StorageService(storageAdapter);

    // 注册核心服务
    this.registerService("config", this._config);
    this.registerService("output", this._output);
    this.registerService("storage", this._storage);

    // 注册 Git 服务
    this.registerService("gitSdk", new GitSdkService());

    // 延迟初始化的服务（需要配置）
    this.initConfigDependentServices();
  }

  /**
   * 初始化依赖配置的服务
   */
  private initConfigDependentServices(): void {
    // GitProvider（如果配置了）
    const gitProviderConfig = this._config.get<any>("gitProvider");
    if (gitProviderConfig?.provider) {
      try {
        const gitProvider = new GitProviderService(gitProviderConfig);
        this.registerService("gitProvider", gitProvider);
      } catch (error) {
        // 配置不完整，跳过
      }
    }

    // LlmProxy（如果配置了）
    const llmConfig = this._config.get<any>("llm");
    if (llmConfig) {
      try {
        const llmProxy = new LlmProxyService(llmConfig);
        this.registerService("llmProxy", llmProxy);
      } catch (error) {
        // 配置不完整，跳过
      }
    }
  }

  get config(): IConfigReader {
    return this._config;
  }

  get output(): IOutputService {
    return this._output;
  }

  get storage(): IStorageService {
    return this._storage;
  }

  /**
   * 获取服务实例
   */
  getService<T = unknown>(key: string): T {
    const service = this.services.get(key);
    if (!service) {
      throw new Error(`服务 "${key}" 未注册`);
    }
    return service as T;
  }

  /**
   * 注册服务
   */
  registerService(key: string, service: unknown): void {
    this.services.set(key, service);
  }

  /**
   * 检查服务是否存在
   */
  hasService(key: string): boolean {
    return this.services.has(key);
  }

  /**
   * 销毁容器，清理资源
   */
  async destroy(): Promise<void> {
    // 调用 storage 的 destroy 方法
    this._storage.destroy();
    this.services.clear();
  }
}
