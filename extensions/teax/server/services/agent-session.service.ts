import { and, desc, eq, gt, inArray, or, sql } from "drizzle-orm";
import { schema, useDB } from "~~/server/db";
import {
  cleanupSessionWorktree,
  getSessionWorktreeBySessionId,
  prepareRepoSessionWorktree,
} from "~~/server/services/agent-runtime.service";

/**
 * 当前请求执行主体。
 * service 层只依赖最小鉴权信息，避免与上层 session 结构强耦合。
 */
export interface AgentSessionActor {
  userId: string;
  isAdmin: boolean;
}

/**
 * 通用分页参数。
 */
export interface AgentSessionPagination {
  page: number;
  limit: number;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function isUniqueViolation(error: unknown): boolean {
  const err = error as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/**
 * 写入会话事件（失败不阻断主流程）。
 */
async function appendSessionEvent(params: {
  sessionId: string;
  type: string;
  actorType: "user" | "agent" | "system" | "bot";
  actorId: string;
  payload?: Record<string, unknown>;
}) {
  const db = useDB();
  try {
    // 事件序号在会话内唯一；并发写入冲突时重试，避免活动日志丢失。
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const [maxSeqRow] = await db
        .select({
          maxSeq: sql<number>`COALESCE(MAX(${schema.agentSessionEvents.seq}), 0)`,
        })
        .from(schema.agentSessionEvents)
        .where(eq(schema.agentSessionEvents.session_id, params.sessionId));

      const nextSeq = toNumber(maxSeqRow?.maxSeq) + 1;

      try {
        await db.insert(schema.agentSessionEvents).values({
          session_id: params.sessionId,
          seq: nextSeq,
          type: params.type,
          payload: params.payload || {},
          actor_type: params.actorType,
          actor_id: params.actorId,
        });
        return;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 2) {
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.warn("[agent-session] append event failed:", error);
  }
}

async function getSessionById(sessionId: string, repositoryId: string) {
  const db = useDB();
  const [session] = await db
    .select()
    .from(schema.agentSessions)
    .where(
      and(
        eq(schema.agentSessions.id, sessionId),
        eq(schema.agentSessions.repository_id, repositoryId),
      ),
    )
    .limit(1);

  if (!session) {
    throw createError({ statusCode: 404, message: "Agent session not found" });
  }

  return session;
}

async function getParticipant(sessionId: string, userId: string) {
  const db = useDB();
  const [participant] = await db
    .select()
    .from(schema.agentSessionParticipants)
    .where(
      and(
        eq(schema.agentSessionParticipants.session_id, sessionId),
        eq(schema.agentSessionParticipants.user_id, userId),
      ),
    )
    .limit(1);

  return participant || null;
}

/**
 * 会话读取权限校验：
 * - 管理员可读
 * - owner 可读
 * - public 会话可读
 * - private 会话需在 participant 列表中
 */
async function ensureSessionReadable(
  sessionId: string,
  repositoryId: string,
  actor: AgentSessionActor,
) {
  const session = await getSessionById(sessionId, repositoryId);

  if (actor.isAdmin) {
    return session;
  }
  if (session.creator_id === actor.userId) {
    return session;
  }
  if (session.visibility === "public") {
    return session;
  }

  const participant = await getParticipant(session.id, actor.userId);
  if (!participant) {
    throw createError({ statusCode: 403, message: "No access to this agent session" });
  }

  return session;
}

/**
 * 会话发言权限校验：
 * - 满足读取权限后，进一步校验 can_chat
 * - public 会话允许首次发言自动加入参与者
 */
async function ensureSessionChatAllowed(
  sessionId: string,
  repositoryId: string,
  actor: AgentSessionActor,
) {
  const db = useDB();
  const session = await ensureSessionReadable(sessionId, repositoryId, actor);

  if (actor.isAdmin || session.creator_id === actor.userId) {
    return session;
  }

  const participant = await getParticipant(session.id, actor.userId);
  if (participant) {
    if (!participant.can_chat) {
      throw createError({ statusCode: 403, message: "Chat permission denied in this session" });
    }
    return session;
  }

  if (session.visibility === "public") {
    // 公开会话支持多人协作，首次发言自动加入参与者列表
    await db
      .insert(schema.agentSessionParticipants)
      .values({
        session_id: session.id,
        user_id: actor.userId,
        role: "collaborator",
        can_chat: true,
        invited_by: session.creator_id,
      })
      .onConflictDoNothing({
        target: [
          schema.agentSessionParticipants.session_id,
          schema.agentSessionParticipants.user_id,
        ],
      });
    return session;
  }

  throw createError({ statusCode: 403, message: "Chat permission denied in this session" });
}

export async function createAgentSession(params: {
  repositoryId: string;
  creatorId: string;
  title?: string;
  prompt: string;
  visibility: "public" | "private";
  baseBranch: string;
  workingBranch?: string;
  autoCommit: boolean;
  autoPr: boolean;
}) {
  const db = useDB();

  const [created] = await db
    .insert(schema.agentSessions)
    .values({
      repository_id: params.repositoryId,
      title: params.title,
      prompt: params.prompt,
      visibility: params.visibility,
      creator_id: params.creatorId,
      base_branch: params.baseBranch,
      working_branch: params.workingBranch,
      auto_commit: params.autoCommit,
      auto_pr: params.autoPr,
      status: "created",
    })
    .returning();

  if (!created) {
    throw createError({ statusCode: 500, message: "Failed to create agent session" });
  }

  await db
    .insert(schema.agentSessionParticipants)
    .values({
      session_id: created.id,
      user_id: params.creatorId,
      role: "owner",
      can_chat: true,
      invited_by: params.creatorId,
    })
    .onConflictDoNothing({
      target: [
        schema.agentSessionParticipants.session_id,
        schema.agentSessionParticipants.user_id,
      ],
    });

  await db.insert(schema.agentSessionMessages).values({
    session_id: created.id,
    seq: 1,
    actor_type: "user",
    actor_id: params.creatorId,
    message_type: "user_prompt",
    content: params.prompt,
    metadata: { initial: true },
  });

  await appendSessionEvent({
    sessionId: created.id,
    type: "session_created",
    actorType: "user",
    actorId: params.creatorId,
    payload: {
      visibility: params.visibility,
      base_branch: params.baseBranch,
      working_branch: params.workingBranch || null,
    },
  });

  await appendSessionEvent({
    sessionId: created.id,
    type: "session_preparing",
    actorType: "system",
    actorId: "runtime",
  });

  let prepared: Awaited<ReturnType<typeof prepareRepoSessionWorktree>>;
  try {
    prepared = await prepareRepoSessionWorktree({
      repositoryId: params.repositoryId,
      sessionId: created.id,
      baseBranch: params.baseBranch,
      workingBranch: params.workingBranch,
      actorId: params.creatorId,
    });
  } catch (error) {
    await appendSessionEvent({
      sessionId: created.id,
      type: "worktree_prepare_failed",
      actorType: "system",
      actorId: "runtime",
      payload: {
        error: (error as { message?: string })?.message || "prepare failed",
      },
    });
    throw error;
  }

  await appendSessionEvent({
    sessionId: created.id,
    type: "worktree_prepared",
    actorType: "system",
    actorId: "runtime",
    payload: {
      session_path: prepared.sessionPath,
      base_branch: prepared.baseBranch,
      working_branch: prepared.workingBranch,
      mode: prepared.mode,
    },
  });

  const [latest] = await db
    .select()
    .from(schema.agentSessions)
    .where(eq(schema.agentSessions.id, created.id))
    .limit(1);

  return latest || created;
}

/**
 * 会话列表（按可见性过滤）：
 * - admin: 当前仓库全部会话
 * - 非 admin: public + 自己创建 + 自己参与
 */
export async function listAgentSessions(params: {
  repositoryId: string;
  actor: AgentSessionActor;
  page: number;
  limit: number;
}) {
  const db = useDB();
  const offset = (params.page - 1) * params.limit;

  const repositoryCondition = eq(schema.agentSessions.repository_id, params.repositoryId);

  let whereCondition = repositoryCondition;

  if (!params.actor.isAdmin) {
    const participantRows = await db
      .select({ session_id: schema.agentSessionParticipants.session_id })
      .from(schema.agentSessionParticipants)
      .where(eq(schema.agentSessionParticipants.user_id, params.actor.userId));
    const participantSessionIds = participantRows.map((row) => row.session_id);

    const visibilityConditions = [
      eq(schema.agentSessions.visibility, "public"),
      eq(schema.agentSessions.creator_id, params.actor.userId),
    ];
    if (participantSessionIds.length > 0) {
      visibilityConditions.push(inArray(schema.agentSessions.id, participantSessionIds));
    }

    whereCondition = and(repositoryCondition, or(...visibilityConditions))!;
  }

  const sessions = await db
    .select({
      id: schema.agentSessions.id,
      title: schema.agentSessions.title,
      visibility: schema.agentSessions.visibility,
      creator_id: schema.agentSessions.creator_id,
      runtime_id: schema.agentSessions.runtime_id,
      status: schema.agentSessions.status,
      base_branch: schema.agentSessions.base_branch,
      working_branch: schema.agentSessions.working_branch,
      session_path: schema.agentSessions.session_path,
      created_at: schema.agentSessions.created_at,
      updated_at: schema.agentSessions.updated_at,
    })
    .from(schema.agentSessions)
    .where(whereCondition)
    .orderBy(desc(schema.agentSessions.updated_at))
    .limit(params.limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.agentSessions)
    .where(whereCondition);

  const total = toNumber(totalRow?.count);

  return {
    data: sessions,
    total,
    page: params.page,
    limit: params.limit,
    hasMore: offset + params.limit < total,
  };
}

export async function getAgentSessionDetail(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
}) {
  const db = useDB();
  const session = await ensureSessionReadable(params.sessionId, params.repositoryId, params.actor);

  const [participantCountRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.agentSessionParticipants)
    .where(eq(schema.agentSessionParticipants.session_id, session.id));

  const [messageCountRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.agentSessionMessages)
    .where(eq(schema.agentSessionMessages.session_id, session.id));

  const myParticipant = await getParticipant(session.id, params.actor.userId);
  const worktree = await getSessionWorktreeBySessionId({
    repositoryId: params.repositoryId,
    sessionId: session.id,
  });
  const [runtime] = session.runtime_id
    ? await db
        .select({
          id: schema.agentRuntimes.id,
          status: schema.agentRuntimes.status,
          provider: schema.agentRuntimes.provider,
          last_heartbeat_at: schema.agentRuntimes.last_heartbeat_at,
          runtime_key: schema.agentRuntimes.runtime_key,
        })
        .from(schema.agentRuntimes)
        .where(eq(schema.agentRuntimes.id, session.runtime_id))
        .limit(1)
    : [null];

  return {
    ...session,
    participant_count: toNumber(participantCountRow?.count),
    message_count: toNumber(messageCountRow?.count),
    my_role: myParticipant?.role || (session.creator_id === params.actor.userId ? "owner" : null),
    my_can_chat: myParticipant?.can_chat ?? session.creator_id === params.actor.userId,
    runtime_status: runtime?.status || null,
    runtime_provider: runtime?.provider || null,
    runtime_last_heartbeat_at: runtime?.last_heartbeat_at || null,
    runtime_key: runtime?.runtime_key || null,
    worktree_status: worktree?.status || null,
    worktree_path: worktree?.worktree_path || session.session_path || null,
    worktree_last_error: worktree?.last_error || null,
  };
}

export async function listAgentSessionParticipants(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
}) {
  const db = useDB();
  const session = await ensureSessionReadable(params.sessionId, params.repositoryId, params.actor);

  return db
    .select({
      id: schema.agentSessionParticipants.id,
      session_id: schema.agentSessionParticipants.session_id,
      user_id: schema.agentSessionParticipants.user_id,
      role: schema.agentSessionParticipants.role,
      can_chat: schema.agentSessionParticipants.can_chat,
      invited_by: schema.agentSessionParticipants.invited_by,
      joined_at: schema.agentSessionParticipants.joined_at,
      gitea_username: schema.users.gitea_username,
      avatar_url: schema.users.avatar_url,
    })
    .from(schema.agentSessionParticipants)
    .innerJoin(schema.users, eq(schema.agentSessionParticipants.user_id, schema.users.id))
    .where(eq(schema.agentSessionParticipants.session_id, session.id))
    .orderBy(schema.agentSessionParticipants.joined_at);
}

export async function addAgentSessionParticipant(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
  userId: string;
  role: "collaborator" | "viewer";
  canChat: boolean;
}) {
  const db = useDB();
  const session = await getSessionById(params.sessionId, params.repositoryId);

  if (!params.actor.isAdmin && session.creator_id !== params.actor.userId) {
    throw createError({ statusCode: 403, message: "Only session owner can invite participants" });
  }

  const [participant] = await db
    .insert(schema.agentSessionParticipants)
    .values({
      session_id: session.id,
      user_id: params.userId,
      role: params.role,
      can_chat: params.canChat,
      invited_by: params.actor.userId,
    })
    .onConflictDoUpdate({
      target: [
        schema.agentSessionParticipants.session_id,
        schema.agentSessionParticipants.user_id,
      ],
      set: {
        role: params.role,
        can_chat: params.canChat,
        invited_by: params.actor.userId,
        updated_at: new Date(),
      },
    })
    .returning();

  await appendSessionEvent({
    sessionId: session.id,
    type: "participant_added",
    actorType: "user",
    actorId: params.actor.userId,
    payload: {
      user_id: params.userId,
      role: params.role,
      can_chat: params.canChat,
    },
  });

  return participant;
}

