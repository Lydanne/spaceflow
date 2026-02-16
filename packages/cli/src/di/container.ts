import type {
  SpaceflowContext,
  IConfigReader,
  IOutputService,
  IStorageService,
} from "@spaceflow/core";

/**
 * 服务工厂函数类型
 */
export type ServiceFactory<T = unknown> = (container: ServiceContainer) => T;

/**
 * 服务注册信息
 */
interface ServiceRegistration<T = unknown> {
  factory: ServiceFactory<T>;
  instance?: T;
  initialized: boolean;
}

/**
 * 服务容器
 * 提供懒加载的依赖注入功能
 */
export class ServiceContainer implements SpaceflowContext {
  private registrations = new Map<string, ServiceRegistration>();
  private _config!: IConfigReader;
  private _output!: IOutputService;
  private _storage!: IStorageService;

  /**
   * 设置核心服务（config, output, storage）
   */
  setCoreServices(config: IConfigReader, output: IOutputService, storage: IStorageService): void {
    this._config = config;
    this._output = output;
    this._storage = storage;
  }

  /**
   * 注册服务工厂（懒加载）
   */
  registerFactory<T>(key: string, factory: ServiceFactory<T>): void {
    this.registrations.set(key, {
      factory: factory as ServiceFactory,
      initialized: false,
    });
  }

  /**
   * 注册服务实例（立即可用）
   */
  registerService(key: string, service: unknown): void {
    this.registrations.set(key, {
      factory: () => service,
      instance: service,
      initialized: true,
    });
  }

  /**
   * 获取服务（懒加载）
   */
  getService<T = unknown>(key: string): T {
    const registration = this.registrations.get(key);
    if (!registration) {
      throw new Error(`服务 "${key}" 未注册`);
    }
    if (!registration.initialized) {
      registration.instance = registration.factory(this);
      registration.initialized = true;
    }
    return registration.instance as T;
  }

  /**
   * 检查服务是否已注册
   */
  hasService(key: string): boolean {
    return this.registrations.has(key);
  }

  /**
   * 尝试获取服务（不抛错）
   */
  tryGetService<T = unknown>(key: string): T | undefined {
    if (!this.hasService(key)) {
      return undefined;
    }
    try {
      return this.getService<T>(key);
    } catch {
      return undefined;
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
   * 销毁容器
   */
  async destroy(): Promise<void> {
    // 销毁 storage 服务（清理定时器）
    if (this._storage && typeof (this._storage as any).destroy === "function") {
      (this._storage as any).destroy();
    }
    this.registrations.clear();
  }
}
