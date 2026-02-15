import { Module } from "@nestjs/common";
import { ClaudeSetupService } from "./claude-setup.service";

@Module({
  providers: [ClaudeSetupService],
  exports: [ClaudeSetupService],
})
export class ClaudeSetupModule {}
