export type VerboseLevel = 0 | 1 | 2;

export const DEFAULT_VERBOSE_LEVEL: VerboseLevel = 1;
export const VERBOSE_FORM_FIELD = "__teax_verbose" as const;

export function parseVerboseLevel(
  input: unknown,
  fallback: VerboseLevel = DEFAULT_VERBOSE_LEVEL,
): VerboseLevel {
  const n = Number(input);
  if (n === 0 || n === 1 || n === 2) return n;
  return fallback;
}

export function getRuntimeVerboseDefault(): VerboseLevel {
  const config = useRuntimeConfig();
  return parseVerboseLevel(
    (config as { verboseDefault?: unknown }).verboseDefault,
    DEFAULT_VERBOSE_LEVEL,
  );
}

export function resolveVerboseLevel(input: unknown): VerboseLevel {
  return parseVerboseLevel(input, getRuntimeVerboseDefault());
}
