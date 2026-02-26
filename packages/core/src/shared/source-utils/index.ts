/**
 * 从 @spaceflow/shared 重导出 source-utils
 */
export type { SourceType } from "@spaceflow/shared";
export {
  isGitUrl,
  isLocalPath,
  getSourceType,
  normalizeSource,
  extractNpmPackageName,
  extractName,
  buildGitPackageSpec,
} from "@spaceflow/shared";
