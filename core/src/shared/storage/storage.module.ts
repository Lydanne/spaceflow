import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { StorageService } from "./storage.service";
import { MemoryAdapter } from "./adapters/memory.adapter";
import { FileAdapter } from "./adapters/file.adapter";
import { StorageAdapter } from "./adapters/storage-adapter.interface";
import {
  type StorageModuleOptions,
  type StorageModuleAsyncOptions,
  STORAGE_MODULE_OPTIONS,
  STORAGE_ADAPTER,
} from "./types";
import { storageConfig, StorageConfig } from "../../config";

/**
 * 创建适配器实例
 */
function createAdapter(options: StorageModuleOptions): StorageAdapter {
  switch (options.adapter) {
    case "file":
      if (!options.filePath) {
        throw new Error("filePath is required for file adapter");
      }
      return new FileAdapter(options.filePath);
    case "memory":
    default:
      return new MemoryAdapter();
  }
}

@Module({})
export class StorageModule {
  /**
   * 同步注册模块
   *
   * @example
   * ```ts
   * StorageModule.forRoot({
   *   adapter: 'memory',
   *   defaultTtl: 3600000, // 1 hour
   * })
   * ```
   *
   * @example
   * ```ts
   * StorageModule.forRoot({
   *   adapter: 'file',
   *   filePath: './data/storage.json',
   * })
   * ```
   */
  static forRoot(options: StorageModuleOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_MODULE_OPTIONS,
          useValue: options,
        },
        {
          provide: STORAGE_ADAPTER,
          useValue: createAdapter(options),
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }

  /**
   * 异步注册模块
   *
   * @example
   * ```ts
   * StorageModule.forRootAsync({
   *   useFactory: (configService: ConfigService) => ({
   *     adapter: configService.get('STORAGE_ADAPTER') || 'memory',
   *     filePath: configService.get('STORAGE_FILE_PATH'),
   *   }),
   *   inject: [ConfigService],
   * })
   * ```
   */
  static forRootAsync(options: StorageModuleAsyncOptions): DynamicModule {
    return {
      module: StorageModule,
      providers: [
        {
          provide: STORAGE_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: STORAGE_ADAPTER,
          useFactory: (opts: StorageModuleOptions) => createAdapter(opts),
          inject: [STORAGE_MODULE_OPTIONS],
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }

  /**
   * 使用 ConfigService 注册模块
   *
   * 环境变量：
   * - STORAGE_ADAPTER: 'memory' | 'file'
   * - STORAGE_FILE_PATH: 文件存储路径
   * - STORAGE_DEFAULT_TTL: 默认过期时间（毫秒）
   * - STORAGE_MAX_KEYS: 最大 key 数量
   *
   * @example
   * ```ts
   * @Module({
   *   imports: [StorageModule.forFeature()],
   * })
   * export class AppModule {}
   * ```
   */
  static forFeature(): DynamicModule {
    return {
      global: true,
      module: StorageModule,
      imports: [ConfigModule.forFeature(storageConfig)],
      providers: [
        {
          provide: STORAGE_MODULE_OPTIONS,
          useFactory: (configService: ConfigService): StorageModuleOptions => {
            const config = configService.get<StorageConfig>("storage");
            return {
              adapter: config?.adapter || "memory",
              filePath: config?.filePath,
              defaultTtl: config?.defaultTtl,
              maxKeys: config?.maxKeys,
            };
          },
          inject: [ConfigService],
        },
        {
          provide: STORAGE_ADAPTER,
          useFactory: (opts: StorageModuleOptions) => createAdapter(opts),
          inject: [STORAGE_MODULE_OPTIONS],
        },
        StorageService,
      ],
      exports: [StorageService],
    };
  }
}
