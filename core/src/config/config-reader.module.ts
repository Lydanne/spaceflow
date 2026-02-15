import { Global, Module } from "@nestjs/common";
import { ConfigReaderService } from "./config-reader.service";
import { SchemaGeneratorService } from "./schema-generator.service";

/**
 * 配置读取模块
 * 提供插件配置读取服务和 Schema 生成服务
 *
 * 插件的 defaultConfig 通过 getMetadata() 返回，在插件加载时自动注册
 */
@Global()
@Module({
  providers: [ConfigReaderService, SchemaGeneratorService],
  exports: [ConfigReaderService, SchemaGeneratorService],
})
export class ConfigReaderModule {}
