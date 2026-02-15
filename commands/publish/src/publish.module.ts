import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GitProviderModule, ConfigReaderModule, ciConfig } from "@spaceflow/core";
import { PublishCommand } from "./publish.command";
import { PublishService } from "./publish.service";
import { MonorepoService } from "./monorepo.service";

@Module({
  imports: [ConfigModule.forFeature(ciConfig), GitProviderModule.forFeature(), ConfigReaderModule],
  providers: [PublishCommand, PublishService, MonorepoService],
})
export class PublishModule {}
