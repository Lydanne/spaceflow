import { Module } from "@nestjs/common";
import { GitProviderModule } from "@spaceflow/core";
import { ReviewSpecService } from "./review-spec.service";

@Module({
  imports: [GitProviderModule.forFeature()],
  providers: [ReviewSpecService],
  exports: [ReviewSpecService],
})
export class ReviewSpecModule {}
