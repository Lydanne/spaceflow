import { PullRequestCommit, type ChangedFile } from "@spaceflow/core";
import type { FastDescriptionMode, FastModeConfig } from "./review.config";
import { ChangedFileCollection } from "./changed-file-collection";

export interface FastLineStats {
  added: number;
  modified: number;
  deleted: number;
  total: number;
  round: number;
}

export interface FastModeDecision {
  enabled: boolean;
  reason?: string;
  descriptionMode: FastDescriptionMode;
  stats?: FastLineStats;
}

interface FastModeContext {
  fast?: boolean;
  fastMode?: FastModeConfig;
}

/**
 * 快速模式策略服务：只负责判定和文案构建，不涉及 PR I/O。
 */
export class ReviewFastModeService {
  resolveDecision(
    context: FastModeContext,
    changedFiles: ChangedFileCollection,
    currentRound = 1,
  ): FastModeDecision {
    const fastMode = context.fastMode;
    const descriptionMode = fastMode?.descriptionMode ?? "commit-classified";

    if (context.fast) {
      return {
        enabled: true,
        reason: "命令行参数 --fast",
        descriptionMode,
      };
    }

    if (!fastMode?.enabled) {
      return { enabled: false, descriptionMode };
    }

    const stats = this.calculateLineStats(changedFiles.toArray(), currentRound);
    if (!fastMode.when) {
      return {
        enabled: true,
        reason: "配置 review.fastMode.enabled=true",
        descriptionMode,
        stats,
      };
    }

    const matched = this.matchCondition(stats, fastMode.when);
    return {
      enabled: matched,
      reason: matched
        ? `命中阈值条件 (R:${stats.round} A:${stats.added} M:${stats.modified} D:${stats.deleted})`
        : "",
      descriptionMode,
      stats,
    };
  }

  buildTitle(commits: PullRequestCommit[]): string {
    const latestCommit = this.getLatestNonMergeCommit(commits);
    const latestSubject = latestCommit?.commit?.message?.split("\n")[0] ?? "";
    const normalized = this.normalizeCommitSubject(latestSubject);
    return `Feat ${normalized}`.slice(0, 50);
  }

  buildDescription(
    commits: PullRequestCommit[],
    changedFiles: ChangedFileCollection,
    mode: FastDescriptionMode,
  ): string {
    if (mode === "off") {
      return "";
    }

    const commitSubjects = commits
      .map((c) => c.commit?.message?.split("\n")[0]?.trim() ?? "")
      .filter((subject) => subject.length > 0 && !/^merge\b/i.test(subject));
    const counts = new Map<string, number>();
    for (const subject of commitSubjects) {
      const type = this.classifyCommitType(subject);
      counts.set(type, (counts.get(type) ?? 0) + 1);
    }
    const categories = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => `${type}(${count})`)
      .join(", ");

    const parts: string[] = ["**快速模式**：首轮仅执行静态规则检查，跳过 LLM Review。"];
    if (categories) {
      parts.push(`**提交分类**: ${categories}`);
    }
    if (commitSubjects.length > 0) {
      parts.push(`**提交记录**: ${commitSubjects.slice(0, 5).join("; ")}`);
    }

    if (changedFiles.length > 0) {
      const { added, modified, deleted } = changedFiles.countByStatus();
      const statusParts: string[] = [];
      if (added > 0) statusParts.push(`新增 ${added}`);
      if (modified > 0) statusParts.push(`修改 ${modified}`);
      if (deleted > 0) statusParts.push(`删除 ${deleted}`);
      parts.push(`**文件变更**: ${changedFiles.length} 个文件 (${statusParts.join(", ")})`);
    }

