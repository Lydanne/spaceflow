import type { H3Event } from "h3";
import { resolveVerboseLevel } from "~~/server/utils/verbose";

export interface GiteaUser {
  id: number;
  login: string;
  full_name: string;
  email: string;
  avatar_url: string;
  is_admin: boolean;
}

export interface GiteaOrganization {
  id: number;
  name: string;
  full_name: string;
  avatar_url: string;
  description: string;
}

export interface GiteaTeam {
  id: number;
  name: string;
  description: string;
  organization: {
    id: number;
    name: string;
  };
  permission: string;
  units: string[];
}

export interface GiteaTeamMember {
  id: number;
  login: string;
  email: string;
  avatar_url: string;
}

export interface GiteaRepository {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  default_branch: string;
  owner: {
    id: number;
    login: string;
    avatar_url: string;
  };
  private: boolean;
  fork: boolean;
  archived: boolean;
  updated_at: string;
  stars_count: number;
  forks_count: number;
  language: string;
}

export interface GiteaBranch {
  name: string;
  commit: {
    id: string;
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  protected: boolean;
}

export interface GiteaWebhook {
  id: number;
  type: string;
  url: string;
  active: boolean;
  events: string[];
  config: {
    url: string;
    content_type: string;
    secret: string;
  };
}

export interface GiteaCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
}

export interface GiteaWorkflowRunActor {
  id: number;
  login: string;
  avatar_url: string;
}

export interface GiteaWorkflowRun {
  id: number;
  run_number: number;
  display_title: string;
  status: string;
  conclusion: string;
  event: string;
  head_branch: string;
  head_sha: string;
  path: string;
  html_url: string;
  started_at: string;
  completed_at: string | null;
  actor: GiteaWorkflowRunActor;
  trigger_actor: GiteaWorkflowRunActor;
}

export interface GiteaWorkflowRunsList {
  total_count: number;
  workflow_runs: GiteaWorkflowRun[];
}

export interface GiteaWorkflow {
  id: number;
  name: string;
  path: string;
  state: string;
}

export interface GiteaWorkflowsList {
  total_count: number;
  workflows: GiteaWorkflow[];
}

export interface GiteaWorkflowRunDetail extends GiteaWorkflowRun {
  workflow_id: number;
  repository?: { id: number; full_name: string };
}

export interface GiteaWorkflowJobStep {
  name: string;
  number: number;
  status: string;
  conclusion: string;
  started_at: string;
  completed_at: string | null;
}

export interface GiteaWorkflowJob {
  id: number;
  run_id: number;
  name: string;
  status: string;
  conclusion: string;
  started_at: string;
  completed_at: string | null;
  steps: GiteaWorkflowJobStep[] | null;
  runner_name?: string;
  labels?: string[];
}

export interface GiteaWorkflowJobsList {
  total_count: number;
  jobs: GiteaWorkflowJob[];
}

export interface GiteaAccessToken {
  id: number;
  name: string;
  sha1: string;
  token_last_eight: string;
  scopes: string[];
}

