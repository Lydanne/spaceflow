# 飞书卡片交互表单设计

## 概述

本文档描述 Teax 系统中飞书卡片交互表单的设计方案，支持通过程序化方式生成复杂的交互式卡片消息，实现业务流程的自动化控制。

## 核心目标

1. **程序化生成**：通过 TypeScript 类型安全的 API 构建卡片消息对象
2. **交互能力**：支持按钮、表单输入、下拉选择等交互元素
3. **状态管理**：追踪卡片交互状态，支持多步骤业务流程
4. **回调处理**：统一处理用户交互回调，触发后端业务逻辑
5. **可扩展性**：易于添加新的卡片模板和交互场景

## 架构设计

### 1. 卡片构建器（Card Builder）

使用 Builder 模式构建飞书卡片消息对象：

```typescript
// server/utils/feishu-card-builder.ts

interface CardConfig {
  title: string;
  theme?: 'blue' | 'green' | 'red' | 'orange' | 'grey';
  icon?: string;
}

interface CardElement {
  tag: string;
  [key: string]: any;
}

class FeishuCardBuilder {
  private config: CardConfig;
  private header: any;
  private elements: CardElement[] = [];
  
  constructor(config: CardConfig) {
    this.config = config;
    this.header = {
      title: {
        tag: 'plain_text',
        content: config.title,
      },
      template: config.theme || 'blue',
    };
  }

  // 添加文本块
  addText(content: string, isMarkdown = false): this {
    this.elements.push({
      tag: isMarkdown ? 'markdown' : 'div',
      text: {
        tag: isMarkdown ? 'lark_md' : 'plain_text',
        content,
      },
    });
    return this;
  }

  // 添加分割线
  addDivider(): this {
    this.elements.push({ tag: 'hr' });
    return this;
  }

  // 添加字段列表（key-value 对）
  addFields(fields: Array<{ label: string; value: string }>): this {
    this.elements.push({
      tag: 'div',
      fields: fields.map(f => ({
        is_short: true,
        text: {
          tag: 'lark_md',
          content: `**${f.label}**\n${f.value}`,
        },
      })),
    });
    return this;
  }

  // 添加按钮组
  addButtons(buttons: Array<{
    text: string;
    value: string;
    type?: 'default' | 'primary' | 'danger';
    url?: string;
  }>): this {
    this.elements.push({
      tag: 'action',
      actions: buttons.map(btn => ({
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: btn.text,
        },
        type: btn.type || 'default',
        value: JSON.stringify({ action: btn.value }),
        ...(btn.url && { url: btn.url }),
      })),
    });
    return this;
  }

  // 添加输入框
  addInput(config: {
    name: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    multiline?: boolean;
  }): this {
    this.elements.push({
      tag: 'input',
      name: config.name,
      required: config.required || false,
      placeholder: {
        tag: 'plain_text',
        content: config.placeholder || '',
      },
      label: {
        tag: 'plain_text',
        content: config.label,
      },
      ...(config.multiline && { multiline: true }),
    });
    return this;
  }

  // 添加下拉选择
  addSelect(config: {
    name: string;
    label: string;
    placeholder?: string;
    required?: boolean;
    options: Array<{ label: string; value: string }>;
  }): this {
    this.elements.push({
      tag: 'select_static',
      name: config.name,
      required: config.required || false,
      placeholder: {
        tag: 'plain_text',
        content: config.placeholder || '请选择',
      },
      label: {
        tag: 'plain_text',
        content: config.label,
      },
      options: config.options.map(opt => ({
        text: {
          tag: 'plain_text',
          content: opt.label,
        },
        value: opt.value,
      })),
    });
    return this;
  }

  // 添加日期选择器
  addDatePicker(config: {
    name: string;
    label: string;
    placeholder?: string;
    required?: boolean;
  }): this {
    this.elements.push({
      tag: 'date_picker',
      name: config.name,
      required: config.required || false,
      placeholder: {
        tag: 'plain_text',
        content: config.placeholder || '选择日期',
      },
      label: {
        tag: 'plain_text',
        content: config.label,
      },
    });
    return this;
  }

  // 添加确认对话框
  addConfirm(config: {
    title: string;
    text: string;
  }): this {
    const lastElement = this.elements[this.elements.length - 1];
    if (lastElement?.tag === 'action') {
      lastElement.actions.forEach((action: any) => {
        action.confirm = {
          title: {
            tag: 'plain_text',
            content: config.title,
          },
          text: {
            tag: 'plain_text',
            content: config.text,
          },
        };
      });
    }
    return this;
  }

  // 构建最终卡片对象
  build(): any {
    return {
      msg_type: 'interactive',
      card: {
        config: {
          wide_screen_mode: true,
        },
        header: this.header,
        elements: this.elements,
      },
    };
  }
}

export { FeishuCardBuilder };
```

