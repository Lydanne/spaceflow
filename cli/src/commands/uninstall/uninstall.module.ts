import { Module } from "@nestjs/common";
import { UninstallCommand } from "./uninstall.command";
import { UninstallService } from "./uninstall.service";

@Module({
  providers: [UninstallCommand, UninstallService],
})
export class UninstallModule {}
