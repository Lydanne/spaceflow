import type { ReviewSpec, ReviewRule, RuleContent, RuleExample, Severity } from "./types";

export function extractConfigValues(content: string, configName: string): string[] {
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
    values = lineValues;
  }

  return values;
}

export function extractOverrides(content: string): string[] {
  return extractConfigValues(content, "override").map((v) =>
    v.startsWith("[") && v.endsWith("]") ? v.slice(1, -1) : v,
  );
}

export function extractSeverity(content: string): Severity | undefined {
  const values = extractConfigValues(content, "severity");
  if (values.length > 0) {
    const value = values[values.length - 1];
    if (value === "off" || value === "warn" || value === "error") {
      return value;
    }
  }
  return undefined;
}

export function extractIncludes(content: string): string[] {
  const firstRuleIndex = content.indexOf("\n## ");
  const headerContent = firstRuleIndex > 0 ? content.slice(0, firstRuleIndex) : content;
  return extractConfigValues(headerContent, "includes");
}

export function extractExamples(content: string): RuleExample[] {
  const examples: RuleExample[] = [];
  const groupSections = content.split(/(?:^|\n)(?=###\s+Example:)/);

  for (const groupSection of groupSections) {
    const trimmedGroup = groupSection.trim();
    if (!trimmedGroup) continue;

    let exampleTitle = "";
    let exampleDescription = "";
    const groupMatch = trimmedGroup.match(/^###\s+Example\s*[:：]\s*(.+)/i);
    if (groupMatch) {
      exampleTitle = groupMatch[1].trim();
      const afterTitle = trimmedGroup.slice(trimmedGroup.indexOf("\n")).trim();
      const firstSubIdx = afterTitle.search(/(?:^|\n)####\s+/);
      if (firstSubIdx > 0) {
        exampleDescription = afterTitle.slice(0, firstSubIdx).trim();
      }
    }

    const ruleContents: RuleContent[] = [];
    const sections = trimmedGroup.split(/(?:^|\n)####\s+/);

    for (const section of sections) {
      const trimmedSection = section.trim();
      if (!trimmedSection) continue;

      let type: "good" | "bad" | null = null;
      let contentTitle = "";
      if (/^good:/i.test(trimmedSection)) {
        type = "good";
        contentTitle = trimmedSection.match(/^good:\s*(.+)/i)?.[1]?.trim() ?? "";
      } else if (/^bad:/i.test(trimmedSection)) {
        type = "bad";
        contentTitle = trimmedSection.match(/^bad:\s*(.+)/i)?.[1]?.trim() ?? "";
      }

      if (!type) continue;

      const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
      let codeMatch;
      const codeParts: string[] = [];
      while ((codeMatch = codeBlockRegex.exec(trimmedSection)) !== null) {
        codeParts.push(codeMatch[2].trim());
      }

      ruleContents.push({
        title: contentTitle,
        type,
        description: codeParts.join("\n\n"),
      });
    }

    if (ruleContents.length > 0) {
      examples.push({
        title: exampleTitle,
        description: exampleDescription,
        content: ruleContents,
      });
    }
  }

  return examples;
}

export function extractRules(
  content: string,
  deps: {
    extractExamplesFromContent: (content: string) => RuleExample[];
    extractOverridesFromContent: (content: string) => string[];
    extractSeverityFromContent: (content: string) => Severity | undefined;
    extractConfigValuesFromContent: (content: string, configName: string) => string[];
  },
): ReviewRule[] {
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
    const examples = deps.extractExamplesFromContent(ruleContent);
    const overrides = deps.extractOverridesFromContent(ruleContent);

    let description = ruleContent;
    const firstExampleIndex = ruleContent.search(/(?:^|\n)(?:####\s+(?:good|bad)|###\s+Example:)/i);
    if (firstExampleIndex !== -1) {
      description = ruleContent.slice(0, firstExampleIndex).trim();
    }

    const severity = deps.extractSeverityFromContent(ruleContent);
    const includes = deps.extractConfigValuesFromContent(ruleContent, "includes");

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

export function deduplicateSpecs(specs: ReviewSpec[]): ReviewSpec[] {
  const ruleIdMap = new Map<string, { specIndex: number; ruleIndex: number }>();
  const rulesToRemove = new Map<number, Set<number>>();

  for (let specIndex = 0; specIndex < specs.length; specIndex++) {
    const spec = specs[specIndex];
    for (let ruleIndex = 0; ruleIndex < spec.rules.length; ruleIndex++) {
      const rule = spec.rules[ruleIndex];
      const existing = ruleIdMap.get(rule.id);

      if (existing) {
        if (!rulesToRemove.has(existing.specIndex)) {
          rulesToRemove.set(existing.specIndex, new Set());
        }
        rulesToRemove.get(existing.specIndex)!.add(existing.ruleIndex);
      }

      ruleIdMap.set(rule.id, { specIndex, ruleIndex });
    }
  }

  if (rulesToRemove.size === 0) {
    return specs;
  }

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

export function parseChangedLinesFromPatch(patch: string): Set<number> {
  const changedLines = new Set<number>();
  const lines = patch.split("\n");
  let currentLine = 0;

  for (const line of lines) {
    const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      currentLine = parseInt(hunkMatch[1], 10);
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      changedLines.add(currentLine);
      currentLine++;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      continue;
    } else if (!line.startsWith("\\")) {
      currentLine++;
    }
  }

  return changedLines;
}

export function parseLineRange(lineStr: string): number[] {
  if (!lineStr) return [];

  if (lineStr.includes("-")) {
    const [start, end] = lineStr.split("-").map((n) => parseInt(n, 10));
    if (isNaN(start) || isNaN(end)) return [];
    const lines: number[] = [];
    for (let i = start; i <= end; i++) {
      lines.push(i);
    }
    return lines;
  }

  if (lineStr.includes(",")) {
    return lineStr
      .split(",")
      .map((n) => parseInt(n.trim(), 10))
      .filter((n) => !isNaN(n));
  }

  const line = parseInt(lineStr, 10);
  return isNaN(line) ? [] : [line];
}
