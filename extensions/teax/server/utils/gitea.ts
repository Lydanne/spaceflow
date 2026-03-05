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
    events: string[] = ["push"],
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

  async deleteWebhook(owner: string, repo: string, hookId: number): Promise<void> {
    await this.fetch(`/repos/${owner}/${repo}/hooks/${hookId}`, "DELETE");
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
