# 消息服务抽象层迁移指南

本文档说明如何将现有代码从直接调用飞书 SDK 迁移到平台无关的消息服务抽象层。

## 迁移概览

### 为什么要迁移？

1. **平台无关**：业务逻辑不再依赖具体的 IM 平台
2. **易于扩展**：未来可轻松支持钉钉、企业微信等平台
3. **统一接口**：所有消息操作使用相同的 API
4. **更好维护**：中性的命名更符合业务语义

### 架构对比

**旧架构：**
```
业务代码 → feishu-sdk.ts → @larksuiteoapi/node-sdk → 飞书 API
```

**新架构：**
```
业务代码 → messaging service → FeishuProvider → feishu-sdk.ts → 飞书 API
```

## 迁移步骤

### 第一步：更新导入语句

**旧代码：**
```typescript
import {
  sendFeishuChatCardMessage,
  replyFeishuMessage,
  updateCardMessage,
} from "~~/server/utils/feishu-sdk";
```

**新代码：**
```typescript
import { messaging } from "~~/server/services/messaging";
```

### 第二步：更新函数调用

#### 1. 发送卡片消息到群聊

**旧代码：**
```typescript
const result = await sendFeishuChatCardMessage(chatId, {
  header: {
    title: { tag: "plain_text", content: "部署通知" },
    template: "green",
  },
  elements: [
    {
      tag: "div",
      text: { tag: "plain_text", content: "部署成功" },
    },
  ],
});
```

**新代码：**
```typescript
const result = await messaging.sendMessage(
  { type: "chat", id: chatId },
  {
    type: "card",
    header: {
      title: "部署通知",
      template: "green",
    },
    elements: [
      {
        tag: "div",
        text: { tag: "plain_text", content: "部署成功" },
      },
    ],
  }
);
```

#### 2. 发送文本消息给用户

**旧代码：**
```typescript
await sendFeishuMessage(openId, "Hello!");
```

**新代码：**
```typescript
await messaging.sendMessage(
  { type: "user", id: openId },
  { type: "text", content: "Hello!" }
);
```

#### 3. 批量发送消息

**旧代码：**
```typescript
await sendFeishuBatchMessage(openIds, card);
```

**新代码：**
```typescript
const recipients = openIds.map(id => ({ type: "user" as const, id }));
await messaging.sendBatchMessage(recipients, {
  type: "card",
  header: card.header,
  elements: card.elements,
});
```

#### 4. 回复消息

**旧代码：**
```typescript
await replyFeishuMessage(messageId, "收到");
await replyFeishuCardMessage(messageId, card);
```

**新代码：**
```typescript
await messaging.replyMessage(messageId, {
  type: "text",
  content: "收到",
});

await messaging.replyMessage(messageId, {
  type: "card",
  header: card.header,
  elements: card.elements,
});
```

#### 5. 更新卡片消息

**旧代码：**
```typescript
await updateCardMessage(messageId, updatedCard);
```

**新代码：**
```typescript
await messaging.updateCardMessage(messageId, {
  type: "card",
  header: updatedCard.header,
  elements: updatedCard.elements,
});
```

## 具体文件迁移示例

### notification.service.ts

**迁移前：**
```typescript
import {
  sendFeishuBatchMessage,
  sendFeishuChatCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/utils/feishu-sdk";

export async function notifyWorkflowRunComplete(/* ... */) {
  const card = buildWorkflowRunCard(/* ... */);
  
  // 发送给用户
  await sendFeishuBatchMessage(userOpenIds, card);
  
  // 发送到群聊
  if (chatId) {
    await sendFeishuChatCardMessage(chatId, card);
  }
}
```

**迁移后：**
```typescript
import { messaging } from "~~/server/services/messaging";
import type { CardMessage } from "~~/server/services/messaging";

export async function notifyWorkflowRunComplete(/* ... */) {
  const card = buildWorkflowRunCard(/* ... */);
  
  // 发送给用户
  const recipients = userOpenIds.map(id => ({ type: "user" as const, id }));
  await messaging.sendBatchMessage(recipients, card);
  
  // 发送到群聊
  if (chatId) {
    await messaging.sendMessage({ type: "chat", id: chatId }, card);
  }
}

// 更新卡片构建函数返回类型
function buildWorkflowRunCard(/* ... */): CardMessage {
  return {
    type: "card",
    header: {
      title: "Workflow 运行完成",
      template: status === "success" ? "green" : "red",
    },
    elements: [/* ... */],
  };
}
```

### bot-command.service.ts

**迁移前：**
```typescript
import {
  replyFeishuMessage,
  replyFeishuCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/utils/feishu-sdk";

export async function handleHelpCommand(messageId: string) {
  const helpCard: FeishuInteractiveCard = {
    header: {
      title: { tag: "plain_text", content: "帮助" },
    },
    elements: [/* ... */],
  };
  
  await replyFeishuCardMessage(messageId, helpCard);
}
```

