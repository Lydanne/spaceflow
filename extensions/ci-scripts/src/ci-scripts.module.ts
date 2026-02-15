import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GitProviderModule, ciConfig } from "@spaceflow/core";
import { CiScriptsCommand } from "./ci-scripts.command";
import { CiScriptsService } from "./ci-scripts.service";

@Module({
  imports: [ConfigModule.forFeature(ciConfig), GitProviderModule.forFeature()],
  providers: [CiScriptsCommand, CiScriptsService],
})
export class CiScriptsModule {}
