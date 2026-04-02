// 当前仅支持 token 鉴权；保留类型别名便于后续扩展 ssh/app 等模式。
type MetaRepoAuthType = "token";

export interface AgentMetaRepoResolvedConfig {
  url: string;
  branch: string;
  authType: MetaRepoAuthType;
  token: string;
  tokenSource: "AGENT_META_REPO_TOKEN" | "AGENT_BOT_TOKEN" | "none";
  botUsername: string;
  botEmail: string;
}

/**
 * 解析元数据仓库配置。
 * 令牌优先级：
 * 1. AGENT_META_REPO_TOKEN（若传入）
 * 2. AGENT_BOT_TOKEN（回退）
 */
export function resolveAgentMetaRepoConfig(): AgentMetaRepoResolvedConfig {
  const config = useRuntimeConfig();
  const rawMetaRepoToken = String(config.agentMetaRepoTokenRaw || "").trim();
  const botToken = String(config.agentBotToken || "").trim();
  // token 解析采用“显式优先”策略：若配置了 AGENT_META_REPO_TOKEN，则完全覆盖 bot token。
  const token = rawMetaRepoToken || botToken;
  const tokenSource
    = rawMetaRepoToken
      ? "AGENT_META_REPO_TOKEN"
      : (botToken ? "AGENT_BOT_TOKEN" : "none");

  return {
    url: String(config.agentMetaRepoUrl || "").trim(),
    branch: String(config.agentMetaRepoBranch || "main").trim() || "main",
    authType: "token",
    token,
    tokenSource,
    botUsername: String(config.agentBotUsername || "TeaxBot").trim() || "TeaxBot",
    botEmail: String(config.agentBotEmail || "teaxbot@local").trim() || "teaxbot@local",
  };
}
