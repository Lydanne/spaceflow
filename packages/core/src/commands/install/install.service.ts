import { execSync } from "child_process";
import { readFile, writeFile, access, mkdir, symlink, unlink, readlink, stat } from "fs/promises";
import { join, resolve, relative } from "path";
import { existsSync } from "fs";
import {
  shouldLog,
  type VerboseLevel,
  t,
  getEditorDirName,
  type SourceType,
  getSourceType,
  normalizeSource,
  extractNpmPackageName,
  extractName,
  buildGitPackageSpec,
  getPackageManager,
  detectPackageManager,
  getSpaceflowDir,
  getSpaceflowCoreVersion,
  ensureSpaceflowPackageJson,
  ensureEditorGitignore,
  SchemaGeneratorService,
  findConfigFileWithField,
  getSupportedEditors,
  getDependencies,
  updateDependency,
  SPACEFLOW_DIR,
} from "@spaceflow/core";

export type { SourceType } from "@spaceflow/core";

/**
 * 扩展配置项，支持字符串或对象格式
 * 字符串: "git@xxx.git" 或 "@scope/package@version" 或 "./path"
 * 对象: { source: "git@xxx.git", ref: "v1.0.0" }
 */
export type ExtensionConfig =
  | string
  | {
      source: string;
      ref?: string; // git: branch/tag/commit, npm: version
    };

export interface InstallOptions {
  source: string;
  name?: string;
  ref?: string; // 版本号/分支/tag/commit
}

export interface InstallContext extends InstallOptions {
  type: SourceType;
  depsDir: string;
  depPath: string;
  configPath: string;
}

/**
 * MCP 导出项配置
 */
export interface McpExportItem {
  name: string;
  entry: string;
  mcp?: { command: string; args?: string[]; env?: string[] };
}

/**
 * 插件配置类型
 */
export type PluginConfig = Record<
  "flows" | "commands" | "skills",
  Array<{ name: string; entry: string }>
> & {
  mcps: McpExportItem[];
};

export class InstallService {
  constructor(private readonly schemaGenerator: SchemaGeneratorService) {}

  getContext(options: InstallOptions): InstallContext {
    const cwd = process.cwd();
    const type = getSourceType(options.source);
    const name = options.name || extractName(options.source);
    const spaceflowDir = join(cwd, SPACEFLOW_DIR);
    // Extension 安装到 .spaceflow/node_modules/ 中
    // 对 npm 包使用完整包名（含 @scope/ 前缀）作为 node_modules 路径
    const depName = type === "npm" ? extractNpmPackageName(options.source) : name;
    const depPath = join(spaceflowDir, "node_modules", depName);
    const configPath = findConfigFileWithField("dependencies", cwd);

    return {
      ...options,
      type,
      depsDir: spaceflowDir,
      depPath,
      configPath,
    };
  }

  /**
   * 将插件关联到各个编辑器的目录
   * pluginConfig 包含 flows/commands/skills/mcps 四种类型
   * - flows: CLI 子命令，不需要复制到编辑器目录
   * - commands: 编辑器命令，复制到 .claude/commands/ 等目录
   * - skills: 技能文件，复制到 .claude/skills/ 等目录
   * - mcps: MCP Server，注册到编辑器的 mcp.json 配置
   */
  protected async linkPluginToEditors(options: {
    name: string;
    depPath: string;
    pluginConfig: PluginConfig;
    cwd?: string;
    isGlobal?: boolean;
    verbose?: VerboseLevel;
  }): Promise<void> {
    const { name, depPath, pluginConfig, cwd, isGlobal = false, verbose = 1 } = options;
    const editors = getSupportedEditors(cwd);
    const home = process.env.HOME || process.env.USERPROFILE || "~";
    const workingDir = cwd || process.cwd();

    for (const editor of editors) {
      const editorDirName = getEditorDirName(editor);
      const editorRoot = isGlobal ? join(home, editorDirName) : join(workingDir, editorDirName);

      // 处理 skills
      if (pluginConfig.skills.length > 0) {
        const editorSkillsDir = join(editorRoot, "skills");
        await this.ensureDir(editorSkillsDir, verbose);

        for (const skill of pluginConfig.skills) {
          const skillPath = skill.entry === "." ? depPath : join(depPath, skill.entry);
          const installName = skill.name || name;
          const targetPath = join(editorSkillsDir, installName);

          await this.copyExtensionToTarget(skillPath, targetPath, installName);

          // 将生成的技能文件加入编辑器目录的 .gitignore
          await ensureEditorGitignore(editorRoot, "skills", installName);
        }
      }

      // 处理 commands（编辑器命令）
      if (pluginConfig.commands.length > 0) {
        const editorCommandsDir = join(editorRoot, "commands");
        await this.ensureDir(editorCommandsDir);

        for (const cmd of pluginConfig.commands) {
          const commandPath = cmd.entry === "." ? depPath : join(depPath, cmd.entry);
          const installName = cmd.name || name;
          await this.generateCommandMd(commandPath, editorCommandsDir, installName, verbose);

          // 将生成的 command 加入编辑器目录的 .gitignore
          await ensureEditorGitignore(editorRoot, "commands", installName);
        }
      }

      // 处理 mcps（MCP Server）
      if (pluginConfig.mcps.length > 0) {
        for (const mcpItem of pluginConfig.mcps) {
          const mcpPath = mcpItem.entry === "." ? depPath : join(depPath, mcpItem.entry);
          const installName = mcpItem.name || name;
          await this.registerMcpServer(editorRoot, installName, mcpPath, mcpItem.mcp, verbose);
        }
      }

      // flows 类型不需要复制到编辑器目录，它们是 CLI 子命令
    }
  }

