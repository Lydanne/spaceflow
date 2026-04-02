// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({

  modules: ["@nuxt/eslint", "@nuxt/ui", "nuxt-auth-utils", "@nuxtjs/mdc"],

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  // 运行时配置：空字符串由 NUXT_* 环境变量运行时注入，避免构建时泄露密钥
  // 环境变量格式：NUXT_{分组}_{属性}，如 NUXT_DATABASE_URL, NUXT_GITEA_CLIENT_ID
  runtimeConfig: {
    // 数据库
    database: {
      url: "",
      db: "",
      user: "",
      password: "",
      host: "",
      port: "",
    },
    // Redis
    redis: {
      url: "",
      host: "",
      port: "",
      password: "",
    },
    // Gitea
    gitea: {
      url: "",
      clientId: "",
      clientSecret: "",
      webhookSecret: "",
      serviceToken: "",
    },
    // 飞书
    feishu: {
      appId: "",
      appSecret: "",
      encryptKey: "",
      verificationToken: "",
      approvalCode: "",
    },
    // 安全
    security: {
      tokenEncryptSecret: "",
    },
    // Agent 元数据仓库与提交身份配置
    agent: {
      metaRepoUrl: "",
      metaRepoBranch: "main",
      metaRepoAuthType: "token",
      metaRepoToken: "",
      botUsername: "TeaxBot",
      botEmail: "teaxbot@local",
      botToken: "",
      // Runtime 配置
      runtimeRoot: ".teax-agent-runtime",
      runtimeDockerBin: "docker",
      runtimeDockerBaseDockerfile: "docker/base/node24-vscode-browser.Dockerfile",
      runtimeDockerBaseBuildContext: ".",
      runtimeDockerBuildOnStart: true,
      runtimeDockerWorkspaceRoot: "/runtime",
      runtimeKeepWorktreeOnStop: false,
      runtimeOpencodeStartCommand: "",
    },
    // 调试
    debug: {
      verboseDefault: "1",
      cardKitDebug: false,
    },
    // Session（nuxt-auth-utils 内置）
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
