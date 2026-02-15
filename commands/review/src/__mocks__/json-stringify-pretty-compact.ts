// Mock for json-stringify-pretty-compact ESM module
export default function stringify(obj: unknown, options: { indent?: number } = {}): string {
  return JSON.stringify(obj, null, options.indent || 2);
}
