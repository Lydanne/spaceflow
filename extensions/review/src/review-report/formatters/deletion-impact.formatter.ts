import type { DeletionImpactResult, DeletionImpact } from "../../review-spec/types";

const RISK_EMOJI: Record<string, string> = {
  high: "🔴",
  medium: "🟡",
  low: "🟢",
  none: "⚪",
};

const RISK_LABEL: Record<string, string> = {
  high: "高风险",
  medium: "中风险",
  low: "低风险",
  none: "无风险",
};

export interface DeletionImpactReportOptions {
  includeJsonData?: boolean;
}

const DELETION_IMPACT_DATA_START = "<!-- spaceflow-deletion-impact-data-start -->";
const DELETION_IMPACT_DATA_END = "<!-- spaceflow-deletion-impact-data-end -->";

export class DeletionImpactFormatter {
  format(result: DeletionImpactResult, options: DeletionImpactReportOptions = {}): string {
    const { includeJsonData = true } = options;
    const lines: string[] = [];

    lines.push("## 🗑️ 删除代码影响分析\n");

    // 防御性检查：确保 impacts 是数组
    const impacts = result.impacts && Array.isArray(result.impacts) ? result.impacts : [];

    if (impacts.length === 0) {
      lines.push("✅ **未发现有风险的代码删除**\n");
      lines.push(result.summary);
      return lines.join("\n");
    }

    // 统计风险等级
    const highRisk = impacts.filter((i) => i.riskLevel === "high");
    const mediumRisk = impacts.filter((i) => i.riskLevel === "medium");
    const lowRisk = impacts.filter((i) => i.riskLevel === "low");

    lines.push("### 📊 风险概览\n");
    lines.push(`| 风险等级 | 数量 |`);
    lines.push(`|----------|------|`);
    if (highRisk.length > 0) {
      lines.push(`| ${RISK_EMOJI.high} 高风险 | ${highRisk.length} |`);
    }
    if (mediumRisk.length > 0) {
      lines.push(`| ${RISK_EMOJI.medium} 中风险 | ${mediumRisk.length} |`);
    }
    if (lowRisk.length > 0) {
      lines.push(`| ${RISK_EMOJI.low} 低风险 | ${lowRisk.length} |`);
    }
    lines.push("");

    // 详情折叠
    lines.push("<details>");
    lines.push("<summary>📋 点击查看详情</summary>\n");

    // 高风险项详情
    if (highRisk.length > 0) {
      lines.push("### 🔴 高风险删除\n");
      lines.push(this.formatImpactList(highRisk));
    }

    // 中风险项详情
    if (mediumRisk.length > 0) {
      lines.push("### 🟡 中风险删除\n");
      lines.push(this.formatImpactList(mediumRisk));
    }

    // 低风险项
    if (lowRisk.length > 0) {
      lines.push("### 🟢 低风险删除\n");
      lines.push(this.formatImpactList(lowRisk));
    }

    // 总结
    lines.push("\n### 📝 总结\n");
    lines.push(result.summary);

    lines.push("\n</details>");

    return lines.join("\n");
  }

  private formatImpactList(impacts: DeletionImpact[]): string {
    const lines: string[] = [];

    for (const impact of impacts) {
      const emoji = RISK_EMOJI[impact.riskLevel] || RISK_EMOJI.none;
      const label = RISK_LABEL[impact.riskLevel] || "未知";
      const codePreview =
        impact.deletedCode.length > 50
          ? impact.deletedCode.slice(0, 50) + "..."
          : impact.deletedCode;

      lines.push(`#### ${emoji} \`${impact.file}\`\n`);
      lines.push(`- **风险等级**: ${label}`);
      lines.push(`- **删除代码**: \`${codePreview.replace(/\n/g, " ")}\``);

      if (impact.affectedFiles.length > 0) {
        lines.push(`- **受影响文件**:`);
        for (const file of impact.affectedFiles.slice(0, 5)) {
          lines.push(`  - \`${file}\``);
        }
        if (impact.affectedFiles.length > 5) {
          lines.push(`  - ... 还有 ${impact.affectedFiles.length - 5} 个文件`);
        }
      }

      lines.push(`- **影响分析**: ${impact.reason}`);

      if (impact.suggestion) {
        lines.push(`- **建议**: ${impact.suggestion}`);
      }

      lines.push("");
    }

    return lines.join("\n");
  }

  parse(content: string): DeletionImpactResult | null {
    const startIndex = content.indexOf(DELETION_IMPACT_DATA_START);
    const endIndex = content.indexOf(DELETION_IMPACT_DATA_END);

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      return null;
    }

    const jsonStart = startIndex + DELETION_IMPACT_DATA_START.length;
    const jsonContent = content.slice(jsonStart, endIndex).trim();

    try {
      return JSON.parse(jsonContent) as DeletionImpactResult;
    } catch {
      return null;
    }
  }
}
