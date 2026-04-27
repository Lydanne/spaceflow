import { describe, it, expect } from "vitest";
import runtime from "./runtime.js";

const { buildProductionArgs, resolveProviderUrl, splitArgs } = runtime;

describe("runtime", () => {
  describe("resolveProviderUrl", () => {
    it("没有显式输入时不使用 GitHub 页面地址", () => {
      const result = resolveProviderUrl({
        env: {
          GITHUB_SERVER_URL: "https://github.com",
        },
      });

      expect(result).toBe("");
    });

    it("显式输入 provider-url 时优先使用输入值", () => {
      const result = resolveProviderUrl({
        inputProviderUrl: "https://gitea.example.com",
        env: {
          GIT_PROVIDER_URL: "https://api.github.com",
          GITEA_SERVER_URL: "https://gitea.old.example.com",
        },
      });

      expect(result).toBe("https://gitea.example.com");
    });

    it("没有显式输入时使用已有 GIT_PROVIDER_URL", () => {
      const result = resolveProviderUrl({
        env: {
          GIT_PROVIDER_URL: "https://api.github.com",
          GITEA_SERVER_URL: "https://gitea.example.com",
        },
      });

      expect(result).toBe("https://api.github.com");
    });

    it("Gitea 环境下使用 GITEA_SERVER_URL", () => {
      const result = resolveProviderUrl({
        env: {
          GITEA_SERVER_URL: "https://gitea.example.com",
        },
      });

      expect(result).toBe("https://gitea.example.com");
    });
  });

  describe("buildProductionArgs", () => {
    it("生产模式使用正式 CLI 包名", () => {
      expect(buildProductionArgs("review", "-v --dry-run")).toEqual([
        "-y",
        "@spaceflow/cli",
        "review",
        "-v",
        "--dry-run",
        "--ci",
      ]);
    });

    it("没有额外参数时仍追加 ci 参数", () => {
      expect(buildProductionArgs("review")).toEqual(["-y", "@spaceflow/cli", "review", "--ci"]);
    });
  });

  describe("splitArgs", () => {
    it("空参数返回空数组", () => {
      expect(splitArgs("")).toEqual([]);
    });

    it("连续空白会被过滤", () => {
      expect(splitArgs("  -v   --dry-run  ")).toEqual(["-v", "--dry-run"]);
    });
  });
});
