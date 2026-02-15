import { Injectable } from "@nestjs/common";
import { ConfigReaderService } from "@spaceflow/core";
import { execSync, spawnSync } from "child_process";
import { existsSync, readFileSync } from "fs";
import micromatch from "micromatch";
import { dirname, join } from "path";
import {
  LlmProxyService,
  type LlmMessage,
  LlmJsonPut,
  parallel,
  shouldLog,
  t,
} from "@spaceflow/core";
import {
  CommitScopeConfigSchema,
  formatCommitMessage,
  parseCommitMessage,
  type CommitConfig,
  type CommitGroup,
  type CommitMessage,
  type CommitOptions,
  type CommitResult,
  type CommitScopeConfig,
  type CommitType,
  type PackageInfo,
  type ScopeRule,
  type SplitAnalysis,
} from "./commit.config";

// 重新导出类型，保持向后兼容
export type {
  CommitConfig,
  CommitGroup,
  CommitMessage,
  CommitOptions,
  CommitResult,
  CommitScopeConfig,
  CommitType,
  PackageInfo,
  ScopeRule,
  SplitAnalysis,
};
export { formatCommitMessage, parseCommitMessage };

/**
 * Commit 上下文，包含生成 commit message 所需的所有信息
 */
interface CommitContext {
  files: string[];
  diff: string;
  scope: string;
  packageInfo?: PackageInfo;
}

@Injectable()
export class CommitService {
  constructor(
    private readonly configReader: ConfigReaderService,
    private readonly llmProxyService: LlmProxyService,
  ) {}

  // ============================================================
  // Git 基础操作
  // ============================================================