### 2. 卡片模板库

预定义常用业务场景的卡片模板：

```typescript
// server/utils/feishu-card-templates.ts

import { FeishuCardBuilder } from './feishu-card-builder';

export class FeishuCardTemplates {
  // 发布审批卡片
  static buildDeployApprovalCard(data: {
    repository: string;
    branch: string;
    requester: string;
    description: string;
    approvalId: string;
  }) {
    return new FeishuCardBuilder({
      title: '🚀 发布审批请求',
      theme: 'blue',
    })
      .addText(`**${data.requester}** 请求发布应用`)
      .addDivider()
      .addFields([
        { label: '仓库', value: data.repository },
        { label: '分支', value: data.branch },
        { label: '说明', value: data.description },
      ])
      .addDivider()
      .addButtons([
        {
          text: '✅ 批准',
          value: `approve:${data.approvalId}`,
          type: 'primary',
        },
        {
          text: '❌ 拒绝',
          value: `reject:${data.approvalId}`,
          type: 'danger',
        },
      ])
      .addConfirm({
        title: '确认操作',
        text: '确定要执行此操作吗？',
      })
      .build();
  }

  // 发布结果通知卡片
  static buildDeployResultCard(data: {
    repository: string;
    branch: string;
    status: 'success' | 'failure';
    duration: string;
    logs?: string;
    url?: string;
  }) {
    const builder = new FeishuCardBuilder({
      title: data.status === 'success' ? '✅ 发布成功' : '❌ 发布失败',
      theme: data.status === 'success' ? 'green' : 'red',
    })
      .addFields([
        { label: '仓库', value: data.repository },
        { label: '分支', value: data.branch },
        { label: '耗时', value: data.duration },
      ]);

    if (data.logs) {
      builder.addDivider().addText(`\`\`\`\n${data.logs}\n\`\`\``, true);
    }

    if (data.url) {
      builder.addDivider().addButtons([
        {
          text: '查看详情',
          value: 'view_detail',
          url: data.url,
        },
      ]);
    }

    return builder.build();
  }

  // 配置表单卡片
  static buildConfigFormCard(data: {
    title: string;
    description?: string;
    formId: string;
    fields: Array<{
      type: 'input' | 'select' | 'date';
      name: string;
      label: string;
      placeholder?: string;
      required?: boolean;
      options?: Array<{ label: string; value: string }>;
    }>;
  }) {
    const builder = new FeishuCardBuilder({
      title: data.title,
      theme: 'blue',
    });

    if (data.description) {
      builder.addText(data.description);
    }

    data.fields.forEach(field => {
      if (field.type === 'input') {
        builder.addInput({
          name: field.name,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
        });
      } else if (field.type === 'select' && field.options) {
        builder.addSelect({
          name: field.name,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
          options: field.options,
        });
      } else if (field.type === 'date') {
        builder.addDatePicker({
          name: field.name,
          label: field.label,
          placeholder: field.placeholder,
          required: field.required,
        });
      }
    });

    return builder
      .addDivider()
      .addButtons([
        {
          text: '提交',
          value: `submit_form:${data.formId}`,
          type: 'primary',
        },
        {
          text: '取消',
          value: 'cancel',
        },
      ])
      .build();
  }

  // Agent 执行确认卡片
  static buildAgentConfirmCard(data: {
    agentName: string;
    task: string;
    estimatedTime: string;
    sessionId: string;
  }) {
    return new FeishuCardBuilder({
      title: '🤖 Agent 任务确认',
      theme: 'orange',
    })
      .addText(`**Agent**: ${data.agentName}`)
      .addText(`**任务**: ${data.task}`)
      .addText(`**预计耗时**: ${data.estimatedTime}`)
      .addDivider()
      .addButtons([
        {
          text: '▶️ 开始执行',
          value: `start_agent:${data.sessionId}`,
          type: 'primary',
        },
        {
          text: '⏸️ 暂停',
          value: `pause_agent:${data.sessionId}`,
        },
        {
          text: '🛑 取消',
          value: `cancel_agent:${data.sessionId}`,
          type: 'danger',
        },
      ])
      .build();
  }

  // 多步骤流程卡片
  static buildWorkflowCard(data: {
    title: string;
    currentStep: number;
    totalSteps: number;
    steps: Array<{
      name: string;
      status: 'pending' | 'running' | 'success' | 'failed';
    }>;
    workflowId: string;
  }) {
    const statusEmoji = {
      pending: '⏳',
      running: '▶️',
      success: '✅',
      failed: '❌',
    };

    const builder = new FeishuCardBuilder({
      title: data.title,
      theme: 'blue',
    }).addText(`进度: ${data.currentStep}/${data.totalSteps}`);

    data.steps.forEach((step, index) => {
      builder.addText(
        `${statusEmoji[step.status]} **步骤 ${index + 1}**: ${step.name}`,
        true,
      );
    });

    return builder
      .addDivider()
      .addButtons([
        {
          text: '查看详情',
          value: `view_workflow:${data.workflowId}`,
        },
      ])
      .build();
  }
}
```

### 3. 卡片交互状态管理

使用数据库追踪卡片交互状态：

```typescript
// server/db/schema/card-interaction.ts

