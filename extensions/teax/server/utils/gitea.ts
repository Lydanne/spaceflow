export interface GiteaUser {
  id: number
  login: string
  full_name: string
  email: string
  avatar_url: string
  is_admin: boolean
}

export interface GiteaOrganization {
  id: number
  name: string
  full_name: string
  avatar_url: string
  description: string
}

export interface GiteaTeam {
  id: number
  name: string
  description: string
  organization: {
    id: number
    name: string
  }
  permission: string
  units: string[]
}

export interface GiteaTeamMember {
  id: number
  login: string
  email: string
  avatar_url: string
}

export class GiteaService {
  private baseUrl: string
  private accessToken: string

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.accessToken = accessToken
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`
    const response = await $fetch<T>(url, {
      ...options,
      headers: {
        'Authorization': `token ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options?.headers
      }
    })
    return response
  }

  async getCurrentUser(): Promise<GiteaUser> {
    return this.fetch<GiteaUser>('/user')
  }

  async getUserOrgs(): Promise<GiteaOrganization[]> {
    return this.fetch<GiteaOrganization[]>('/user/orgs?limit=50')
  }

  async getOrgTeams(orgName: string): Promise<GiteaTeam[]> {
    return this.fetch<GiteaTeam[]>(`/orgs/${orgName}/teams?limit=50`)
  }

  async getTeamMembers(teamId: number): Promise<GiteaTeamMember[]> {
    return this.fetch<GiteaTeamMember[]>(`/teams/${teamId}/members?limit=50`)
  }
}

export function createGiteaService(accessToken: string): GiteaService {
  const config = useRuntimeConfig()
  return new GiteaService(config.giteaUrl, accessToken)
}

export interface GiteaOAuthTokenResponse {
  access_token: string
  token_type: string
  refresh_token: string
  expires_in: number
}

export async function exchangeGiteaCode(code: string): Promise<GiteaOAuthTokenResponse> {
  const config = useRuntimeConfig()
  const response = await $fetch<GiteaOAuthTokenResponse>(
    `${config.giteaUrl}/login/oauth/access_token`,
    {
      method: 'POST',
      body: {
        client_id: config.giteaClientId,
        client_secret: config.giteaClientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${config.public.appUrl}/auth/callback/gitea`
      }
    }
  )
  return response
}
