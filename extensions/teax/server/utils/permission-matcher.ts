import { minimatch } from "minimatch";

/**
 * 检查所需权限是否被授予的权限匹配。
 * 支持 glob 模式匹配和向后兼容。
 *
 * @param required - 所需的权限（如 "actions:trigger:test-unit"）
 * @param granted - 已授予的权限（如 "actions:trigger:test-*"）
 * @returns 是否匹配
 *
 * @example
 * matchPermission("actions:trigger:test-unit", "actions:trigger:test-*") // true
 * matchPermission("actions:trigger:test-unit", "actions:trigger") // true (向后兼容)
 * matchPermission("actions:trigger:publish-npm", "actions:trigger:test-*") // false
 */
export function matchPermission(required: string, granted: string): boolean {
  // 1. 完全匹配
  if (required === granted) return true;

  const grantedParts = granted.split(":");
  const requiredParts = required.split(":");

  // 2. 向后兼容：granted 无 resource 部分 = 全部资源
  //    granted="actions:trigger" 可以匹配 required="actions:trigger:any-workflow"
  if (grantedParts.length === 2 && requiredParts.length >= 2) {
    if (grantedParts[0] === requiredParts[0] && grantedParts[1] === requiredParts[1]) {
      return true;
    }
  }

  // 3. Glob 模式匹配
  if (grantedParts.length === 3 && requiredParts.length === 3) {
    const grantedPattern = grantedParts[2];
    const requiredResource = requiredParts[2];

    if (
      grantedParts[0] === requiredParts[0] &&
      grantedParts[1] === requiredParts[1] &&
      grantedPattern &&
      requiredResource
    ) {
      // 使用 minimatch 进行 glob 匹配
      return minimatch(requiredResource, grantedPattern);
    }
  }

  return false;
}

/**
 * 检查用户是否拥有所需权限（从权限列表中匹配）。
 *
 * @param required - 所需的权限
 * @param grantedList - 已授予的权限列表
 * @returns 是否拥有权限
 */
export function hasPermission(required: string, grantedList: string[]): boolean {
  return grantedList.some((granted) => matchPermission(required, granted));
}
