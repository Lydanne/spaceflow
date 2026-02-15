import { detectProvider } from "./detect-provider";

describe("detectProvider", () => {
  // ============ 显式指定 ============

  describe("GIT_PROVIDER_TYPE 显式指定", () => {
    it("指定 github 时应返回 github", () => {
      const result = detectProvider({ GIT_PROVIDER_TYPE: "github", GITHUB_TOKEN: "ghp-xxx" });
      expect(result.provider).toBe("github");
      expect(result.source).toContain("GIT_PROVIDER_TYPE");
    });

    it("指定 gitea 时应返回 gitea", () => {
      const result = detectProvider({ GIT_PROVIDER_TYPE: "gitea", GITEA_TOKEN: "tok" });
      expect(result.provider).toBe("gitea");
      expect(result.source).toContain("GIT_PROVIDER_TYPE");
    });

    it("指定 gitlab 时应返回 gitlab", () => {
      const result = detectProvider({ GIT_PROVIDER_TYPE: "gitlab", GITLAB_TOKEN: "tok" });
      expect(result.provider).toBe("gitlab");
      expect(result.source).toContain("GIT_PROVIDER_TYPE");
    });

    it("指定无效值时应走自动检测", () => {
      const result = detectProvider({ GIT_PROVIDER_TYPE: "bitbucket" });
      expect(result.provider).toBe("github");
      expect(result.source).toBe("默认");
    });
  });

  // ============ GITEA_TOKEN 检测 ============

  describe("GITEA_TOKEN 检测", () => {
    it("有 GITEA_TOKEN 时应识别为 gitea", () => {
      const result = detectProvider({
        GITEA_TOKEN: "tok",
        GITEA_SERVER_URL: "https://gitea.example.com",
      });
      expect(result.provider).toBe("gitea");
      expect(result.serverUrl).toBe("https://gitea.example.com");
      expect(result.token).toBe("tok");
      expect(result.source).toContain("GITEA_TOKEN");
    });

    it("GITEA_TOKEN 优先于 GITHUB_TOKEN", () => {
      const result = detectProvider({
        GITEA_TOKEN: "gitea-tok",
        GITHUB_TOKEN: "gh-tok",
        GITHUB_SERVER_URL: "https://github.com",
      });
      expect(result.provider).toBe("gitea");
      expect(result.token).toBe("gitea-tok");
    });
  });

  // ============ GITLAB_TOKEN / CI_JOB_TOKEN 检测 ============

  describe("GitLab 检测", () => {
    it("有 GITLAB_TOKEN 时应识别为 gitlab", () => {
      const result = detectProvider({
        GITLAB_TOKEN: "glpat-xxx",
        CI_SERVER_URL: "https://gitlab.example.com",
      });
      expect(result.provider).toBe("gitlab");
      expect(result.serverUrl).toBe("https://gitlab.example.com");
      expect(result.token).toBe("glpat-xxx");
      expect(result.source).toContain("GITLAB_TOKEN");
    });

    it("有 CI_JOB_TOKEN 时应识别为 gitlab", () => {
      const result = detectProvider({
        CI_JOB_TOKEN: "ci-tok",
        CI_SERVER_URL: "https://gitlab.company.com",
      });
      expect(result.provider).toBe("gitlab");
      expect(result.serverUrl).toBe("https://gitlab.company.com");
      expect(result.token).toBe("ci-tok");
      expect(result.source).toContain("CI_JOB_TOKEN");
    });

    it("未指定 CI_SERVER_URL 时应使用默认 gitlab.com", () => {
      const result = detectProvider({ GITLAB_TOKEN: "glpat-xxx" });
      expect(result.provider).toBe("gitlab");
      expect(result.serverUrl).toBe("https://gitlab.com");
    });

    it("GITEA_TOKEN 优先于 GITLAB_TOKEN", () => {
      const result = detectProvider({
        GITEA_TOKEN: "gitea-tok",
        GITLAB_TOKEN: "gl-tok",
      });
      expect(result.provider).toBe("gitea");
    });
  });

  // ============ GITHUB_TOKEN 检测 ============

  describe("GITHUB_TOKEN 检测", () => {
    it("GITHUB_TOKEN + github.com 应识别为 github", () => {
      const result = detectProvider({
        GITHUB_TOKEN: "ghp-xxx",
        GITHUB_SERVER_URL: "https://github.com",
        GITHUB_API_URL: "https://api.github.com",
      });
      expect(result.provider).toBe("github");
      expect(result.serverUrl).toBe("https://api.github.com");
      expect(result.token).toBe("ghp-xxx");
      expect(result.source).toContain("GITHUB_TOKEN");
    });

    it("GITHUB_TOKEN + 子域名也应识别为 github", () => {
      const result = detectProvider({
        GITHUB_TOKEN: "ghp-xxx",
        GITHUB_SERVER_URL: "https://enterprise.github.com",
      });
      expect(result.provider).toBe("github");
    });

    it("GITHUB_TOKEN + 自定义域名也应识别为 github", () => {
      const result = detectProvider({
        GITHUB_TOKEN: "tok",
        GITHUB_SERVER_URL: "https://git.example.com",
      });
      expect(result.provider).toBe("github");
      expect(result.token).toBe("tok");
      expect(result.source).toContain("GITHUB_TOKEN");
    });

    it("GITHUB_TOKEN 无 SERVER_URL 应识别为 github", () => {
      const result = detectProvider({ GITHUB_TOKEN: "tok" });
      expect(result.provider).toBe("github");
      expect(result.source).toContain("GITHUB_TOKEN");
    });
  });

  // ============ 默认 ============

  describe("无任何环境变量", () => {
    it("应默认为 github", () => {
      const result = detectProvider({});
      expect(result.provider).toBe("github");
      expect(result.serverUrl).toBe("https://api.github.com");
      expect(result.token).toBe("");
      expect(result.source).toBe("默认");
    });
  });

  // ============ GIT_PROVIDER_URL / GIT_PROVIDER_TOKEN 优先级 ============

  describe("GIT_PROVIDER_URL / GIT_PROVIDER_TOKEN 优先级", () => {
    it("GIT_PROVIDER_URL 应覆盖自动检测的 URL", () => {
      const result = detectProvider({
        GITEA_TOKEN: "tok",
        GITEA_SERVER_URL: "https://gitea.example.com",
        GIT_PROVIDER_URL: "https://custom.example.com",
      });
      expect(result.serverUrl).toBe("https://custom.example.com");
    });

    it("GIT_PROVIDER_TOKEN 应覆盖自动检测的 token", () => {
      const result = detectProvider({
        GITEA_TOKEN: "gitea-tok",
        GIT_PROVIDER_TOKEN: "custom-tok",
      });
      expect(result.token).toBe("custom-tok");
    });
  });

  // ============ GitHub 默认 API URL ============

  describe("GitHub 默认 API URL", () => {
    it("未指定 GITHUB_API_URL 时应使用默认值", () => {
      const result = detectProvider({
        GIT_PROVIDER_TYPE: "github",
        GITHUB_TOKEN: "ghp-xxx",
      });
      expect(result.serverUrl).toBe("https://api.github.com");
    });
  });

  // ============ Gitea Actions 场景（显式指定 GIT_PROVIDER_TYPE） ============

  describe("Gitea Actions 场景", () => {
    it("显式指定 gitea 时应回退到 GITHUB_SERVER_URL", () => {
      const result = detectProvider({
        GIT_PROVIDER_TYPE: "gitea",
        GITHUB_TOKEN: "tok",
        GITHUB_SERVER_URL: "https://git.bjxgj.com",
      });
      expect(result.provider).toBe("gitea");
      expect(result.serverUrl).toBe("https://git.bjxgj.com");
    });
  });
});
