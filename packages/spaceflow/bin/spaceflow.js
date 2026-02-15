#!/usr/bin/env node

/**
 * spaceflow 代理入口
 * 直接转发到 @spaceflow/cli 的 bin 脚本
 */

import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const cliPkgPath = require.resolve("@spaceflow/cli/package.json");
const cliBin = resolve(dirname(cliPkgPath), "dist", "cli.js");

try {
  execFileSync(process.execPath, [cliBin, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
} catch (error) {
  process.exit(error.status || 1);
}
