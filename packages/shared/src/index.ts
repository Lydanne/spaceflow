// Package Manager
export { getPackageManager, detectPackageManager, isPnpmWorkspace } from "./package-manager";

// Spaceflow Dir
export {
  SPACEFLOW_DIR,
  PACKAGE_JSON,
  getSpaceflowDir,
  ensureSpaceflowDir,
  getSpaceflowCoreVersion,
  ensureSpaceflowPackageJson,
  ensureDependencies,
  loadExtensionsFromDir,
  ensureEditorGitignore,
} from "./spaceflow-dir";

// Verbose
export type { LogLevel, VerboseLevel } from "./verbose";
export {
  LOG_LEVEL_PRIORITY,
  toLogLevel,
  normalizeVerbose,
  shouldLog,
  parseVerbose,
} from "./verbose";

// Source Utils
export type { SourceType } from "./source-utils";
export {
  isGitUrl,
  isLocalPath,
  getSourceType,
  normalizeSource,
  extractNpmPackageName,
  extractName,
  buildGitPackageSpec,
} from "./source-utils";

// Editor Config
export { EDITOR_DIR_MAPPING, DEFAULT_EDITOR, getEditorDirName } from "./editor-config";

// Config
export {
  DEFAULT_SUPPORT_EDITOR,
  CONFIG_FILE_NAME,
  RC_FILE_NAME,
  deepMerge,
  getConfigPath,
  getConfigPaths,
  getEnvFilePaths,
  readConfigSync,
  writeConfigSync,
  getSupportedEditors,
  getDependencies,
  findConfigFileWithField,
  updateDependency,
  removeDependency,
} from "./config";