    return parts.join("\n");
  }

  private calculateLineStats(files: ChangedFile[], round: number): FastLineStats {
    let added = 0;
    let modified = 0;
    let deleted = 0;

    for (const file of files) {
      const { additions, deletions } = this.getFileAddDelStats(file);
      const fileModified = Math.min(additions, deletions);
      const fileAdded = Math.max(additions - fileModified, 0);
      const fileDeleted = Math.max(deletions - fileModified, 0);
      added += fileAdded;
      modified += fileModified;
      deleted += fileDeleted;
    }

    return {
      added,
      modified,
      deleted,
      total: added + modified + deleted,
      round,
    };
  }

  private getFileAddDelStats(file: ChangedFile): { additions: number; deletions: number } {
    let additions = typeof file.additions === "number" ? file.additions : 0;
    let deletions = typeof file.deletions === "number" ? file.deletions : 0;

    if ((additions === 0 && deletions === 0) || additions < 0 || deletions < 0) {
      const patchStats = this.countPatchAddDel(file.patch);
      additions = patchStats.additions;
      deletions = patchStats.deletions;
    }

    return {
      additions: Math.max(additions, 0),
      deletions: Math.max(deletions, 0),
    };
  }

  private countPatchAddDel(patch?: string): { additions: number; deletions: number } {
    if (!patch) return { additions: 0, deletions: 0 };
    let additions = 0;
    let deletions = 0;
    for (const line of patch.split("\n")) {
      if (line.startsWith("+") && !line.startsWith("+++")) additions++;
      if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }
    return { additions, deletions };
  }

  private matchCondition(stats: FastLineStats, condition: NonNullable<FastModeConfig["when"]>): boolean {
    const { op = "and", rules = [] } = condition;
    if (rules.length === 0) return false;
    const results = rules.map((rule) => this.matchRule(stats, rule));
    return op === "or" ? results.some(Boolean) : results.every(Boolean);
  }

  private matchRule(
    stats: FastLineStats,
    rule: NonNullable<FastModeConfig["when"]>["rules"][number],
  ): boolean {
    const value = stats[rule.field];
    if (rule.lt !== undefined && !(value < rule.lt)) return false;
    if (rule.lte !== undefined && !(value <= rule.lte)) return false;
    if (rule.gt !== undefined && !(value > rule.gt)) return false;
    if (rule.gte !== undefined && !(value >= rule.gte)) return false;
    if (rule.eq !== undefined && !(value === rule.eq)) return false;
    return true;
  }

  private classifyCommitType(subject: string): string {
    const match = subject.match(/^([a-zA-Z]+)(?:\([^)]+\))?!?:/);
    const type = match?.[1]?.toLowerCase();
    switch (type) {
      case "feat":
        return "Feat";
      case "fix":
        return "Fix";
      case "refactor":
        return "Refactor";
      case "perf":
        return "Perf";
      case "docs":
        return "Docs";
      case "test":
        return "Test";
      case "chore":
        return "Chore";
      case "style":
        return "Style";
      default:
        return "Other";
    }
  }

  private getLatestNonMergeCommit(commits: PullRequestCommit[]): PullRequestCommit | undefined {
    const candidates = commits.filter((c) => !/^merge\b/i.test(c.commit?.message ?? ""));
    if (candidates.length === 0) return undefined;

    const withDate = candidates
      .map((commit) => {
        const dateText = commit.commit?.author?.date;
        const date = dateText ? Date.parse(dateText) : NaN;
        return { commit, date };
      })
      .filter((item) => Number.isFinite(item.date))
      .sort((a, b) => b.date - a.date);
    if (withDate.length > 0) {
      return withDate[0].commit;
    }

    return candidates[0];
  }

  private normalizeCommitSubject(subject: string): string {
    const plain = subject.replace(/^\s+|\s+$/g, "").split("\n")[0] ?? "";
    const removedPrefix = plain.replace(/^[a-zA-Z]+(?:\([^)]+\))?!?:\s*/, "");
    const compact = removedPrefix.replace(/\s+/g, " ").trim();
    return compact || "更新代码";
  }
}
