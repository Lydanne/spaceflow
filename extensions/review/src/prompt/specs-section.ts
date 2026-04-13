import type { ReviewSpec, RuleExample, RuleContent } from "../review-spec/types";

/**
 * 构建 specs 的 prompt 部分
 */
export function buildSpecsSection(specs: ReviewSpec[]): string {
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
              text += formatExample(example);
            }
          }
          return text;
        })
        .join("\n");

      return `### ${firstRule.title}\n- 规范文件: ${spec.filename}\n- 适用扩展名: ${spec.extensions.join(", ")}\n\n${rulesText}`;
    })
    .join("\n\n-------------------\n\n");
}

function formatExample(example: RuleExample): string {
  let text = "";
  if (example.title) {
    text += `##### Example: ${example.title}\n`;
  }
  if (example.description) {
    text += `${example.description}\n`;
  }
  for (const item of example.content) {
    text += formatContent(item);
  }
  return text;
}

function formatContent(item: RuleContent): string {
  return `###### ${item.type}${item.title ? `: ${item.title}` : ""}\n${item.description}\n`;
}