import { pgTable, uuid, varchar, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";
import { users } from "./user";
import { organizations } from "./organization";
import { baseColumns } from "./base";

export const cardInteractions = pgTable(
  "card_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organization_id: uuid("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    user_id: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    
    // 飞书相关
    message_id: varchar("message_id", { length: 255 }).notNull().unique(),
    chat_id: varchar("chat_id", { length: 255 }).notNull(),
    open_id: varchar("open_id", { length: 255 }),
    
    // 业务相关
    card_type: varchar("card_type", { length: 100 }).notNull(), // 'deploy_approval', 'config_form', 'agent_confirm' 等
    business_id: varchar("business_id", { length: 255 }), // 关联的业务对象 ID（如 approval_id, workflow_id）
    status: varchar("status", { length: 50 }).default("pending"), // 'pending', 'completed', 'cancelled'
    
    // 卡片数据
    card_data: jsonb("card_data").default({}), // 卡片初始数据
    interaction_data: jsonb("interaction_data").default({}), // 用户交互数据
    
    // 时间戳
    sent_at: timestamp("sent_at", { withTimezone: true }).defaultNow(),
    interacted_at: timestamp("interacted_at", { withTimezone: true }),
    
    ...baseColumns(),
  },
  (table) => [
    index("idx_card_message").on(table.message_id),
    index("idx_card_business").on(table.card_type, table.business_id),
    index("idx_card_status").on(table.status),
  ],
);
```

### 4. 卡片交互回调处理

统一处理飞书卡片交互回调：

```typescript
// server/api/webhooks/feishu-card.post.ts

import { eq } from "drizzle-orm";
import { useDB, schema } from "~~/server/db";
import { verifyFeishuSignature } from "~~/server/utils/feishu";

export default defineEventHandler(async (event) => {
  // 验证签名
  const body = await readBody(event);
  const signature = getHeader(event, "x-lark-signature");
  const timestamp = getHeader(event, "x-lark-request-timestamp");
  
  if (!verifyFeishuSignature(body, signature, timestamp)) {
    throw createError({ statusCode: 401, message: "Invalid signature" });
  }

  // URL 验证
  if (body.type === "url_verification") {
    return { challenge: body.challenge };
  }

  // 卡片交互事件
  if (body.type === "card.action.trigger") {
    const { open_id, open_message_id, action } = body;
    const actionValue = JSON.parse(action.value);
    
    const db = useDB();
    
    // 查找卡片交互记录
    const [interaction] = await db
      .select()
      .from(schema.cardInteractions)
      .where(eq(schema.cardInteractions.message_id, open_message_id))
      .limit(1);

    if (!interaction) {
      return { error: "Card interaction not found" };
    }

    // 更新交互数据
    await db
      .update(schema.cardInteractions)
      .set({
        interaction_data: action.form_value || actionValue,
        interacted_at: new Date(),
        status: "completed",
      })
      .where(eq(schema.cardInteractions.id, interaction.id));

    // 根据卡片类型分发处理
    const result = await handleCardAction(interaction, actionValue, action.form_value);

    return result;
  }

  return { success: true };
});

