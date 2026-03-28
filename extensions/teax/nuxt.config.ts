// https://nuxt.com/docs/api/configuration/nuxt-config
const resolveDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const user = process.env.POSTGRES_USER || "postgres";
  const password = process.env.POSTGRES_PASSWORD || "postgres";
  const host = process.env.POSTGRES_HOST || "localhost";
  const port = process.env.POSTGRES_PORT || "5432";
  const database = process.env.POSTGRES_DB || "teax";
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
};

const resolveRedisUrl = () => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  const host = process.env.REDIS_HOST || "localhost";
  const port = process.env.REDIS_PORT || "6379";
  const password = process.env.REDIS_PASSWORD || "";
  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
};

export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui", "nuxt-auth-utils", "@nuxtjs/mdc"],

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    databaseUrl: resolveDatabaseUrl(),
    redisUrl: resolveRedisUrl(),
    giteaUrl: process.env.GITEA_URL || "",
    giteaClientId: process.env.GITEA_CLIENT_ID || "",
    giteaClientSecret: process.env.GITEA_CLIENT_SECRET || "",
    feishuAppId: process.env.FEISHU_APP_ID || "",
    feishuAppSecret: process.env.FEISHU_APP_SECRET || "",
    feishuEncryptKey: process.env.FEISHU_ENCRYPT_KEY || "",
    feishuVerificationToken: process.env.FEISHU_VERIFICATION_TOKEN || "",
    feishuApprovalCode: process.env.FEISHU_APPROVAL_CODE || "",
    giteaServiceToken: process.env.GITEA_SERVICE_TOKEN || "",
    tokenEncryptSecret: process.env.TOKEN_ENCRYPT_SECRET || "",
    // Agents 元数据仓库与提交身份配置
    agentMetaRepoUrl: process.env.AGENT_META_REPO_URL || "",
    agentMetaRepoBranch: process.env.AGENT_META_REPO_BRANCH || "main",
    agentMetaRepoAuthType: process.env.AGENT_META_REPO_AUTH_TYPE || "token",
    agentMetaRepoTokenRaw: process.env.AGENT_META_REPO_TOKEN || "",
    agentMetaRepoToken: process.env.AGENT_META_REPO_TOKEN || process.env.AGENT_BOT_TOKEN || "",
    agentBotUsername: process.env.AGENT_BOT_USERNAME || "TeaxBot",
    agentBotEmail: process.env.AGENT_BOT_EMAIL || "teaxbot@local",
    agentBotToken: process.env.AGENT_BOT_TOKEN || "",
    // Agent Runtime（P1）配置
    agentRuntimeRoot: process.env.AGENT_RUNTIME_ROOT || ".teax-agent-runtime",
    agentRuntimeDockerBin: process.env.AGENT_RUNTIME_DOCKER_BIN || "docker",
    agentRuntimeDockerBaseDockerfile:
      process.env.AGENT_RUNTIME_DOCKER_BASE_DOCKERFILE
      || "docker/base/node24-vscode-browser.Dockerfile",
    agentRuntimeDockerBaseBuildContext: process.env.AGENT_RUNTIME_DOCKER_BASE_BUILD_CONTEXT || ".",
    agentRuntimeDockerBuildOnStart: process.env.AGENT_RUNTIME_DOCKER_BUILD_ON_START !== "false",
    agentRuntimeDockerWorkspaceRoot: process.env.AGENT_RUNTIME_DOCKER_WORKSPACE_ROOT || "/runtime",
    agentRuntimeKeepWorktreeOnStop: process.env.AGENT_RUNTIME_KEEP_WORKTREE_ON_STOP === "true",
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || "",
    },
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || "Teax",
      appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3000",
    },
  },

  routeRules: {
    "/": { prerender: true },
  },
  compatibilityDate: "2025-01-15",

  nitro: {
    experimental: {
      tasks: true,
    },
    // 定时任务调度（仅生产环境启用）
    scheduledTasks:
      process.env.NODE_ENV === "production"
        ? {
            // 每分钟检查过期的子预设
            "* * * * *": ["presets:unlock-expired"],
            // 每月 1 号凌晨 3 点清理 30 天前的历史记录
            "0 3 1 * *": ["presets:cleanup-history"],
          }
        : {},
    typescript: {
      tsConfig: {
        include: ["../auth.d.ts"],
      },
    },
  },

  eslint: {
    config: {
      stylistic: {
        indent: 2,
        semi: true,
        quotes: "double",
        commaDangle: "always-multiline",
        braceStyle: "1tbs",
      },
    },
  },

  // 禁用 Google Fonts 和 Google Icons，避免网络超时
  fonts: {
    providers: {
      google: false,
      googleicons: false,
    },
  },
});
