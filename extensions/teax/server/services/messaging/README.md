# 消息服务抽象层

平台无关的消息发送服务，支持多种 IM 平台（当前支持飞书）。

## 设计理念

- **平台无关**：业务代码不直接依赖具体的 IM 平台 SDK
- **易于扩展**：通过实现 `IMessagingProvider` 接口即可支持新平台
- **类型安全**：完整的 TypeScript 类型定义
- **统一接口**：所有平台使用相同的 API

## 快速开始

### 基础用法

```typescript
import { messaging } from "~/server/services/messaging";

// 发送文本消息
await messaging.sendMessage(
  { type: "user", id: "user_open_id" },
  { type: "text", content: "Hello!" }
);

// 发送卡片消息
await messaging.sendMessage(
  { type: "chat", id: "chat_id" },
  {
    type: "card",
    header: {
      title: "部署通知",
      template: "green",
    },
    elements: [
      {
        tag: "div",
        text: {
          tag: "plain_text",
          content: "部署成功！",
        },
      },
    ],
  }
);
```

### 批量发送

```typescript
import { messaging } from "~/server/services/messaging";

const recipients = [
  { type: "user", id: "user1" },
  { type: "user", id: "user2" },
  { type: "user", id: "user3" },
];

const result = await messaging.sendBatchMessage(recipients, {
  type: "text",
  content: "批量通知消息",
});

console.log(`成功: ${result.success}, 失败: ${result.failed}`);
```

### 回复消息

```typescript
import { messaging } from "~/server/services/messaging";

// 回复文本
await messaging.replyMessage("message_id", {
  type: "text",
  content: "收到！",
});

// 回复卡片
await messaging.replyMessage("message_id", {
  type: "card",
  header: { title: "处理结果" },
  elements: [
    {
      tag: "div",
      text: { tag: "plain_text", content: "已处理" },
    },
  ],
});
```

### 更新卡片

```typescript
import { messaging } from "~/server/services/messaging";

await messaging.updateCardMessage("message_id", {
  type: "card",
  header: {
    title: "部署进度",
    template: "blue",
  },
  elements: [
    {
      tag: "div",
      text: {
        tag: "plain_text",
        content: "部署中... 50%",
      },
    },
  ],
});
```

### 审批流程

```typescript
import { messaging } from "~/server/services/messaging";

// 创建审批
const instanceCode = await messaging.createApproval?.({
  approvalCode: "approval_code",
  userId: "user_open_id",
  form: [
    { id: "field1", type: "input", value: "value1" },
    { id: "field2", type: "textarea", value: "value2" },
  ],
});

// 查询审批状态
const status = await messaging.getApprovalStatus?.(instanceCode);
console.log(status.status); // APPROVED, REJECTED, PENDING
```

### OAuth 认证

```typescript
import { messaging } from "~/server/services/messaging";

// 构建授权 URL
const authUrl = messaging.buildAuthUrl?.("random_state");

// 交换授权码
const tokens = await messaging.exchangeAuthCode?.("auth_code");
console.log(tokens.accessToken);

// 获取用户信息
const userInfo = await messaging.getUserInfo?.(tokens.accessToken);
console.log(userInfo.name, userInfo.email);
```

## 在现有代码中使用

### 迁移示例 1：通知服务

**旧代码（直接调用飞书 SDK）：**
```typescript
import { sendFeishuChatCardMessage } from "~/server/utils/feishu-sdk";

await sendFeishuChatCardMessage(chatId, {
  header: { title: { tag: "plain_text", content: "通知" } },
  elements: [/* ... */],
});
```

**新代码（使用消息服务）：**
```typescript
import { messaging } from "~/server/services/messaging";

await messaging.sendMessage(
  { type: "chat", id: chatId },
  {
    type: "card",
    header: { title: "通知" },
    elements: [/* ... */],
  }
);
```

### 迁移示例 2：机器人回复

**旧代码：**
```typescript
import { replyFeishuCardMessage } from "~/server/utils/feishu-sdk";

await replyFeishuCardMessage(messageId, card);
```

**新代码：**
```typescript
import { messaging } from "~/server/services/messaging";

await messaging.replyMessage(messageId, {
  type: "card",
  header: card.header,
  elements: card.elements,
});
```

## 扩展新平台

### 实现钉钉提供者示例

```typescript
// server/services/messaging/providers/dingtalk.provider.ts
import type { IMessagingProvider, Recipient, Message, SendResult } from "../types";

export class DingtalkProvider implements IMessagingProvider {
  readonly name = "dingtalk";

  async sendMessage(recipient: Recipient, message: Message): Promise<SendResult> {
    // 实现钉钉消息发送逻辑
    // ...
    return { success: true };
  }

  // 实现其他必需方法...
}
```

### 注册新提供者

```typescript
// server/services/messaging/index.ts
import { DingtalkProvider } from "./providers/dingtalk.provider";

providers.set("dingtalk", new DingtalkProvider());

// 使用钉钉提供者
const dingtalk = getMessagingProvider("dingtalk");
await dingtalk.sendMessage(/* ... */);
```

## 类型定义

### Recipient（接收者）

```typescript
type RecipientType = "user" | "chat" | "email";

interface Recipient {
  type: RecipientType;
  id: string;
}
```

### Message（消息）

```typescript
interface TextMessage {
  type: "text";
  content: string;
}

interface CardMessage {
  type: "card";
  header: {
    title: string;
    template?: "blue" | "green" | "red" | "orange" | "purple" | "default";
  };
  elements: CardElement[];
}

type Message = TextMessage | CardMessage;
```

### SendResult（发送结果）

```typescript
interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

## 架构图

```
┌─────────────────────────────────────────────────────────┐
│                    业务代码层                            │
│  (notification.service, bot-command.service, etc.)      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              消息服务抽象层 (messaging)                  │
│                                                          │
│  • 统一接口 (IMessagingProvider)                        │
│  • 平台无关的类型定义                                    │
│  • 提供者注册与管理                                      │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────┼────────────┐
        ▼            ▼            ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│FeishuProvider│ │DingtalkProv..│ │WechatProvider│
└──────┬───────┘ └──────┬───────┘ └──────┬───────┘
       │                │                │
       ▼                ▼                ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  飞书 SDK    │ │  钉钉 SDK    │ │  企业微信SDK │
└──────────────┘ └──────────────┘ └──────────────┘
```

## 最佳实践

1. **使用默认导出**：大多数情况下使用 `messaging` 即可
2. **错误处理**：检查 `SendResult.success` 判断是否成功
3. **批量发送**：使用 `sendBatchMessage` 而不是循环调用 `sendMessage`
4. **可选功能**：使用可选链 `?.` 调用平台特定功能（如审批）
5. **类型安全**：充分利用 TypeScript 类型检查

## 文件结构

```
server/services/messaging/
├── types.ts                      # 类型定义
├── index.ts                      # 统一入口
├── providers/
│   ├── feishu.provider.ts       # 飞书实现
│   ├── dingtalk.provider.ts     # 钉钉实现（示例）
│   └── wechat.provider.ts       # 企业微信实现（示例）
└── README.md                     # 本文档
```
