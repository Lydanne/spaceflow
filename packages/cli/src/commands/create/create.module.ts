import { Module } from "@nestjs/common";
import { CreateCommand } from "./create.command";
import { CreateService } from "./create.service";

@Module({
  providers: [CreateCommand, CreateService],
})
export class CreateModule {}
