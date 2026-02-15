import { Module } from "@nestjs/common";
import { SetupCommand } from "./setup.command";
import { SetupService } from "./setup.service";

@Module({
  providers: [SetupCommand, SetupService],
})
export class SetupModule {}
