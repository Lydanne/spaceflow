import { parse as parseYaml } from "yaml";

export interface WorkflowInputDef {
  description?: string;
  required?: boolean;
  default?: string;
  type?: string;
  options?: string[];
}

export function parseWorkflowYaml(yamlContent: string): Record<string, unknown> | null {
  try {
    const doc = parseYaml(yamlContent);
    if (!doc || typeof doc !== "object") return null;
    return doc as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function extractInputs(doc: Record<string, unknown>): Record<string, WorkflowInputDef> | null {
  const on = doc.on;
  if (!on || typeof on !== "object") return null;
  const dispatch = (on as Record<string, unknown>).workflow_dispatch;
  if (!dispatch || typeof dispatch !== "object") return null;
  const inputs = (dispatch as Record<string, unknown>).inputs;
  if (!inputs || typeof inputs !== "object") return null;
  return inputs as Record<string, WorkflowInputDef>;
}