export async function updateAgentSessionParticipant(params: {
  repositoryId: string;
  sessionId: string;
  targetUserId: string;
  actor: AgentSessionActor;
  role?: "collaborator" | "viewer";
  canChat?: boolean;
}) {
  const db = useDB();
  const session = await getSessionById(params.sessionId, params.repositoryId);

  if (!params.actor.isAdmin && session.creator_id !== params.actor.userId) {
    throw createError({ statusCode: 403, message: "Only session owner can manage participants" });
  }

  const patch: { role?: "collaborator" | "viewer"; can_chat?: boolean; updated_at: Date } = {
    updated_at: new Date(),
  };
  if (params.role !== undefined) patch.role = params.role;
  if (params.canChat !== undefined) patch.can_chat = params.canChat;

  const [updated] = await db
    .update(schema.agentSessionParticipants)
    .set(patch)
    .where(
      and(
        eq(schema.agentSessionParticipants.session_id, session.id),
        eq(schema.agentSessionParticipants.user_id, params.targetUserId),
      ),
    )
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, message: "Participant not found" });
  }

  await appendSessionEvent({
    sessionId: session.id,
    type: "participant_updated",
    actorType: "user",
    actorId: params.actor.userId,
    payload: {
      user_id: params.targetUserId,
      role: params.role,
      can_chat: params.canChat,
    },
  });

  return updated;
}

