import { execSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface PackageInfo {
  /** 包目录路径（相对于项目根目录） */
  dir: string;
  /** 包名称（从 package.json 读取） */
  name: string;
  /** 包版本 */
  version: string;
  /** workspace 依赖的包名列表 */
  workspaceDeps: string[];
}

export interface MonorepoAnalysisResult {
  /** 所有变更的包 */
  changedPackages: PackageInfo[];
  /** 需要发布的包（包含依赖变更的包），按拓扑排序 */
  packagesToPublish: PackageInfo[];
}

export class MonorepoService {
  private readonly cwd: string;

  constructor() {
    this.cwd = process.cwd();
  }

  resolveTarget(target: string): { pkg: PackageInfo; version: string } {
    const separator = target.lastIndexOf("@");
    const name = target.slice(0, separator);
    const version = target.slice(separator + 1);
    if (separator <= 0 || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
      throw new Error("--target 需要完整包名和精确稳定版本，例如 @spaceflow/core@5.2.7");
    }
    const pkg = this.getAllPackageInfos(this.getWorkspacePackages()).find(
      (pkg) => pkg.name === name,
    );
    if (!pkg) throw new Error(`找不到可发布的工作区包: ${name}`);
    const [current, prerelease] = pkg.version.split("+")[0].split("-");
    const order = version.localeCompare(current, "en", { numeric: true });
    if (order < 0 || (order === 0 && !prerelease)) {
      throw new Error(`目标版本必须高于当前版本 ${pkg.version}`);
    }
    return { pkg, version };
  }

  /**
   * 分析 monorepo 变更，返回需要发布的包列表（拓扑排序后）
   * @param dryRun 是否为 dry-run 模式
   * @param propagateDeps 是否传递依赖变更（依赖的包变更时，依赖方也发布）
   */
  async analyze(dryRun: boolean, propagateDeps = true): Promise<MonorepoAnalysisResult> {
    const workspacePackages = this.getWorkspacePackages();
    const allPackages = this.getAllPackageInfos(workspacePackages);

    // 为每个包单独检测变更（基于各自的最新 tag）
    const changedPackages = this.getChangedPackages(allPackages, dryRun);

    if (dryRun) {
      console.log(`📦 直接变更的包: ${changedPackages.map((p) => p.name).join(", ") || "无"}`);
    }

    // 计算依赖传递，找出所有需要发布的包
    const packagesToPublish = propagateDeps
      ? this.calculateAffectedPackages(changedPackages, allPackages)
      : changedPackages;

    if (dryRun) {
      console.log(
        `🔄 需要发布的包（含依赖传递）: ${packagesToPublish.map((p) => p.name).join(", ") || "无"}`,
      );
    }

    // 拓扑排序
    const sortedPackages = this.topologicalSort(packagesToPublish, allPackages);

    if (dryRun) {
      console.log(`📋 发布顺序: ${sortedPackages.map((p) => p.name).join(" -> ") || "无"}`);
    }

    return {
      changedPackages,
      packagesToPublish: sortedPackages,
    };
  }

  /**
   * 简单解析 pnpm-workspace.yaml（只提取 packages 数组）
   */
  private parseSimpleYaml(content: string): { packages?: string[] } {
    const packages: string[] = [];
    const lines = content.split("\n");
    let inPackages = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === "packages:") {
        inPackages = true;
        continue;
      }
      if (inPackages) {
        if (trimmed.startsWith("- ")) {
          // 提取包路径，去除引号
          let pkg = trimmed.slice(2).trim();
          pkg = pkg.replace(/^["']|["']$/g, "");
          packages.push(pkg);
        } else if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-")) {
          // 遇到新的顶级 key，停止解析
          break;
        }
      }
    }

    return { packages: packages.length > 0 ? packages : undefined };
  }

  /**
   * 从 pnpm-workspace.yaml 读取 workspace 包配置
   */
  private getWorkspacePackages(): string[] {
    const workspaceFile = join(this.cwd, "pnpm-workspace.yaml");
    if (!existsSync(workspaceFile)) {
      throw new Error("未找到 pnpm-workspace.yaml 文件");
    }

    const content = readFileSync(workspaceFile, "utf-8");
    const config = this.parseSimpleYaml(content);

    if (!config.packages || !Array.isArray(config.packages)) {
      throw new Error("pnpm-workspace.yaml 中未配置 packages");
    }

    return config.packages;
  }

  /**
   * 展开 workspace 包配置，获取所有实际的包目录
   */
  private expandWorkspacePatterns(patterns: string[]): string[] {
    const dirs: string[] = [];

    for (const pattern of patterns) {
      if (pattern.includes("*")) {
        // 使用 glob 展开，这里简化处理，只支持 extensions/* 这种模式
        const baseDir = pattern.replace("/*", "");
        const basePath = join(this.cwd, baseDir);
        if (existsSync(basePath)) {
          const { readdirSync, statSync } = require("fs");
          const entries = readdirSync(basePath) as string[];
          for (const entry of entries) {
            const entryPath = join(basePath, entry);
            if (statSync(entryPath).isDirectory()) {
              const pkgJson = join(entryPath, "package.json");
              if (existsSync(pkgJson)) {
                dirs.push(join(baseDir, entry));
              }
            }
          }
        }
      } else {
        // 直接目录
        const pkgJson = join(this.cwd, pattern, "package.json");
        if (existsSync(pkgJson)) {
          dirs.push(pattern);
        }
      }
    }

    return dirs;
  }

  /**
   * 获取所有包的详细信息（排除私有包）
   */
  private getAllPackageInfos(patterns: string[]): PackageInfo[] {
    const dirs = this.expandWorkspacePatterns(patterns);
    const packages: PackageInfo[] = [];

    for (const dir of dirs) {
      const pkgJsonPath = join(this.cwd, dir, "package.json");
      if (!existsSync(pkgJsonPath)) continue;

      const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));

      // 跳过私有包
      if (pkgJson.private === true) continue;

      const workspaceDeps = this.extractWorkspaceDeps(pkgJson);

      packages.push({
        dir,
        name: pkgJson.name,
        version: pkgJson.version,
        workspaceDeps,
      });
    }

    return packages;
  }

  /**
   * 提取包的 workspace 依赖
   */
  private extractWorkspaceDeps(pkgJson: Record<string, unknown>): string[] {
    const deps: string[] = [];
    const allDeps = {
      ...(pkgJson.dependencies as Record<string, string> | undefined),
      ...(pkgJson.devDependencies as Record<string, string> | undefined),
      ...(pkgJson.peerDependencies as Record<string, string> | undefined),
    };

    for (const [name, version] of Object.entries(allDeps)) {
      if (version && (version.startsWith("workspace:") || version === "*")) {
        deps.push(name);
      }
    }

    return deps;
  }

  /**
   * 检测每个包的变更（基于各自的最新 tag）
   */
  private getChangedPackages(allPackages: PackageInfo[], dryRun: boolean): PackageInfo[] {
    const changedPackages: PackageInfo[] = [];

    for (const pkg of allPackages) {
      const hasChanges = this.hasPackageChanges(pkg);
      if (hasChanges) {
        changedPackages.push(pkg);
      }
      if (dryRun) {
        console.log(`  ${hasChanges ? "✅" : "⭕"} ${pkg.name}`);
      }
    }

    return changedPackages;
  }

  /**
   * 检测单个包是否有变更（基于该包的最新 tag）
   */
  private hasPackageChanges(pkg: PackageInfo): boolean {
    try {
      // 获取该包的最新 tag（格式: @scope/pkg@version 或 pkg@version）
      const tagPattern = `${pkg.name}@*`;
      const latestTag = execSync(
        `git describe --tags --abbrev=0 --match "${tagPattern}" 2>/dev/null || echo ''`,
        { cwd: this.cwd, encoding: "utf-8" },
      ).trim();

      if (!latestTag) {
        // 没有 tag，说明是新包，需要发布
        console.log(`📌 ${pkg.name}: 无 tag，需要发布`);
        return true;
      }

      // 检测从该 tag 到 HEAD，该包目录下是否有变更
      const diffOutput = execSync(`git diff --name-only "${latestTag}"..HEAD -- "${pkg.dir}"`, {
        cwd: this.cwd,
        encoding: "utf-8",
      }).trim();

      const hasChanges = diffOutput.length > 0;
      if (hasChanges) {
        console.log(`📌 ${pkg.name}: ${latestTag} -> HEAD 有变更`);
        console.log(
          `    变更文件: ${diffOutput.split("\n").slice(0, 3).join(", ")}${diffOutput.split("\n").length > 3 ? "..." : ""}`,
        );
      }
      return hasChanges;
    } catch (error) {
      // 出错时保守处理，认为有变更
      console.log(`📌 ${pkg.name}: 检测出错，保守处理为有变更`);
      console.log(`    错误: ${error instanceof Error ? error.message : error}`);
      return true;
    }
  }

  /**
   * 将变更文件映射到包目录
   */
  private mapFilesToPackages(files: string[], patterns: string[]): Set<string> {
    const packageDirs = this.expandWorkspacePatterns(patterns);
    const changedPackages = new Set<string>();

    for (const file of files) {
      for (const dir of packageDirs) {
        if (file.startsWith(dir + "/") || file === dir) {
          changedPackages.add(dir);
          break;
        }
      }
    }

    return changedPackages;
  }

  /**
   * 计算受影响的包（包含依赖传递）
   */
  private calculateAffectedPackages(
    changedPackages: PackageInfo[],
    allPackages: PackageInfo[],
  ): PackageInfo[] {
    const changedNames = new Set(changedPackages.map((p) => p.name));
    const affectedNames = new Set(changedNames);

    // 构建反向依赖图：谁依赖了我
    const reverseDeps = new Map<string, Set<string>>();
    for (const pkg of allPackages) {
      for (const dep of pkg.workspaceDeps) {
        if (!reverseDeps.has(dep)) {
          reverseDeps.set(dep, new Set());
        }
        reverseDeps.get(dep)!.add(pkg.name);
      }
    }

    // BFS 传递依赖
    const queue = [...changedNames];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const dependents = reverseDeps.get(current);
      if (dependents) {
        for (const dependent of dependents) {
          if (!affectedNames.has(dependent)) {
            affectedNames.add(dependent);
            queue.push(dependent);
          }
        }
      }
    }

    return allPackages.filter((p) => affectedNames.has(p.name));
  }

  /**
   * 拓扑排序：被依赖的包先发布
   */
  private topologicalSort(packages: PackageInfo[], _allPackages: PackageInfo[]): PackageInfo[] {
    const packageNames = new Set(packages.map((p) => p.name));
    const nameToPackage = new Map(packages.map((p) => [p.name, p]));

    // 构建依赖图（只考虑待发布包之间的依赖）
    const inDegree = new Map<string, number>();
    const graph = new Map<string, string[]>();

    for (const pkg of packages) {
      inDegree.set(pkg.name, 0);
      graph.set(pkg.name, []);
    }

    for (const pkg of packages) {
      for (const dep of pkg.workspaceDeps) {
        if (packageNames.has(dep)) {
          graph.get(dep)!.push(pkg.name);
          inDegree.set(pkg.name, (inDegree.get(pkg.name) || 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    const sorted: PackageInfo[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(nameToPackage.get(current)!);

      for (const neighbor of graph.get(current) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    if (sorted.length !== packages.length) {
      throw new Error("检测到循环依赖，无法确定发布顺序");
    }

    return sorted;
  }
}
