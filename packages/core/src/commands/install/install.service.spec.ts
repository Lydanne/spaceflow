import { mkdirSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { describe, it, expect } from "vitest";
import { InstallService } from "./install.service";

describe("commands/install/install.service", () => {
  describe("getContext", () => {
    it("从子目录执行时应使用项目根目录定位安装状态", () => {
      const projectRoot = mkdtempSync(join(tmpdir(), "spaceflow-install-root-"));
      const nested = join(projectRoot, "packages", "app");
      const previousCwd = process.cwd();
      try {
        mkdirSync(nested, { recursive: true });
        process.chdir(nested);
        const service = new InstallService({} as any, projectRoot);

        const context = service.getContext({ source: "@scope/plugin@1.0.0" });

        expect(context.depsDir).toBe(join(projectRoot, ".spaceflow"));
        expect(context.depPath).toBe(
          join(projectRoot, ".spaceflow", "node_modules", "@scope", "plugin"),
        );
        expect(context.configPath).toBe(join(projectRoot, ".spaceflowrc"));
      } finally {
        process.chdir(previousCwd);
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });
  });
});