export async function listAgentSessionMessages(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
  page: number;
  limit: number;
}) {
  const db = useDB();
  const session = await ensureSessionReadable(params.sessionId, params.repositoryId, params.actor);
  const offset = (params.page - 1) * params.limit;

  const messages = await db
    .select()
    .from(schema.agentSessionMessages)
    .where(eq(schema.agentSessionMessages.session_id, session.id))
    .orderBy(schema.agentSessionMessages.seq)
    .limit(params.limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.agentSessionMessages)
    .where(eq(schema.agentSessionMessages.session_id, session.id));

  const total = toNumber(totalRow?.count);

  return {
    data: messages,
    total,
    page: params.page,
    limit: params.limit,
    hasMore: offset + params.limit < total,
  };
}

export async function createAgentSessionMessage(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
  content: string;
  metadata: Record<string, unknown>;
}) {
  const db = useDB();
  const session = await ensureSessionChatAllowed(params.sessionId, params.repositoryId, params.actor);

  let created: typeof schema.agentSessionMessages.$inferSelect | undefined;

  // 消息序号在会话内唯一；多人并发发言时冲突重试，提升协作稳定性。
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      created = await db.transaction(async (tx) => {
        const [maxSeqRow] = await tx
          .select({
            maxSeq: sql<number>`COALESCE(MAX(${schema.agentSessionMessages.seq}), 0)`,
          })
          .from(schema.agentSessionMessages)
          .where(eq(schema.agentSessionMessages.session_id, session.id));

        const nextSeq = toNumber(maxSeqRow?.maxSeq) + 1;

        const [inserted] = await tx
          .insert(schema.agentSessionMessages)
          .values({
            session_id: session.id,
            seq: nextSeq,
            actor_type: "user",
            actor_id: params.actor.userId,
            message_type: "user_prompt",
            content: params.content,
            metadata: params.metadata,
          })
          .returning();

        await tx
          .update(schema.agentSessions)
          .set({ updated_at: new Date() })
          .where(eq(schema.agentSessions.id, session.id));

        return inserted;
      });

      if (created) {
        break;
      }
    } catch (error) {
      if (isUniqueViolation(error) && attempt < 2) {
        continue;
      }
      throw error;
    }
  }

  if (!created) {
    throw createError({ statusCode: 500, message: "Failed to create session message" });
  }

  await appendSessionEvent({
    sessionId: session.id,
    type: "message_created",
    actorType: "user",
    actorId: params.actor.userId,
    payload: {
      message_id: created.id,
      seq: created.seq,
      message_type: created.message_type,
    },
  });

  return created;
}

