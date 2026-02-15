import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import {
  StorageModule,
  OutputModule,
  configLoaders,
  ConfigReaderModule,
  getEnvFilePaths,
} from "@spaceflow/core";

@Module({
  imports: [
    // 配置模块
    ConfigModule.forRoot({
      isGlobal: true,
      load: configLoaders,
      envFilePath: getEnvFilePaths(),
    }),

    // 基础能力模块
    StorageModule.forFeature(),
    OutputModule,
    ConfigReaderModule,

    // 内置命令通过 internal-plugins.ts 以插件方式加载
  ],
})
export class CliModule {}
