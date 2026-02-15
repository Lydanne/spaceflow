import { Injectable } from "@nestjs/common";
import { rspack, type Compiler, type Configuration, type Stats } from "@rspack/core";
import { readdir, stat } from "fs/promises";
import { join, dirname } from "path";
import { existsSync } from "fs";
import { createPluginConfig } from "@spaceflow/core";
import { shouldLog, type VerboseLevel, t } from "@spaceflow/core";

export interface SkillInfo {
  name: string;
  path: string;
  hasPackageJson: boolean;
}

export interface BuildResult {
  skill: string;
  success: boolean;
  duration?: number;
  errors?: string[];
  warnings?: string[];
}

@Injectable()
export class BuildService {
  private readonly projectRoot = this.findProjectRoot();
  private readonly skillsDir = join(this.projectRoot, "skills");
  private readonly commandsDir = join(this.projectRoot, "commands");
  private readonly coreRoot = join(this.projectRoot, "core");
  private watchers: Map<string, Compiler> = new Map();

  /**
   * 查找项目根目录（包含 spaceflow.json 或 .spaceflow/spaceflow.json 的目录）
   */
  private findProjectRoot(): string {
    let dir = process.cwd();
    while (dir !== dirname(dir)) {
      // 检查根目录下的 spaceflow.json
      if (existsSync(join(dir, "spaceflow.json"))) {
        return dir;
      }
      // 检查 .spaceflow/spaceflow.json
      if (existsSync(join(dir, ".spaceflow", "spaceflow.json"))) {
        return dir;
      }
      dir = dirname(dir);
    }
    // 如果找不到，回退到 cwd
    return process.cwd();
  }