  /**
   * 执行 git 命令并返回输出
   */
  private execGit(command: string, options?: { maxBuffer?: number }): string {
    return execSync(command, {
      encoding: "utf-8",
      maxBuffer: options?.maxBuffer ?? 1024 * 1024 * 10,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  }

  /**
   * 安全执行 git 命令，失败返回空字符串
   */
  private execGitSafe(command: string, options?: { maxBuffer?: number }): string {
    try {
      return this.execGit(command, options);
    } catch {
      return "";
    }
  }

  /**
   * 获取文件列表（从 git 命令输出解析）
   */
  private parseFileList(output: string): string[] {
    return output
      .split("\n")
      .map((f) => f.trim())
      .filter((f) => f.length > 0);
  }

  // ============================================================
  // 暂存区操作
  // ============================================================

  getStagedFiles(): string[] {
    return this.parseFileList(this.execGitSafe("git diff --cached --name-only"));
  }

  getStagedDiff(): string {
    try {
      return this.execGit("git diff --cached --no-color");
    } catch {
      throw new Error(t("commit:getDiffFailed"));
    }
  }

  hasStagedFiles(): boolean {
    return this.getStagedFiles().length > 0;
  }

  getFileDiff(files: string[]): string {
    if (files.length === 0) return "";
    const fileArgs = files.map((f) => `"${f}"`).join(" ");
    return this.execGitSafe(`git diff --cached --no-color -- ${fileArgs}`);
  }

  // ============================================================
  // 工作区操作
  // ============================================================

  getUnstagedFiles(): string[] {
    return this.parseFileList(this.execGitSafe("git diff --name-only"));
  }

  getUntrackedFiles(): string[] {
    return this.parseFileList(this.execGitSafe("git ls-files --others --exclude-standard"));
  }

  getAllWorkingFiles(): string[] {
    return [...new Set([...this.getUnstagedFiles(), ...this.getUntrackedFiles()])];
  }

  hasWorkingFiles(): boolean {
    return this.getAllWorkingFiles().length > 0;
  }

  getUnstagedFileDiff(files: string[]): string {
    if (files.length === 0) return "";
    const fileArgs = files.map((f) => `"${f}"`).join(" ");
    return this.execGitSafe(`git diff --no-color -- ${fileArgs}`);
  }

  // ============================================================
  // 历史记录
  // ============================================================

  getRecentCommits(count: number = 10): string {
    return this.execGitSafe(`git log --oneline -n ${count} --no-color`);
  }

  // ============================================================
  // 配置获取
  // ============================================================

  getCommitTypes(): CommitType[] {
    const publishConfig = this.configReader.getPluginConfig<CommitConfig>("publish");

    const defaultTypes: CommitType[] = [
      { type: "feat", section: "新特性" },
      { type: "fix", section: "修复BUG" },
      { type: "perf", section: "性能优化" },
      { type: "refactor", section: "代码重构" },
      { type: "docs", section: "文档更新" },
      { type: "style", section: "代码格式" },
      { type: "test", section: "测试用例" },
      { type: "chore", section: "其他修改" },
    ];

    return publishConfig?.changelog?.preset?.type || defaultTypes;
  }

  getScopeConfig(): CommitScopeConfig {
    const commitConfig = this.configReader.getPluginConfig<Record<string, unknown>>("commit");
    return CommitScopeConfigSchema.parse(commitConfig ?? {});
  }

  // ============================================================
  // Package.json 和 Scope 处理
  // ============================================================

  /**
   * 从路径提取 scope（目录名）
   * 根目录返回空字符串
   */
  extractScopeFromPath(packagePath: string): string {
    if (!packagePath || packagePath === process.cwd()) return "";
    const parts = packagePath.split("/").filter(Boolean);
    return parts[parts.length - 1] || "";
  }

  /**
   * 查找文件所属的 package.json
   */
  findPackageForFile(file: string): PackageInfo {
    const cwd = process.cwd();
    let dir = dirname(join(cwd, file));

    while (dir !== dirname(dir)) {
      const pkgPath = join(dir, "package.json");
      if (existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
          return {
            name: pkg.name || "root",
            description: pkg.description,
            path: dir,
          };
        } catch {
          // 解析失败，继续向上
        }
      }
      dir = dirname(dir);
    }

    // 回退到根目录
    return this.getRootPackageInfo();
  }

  /**
   * 获取根目录的 package.json 信息
   */
  private getRootPackageInfo(): PackageInfo {
    const cwd = process.cwd();
    const pkgPath = join(cwd, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        return { name: pkg.name || "root", description: pkg.description, path: cwd };
      } catch {
        // ignore
      }
    }
    return { name: "root", path: cwd };
  }

  /**
   * 按 package.json 对文件分组
   */
  groupFilesByPackage(files: string[]): Map<string, { files: string[]; packageInfo: PackageInfo }> {
    const groups = new Map<string, { files: string[]; packageInfo: PackageInfo }>();

    for (const file of files) {
      const pkgInfo = this.findPackageForFile(file);
      const key = pkgInfo.path;

      if (!groups.has(key)) {
        groups.set(key, { files: [], packageInfo: pkgInfo });
      }
      groups.get(key)!.files.push(file);
    }

    return groups;
  }

  /**
   * 根据自定义规则匹配文件的 scope
   */
  matchFileToScope(file: string, rules: ScopeRule[]): string | null {
    for (const rule of rules) {
      if (micromatch.isMatch(file, rule.pattern)) {
        return rule.scope;
      }
    }
    return null;
  }

  /**
   * 根据配置策略对文件分组
   */
  groupFiles(
    files: string[],
  ): Map<string, { files: string[]; scope: string; packageInfo?: PackageInfo }> {
    const config = this.getScopeConfig();
    const groups = new Map<string, { files: string[]; scope: string; packageInfo?: PackageInfo }>();

    for (const file of files) {
      let scope: string | null = null;
      let packageInfo: PackageInfo | undefined;

      // 规则匹配
      if (config.strategy === "rules" || config.strategy === "rules-first") {
        scope = this.matchFileToScope(file, config.rules || []);
      }

      // 包目录匹配
      if (scope === null && (config.strategy === "package" || config.strategy === "rules-first")) {
        packageInfo = this.findPackageForFile(file);
        scope = this.extractScopeFromPath(packageInfo.path);
      }

      const finalScope = scope || "";
      if (!groups.has(finalScope)) {
        groups.set(finalScope, { files: [], scope: finalScope, packageInfo });
      }
      groups.get(finalScope)!.files.push(file);
    }

    return groups;
  }

