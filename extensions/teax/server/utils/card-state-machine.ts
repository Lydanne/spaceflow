/**
 * 飞书卡片交互状态机
 * 用于管理多步骤交互式表单的状态流转
 */

import { updateCardMessage } from "~~/server/utils/feishu-sdk";
import type { FeishuInteractiveCard } from "~~/server/utils/feishu-sdk";

// ─── 状态机类型定义 ─────────────────────────────────────────

export interface CardState {
  /** 当前步骤 */
  step: string;
  /** 状态数据 */
  data: Record<string, unknown>;
  /** 元数据(用户信息等) */
  meta: {
    userId: string;
    openId: string;
    [key: string]: unknown;
  };
}

export interface StepConfig {
  /** 步骤名称 */
  name: string;
  /** 渲染卡片 */
  render: (state: CardState) => Promise<FeishuInteractiveCard>;
  /** 处理用户操作 */
  onAction?: (state: CardState, action: Record<string, unknown>) => Promise<StepTransition>;
  /** 验证当前步骤数据 */
  validate?: (state: CardState) => Promise<{ valid: boolean; error?: string }>;
}

export interface StepTransition {
  /** 下一步骤名称,null 表示结束 */
  nextStep: string | null;
  /** 更新的数据 */
  data?: Record<string, unknown>;
  /** 是否立即渲染下一步 */
  autoRender?: boolean;
}

export interface StateMachineConfig {
  /** 状态机名称 */
  name: string;
  /** 初始步骤 */
  initialStep: string;
  /** 步骤定义 */
  steps: Record<string, StepConfig>;
  /** 完成回调 */
  onComplete?: (state: CardState) => Promise<void>;
  /** 错误处理 */
  onError?: (state: CardState, error: Error) => Promise<FeishuInteractiveCard>;
}

// ─── 状态存储(Redis) ─────────────────────────────────────────

const REDIS_PREFIX = "card_state:";
const STATE_TTL = 3600; // 1小时过期

async function saveState(token: string, state: CardState): Promise<void> {
  const redis = useRedis();
  await redis.setex(`${REDIS_PREFIX}${token}`, STATE_TTL, JSON.stringify(state));
}

async function loadState(token: string): Promise<CardState | null> {
  const redis = useRedis();
  const data = await redis.get(`${REDIS_PREFIX}${token}`);
  if (!data) {
    return null;
  }
  return JSON.parse(data) as CardState;
}

async function deleteState(token: string): Promise<void> {
  const redis = useRedis();
  await redis.del(`${REDIS_PREFIX}${token}`);
}

// ─── 状态机执行器 ─────────────────────────────────────────────

export class CardStateMachine {
  constructor(private config: StateMachineConfig) {}

  /**
   * 启动状态机(初始化状态并渲染第一步)
   */
  async start(params: {
    messageId: string;
    openId: string;
    userId: string;
    initialData?: Record<string, unknown>;
  }): Promise<{ card: FeishuInteractiveCard; token: string }> {
    // 生成唯一 token(用于后续交互)
    const token = `${this.config.name}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    const state: CardState = {
      step: this.config.initialStep,
      data: params.initialData || {},
      meta: {
        userId: params.userId,
        openId: params.openId,
        messageId: params.messageId,
      },
    };

    await saveState(token, state);

    const stepConfig = this.config.steps[state.step];
    if (!stepConfig) {
      throw new Error(`Step not found: ${state.step}`);
    }

    const card = await stepConfig.render(state);

    // 注入 token 到卡片的所有 action 中
    this.injectToken(card, token);

    return { card, token };
  }

  /**
   * 处理用户操作
   */
  async handleAction(params: {
    token: string;
    action: Record<string, unknown>;
  }): Promise<void> {
    const state = await loadState(params.token);
    if (!state) {
      throw new Error("State not found or expired");
    }

    const stepConfig = this.config.steps[state.step];
    if (!stepConfig || !stepConfig.onAction) {
      return;
    }

    try {
      // 执行步骤的 action 处理
      const transition = await stepConfig.onAction(state, params.action);

      // 更新状态数据
      if (transition.data) {
        state.data = { ...state.data, ...transition.data };
      }

      // 状态转换
      if (transition.nextStep === null) {
        // 流程结束
        await deleteState(params.token);
        if (this.config.onComplete) {
          await this.config.onComplete(state);
        }
        // 渲染完成卡片
        const completeCard = await this.renderCompleteCard(state);
        await updateCardMessage(params.token, completeCard);
      } else if (transition.nextStep) {
        // 转到下一步
        state.step = transition.nextStep;
        await saveState(params.token, state);

        if (transition.autoRender !== false) {
          // 自动渲染下一步
          const nextStepConfig = this.config.steps[state.step];
          if (nextStepConfig) {
            const card = await nextStepConfig.render(state);
            this.injectToken(card, params.token);
            await updateCardMessage(params.token, card);
          }
        }
      } else {
        // 停留在当前步骤,保存状态
        await saveState(params.token, state);
      }
    } catch (error) {
      console.error(`[CardStateMachine] Error in step ${state.step}:`, error);
      const errorCard = this.config.onError
        ? await this.config.onError(state, error as Error)
        : this.renderErrorCard(error as Error);
      await updateCardMessage(params.token, errorCard);
    }
  }

  /**
   * 注入 token 到卡片的所有按钮 action 中
   */
  private injectToken(card: FeishuInteractiveCard, token: string): void {
    if (!card.elements) {
      return;
    }

    for (const element of card.elements) {
      if (element.tag === "action" && Array.isArray(element.actions)) {
        for (const action of element.actions) {
          if (action.tag === "button" && typeof action.value === "string") {
            try {
              const value = JSON.parse(action.value) as Record<string, unknown>;
              value._token = token;
              action.value = JSON.stringify(value);
            } catch {
              // 忽略非 JSON 的 value
            }
          }
        }
      }
    }
  }

  /**
   * 渲染完成卡片(默认实现)
   */
  private async renderCompleteCard(_state: CardState): Promise<FeishuInteractiveCard> {
    return {
      header: {
        title: { tag: "plain_text", content: "✅ 完成" },
        template: "green",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: "操作已完成",
          },
        },
      ],
    };
  }

  /**
   * 渲染错误卡片(默认实现)
   */
  private renderErrorCard(error: Error): FeishuInteractiveCard {
    return {
      header: {
        title: { tag: "plain_text", content: "❌ 出错了" },
        template: "red",
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: error.message || "处理请求时发生错误",
          },
        },
      ],
    };
  }
}

// ─── 全局状态机注册表 ─────────────────────────────────────────

const stateMachines = new Map<string, CardStateMachine>();

export function registerStateMachine(machine: CardStateMachine, name: string): void {
  stateMachines.set(name, machine);
}

export function getStateMachine(name: string): CardStateMachine | undefined {
  return stateMachines.get(name);
}

/**
 * 从 action 中提取状态机信息并路由到对应的处理器
 */
export async function routeCardAction(params: {
  action: Record<string, unknown>;
  openId: string;
}): Promise<void> {
  const actionValue = params.action.value as Record<string, unknown> | undefined;
  if (!actionValue) {
    return;
  }

  const token = actionValue._token as string | undefined;
  if (!token) {
    console.warn("[CardStateMachine] No token found in action");
    return;
  }

  // 从 token 中提取状态机名称
  const machineName = token.split("_")[0];
  if (!machineName) {
    return;
  }

  const machine = getStateMachine(machineName);
  if (!machine) {
    console.warn(`[CardStateMachine] Machine not found: ${machineName}`);
    return;
  }

  await machine.handleAction({ token, action: params.action });
}
