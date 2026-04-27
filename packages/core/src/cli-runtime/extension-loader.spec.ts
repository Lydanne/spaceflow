import { vi } from "vitest";
import { z } from "zod";
import { ExtensionLoader } from "./extension-loader";
import { getRegisteredSchemas } from "../config/schema-generator.service";
import type { SpaceflowContext } from "@spaceflow/core";

function createContext(): SpaceflowContext {
  return {
    cwd: "/tmp/project",
    config: {
      get: vi.fn(),
      getPluginConfig: vi.fn(),
      registerSchema: vi.fn(),
    },
    output: {} as SpaceflowContext["output"],
    storage: {} as SpaceflowContext["storage"],
    registerService: vi.fn(),
    getService: vi.fn(),
    hasService: vi.fn(),
  };
}

describe("cli-runtime/extension-loader", () => {
  it("注册扩展时应等待初始化并登记 schema 生成器", async () => {
    const ctx = createContext();
    const loader = new ExtensionLoader(ctx);
    const calls: string[] = [];

    await loader.registerExtension({
      name: "test-extension",
      description: "测试扩展",
      configKey: "testExtension",
      configSchema: () => z.object({ enabled: z.boolean().optional() }),
      commands: [],
      onInit: async () => {
        calls.push("init");
      },
    });

    expect(calls).toEqual(["init"]);
    expect(ctx.config.registerSchema).toHaveBeenCalledWith("testExtension", expect.anything());
    expect(getRegisteredSchemas().get("testExtension")?.description).toBe("测试扩展");
  });

  it("销毁扩展时应调用 onDestroy", async () => {
    const ctx = createContext();
    const loader = new ExtensionLoader(ctx);
    const calls: string[] = [];

    await loader.registerExtension({
      name: "test-extension-destroy",
      commands: [],
      onDestroy: async () => {
        calls.push("destroy");
      },
    });

    await loader.destroy();

    expect(calls).toEqual(["destroy"]);
  });
});
