const core = require("@actions/core");
const exec = require("@actions/exec");
const path = require("path");
const fs = require("fs");
const os = require("os");

const OUTPUT_MARKER_START = "::spaceflow-output::";
const OUTPUT_MARKER_END = "::end::";
const CACHE_DIR = path.join(os.tmpdir(), "spaceflow-outputs");

/**
 * Parse spaceflow output from stdout
 * Format: ::spaceflow-output::{"key":"value"}::end::
 */
function parseOutputs(stdout) {
  const outputs = {};
  const regex = new RegExp(
    `${OUTPUT_MARKER_START.replace(/:/g, "\\:")}(.+?)${OUTPUT_MARKER_END.replace(/:/g, "\\:")}`,
    "g",
  );

  let match;
  while ((match = regex.exec(stdout)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      Object.assign(outputs, parsed);
    } catch {
      core.warning(`Failed to parse output: ${match[1]}`);
    }
  }

  return outputs;
}

/**
 * Get value from object by path (e.g. "data.name" or "version")
 */
function getByPath(obj, pathStr) {
  const parts = pathStr.split(".");
  let current = obj;
  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

/**
 * Read outputs from cache file by cacheId
 */
function readFromCache(cacheId) {
  const cacheFile = path.join(CACHE_DIR, `${cacheId}.json`);
  if (!fs.existsSync(cacheFile)) {
    return null;
  }
  try {
    const content = fs.readFileSync(cacheFile, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Handle get-output command - extract value from cache by cacheId and path
 * Usage: get-output --cache-id <uuid> --path <key>
 */
function handleGetOutput(argsStr) {
  const args = argsStr.split(/\s+/).filter(Boolean);
  let cacheId = "";
  let jsonPath = "";

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === "--cache-id" || args[i] === "-c") && i + 1 < args.length) {
      cacheId = args[++i];
    } else if ((args[i] === "--path" || args[i] === "-p") && i + 1 < args.length) {
      jsonPath = args[++i];
    }
  }

  if (!cacheId) {
    core.setFailed("Missing --cache-id argument");
    return;
  }
  if (!jsonPath) {
    core.setFailed("Missing --path argument");
    return;
  }

  const cached = readFromCache(cacheId);
  if (!cached) {
    core.setFailed(`Cache not found for id: ${cacheId}`);
    return;
  }

  const value = getByPath(cached, jsonPath);

  if (value === undefined) {
    core.setFailed(`Path "${jsonPath}" not found in cached outputs`);
    return;
  }

  const outputValue = typeof value === "object" ? JSON.stringify(value) : String(value);
  core.setOutput("value", outputValue);
  core.info(`Extracted value: ${outputValue}`);
}

/**
 * Parse command from PR comment
 * Format: /review [-v <level>] [-l <mode>] [--verify-fixes] ...
 * Returns: { command: string, args: string }
 */
function parseFromComment(comment) {
  const trimmed = comment.trim();
  // 匹配 /command 格式
  const match = trimmed.match(/^\/(\S+)\s*(.*)?$/);
  if (!match) {
    return null;
  }
  return {
    command: match[1],
    args: (match[2] || "").trim(),
  };
}

async function run() {
  try {
    let command = core.getInput("command", { required: false });
    let args = core.getInput("args");
    const fromComment = core.getInput("from-comment");

    // 如果提供了 from-comment，从评论中解析命令和参数
    if (fromComment) {
      const parsed = parseFromComment(fromComment);
      if (parsed) {
        command = parsed.command;
        args = parsed.args;
        core.info(`📝 从评论解析: command=${command}, args=${args}`);
      } else {
        core.setFailed(`无法解析评论指令: ${fromComment}`);
        return;
      }
    }

    if (!command) {
      core.setFailed("Missing command input");
      return;
    }

    // Handle get-output command separately (no CLI execution needed)
    if (command === "get-output") {
      handleGetOutput(args);
      return;
    }

    // 对于 review 命令，自动添加 --event-action 参数
    const eventAction = core.getInput("event-action");
    if (command === "review" && eventAction && !args.includes("--event-action")) {
      args = args ? `${args} --event-action=${eventAction}` : `--event-action=${eventAction}`;
      core.info(`ℹ️ PR 事件类型: ${eventAction}`);
    }
    const workingDirectory = core.getInput("working-directory") || ".";
    const devMode = core.getInput("dev-mode") === "true";

    // Get Git Provider server url and token from input or environment variables
    const providerUrl = core.getInput("provider-url") || process.env.GIT_PROVIDER_URL || process.env.GITHUB_SERVER_URL || "";
    const providerToken =
      core.getInput("provider-token") || process.env.GIT_PROVIDER_TOKEN || process.env.GITHUB_TOKEN || "";

    // Set environment variables for CLI to use
    if (providerUrl) {
      core.exportVariable("GIT_PROVIDER_URL", providerUrl);
    }
    if (providerToken) {
      core.exportVariable("GIT_PROVIDER_TOKEN", providerToken);
      core.setSecret(providerToken);
    }

    // Resolve core path - core/ is a sibling directory to actions/ in the repo
    const actionsDir = path.resolve(__dirname, "..");
    const repoRoot = path.resolve(actionsDir, "..");
    // const corePath = path.resolve(repoRoot, "core");

    // core.info(`Core path: ${corePath}`);
    core.info(`Dev mode: ${devMode}`);

    let execCmd;
    let cmdArgs;
    let execCwd;

    if (devMode) {
      // Development mode: install deps, build all, then install plugins
      core.info("Installing dependencies...");
      await exec.exec("pnpm", ["install"], { cwd: repoRoot });

      core.info("Building all packages...");
      await exec.exec("pnpm", ["run", "setup"], { cwd: repoRoot });

      core.info("Installing spaceflow plugins...");
      await exec.exec("pnpm", ["spaceflow", "install"], { cwd: repoRoot });

      // Run the command
      execCmd = "pnpm";
      cmdArgs = ["spaceflow", command];
      if (args) {
        cmdArgs.push(...args.split(/\s+/).filter(Boolean));
      }
      cmdArgs.push("--ci");
      execCwd = repoRoot;
    } else {
      // Production mode: use npx to install and run from local path
      execCmd = "npx";
      cmdArgs = ["-y", "spaceflow", command];
      if (args) {
        cmdArgs.push(...args.split(/\s+/).filter(Boolean));
      }
      cmdArgs.push("--ci");
      execCwd = workingDirectory;
    }

    core.info(`Running: ${execCmd} ${cmdArgs.join(" ")}`);
    core.info(`Working directory: ${execCwd}`);
    core.info(`Command: ${command}`);
    core.info(`Args: ${args}`);

    // Capture stdout to parse outputs
    let stdout = "";
    const exitCode = await exec.exec(execCmd, cmdArgs, {
      cwd: execCwd,
      env: {
        ...process.env,
        GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY || "",
        GITHUB_REF_NAME: process.env.GITHUB_REF_NAME || "",
        GITHUB_EVENT_PATH: process.env.GITHUB_EVENT_PATH || "",
      },
      listeners: {
        stdout: (data) => {
          stdout += data.toString();
        },
      },
    });

    // Parse and set outputs
    const outputs = parseOutputs(stdout);
    for (const [key, value] of Object.entries(outputs)) {
      core.setOutput(key, value);
      core.info(`Output: ${key}=${value}`);
    }

    if (exitCode !== 0) {
      core.setFailed(`Command failed with exit code ${exitCode}`);
    }
  } catch (error) {
    core.setFailed(error.message || "An unexpected error occurred");
  }
}

run();
