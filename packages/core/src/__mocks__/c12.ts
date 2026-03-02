import { vi, type Mock } from "vitest";

export const loadConfig: Mock = vi.fn().mockResolvedValue({
  config: {},
});