  /**
   * 注册 MCP Server 到编辑器的 mcp.json 配置
   */
  protected async registerMcpServer(
    editorRoot: string,
    name: string,
    mcpPath: string,
    mcpConfig?: { command: string; args?: string[]; env?: string[] },
    verbose?: VerboseLevel,
  ): Promise<void> {
    const mcpJsonPath = join(editorRoot, "mcp.json");

    // 读取现有配置或创建新配置
    let config: { mcpServers?: Record<string, any> } = { mcpServers: {} };
    try {
      if (existsSync(mcpJsonPath)) {
        const content = await readFile(mcpJsonPath, "utf-8");
        config = JSON.parse(content);
        if (!config.mcpServers) {
          config.mcpServers = {};
        }
      }
    } catch {
      config = { mcpServers: {} };
    }

    // 构建 MCP Server 配置
    const command = mcpConfig?.command || "node";
    const args = mcpConfig?.args || ["dist/index.js"];

    // 将相对路径转换为绝对路径
    const resolvedArgs = args.map((arg) => {
      if (arg.startsWith("./") || arg.startsWith("../") || !arg.includes("/")) {
        // 可能是相对路径，转换为绝对路径
        if (arg.endsWith(".js") || arg.endsWith(".mjs") || arg.endsWith(".cjs")) {
          return join(mcpPath, arg);
        }
      }
      return arg;
    });

    const serverConfig: Record<string, any> = {
      command,
      args: resolvedArgs,
    };

    // 如果有环境变量需求，添加空的 env 对象供用户填写
    if (mcpConfig?.env && mcpConfig.env.length > 0) {
      serverConfig.env = {};
      for (const envKey of mcpConfig.env) {
        serverConfig.env[envKey] = t("install:envPlaceholder", { key: envKey });
      }
    }

    config.mcpServers![name] = serverConfig;

    // 确保目录存在
    await this.ensureDir(editorRoot);

    // 写入配置
    await writeFile(mcpJsonPath, JSON.stringify(config, null, 2), "utf-8");

    if (shouldLog(verbose, 1)) {
      console.log(t("install:registerMcp", { name }));
      if (mcpConfig?.env && mcpConfig.env.length > 0) {
        console.log(t("install:mcpEnvHint", { path: mcpJsonPath, vars: mcpConfig.env.join(", ") }));
      }
    }
  }

  async execute(context: InstallContext, verbose: VerboseLevel = 1): Promise<void> {
    const { source, type, depPath } = context;
    const name = context.name || extractName(source);
    const cwd = process.cwd();
    const isGlobal = false;

    if (shouldLog(verbose, 1)) console.log(t("install:installingExtension", { source }));

    // 所有类型都通过 pnpm add 安装到 .spaceflow/node_modules/
    await this.installExtension(source, type, context.ref, isGlobal, verbose);

    // 读取插件配置并关联到编辑器
    const pluginConfig = await this.getPluginConfigFromPackageJson(depPath);
    await this.linkPluginToEditors({
      name,
      depPath,
      pluginConfig,
      cwd,
      isGlobal,
      verbose,
    });

    // 安装依赖和构建（对于本地路径的 Extension）
    if (type === "local") {
      const sourcePath = resolve(cwd, source);
      await this.ensureDependenciesAndBuild(sourcePath, name, verbose);
    }

    // 更新配置文件
    await this.updateConfigFile(context, verbose);

    if (shouldLog(verbose, 1)) console.log(t("install:installDone", { name }));

    // 自动生成 schema
    this.generateSchema();
  }

  /**
   * 安装 Extension 到 .spaceflow/node_modules/
   * 支持 npm 包、本地路径（link:）、git 仓库（git+）
   * @param source 源（npm 包名、本地路径、git URL）
   * @param type 源类型
   * @param ref 版本/分支/tag（可选）
   * @param isGlobal 是否安装到全局 ~/.spaceflow/
   * @param verbose 日志级别
   */
  protected async installExtension(
    source: string,
    type: SourceType,
    ref?: string,
    isGlobal: boolean = false,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    const spaceflowDir = getSpaceflowDir(isGlobal);

    // 确保 .spaceflow 目录和 package.json 存在
    ensureSpaceflowPackageJson(spaceflowDir);

    // 根据类型构建 pnpm add 的参数
    let packageSpec: string;
    if (type === "local") {
      // 本地路径使用 link: 协议，相对于 .spaceflow 目录
      const normalizedSource = normalizeSource(source);
      // 计算相对于 .spaceflow 目录的路径
      const relativePath = join("..", normalizedSource);
      packageSpec = `link:${relativePath}`;
      if (shouldLog(verbose, 1)) {
        console.log(t("install:typeLocal"));
        console.log(t("install:sourcePath", { path: relativePath }));
      }
    } else if (type === "git") {
      // git 仓库：如果已经是 git+ 格式则直接使用，否则转换
      packageSpec = source.startsWith("git+") ? source : buildGitPackageSpec(source, ref);
      if (shouldLog(verbose, 1)) {
        console.log(t("install:typeGit"));
        console.log(t("install:sourceUrl", { url: packageSpec }));
      }
    } else {
      // npm 包直接使用包名
      packageSpec = source;
      if (shouldLog(verbose, 1)) {
        console.log(t("install:typeNpm"));
      }
    }

    if (shouldLog(verbose, 1)) {
      console.log(t("install:targetDir", { dir: spaceflowDir }));
    }

    const pm = detectPackageManager(spaceflowDir);
    let cmd: string;
    if (pm === "pnpm") {
      cmd = `pnpm add --prefix "${spaceflowDir}" "${packageSpec}"`;
    } else {
      cmd = `npm install --prefix "${spaceflowDir}" "${packageSpec}"`;
    }

    try {
      execSync(cmd, {
        cwd: process.cwd(),
        stdio: verbose ? "inherit" : "pipe",
      });
    } catch (error) {
      throw new Error(t("install:extensionInstallFailed", { source }));
    }
  }

