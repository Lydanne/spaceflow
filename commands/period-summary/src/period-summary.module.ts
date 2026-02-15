import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { GitProviderModule, ciConfig } from "@spaceflow/core";
import { PeriodSummaryCommand } from "./period-summary.command";
import { PeriodSummaryService } from "./period-summary.service";

@Module({
  imports: [ConfigModule.forFeature(ciConfig), GitProviderModule.forFeature()],
  providers: [PeriodSummaryCommand, PeriodSummaryService],
})
export class PeriodSummaryModule {}
