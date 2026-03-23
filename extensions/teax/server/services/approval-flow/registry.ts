import type { ApprovalStrategy } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strategyRegistry = new Map<string, ApprovalStrategy<any>>();

/**
 * 注册审批策略
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerStrategy(strategy: ApprovalStrategy<any>): void {
  if (strategyRegistry.has(strategy.flowType)) {
    console.warn(`[ApprovalFlow] Strategy for "${strategy.flowType}" already registered, skipping`);
    return;
  }
  strategyRegistry.set(strategy.flowType, strategy);
  console.log(`[ApprovalFlow] Registered strategy: ${strategy.flowType}`);
}

/**
 * 获取审批策略
 */
export function getStrategy(flowType: string): ApprovalStrategy {
  const strategy = strategyRegistry.get(flowType);
  if (!strategy) {
    throw createError({
      statusCode: 400,
      message: `No strategy registered for flow type "${flowType}"`,
    });
  }
  return strategy;
}

/**
 * 获取所有已注册的流程类型
 */
export function getRegisteredFlowTypes(): string[] {
  return Array.from(strategyRegistry.keys());
}

/**
 * 检查策略是否已注册
 */
export function hasStrategy(flowType: string): boolean {
  return strategyRegistry.has(flowType);
}
