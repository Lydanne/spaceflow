declare module "#auth-utils" {
  interface User {
    id: string;
    gitea_id: number;
    username: string;
    email: string;
    avatar_url: string | null;
    is_admin: boolean | null;
  }

  interface UserSession {
    user: User;
    sessionId: string;
    giteaAccessToken: string;
    giteaRefreshToken?: string;
  }
}

export {};
