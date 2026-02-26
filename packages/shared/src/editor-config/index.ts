/**
 * 编辑器配置目录映射
 * key: 编辑器名称（用于配置文件）
 * value: 编辑器配置目录名（以 . 开头）
 */
export const EDITOR_DIR_MAPPING: Record<string, string> = {
  claudeCode: ".claude",
  windsurf: ".windsurf",
  cursor: ".cursor",
  opencode: ".opencode",
};

/**
 * 默认支持的编辑器
 */
export const DEFAULT_EDITOR = "claudeCode";

/**
 * 根据编辑器名称获取配置目录名
 */
export function getEditorDirName(editor: string): string {
  return EDITOR_DIR_MAPPING[editor] || `.${editor}`;
}
