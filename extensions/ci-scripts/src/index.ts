import "./locales";
import { SpaceflowExtension, SpaceflowExtensionMetadata, t } from "@spaceflow/core";
import { CiScriptsModule } from "./ci-scripts.module";
export class CiScriptsExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return {
      name: "ci-scripts",
      commands: ["ci-script"],
      configKey: "ci-scripts",
      version: "1.0.0",
      description: t("ci-scripts:extensionDescription"),
    };
  }

  getModule() {
    return CiScriptsModule;
  }
}

export default CiScriptsExtension;

export * from "./ci-scripts.command";
export * from "./ci-scripts.service";
export * from "./ci-scripts.module";
