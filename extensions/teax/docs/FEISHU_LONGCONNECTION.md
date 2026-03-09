# 飞书长连接配置指南

## 什么是飞书长连接

飞书长连接是基于 **WebSocket** 的事件推送模式,相比传统 Webhook 有显著优势:

### 优势对比

| 特性 | Webhook (传统) | 长连接 (推荐) |
|------|---------------|--------------|
| **公网 IP** | ❌ 必需 | ✅ 不需要 |
| **开发调试** | ⚠️ 需要内网穿透 | ✅ 本地直接接收 |
| **实时性** | ⚠️ 秒级延迟 | ✅ 毫秒级 |
| **配置复杂度** | ⚠️ 需要配置 URL | ✅ 零配置 |
| **安全性** | ⚠️ 需要签名验证 | ✅ SDK 自动处理 |
| **防火墙** | ⚠️ 需要配置白名单 | ✅ 不需要 |

### 工作原理

```
Teax 服务器 <──WebSocket──> 飞书开放平台
    ↓ 实时接收
事件处理器
    ├─ 消息事件
    ├─ 卡片交互
    ├─ 审批事件
    └─ 菜单点击
```

## 快速开始

### 1. 环境变量配置

在 `.env` 中添加:

```bash
# 飞书应用凭证 (必需)
NUXT_FEISHU_APP_ID=cli_xxxxxxxxxxxxx
NUXT_FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxx

# 事件加密密钥 (可选,推荐)
NUXT_FEISHU_ENCRYPT_KEY=xxxxxxxxxxxxx

# 禁用长连接 (可选,默认启用)
# FEISHU_LONGCONNECTION_DISABLED=true
```

### 2. 启动服务

```bash
pnpm nuxt:dev
```

启动后会看到:

```
[feishu-ws] 🚀 Starting long connection...
[feishu-ws] ✅ Long connection established successfully
```

### 3. 飞书开放平台配置

**重要**: 使用长连接模式时,**不需要**在飞书开放平台配置请求网址!

只需要:
1. 进入应用 → **事件订阅**
2. 选择 **长连接模式** (而不是"请求网址配置")
3. 订阅需要的事件:
   - `im.message.receive_v1` - 接收消息
   - `card.action.trigger` - 卡片交互
   - `approval_instance` - 审批事件
   - `application.bot.menu_v6` - 菜单点击

## 实现细节

### 插件架构

长连接通过 Nuxt 插件自动启动:

```typescript
// server/plugins/feishu-longconnection.ts
export default defineNitroPlugin(async () => {
  const wsClient = new lark.WSClient({
    appId: config.feishuAppId,
    appSecret: config.feishuAppSecret,
    loggerLevel: lark.LoggerLevel.info,
  });

  await wsClient.start({
    eventDispatcher: new lark.EventDispatcher({
      encryptKey: config.feishuEncryptKey,
    }).register({
      "im.message.receive_v1": handleMessageEvent,
      "card.action.trigger": handleCardActionEvent,
      // ...
    }),
  });
});
```

### 事件处理流程

```
飞书事件推送 (WebSocket)
    ↓
EventDispatcher 自动分发
    ↓
事件处理函数
    ├─ handleMessageEvent() → handleBotCommand()
    ├─ handleCardActionEvent() → handleCardAction()
    ├─ handleApprovalEvent() → handleFeishuApprovalEvent()
    └─ handleMenuClickEvent() → handleMenuClick()
```

### 支持的事件

| 事件类型 | 事件名 | 处理函数 | 说明 |
|---------|--------|---------|------|
| 消息 | `im.message.receive_v1` | `handleMessageEvent` | 机器人收到消息 |
| 卡片交互 | `card.action.trigger` | `handleCardActionEvent` | 用户点击卡片按钮 |
| 审批 | `approval_instance` | `handleApprovalEvent` | 审批状态变更 |
| 菜单 | `application.bot.menu_v6` | `handleMenuClickEvent` | 用户点击机器人菜单 |

## 开发环境使用

### 本地开发

长连接模式的最大优势就是**本地开发无需内网穿透**:

```bash
# 1. 配置环境变量
cp .env.example .env
# 编辑 .env,填入飞书应用凭证

# 2. 启动开发服务器
pnpm nuxt:dev

# 3. 发送消息给机器人测试
# 无需任何额外配置!
```

### 调试日志

启用详细日志:

```typescript
// 在 feishu-longconnection.ts 中
loggerLevel: lark.LoggerLevel.debug, // info -> debug
```

查看事件接收:

```
[feishu-ws] 📨 Message from ou_xxx: /help
[feishu-ws] 🎯 Card action from ou_xxx
[feishu-ws] 📋 Approval event received
[feishu-ws] 📱 Menu clicked: org_myorg by ou_xxx
```

## 生产环境部署

### 推荐配置

```bash
# .env.production
NUXT_FEISHU_APP_ID=cli_xxxxx
NUXT_FEISHU_APP_SECRET=xxxxx
NUXT_FEISHU_ENCRYPT_KEY=xxxxx  # 强烈推荐启用加密

# 不需要配置 Webhook URL!
```

