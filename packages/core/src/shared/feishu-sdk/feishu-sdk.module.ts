import { DynamicModule, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { FeishuSdkService } from "./feishu-sdk.service";
import { FeishuCardService } from "./fieshu-card.service";
import { FeishuModuleOptions, FeishuModuleAsyncOptions, FEISHU_MODULE_OPTIONS } from "./types";
import { feishuConfig, FeishuConfig } from "../../config";

@Module({})
export class FeishuSdkModule {
  /**
   * 同步注册模块
   */
  static forRoot(options: FeishuModuleOptions): DynamicModule {
    return {
      module: FeishuSdkModule,
      imports: [EventEmitterModule.forRoot()],
      providers: [
        {
          provide: FEISHU_MODULE_OPTIONS,
          useValue: options,
        },
        FeishuSdkService,
        FeishuCardService,
      ],
      exports: [FeishuSdkService, FeishuCardService],
    };
  }

  /**
   * 异步注册模块 - 支持从环境变量等动态获取配置
   */
  static forRootAsync(options: FeishuModuleAsyncOptions): DynamicModule {
    return {
      module: FeishuSdkModule,
      imports: [EventEmitterModule.forRoot()],
      providers: [
        {
          provide: FEISHU_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        FeishuSdkService,
        FeishuCardService,
      ],
      exports: [FeishuSdkService, FeishuCardService],
    };
  }

  /**
   * 使用 ConfigService 注册模块
   */
  static forFeature(): DynamicModule {
    return {
      module: FeishuSdkModule,
      imports: [ConfigModule.forFeature(feishuConfig), EventEmitterModule.forRoot()],
      providers: [
        {
          provide: FEISHU_MODULE_OPTIONS,
          useFactory: (configService: ConfigService): FeishuModuleOptions => {
            const config = configService.get<FeishuConfig>("feishu");
            return {
              appId: config?.appId || "",
              appSecret: config?.appSecret || "",
              appType: config?.appType,
              domain: config?.domain,
            };
          },
          inject: [ConfigService],
        },
        FeishuSdkService,
        FeishuCardService,
      ],
      exports: [FeishuSdkService, FeishuCardService],
    };
  }
}
