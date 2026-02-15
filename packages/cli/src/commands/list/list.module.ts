import { Module } from "@nestjs/common";
import { ListCommand } from "./list.command";
import { ListService } from "./list.service";
import { ExtensionLoaderService } from "../../extension-loader";

@Module({
  providers: [ListCommand, ListService, ExtensionLoaderService],
})
export class ListModule {}
