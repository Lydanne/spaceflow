import { Module } from "@nestjs/common";
import { UpdateCommand } from "./update.command";
import { UpdateService } from "./update.service";

@Module({
  providers: [UpdateCommand, UpdateService],
  exports: [UpdateService],
})
export class UpdateModule {}
