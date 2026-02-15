import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GitProviderModule, ciConfig } from "@spaceflow/core";
import { CiShellCommand } from "./ci-shell.command";
import { CiShellService } from "./ci-shell.service";

@Module({
  imports: [ConfigModule.forFeature(ciConfig), GitProviderModule.forFeature()],
  providers: [CiShellCommand, CiShellService],
})
export class CiShellModule {}
