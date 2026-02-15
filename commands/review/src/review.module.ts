import {
  Module,
  ConfigModule,
  ConfigService,
  ConfigReaderModule,
  ConfigReaderService,
  GitProviderModule,
  ciConfig,
  llmConfig,
  ClaudeSetupModule,
  LlmProxyModule,
  GitSdkModule,
  type LlmConfig,
} from "@spaceflow/core";
import { ReviewSpecModule } from "./review-spec";
import { ReviewReportModule } from "./review-report";
import { ReviewCommand } from "./review.command";
import { ReviewService } from "./review.service";
import { IssueVerifyService } from "./issue-verify.service";
import { DeletionImpactService } from "./deletion-impact.service";
import { ReviewMcp } from "./review.mcp";
import type { ReviewConfig } from "./review.config";

@Module({
  imports: [
    ConfigModule.forFeature(ciConfig),
    ConfigModule.forFeature(llmConfig),
    ConfigReaderModule,
    GitProviderModule.forFeature(),
    ClaudeSetupModule,
    ReviewSpecModule,
    ReviewReportModule,
    GitSdkModule,
    LlmProxyModule.forRootAsync({
      imports: [ConfigReaderModule, ConfigModule],
      useFactory: (configReader: ConfigReaderService, configService: ConfigService) => {
        const reviewConf = configReader.getPluginConfig<ReviewConfig>("review");
        const llm = configService.get<LlmConfig>("llm")!;
        return {
          defaultAdapter: reviewConf?.llmMode || "openai",
          claudeCode: llm.claudeCode,
          openai: llm.openai,
          openCode: llm.openCode,
        };
      },
      inject: [ConfigReaderService, ConfigService],
    }),
  ],
  providers: [ReviewCommand, ReviewService, IssueVerifyService, DeletionImpactService, ReviewMcp],
  exports: [ReviewMcp],
})
export class ReviewModule {}
