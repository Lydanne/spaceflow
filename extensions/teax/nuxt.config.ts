// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ["@nuxt/eslint", "@nuxt/ui", "nuxt-auth-utils", "@nuxtjs/mdc"],

  devtools: {
    enabled: true,
  },

  css: ["~/assets/css/main.css"],

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/teax",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    giteaUrl: process.env.GITEA_URL || "",
    giteaClientId: process.env.GITEA_CLIENT_ID || "",
    giteaClientSecret: process.env.GITEA_CLIENT_SECRET || "",
    feishuAppId: process.env.FEISHU_APP_ID || "",
    feishuAppSecret: process.env.FEISHU_APP_SECRET || "",
    feishuEncryptKey: process.env.FEISHU_ENCRYPT_KEY || "",
    feishuVerificationToken: process.env.FEISHU_VERIFICATION_TOKEN || "",
    feishuApprovalCode: process.env.FEISHU_APPROVAL_CODE || "",
    giteaServiceToken: process.env.GITEA_SERVICE_TOKEN || "",
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
    typescript: {
      tsConfig: {
        include: ["../auth.d.ts"],
      },
    },
  },

  eslint: {
    config: {
      stylistic: {
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