  /**
   * 从源获取实际的包名（用于确定 node_modules 中的路径）
   * 本地路径：读取 package.json 的 name 字段
   * npm 包：直接使用包名
   * git 仓库：安装后从 node_modules 查找
   */
  protected async getPackageNameFromSource(
    source: string,
    type: SourceType,
    spaceflowDir: string,
  ): Promise<string> {
    if (type === "local") {
      // 本地路径：读取 package.json 的 name 字段（先规范化）
      const normalizedSource = normalizeSource(source);
      const sourcePath = resolve(process.cwd(), normalizedSource);
      const pkgJsonPath = join(sourcePath, "package.json");
      if (existsSync(pkgJsonPath)) {
        try {
          const content = await readFile(pkgJsonPath, "utf-8");
          const pkg = JSON.parse(content);
          if (pkg.name) {
            return pkg.name;
          }
        } catch {
          // 解析失败，使用目录名
        }
      }
      // 回退到目录名
      return extractName(source);
    } else if (type === "npm") {
      // npm 包：直接使用包名（去除版本号）
      return extractNpmPackageName(source);
    } else {
      // git 仓库：pnpm 会将 git URL 安装为 xxx.git 格式
      // 例如: git+ssh://git@host/org/repo.git -> repo.git
      const baseName = extractName(source);
      // pnpm 安装 git 仓库时会保留 .git 后缀
      const gitName = baseName.endsWith(".git") ? baseName : `${baseName}.git`;

      // 尝试在 node_modules 中查找
      const nodeModulesPath = join(spaceflowDir, "node_modules");
      if (existsSync(nodeModulesPath)) {
        // 优先检查 xxx.git 格式
        if (existsSync(join(nodeModulesPath, gitName))) {
          return gitName;
        }
        // 回退检查不带 .git 的格式
        if (existsSync(join(nodeModulesPath, baseName))) {
          return baseName;
        }
      }
      return gitName;
    }
  }