export async function joinAgentSession(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
}) {
  const db = useDB();
  const session = await getSessionById(params.sessionId, params.repositoryId);

  if (!params.actor.isAdmin && session.visibility === "private" && session.creator_id !== params.actor.userId) {
    const participant = await getParticipant(session.id, params.actor.userId);
    if (!participant) {
      throw createError({ statusCode: 403, message: "Private session requires invitation" });
    }
  }

  const role = session.creator_id === params.actor.userId ? "owner" : "collaborator";
  const canChat = session.creator_id === params.actor.userId ? true : session.visibility === "public";

  const [joined] = await db
    .insert(schema.agentSessionParticipants)
    .values({
      session_id: session.id,
      user_id: params.actor.userId,
      role,
      can_chat: canChat,
      invited_by: session.creator_id,
      joined_at: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        schema.agentSessionParticipants.session_id,
        schema.agentSessionParticipants.user_id,
      ],
      set: {
        joined_at: new Date(),
        updated_at: new Date(),
      },
    })
    .returning();

  await appendSessionEvent({
    sessionId: session.id,
    type: "participant_joined",
    actorType: "user",
    actorId: params.actor.userId,
    payload: {
      role,
      can_chat: canChat,
    },
  });

  return joined;
}

export async function leaveAgentSession(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
}) {
  const db = useDB();
  const session = await getSessionById(params.sessionId, params.repositoryId);

  if (!params.actor.isAdmin && session.creator_id === params.actor.userId) {
    throw createError({ statusCode: 400, message: "Session owner cannot leave the session" });
  }

  const [removed] = await db
    .delete(schema.agentSessionParticipants)
    .where(
      and(
        eq(schema.agentSessionParticipants.session_id, session.id),
        eq(schema.agentSessionParticipants.user_id, params.actor.userId),
      ),
    )
    .returning({ id: schema.agentSessionParticipants.id });

  if (!removed) {
    throw createError({ statusCode: 404, message: "You are not a participant of this session" });
  }

  await appendSessionEvent({
    sessionId: session.id,
    type: "participant_left",
    actorType: "user",
    actorId: params.actor.userId,
  });

  return { success: true };
}

