export * from "./git-provider.config";
export * from "./ci.config";
export * from "./llm.config";
export * from "./feishu.config";
export * from "./storage.config";
export * from "./spaceflow.config";
export * from "./config-reader.service";
export * from "./config-reader.module";
export * from "./schema-generator.service";
export * from "./config-loader";

import { gitProviderConfig } from "./git-provider.config";
import { ciConfig } from "./ci.config";
import { llmConfig } from "./llm.config";
import { feishuConfig } from "./feishu.config";
import { storageConfig } from "./storage.config";
import { spaceflowConfig } from "./spaceflow.config";

/**
 * 所有配置加载器
 */
export const configLoaders = [
  gitProviderConfig,
  ciConfig,
  llmConfig,
  feishuConfig,
  storageConfig,
  spaceflowConfig,
];