**迁移后：**
```typescript
import { messaging } from "~~/server/services/messaging";
import type { CardMessage } from "~~/server/services/messaging";

export async function handleHelpCommand(messageId: string) {
  const helpCard: CardMessage = {
    type: "card",
    header: {
      title: "帮助",
    },
    elements: [/* ... */],
  };
  
  await messaging.replyMessage(messageId, helpCard);
}
```

### card.service.ts

**迁移前：**
```typescript
import {
  sendFeishuChatCardMessage,
  updateCardMessage,
  type FeishuInteractiveCard,
} from "~~/server/utils/feishu-sdk";

export async function sendCard(chatId: string, card: FeishuInteractiveCard) {
  const result = await sendFeishuChatCardMessage(chatId, card);
  return result.message_id;
}

export async function updateCard(messageId: string, card: FeishuInteractiveCard) {
  await updateCardMessage(messageId, card);
}
```

**迁移后：**
```typescript
import { messaging } from "~~/server/services/messaging";
import type { CardMessage } from "~~/server/services/messaging";

export async function sendCard(chatId: string, card: CardMessage) {
  const result = await messaging.sendMessage({ type: "chat", id: chatId }, card);
  return result.messageId;
}

export async function updateCard(messageId: string, card: CardMessage) {
  await messaging.updateCardMessage(messageId, card);
}
```

## 类型迁移对照表

| 旧类型 | 新类型 | 说明 |
|--------|--------|------|
| `FeishuInteractiveCard` | `CardMessage` | 卡片消息类型 |
| `FeishuCardElement` | `CardElement` | 卡片元素类型 |
| - | `Recipient` | 新增：消息接收者类型 |
| - | `Message` | 新增：消息联合类型 |
| - | `SendResult` | 新增：发送结果类型 |

## 卡片结构变化

### Header 简化

**旧结构：**
```typescript
header: {
  title: {
    tag: "plain_text",
    content: "标题",
  },
  template: "green",
}
```

**新结构：**
```typescript
header: {
  title: "标题",
  template: "green",
}
```

### Elements 保持不变

卡片元素结构完全兼容，无需修改：

```typescript
elements: [
  {
    tag: "div",
    text: {
      tag: "plain_text",
      content: "内容",
    },
  },
  {
    tag: "action",
    actions: [
      {
        tag: "button",
        text: { tag: "plain_text", content: "按钮" },
        value: { action: "confirm" },
      },
    ],
  },
]
```

## 迁移检查清单

- [ ] 更新所有 `import` 语句
- [ ] 替换 `sendFeishuMessage` → `messaging.sendMessage`
- [ ] 替换 `sendFeishuCardMessage` → `messaging.sendMessage`
- [ ] 替换 `sendFeishuChatCardMessage` → `messaging.sendMessage`
- [ ] 替换 `sendFeishuBatchMessage` → `messaging.sendBatchMessage`
- [ ] 替换 `replyFeishuMessage` → `messaging.replyMessage`
- [ ] 替换 `replyFeishuCardMessage` → `messaging.replyMessage`
- [ ] 替换 `updateCardMessage` → `messaging.updateCardMessage`
- [ ] 更新类型定义 `FeishuInteractiveCard` → `CardMessage`
- [ ] 简化 `header.title` 结构
- [ ] 添加 `Recipient` 对象包装接收者 ID
- [ ] 添加 `type` 字段到消息对象
- [ ] 运行 TypeScript 类型检查
- [ ] 测试所有消息发送功能

## 渐进式迁移策略

### 阶段 1：新功能使用新接口

所有新开发的功能直接使用 `messaging` 服务。

### 阶段 2：逐个服务迁移 ✅

所有服务已完成迁移：

1. ✅ `card.service.ts` - 卡片服务
2. ✅ `bot-command.service.ts` - 机器人命令
3. ✅ `notification.service.ts` - 通知服务
4. ✅ `approval.service.ts` - 审批服务

### 阶段 3：保持兼容期

在迁移完成后，保留 `feishu-sdk.ts` 一段时间，确保所有功能正常。

### 阶段 4：清理旧代码

确认所有功能正常后，可以考虑移除直接的 SDK 调用。

## 常见问题

### Q: 性能会有影响吗？

A: 不会。抽象层只是简单的函数调用转发，性能开销可忽略不计。

### Q: 如何处理飞书特有的功能？

A: 使用可选链调用：`messaging.createApproval?.()`，或直接使用 `FeishuProvider`。

### Q: 可以混用新旧接口吗？

A: 可以，但建议尽快完成迁移以保持代码一致性。

### Q: 如何测试迁移后的代码？

A: 消息服务层可以轻松 mock，使用依赖注入替换 provider 即可。

## 后续计划

- [ ] 完成所有现有代码迁移
- [ ] 添加钉钉提供者支持
- [ ] 添加企业微信提供者支持
- [ ] 实现消息发送重试机制
- [ ] 添加消息发送监控和日志
- [ ] 支持消息模板系统

## 相关文档

- [消息服务 README](../server/services/messaging/README.md)
- [飞书集成文档](./feishu-integration.md)
- [API 设计规范](./design.md)
