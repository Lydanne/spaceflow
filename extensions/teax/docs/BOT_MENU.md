# 飞书机器人自定义菜单

Teax 支持为飞书机器人动态配置个性化菜单,用户可以通过菜单快速访问组织、仓库和控制面板。

## 功能特性

### 🎯 自动个性化

- **用户级菜单** - 根据用户所属组织自动生成菜单
- **组织级菜单** - 显示组织下的仓库列表
- **智能更新** - 用户与机器人交互时自动更新菜单

### 📋 菜单结构

#### 未绑定用户菜单

```
📋 帮助         → /help
🔗 绑定账号     → 跳转到 Teax 设置页
🎛️ 控制面板    → 跳转到 Teax 首页
```

#### 已绑定用户菜单

```
📁 我的组织
  ├─ 组织A      → /list 组织A
  ├─ 组织B      → /list 组织B
  └─ ...

⚡ 快捷操作
  ├─ 📊 查看状态  → /status
  └─ 📋 帮助      → /help

🎛️ 控制面板    → 跳转到 Teax 首页
```

#### 组织菜单

```
📦 组织名
  ├─ repo1      → /actions org/repo1
  ├─ repo2      → /actions org/repo2
  └─ ...

⚙️ 组织操作
  ├─ 📋 仓库列表  → /list org
  └─ 📊 查看状态  → /status

🎛️ 控制面板    → 跳转到 org 页面
```

## 工作原理

### 自动更新机制

1. **首次交互** - 用户发送任何指令时,自动更新其个性化菜单
2. **数据同步** - 从数据库读取用户的组织和仓库信息
3. **菜单生成** - 根据权限和数据动态生成菜单结构
4. **API 推送** - 调用飞书 API 更新机器人菜单

### 菜单类型

- **link** - 打开网页链接(控制面板)
- **command** - 发送机器人指令(/help, /list 等)
- **event** - 触发事件(用于父级菜单)

## API 接口

### 手动更新菜单

管理员可以通过 API 手动触发菜单更新:

```bash
# 更新用户菜单
curl -X POST https://your-teax.com/api/admin/bot-menu/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "user",
    "target": "ou_xxxxx"
  }'

# 更新组织菜单
curl -X POST https://your-teax.com/api/admin/bot-menu/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "org",
    "target": "myorg"
  }'
```

## 代码集成

### 生成用户菜单

```typescript
import { generateUserMenu } from '~~/server/services/bot-menu.service';

const menuConfig = await generateUserMenu(openId);
// menuConfig.menus 包含最多 3 个一级菜单
```

### 生成组织菜单

```typescript
import { generateOrgMenu } from '~~/server/services/bot-menu.service';

const menuConfig = await generateOrgMenu('myorg');
```

### 更新菜单

```typescript
import { updateUserBotMenu, updateOrgBotMenu } from '~~/server/services/bot-menu.service';

// 更新用户菜单
await updateUserBotMenu(openId);

// 更新组织菜单
await updateOrgBotMenu(orgName);
```

## 限制说明

### 飞书平台限制

- **一级菜单** - 最多 3 个
- **二级菜单** - 每个一级菜单最多 5 个子菜单
- **菜单名称** - 最长 40 个字符
- **更新频率** - 建议不超过 10 次/分钟

### Teax 实现限制

- **组织数量** - 菜单中最多显示 10 个组织
- **仓库数量** - 每个组织菜单最多显示 5 个仓库
- **缓存时间** - tenant_access_token 缓存 2 小时

## 最佳实践

### 1. 菜单设计原则

- ✅ 高频操作放在一级菜单
- ✅ 相关功能分组到二级菜单
- ✅ 使用 Emoji 增强可读性
- ✅ 菜单名称简洁明了

### 2. 性能优化

- ✅ 异步更新菜单,不阻塞指令处理
- ✅ 使用 Redis 缓存 access_token
- ✅ 限制数据库查询数量
- ✅ 错误不影响主流程

### 3. 用户体验

- ✅ 未绑定用户引导绑定
- ✅ 提供控制面板快捷入口
- ✅ 菜单与指令功能一致
- ✅ 支持直接点击触发操作

## 故障排查

### 菜单未更新

1. 检查飞书应用权限是否包含 `im:message`
2. 确认 `NUXT_FEISHU_APP_ID` 和 `NUXT_FEISHU_APP_SECRET` 配置正确
3. 查看服务器日志中的错误信息
4. 手动调用更新 API 测试

### 菜单显示异常

1. 检查菜单结构是否符合飞书规范
2. 确认菜单名称长度未超限
3. 验证子菜单数量未超过 5 个
4. 检查 URL 和 command 格式

### 权限问题

1. 确认应用已开通"机器人"能力
2. 检查是否有"获取与更新应用信息"权限
3. 验证 tenant_access_token 是否有效

## 相关文件

- `server/services/bot-menu.service.ts` - 菜单服务核心逻辑
- `server/api/admin/bot-menu/update.post.ts` - 手动更新 API
- `server/services/bot-command.service.ts` - 集成菜单自动更新

## 参考文档

- [飞书机器人菜单 API](https://open.feishu.cn/document/server-docs/im-v1/message-menu/patch)
- [飞书开放平台](https://open.feishu.cn/)