async function handleCardAction(
  interaction: any,
  actionValue: any,
  formValue?: any,
) {
  const { card_type, business_id } = interaction;

  switch (card_type) {
    case "deploy_approval":
      return handleDeployApproval(business_id, actionValue, formValue);
    
    case "config_form":
      return handleConfigForm(business_id, formValue);
    
    case "agent_confirm":
      return handleAgentConfirm(business_id, actionValue);
    
    default:
      return { error: "Unknown card type" };
  }
}

async function handleDeployApproval(approvalId: string, action: any, formValue: any) {
  const db = useDB();
  const [actionType, id] = action.action.split(":");
  
  if (actionType === "approve") {
    // 更新审批状态
    await db
      .update(schema.approvalRequests)
      .set({ status: "approved" })
      .where(eq(schema.approvalRequests.id, id));
    
    // 触发发布流程
    // await triggerDeployment(id);
    
    return {
      toast: {
        type: "success",
        content: "审批通过，发布流程已启动",
      },
    };
  } else if (actionType === "reject") {
    await db
      .update(schema.approvalRequests)
      .set({ status: "rejected" })
      .where(eq(schema.approvalRequests.id, id));
    
    return {
      toast: {
        type: "info",
        content: "已拒绝此发布请求",
      },
    };
  }
  
  return { success: true };
}

async function handleConfigForm(formId: string, formValue: any) {
  // 处理配置表单提交
  // 保存配置到数据库或触发相应业务逻辑
  
  return {
    toast: {
      type: "success",
      content: "配置已保存",
    },
  };
}

async function handleAgentConfirm(sessionId: string, action: any) {
  const [actionType, id] = action.action.split(":");
  
  if (actionType === "start_agent") {
    // 启动 Agent 执行
    // await startAgentExecution(id);
    
    return {
      toast: {
        type: "success",
        content: "Agent 已开始执行",
      },
    };
  }
  
  return { success: true };
}
```

### 5. 卡片发送服务

封装卡片发送逻辑：

```typescript
// server/services/card.service.ts

import { useDB, schema } from "~~/server/db";
import { sendCardMessage } from "~~/server/utils/feishu";

export class CardService {
  static async sendCard(params: {
    chatId: string;
    card: any;
    cardType: string;
    businessId?: string;
    organizationId?: string;
    userId?: string;
    cardData?: any;
  }) {
    const db = useDB();
    
    // 发送卡片消息
    const result = await sendCardMessage(params.chatId, params.card);
    
    if (!result.message_id) {
      throw new Error("Failed to send card message");
    }
    
    // 记录卡片交互
    const [interaction] = await db
      .insert(schema.cardInteractions)
      .values({
        message_id: result.message_id,
        chat_id: params.chatId,
        card_type: params.cardType,
        business_id: params.businessId,
        organization_id: params.organizationId,
        user_id: params.userId,
        card_data: params.cardData || {},
        status: "pending",
      })
      .returning();
    
    return {
      messageId: result.message_id,
      interactionId: interaction.id,
    };
  }
  
  static async updateCard(params: {
    messageId: string;
    card: any;
  }) {
    // 更新已发送的卡片
    // 飞书支持通过 message_id 更新卡片内容
    const result = await updateCardMessage(params.messageId, params.card);
    return result;
  }
  
  static async getInteraction(messageId: string) {
    const db = useDB();
    const [interaction] = await db
      .select()
      .from(schema.cardInteractions)
      .where(eq(schema.cardInteractions.message_id, messageId))
      .limit(1);
    
    return interaction;
  }
}
```

## 使用示例

### 示例 1：发送发布审批卡片

```typescript
import { FeishuCardTemplates } from "~~/server/utils/feishu-card-templates";
import { CardService } from "~~/server/services/card.service";

