import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect, vi } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

import { UpdateService } from "./update.service";

const execSyncMock = vi.mocked(execSync);

class TestUpdateService extends UpdateService {
  async getLatestNpmVersion(): Promise<string | null> {
    return "2.0.0";
  }
}

describe("commands/update/update.service", () => {
  describe("getCurrentNpmVersion", () => {
    it("从子目录执行时应读取项目根 package.json", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "spaceflow-update-root-"));
      const nested = join(projectRoot, "packages", "app");
      const previousCwd = process.cwd();
      try {
        mkdirSync(nested, { recursive: true });
        writeFileSync(
          join(projectRoot, "package.json"),
          JSON.stringify({ dependencies: { "@scope/plugin": "^1.2.3" } }),
        );
        writeFileSync(
          join(nested, "package.json"),
          JSON.stringify({ dependencies: { "@scope/plugin": "^9.9.9" } }),
        );
        process.chdir(nested);
        const service = new UpdateService(projectRoot);

        const version = await service.getCurrentNpmVersion("@scope/plugin");

        expect(version).toBe("1.2.3");
      } finally {
        process.chdir(previousCwd);
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });

  describe("updateNpmPackage", () => {
    it("更新扩展依赖时应在 .spaceflow 目录执行安装", async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "spaceflow-update-dep-"));
      const spaceflowDir = join(projectRoot, ".spaceflow");
      try {
        mkdirSync(spaceflowDir, { recursive: true });
        writeFileSync(
          join(spaceflowDir, "package.json"),
          JSON.stringify({ dependencies: { "@scope/plugin": "1.0.0" } }),
        );
        execSyncMock.mockReset();
        const service = new TestUpdateService(projectRoot);

        const result = await service.updateNpmPackage("@scope/plugin", 0, {
          cwd: spaceflowDir,
          dev: false,
        });

        expect(result).toBe(true);
        expect(execSyncMock).toHaveBeenCalledWith("npm install @scope/plugin@latest", {
          cwd: spaceflowDir,
          stdio: "pipe",
        });
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });
});
