import { vi } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { z } from "zod";
import { ExtensionLoader } from "./extension-loader";
import { getRegisteredSchemas, SchemaGeneratorService } from "../config/schema-generator.service";
import type { SpaceflowContext } from "@spaceflow/core";

function createContext(): SpaceflowContext {
  const services = new Map<string, unknown>();
  return {
    cwd: "/tmp/project",
    config: {
      get: vi.fn(),
      getPluginConfig: vi.fn(),
      registerSchema: vi.fn(),
    },
    output: {} as SpaceflowContext["output"],
    storage: {} as SpaceflowContext["storage"],
    registerService: vi.fn((key: string, service: unknown) => services.set(key, service)),
    getService: vi.fn((key: string) => services.get(key)),
    hasService: vi.fn((key: string) => services.has(key)),
  };
}

describe("cli-runtime/extension-loader", () => {
  describe("registerExtension", () => {
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

    it("扩展初始化时可以读取已注册服务", async () => {
      const ctx = createContext();
      const loader = new ExtensionLoader(ctx);
      const service = { ready: true };
      const calls: unknown[] = [];

      await loader.registerExtension({
        name: "test-extension-service",
        commands: [],
        services: [
          {
            key: "test.service",
            factory: () => service,
          },
        ],
        onInit: async (context) => {
          calls.push(context.getService("test.service"));
        },
      });

      expect(ctx.registerService).toHaveBeenCalledWith("test.service", service);
      expect(calls).toEqual([service]);
    });

    it("生成 JSON Schema 时包含扩展 schema", async () => {
      const root = mkdtempSync(join(tmpdir(), "spaceflow-extension-schema-"));
      try {
        const ctx = createContext();
        const loader = new ExtensionLoader(ctx);
        const outputPath = join(root, ".spaceflow", "config-schema.json");

        await loader.registerExtension({
          name: "test-extension-generated-schema",
          description: "生成器扩展配置",
          configKey: "generatedExtensionSchema",
          configSchema: () => z.object({ enabled: z.boolean().optional() }),
          commands: [],
        });

        new SchemaGeneratorService().generateJsonSchema(outputPath);

        const schema = JSON.parse(readFileSync(outputPath, "utf-8"));
        expect(schema.properties.generatedExtensionSchema.description).toBe("生成器扩展配置");
        expect(schema.properties.generatedExtensionSchema.properties.enabled.type).toBe("boolean");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("destroy", () => {
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

    it("销毁多个扩展时按注册相反顺序执行", async () => {
      const ctx = createContext();
      const loader = new ExtensionLoader(ctx);
      const calls: string[] = [];

      await loader.registerExtension({
        name: "first-extension",
        commands: [],
        onDestroy: async () => {
          calls.push("first");
        },
      });
      await loader.registerExtension({
        name: "second-extension",
        commands: [],
        onDestroy: async () => {
          calls.push("second");
        },
      });

      await loader.destroy();

      expect(calls).toEqual(["second", "first"]);
    });
  });
});
