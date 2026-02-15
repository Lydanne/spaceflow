import { Module } from "@nestjs/common";
import { ReviewReportService } from "./review-report.service";

@Module({
  providers: [ReviewReportService],
  exports: [ReviewReportService],
})
export class ReviewReportModule {}
