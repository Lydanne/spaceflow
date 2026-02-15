import { Global, Module } from "@nestjs/common";
import { OutputService } from "./output.service";

@Global()
@Module({
  providers: [OutputService],
  exports: [OutputService],
})
export class OutputModule {}