export async function pinAgentSessionMessage(params: {
  repositoryId: string;
  sessionId: string;
  messageId: string;
  actor: AgentSessionActor;
}) {
  const db = useDB();
  const session = await ensureSessionReadable(params.sessionId, params.repositoryId, params.actor);

  if (!params.actor.isAdmin && session.creator_id !== params.actor.userId) {
    const participant = await getParticipant(session.id, params.actor.userId);
    if (!participant || participant.role === "viewer") {
      throw createError({ statusCode: 403, message: "Only owner/collaborator can pin messages" });
    }
  }

  const [message] = await db
    .select({
      id: schema.agentSessionMessages.id,
      metadata: schema.agentSessionMessages.metadata,
    })
    .from(schema.agentSessionMessages)
    .where(
      and(
        eq(schema.agentSessionMessages.id, params.messageId),
        eq(schema.agentSessionMessages.session_id, session.id),
      ),
    )
    .limit(1);

  if (!message) {
    throw createError({ statusCode: 404, message: "Session message not found" });
  }

  const metadataObject = (message.metadata && typeof message.metadata === "object")
    ? (message.metadata as Record<string, unknown>)
    : {};

  const [pinned] = await db
    .update(schema.agentSessionMessages)
    .set({
      pinned: true,
      pinned_by: params.actor.userId,
      pinned_at: new Date(),
      metadata: {
        ...metadataObject,
        pinned: true,
      },
      updated_at: new Date(),
    })
    .where(
      and(
        eq(schema.agentSessionMessages.id, params.messageId),
        eq(schema.agentSessionMessages.session_id, session.id),
      ),
    )
    .returning();

  await appendSessionEvent({
    sessionId: session.id,
    type: "message_pinned",
    actorType: "user",
    actorId: params.actor.userId,
    payload: {
      message_id: params.messageId,
    },
  });

  return pinned;
}