### 高可用部署

**重要**: 长连接模式**不支持多实例部署**!

```
❌ 错误: 多个 Teax 实例同时启动长连接
   → 只有一个随机实例会收到事件

✅ 正确: 单实例部署 + 负载均衡 (API 层面)
   → 长连接实例唯一,API 可以多实例
```

如果需要高可用:
1. **方案 A**: 使用 Webhook 模式 (支持多实例)
2. **方案 B**: 长连接 + 主备切换 (需要额外实现)

### 监控和告警

检查长连接状态:

```typescript
import { getLongConnectionStatus } from '~~/server/plugins/feishu-longconnection';

const status = getLongConnectionStatus();
console.log(status); // { enabled: true, connected: true }
```

## 切换模式

### 从 Webhook 切换到长连接

1. **停止 Webhook 配置**:
   - 进入飞书开放平台 → 事件订阅
   - 删除或禁用请求网址配置

2. **启用长连接**:
   - 确保 `FEISHU_LONGCONNECTION_DISABLED` 未设置或为 `false`
   - 重启 Teax 服务器

3. **验证**:
   - 查看日志确认连接成功
   - 发送测试消息

### 从长连接切换到 Webhook

1. **禁用长连接**:
   ```bash
   FEISHU_LONGCONNECTION_DISABLED=true
   ```

2. **配置 Webhook**:
   - 飞书开放平台 → 事件订阅 → 请求网址配置
   - URL: `https://your-domain.com/api/webhooks/feishu`

3. **重启服务器**

## 常见问题

### Q: 长连接断开怎么办?

**A**: SDK 会自动重连,无需手动处理。查看日志:

```
[feishu-ws] Connection lost, reconnecting...
[feishu-ws] ✅ Reconnected successfully
```

### Q: 如何知道长连接是否正常?

**A**: 三种方式:
1. 查看启动日志: `✅ Long connection established successfully`
2. 发送测试消息给机器人
3. 调用 `getLongConnectionStatus()` API

### Q: 长连接和 Webhook 可以同时启用吗?

**A**: 可以,但**不推荐**:
- 会收到重复事件
- 增加复杂度
- 建议只选择一种模式

### Q: 开发环境用长连接,生产用 Webhook?

**A**: 可以,通过环境变量控制:

```bash
# .env.development
FEISHU_LONGCONNECTION_DISABLED=false  # 启用长连接

# .env.production
FEISHU_LONGCONNECTION_DISABLED=true   # 禁用长连接,使用 Webhook
```

### Q: 长连接有消息大小限制吗?

**A**: 与 Webhook 相同,单个事件最大 1MB。

### Q: 长连接会增加服务器负载吗?

**A**: 几乎没有:
- 空闲时只维持心跳连接
- 事件处理与 Webhook 相同
- 内存占用可忽略 (~1MB)

## 性能优化

### 1. 事件处理异步化

已实现,事件处理不阻塞连接:

```typescript
"im.message.receive_v1": async (data) => {
  // 异步处理,不阻塞 WebSocket
  await handleMessageEvent(data);
}
```

### 2. 错误处理

所有事件处理都有 try-catch:

```typescript
try {
  await handleBotCommand(...);
} catch (error) {
  console.error("[feishu-ws] Error:", error);
  // 不影响其他事件处理
}
```

### 3. 日志级别

生产环境使用 `info` 级别:

```typescript
loggerLevel: lark.LoggerLevel.info, // 不要用 debug
```

## 安全建议

### 1. 启用事件加密

强烈推荐配置 `NUXT_FEISHU_ENCRYPT_KEY`:

```bash
NUXT_FEISHU_ENCRYPT_KEY=your-encrypt-key
```

### 2. 保护应用凭证

```bash
# ❌ 不要提交到 Git
NUXT_FEISHU_APP_SECRET=xxxxx

# ✅ 使用环境变量或密钥管理服务
```

### 3. 限制事件订阅

只订阅必需的事件,减少攻击面。

## 总结

### 推荐使用场景

✅ **适合长连接**:
- 开发和测试环境
- 单实例部署
- 无公网 IP 的环境
- 需要低延迟的场景

⚠️ **适合 Webhook**:
- 多实例高可用部署
- 已有公网 IP 和域名
- 需要审计所有请求

### 当前 Teax 配置

Teax **同时支持**长连接和 Webhook:
- **长连接**: `server/plugins/feishu-longconnection.ts` (默认启用)
- **Webhook**: `server/api/webhooks/feishu.post.ts` (始终可用)

建议:
- **开发环境**: 使用长连接 (无需配置)
- **生产环境**: 根据部署架构选择

## 参考文档

- [飞书长连接模式官方文档](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/event-subscription-guide/long-connection-mode)
- [飞书 Node.js SDK](https://github.com/larksuite/node-sdk)
- [事件订阅概述](https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/overview)
