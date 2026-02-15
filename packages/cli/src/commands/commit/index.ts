import type {
  SpaceflowExtension,
  SpaceflowExtensionMetadata,
  ExtensionModuleType,
} from "@spaceflow/core";
import { t } from "@spaceflow/core";
import { CommitScopeConfigSchema } from "./commit.config";
import { CommitModule } from "./commit.module";

/** commit 插件元数据 */
export const commitMetadata: SpaceflowExtensionMetadata = {
  name: "commit",
  commands: ["commit"],
  configKey: "commit",
  configSchema: () => CommitScopeConfigSchema,
  version: "1.0.0",
  description: t("commit:extensionDescription"),
};

export class CommitExtension implements SpaceflowExtension {
  getMetadata(): SpaceflowExtensionMetadata {
    return commitMetadata;
  }

  getModule(): ExtensionModuleType {
    return CommitModule;
  }
}
