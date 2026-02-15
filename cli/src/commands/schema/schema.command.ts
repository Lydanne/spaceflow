import { Command, CommandRunner } from "nest-commander";
import { t } from "@spaceflow/core";
import { SchemaGeneratorService } from "@spaceflow/core";

@Command({
  name: "schema",
  description: t("schema:description"),
})
export class SchemaCommand extends CommandRunner {
  constructor(private readonly schemaGenerator: SchemaGeneratorService) {
    super();
  }

  async run(): Promise<void> {
    this.schemaGenerator.generate();
  }
}