export async function updateAgentSessionVisibility(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
  visibility: "public" | "private";
}) {
  const db = useDB();
  const session = await getSessionById(params.sessionId, params.repositoryId);

  if (!params.actor.isAdmin && session.creator_id !== params.actor.userId) {
    throw createError({ statusCode: 403, message: "Only session owner can change visibility" });
  }

  const [updated] = await db
    .update(schema.agentSessions)
    .set({
      visibility: params.visibility,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(schema.agentSessions.id, session.id),
        eq(schema.agentSessions.repository_id, params.repositoryId),
      ),
    )
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, message: "Agent session not found" });
  }

  await appendSessionEvent({
    sessionId: session.id,
    type: "visibility_changed",
    actorType: "user",
    actorId: params.actor.userId,
    payload: {
      visibility: params.visibility,
    },
  });

  return updated;
}

export async function stopAgentSession(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
}) {
  const db = useDB();
  const session = await getSessionById(params.sessionId, params.repositoryId);

  if (!params.actor.isAdmin && session.creator_id !== params.actor.userId) {
    throw createError({ statusCode: 403, message: "Only session owner can stop session" });
  }
  if (session.status === "stopped" || session.status === "completed") {
    return session;
  }

  const [updated] = await db
    .update(schema.agentSessions)
    .set({
      status: "stopped",
      finished_at: new Date(),
      updated_at: new Date(),
    })
    .where(
      and(
        eq(schema.agentSessions.id, session.id),
        eq(schema.agentSessions.repository_id, params.repositoryId),
      ),
    )
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, message: "Agent session not found" });
  }

  let cleanupResult: Awaited<ReturnType<typeof cleanupSessionWorktree>> | null = null;
  try {
    cleanupResult = await cleanupSessionWorktree({
      repositoryId: params.repositoryId,
      sessionId: session.id,
      actorId: params.actor.userId,
    });
  } catch (error) {
    await appendSessionEvent({
      sessionId: session.id,
      type: "worktree_cleanup_failed",
      actorType: "system",
      actorId: "runtime",
      payload: {
        error: (error as { message?: string })?.message || "cleanup failed",
      },
    });
  }

  await appendSessionEvent({
    sessionId: session.id,
    type: "session_stopped",
    actorType: "user",
    actorId: params.actor.userId,
    payload: {
      worktree_removed: cleanupResult?.removed || false,
    },
  });

  return updated;
}