  // ============================================================
  // Commit 上下文获取
  // ============================================================

  /**
   * 获取 commit 上下文（统一获取 files, diff, scope, packageInfo）
   */
  getCommitContext(files: string[], useUnstaged = false): CommitContext {
    const diff = useUnstaged ? this.getUnstagedFileDiff(files) : this.getFileDiff(files);
    const packageGroups = this.groupFilesByPackage(files);
    const firstGroup = [...packageGroups.values()][0];
    const packageInfo = firstGroup?.packageInfo;
    const scope = packageInfo ? this.extractScopeFromPath(packageInfo.path) : "";

    return { files, diff, scope, packageInfo };
  }

  // ============================================================
  // Prompt 构建
  // ============================================================

  /**
   * 构建 commit message 生成的 prompt
   */
  private buildCommitPrompt(ctx: CommitContext): { system: string; user: string } {
    const commitTypes = this.getCommitTypes();
    const typesList = commitTypes.map((t) => `- ${t.type}: ${t.section}`).join("\n");
    const recentCommits = this.getRecentCommits();

    const packageContext = ctx.packageInfo
      ? `\n## 包信息\n- 包名: ${ctx.packageInfo.name}\n- scope: ${ctx.scope || "无（根目录）"}${ctx.packageInfo.description ? `\n- 描述: ${ctx.packageInfo.description}` : ""}`
      : "";

    const system = `你是一个专业的 Git commit message 生成器。请根据提供的代码变更生成符合 Conventional Commits 规范的 commit message。

## Commit 类型规范
${typesList}

## 输出格式
请严格按照以下 JSON 格式输出，不要包含任何其他内容：
{
  "type": "feat",
  "scope": "${ctx.scope}",
  "subject": "简短描述（不超过50字符，中文）",
  "body": "详细描述（可选，中文）"
}

## 规则
1. type 必须是上述类型之一
2. scope ${ctx.scope ? `必须使用 "${ctx.scope}"` : "必须为空字符串（根目录不需要 scope）"}
3. subject 是简短描述，不超过 50 个字符，使用中文
4. body 是详细描述，可选，使用中文，如果没有则设为空字符串
5. 如果变更涉及多个方面，选择最主要的类型`;

    const truncatedDiff =
      ctx.diff.length > 8000 ? ctx.diff.substring(0, 8000) + "\n... (diff 过长，已截断)" : ctx.diff;

    const user = `请根据以下信息生成 commit message：
${packageContext}
## 暂存的文件
${ctx.files.join("\n")}

## 最近的 commit 历史（参考风格）
${recentCommits || "无历史记录"}

## 代码变更 (diff)
\`\`\`diff
${truncatedDiff}
\`\`\`

请直接输出 JSON 格式的 commit message。`;

    return { system, user };
  }

  // ============================================================
  // AI 响应解析
  // ============================================================

  /**
   * 解析 AI 响应为结构化 CommitMessage
   */
  private async parseAIResponse(content: string, expectedScope: string): Promise<CommitMessage> {
    const jsonPut = new LlmJsonPut<{
      type: string;
      scope?: string;
      subject: string;
      body?: string;
    }>({
      type: "object",
      properties: {
        type: { type: "string", description: "commit 类型" },
        scope: { type: "string", description: "影响范围" },
        subject: { type: "string", description: "简短描述" },
        body: { type: "string", description: "详细描述" },
      },
      required: ["type", "subject"],
    });

    try {
      const parsed = await jsonPut.parse(content, { disableRequestRetry: true });
      return this.normalizeScope(
        {
          type: parsed.type || "chore",
          subject: parsed.subject || "",
          scope: parsed.scope || undefined,
          body: parsed.body || undefined,
        },
        expectedScope,
      );
    } catch {
      return this.normalizeScope(parseCommitMessage(content), expectedScope);
    }
  }

