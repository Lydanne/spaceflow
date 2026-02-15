import { Module } from "@nestjs/common";
import { BuildCommand } from "./build.command";
import { BuildService } from "./build.service";

@Module({
  providers: [BuildCommand, BuildService],
})
export class BuildModule {}
