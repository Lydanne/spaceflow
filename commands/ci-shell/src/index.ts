import "./locales";
import { SpaceflowExtension, SpaceflowExtensionMetadata, t } from "@spaceflow/core";
import { CiShellModule } from "./ci-shell.module";
export class CiShellExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return {
      name: "ci-shell",
      commands: ["ci-shell"],
      configKey: "ci-shell",
      version: "1.0.0",
      description: t("ci-shell:extensionDescription"),
    };
  }

  getModule() {
    return CiShellModule;
  }
}

export default CiShellExtension;

export * from "./ci-shell.command";
export * from "./ci-shell.service";
export * from "./ci-shell.module";