export class GiteaService {
  private baseUrl: string;
  private accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.accessToken = accessToken;
  }

  private async fetch(
    path: string,
    method: string = "GET",
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${this.baseUrl}/api/v1${path}`;
    const result = await $fetch(url, {
      method: method as "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
      headers: {
        Authorization: `token ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      ...(body ? { body } : {}),
    });
    return result;
  }

  private async fetchAllPages<T>(basePath: string, pageSize = 50): Promise<T[]> {
    const all: T[] = [];
    let page = 1;
    const separator = basePath.includes("?") ? "&" : "?";
    while (true) {
      const items = (await this.fetch(
        `${basePath}${separator}page=${page}&limit=${pageSize}`,
      )) as T[];
      all.push(...items);
      if (items.length < pageSize) break;
      page++;
    }
    return all;
  }

  async getCurrentUser(): Promise<GiteaUser> {
    return this.fetch("/user") as Promise<GiteaUser>;
  }

  async getUserOrgs(): Promise<GiteaOrganization[]> {
    return this.fetch("/user/orgs?limit=50") as Promise<GiteaOrganization[]>;
  }

  async getUserOrgsByUsername(username: string): Promise<GiteaOrganization[]> {
    return this.fetch(`/users/${username}/orgs?limit=50`) as Promise<GiteaOrganization[]>;
  }

  async getOrgTeams(orgName: string): Promise<GiteaTeam[]> {
    return this.fetch(`/orgs/${orgName}/teams?limit=50`) as Promise<GiteaTeam[]>;
  }

  async getOrgTeamsAll(orgName: string): Promise<GiteaTeam[]> {
    return this.fetchAllPages<GiteaTeam>(`/orgs/${orgName}/teams`);
  }

  async getTeamMembers(teamId: number): Promise<GiteaTeamMember[]> {
    return this.fetch(`/teams/${teamId}/members?limit=50`) as Promise<GiteaTeamMember[]>;
  }

  async getTeamMembersAll(teamId: number): Promise<GiteaTeamMember[]> {
    return this.fetchAllPages<GiteaTeamMember>(`/teams/${teamId}/members`);
  }

  async getOrgRepos(orgName: string, page = 1, limit = 20): Promise<GiteaRepository[]> {
    return this.fetch(`/orgs/${orgName}/repos?page=${page}&limit=${limit}&sort=updated`) as Promise<
      GiteaRepository[]
    >;
  }

  async searchRepos(orgName: string, query: string, limit = 20): Promise<GiteaRepository[]> {
    const result = (await this.fetch(
      `/repos/search?q=${encodeURIComponent(query)}&owner=${orgName}&limit=${limit}`,
    )) as { data: GiteaRepository[] };
    return result.data || [];
  }

  async getOrgRepoCount(orgName: string): Promise<number> {
    const result = (await this.fetch(
      `/repos/search?owner=${orgName}&limit=1`,
    )) as { data: unknown[]; ok: boolean; total_count?: number };
    return result.total_count ?? result.data?.length ?? 0;
  }

  async getRepo(owner: string, repo: string): Promise<GiteaRepository> {
    return this.fetch(`/repos/${owner}/${repo}`) as Promise<GiteaRepository>;
  }

  async getRepoBranches(owner: string, repo: string): Promise<GiteaBranch[]> {
    return this.fetch(`/repos/${owner}/${repo}/branches?limit=50`) as Promise<GiteaBranch[]>;
  }

  async getRepoCommits(
    owner: string,
    repo: string,
    branch?: string,
    limit = 10,
  ): Promise<GiteaCommit[]> {
    const query = branch ? `&sha=${encodeURIComponent(branch)}` : "";
    return this.fetch(`/repos/${owner}/${repo}/commits?limit=${limit}${query}`) as Promise<
      GiteaCommit[]
    >;
  }

  async createWebhook(
    owner: string,
    repo: string,
    url: string,
    secret: string,
    events: string[] = [
      "create",
      "delete",
      "fork",
      "push",
      "issues",
      "issue_assign",
      "issue_label",
      "issue_milestone",
      "issue_comment",
      "pull_request",
      "pull_request_assign",
      "pull_request_label",
      "pull_request_milestone",
      "pull_request_comment",
      "pull_request_review_approved",
      "pull_request_review_rejected",
      "pull_request_review_comment",
      "pull_request_sync",
      "wiki",
      "repository",
      "release",
      "package",
      "status",
      "workflow_run",
      "workflow_job",
    ], // 默认订阅所有 Gitea 支持的事件（使用 Gitea 源码中的小写下划线格式）
  ): Promise<GiteaWebhook> {
    return this.fetch(`/repos/${owner}/${repo}/hooks`, "POST", {
      type: "gitea",
      config: {
        url,
        content_type: "json",
        secret,
      },
      events,
      active: true,
    }) as Promise<GiteaWebhook>;
  }

  async getWebhook(owner: string, repo: string, hookId: number): Promise<GiteaWebhook> {
    return this.fetch(`/repos/${owner}/${repo}/hooks/${hookId}`) as Promise<GiteaWebhook>;
  }

  async updateWebhook(
    owner: string,
    repo: string,
    hookId: number,
    data: {
      active?: boolean;
      events?: string[];
      config?: {
        url?: string;
        content_type?: string;
        secret?: string;
      };
    },
  ): Promise<GiteaWebhook> {
    return this.fetch(`/repos/${owner}/${repo}/hooks/${hookId}`, "PATCH", data) as Promise<GiteaWebhook>;
  }

  async deleteWebhook(owner: string, repo: string, hookId: number): Promise<void> {
    await this.fetch(`/repos/${owner}/${repo}/hooks/${hookId}`, "DELETE");
  }

  // System Hooks (Admin only)
  async listSystemHooks(): Promise<GiteaWebhook[]> {
    return this.fetch("/admin/hooks") as Promise<GiteaWebhook[]>;
  }

  async createSystemHook(
    url: string,
    secret: string,
    events: string[] = [
      "create",
      "delete",
      "fork",
      "push",
      "issues",
      "issue_assign",
      "issue_label",
      "issue_milestone",
      "issue_comment",
      "pull_request",
      "pull_request_assign",
      "pull_request_label",
      "pull_request_milestone",
      "pull_request_comment",
      "pull_request_review_approved",
      "pull_request_review_rejected",
      "pull_request_review_comment",
      "pull_request_sync",
      "wiki",
      "repository",
      "release",
      "package",
      "status",
      "workflow_run",
      "workflow_job",
    ],
  ): Promise<GiteaWebhook> {
    return this.fetch("/admin/hooks", "POST", {
      type: "gitea",
      branch_filter: "*",
      config: {
        url,
        content_type: "json",
        secret,
        is_system_webhook: true, // 创建系统钩子而不是默认钩子
      },
      events,
      active: true,
    }) as Promise<GiteaWebhook>;
  }

  async getSystemHook(hookId: number): Promise<GiteaWebhook> {
    return this.fetch(`/admin/hooks/${hookId}`) as Promise<GiteaWebhook>;
  }

  async updateSystemHook(
    hookId: number,
    data: {
      active?: boolean;
      events?: string[];
      config?: {
        url?: string;
        content_type?: string;
        secret?: string;
      };
    },
  ): Promise<GiteaWebhook> {
    return this.fetch(`/admin/hooks/${hookId}`, "PATCH", data) as Promise<GiteaWebhook>;
  }

  async deleteSystemHook(hookId: number): Promise<void> {
    await this.fetch(`/admin/hooks/${hookId}`, "DELETE");
  }

  async getRepoWorkflowRuns(
    owner: string,
    repo: string,
    page = 1,
    limit = 20,
  ): Promise<GiteaWorkflowRunsList> {
    return this.fetch(
      `/repos/${owner}/${repo}/actions/runs?page=${page}&limit=${limit}`,
    ) as Promise<GiteaWorkflowRunsList>;
  }

  async getFileContent(
    owner: string,
    repo: string,
    filepath: string,
    ref?: string,
  ): Promise<string | null> {
    try {
      const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
      const result = (await this.fetch(`/repos/${owner}/${repo}/contents/${filepath}${query}`)) as {
        content?: string;
        encoding?: string;
      };
      if (result.content && result.encoding === "base64") {
        return Buffer.from(result.content, "base64").toString("utf-8");
      }
      return null;
    } catch {
      return null;
    }
  }

  async getRepoWorkflows(owner: string, repo: string): Promise<GiteaWorkflowsList> {
    return this.fetch(`/repos/${owner}/${repo}/actions/workflows`) as Promise<GiteaWorkflowsList>;
  }

  async dispatchWorkflow(
    owner: string,
    repo: string,
    workflowId: string,
    ref: string,
    inputs?: Record<string, string | boolean | number>,
  ): Promise<void> {
    // Gitea API 要求 inputs 值必须是 string，自动转换 boolean/number
    const stringifiedInputs: Record<string, string> = {};
    if (inputs) {
      for (const [key, value] of Object.entries(inputs)) {
        stringifiedInputs[key] = String(value);
      }
    }

    await this.fetch(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, "POST", {
      ref,
      inputs: stringifiedInputs,
    });
  }

  async listAccessTokens(username: string): Promise<GiteaAccessToken[]> {
    return this.fetch(`/users/${username}/tokens`) as Promise<GiteaAccessToken[]>;
  }

  async createAccessToken(
    username: string,
    name: string,
    scopes: string[],
  ): Promise<GiteaAccessToken> {
    return this.fetch(`/users/${username}/tokens`, "POST", {
      name,
      scopes,
    }) as Promise<GiteaAccessToken>;
  }

  async deleteAccessToken(username: string, tokenId: number): Promise<void> {
    await this.fetch(`/users/${username}/tokens/${tokenId}`, "DELETE");
  }

  async getWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<GiteaWorkflowRunDetail> {
    return this.fetch(
      `/repos/${owner}/${repo}/actions/runs/${runId}`,
    ) as Promise<GiteaWorkflowRunDetail>;
  }

  async getWorkflowRunJobs(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<GiteaWorkflowJobsList> {
    return this.fetch(
      `/repos/${owner}/${repo}/actions/runs/${runId}/jobs`,
    ) as Promise<GiteaWorkflowJobsList>;
  }

  async cancelWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<void> {
    await this.fetch(`/repos/${owner}/${repo}/actions/runs/${runId}`, "DELETE");
  }

  async rerunWorkflowRun(
    owner: string,
    repo: string,
    runId: number,
  ): Promise<void> {
    await this.fetch(`/repos/${owner}/${repo}/actions/runs/${runId}/rerun`, "POST");
  }

  async getWorkflowJobLogs(
    owner: string,
    repo: string,
    jobId: number,
  ): Promise<string> {
    const url = `${this.baseUrl}/api/v1/repos/${owner}/${repo}/actions/jobs/${jobId}/logs`;
    const response = await fetch(url, {
      headers: {
        Authorization: `token ${this.accessToken}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch job logs: ${response.status}`);
    }
    return response.text();
  }
}

export function createGiteaService(accessToken: string): GiteaService {
  const config = useRuntimeConfig();
  return new GiteaService(config.giteaUrl, accessToken);
}

export interface GiteaOAuthTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token: string;
  expires_in: number;
}