  /**
   * 规范化 scope（强制使用预期值或移除）
   */
  private normalizeScope(commit: CommitMessage, expectedScope: string): CommitMessage {
    return expectedScope ? { ...commit, scope: expectedScope } : { ...commit, scope: undefined };
  }

  // ============================================================
  // Commit Message 生成
  // ============================================================

  /**
   * 生成 commit message（核心方法）
   */
  async generateCommitMessage(
    options?: CommitOptions & { files?: string[]; useUnstaged?: boolean },
  ): Promise<CommitMessage> {
    // 获取文件列表
    const files = options?.files ?? this.getStagedFiles();
    if (files.length === 0) {
      throw new Error(t("commit:noFilesToCommit"));
    }

    // 获取上下文
    const ctx = this.getCommitContext(files, options?.useUnstaged);
    if (!ctx.diff) {
      throw new Error(t("commit:noChanges"));
    }

    // 构建 prompt
    const prompt = this.buildCommitPrompt(ctx);
    const messages: LlmMessage[] = [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ];

    if (shouldLog(options?.verbose, 1)) {
      console.log(t("commit:generatingMessage"));
    }

    // 调用 AI
    const response = await this.llmProxyService.chat(messages, {
      verbose: options?.verbose,
    });

    // 解析响应并填充上下文
    const commit = await this.parseAIResponse(response.content, ctx.scope);
    return {
      ...commit,
      files: ctx.files,
      packageInfo: ctx.packageInfo,
    };
  }

  /**
   * 为指定文件生成 commit message（兼容旧 API）
   */
  async generateCommitMessageForFiles(
    files: string[],
    options?: CommitOptions,
    useUnstaged = false,
    _packageInfo?: { name: string; description?: string },
  ): Promise<CommitMessage> {
    return this.generateCommitMessage({ ...options, files, useUnstaged });
  }

  // ============================================================
  // 拆分分析
  // ============================================================

  /**
   * 分析如何拆分 commit
   */
  async analyzeSplitStrategy(options?: CommitOptions, useUnstaged = false): Promise<SplitAnalysis> {
    const files = useUnstaged ? this.getUnstagedFiles() : this.getStagedFiles();
    const config = this.getScopeConfig();

    if (shouldLog(options?.verbose, 1)) {
      const strategyName =
        config.strategy === "rules"
          ? t("commit:strategyRules")
          : config.strategy === "rules-first"
            ? t("commit:strategyRulesFirst")
            : t("commit:strategyPackage");
      console.log(t("commit:groupingByStrategy", { strategy: strategyName }));
    }

    const scopeGroups = this.groupFiles(files);

    // 单个组：让 AI 进一步分析
    if (scopeGroups.size === 1) {
      const [, groupData] = [...scopeGroups.entries()][0];
      const packageInfo = groupData.packageInfo || {
        name: groupData.scope || "root",
        path: process.cwd(),
      };
      return this.analyzeWithinPackage(groupData.files, packageInfo, options, useUnstaged);
    }

    // 多个组：每个组作为独立 commit
    if (shouldLog(options?.verbose, 1)) {
      console.log(t("commit:detectedGroups", { count: scopeGroups.size }));
    }

    const groups: CommitGroup[] = [];
    for (const [, groupData] of scopeGroups) {
      groups.push({
        files: groupData.files,
        reason: groupData.scope
          ? t("commit:scopeChanges", { scope: groupData.scope })
          : t("commit:rootChanges"),
        packageInfo: groupData.packageInfo
          ? { name: groupData.packageInfo.name, description: groupData.packageInfo.description }
          : undefined,
      });
    }

    return { groups };
  }

