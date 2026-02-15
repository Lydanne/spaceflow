import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Spaceflow",
  description: "可扩展的 AI 工作流引擎，统一 CI/CD 管理与 AI 代码审查",
  lang: "zh-CN",
  base: "/spaceflow/",

  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/logo.svg" }]],

  themeConfig: {
    nav: [
      { text: "指南", link: "/guide/introduction", activeMatch: "/guide/" },
      {
        text: "参考",
        items: [
          { text: "配置", link: "/reference/config" },
          { text: "CLI 命令", link: "/reference/cli" },
          { text: "Review Spec", link: "/reference/review-spec" },
        ],
      },
      {
        text: "进阶",
        items: [
          { text: "插件开发", link: "/advanced/plugin-development" },
          { text: "核心模块", link: "/advanced/core-modules" },
          { text: "GitHub Actions", link: "/advanced/github-actions" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "入门",
          items: [
            { text: "简介", link: "/guide/introduction" },
            { text: "快速开始", link: "/guide/getting-started" },
            { text: "项目结构", link: "/guide/project-structure" },
          ],
        },
        {
          text: "核心概念",
          items: [
            { text: "配置文件", link: "/guide/configuration" },
            { text: "Extension 系统", link: "/guide/extension-system" },
            { text: "编辑器集成", link: "/guide/editor-integration" },
          ],
        },
        {
          text: "内置命令",
          collapsed: false,
          items: [
            { text: "install — 安装 Extension", link: "/guide/commands/install" },
            { text: "uninstall — 卸载 Extension", link: "/guide/commands/uninstall" },
            { text: "update — 更新依赖", link: "/guide/commands/update" },
            { text: "list — 列出 Extension", link: "/guide/commands/list" },
            { text: "build — 构建", link: "/guide/commands/build" },
            { text: "dev — 开发模式", link: "/guide/commands/dev" },
            { text: "create — 创建模板", link: "/guide/commands/create" },
            { text: "commit — 智能提交", link: "/guide/commands/commit" },
            { text: "setup — 初始化配置", link: "/guide/commands/setup" },
            { text: "schema — 生成 Schema", link: "/guide/commands/schema" },
            { text: "mcp — MCP 服务", link: "/guide/commands/mcp" },
            { text: "runx — 运行命令", link: "/guide/commands/runx" },
            { text: "clear — 清理缓存", link: "/guide/commands/clear" },
          ],
        },
        {
          text: "外部命令",
          collapsed: false,
          items: [
            { text: "review — 代码审查", link: "/guide/commands/review" },
            { text: "publish — 版本发布", link: "/guide/commands/publish" },
            { text: "ci-scripts — 脚本执行", link: "/guide/commands/ci-scripts" },
            { text: "ci-shell — Shell 执行", link: "/guide/commands/ci-shell" },
            { text: "period-summary — 周期总结", link: "/guide/commands/period-summary" },
          ],
        },
      ],
      "/reference/": [
        {
          text: "参考",
          items: [
            { text: "配置参考", link: "/reference/config" },
            { text: "CLI 命令参考", link: "/reference/cli" },
            { text: "Review Spec 规范", link: "/reference/review-spec" },
            { text: "环境变量", link: "/reference/env-variables" },
          ],
        },
      ],
      "/advanced/": [
        {
          text: "进阶",
          items: [
            { text: "插件开发指南", link: "/advanced/plugin-development" },
            { text: "核心模块", link: "/advanced/core-modules" },
            { text: "GitHub Actions", link: "/advanced/github-actions" },
            { text: "i18n 国际化", link: "/advanced/i18n" },
          ],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/Lydanne/spaceflow" }],

    footer: {
      message: "基于 MIT 许可发布",
      copyright: "Copyright © 2024-present Spaceflow Contributors",
    },

    outline: {
      label: "页面导航",
      level: [2, 3],
    },

    docFooter: {
      prev: "上一页",
      next: "下一页",
    },

    lastUpdated: {
      text: "最后更新于",
    },

    search: {
      provider: "local",
      options: {
        translations: {
          button: { buttonText: "搜索文档", buttonAriaLabel: "搜索文档" },
          modal: {
            noResultsText: "无法找到相关结果",
            resetButtonTitle: "清除查询条件",
            footer: { selectText: "选择", navigateText: "切换" },
          },
        },
      },
    },

    returnToTopLabel: "回到顶部",
    sidebarMenuLabel: "菜单",
    darkModeSwitchLabel: "主题",
    lightModeSwitchTitle: "切换到浅色模式",
    darkModeSwitchTitle: "切换到深色模式",
  },

  lastUpdated: true,
});
