import {
  type ChangedFile,
  type VerboseLevel,
  shouldLog,
  GitProviderService,
  parseRepoUrl,
  type RemoteRepoRef,
  type RepositoryContent,
} from "@spaceflow/core";
import { readdir, readFile, mkdir, access, writeFile } from "fs/promises";
import { join, basename, extname } from "path";
import { homedir } from "os";
import { execSync } from "child_process";
import micromatch from "micromatch";
import { ReviewSpec, ReviewRule, RuleExample, Severity } from "./types";
import { extractGlobsFromIncludes } from "../review-includes-filter";

/** 远程规则缓存 TTL（毫秒），默认 5 分钟 */
const REMOTE_SPEC_CACHE_TTL = 5 * 60 * 1000;

export class ReviewSpecService {
  constructor(protected readonly gitProvider?: GitProviderService) {}
  /**
   * 检查规则 ID 是否匹配（精确匹配或前缀匹配）
   * 例如: "JsTs.FileName" 匹配 "JsTs.FileName" 和 "JsTs.FileName.UpperCamel"
   */
  protected matchRuleId(ruleId: string, pattern: string): boolean {
    if (!ruleId || !pattern) {
      console.warn(
        `matchRuleId: 参数为空 (ruleId=${JSON.stringify(ruleId)}, pattern=${JSON.stringify(pattern)})`,
      );
      return false;
    }
    return ruleId === pattern || ruleId.startsWith(pattern + ".");
  }

  /**
   * 从 Map 中查找匹配的规则值（精确匹配优先，然后前缀匹配）
   */
  protected findByRuleId<T>(ruleId: string, map: Map<string, T>): T | undefined {
    if (!ruleId) {
      console.warn(`findByRuleId: ruleId 为空 (ruleId=${JSON.stringify(ruleId)})`);
      return undefined;
    }
    // 精确匹配
    if (map.has(ruleId)) {
      return map.get(ruleId);
    }
    // 前缀匹配
    for (const [key, value] of map) {
      if (ruleId.startsWith(key + ".")) {
        return value;
      }
    }
    return undefined;
  }
  /**
   * 根据变更文件的扩展名过滤适用的规则文件
   * 只按扩展名过滤，includes 和 override 在 LLM 审查后处理
   */
  filterApplicableSpecs(specs: ReviewSpec[], changedFiles: { filename?: string }[]): ReviewSpec[] {
    const changedExtensions = new Set<string>();

    for (const file of changedFiles) {
      if (file.filename) {
        const ext = extname(file.filename).slice(1).toLowerCase();
        if (ext) {
          changedExtensions.add(ext);
        }
      }
    }

    return specs.filter((spec) => spec.extensions.some((ext) => changedExtensions.has(ext)));
  }

