import { Module, DynamicModule, Provider, Type } from "@nestjs/common";
import { LlmProxyService } from "./llm-proxy.service";
import { ClaudeCodeAdapter } from "./adapters/claude-code.adapter";
import { OpenAIAdapter } from "./adapters/openai.adapter";
import { ClaudeSetupModule } from "../claude-setup";
import type { LlmProxyConfig } from "./interfaces";
import { OpenCodeAdapter } from "./adapters";

export interface LlmProxyModuleOptions extends LlmProxyConfig {}

export interface LlmProxyModuleAsyncOptions {
  imports?: any[];
  useFactory?: (...args: any[]) => Promise<LlmProxyConfig> | LlmProxyConfig;
  inject?: any[];
  useClass?: Type<LlmProxyOptionsFactory>;
  useExisting?: Type<LlmProxyOptionsFactory>;
}

export interface LlmProxyOptionsFactory {
  createLlmProxyOptions(): Promise<LlmProxyConfig> | LlmProxyConfig;
}

@Module({})
export class LlmProxyModule {
  static forRoot(options: LlmProxyModuleOptions): DynamicModule {
    const resolvedOptions = this.resolveOpenCodeConfig(options);
    return {
      module: LlmProxyModule,
      imports: [ClaudeSetupModule],
      providers: [
        {
          provide: "LLM_PROXY_CONFIG",
          useValue: resolvedOptions,
        },
        ClaudeCodeAdapter,
        OpenAIAdapter,
        OpenCodeAdapter,
        LlmProxyService,
      ],
      exports: [LlmProxyService, ClaudeCodeAdapter, OpenCodeAdapter, OpenAIAdapter],
    };
  }

  static forRootAsync(options: LlmProxyModuleAsyncOptions): DynamicModule {
    const asyncProviders = this.createAsyncProviders(options);

    return {
      module: LlmProxyModule,
      imports: [...(options.imports || []), ClaudeSetupModule],
      providers: [
        ...asyncProviders,
        ClaudeCodeAdapter,
        OpenAIAdapter,
        OpenCodeAdapter,
        LlmProxyService,
      ],
      exports: [LlmProxyService, ClaudeCodeAdapter, OpenCodeAdapter, OpenAIAdapter],
    };
  }

  private static createAsyncProviders(options: LlmProxyModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      const originalFactory = options.useFactory;
      return [
        {
          provide: "LLM_PROXY_CONFIG",
          useFactory: async (...args: any[]) => {
            const config = await originalFactory(...args);
            return this.resolveOpenCodeConfig(config);
          },
          inject: options.inject || [],
        },
      ];
    }

    if (options.useClass) {
      return [
        {
          provide: "LLM_PROXY_CONFIG",
          useFactory: async (optionsFactory: LlmProxyOptionsFactory) =>
            optionsFactory.createLlmProxyOptions(),
          inject: [options.useClass],
        },
        {
          provide: options.useClass,
          useClass: options.useClass,
        },
      ];
    }

    if (options.useExisting) {
      return [
        {
          provide: "LLM_PROXY_CONFIG",
          useFactory: async (optionsFactory: LlmProxyOptionsFactory) =>
            optionsFactory.createLlmProxyOptions(),
          inject: [options.useExisting],
        },
      ];
    }

    return [];
  }

  private static resolveOpenCodeConfig(config: LlmProxyConfig): LlmProxyConfig {
    if (!config.openCode) {
      return config;
    }

    const providerID = config.openCode.providerID || "openai";
    let apiKey = config.openCode.apiKey;
    let baseUrl = config.openCode.baseUrl;
    let model = config.openCode.model;

    // 根据 providerID 从对应的 adapter 配置中读取缺失的值
    if (providerID === "openai" && config.openai) {
      if (!apiKey) apiKey = config.openai.apiKey;
      if (!baseUrl) baseUrl = config.openai.baseUrl;
      if (!model) model = config.openai.model;
    } else if (providerID === "anthropic" && config.claudeCode) {
      if (!apiKey) apiKey = config.claudeCode.authToken;
      if (!baseUrl) baseUrl = config.claudeCode.baseUrl;
      if (!model) model = config.claudeCode.model;
    }

    // 如果有任何值需要更新
    if (
      apiKey !== config.openCode.apiKey ||
      baseUrl !== config.openCode.baseUrl ||
      model !== config.openCode.model
    ) {
      return {
        ...config,
        openCode: { ...config.openCode, apiKey, baseUrl, model },
      };
    }

    return config;
  }
}
