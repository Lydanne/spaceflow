import type { CardJSON } from "./card";
import type { CardParams } from "./common";
import type { BackResult } from "./stack";

export interface NavigateResult {
  __type: "navigate";
  page: string;
  params: CardParams;
  data?: CardParams;
  newMessage?: boolean;
  mode?: "push" | "replace";
}

export interface ToastResult {
  __type: "toast";
  type: "success" | "info" | "warning" | "error";
  content: string;
}

export interface AsyncTaskResult {
  __type: "async_task";
  loadingCard: CardJSON;
  task: () => Promise<void>;
}

export type CardActionResult
  = | NavigateResult
    | BackResult
    | ToastResult
    | AsyncTaskResult
    | CardJSON
    | undefined;

export interface NavigateOpts {
  data?: CardParams;
  newMessage?: boolean;
  mode?: "push" | "replace";
}