// 创建审批请求后发送卡片
async function sendDeployApprovalCard(approvalRequest: any) {
  const card = FeishuCardTemplates.buildDeployApprovalCard({
    repository: approvalRequest.repository.full_name,
    branch: approvalRequest.metadata.branch,
    requester: approvalRequest.requester.name,
    description: approvalRequest.description,
    approvalId: approvalRequest.id,
  });
  
  await CardService.sendCard({
    chatId: approvalRequest.organization.settings.feishuChatId,
    card,
    cardType: "deploy_approval",
    businessId: approvalRequest.id,
    organizationId: approvalRequest.organization_id,
    userId: approvalRequest.requester_id,
    cardData: {
      repository: approvalRequest.repository.full_name,
      branch: approvalRequest.metadata.branch,
    },
  });
}
```

### 示例 2：发送配置表单卡片

```typescript
async function sendConfigFormCard(chatId: string, orgId: string) {
  const card = FeishuCardTemplates.buildConfigFormCard({
    title: "配置通知规则",
    description: "请填写以下信息来创建新的通知规则",
    formId: crypto.randomUUID(),
    fields: [
      {
        type: "input",
        name: "rule_name",
        label: "规则名称",
        placeholder: "例如：生产环境告警",
        required: true,
      },
      {
        type: "select",
        name: "event_type",
        label: "事件类型",
        required: true,
        options: [
          { label: "Workflow 成功", value: "workflow_success" },
          { label: "Workflow 失败", value: "workflow_failure" },
          { label: "代码推送", value: "push" },
        ],
      },
      {
        type: "input",
        name: "branches",
        label: "分支过滤",
        placeholder: "main, release/*",
      },
    ],
  });
  
  await CardService.sendCard({
    chatId,
    card,
    cardType: "config_form",
    organizationId: orgId,
  });
}
```

### 示例 3：动态更新卡片状态

```typescript
async function updateWorkflowCard(messageId: string, workflow: any) {
  const card = FeishuCardTemplates.buildWorkflowCard({
    title: workflow.name,
    currentStep: workflow.currentStep,
    totalSteps: workflow.steps.length,
    steps: workflow.steps,
    workflowId: workflow.id,
  });
  
  await CardService.updateCard({
    messageId,
    card,
  });
}
```

## 扩展性设计

### 1. 自定义卡片模板

开发者可以轻松添加新的卡片模板：

```typescript
// 在 FeishuCardTemplates 类中添加新方法
static buildCustomCard(data: any) {
  return new FeishuCardBuilder({
    title: data.title,
    theme: 'blue',
  })
    .addText(data.content)
    .addButtons(data.buttons)
    .build();
}
```

### 2. 自定义交互处理

在 `handleCardAction` 中添加新的 case 分支处理新的卡片类型。

### 3. 卡片组件化

可以进一步封装可复用的卡片组件：

```typescript
class CardComponents {
  static buildApprovalSection(approver: string, status: string) {
    // 返回审批状态组件
  }
  
  static buildProgressBar(current: number, total: number) {
    // 返回进度条组件
  }
  
  static buildUserMention(userId: string) {
    // 返回 @用户 组件
  }
}
```

## 安全考虑

1. **签名验证**：所有飞书回调必须验证签名
2. **权限检查**：处理交互前验证用户权限
3. **数据校验**：验证表单输入数据
4. **防重放**：记录已处理的交互，防止重复处理
5. **敏感信息**：不在卡片中直接展示敏感信息

## 性能优化

1. **异步处理**：卡片回调处理采用异步队列
2. **缓存**：缓存常用的卡片模板
3. **批量发送**：支持批量发送卡片消息
4. **状态索引**：为卡片交互表添加合适的索引

## 监控和日志

1. **发送日志**：记录所有卡片发送操作
2. **交互日志**：记录用户交互行为
3. **错误追踪**：追踪卡片发送和处理失败
4. **性能监控**：监控卡片响应时间

## 未来扩展

1. **多语言支持**：根据用户语言偏好生成卡片
2. **A/B 测试**：支持不同卡片样式的 A/B 测试
3. **智能推荐**：基于用户行为推荐卡片内容
4. **卡片分析**：统计卡片交互率和转化率
5. **富媒体支持**：支持图片、视频等富媒体元素

## 总结

本设计方案提供了一个完整的飞书卡片交互表单系统，具有以下特点：

- ✅ **类型安全**：TypeScript 类型定义完整
- ✅ **易于使用**：Builder 模式简化卡片构建
- ✅ **可扩展**：模板化设计易于添加新场景
- ✅ **状态管理**：完整的交互状态追踪
- ✅ **业务集成**：与现有业务流程无缝集成

通过这套系统，可以快速实现各种复杂的业务流程自动化，提升团队协作效率。
