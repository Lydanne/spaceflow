/**
 * Runx 命令参数解析工具
 */

export interface RunxParsedArgs {
  cmdIndex: number;
  sourceIndex: number;
  source: string;
  args: string[];
}

/**
 * 查找 runx/x 命令在 argv 中的位置
 */
export function findRunxCmdIndex(argv: string[]): number {
  return argv.findIndex((arg) => arg === "runx" || arg === "x");
}

/**
 * 判断参数是否为 -n/--name 选项
 */
export function isNameOption(arg: string): boolean {
  return arg === "-n" || arg === "--name" || arg.startsWith("-n=") || arg.startsWith("--name=");
}

/**
 * 判断参数是否为 -n/--name 选项（需要跳过下一个参数）
 */
export function isNameOptionWithValue(arg: string): boolean {
  return arg === "-n" || arg === "--name";
}

/**
 * 从参数列表中找到 source（跳过 -n/--name 选项）
 */
export function findSourceInArgs(args: string[]): { index: number; source: string } {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (isNameOptionWithValue(arg)) {
      i++; // 跳过选项值
      continue;
    }
    if (isNameOption(arg)) {
      continue;
    }
    if (!arg.startsWith("-")) {
      return { index: i, source: arg };
    }
  }
  return { index: -1, source: "" };
}

/**
 * 解析 runx 命令的完整参数
 */
export function parseRunxArgs(argv: string[]): RunxParsedArgs {
  const cmdIndex = findRunxCmdIndex(argv);
  if (cmdIndex === -1) {
    return { cmdIndex: -1, sourceIndex: -1, source: "", args: [] };
  }
  const separatorIndex = argv.indexOf("--");
  if (separatorIndex === -1) {
    // 没有分隔符
    const remaining = argv.slice(cmdIndex + 1);
    const { index, source } = findSourceInArgs(remaining);
    return {
      cmdIndex,
      sourceIndex: index === -1 ? -1 : cmdIndex + 1 + index,
      source,
      args: [],
    };
  }
  // 有分隔符
  const beforeSeparator = argv.slice(cmdIndex + 1, separatorIndex);
  const afterSeparator = argv.slice(separatorIndex + 1);
  const { index, source } = findSourceInArgs(beforeSeparator);
  return {
    cmdIndex,
    sourceIndex: index === -1 ? -1 : cmdIndex + 1 + index,
    source,
    args: afterSeparator,
  };
}
