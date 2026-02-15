import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { GitProviderService } from "./git-provider.service";
import {
  type GitProviderModuleOptions,
  type GitProviderModuleAsyncOptions,
  GIT_PROVIDER_MODULE_OPTIONS,
} from "./types";
import { gitProviderConfig, type GitProviderConfig } from "../../config/git-provider.config";

@Module({})
export class GitProviderModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: GitProviderModuleOptions): DynamicModule {
    return {
      module: GitProviderModule,
      providers: [
        {
          provide: GIT_PROVIDER_MODULE_OPTIONS,
          useValue: options,
        },
        GitProviderService,
      ],
      exports: [GitProviderService],
    };
  }

  /**
   * 异步注册模块 - 支持从环境变量等动态获取配置
   */
  static forRootAsync(options: GitProviderModuleAsyncOptions): DynamicModule {
    return {
      module: GitProviderModule,
      providers: [
        {
          provide: GIT_PROVIDER_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        GitProviderService,
      ],
      exports: [GitProviderService],
    };
  }

  /**
   * 使用 ConfigService 注册模块
   */
  static forFeature(): DynamicModule {
    return {
      module: GitProviderModule,
      imports: [ConfigModule.forFeature(gitProviderConfig)],
      providers: [
        {
          provide: GIT_PROVIDER_MODULE_OPTIONS,
          useFactory: (configService: ConfigService): GitProviderModuleOptions => {
            const config = configService.get<GitProviderConfig>("gitProvider");
            return {
              provider: config?.provider || "gitea",
              baseUrl: config?.serverUrl || "",
              token: config?.token || "",
            };
          },
          inject: [ConfigService],
        },
        GitProviderService,
      ],
      exports: [GitProviderService],
    };
  }
}