  protected async ensureDir(dirPath: string, verbose: VerboseLevel = 1): Promise<void> {
    try {
      await access(dirPath);
    } catch {
      if (shouldLog(verbose, 1)) console.log(t("install:creatingDir", { dir: dirPath }));
      await mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 克隆 git 仓库并移除 .git 目录
   */
  protected async cloneAndRemoveGit(
    repoUrl: string,
    targetPath: string,
    ref?: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    const { rm } = await import("fs/promises");

    // 检查目标目录是否已存在
    if (existsSync(targetPath)) {
      if (shouldLog(verbose, 1)) console.log(t("install:dirExistsSkip"));
      return;
    }

    if (shouldLog(verbose, 1)) console.log(t("install:cloningRepo"));
    try {
      const cloneCmd = ref
        ? `git clone --depth 1 --branch ${ref} ${repoUrl} ${targetPath}`
        : `git clone --depth 1 ${repoUrl} ${targetPath}`;
      execSync(cloneCmd, { stdio: verbose ? "inherit" : "pipe" });
    } catch {
      // 如果 --branch 失败（可能是 commit hash），先 clone 再 checkout
      try {
        execSync(`git clone --depth 1 ${repoUrl} ${targetPath}`, {
          stdio: verbose ? "inherit" : "pipe",
        });
        if (ref) {
          execSync(`git fetch --depth 1 origin ${ref}`, {
            cwd: targetPath,
            stdio: verbose ? "inherit" : "pipe",
          });
          execSync(`git checkout ${ref}`, { cwd: targetPath, stdio: verbose ? "inherit" : "pipe" });
        }
      } catch (error) {
        throw new Error(
          t("install:cloneFailed", { error: error instanceof Error ? error.message : error }),
        );
      }
    }

    // 移除 .git 目录
    const gitDir = join(targetPath, ".git");
    if (existsSync(gitDir)) {
      if (shouldLog(verbose, 1)) console.log(t("install:removingGit"));
      await rm(gitDir, { recursive: true, force: true });
    }
  }

  /**
   * 创建 deps 目录下的符号链接（本地路径依赖）
   */
  protected async createDepsSymlink(
    sourcePath: string,
    depPath: string,
    name: string,
  ): Promise<void> {
    // 检查目标是否已存在
    if (existsSync(depPath)) {
      try {
        const linkTarget = await readlink(depPath);
        const resolvedTarget = resolve(join(depPath, ".."), linkTarget);
        if (resolvedTarget === sourcePath) {
          console.log(t("install:depsLinkExists"));
          return;
        }
        await unlink(depPath);
      } catch {
        console.log(t("install:depsExists", { name }));
        return;
      }
    }

    // 计算相对路径
    const cwd = process.cwd();
    const depsDir = join(depPath, "..");
    const relativeSource = relative(depsDir, sourcePath);

    // 显示相对于 cwd 的路径
    const displayDepPath = relative(cwd, depPath);
    const displaySourcePath = relative(cwd, sourcePath);
    console.log(t("install:createDepsLink", { dep: displayDepPath, source: displaySourcePath }));
    await symlink(relativeSource, depPath);
  }

  /**
   * 将扩展链接到 .claude/skills 目录
   */
  protected async linkExtensionToTarget(
    sourcePath: string,
    targetPath: string,
    name: string,
  ): Promise<void> {
    const { rm } = await import("fs/promises");

    // 检查目标是否已存在
    if (existsSync(targetPath)) {
      try {
        const linkTarget = await readlink(targetPath);
        const resolvedTarget = resolve(join(targetPath, ".."), linkTarget);
        if (resolvedTarget === sourcePath) {
          console.log(t("install:extensionLinkExists", { name }));
          return;
        }
        // 链接指向不同目标，删除后重建
        await rm(targetPath, { recursive: true, force: true });
      } catch {
        // 不是符号链接，删除后重建
        await rm(targetPath, { recursive: true, force: true });
      }
    }

    // 计算相对路径
    const targetDir = join(targetPath, "..");
    const relativeSource = relative(targetDir, sourcePath);

    console.log(t("install:createExtensionLink", { name, target: relativeSource }));
    await symlink(relativeSource, targetPath);
  }

  /**
   * 将扩展复制到 .claude/skills 目录
   */
  protected async copyExtensionToTarget(
    sourcePath: string,
    targetPath: string,
    name: string,
  ): Promise<void> {
    const { rm, cp } = await import("fs/promises");

    // 如果目标已存在，先删除
    if (existsSync(targetPath)) {
      await rm(targetPath, { recursive: true, force: true });
    }

    console.log(t("install:copyExtension", { name }));
    await cp(sourcePath, targetPath, { recursive: true });
  }

  /**
   * 解析扩展配置，支持字符串和对象格式
   */
  parseExtensionConfig(config: ExtensionConfig): { source: string; ref?: string } {
    if (typeof config === "string") {
      return { source: config };
    }
    return { source: config.source, ref: config.ref };
  }

  /**
   * 获取安装根目录
   * @param isGlobal 是否全局安装
   */
  protected getInstallRoot(isGlobal: boolean): string {
    if (isGlobal) {
      const home = process.env.HOME || process.env.USERPROFILE || "~";
      return join(home, ".spaceflow");
    }
    return join(process.cwd(), ".spaceflow");
  }

  /**
   * 全局安装单个依赖
   * 安装到 ~/.spaceflow/node_modules/
   */
  async installGlobal(options: InstallOptions, verbose: VerboseLevel = 1): Promise<void> {
    const { source, name, ref } = options;
    const spaceflowDir = getSpaceflowDir(true);
    const depName = name || extractName(source);

    if (shouldLog(verbose, 1))
      console.log(t("install:globalInstalling", { name: depName, dir: spaceflowDir }));

    const sourceType = getSourceType(source);

    // 通过 pnpm add 安装到 ~/.spaceflow/node_modules/
    await this.installExtension(source, sourceType, ref, true, verbose);

    // Extension 安装后的路径
    // 对 npm 包使用完整包名（含 @scope/ 前缀）作为 node_modules 路径
    const depModuleName = sourceType === "npm" ? name || extractNpmPackageName(source) : depName;
    const depPath = join(spaceflowDir, "node_modules", depModuleName);

    // 读取插件配置
    const pluginConfig = await this.getPluginConfigFromPackageJson(depPath);

    const activeTypes = Object.entries(pluginConfig)
      .filter(([, items]) => items.length > 0)
      .map(([type]) => type);
    if (activeTypes.length > 0 && shouldLog(verbose, 1)) {
      console.log(t("install:pluginTypes", { types: activeTypes.join(", ") }));
    }

    // 将插件关联到各个编辑器的目录
    await this.linkPluginToEditors({
      name: depName,
      depPath,
      pluginConfig,
      cwd: process.cwd(),
      isGlobal: true,
      verbose,
    });

    // 对于本地路径的 Extension，需要安装依赖和构建
    if (sourceType === "local") {
      const sourcePath = resolve(process.cwd(), source);
      await this.ensureDependenciesAndBuild(sourcePath, depName, verbose);
    }

    if (shouldLog(verbose, 1)) console.log(t("install:globalInstallDone"));

    // 自动生成 schema
    this.generateSchema();
  }

  /**
   * 检查 .spaceflowrc 中声明的依赖是否有未安装的
   */
  hasMissingExtensions(): boolean {
    const cwd = process.cwd();
    const dependencies = this.parseExtensionsFromConfig(cwd);
    const spaceflowDir = getSpaceflowDir(false);
    const globalDir = getSpaceflowDir(true);

    for (const name of Object.keys(dependencies)) {
      const localInstalled = existsSync(join(spaceflowDir, "node_modules", name, "package.json"));
      const globalInstalled = existsSync(join(globalDir, "node_modules", name, "package.json"));
      if (!localInstalled && !globalInstalled) {
        return true;
      }
    }
    return false;
  }

  /**
   * 更新配置文件中的所有依赖
   * 先更新 .spaceflow/package.json，然后一次性安装所有依赖
   */
  async updateAllExtensions(options?: { verbose?: VerboseLevel }): Promise<void> {
    const cwd = process.cwd();
    const spaceflowDir = getSpaceflowDir(false);
    const verbose = options?.verbose ?? true;

    if (shouldLog(verbose, 1)) console.log(t("install:updatingAll"));

    // 读取配置文件中的 dependencies
    const dependencies = this.parseExtensionsFromConfig(cwd);

    if (Object.keys(dependencies).length === 0) {
      if (shouldLog(verbose, 1)) console.log(t("install:noDeps"));
      return;
    }

    if (shouldLog(verbose, 1))
      console.log(t("install:foundDeps", { count: Object.keys(dependencies).length }));

    // 1. 记录更新前的 @spaceflow/core 版本
    const spaceflowPkgPath = join(spaceflowDir, "package.json");
    let prevCoreVersion: string | undefined;
    if (existsSync(spaceflowPkgPath)) {
      try {
        const prevPkg = JSON.parse(await readFile(spaceflowPkgPath, "utf-8"));
        prevCoreVersion = prevPkg.dependencies?.["@spaceflow/core"];
      } catch {
        // ignore
      }
    }

    // 2. 更新 .spaceflow/package.json 中的所有依赖
    await this.updateSpaceflowPackageJson(dependencies, spaceflowDir, verbose);

    // 3. 版本变更提示
    const currentCoreVersion = getSpaceflowCoreVersion();
    if (prevCoreVersion && prevCoreVersion !== currentCoreVersion) {
      if (shouldLog(verbose, 1)) {
        console.log(
          t("install:coreVersionChanged", { prev: prevCoreVersion, current: currentCoreVersion }),
        );
      }
    }

    // 4. 安装所有依赖
    if (shouldLog(verbose, 1)) console.log(t("install:installingDeps"));
    const pm = detectPackageManager(spaceflowDir);
    try {
      execSync(`${pm} install`, { cwd: spaceflowDir, stdio: verbose ? "inherit" : "pipe" });
    } catch {
      console.warn(t("install:pmInstallFailed", { pm }));
    }

    // 5. 处理每个依赖的 skills/commands 关联
    for (const [name, config] of Object.entries(dependencies)) {
      const { source } = this.parseExtensionConfig(config);
      const sourceType = getSourceType(source);

      // 获取安装后的路径
      // workspace: 和 npm 类型时，name（.spaceflowrc 的 key）就是包名
      const packageName =
        source.startsWith("workspace:") || sourceType === "npm"
          ? name
          : await this.getPackageNameFromSource(source, sourceType, spaceflowDir);
      const depPath = join(spaceflowDir, "node_modules", packageName);

      if (!existsSync(depPath)) {
        console.warn(t("install:depNotInstalled", { name }));
        continue;
      }

      // 读取插件配置并关联到编辑器
      const pluginConfig = await this.getPluginConfigFromPackageJson(depPath);
      const activeTypes = Object.entries(pluginConfig)
        .filter(([, items]) => items.length > 0)
        .map(([type]) => type);

      if (activeTypes.length > 0) {
        if (shouldLog(verbose, 1)) console.log(`\n📦 ${name}: ${activeTypes.join(", ")}`);
        await this.linkPluginToEditors({
          name,
          depPath,
          pluginConfig,
          cwd,
          isGlobal: false,
          verbose,
        });
      }

      // 对于本地路径的 Extension，需要构建（workspace: 类型不需要，已在 workspace 中构建）
      if (sourceType === "local" && !source.startsWith("workspace:")) {
        const normalizedSource = normalizeSource(source);
        const sourcePath = resolve(cwd, normalizedSource);
        await this.ensureDependenciesAndBuild(sourcePath, name, verbose);
      }
    }

    if (shouldLog(options?.verbose, 1)) {
      console.log(t("install:allExtensionsDone"));
    }

    // 自动生成 schema
    this.generateSchema();
  }

  /**
   * 更新 .spaceflow/package.json 中的依赖
   */
  protected async updateSpaceflowPackageJson(
    dependencies: Record<string, ExtensionConfig>,
    spaceflowDir: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    // 确保目录和 package.json 存在
    ensureSpaceflowPackageJson(spaceflowDir);

    const packageJsonPath = join(spaceflowDir, "package.json");
    const content = await readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);

    if (!pkg.dependencies) {
      pkg.dependencies = {};
    }

    let updated = false;
    for (const [name, config] of Object.entries(dependencies)) {
      const { source, ref } = this.parseExtensionConfig(config);
      const sourceType = getSourceType(source);

      let packageSpec: string;
      let packageName: string;

      if (source.startsWith("workspace:")) {
        // workspace 协议：直接透传
        packageName = name;
        packageSpec = source;
      } else if (sourceType === "local") {
        const normalizedSource = normalizeSource(source);
        const relativePath = join("..", normalizedSource);
        packageSpec = `link:${relativePath}`;
        packageName = await this.getPackageNameFromSource(source, sourceType, spaceflowDir);
      } else if (sourceType === "git") {
        packageSpec = source.startsWith("git+") ? source : buildGitPackageSpec(source, ref);
        packageName = await this.getPackageNameFromSource(source, sourceType, spaceflowDir);
      } else {
        // npm 类型：.spaceflowrc 中 key 是包名，value 是版本范围（如 "^0.37.0"）
        packageName = name;
        packageSpec = source;
      }

      if (pkg.dependencies[packageName] !== packageSpec) {
        pkg.dependencies[packageName] = packageSpec;
        updated = true;
        if (shouldLog(verbose, 2)) console.log(`   + ${packageName}: ${packageSpec}`);
      }
    }

    if (updated) {
      await writeFile(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n");
      if (shouldLog(verbose, 1)) console.log(t("install:updatedPackageJson"));
    }
  }

  /**
   * 从配置文件解析扩展
   */
  protected parseExtensionsFromConfig(cwd?: string): Record<string, ExtensionConfig> {
    return getDependencies(cwd);
  }

  /**
   * 获取 git 仓库当前的 ref (commit hash 或 tag)
   */
  protected async getCurrentGitRef(extPath: string): Promise<string | null> {
    if (!existsSync(extPath)) {
      return null;
    }
    try {
      const result = execSync("git rev-parse HEAD", {
        cwd: extPath,
        encoding: "utf-8",
      }).trim();
      return result.substring(0, 7); // 短 hash
    } catch {
      return null;
    }
  }

  /**
   * 检查 ref 是否匹配（支持 tag、branch、commit）
   */
  protected async isRefMatch(
    extPath: string,
    targetRef: string,
    currentCommit: string | null,
  ): Promise<boolean> {
    if (!currentCommit) return false;

    try {
      // 检查 targetRef 是否是 tag 或 branch，获取其对应的 commit
      const targetCommit = execSync(`git rev-parse ${targetRef}`, {
        cwd: extPath,
        encoding: "utf-8",
      }).trim();

      // 比较 commit hash（前7位）
      return (
        targetCommit.startsWith(currentCommit) ||
        currentCommit.startsWith(targetCommit.substring(0, 7))
      );
    } catch {
      return false;
    }
  }

  /**
   * 创建符号链接（使用绝对路径，用于全局安装）
   */
  protected async createSymlinkAbsolute(
    source: string,
    target: string,
    name: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    try {
      const existingTarget = await readlink(target);
      if (existingTarget === source) {
        if (shouldLog(verbose, 1)) console.log(t("install:symlinkExists"));
        return;
      }
      await unlink(target);
    } catch {
      // 链接不存在，继续创建
    }

    try {
      await symlink(source, target);
      if (shouldLog(verbose, 1)) console.log(t("install:createSymlink", { target, source }));
    } catch (error) {
      throw new Error(
        t("install:createSymlinkFailed", { error: error instanceof Error ? error.message : error }),
      );
    }
  }

  /**
   * 检查 ref 是否是分支
   */
  protected async isBranchRef(extPath: string, ref: string): Promise<boolean> {
    if (!existsSync(extPath)) {
      return false;
    }
    try {
      // 检查是否是远程分支
      const result = execSync(`git branch -r --list "origin/${ref}"`, {
        cwd: extPath,
        encoding: "utf-8",
      }).trim();
      return result.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * 拉取最新代码
   */
  protected async pullLatest(extPath: string, verbose: VerboseLevel = 1): Promise<void> {
    try {
      execSync("git pull", {
        cwd: extPath,
        stdio: verbose ? "inherit" : "pipe",
      });
    } catch {
      if (shouldLog(verbose, 1)) console.warn(t("install:pullFailed"));
    }
  }

  /**
   * 切换到指定的 git ref
   */
  protected async checkoutGitRef(
    extPath: string,
    ref: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    try {
      if (shouldLog(verbose, 1)) console.log(t("install:checkoutVersion", { ref }));
      // 先 fetch 确保有最新的 refs
      execSync("git fetch --all --tags", {
        cwd: extPath,
        stdio: "pipe",
      });
      // checkout 到指定 ref
      execSync(`git checkout ${ref}`, {
        cwd: extPath,
        stdio: verbose ? "inherit" : "pipe",
      });
    } catch {
      if (shouldLog(verbose, 1)) console.warn(t("install:checkoutFailed"));
    }
  }

  /**
   * 检查依赖和构建（仅在需要时执行）
   * 用于版本已匹配的情况，只检查 dist 是否存在
   */
  protected async ensureDependenciesAndBuildIfNeeded(
    extPath: string,
    _name: string,
  ): Promise<void> {
    const pkgJsonPath = join(extPath, "package.json");

    // 检查是否有 package.json（命令型插件）
    if (!existsSync(pkgJsonPath)) {
      return;
    }

    const distIndexPath = join(extPath, "dist", "index.js");
    const nodeModulesPath = join(extPath, "node_modules");

    // 检查 node_modules 是否存在
    if (!existsSync(nodeModulesPath)) {
      console.log(t("install:installingDepsEllipsis"));
      try {
        execSync(`${this.getPackageManager()} install`, {
          cwd: extPath,
          stdio: "inherit",
        });
      } catch {
        console.warn(t("install:depsInstallFailed"));
        return;
      }
    } else {
      console.log(t("install:depsInstalled"));
    }

    // 检查 dist 是否存在
    if (!existsSync(distIndexPath)) {
      console.log(t("install:buildingPlugin"));
      try {
        execSync("pnpm build", {
          cwd: extPath,
          stdio: "inherit",
        });
      } catch {
        console.warn(t("install:buildFailed"));
      }
    } else {
      console.log(t("install:buildExists"));
    }
  }

  /**
   * 克隆或更新 git 仓库（用于全局安装）
   */
  protected async cloneOrUpdateRepo(
    source: string,
    depPath: string,
    ref?: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    const gitDir = join(depPath, ".git");

    if (existsSync(gitDir)) {
      // 仓库已存在，更新
      if (shouldLog(verbose, 1)) console.log(t("install:repoExists"));
      try {
        execSync("git fetch --all", { cwd: depPath, stdio: verbose ? "inherit" : "pipe" });
        if (ref) {
          const isBranch = await this.isBranchRef(depPath, ref);
          if (isBranch) {
            await this.checkoutGitRef(depPath, ref, verbose);
            await this.pullLatest(depPath, verbose);
          } else {
            await this.checkoutGitRef(depPath, ref, verbose);
          }
        } else {
          execSync("git pull", { cwd: depPath, stdio: verbose ? "inherit" : "pipe" });
        }
      } catch {
        if (shouldLog(verbose, 1)) console.warn(t("install:repoUpdateFailed"));
      }
    } else {
      // 仓库不存在，克隆
      if (shouldLog(verbose, 1)) console.log(t("install:cloningRepo"));
      try {
        const cloneCmd = ref
          ? `git clone --branch ${ref} ${source} ${depPath}`
          : `git clone ${source} ${depPath}`;
        execSync(cloneCmd, { stdio: verbose ? "inherit" : "pipe" });
      } catch {
        // 如果 --branch 失败（可能是 commit hash），先 clone 再 checkout
        try {
          execSync(`git clone ${source} ${depPath}`, { stdio: verbose ? "inherit" : "pipe" });
          if (ref) {
            await this.checkoutGitRef(depPath, ref, verbose);
          }
        } catch {
          if (shouldLog(verbose, 1)) console.warn(t("install:cloneRepoFailed"));
        }
      }
    }
  }

  /**
   * 从 package.json 读取插件配置
   * 返回 { flows: [], commands: [], skills: [], mcps: [] } 格式的导出映射
   */
  protected async getPluginConfigFromPackageJson(extPath: string): Promise<PluginConfig> {
    const createEmptyConfig = (): PluginConfig => ({
      flows: [],
      commands: [],
      skills: [],
      mcps: [],
    });
    const createDefaultSkill = (name = ""): PluginConfig => ({
      flows: [],
      commands: [],
      skills: [{ name, entry: "." }],
      mcps: [],
    });

    const addExport = (
      config: PluginConfig,
      type: string,
      name: string,
      entry: string,
      mcp?: { command: string; args?: string[]; env?: string[] },
    ) => {
      if (type === "flow") config.flows.push({ name, entry });
      else if (type === "command") config.commands.push({ name, entry });
      else if (type === "skill") config.skills.push({ name, entry });
      else if (type === "mcp") config.mcps.push({ name, entry, mcp });
    };

    const pkgJsonPath = join(extPath, "package.json");
    if (!existsSync(pkgJsonPath)) {
      return createDefaultSkill();
    }

    try {
      const content = await readFile(pkgJsonPath, "utf-8");
      const pkg = JSON.parse(content);
      const spaceflowConfig = pkg.spaceflow;

      if (!spaceflowConfig) {
        return createDefaultSkill(pkg.name);
      }

      const config = createEmptyConfig();

      // 完整格式：exports 对象
      if (spaceflowConfig.exports) {
        for (const [name, exp] of Object.entries(spaceflowConfig.exports)) {
          const {
            type = "flow",
            entry = ".",
            mcp,
          } = exp as { type?: string; entry?: string; mcp?: any };
          addExport(config, type, name, entry, mcp);
        }
        return config;
      }

      // 简化格式：type/entry
      if (spaceflowConfig.entry) {
        addExport(
          config,
          spaceflowConfig.type || "flow",
          pkg.name || "",
          spaceflowConfig.entry,
          spaceflowConfig.mcp,
        );
        return config;
      }

      return createDefaultSkill(pkg.name);
    } catch {
      return createDefaultSkill();
    }
  }

  /**
   * 获取包管理器
   * 必须同时满足：命令可用 AND lock 文件存在
   */
  protected getPackageManager(): string {
    const cwd = process.cwd();

    // pnpm: 命令可用 + pnpm-lock.yaml 存在
    if (existsSync(join(cwd, "pnpm-lock.yaml"))) {
      try {
        execSync("pnpm --version", { stdio: "ignore" });
        return "pnpm";
      } catch {
        // pnpm 命令不可用，继续检测其他
      }
    }

    // yarn: 命令可用 + yarn.lock 存在
    if (existsSync(join(cwd, "yarn.lock"))) {
      try {
        execSync("yarn --version", { stdio: "ignore" });
        return "yarn";
      } catch {
        // yarn 命令不可用，继续检测其他
      }
    }

    // npm: 命令可用 + package-lock.json 存在
    if (existsSync(join(cwd, "package-lock.json"))) {
      try {
        execSync("npm --version", { stdio: "ignore" });
        return "npm";
      } catch {
        // npm 命令不可用
      }
    }

    // 默认回退到 npm
    return "npm";
  }

  /**
   * 检测当前目录是否为 pnpm workspace
   */
  protected isPnpmWorkspace(): boolean {
    const cwd = process.cwd();
    return existsSync(join(cwd, "pnpm-workspace.yaml"));
  }

  /**
   * 生成 EXTENSION.md 文件
   * 解析 README.md 和 package.json，生成标准化的 EXTENSION.md
   */
  protected async generateExtensionMd(extPath: string, name: string): Promise<void> {
    const extensionMdPath = join(extPath, "EXTENSION.md");

    // 如果已存在 EXTENSION.md，跳过
    if (existsSync(extensionMdPath)) {
      console.log(t("install:extensionMdExists"));
      return;
    }

    let content = "";
    let pkgName = name;
    let pkgDescription = "";

    // 读取 package.json
    const pkgJsonPath = join(extPath, "package.json");
    if (existsSync(pkgJsonPath)) {
      try {
        const pkgContent = await readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(pkgContent);
        pkgName = pkg.name || name;
        pkgDescription = pkg.description || "";
      } catch {
        // 解析失败，使用默认值
      }
    }

    // 读取 README.md（支持大小写）
    let readmeContent = "";
    const readmePaths = [
      join(extPath, "README.md"),
      join(extPath, "readme.md"),
      join(extPath, "Readme.md"),
    ];
    for (const readmePath of readmePaths) {
      if (existsSync(readmePath)) {
        try {
          readmeContent = await readFile(readmePath, "utf-8");
          break;
        } catch {
          // 读取失败，继续尝试
        }
      }
    }

    // 生成 EXTENSION.md 内容
    content = `# ${pkgName}\n\n`;

    if (pkgDescription) {
      content += `${pkgDescription}\n\n`;
    }

    if (readmeContent) {
      // 移除 README 中的标题（如果和 name 相同）
      const lines = readmeContent.split("\n");
      const firstLine = lines[0]?.trim();
      if (firstLine?.startsWith("#") && firstLine.includes(name)) {
        readmeContent = lines.slice(1).join("\n").trim();
      }

      if (readmeContent) {
        content += `## ${t("install:detailSection")}\n\n${readmeContent}\n`;
      }
    }

    // 写入 EXTENSION.md
    try {
      await writeFile(extensionMdPath, content);
      console.log(t("install:extensionMdGenerated"));
    } catch {
      console.warn(t("install:extensionMdFailed"));
    }
  }

  /**
   * 生成 command 文档到 .claude/commands/xxx.md
   * 格式遵循 Claude Code 的 slash commands 规范
   */
  protected async generateCommandMd(
    commandPath: string,
    commandsDir: string,
    name: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    const commandMdPath = join(commandsDir, `${name}.md`);

    let pkgName = name;
    let pkgDescription = "";

    // 读取 package.json
    const cmdPkgJsonPath = join(commandPath, "package.json");
    if (existsSync(cmdPkgJsonPath)) {
      try {
        const pkgContent = await readFile(cmdPkgJsonPath, "utf-8");
        const pkg = JSON.parse(pkgContent);
        pkgName = pkg.name?.replace(/^@[^/]+\//, "") || name;
        pkgDescription = pkg.description || "";
      } catch {
        // 解析失败，使用默认值
      }
    }

    // 读取 README.md
    let readmeContent = "";
    const readmePaths = [
      join(commandPath, "README.md"),
      join(commandPath, "readme.md"),
      join(commandPath, "Readme.md"),
    ];
    for (const readmePath of readmePaths) {
      if (existsSync(readmePath)) {
        try {
          readmeContent = await readFile(readmePath, "utf-8");
          break;
        } catch {
          // 读取失败，继续尝试
        }
      }
    }

    // 获取命令的 help 内容
    let helpContent = "";
    try {
      helpContent = execSync(`pnpm spaceflow ${name} --help 2>/dev/null`, {
        cwd: process.cwd(),
        encoding: "utf-8",
        timeout: 10000,
      }).trim();
      // 移除 "📦 已加载 x 个插件" 这行
      helpContent = helpContent
        .split("\n")
        .filter((line) => !line.includes("已加载") && !line.includes("插件"))
        .join("\n")
        .trim();
    } catch {
      // 获取 help 失败，忽略
    }

    // 生成 command md 内容（遵循 Claude Code 规范）
    let content = `---
name: ${name}
description: ${pkgDescription || t("install:commandDefault", { name })}
---

# ${pkgName}

`;

    if (pkgDescription) {
      content += `${pkgDescription}\n\n`;
    }

    // 添加 help 内容
    if (helpContent) {
      helpContent = helpContent.replace(/^Usage: cli/, "Usage: spaceflow");
      content += `## ${t("install:usageSection")}\n\n\`\`\`\n${helpContent}\n\`\`\`\n\n`;
    }

    if (readmeContent) {
      // 移除 README 中的标题（如果和 name 相同）
      const lines = readmeContent.split("\n");
      const firstLine = lines[0]?.trim();
      if (firstLine?.startsWith("#") && firstLine.includes(name)) {
        readmeContent = lines.slice(1).join("\n").trim();
      }

      if (readmeContent) {
        content += `## ${t("install:detailSection")}\n\n${readmeContent}\n`;
      }
    }

    // 写入 command md
    try {
      await writeFile(commandMdPath, content);
      if (shouldLog(verbose, 1)) console.log(t("install:commandMdGenerated", { name }));
    } catch {
      if (shouldLog(verbose, 1)) console.warn(t("install:commandMdFailed", { name }));
    }
  }

  protected async updateConfigFile(
    context: InstallContext,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    const { source, type, depPath } = context;
    // dependencies key 使用完整包名（npm 类型保留 @scope/ 前缀）
    const name =
      context.name || (type === "npm" ? extractNpmPackageName(source) : extractName(source));
    const cwd = process.cwd();

    // 根据类型生成正确的 value（和 package.json 格式一致）
    let depValue: string;
    if (type === "npm") {
      // npm 类型：从已安装包的 package.json 读取实际版本号
      const pkgJsonPath = join(depPath, "package.json");
      try {
        const content = await readFile(pkgJsonPath, "utf-8");
        const pkg = JSON.parse(content);
        depValue = pkg.version ? `^${pkg.version}` : source;
      } catch {
        depValue = source;
      }
    } else if (type === "local") {
      // local 类型：写入 link: 格式
      depValue = source.startsWith("link:") ? source : `link:${normalizeSource(source)}`;
    } else {
      // git 类型：写入 git URL
      depValue = source.startsWith("git+") ? source : buildGitPackageSpec(source, context.ref);
    }

    const updated = updateDependency(name, depValue, cwd);

    if (updated) {
      if (shouldLog(verbose, 1))
        console.log(
          t("install:configUpdated", { path: findConfigFileWithField("dependencies", cwd) }),
        );
    } else {
      if (shouldLog(verbose, 1)) console.log(t("install:configAlreadyExists"));
    }
  }

  /**
   * 确保依赖已安装且 dist 是最新的
   */
  protected async ensureDependenciesAndBuild(
    extPath: string,
    name: string,
    verbose: VerboseLevel = 1,
  ): Promise<void> {
    const pkgJsonPath = join(extPath, "package.json");

    // 检查是否有 package.json（命令型插件）
    if (!existsSync(pkgJsonPath)) {
      // 资源型插件，无需处理
      return;
    }

    // 检查依赖是否已安装
    const nodeModulesPath = join(extPath, "node_modules");
    const needInstall = await this.needsInstallDependencies(extPath, nodeModulesPath);

    if (needInstall) {
      if (shouldLog(verbose, 1)) console.log(t("install:installingDepsEllipsis"));
      try {
        execSync(`${getPackageManager()} install`, {
          cwd: extPath,
          stdio: verbose ? "inherit" : "pipe",
        });
      } catch {
        if (shouldLog(verbose, 1)) console.warn(t("install:depsInstallFailed"));
        return;
      }
    } else {
      if (shouldLog(verbose, 1)) console.log(t("install:depsUpToDate"));
    }

    // 检查是否需要构建
    const needBuild = await this.needsBuild(extPath);

    if (needBuild) {
      if (shouldLog(verbose, 1)) console.log(t("install:buildingPlugin"));
      try {
        execSync("pnpm build", {
          cwd: extPath,
          stdio: verbose ? "inherit" : "pipe",
        });
      } catch {
        if (shouldLog(verbose, 1)) console.warn(t("install:buildFailed"));
      }
    } else {
      if (shouldLog(verbose, 1)) console.log(t("install:buildUpToDate"));
    }
  }

  /**
   * 检查是否需要安装依赖
   * 比较 package.json 和 node_modules 的修改时间
   */
  protected async needsInstallDependencies(
    extPath: string,
    nodeModulesPath: string,
  ): Promise<boolean> {
    // 如果 node_modules 不存在，需要安装
    if (!existsSync(nodeModulesPath)) {
      return true;
    }

    try {
      const pkgJsonPath = join(extPath, "package.json");
      const lockfilePath = join(extPath, "pnpm-lock.yaml");

      const nodeModulesStat = await stat(nodeModulesPath);
      const pkgJsonStat = await stat(pkgJsonPath);

      // 如果 package.json 比 node_modules 新，需要安装
      if (pkgJsonStat.mtime > nodeModulesStat.mtime) {
        return true;
      }

      // 如果有 lockfile 且比 node_modules 新，需要安装
      if (existsSync(lockfilePath)) {
        const lockfileStat = await stat(lockfilePath);
        if (lockfileStat.mtime > nodeModulesStat.mtime) {
          return true;
        }
      }

      return false;
    } catch {
      return true;
    }
  }

  /**
   * 检查是否需要构建
   * 比较 src 目录和 dist 目录的修改时间
   */
  protected async needsBuild(extPath: string): Promise<boolean> {
    const srcPath = join(extPath, "src");
    const distPath = join(extPath, "dist");
    const distIndexPath = join(distPath, "index.js");

    // 如果没有 src 目录，不需要构建
    if (!existsSync(srcPath)) {
      return false;
    }

    // 如果 dist/index.js 不存在，需要构建
    if (!existsSync(distIndexPath)) {
      return true;
    }

    try {
      const distStat = await stat(distIndexPath);
      const srcMtime = await this.getLatestMtime(srcPath);

      // 如果 src 中有文件比 dist 新，需要构建
      return srcMtime > distStat.mtime;
    } catch {
      return true;
    }
  }

  /**
   * 递归获取目录中最新的修改时间
   */
  protected async getLatestMtime(dirPath: string): Promise<Date> {
    const { readdir } = await import("fs/promises");
    let latestMtime = new Date(0);

    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = join(dirPath, entry.name);

      if (entry.isDirectory()) {
        const subMtime = await this.getLatestMtime(entryPath);
        if (subMtime > latestMtime) {
          latestMtime = subMtime;
        }
      } else {
        const entryStat = await stat(entryPath);
        if (entryStat.mtime > latestMtime) {
          latestMtime = entryStat.mtime;
        }
      }
    }

    return latestMtime;
  }

  /**
   * 生成 JSON Schema
   */
  protected generateSchema(): void {
    this.schemaGenerator.generate();
  }
}