  async loadReviewSpecs(specDir: string): Promise<ReviewSpec[]> {
    const specs: ReviewSpec[] = [];

    try {
      const files = await readdir(specDir);

      for (const file of files) {
        if (!file.endsWith(".md")) continue;

        const content = await readFile(join(specDir, file), "utf-8");
        const spec = this.parseSpecFile(file, content);
        if (spec) {
          specs.push(spec);
        }
      }
    } catch (error) {
      // 目录不存在时静默跳过（这些是可选的配置目录）
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`警告: 无法读取规则目录 ${specDir}:`, error);
      }
    }

    return specs;
  }

  async resolveSpecSources(sources: string[]): Promise<string[]> {
    const dirs: string[] = [];

    for (const source of sources) {
      // 优先尝试解析为远程仓库 URL（浏览器复制的链接）
      const repoRef = parseRepoUrl(source);
      if (repoRef && this.gitProvider) {
        const dir = await this.fetchRemoteSpecs(repoRef);
        if (dir) {
          dirs.push(dir);
          continue;
        }
      }
      if (this.isRepoUrl(source)) {
        const dir = await this.cloneSpecRepo(source);
        if (dir) {
          dirs.push(dir);
        }
      } else {
        // 检查是否是 deps 目录，如果是则扫描子目录的 references
        const resolvedDirs = await this.resolveDepsDir(source);
        dirs.push(...resolvedDirs);
      }
    }

    return dirs;
  }

  /**
   * 通过 Git API 从远程仓库拉取规则文件
   * 缓存到 ~/.spaceflow/review-spec-cache/ 目录，带 TTL
   */
  protected async fetchRemoteSpecs(ref: RemoteRepoRef): Promise<string | null> {
    const cacheKey = `${ref.owner}__${ref.repo}${ref.path ? `__${ref.path.replace(/\//g, "_")}` : ""}${ref.ref ? `@${ref.ref}` : ""}`;
    const cacheDir = join(homedir(), ".spaceflow", "review-spec-cache", cacheKey);
    // 检查缓存是否有效（非 CI 环境下使用 TTL）
    const isCI = !!process.env.CI;
    if (!isCI) {
      try {
        const timestampFile = join(cacheDir, ".timestamp");
        const timestamp = await readFile(timestampFile, "utf-8");
        const age = Date.now() - Number(timestamp);
        if (age < REMOTE_SPEC_CACHE_TTL) {
          const entries = await readdir(cacheDir);
          if (entries.some((f) => f.endsWith(".md"))) {
            return cacheDir;
          }
        }
      } catch {
        // 缓存不存在或无效，继续拉取
      }
    }
    try {
      console.log(
        `   📡 从远程仓库拉取规则: ${ref.owner}/${ref.repo}${ref.path ? `/${ref.path}` : ""}${ref.ref ? `@${ref.ref}` : ""}`,
      );
      const contents = await this.gitProvider!.listRepositoryContents(
        ref.owner,
        ref.repo,
        ref.path || undefined,
        ref.ref,
      );
      const mdFiles = contents.filter(
        (f: RepositoryContent) => f.type === "file" && f.name.endsWith(".md"),
      );
      if (mdFiles.length === 0) {
        console.warn(`   ⚠️ 远程目录中未找到 .md 规则文件`);
        return null;
      }
      await mkdir(cacheDir, { recursive: true });
      for (const file of mdFiles) {
        const content = await this.gitProvider!.getFileContent(
          ref.owner,
          ref.repo,
          file.path,
          ref.ref,
        );
        await writeFile(join(cacheDir, file.name), content, "utf-8");
      }
      // 写入时间戳
      await writeFile(join(cacheDir, ".timestamp"), String(Date.now()), "utf-8");
      console.log(`   ✅ 已拉取 ${mdFiles.length} 个规则文件到缓存`);
      return cacheDir;
    } catch (error) {
      console.warn(`   ⚠️ 远程规则拉取失败:`, error instanceof Error ? error.message : error);
      // 尝试使用过期缓存
      try {
        const entries = await readdir(cacheDir);
        if (entries.some((f) => f.endsWith(".md"))) {
          console.log(`   📦 使用过期缓存`);
          return cacheDir;
        }
      } catch {
        // 无缓存可用
      }
      return null;
    }
  }

  /**
   * 解析 deps 目录，扫描子目录中的 references 文件夹
   * 如果目录本身包含 .md 文件则直接返回，否则扫描子目录
   */
  protected async resolveDepsDir(dir: string): Promise<string[]> {
    const dirs: string[] = [];

    try {
      const entries = await readdir(dir, { withFileTypes: true });

      // 检查目录本身是否包含 .md 文件
      const hasMdFiles = entries.some((e) => e.isFile() && e.name.endsWith(".md"));
      if (hasMdFiles) {
        dirs.push(dir);
        return dirs;
      }

      // 扫描子目录
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const subDir = join(dir, entry.name);
          // 优先检查 references 子目录
          const referencesDir = join(subDir, "references");
          try {
            await access(referencesDir);
            dirs.push(referencesDir);
          } catch {
            // 没有 references 子目录，检查子目录本身是否有 .md 文件
            try {
              const subEntries = await readdir(subDir);
              if (subEntries.some((f) => f.endsWith(".md"))) {
                dirs.push(subDir);
              }
            } catch {
              // 忽略无法读取的子目录
            }
          }
        }
      }
    } catch {
      // 目录不存在时静默跳过
    }

    return dirs;
  }

  protected isRepoUrl(source: string): boolean {
    return (
      source.startsWith("http://") ||
      source.startsWith("https://") ||
      source.startsWith("git@") ||
      source.includes("://")
    );
  }

  protected async cloneSpecRepo(repoUrl: string): Promise<string | null> {
    const repoName = this.extractRepoName(repoUrl);
    if (!repoName) {
      console.warn(`警告: 无法解析仓库名称: ${repoUrl}`);
      return null;
    }

    const cacheDir = join(homedir(), ".spaceflow", "review-spec", repoName);

    try {
      await access(cacheDir);
      // console.log(`   使用缓存的规则仓库: ${cacheDir}`);
      try {
        execSync("git pull --ff-only", { cwd: cacheDir, stdio: "pipe" });
        // console.log(`   已更新规则仓库`);
      } catch {
        console.warn(`   警告: 无法更新规则仓库，使用现有版本`);
      }
      return cacheDir;
    } catch {
      // console.log(`   克隆规则仓库: ${repoUrl}`);
      try {
        await mkdir(join(homedir(), ".spaceflow", "review-spec"), { recursive: true });
        execSync(`git clone --depth 1 "${repoUrl}" "${cacheDir}"`, { stdio: "pipe" });
        // console.log(`   克隆完成: ${cacheDir}`);
        return cacheDir;
      } catch (error) {
        console.warn(`警告: 无法克隆仓库 ${repoUrl}:`, error);
        return null;
      }
    }
  }

  protected extractRepoName(repoUrl: string): string | null {
    let path = repoUrl;
    path = path.replace(/\.git$/, "");
    path = path.replace(/^git@[^:]+:/, "");
    path = path.replace(/^https?:\/\/[^/]+\//, "");

    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[parts.length - 2]}__${parts[parts.length - 1]}`;
    } else if (parts.length === 1) {
      return parts[0];
    }
    return null;
  }

  parseSpecFile(filename: string, content: string): ReviewSpec | null {
    const nameWithoutExt = basename(filename, ".md");
    const parts = nameWithoutExt.split(".");

    if (parts.length < 2) {
      console.warn(`警告: 规则文件名格式不正确: ${filename}`);
      return null;
    }

    const extensionsPart = parts[0];
    const type = parts.slice(1).join(".");
    const extensions = extensionsPart.split("&").map((ext) => ext.toLowerCase());

    const rules = this.extractRules(content);

    // 文件级别的 override 来自第一个规则（标题规则）的 overrides
    const fileOverrides = rules.length > 0 ? rules[0].overrides : [];
    // 文件级别的 severity 来自第一个规则（标题规则）的 severity，默认为 error
    const fileSeverity = (rules.length > 0 ? rules[0].severity : undefined) || "error";
    // 文件级别的 includes 从内容中提取
    const fileIncludes = this.extractIncludes(content);

    return {
      filename,
      extensions,
      type,
      content,
      rules,
      overrides: fileOverrides,
      severity: fileSeverity,
      includes: fileIncludes,
    };
  }

  protected extractRules(content: string): ReviewRule[] {
    const rules: ReviewRule[] = [];
    const ruleRegex = /^(#{1,3})\s+(.+?)\s+`\[([^\]]+)\]`/gm;

    const matches: { index: number; length: number; title: string; id: string }[] = [];
    let match;
    while ((match = ruleRegex.exec(content)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        title: match[2].trim(),
        id: match[3],
      });
    }

    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const startIndex = current.index + current.length;
      const endIndex = i + 1 < matches.length ? matches[i + 1].index : content.length;

      const ruleContent = content.slice(startIndex, endIndex).trim();
      const examples = this.extractExamples(ruleContent);
      const overrides = this.extractOverrides(ruleContent);

      // 提取描述：在第一个例子之前的文本
      let description = ruleContent;
      const firstExampleIndex = ruleContent.search(/(?:^|\n)###\s+(?:good|bad)/i);
      if (firstExampleIndex !== -1) {
        description = ruleContent.slice(0, firstExampleIndex).trim();
      } else {
        // 如果没有例子，则整个 ruleContent 都是描述
        description = ruleContent;
      }

      const severity = this.extractSeverity(ruleContent);
      const includes = this.extractConfigValues(ruleContent, "includes");

      rules.push({
        id: current.id,
        title: current.title,
        description,
        examples,
        overrides,
        severity,
        includes: includes.length > 0 ? includes : undefined,
      });
    }

    return rules;
  }

  /**
   * 通用配置解析方法
   * 格式: > - <configName> `value1` `value2` ...
   * 同名配置项后面的覆盖前面的
   */
  protected extractConfigValues(content: string, configName: string): string[] {
    const configRegex = new RegExp(`^>\\s*-\\s*${configName}\\s+(.+)$`, "gm");
    let values: string[] = [];
    let match;

    while ((match = configRegex.exec(content)) !== null) {
      const valuesStr = match[1];
      const valueRegex = /`([^`]+)`/g;
      let valueMatch;
      const lineValues: string[] = [];
      while ((valueMatch = valueRegex.exec(valuesStr)) !== null) {
        lineValues.push(valueMatch[1]);
      }
      // 同名配置项覆盖
      values = lineValues;
    }

    return values;
  }

  protected extractOverrides(content: string): string[] {
    // override 的值格式是 `[RuleId]`，需要去掉方括号
    return this.extractConfigValues(content, "override").map((v) =>
      v.startsWith("[") && v.endsWith("]") ? v.slice(1, -1) : v,
    );
  }

  protected extractSeverity(content: string): Severity | undefined {
    const values = this.extractConfigValues(content, "severity");
    if (values.length > 0) {
      const value = values[values.length - 1];
      if (value === "off" || value === "warn" || value === "error") {
        return value;
      }
    }
    return undefined;
  }

  protected extractIncludes(content: string): string[] {
    // 只提取文件开头（第一个 ## 规则标题之前）的 includes 配置
    // 避免规则级的 includes 覆盖文件级的 includes
    const firstRuleIndex = content.indexOf("\n## ");
    const headerContent = firstRuleIndex > 0 ? content.slice(0, firstRuleIndex) : content;
    return this.extractConfigValues(headerContent, "includes");
  }

  protected extractExamples(content: string): RuleExample[] {
    const examples: RuleExample[] = [];
    const sections = content.split(/(?:^|\n)###\s+/);

    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;

      let type: "good" | "bad" | null = null;
      if (/^good\b/i.test(trimmedSection)) {
        type = "good";
      } else if (/^bad\b/i.test(trimmedSection)) {
        type = "bad";
      }

      if (!type) continue;

      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      let codeMatch;
      while ((codeMatch = codeBlockRegex.exec(trimmedSection)) !== null) {
        const lang = codeMatch[1] || "text";
        const code = codeMatch[2].trim();
        examples.push({ lang, code, type });
      }
    }

    return examples;
  }

  /**
   * 收集所有 override 声明并排除被覆盖的规则
   * override 使用前缀匹配：如果规则 ID 以 override 值开头，则被排除
   */
  applyOverrides(specs: ReviewSpec[], verbose?: VerboseLevel): ReviewSpec[] {
    // 收集所有 override 声明（文件级别 + 规则级别）
    const allOverrides: string[] = [];
    for (const spec of specs) {
      allOverrides.push(...spec.overrides);
      for (const rule of spec.rules) {
        allOverrides.push(...rule.overrides);
      }
    }

    if (allOverrides.length === 0) {
      return specs;
    }

    // 过滤规则：排除 ID 以任意 override 值开头的规则
    return specs
      .map((spec) => ({
        ...spec,
        rules: spec.rules.filter((rule) => {
          const isOverridden = allOverrides.some((override) => this.matchRuleId(rule.id, override));
          if (isOverridden && shouldLog(verbose, 2)) {
            console.error(`   规则 [${rule.id}] 被 override 排除`);
          }
          return !isOverridden;
        }),
      }))
      .filter((spec) => spec.rules.length > 0);
  }

  /**
   * 根据 spec 的 includes 配置过滤 issues
   * 只保留文件名匹配对应 spec includes 模式的 issues
   * 如果 spec 没有 includes 配置，则保留该 spec 的所有 issues
   */
  filterIssuesByIncludes<T extends { file: string; ruleId: string }>(
    issues: T[],
    specs: ReviewSpec[],
  ): T[] {
    // 构建 spec filename -> includes 的映射
    const specIncludesMap = new Map<string, string[]>();
    for (const spec of specs) {
      // 从规则 ID 前缀推断 spec filename
      for (const rule of spec.rules) {
        specIncludesMap.set(rule.id, spec.includes);
      }
    }

    return issues.filter((issue) => {
      // 找到该 issue 对应的 spec includes
      const includes = this.findByRuleId(issue.ruleId, specIncludesMap) ?? [];

      // 如果没有 includes 配置，保留该 issue
      if (includes.length === 0) {
        return true;
      }

      // 检查文件是否匹配 includes 模式（转换为纯 glob，避免 status| 前缀和 code-* 空串传入 micromatch）
      const globs = extractGlobsFromIncludes(includes);
      if (globs.length === 0) return true;
      const matches = micromatch.isMatch(issue.file, globs, { matchBase: true });
      if (!matches) {
        // console.log(`   Issue [${issue.ruleId}] 在文件 ${issue.file} 不匹配 includes 模式，跳过`);
      }
      return matches;
    });
  }

  /**
   * 根据 override 配置过滤 issues，排除被覆盖规则产生的 issues
   *
   * ## Override 机制说明
   * Override 允许高优先级规则"覆盖"低优先级规则。当规则 A 声明 `overrides: ["B"]` 时，
   * 规则 B 产生的 issues 会被过滤掉，避免重复报告或低优先级噪音。
   *
   * ## 作用域规则
   * Override 是**作用域感知**的：只有当 issue 的文件匹配 override 所在 spec 的 includes 时，
   * 该 override 才会生效。这允许不同目录/文件类型使用不同的规则优先级。
   *
   * 示例：
   * ```yaml
   * # controller-spec.yaml (includes: ["*.controller.ts"])
   * overrides: ["JsTs.Base.Rule1"]  # 只在 controller 文件中覆盖 Rule1
   * ```
   * 上述 override 不会影响 `*.service.ts` 文件中的 `Rule1` issues。
   *
   * ## 处理流程
   * 1. **收集阶段**：遍历所有 specs，收集 overrides 并保留其作用域（includes）信息
   *    - 文件级 overrides (`spec.overrides`) - 继承 spec 的 includes 作用域
   *    - 规则级 overrides (`rule.overrides`) - 同样继承 spec 的 includes 作用域
   * 2. **过滤阶段**：对每个 issue，检查是否存在匹配的 override
   *    - 需同时满足：ruleId 匹配 AND issue 文件在 override 的 includes 作用域内
   *    - 如果 includes 为空，表示全局作用域（匹配所有文件）
   *
   * @param issues - 待过滤的 issues 列表，每个 issue 必须包含 ruleId 字段，可选 file 字段
   * @param specs - 已加载的 ReviewSpec 列表
   * @param verbose - 日志详细级别：1=基础统计，3=详细收集过程
   * @returns 过滤后的 issues 列表（排除了被 override 的规则产生的 issues）
   */
  filterIssuesByOverrides<T extends { ruleId: string; file?: string }>(
    issues: T[],
    specs: ReviewSpec[],
    verbose?: VerboseLevel,
  ): T[] {
    // ========== 阶段1: 收集 spec -> overrides 的映射（保留作用域信息） ==========
    // 每个 override 需要记录其来源 spec 的 includes，用于作用域判断
    const scopedOverrides: Array<{
      override: string;
      includes: string[];
      source: string; // 用于日志：spec filename 或 rule id
    }> = [];

    for (const spec of specs) {
      // 文件级 overrides：作用域为该 spec 的 includes
      if (shouldLog(verbose, 3) && spec.overrides.length > 0) {
        console.error(`   📋 ${spec.filename} 文件级 overrides: ${spec.overrides.join(", ")}`);
      }
      for (const override of spec.overrides) {
        scopedOverrides.push({
          override,
          includes: spec.includes,
          source: spec.filename,
        });
      }

      // 规则级 overrides：继承该 spec 的 includes 作用域
      for (const rule of spec.rules) {
        if (shouldLog(verbose, 3) && rule.overrides.length > 0) {
          console.error(
            `   📋 ${spec.filename} 规则 [${rule.id}] overrides: ${rule.overrides.join(", ")}`,
          );
        }
        for (const override of rule.overrides) {
          scopedOverrides.push({
            override,
            includes: spec.includes,
            source: `${spec.filename}#${rule.id}`,
          });
        }
      }
    }

    // 输出收集结果汇总（verbose=3 时）
    if (shouldLog(verbose, 3)) {
      const overrideList = scopedOverrides.map((o) => o.override);
      console.error(
        `   🔍 收集到的 overrides 总计: ${overrideList.length > 0 ? overrideList.join(", ") : "(无)"}`,
      );
    }

    // 快速路径：无 override 声明时直接返回原列表
    if (scopedOverrides.length === 0) {
      return issues;
    }

    // ========== 阶段2: 过滤 issues（作用域感知） ==========
    // 对每个 issue，只检查其文件匹配的 spec 中声明的 overrides
    const beforeCount = issues.length;
    const skipped: Array<{ issue: T; override: string; source: string }> = [];
    const filtered = issues.filter((issue) => {
      const issueFile = "file" in issue ? (issue as { file: string }).file : "";

      // 查找第一个匹配的 override（需同时满足：ruleId 匹配 AND 文件在 includes 作用域内）
      const matched = scopedOverrides.find((scoped) => {
        // 检查 ruleId 是否匹配 override 模式
        if (!this.matchRuleId(issue.ruleId, scoped.override)) {
          return false;
        }
        // 检查 issue 文件是否在该 override 的作用域内
        // 如果 includes 为空，表示全局作用域（匹配所有文件）
        if (scoped.includes.length === 0) {
          return true;
        }
        // 使用 micromatch 检查文件是否匹配 includes 模式（转换为纯 glob）
        const globs = extractGlobsFromIncludes(scoped.includes);
        if (globs.length === 0) return true;
        return issueFile && micromatch.isMatch(issueFile, globs, { matchBase: true });
      });

      if (matched) {
        skipped.push({ issue, override: matched.override, source: matched.source });
        return false;
      }
      return true;
    });

    // ========== 阶段3: 输出过滤结果日志 ==========
    if (skipped.length > 0 && shouldLog(verbose, 1)) {
      console.error(`   Override 过滤: ${beforeCount} -> ${filtered.length} 个问题`);
      for (const { issue, override, source } of skipped) {
        const file = "file" in issue ? (issue as { file: string }).file : "";
        const line = "line" in issue ? (issue as { line: string }).line : "";
        console.error(
          `      ❌ [${issue.ruleId}] ${file}:${line} (override: ${override} from ${source})`,
        );
      }
    }
    return filtered;
  }

  /**
   * 根据变更文件的 patch 信息过滤 issues
   * 只保留 issue 的行号在实际变更行范围内的问题
   */
  filterIssuesByCommits<T extends { file: string; line: string }>(
    issues: T[],
    changedFiles: { filename?: string; patch?: string }[],
  ): T[] {
    // 构建文件 -> 变更行集合的映射
    const fileChangedLines = new Map<string, Set<number>>();

    for (const file of changedFiles) {
      if (!file.filename || !file.patch) continue;
      const lines = this.parseChangedLinesFromPatch(file.patch);
      fileChangedLines.set(file.filename, lines);
    }

    return issues.filter((issue) => {
      const changedLines = fileChangedLines.get(issue.file);

      // 如果没有该文件的 patch 信息，保留 issue
      if (!changedLines || changedLines.size === 0) {
        return true;
      }

      // 解析 issue 的行号（支持单行或范围如 "123" 或 "123-125"）
      const issueLines = this.parseLineRange(issue.line);

      // 检查 issue 的任意行是否在变更行范围内
      const matches = issueLines.some((line) => changedLines.has(line));
      if (!matches) {
        // console.log(`   Issue ${issue.file}:${issue.line} 不在变更行范围内，跳过`);
      }
      return matches;
    });
  }

  /**
   * 从 unified diff patch 中解析变更的行号（新文件中的行号）
   */
  protected parseChangedLinesFromPatch(patch: string): Set<number> {
    const changedLines = new Set<number>();
    const lines = patch.split("\n");

    let currentLine = 0;

    for (const line of lines) {
      // 解析 hunk header: @@ -oldStart,oldCount +newStart,newCount @@
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentLine = parseInt(hunkMatch[1], 10);
        continue;
      }

      if (line.startsWith("+") && !line.startsWith("+++")) {
        // 新增行
        changedLines.add(currentLine);
        currentLine++;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        // 删除行不增加行号
      } else {
        // 上下文行
        currentLine++;
      }
    }

    return changedLines;
  }

  /**
   * 解析行号字符串，支持单行 "123" 或范围 "123-125"
   * 返回行号数组，如果解析失败返回空数组
   */
  parseLineRange(lineStr: string): number[] {
    const lines: number[] = [];
    const rangeMatch = lineStr.match(/^(\d+)-(\d+)$/);

    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      for (let i = start; i <= end; i++) {
        lines.push(i);
      }
    } else {
      const line = parseInt(lineStr, 10);
      if (!isNaN(line)) {
        lines.push(line);
      }
    }

    return lines;
  }

  /**
   * 构建 specs 的 prompt 部分
   */
  buildSpecsSection(specs: ReviewSpec[]): string {
    return specs
      .map((spec) => {
        const firstRule = spec.rules[0];
        const rulesText = spec.rules
          .slice(1)
          .map((rule) => {
            let text = `#### [${rule.id}] ${rule.title}\n`;
            if (rule.description) {
              text += `${rule.description}\n`;
            }
            if (rule.examples.length > 0) {
              for (const example of rule.examples) {
                text += `##### ${example.type === "good" ? "推荐做法 (Good)" : "不推荐做法 (Bad)"}\n`;
                text += `\`\`\`${example.lang}\n${example.code}\n\`\`\`\n`;
              }
            }
            return text;
          })
          .join("\n");

        return `### ${firstRule.title}\n- 规范文件: ${spec.filename}\n- 适用扩展名: ${spec.extensions.join(", ")}\n\n${rulesText}`;
      })
      .join("\n\n-------------------\n\n");
  }

  /**
   * 根据 ruleId 查找规则定义
   * 支持精确匹配和前缀匹配
   */
  findRuleById(ruleId: string, specs: ReviewSpec[]): { rule: ReviewRule; spec: ReviewSpec } | null {
    for (const spec of specs) {
      for (const rule of spec.rules) {
        if (this.matchRuleId(ruleId, rule.id)) {
          return { rule, spec };
        }
      }
    }
    return null;
  }

  /**
   * 过滤 issues，只保留 ruleId 存在于 specs 中的问题
   */
  filterIssuesByRuleExistence<T extends { ruleId: string }>(issues: T[], specs: ReviewSpec[]): T[] {
    return issues.filter((issue) => {
      const ruleInfo = this.findRuleById(issue.ruleId, specs);
      if (!ruleInfo) {
        // console.log(`   Issue [${issue.ruleId}] 规则不存在，跳过`);
        return false;
      }
      return true;
    });
  }

  /**
   * 去重规范文件中的重复 ruleId
   * 后加载的规则覆盖先加载的（符合配置优先级：命令行 > 配置文件 > 默认路径）
   * @returns 去重后的 specs 数组
   */
  deduplicateSpecs(specs: ReviewSpec[]): ReviewSpec[] {
    // 记录 ruleId -> { specIndex, ruleIndex } 的映射，用于检测重复
    const ruleIdMap = new Map<string, { specIndex: number; ruleIndex: number }>();
    // 记录需要从每个 spec 中移除的 rule 索引
    const rulesToRemove = new Map<number, Set<number>>();

    for (let specIndex = 0; specIndex < specs.length; specIndex++) {
      const spec = specs[specIndex];
      for (let ruleIndex = 0; ruleIndex < spec.rules.length; ruleIndex++) {
        const rule = spec.rules[ruleIndex];
        const existing = ruleIdMap.get(rule.id);

        if (existing) {
          // 标记先前的规则为待移除（后加载的覆盖先加载的）
          if (!rulesToRemove.has(existing.specIndex)) {
            rulesToRemove.set(existing.specIndex, new Set());
          }
          rulesToRemove.get(existing.specIndex)!.add(existing.ruleIndex);
        }

        // 更新映射为当前规则
        ruleIdMap.set(rule.id, { specIndex, ruleIndex });
      }
    }

    // 如果没有重复，直接返回原数组
    if (rulesToRemove.size === 0) {
      return specs;
    }

    // 构建去重后的 specs
    const result: ReviewSpec[] = [];
    for (let specIndex = 0; specIndex < specs.length; specIndex++) {
      const spec = specs[specIndex];
      const removeSet = rulesToRemove.get(specIndex);

      if (!removeSet || removeSet.size === 0) {
        result.push(spec);
      } else {
        const filteredRules = spec.rules.filter((_, ruleIndex) => !removeSet.has(ruleIndex));
        if (filteredRules.length > 0) {
          result.push({ ...spec, rules: filteredRules });
        }
      }
    }

    return result;
  }

  /**
   * 格式化 issues，用规则定义的 severity 覆盖 AI 返回的值
   */
  formatIssues<T extends { ruleId: string; severity?: Severity }>(
    issues: T[],
    { specs, changedFiles }: { specs: ReviewSpec[]; changedFiles: ChangedFile[] },
  ): T[] {
    // 构建 ruleId -> severity 的映射
    const ruleSeverityMap = new Map<string, Severity>();

    for (const spec of specs) {
      for (const rule of spec.rules) {
        // 规则级别的 severity 优先，否则使用文件级别的 severity
        const severity = rule.severity ?? spec.severity;
        ruleSeverityMap.set(rule.id, severity);
      }
    }

    return issues.map((issue) => {
      const ruleSeverity = this.findByRuleId(issue.ruleId, ruleSeverityMap);

      if (ruleSeverity && ruleSeverity !== issue.severity) {
        return { ...issue, severity: ruleSeverity };
      }

      return issue;
    });
  }
}
