export interface FeishuUserInfo {
  open_id: string;
  union_id: string;
  name: string;
  avatar_url: string;
  email?: string;
}

export interface FeishuTokenResponse {
  code: number;
  msg: string;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    refresh_expires_in: number;
  };
}

export interface FeishuUserInfoResponse {
  code: number;
  msg: string;
  data: {
    open_id: string;
    union_id: string;
    name: string;
    avatar_url: string;
    email?: string;
  };
}

const FEISHU_BASE_URL = "https://open.feishu.cn/open-apis";

export async function getFeishuAppAccessToken(): Promise<string> {
  const config = useRuntimeConfig();
  const response = await $fetch<{
    code: number;
    msg: string;
    app_access_token: string;
    expire: number;
  }>(`${FEISHU_BASE_URL}/auth/v3/app_access_token/internal`, {
    method: "POST",
    body: {
      app_id: config.feishuAppId,
      app_secret: config.feishuAppSecret,
    },
  });

  if (response.code !== 0) {
    throw new Error(`Feishu app_access_token error: ${response.msg}`);
  }

  return response.app_access_token;
}

export async function exchangeFeishuCode(code: string): Promise<FeishuTokenResponse["data"]> {
  const appAccessToken = await getFeishuAppAccessToken();

  const response = await $fetch<FeishuTokenResponse>(
    `${FEISHU_BASE_URL}/authen/v1/oidc/access_token`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${appAccessToken}`,
      },
      body: {
        grant_type: "authorization_code",
        code,
      },
    },
  );

  if (response.code !== 0) {
    throw new Error(`Feishu token exchange error: ${response.msg}`);
  }

  return response.data;
}

export async function getFeishuUserInfo(accessToken: string): Promise<FeishuUserInfo> {
  const response = await $fetch<FeishuUserInfoResponse>(
    `${FEISHU_BASE_URL}/authen/v1/user_info`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (response.code !== 0) {
    throw new Error(`Feishu user info error: ${response.msg}`);
  }

  return response.data;
}

export function buildFeishuAuthUrl(state: string): string {
  const config = useRuntimeConfig();
  const redirectUri = `${config.public.appUrl}/api/auth/callback/feishu`;

  return `https://open.feishu.cn/open-apis/authen/v1/authorize?app_id=${config.feishuAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}
