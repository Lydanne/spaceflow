import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { RunxModule } from "./runx.module";

export const runxMetadata: SpaceflowExtensionMetadata = {
  name: "runx",
  commands: ["runx", "x"],
  version: "1.0.0",
  description: t("runx:extensionDescription"),
};

export class RunxExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return runxMetadata;
  }

  getModule(): ExtensionModuleType {
    return RunxModule;
  }
}

export { RunxModule } from "./runx.module";
export { RunxCommand } from "./runx.command";
export { RunxService } from "./runx.service";
export * from "./runx.utils";
