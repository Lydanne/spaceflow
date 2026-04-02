// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: ["@nuxt/eslint", "@nuxt/ui", "nuxt-auth-utils", "@nuxtjs/mdc"],

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  // 运行时配置：空字符串由 NUXT_* 环境变量运行时注入，避免构建时泄露密钥
  // 支持的环境变量格式：
  //   - NUXT_DATABASE_URL 或 NUXT_POSTGRES_* 分离参数
  //   - NUXT_REDIS_URL 或 NUXT_REDIS_* 分离参数
  //   - 其他 NUXT_GITEA_*, NUXT_FEISHU_* 等
  runtimeConfig: {
    // 数据库与缓存
    databaseUrl: "",
    postgresDb: "",
    postgresUser: "",
    postgresPassword: "",
    postgresHost: "",
    postgresPort: "",
    redisUrl: "",
    redisHost: "",
    redisPort: "",
    redisPassword: "",
    // Gitea
    giteaUrl: "",
    giteaClientId: "",
    giteaClientSecret: "",
    giteaWebhookSecret: "",
    giteaServiceToken: "",
    // 飞书
    feishuAppId: "",
    feishuAppSecret: "",
    feishuEncryptKey: "",
    feishuVerificationToken: "",
    feishuApprovalCode: "",
    // 安全
    tokenEncryptSecret: "",
    // Agents 元数据仓库与提交身份配置
    agentMetaRepoUrl: "",
    agentMetaRepoBranch: "main",
    agentMetaRepoAuthType: "token",
    agentMetaRepoToken: "",
    agentBotUsername: "TeaxBot",
    agentBotEmail: "teaxbot@local",
    agentBotToken: "",
    // Agent Runtime（P1）配置
    agentRuntimeRoot: ".teax-agent-runtime",
    agentRuntimeDockerBin: "docker",
    agentRuntimeDockerBaseDockerfile: "docker/base/node24-vscode-browser.Dockerfile",
    agentRuntimeDockerBaseBuildContext: ".",
    agentRuntimeDockerBuildOnStart: true,
    agentRuntimeDockerWorkspaceRoot: "/runtime",
    agentRuntimeKeepWorktreeOnStop: false,
    agentRuntimeOpencodeStartCommand: "",
    // 调试
    verboseDefault: "1",
    cardKitDebug: false,
    // Session
    session: {
      password: "",
    },
    // 公开配置（可暴露到前端）
    public: {
      appName: "Teax",
      appUrl: "http://localhost:3000",
    },
  },

  routeRules: {
    "/": { prerender: true },
    "/:owner/:repo/agents": { ssr: false },
  },
  compatibilityDate: "2025-01-15",

  nitro: {
    // 禁用 prerender，避免 build 阶段执行路由预渲染
    prerender: {
      crawlLinks: false,
      routes: [],
    },
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