export async function exchangeGiteaCode(code: string): Promise<GiteaOAuthTokenResponse> {
  const config = useRuntimeConfig();
  const response = await $fetch<GiteaOAuthTokenResponse>(
    `${config.giteaUrl}/login/oauth/access_token`,
    {
      method: "POST",
      body: {
        client_id: config.giteaClientId,
        client_secret: config.giteaClientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${config.public.appUrl}/api/auth/callback/gitea`,
      },
    },
  );
  return response;
}

export async function refreshGiteaToken(refreshToken: string): Promise<GiteaOAuthTokenResponse> {
  const config = useRuntimeConfig();
  const response = await $fetch<GiteaOAuthTokenResponse>(
    `${config.giteaUrl}/login/oauth/access_token`,
    {
      method: "POST",
      body: {
        client_id: config.giteaClientId,
        client_secret: config.giteaClientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      },
    },
  );
  return response;
}

// ─── Gitea SDK 统一入口 ─────────────────────────────────────────

type GiteaRole = "admin" | "user" | "fallback-admin";

/** 用户 token 提供者回调 */
export type UserTokenProvider = () => Promise<
  { accessToken: string; refreshToken: string } | null
>;

interface GiteaSdkContext {
  event?: H3Event;
  /** 自定义 token 提供者（用于非 H3Event 场景，如飞书卡片交互） */
  userTokenProvider?: UserTokenProvider;
}

interface GiteaSdk {
  /**
   * 选择角色创建 GiteaService
   * - 'admin': 始终使用 Service Token（后台操作、webhook、同步等）
   * - 'fallback-admin': 优先用户 token，失败时 fallback 到 Service Token（卡片/bot 交互场景）
   * - 'user': 必须使用用户 OAuth Token，失败则报错（需要传入 event 或 userTokenProvider）
   */
  role(
    role: GiteaRole,
    options?: {
      verbose?: number;
      logTag?: string;
    },
  ): Promise<GiteaService>;
}

/**
 * 创建 Gitea SDK 入口
 * @example
 * // 使用管理员 token
 * const gitea = await useGiteaSdk().role('admin');
 * await gitea.listSystemHooks();
 *
 * // 使用用户 token（通过 H3Event）
 * const gitea = await useGiteaSdk(event).role('user');
 * await gitea.dispatchWorkflow(owner, repo, workflowId, ref);
 *
 * // 使用用户 token（通过 botLogin，飞书卡片交互场景）
 * const gitea = await useGiteaSdk(botLogin(openId)).role('fallback-admin');
 */
export function useGiteaSdk(
  eventOrOptions?: H3Event | { userTokenProvider: UserTokenProvider },
): GiteaSdk {
  const ctx: GiteaSdkContext
    = !eventOrOptions || "userTokenProvider" in eventOrOptions
      ? { userTokenProvider: eventOrOptions?.userTokenProvider }
      : { event: eventOrOptions };

  // 获取用户 token 并验证/刷新
  async function getUserGiteaService(): Promise<GiteaService | null> {
    // 优先使用自定义 token 提供者
    if (ctx.userTokenProvider) {
      const tokens = await ctx.userTokenProvider();
      if (!tokens) return null;

      const gitea = createGiteaService(tokens.accessToken);
      try {
        await gitea.getCurrentUser();
        return gitea;
      } catch {
        // Token 无效，尝试刷新
        if (!tokens.refreshToken) return null;
      }

      try {
        const tokenResponse = await refreshGiteaToken(tokens.refreshToken);
        return createGiteaService(tokenResponse.access_token);
      } catch {
        return null;
      }
    }

    // 使用 H3Event 获取 session token
    if (!ctx.event) return null;

    const session = await getUserSession(ctx.event);
    const giteaAccessToken = session?.giteaAccessToken;
    const giteaRefreshToken = session?.giteaRefreshToken;

    if (!giteaAccessToken) return null;

    const gitea = createGiteaService(giteaAccessToken);

    // 尝试验证 token 是否有效
    try {
      await gitea.getCurrentUser();
      return gitea;
    } catch (err: unknown) {
      const status
        = (err as { statusCode?: number })?.statusCode
          || (err as { status?: number })?.status;

      // 非 401 错误，直接抛出
      if (status !== 401) {
        throw err;
      }

      // 无 refresh token，返回 null
      if (!giteaRefreshToken) {
        return null;
      }
    }

    // Token 过期，尝试刷新
    try {
      const tokenResponse = await refreshGiteaToken(giteaRefreshToken);

      // 更新 session（保留原有字段，只更新 token）
      await setUserSession(ctx.event, {
        ...session!,
        giteaAccessToken: tokenResponse.access_token,
        giteaRefreshToken: tokenResponse.refresh_token,
      });

      // 同步更新 DB 中的 token
      const userId = session?.user?.id;
      if (userId) {
        const { updateUserGiteaToken } = await import("~~/server/services/auth.service");
        await updateUserGiteaToken(userId, {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
          expiresIn: tokenResponse.expires_in,
        }).catch((err) => {
          console.error("Failed to update Gitea token in DB:", err);
        });
      }

      return createGiteaService(tokenResponse.access_token);
    } catch {
      return null;
    }
  }

  // 获取 service token
  function getServiceGiteaService(): GiteaService {
    const config = useRuntimeConfig();
    if (!config.giteaServiceToken) {
      throw createError({
        statusCode: 503,
        message: "GITEA_SERVICE_TOKEN is not configured.",
      });
    }
    return createGiteaService(config.giteaServiceToken);
  }

  return {
    async role(
      role: GiteaRole,
      options?: {
        verbose?: number;
        logTag?: string;
      },
    ): Promise<GiteaService> {
      const verbose = resolveVerboseLevel(options?.verbose);
      const tag = options?.logTag ? `[gitea-sdk:${options.logTag}]` : "[gitea-sdk]";

      if (role === "fallback-admin") {
        // fallback-admin：有 event/provider 时优先用户 token，失败后回退 service token
        if (ctx.event || ctx.userTokenProvider) {
          const userGitea = await getUserGiteaService();
          if (userGitea) {
            if (verbose >= 2) {
              console.log(`${tag} role=fallback-admin, using user token`);
            }
            return userGitea;
          }
          if (verbose >= 1) {
            console.warn(`${tag} role=fallback-admin, user token unavailable, fallback to service token`);
          }
        } else if (verbose >= 1) {
          console.warn(`${tag} role=fallback-admin, missing user context, fallback to service token`);
        }
        return getServiceGiteaService();
      }
      if (role === "admin") {
        if (verbose >= 2) {
          console.log(`${tag} role=admin, using service token`);
        }
        return getServiceGiteaService();
      }

      // role === 'user'：必须有 event 或 userTokenProvider，必须有用户 token
      if (!ctx.event && !ctx.userTokenProvider) {
        throw createError({
          statusCode: 500,
          message: "useGiteaSdk: event or userTokenProvider is required for user role",
        });
      }

      const userGitea = await getUserGiteaService();
      if (!userGitea) {
        if (verbose >= 1) {
          console.warn(`${tag} role=user, user token unavailable`);
        }
        throw createError({
          statusCode: 401,
          message: "User not authenticated or Gitea token expired",
        });
      }

      if (verbose >= 2) {
        console.log(`${tag} role=user, using user token`);
      }

      return userGitea;
    },
  };
}

/**
 * 创建飞书卡片交互场景的 userTokenProvider。
 * 通过 openId 查找已绑定账号的 Gitea token。
 *
 * @example
 * const gitea = useGiteaSdk(botLogin(openId));
 * const service = await gitea.role("fallback-admin"); // 优先用户 token，fallback service token
 */
export function botLogin(openId: string): { userTokenProvider: UserTokenProvider } {
  return {
    userTokenProvider: async () => {
      const { getActiveAccount } = await import("~~/server/services/account.service");
      const { getUserGiteaTokens } = await import("~~/server/services/auth.service");
      const user = await getActiveAccount(openId);
      return user ? getUserGiteaTokens(user.id) : null;
    },
  };
}