export async function retryAgentSession(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
}) {
  const db = useDB();
  const session = await getSessionById(params.sessionId, params.repositoryId);

  if (!params.actor.isAdmin && session.creator_id !== params.actor.userId) {
    throw createError({ statusCode: 403, message: "Only session owner can retry session" });
  }
  if (session.status !== "failed" && session.status !== "stopped") {
    throw createError({
      statusCode: 400,
      message: "Only failed or stopped sessions can be retried",
    });
  }

  try {
    await cleanupSessionWorktree({
      repositoryId: params.repositoryId,
      sessionId: session.id,
      actorId: params.actor.userId,
    });
  } catch {
    // 历史 worktree 清理失败不阻断重试，由后续 prepare 流程兜底处理。
  }

  const [updated] = await db
    .update(schema.agentSessions)
    .set({
      status: "created",
      started_at: null,
      finished_at: null,
      session_path: null,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(schema.agentSessions.id, session.id),
        eq(schema.agentSessions.repository_id, params.repositoryId),
      ),
    )
    .returning();

  if (!updated) {
    throw createError({ statusCode: 404, message: "Agent session not found" });
  }

  await appendSessionEvent({
    sessionId: session.id,
    type: "session_retried",
    actorType: "user",
    actorId: params.actor.userId,
  });

  await appendSessionEvent({
    sessionId: session.id,
    type: "session_preparing",
    actorType: "system",
    actorId: "runtime",
  });

  let prepared: Awaited<ReturnType<typeof prepareRepoSessionWorktree>>;
  try {
    prepared = await prepareRepoSessionWorktree({
      repositoryId: params.repositoryId,
      sessionId: session.id,
      baseBranch: session.base_branch,
      workingBranch: session.working_branch || undefined,
      actorId: params.actor.userId,
    });
  } catch (error) {
    await appendSessionEvent({
      sessionId: session.id,
      type: "worktree_prepare_failed",
      actorType: "system",
      actorId: "runtime",
      payload: {
        error: (error as { message?: string })?.message || "retry prepare failed",
      },
    });
    throw error;
  }

  await appendSessionEvent({
    sessionId: session.id,
    type: "worktree_prepared",
    actorType: "system",
    actorId: "runtime",
    payload: {
      session_path: prepared.sessionPath,
      base_branch: prepared.baseBranch,
      working_branch: prepared.workingBranch,
      mode: prepared.mode,
    },
  });

  const [latest] = await db
    .select()
    .from(schema.agentSessions)
    .where(eq(schema.agentSessions.id, session.id))
    .limit(1);

  return latest || updated;
}

export async function deleteAgentSession(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
}) {
  const db = useDB();
  const session = await getSessionById(params.sessionId, params.repositoryId);

  if (!params.actor.isAdmin && session.creator_id !== params.actor.userId) {
    throw createError({ statusCode: 403, message: "Only session owner can delete session" });
  }

  let cleanupResult: Awaited<ReturnType<typeof cleanupSessionWorktree>> | null = null;
  try {
    cleanupResult = await cleanupSessionWorktree({
      repositoryId: params.repositoryId,
      sessionId: session.id,
      actorId: params.actor.userId,
    });
  } catch {
    // 删除会话时，worktree 清理失败不阻断主删除流程。
  }

  const [deleted] = await db
    .delete(schema.agentSessions)
    .where(
      and(
        eq(schema.agentSessions.id, session.id),
        eq(schema.agentSessions.repository_id, params.repositoryId),
      ),
    )
    .returning({
      id: schema.agentSessions.id,
    });

  if (!deleted) {
    throw createError({ statusCode: 404, message: "Agent session not found" });
  }

  return {
    deleted: true,
    session_id: deleted.id,
    worktree_removed: cleanupResult?.removed || false,
  };
}

export async function listAgentSessionEvents(params: {
  repositoryId: string;
  sessionId: string;
  actor: AgentSessionActor;
  page: number;
  limit: number;
  afterSeq?: number;
}) {
  const db = useDB();
  const session = await ensureSessionReadable(params.sessionId, params.repositoryId, params.actor);
  const offset = (params.page - 1) * params.limit;

  const conditions = [eq(schema.agentSessionEvents.session_id, session.id)];
  if (params.afterSeq !== undefined) {
    conditions.push(gt(schema.agentSessionEvents.seq, params.afterSeq));
  }
  const whereCondition = and(...conditions)!;

  const events = await db
    .select()
    .from(schema.agentSessionEvents)
    .where(whereCondition)
    .orderBy(schema.agentSessionEvents.seq)
    .limit(params.limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.agentSessionEvents)
    .where(whereCondition);

  const total = toNumber(totalRow?.count);

  return {
    data: events,
    total,
    page: params.page,
    limit: params.limit,
    hasMore: offset + params.limit < total,
  };
}