  /**
   * 构建插件
   */
  async build(skillName?: string, verbose: VerboseLevel = 1): Promise<BuildResult[]> {
    const skills = await this.getSkillsToBuild(skillName);

    if (skills.length === 0) {
      if (shouldLog(verbose, 1)) console.log(t("build:noPlugins"));
      return [];
    }

    if (shouldLog(verbose, 1))
      console.log(t("build:startBuilding", { count: skills.length }) + "\n");

    const results: BuildResult[] = [];
    for (const skill of skills) {
      const result = await this.buildSkill(skill, verbose);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    if (shouldLog(verbose, 1))
      console.log("\n" + t("build:buildComplete", { success: successCount, fail: failCount }));
    return results;
  }

  /**
   * 监听模式构建
   */
  async watch(skillName?: string, verbose: VerboseLevel = 1): Promise<void> {
    const skills = await this.getSkillsToBuild(skillName);

    if (skills.length === 0) {
      if (shouldLog(verbose, 1)) console.log(t("build:noPlugins"));
      return;
    }

    if (shouldLog(verbose, 1))
      console.log(t("build:startWatching", { count: skills.length }) + "\n");

    // 并行启动所有 watcher
    await Promise.all(skills.map((skill) => this.watchSkill(skill, verbose)));

    // 保持进程运行
    await new Promise(() => {});
  }

  /**
   * 停止所有 watcher
   */
  async stopWatch(verbose: VerboseLevel = 1): Promise<void> {
    for (const [name, compiler] of this.watchers) {
      await new Promise<void>((resolve) => {
        compiler.close(() => {
          if (shouldLog(verbose, 1)) console.log(t("build:stopWatching", { name }));
          resolve();
        });
      });
    }
    this.watchers.clear();
  }

  /**
   * 获取需要构建的插件列表
   */
  private async getSkillsToBuild(skillName?: string): Promise<SkillInfo[]> {
    // 如果没有指定插件名，检查是否在插件目录中运行
    if (!skillName) {
      const currentSkill = this.detectCurrentSkill();
      if (currentSkill) {
        return [currentSkill];
      }
    }

    if (!existsSync(this.skillsDir)) {
      return [];
    }

    const entries = await readdir(this.skillsDir);
    const skills: SkillInfo[] = [];

    for (const entry of entries) {
      if (entry.startsWith(".")) continue;

      const skillPath = join(this.skillsDir, entry);
      const stats = await stat(skillPath);

      if (!stats.isDirectory()) continue;

      if (skillName && entry !== skillName) continue;

      const packageJsonPath = join(skillPath, "package.json");
      const hasPackageJson = existsSync(packageJsonPath);

      if (hasPackageJson) {
        skills.push({
          name: entry,
          path: skillPath,
          hasPackageJson,
        });
      }
    }

    return skills;
  }

  /**
   * 检测当前是否在插件目录中运行
   */
  private detectCurrentSkill(): SkillInfo | null {
    const cwd = process.cwd();
    const packageJsonPath = join(cwd, "package.json");

    // 检查当前目录是否有 package.json
    if (!existsSync(packageJsonPath)) {
      return null;
    }

    // 检查是否在 skills 或 commands 目录下
    if (!cwd.startsWith(this.skillsDir) && !cwd.startsWith(this.commandsDir)) {
      return null;
    }

    // 获取插件名（当前目录名）
    const name = cwd.split("/").pop() || "";

    return {
      name,
      path: cwd,
      hasPackageJson: true,
    };
  }

  /**
   * 构建单个插件
   */
  private async buildSkill(skill: SkillInfo, verbose: VerboseLevel = 1): Promise<BuildResult> {
    const startTime = Date.now();
    if (shouldLog(verbose, 1)) console.log(t("build:building", { name: skill.name }));

    try {
      const config = await this.getConfig(skill);
      const compiler = rspack(config);

      const stats = await new Promise<Stats>((resolve, reject) => {
        compiler.run((err, stats) => {
          compiler.close((closeErr) => {
            if (err) return reject(err);
            if (closeErr) return reject(closeErr);
            if (!stats) return reject(new Error("No stats returned"));
            resolve(stats);
          });
        });
      });

      const duration = Date.now() - startTime;
      const info = stats.toJson({ errors: true, warnings: true });

      if (stats.hasErrors()) {
        const errors = info.errors?.map((e) => e.message) || [];
        console.log(t("build:buildFailedWithDuration", { duration }));
        errors.forEach((e) => console.log(`      ${e}`));
        return { skill: skill.name, success: false, duration, errors };
      }

      if (stats.hasWarnings()) {
        const warnings = info.warnings?.map((w) => w.message) || [];
        if (shouldLog(verbose, 1))
          console.log(t("build:buildWarnings", { duration, count: warnings.length }));
        return { skill: skill.name, success: true, duration, warnings };
      }

      if (shouldLog(verbose, 1)) console.log(t("build:buildSuccess", { duration }));
      return { skill: skill.name, success: true, duration };
    } catch (error) {
      const duration = Date.now() - startTime;
      const message = error instanceof Error ? error.message : String(error);
      console.log(t("build:buildFailedWithMessage", { duration, message }));
      return { skill: skill.name, success: false, duration, errors: [message] };
    }
  }

  /**
   * 监听单个插件
   */
  private async watchSkill(skill: SkillInfo, verbose: VerboseLevel = 1): Promise<void> {
    if (shouldLog(verbose, 1)) console.log(t("build:watching", { name: skill.name }));

    try {
      const config = await this.getConfig(skill);
      const compiler = rspack(config);

      this.watchers.set(skill.name, compiler);

      compiler.watch({}, (err, stats) => {
        if (err) {
          console.log(t("build:watchError", { name: skill.name, message: err.message }));
          return;
        }

        if (!stats) return;

        const info = stats.toJson({ errors: true, warnings: true });

        if (stats.hasErrors()) {
          console.log(t("build:watchBuildFailed", { name: skill.name }));
          info.errors?.forEach((e) => console.log(`      ${e.message}`));
        } else if (stats.hasWarnings()) {
          if (shouldLog(verbose, 1))
            console.log(
              t("build:watchBuildWarnings", { name: skill.name, count: info.warnings?.length }),
            );
        } else {
          if (shouldLog(verbose, 1))
            console.log(t("build:watchBuildSuccess", { name: skill.name }));
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(t("build:watchInitFailed", { name: skill.name, message }));
    }
  }

  /**
   * 获取插件的 rspack 配置
   */
  private async getConfig(skill: SkillInfo): Promise<Configuration> {
    // 检查是否有自定义配置
    const customConfigPath = join(skill.path, "rspack.config.mjs");
    const customConfigPathJs = join(skill.path, "rspack.config.js");

    if (existsSync(customConfigPath)) {
      const module = await import(customConfigPath);
      return module.default || module;
    }

    if (existsSync(customConfigPathJs)) {
      const module = await import(customConfigPathJs);
      return module.default || module;
    }

    // 使用默认配置
    return this.getDefaultConfig(skill);
  }

  /**
   * 生成默认的 rspack 配置
   */
  private getDefaultConfig(skill: SkillInfo): Configuration {
    return createPluginConfig(
      {
        name: skill.name,
        path: skill.path,
      },
      {
        coreRoot: this.coreRoot,
      },
    );
  }
}