  /**
   * 在单个包内分析拆分策略
   */
  private async analyzeWithinPackage(
    files: string[],
    packageInfo: PackageInfo,
    options?: CommitOptions,
    useUnstaged = false,
  ): Promise<SplitAnalysis> {
    const diff = useUnstaged ? this.getUnstagedFileDiff(files) : this.getFileDiff(files);
    const scope = this.extractScopeFromPath(packageInfo.path);
    const commitTypes = this.getCommitTypes();
    const typesList = commitTypes.map((t) => `- ${t.type}: ${t.section}`).join("\n");

    const systemPrompt = `你是一个专业的 Git commit 拆分分析器。请根据暂存的文件和代码变更，分析如何将这些变更拆分为多个独立的 commit。

## 当前包信息
- 包名: ${packageInfo.name}
- scope: ${scope || "无"}
${packageInfo.description ? `- 描述: ${packageInfo.description}` : ""}

## Commit 类型规范
${typesList}

## 拆分原则
1. **按逻辑拆分**：相关的功能变更放在一起
2. **按业务拆分**：不同业务模块的变更分开
3. **保持原子性**：每个 commit 是完整的、可独立理解的变更
4. **最小化拆分**：如果变更本身是整体，不要强行拆分

## 输出格式
请严格按照以下 JSON 格式输出：
{
  "groups": [
    { "files": ["file1.ts", "file2.ts"], "reason": "简短描述" }
  ]
}`;

    const truncatedDiff =
      diff.length > 12000 ? diff.substring(0, 12000) + "\n... (diff 过长，已截断)" : diff;

    const userPrompt = `请分析以下改动文件，决定如何拆分 commit：

## 改动的文件
${files.join("\n")}

## 代码变更 (diff)
\`\`\`diff
${truncatedDiff}
\`\`\`

请输出 JSON 格式的拆分策略。`;

    if (shouldLog(options?.verbose, 1)) {
      console.log(t("commit:analyzingSplit"));
    }

    const response = await this.llmProxyService.chat(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      { verbose: options?.verbose },
    );

    return this.parseSplitAnalysis(response.content, files, packageInfo);
  }

