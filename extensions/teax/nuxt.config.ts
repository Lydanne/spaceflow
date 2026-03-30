// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui", "nuxt-auth-utils", "@nuxtjs/mdc"],

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  // 仅声明 runtimeConfig 键，值由运行时 NUXT_* 环境变量注入
  runtimeConfig: {
    databaseUrl: "",
    redisUrl: "",
    giteaUrl: "",
    giteaClientId: "",
    giteaClientSecret: "",
    giteaWebhookSecret: "",
    feishuAppId: "",
    feishuAppSecret: "",
    feishuEncryptKey: "",
    feishuVerificationToken: "",
    feishuApprovalCode: "",
    giteaServiceToken: "",
    tokenEncryptSecret: "",
    verboseDefault: "1",
    cardKitDebug: false,
    session: {
      password: "",
    },
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || "Teax",
      appUrl: process.env.NUXT_PUBLIC_APP_URL || "http://localhost:3000",
    },
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
