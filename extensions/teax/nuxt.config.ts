// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxt/ui', 'nuxt-auth-utils'],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/teax',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    giteaUrl: process.env.GITEA_URL || '',
    giteaClientId: process.env.GITEA_CLIENT_ID || '',
    giteaClientSecret: process.env.GITEA_CLIENT_SECRET || '',
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || ''
    },
    public: {
      appName: process.env.NUXT_PUBLIC_APP_NAME || 'Teax',
      appUrl: process.env.NUXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }
  },

  routeRules: {
    '/': { prerender: true }
  },
  compatibilityDate: '2025-01-15',

  nitro: {
    experimental: {
      tasks: true
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  // 禁用 Google Fonts 和 Google Icons，避免网络超时
  fonts: {
    providers: {
      google: false,
      googleicons: false
    }
  }
})
