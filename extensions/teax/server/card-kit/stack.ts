import type { StackEntry } from "./types";

/** 将页面名+参数编码为栈条目字符串 */
export function encodeStackEntry(page: string, params?: Record<string, unknown>): StackEntry {
  if (!params || Object.keys(params).length === 0) return page;
  return `${page}?${encodeParams(params)}`;
}

/** 从栈条目字符串解码出页面名和参数 */
export function decodeStackEntry(entry: StackEntry): { page: string; params: Record<string, unknown> } {
  const idx = entry.indexOf("?");
  if (idx === -1) return { page: entry, params: {} };
  return { page: entry.slice(0, idx), params: decodeParams(entry.slice(idx + 1)) };
}

// ─── qs-style 编解码（支持嵌套对象/数组） ───

function encodeParams(obj: Record<string, unknown>, prefix?: string): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined || val === null) continue;
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (typeof val === "object" && !Array.isArray(val)) {
      parts.push(encodeParams(val as Record<string, unknown>, fullKey));
    } else if (Array.isArray(val)) {
      val.forEach((item, i) => {
        if (typeof item === "object" && item !== null) {
          parts.push(encodeParams(item as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          parts.push(`${fullKey}[${i}]=${encodeURIComponent(String(item))}`);
        }
      });
    } else {
      parts.push(`${fullKey}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts.filter(Boolean).join("&");
}

function decodeParams(qs: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!qs) return result;
  for (const pair of qs.split("&")) {
    const eqIdx = pair.indexOf("=");
    if (eqIdx === -1) continue;
    const rawKey = pair.slice(0, eqIdx);
    const rawVal = decodeURIComponent(pair.slice(eqIdx + 1));
    setNestedValue(result, rawKey, rawVal);
  }
  return result;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: string): void {
  const keys = path.replace(/\]/g, "").split("[");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]!;
    if (current[k] === undefined || current[k] === null) {
      // 下一个 key 是纯数字则创建数组，否则对象
      current[k] = /^\d+$/.test(keys[i + 1]!) ? [] : {};
    }
    current = current[k] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1]!;
  if (Array.isArray(current)) {
    (current as unknown[])[Number(lastKey)] = value;
  } else {
    current[lastKey] = value;
  }
}
