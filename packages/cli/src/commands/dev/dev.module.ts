import { Module } from "@nestjs/common";
import { DevCommand } from "./dev.command";
import { BuildService } from "../build/build.service";

@Module({
  providers: [DevCommand, BuildService],
})
export class DevModule {}
