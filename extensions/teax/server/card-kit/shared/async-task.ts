import { EnhancedCardBuilder } from "../builder";
import type {
  AsyncTaskResult,
  CardJSON,
} from "../types";

export function asyncTask(
  loading: string | CardJSON,
  task: () => Promise<void>,
): AsyncTaskResult {
  const loadingCard = typeof loading === "string"
    ? new EnhancedCardBuilder({ title: "⏳ 请稍候", theme: "blue" }, "")
        .text(loading, true)
        .build()
    : loading;

  return {
    __type: "async_task",
    loadingCard,
    task,
  };
}
