import type {
  GuardResult,
  NavigationGuardContext,
} from "../types";

export type BeforeEnterGuard = (
  ctx: NavigationGuardContext,
) => GuardResult | Promise<GuardResult>;

export function guards(...fns: BeforeEnterGuard[]): BeforeEnterGuard {
  return async (ctx) => {
    for (const fn of fns) {
      const result = await fn(ctx);
      if (result !== undefined && result !== true) {
        return result;
      }
    }
  };
}
