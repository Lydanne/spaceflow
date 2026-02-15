import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { CommitCommand } from "./commit.command";
import { CommitService } from "./commit.service";
import { ConfigReaderModule, LlmProxyModule, type LlmConfig } from "@spaceflow/core";

@Module({
  imports: [
    ConfigReaderModule,
    LlmProxyModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const llmConfig = configService.get<LlmConfig>("llm");
        return {
          defaultAdapter: "openai",
          openai: llmConfig?.openai,
          claudeCode: llmConfig?.claudeCode,
          openCode: llmConfig?.openCode,
        };
      },
    }),
  ],
  providers: [CommitCommand, CommitService],
})
export class CommitModule {}
