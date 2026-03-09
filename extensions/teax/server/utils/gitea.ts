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
    inputs?: Record<string, string>,
  ): Promise<void> {
    await this.fetch(`/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, "POST", {
      ref,
      inputs: inputs || {},
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

/**
 * 使用全局 service token 创建 GiteaService。
 * 从环境变量 GITEA_SERVICE_TOKEN 读取 Gitea PAT。
 * 未配置时抛出 503 错误。
 */
export async function createServiceGiteaClient(): Promise<GiteaService> {
  const config = useRuntimeConfig();

  if (!config.giteaServiceToken) {
    throw createError({
      statusCode: 503,
      message: "GITEA_SERVICE_TOKEN is not configured.",
    });
  }

  return createGiteaService(config.giteaServiceToken);
}
