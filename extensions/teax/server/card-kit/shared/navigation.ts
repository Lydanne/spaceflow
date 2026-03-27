import type {
  BackResult,
  NavigateOpts,
  NavigateResult,
  ToastResult,
} from "../types";

export function navigate(
  page: string,
  params: Record<string, unknown> = {},
  opts?: NavigateOpts,
): NavigateResult {
  return {
    __type: "navigate",
    page,
    params,
    data: opts?.data,
    newMessage: opts?.newMessage,
    mode: opts?.mode,
  };
}

export function back(): BackResult {
  return { __type: "back" };
}

export function toast(
  type: "success" | "info" | "warning" | "error",
  content: string,
): ToastResult {
  return {
    __type: "toast",
    type,
    content,
  };
}

export function navigateTo(
  page: string,
  params: Record<string, unknown> = {},
  opts?: { mode?: "push" | "replace" },
): NavigateResult {
  return {
    __type: "navigate",
    page,
    params,
    mode: opts?.mode,
  };
}
