import { Module } from "@nestjs/common";
import { ClearCommand } from "./clear.command";
import { ClearService } from "./clear.service";

@Module({
  providers: [ClearCommand, ClearService],
})
export class ClearModule {}