  /**
   * 解析拆分分析结果
   */
  private parseSplitAnalysis(
    content: string,
    files: string[],
    packageInfo: PackageInfo,
  ): SplitAnalysis {
    let text = content
      .trim()
      .replace(/^```[\w]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    try {
      const analysis = JSON.parse(text) as SplitAnalysis;

      if (!analysis.groups || !Array.isArray(analysis.groups)) {
        throw new Error("Invalid response");
      }

      const validFiles = new Set(files);

      // 过滤无效文件，移除空组
      for (const group of analysis.groups) {
        group.files = (group.files || []).filter((f) => validFiles.has(f));
      }
      analysis.groups = analysis.groups.filter((g) => g.files.length > 0);

      // 补充未分配的文件
      const assignedFiles = new Set(analysis.groups.flatMap((g) => g.files));
      const missingFiles = files.filter((f) => !assignedFiles.has(f));
      if (missingFiles.length > 0) {
        if (analysis.groups.length > 0) {
          analysis.groups[analysis.groups.length - 1].files.push(...missingFiles);
        } else {
          analysis.groups.push({ files: missingFiles, reason: t("commit:otherChanges") });
        }
      }

      // 添加 packageInfo
      for (const group of analysis.groups) {
        group.packageInfo = { name: packageInfo.name, description: packageInfo.description };
      }

      return analysis;
    } catch {
      return {
        groups: [
          {
            files,
            reason: t("commit:allChanges"),
            packageInfo: { name: packageInfo.name, description: packageInfo.description },
          },
        ],
      };
    }
  }

  // ============================================================
  // Commit 执行
  // ============================================================

  /**
   * 执行 git commit
   */
  async commit(message: string, options?: CommitOptions): Promise<CommitResult> {
    if (options?.dryRun) {
      return { success: true, message: t("commit:dryRunMessage", { message }) };
    }

    try {
      const args = ["commit", "-m", message];
      if (options?.noVerify) args.push("--no-verify");

      const result = spawnSync("git", args, { encoding: "utf-8", stdio: "pipe" });

      if (result.status !== 0) {
        return { success: false, error: result.stderr || result.stdout || t("commit:commitFail") };
      }
      return { success: true, message: result.stdout };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * 暂存文件
   */
  private stageFiles(files: string[]): { success: boolean; error?: string } {
    const result = spawnSync("git", ["add", ...files], { encoding: "utf-8", stdio: "pipe" });
    if (result.status !== 0) {
      return { success: false, error: t("commit:stageFilesFailed", { error: result.stderr }) };
    }
    return { success: true };
  }

  /**
   * 重置暂存区
   */
  private resetStaging(): boolean {
    try {
      execSync("git reset HEAD", { encoding: "utf-8", stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  // ============================================================
  // 批量提交
  // ============================================================

  /**
   * 排序 groups：子包优先，根目录最后
   */
  private sortGroupsForCommit(groups: CommitGroup[]): CommitGroup[] {
    return [...groups].sort((a, b) => {
      const aScope = this.getGroupScope(a);
      const bScope = this.getGroupScope(b);
      if (!aScope && bScope) return 1;
      if (aScope && !bScope) return -1;
      return 0;
    });
  }

  private getGroupScope(group: CommitGroup): string {
    if (!group.packageInfo) return "";
    const pkgGroups = this.groupFilesByPackage(group.files);
    const first = [...pkgGroups.values()][0];
    return first ? this.extractScopeFromPath(first.packageInfo.path) : "";
  }

  /**
   * 分批提交
   */
  async commitInBatches(options?: CommitOptions, useWorking = false): Promise<CommitResult> {
    const files = useWorking ? this.getAllWorkingFiles() : this.getStagedFiles();

    if (files.length === 0) {
      return {
        success: false,
        error: useWorking ? t("commit:noWorkingChanges") : t("commit:noStagedFiles"),
      };
    }

    const analysis = await this.analyzeSplitStrategy(options, useWorking);
    const sortedGroups = this.sortGroupsForCommit(analysis.groups);

    // 单个组：简化处理
    if (sortedGroups.length <= 1) {
      const group = sortedGroups[0];
      if (shouldLog(options?.verbose, 1)) {
        console.log(t("commit:singleCommit"));
      }

      if (useWorking) {
        const stageResult = this.stageFiles(files);
        if (!stageResult.success) return { success: false, error: stageResult.error };
      }

      const commitObj = await this.generateCommitMessage({ ...options, files });
      const message = formatCommitMessage(commitObj);

      if (shouldLog(options?.verbose, 1)) {
        console.log(t("commit:generatedMessage"));
        console.log("─".repeat(50));
        console.log(message);
        console.log("─".repeat(50));
      }

      return this.commit(message, options);
    }

    // 多个组：并行生成 message，顺序提交
    if (shouldLog(options?.verbose, 1)) {
      console.log(t("commit:splitIntoCommits", { count: sortedGroups.length }));
      sortedGroups.forEach((g, i) => {
        const pkgStr = g.packageInfo ? ` [${g.packageInfo.name}]` : "";
        console.log(
          t("commit:groupItem", {
            index: i + 1,
            reason: g.reason,
            pkg: pkgStr,
            count: g.files.length,
          }),
        );
      });
      console.log(t("commit:parallelGenerating", { count: sortedGroups.length }));
    }

    // 并行生成 messages
    const executor = parallel({ concurrency: 5 });
    const messageResults = await executor.map(
      sortedGroups,
      async (group: CommitGroup) =>
        this.generateCommitMessage({ ...options, files: group.files, useUnstaged: useWorking }),
      (group: CommitGroup) => group.files[0] || "unknown",
    );

    const failedResults = messageResults.filter((r) => !r.success);
    if (failedResults.length > 0) {
      return {
        success: false,
        error: t("commit:generateMessageFailed", {
          errors: failedResults.map((r) => r.error?.message).join(", "),
        }),
      };
    }

    const generatedMessages = messageResults.map((r) => r.result!);

    if (shouldLog(options?.verbose, 1)) {
      console.log(t("commit:allMessagesGenerated"));
    }

    // Dry run 模式
    if (options?.dryRun) {
      const preview = sortedGroups
        .map((g, i) => {
          const pkgStr = g.packageInfo ? `\n包: ${g.packageInfo.name}` : "";
          return `[Commit ${i + 1}/${sortedGroups.length}] ${g.reason}${pkgStr}\n文件: ${g.files.join(", ")}\n\n${formatCommitMessage(generatedMessages[i])}`;
        })
        .join("\n\n" + "═".repeat(50) + "\n\n");
      return { success: true, message: preview, commitCount: sortedGroups.length };
    }

    // 实际提交
    if (this.hasStagedFiles() && !this.resetStaging()) {
      return { success: false, error: t("commit:resetStagingFailed") };
    }

    const committedMessages: string[] = [];
    let successCount = 0;

    for (let i = 0; i < sortedGroups.length; i++) {
      const group = sortedGroups[i];
      const commitObj = generatedMessages[i];
      const messageStr = formatCommitMessage(commitObj);

      if (shouldLog(options?.verbose, 1)) {
        const pkgStr = group.packageInfo ? ` [${group.packageInfo.name}]` : "";
        console.log(
          t("commit:committingGroup", {
            current: i + 1,
            total: sortedGroups.length,
            reason: group.reason,
            pkg: pkgStr,
          }),
        );
      }

      try {
        const stageResult = this.stageFiles(group.files);
        if (!stageResult.success) throw new Error(stageResult.error);

        const diff = this.getFileDiff(group.files);
        if (!diff) {
          if (shouldLog(options?.verbose, 1)) console.log(t("commit:skippingNoChanges"));
          continue;
        }

        if (shouldLog(options?.verbose, 1)) {
          console.log(t("commit:commitMessage"));
          console.log("─".repeat(50));
          console.log(messageStr);
          console.log("─".repeat(50));
        }

        const commitResult = await this.commit(messageStr, options);
        if (!commitResult.success) throw new Error(commitResult.error);

        successCount++;
        const shortMsg = formatCommitMessage({ ...commitObj, body: undefined });
        committedMessages.push(`✅ Commit ${i + 1}: ${shortMsg}`);
        console.log(committedMessages[committedMessages.length - 1]);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        committedMessages.push(t("commit:commitItemFailed", { index: i + 1, error: errorMsg }));

        // 恢复剩余文件
        const remaining = sortedGroups.slice(i).flatMap((g) => g.files);
        if (remaining.length > 0) this.stageFiles(remaining);

        return {
          success: false,
          error: t("commit:commitItemFailedDetail", {
            index: i + 1,
            error: errorMsg,
            committed: committedMessages.join("\n"),
          }),
          commitCount: successCount,
        };
      }
    }

    return { success: true, message: committedMessages.join("\n"), commitCount: successCount };
  }

  // ============================================================
  // 主入口
  // ============================================================

  /**
   * 生成并提交（主入口）
   */
  async generateAndCommit(options?: CommitOptions): Promise<CommitResult> {
    // Split 模式
    if (options?.split) {
      const hasWorking = this.hasWorkingFiles();
      const hasStaged = this.hasStagedFiles();

      if (!hasWorking && !hasStaged) {
        return { success: false, error: t("commit:noChangesAll") };
      }

      return this.commitInBatches(options, hasWorking);
    }

    // 普通模式
    if (!this.hasStagedFiles()) {
      return { success: false, error: t("commit:noStagedFilesHint") };
    }

    try {
      const commitObj = await this.generateCommitMessage(options);
      const message = formatCommitMessage(commitObj);

      if (shouldLog(options?.verbose, 1)) {
        console.log(t("commit:generatedMessage"));
        console.log("─".repeat(50));
        console.log(message);
        console.log("─".repeat(50));
      }

      return this.commit(message, options);
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
