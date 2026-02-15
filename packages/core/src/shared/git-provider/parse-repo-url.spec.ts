import { parseRepoUrl } from "./parse-repo-url";

describe("parseRepoUrl", () => {
  // ============ Gitea 仓库 URL ============

  describe("Gitea 仓库 URL", () => {
    it("应解析仓库根目录 URL（未知域名默认为 github）", () => {
      const result = parseRepoUrl("https://git.bjxgj.com/xgj/review-spec");
      expect(result).toEqual({
        owner: "xgj",
        repo: "review-spec",
        path: "",
        provider: "github",
        serverUrl: "https://git.bjxgj.com",
      });
    });

    it("应解析带 /src/branch/ 的目录 URL", () => {
      const result = parseRepoUrl(
        "https://git.bjxgj.com/xgj/review-spec/src/branch/main/references",
      );
      expect(result).toEqual({
        owner: "xgj",
        repo: "review-spec",
        path: "references",
        ref: "main",
        provider: "gitea",
        serverUrl: "https://git.bjxgj.com",
      });
    });

    it("应解析多层子目录路径", () => {
      const result = parseRepoUrl(
        "https://git.example.com/org/repo/src/branch/develop/path/to/specs",
      );
      expect(result).toEqual({
        owner: "org",
        repo: "repo",
        path: "path/to/specs",
        ref: "develop",
        provider: "gitea",
        serverUrl: "https://git.example.com",
      });
    });

    it("应解析 /src/tag/ URL", () => {
      const result = parseRepoUrl("https://git.example.com/org/repo/src/tag/v1.0/docs");
      expect(result).toEqual({
        owner: "org",
        repo: "repo",
        path: "docs",
        ref: "v1.0",
        provider: "gitea",
        serverUrl: "https://git.example.com",
      });
    });

    it("应解析 /src/commit/ URL", () => {
      const result = parseRepoUrl("https://git.example.com/org/repo/src/commit/abc123/docs");
      expect(result).toEqual({
        owner: "org",
        repo: "repo",
        path: "docs",
        ref: "abc123",
        provider: "gitea",
        serverUrl: "https://git.example.com",
      });
    });

    it("分支目录但无子路径时 path 应为空", () => {
      const result = parseRepoUrl("https://git.example.com/org/repo/src/branch/main");
      expect(result?.path).toBe("");
      expect(result?.ref).toBe("main");
    });
  });

  // ============ GitHub 仓库 URL ============

  describe("GitHub 仓库 URL", () => {
    it("应解析仓库根目录 URL", () => {
      const result = parseRepoUrl("https://github.com/facebook/react");
      expect(result).toEqual({
        owner: "facebook",
        repo: "react",
        path: "",
        provider: "github",
        serverUrl: "https://github.com",
      });
    });

    it("应解析 /tree/ 目录 URL", () => {
      const result = parseRepoUrl("https://github.com/org/repo/tree/main/docs/specs");
      expect(result).toEqual({
        owner: "org",
        repo: "repo",
        path: "docs/specs",
        ref: "main",
        provider: "github",
        serverUrl: "https://github.com",
      });
    });

    it("分支目录但无子路径时 path 应为空", () => {
      const result = parseRepoUrl("https://github.com/org/repo/tree/develop");
      expect(result?.path).toBe("");
      expect(result?.ref).toBe("develop");
    });
  });

  // ============ GitLab 仓库 URL ============

  describe("GitLab 仓库 URL", () => {
    it("应解析仓库根目录 URL", () => {
      const result = parseRepoUrl("https://gitlab.com/org/repo");
      expect(result).toEqual({
        owner: "org",
        repo: "repo",
        path: "",
        provider: "gitlab",
        serverUrl: "https://gitlab.com",
      });
    });

    it("应解析 /-/tree/ 目录 URL", () => {
      const result = parseRepoUrl("https://gitlab.com/org/repo/-/tree/main/docs/specs");
      expect(result).toEqual({
        owner: "org",
        repo: "repo",
        path: "docs/specs",
        ref: "main",
        provider: "gitlab",
        serverUrl: "https://gitlab.com",
      });
    });

    it("分支目录但无子路径时 path 应为空", () => {
      const result = parseRepoUrl("https://gitlab.com/org/repo/-/tree/develop");
      expect(result?.path).toBe("");
      expect(result?.ref).toBe("develop");
      expect(result?.provider).toBe("gitlab");
    });

    it("应解析 GitLab SSH 格式", () => {
      const result = parseRepoUrl("git@gitlab.com:org/repo.git");
      expect(result?.provider).toBe("gitlab");
      expect(result?.owner).toBe("org");
      expect(result?.repo).toBe("repo");
    });

    it("自建 GitLab 使用 /-/tree/ 格式也应识别", () => {
      const result = parseRepoUrl("https://git.company.com/team/project/-/tree/main/references");
      expect(result?.path).toBe("references");
      expect(result?.ref).toBe("main");
    });
  });

  // ============ SSH URL ============

  describe("SSH URL", () => {
    it("应解析 git@ 格式", () => {
      const result = parseRepoUrl("git@git.bjxgj.com:xgj/review-spec.git");
      expect(result).toEqual({
        owner: "xgj",
        repo: "review-spec",
        path: "",
        provider: "github",
        serverUrl: "https://git.bjxgj.com",
      });
    });

    it("应解析 GitHub SSH 格式", () => {
      const result = parseRepoUrl("git@github.com:org/repo.git");
      expect(result?.provider).toBe("github");
      expect(result?.owner).toBe("org");
      expect(result?.repo).toBe("repo");
    });

    it("应解析 git+ssh:// 格式", () => {
      const result = parseRepoUrl("git+ssh://git@git.bjxgj.com/xgj/review-spec.git");
      expect(result?.owner).toBe("xgj");
      expect(result?.repo).toBe("review-spec");
      expect(result?.provider).toBe("github");
    });
  });

  // ============ 边界情况 ============

  describe("边界情况", () => {
    it("空字符串应返回 null", () => {
      expect(parseRepoUrl("")).toBeNull();
    });

    it("纯文本应返回 null", () => {
      expect(parseRepoUrl("not-a-url")).toBeNull();
    });

    it("只有域名无路径应返回 null", () => {
      expect(parseRepoUrl("https://github.com")).toBeNull();
    });

    it("只有一段路径应返回 null", () => {
      expect(parseRepoUrl("https://github.com/org")).toBeNull();
    });

    it("URL 带尾部斜杠应正常解析", () => {
      const result = parseRepoUrl("https://github.com/org/repo/");
      expect(result?.owner).toBe("org");
      expect(result?.repo).toBe("repo");
    });

    it("URL 带 .git 后缀应去除", () => {
      const result = parseRepoUrl("https://github.com/org/repo.git");
      expect(result?.repo).toBe("repo");
    });

    it("本地路径应返回 null", () => {
      expect(parseRepoUrl("./references")).toBeNull();
      expect(parseRepoUrl("/home/user/specs")).toBeNull();
    });
  });
});
