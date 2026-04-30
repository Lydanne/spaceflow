import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it } from "vitest";
import { loadSpaceflowConfig, SpaceflowConfigSchema } from "./spaceflow.config";

const minimalConfig = {
  dependencies: {
    "@spaceflow/core": "5.2.3",
  },
  gitProvider: {
    provider: "github",
    serverUrl: "https://api.github.com",
    token: "token",
  },
  llm: {
    openai: {
      apiKey: "openai-key",
    },
  },
};

describe("loadSpaceflowConfig", () => {
  let projectRoot: string | undefined;

  afterEach(() => {
    if (projectRoot) {
      rmSync(projectRoot, { recursive: true, force: true });
      projectRoot = undefined;
    }
  });

  it("fills defaults when optional config sections are omitted", () => {
    const config = SpaceflowConfigSchema.parse(minimalConfig);

    expect(config.ci).toEqual({
      repository: "",
      refName: "",
      actor: "",
    });
    expect(config.llm.openai.apiKey).toBe("openai-key");
    expect(config.llm.openCode.serverUrl).toBe("http://localhost:4096");
    expect(config.llm.gemini.apiKey).toBe("");
    expect(config.feishu.appType).toBe("self_build");
    expect(config.storage.adapter).toBe("memory");
  });

  it("loads rc files that only configure openai", () => {
    projectRoot = mkdtempSync(join(tmpdir(), "spaceflow-config-"));
    writeFileSync(join(projectRoot, ".spaceflowrc"), JSON.stringify(minimalConfig));

    const config = loadSpaceflowConfig(projectRoot);

    expect(config.llm.openai.apiKey).toBe("openai-key");
    expect(config.llm.openCode).toBeDefined();
    expect(config.llm.gemini).toBeDefined();
    expect(config.ci).toBeDefined();
    expect(config.feishu).toBeDefined();
    expect(config.storage).toBeDefined();
  });
});
