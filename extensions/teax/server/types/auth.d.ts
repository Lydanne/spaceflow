declare module "#auth-utils" {
  interface User {
    id: string;
    giteaId: number;
    username: string;
    email: string;
    avatarUrl: string | null;
    isAdmin: boolean | null;
  }

  interface UserSession {
    user: User;
    sessionId: string;
    giteaAccessToken: string;
  }
}

export {};
