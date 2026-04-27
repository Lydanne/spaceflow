import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, vi } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { ensureDependencies, getSpaceflowCoreVersion } from "./index";

const execSyncMock = vi.mocked(execSync);

describe("spaceflow-dir/index", () => {
  describe("getSpaceflowCoreVersion", () => {
    it("从指定项目目录读取 core 版本", () => {
      const root = mkdtempSync(join(tmpdir(), "spaceflow-core-version-"));
      try {
        writeFileSync(
          join(root, ".spaceflowrc"),
          JSON.stringify({ dependencies: { "@spaceflow/core": "5.2.1" } }),
        );

        expect(getSpaceflowCoreVersion(root)).toBe("5.2.1");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("项目使用 workspace cli 时返回 workspace 版本", () => {
      const root = mkdtempSync(join(tmpdir(), "spaceflow-workspace-version-"));
      try {
        writeFileSync(
          join(root, "package.json"),
          JSON.stringify({ devDependencies: { "@spaceflow/cli": "workspace:*" } }),
        );

        expect(getSpaceflowCoreVersion(root)).toBe("workspace:*");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("ensureDependencies", () => {
    it("依赖版本已匹配时不执行安装", () => {
      const root = mkdtempSync(join(tmpdir(), "spaceflow-deps-match-"));
      const spaceflowDir = join(root, ".spaceflow");
      try {
        mkdirSync(join(spaceflowDir, "node_modules", "@spaceflow", "core"), { recursive: true });
        writeFileSync(
          join(spaceflowDir, "package.json"),
          JSON.stringify({ dependencies: { "@spaceflow/core": "1.2.3" } }),
        );
        writeFileSync(
          join(spaceflowDir, "node_modules", "@spaceflow", "core", "package.json"),
          JSON.stringify({ version: "1.2.3" }),
        );
        execSyncMock.mockReset();

        ensureDependencies(spaceflowDir, { stdio: "pipe" });

        expect(execSyncMock).not.toHaveBeenCalled();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("依赖版本不匹配时执行安装", () => {
      const root = mkdtempSync(join(tmpdir(), "spaceflow-deps-mismatch-"));
      const spaceflowDir = join(root, ".spaceflow");
      try {
        mkdirSync(join(spaceflowDir, "node_modules", "@spaceflow", "core"), { recursive: true });
        writeFileSync(
          join(spaceflowDir, "package.json"),
          JSON.stringify({ dependencies: { "@spaceflow/core": "1.2.4" } }),
        );
        writeFileSync(
          join(spaceflowDir, "node_modules", "@spaceflow", "core", "package.json"),
          JSON.stringify({ version: "1.2.3" }),
        );
        execSyncMock.mockReset();

        ensureDependencies(spaceflowDir, { stdio: "pipe" });

        expect(execSyncMock.mock.calls.at(-1)?.[0]).toBe("pnpm install");
        expect(execSyncMock.mock.calls.at(-1)?.[1]).toEqual({
          cwd: spaceflowDir,
          stdio: "pipe",
        });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("caret 范围内的已安装版本不执行安装", () => {
      const root = mkdtempSync(join(tmpdir(), "spaceflow-deps-caret-"));
      const spaceflowDir = join(root, ".spaceflow");
      try {
        mkdirSync(join(spaceflowDir, "node_modules", "@spaceflow", "core"), { recursive: true });
        writeFileSync(
          join(spaceflowDir, "package.json"),
          JSON.stringify({ dependencies: { "@spaceflow/core": "^1.2.0" } }),
        );
        writeFileSync(
          join(spaceflowDir, "node_modules", "@spaceflow", "core", "package.json"),
          JSON.stringify({ version: "1.3.0" }),
        );
        execSyncMock.mockReset();

        ensureDependencies(spaceflowDir, { stdio: "pipe" });

        expect(execSyncMock).not.toHaveBeenCalled();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("workspace 依赖只检查目录存在", () => {
      const root = mkdtempSync(join(tmpdir(), "spaceflow-deps-workspace-"));
      const spaceflowDir = join(root, ".spaceflow");
      try {
        mkdirSync(join(spaceflowDir, "node_modules", "@spaceflow", "core"), { recursive: true });
        writeFileSync(
          join(spaceflowDir, "package.json"),
          JSON.stringify({ dependencies: { "@spaceflow/core": "workspace:*" } }),
        );
        execSyncMock.mockReset();

        ensureDependencies(spaceflowDir, { stdio: "pipe" });

        expect(execSyncMock).not.toHaveBeenCalled();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });
});
