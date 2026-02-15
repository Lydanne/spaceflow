import { Module } from "@nestjs/common";
import { GitSdkService } from "./git-sdk.service";

@Module({
  providers: [GitSdkService],
  exports: [GitSdkService],
})
export class GitSdkModule {}
