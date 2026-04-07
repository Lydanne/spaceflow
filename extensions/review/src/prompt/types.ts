/**
 * 提示词回调函数类型定义
 */
export interface PromptContext {
  [key: string]: unknown;
}

export interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
}

/**
 * 输入验证错误类
 */
export class PromptValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PromptValidationError";
  }
}

/**
 * 输入验证工具函数
 */
export function validateRequired<T>(value: T | undefined | null, fieldName: string): T {
  if (value === undefined || value === null) {
    throw new PromptValidationError(`${fieldName} is required but was ${value}`);
  }
  return value;
}

export function validateNonEmptyString(
  value: string | undefined | null,
  fieldName: string,
): string {
  if (value === undefined || value === null || value.trim() === "") {
    throw new PromptValidationError(`${fieldName} is required and cannot be empty`);
  }
  return value;
}

export function validateArray<T>(value: T[] | undefined | null, fieldName: string): T[] {
  if (!Array.isArray(value)) {
    throw new PromptValidationError(`${fieldName} must be an array but was ${typeof value}`);
  }
  return value;
}

/**
 * 提示词函数类型 - 接收上下文，返回 systemPrompt 和 userPrompt
 */
export type PromptFn<T extends PromptContext = PromptContext> = (ctx: T) => PromptResult;
