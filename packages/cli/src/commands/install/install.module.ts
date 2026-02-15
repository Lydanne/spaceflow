import { Module } from "@nestjs/common";
import { InstallCommand } from "./install.command";
import { InstallService } from "./install.service";

@Module({
  providers: [InstallCommand, InstallService],
  exports: [InstallService],
})
export class InstallModule {}
