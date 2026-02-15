import { Module } from "@nestjs/common";
import { RunxCommand } from "./runx.command";
import { RunxService } from "./runx.service";
import { InstallModule } from "../install/install.module";

@Module({
  imports: [InstallModule],
  providers: [RunxCommand, RunxService],
})
export class RunxModule {}
