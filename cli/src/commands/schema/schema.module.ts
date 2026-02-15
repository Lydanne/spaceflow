import { Module } from "@nestjs/common";
import { SchemaCommand } from "./schema.command";

@Module({
  providers: [SchemaCommand],
})
export class SchemaModule {}
