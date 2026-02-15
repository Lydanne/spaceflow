import "./locales";
import { SpaceflowExtension, SpaceflowExtensionMetadata, t } from "@spaceflow/core";
import { PeriodSummaryModule } from "./period-summary.module";
export class PeriodSummaryExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return {
      name: "period-summary",
      commands: ["period-summary"],
      configKey: "period-summary",
      version: "1.0.0",
      description: t("period-summary:extensionDescription"),
    };
  }

  getModule() {
    return PeriodSummaryModule;
  }
}

export default PeriodSummaryExtension;

export * from "./period-summary.command";
export * from "./period-summary.service";
export * from "./period-summary.module";
export * from "./types";
