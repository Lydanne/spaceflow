# 飞书卡片框架设计（CardKit）

## 概述

CardKit 是一个声明式的飞书卡片开发框架，借鉴 React 的心智模型，让开发者以"页面 + 路由 + 事件绑定"的方式构建交互式飞书卡片，替代手写 JSON + if-else 分发的原始模式。

### 设计目标

1. **声明式**：像 React 组件一样定义"卡片页面"，渲染和交互处理内聚在一起
2. **自动路由**：按钮/表单提交自动路由到对应页面的 handler，无需手写分发逻辑
3. **事件绑定**：在构建卡片时直接绑定交互处理函数，不再手拼 `JSON.stringify({ action: "xxx" })`
4. **JSON 2.0 优先**：CardKit 强制使用飞书卡片 JSON 2.0 schema，按钮 `value` 直接为对象，支持 form 容器等新特性
5. **统一构建**：所有卡片统一使用 `EnhancedCardBuilder`，底层复用 `FeishuCardBuilder`

### 不做什么

- **不做 Virtual DOM / Reconciliation** — 飞书卡片是服务端渲染的静态 JSON，没有 diff 更新
- **状态编码在 UI 中** — 页面状态通过 `data()` 声明，自动编码到按钮 action.value 中，零服务端存储
- **不做组件树** — 飞书卡片的嵌套层级有限（form > input/select/button），不需要递归组件树

## 核心概念

### 1. CardPage — 卡片页面（类比 React Component）

每个 `CardPage` 是一个自治的单元，包含：

- **name** — 唯一标识，作为路由地址
- **data()** — 可选，声明页面初始状态（类似 Vue data），状态编码在 UI 的 action.value 中
- **render()** — 渲染函数，通过 `ctx.data` 读取当前状态，返回卡片 JSON
- **onAction()** — 可选，处理来自该页面的所有交互，通过 `ctx.setData()` 更新状态

```typescript
// server/card-pages/control-panel/home.page.ts
import { defineCardPage, navigate } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp:home",

  async render(ctx) {
    const orgs = await fetchUserOrgs(ctx.openId);

    return ctx.card({ title: "📋 控制面板", theme: "blue" })
      .text("**请选择组织**")
      .divider()
      .buttons(
        orgs.map((org) => ({
          text: `📁 ${org.name}`,
          navigate: ["cp:org", { orgName: org.name }],
        })),
      )
      .build();
  },
});
```

### 2. CardRouter — 卡片路由（类比 React Router）

集中管理所有 CardPage 的注册和分发：

```typescript
// 注册：自动扫描 server/card-pages/**/*.page.ts
// 或手动注册
cardRouter.register(homePage);
cardRouter.register(orgPage);

// 分发：替代 handleCardAction 里的 if-else
export async function handleCardAction(ctx: CardActionContext) {
  return cardRouter.dispatch(ctx);
}
```

### 3. navigate() — 页面跳转（类比 React Router navigate）

在按钮 value 中注入路由信息，用户点击后自动导航到目标页面：

```typescript
// 声明式跳转（在 render 中使用）
ctx.card({ ... }).button("📁 OrgA", { navigate: ["cp:org", { orgName: "OrgA" }] })

// 编程式跳转（在 onAction handler 中使用）
return navigate("cp:result", { runId: 123 });
```

### 4. CardContext — 上下文（类比 React Context / Props）

`render` 接收 `CardRenderContext`，`onAction` 接收 `CardActionContext`（继承自前者）。两者都提供 `ctx.card()` 用于创建已绑定当前页面名的 builder：

```typescript
// render 中
ctx.openId        // 用户 ID
ctx.params         // 路由参数（来自 navigate）
ctx.data           // 页面状态（来自 data() 初始值或上次 setData）
ctx.card({ ... })  // 创建 EnhancedCardBuilder，自动绑定 pageName + data

// onAction 中（额外字段）
ctx.type           // "button" | "form_submit"
ctx.action         // 按钮 action 标识
ctx.data           // 当前页面状态（从 action.value.__data 解码）
ctx.setData({})    // 合并更新状态 → 重渲染当前页面
ctx.formValue      // 表单数据（仅 form_submit）
ctx.formName       // 表单名称（仅 form_submit）
ctx.update()   // 卡片更新回调
ctx.token          // 飞书回调 token
```

> 完整类型定义见下方「类型定义」章节。

### 5. 事件处理 — 按钮 action 标识 + 统一 onAction

按钮通过 `action` 字段标记行为意图，所有按钮点击统一在页面的 `onAction` 中处理：

```typescript
defineCardPage({
  name: "approval:detail",

  async render(ctx) {
    const flowId = ctx.params.flowId as string;
    const flow = await getApprovalFlow(flowId);

    return ctx.card({ title: `📋 审批: ${flow.title}`, theme: "blue" })
      .text(`申请人: ${flow.requester}\n原因: ${flow.reason}`, true)
      .divider()
      // action 按钮显式传 params，保证 onAction 中能拿到 flowId
      .button("✅ 批准", { type: "primary", action: "approve", params: { flowId } })
      .button("❌ 拒绝", { type: "danger", action: "reject", params: { flowId } })
      .button("💬 留言", { action: "comment", params: { flowId } })
      .build();
  },

  // 统一处理所有按钮点击，通过 ctx.action 区分
  async onAction(ctx) {
    const flowId = ctx.params.flowId as string;

    switch (ctx.action) {
      case "approve":
        await approveFlow(flowId, ctx.openId);
        return navigate("approval:done", { flowId, result: "approved" });
      case "reject":
        await rejectFlow(flowId, ctx.openId);
        return navigate("approval:done", { flowId, result: "rejected" });
      case "comment":
        return navigate("approval:comment", { flowId });
    }
  },
});
```

**表单提交也走 onAction：**

表单提交按钮（`action_type: "form_submit"`）的回调同样走 `onAction`，通过 `ctx.type` 区分：

```typescript
defineCardPage({
  name: "test:form",

  data = ()=>({});

  async render(ctx) {
    return ctx.card({ title: "🧪 表单测试", theme: "blue", schema: "2.0" })
      .form("test_form")
        .input({ name: "username", label: "用户名", required: true })
        .select({
          name: "priority",
          label: "优先级",
          options: [
            { label: "🟢 低", value: "low" },
            { label: "🔴 高", value: "high" },
          ],
        })
        .formButtons({ submit: { text: "提交" }, reset: { text: "重置" } })
      .endForm()
      // 表单外还可以有普通按钮
      .button("⬅️ 返回", { action: "back" })
      .build();
  },

  async onAction(ctx) {
    // ctx.type 区分交互类型
    if (ctx.type === "form_submit") {
      // ctx.formValue 直接拿表单数据，ctx.formName 拿表单名
      const { username, priority } = ctx.formValue!;
      await saveData(username, priority);
      return navigate("test:result", { username, priority });
    }

    // 普通按钮
    switch (ctx.action) {
      case "back":
        return navigate("cp:home");
    }
  },
});
```

**三种交互模式总览：**

| 模式 | API | 编码位置 | onAction 中的 ctx |
| --- | --- | --- | --- |
| `navigate` | `.button("进入", { navigate: [...] })` | `value.__page + __params` | 不走 onAction，直接跳转目标页面 `render()` |
| `action` | `.button("批准", { action: "approve" })` | `value.__page + __action + __data` | `type="button"`, `action="approve"`, `data={...}` |
| `formButtons` | `.formButtons({ submit: {...} })` | `value.__page + __formName + __data` | `type="form_submit"`, `formValue={...}`, `formName="..."`, `data={...}` |

> `url` 按钮（`.button("链接", { url: "..." })`）为飞书原生链接跳转，不触发回调。
> `form_reset` 为纯前端操作，不发起回调。

**设计优势：**

- **纯无状态** — 所有路由信息和页面状态编码在按钮 `value` 中，重启后依然可用
- **不需要 Registry / Redis** — 零额外基础设施
- **统一入口** — 所有交互都走 `onAction`，`ctx.type` 区分类型，`ctx.formValue` / `ctx.action` 方便取数据

### 6. 页面状态管理 — data + setData（类比状态机）

页面可以通过 `data()` 声明局部状态，状态**编码在每个按钮的 action.value 中**（类比状态机把 state 编码在每个 transition 上）。点击按钮时飞书原样返回 value，等于 UI 本身就是状态载体，零服务端存储。

```typescript
defineCardPage({
  name: "cp:repos",

  // 声明初始状态（类似 Vue data）
  data: () => ({ page: 1, filter: "" }),

  async render(ctx) {
    // ctx.data = 当前状态（首次用 data() 初始值，后续从 value.__data 解码）
    const { page, filter } = ctx.data;
    const repos = await fetchRepos(ctx.params.orgName, { page, filter });

    return ctx.card({ title: `📁 仓库列表 (第${page}页)`, theme: "blue" })
      .text(`共 ${repos.total} 个仓库`)
      .divider()
      .buttons(repos.items.map(r => ({
        text: `📦 ${r.name}`,
        navigate: ["cp:repo", { owner: ctx.params.orgName, repo: r.name }],
      })))
      .divider()
      .button("⬅️ 上一页", { action: "prev_page" })
      .button("➡️ 下一页", { action: "next_page" })
      .build();
  },

  async onAction(ctx) {
    switch (ctx.action) {
      case "next_page":
        return ctx.setData({ page: ctx.data.page + 1 });
      case "prev_page":
        return ctx.setData({ page: Math.max(1, ctx.data.page - 1) });
    }
  },
});
```

**工作原理：**

```text
render(ctx) 时：
  ctx.data = { page: 1, filter: "" }

  每个 action 按钮的 value 自动携带当前 data 快照：
  {
    "__page": "cp:repos",
    "__action": "next_page",
    "__params": { "orgName": "my-org" },
    "__data": { "page": 1, "filter": "" }
  }

用户点击 "下一页"：
  → 飞书回调带回 value（含 __data: { page: 1 }）
  → Router 解码 __data → ctx.data = { page: 1 }
  → onAction 调用 ctx.setData({ page: 2 })
  → 等价于 navigate(当前页面, 当前params, { data: { page: 2, filter: "" } })
  → 重新 render，ctx.data = { page: 2 }
```

**设计要点：**

- **零存储** — 状态完全编码在 action.value 中，重启不受影响
- **2KB 约束** — `__params + __data + __action + __page` 合计 ≤ 2KB，data 只放轻量状态（页码/筛选/选中项），重数据在 render 内查库
- **`setData` 是语法糖** — 底层等价于 `navigate(当前页面, 当前params, { data: merge(ctx.data, partial) })`
- **navigate 不携带 data** — 跳转到其他页面时 data 不传递（data 是 per-page 的），目标页面用自己的 `data()` 初始值
- **无 data() 的页面** — `ctx.data` 为 `{}`，按钮 value 中不编码 `__data`

### 7. 异步任务 — asyncTask（解决飞书回调超时）

飞书卡片回调有约 3 秒超时限制。对于触发工作流、轮询运行状态等耗时操作，如果在 `onAction` 中同步等待会导致超时和 UI 闪烁。`asyncTask` 解决了这个问题：

```typescript
import { defineCardPage, asyncTask } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp:trigger-wf",

  async onAction(ctx) {
    // asyncTask 立即返回 loading 卡片（飞书 3 秒内渲染），
    // task 在后台异步执行，通过闭包访问 ctx.update 更新最终结果。
    return asyncTask(
      `**仓库**: ${owner}/${repo}\n\n⏳ 正在触发工作流，请稍候...`,
      async () => {
        // 耗时操作：dispatch + 轮询
        await giteaService.dispatchWorkflow(owner, repo, workflow, branch, inputs);

        // 轮询完成后更新卡片
        await ctx.update(
          new EnhancedCardBuilder({ title: "✅ 工作流已触发", theme: "green" }, "")
            .text(`运行编号: #${runNumber}`)
            .build(),
        );
      },
    );
  },
});
```

**`asyncTask(loading, task)` 参数：**

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `loading` | `string \| CardJSON` | 字符串时自动构建蓝色 loading 卡片；也可传完整 CardJSON |
| `task` | `() => Promise<void>` | 后台异步任务，通过闭包访问 `ctx.update` |

**执行流程：**

```text
onAction 返回 AsyncTaskResult
  → CardRouter 立即返回 loadingCard（飞书渲染 loading 状态）
  → task() 在后台执行（fire-and-forget）
  → task 内通过 ctx.update() 更新最终结果
  → 如果 task 抛异常，CardRouter 自动 catch 并打印日志
```

### 8. 导航守卫 — beforeEnter / beforeLeave（参考 vue-router）

CardKit 支持页面级和全局级导航守卫，用于权限检查、登录验证等场景，避免在每个 `onAction` / `render` 中重复编写检查逻辑。

#### 守卫类型

```typescript
/** 导航守卫上下文（类似 vue-router 的 to/from） */
interface NavigationGuardContext {
  openId: string;
  to: { page: string; params: Record<string, unknown> };
  from: { page: string; params: Record<string, unknown> } | null;
}

/**
 * 守卫返回值（参考 vue-router）：
 * - undefined / true → 放行
 * - false → 阻止导航（保持当前卡片）
 * - CardJSON → 阻止并渲染替代卡片
 * - NavigateResult → 重定向到另一个页面
 */
type GuardResult = boolean | CardJSON | NavigateResult | undefined;
```

#### 页面级守卫

```typescript
import { defineCardPage, guards, requireBinding, requireRepoPermission } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp:trigger-wf",

  // 组合多个守卫（类似 vue-router 数组守卫）
  beforeEnter: guards(
    requireBinding(),                        // 要求已绑定飞书账号
    requireRepoPermission("actions:trigger"), // 要求仓库操作权限
  ),

  // beforeLeave: 仅在 onAction 返回 NavigateResult 时触发
  // beforeLeave({ to, from }) { ... },

  async render(ctx) { ... },
  async onAction(ctx) { ... },
});
```

#### 全局守卫

```typescript
import { cardRouter } from "~~/server/card-kit";

// 类似 vue-router router.beforeEach
cardRouter.beforeEach(async ({ openId }) => {
  const user = await getActiveAccount(openId);
  if (!user) return false; // 阻止所有未绑定用户的访问
});
```

#### 执行流程

```text
dispatch(input)
  │
  ├─ 解析目标页面
  │
  ├─ 【全局 beforeEach】依次执行所有全局守卫
  │   └─ 任一拦截 → 返回替代卡片或阻止
  │
  ├─ 【页面 beforeEnter】目标页面.beforeEnter(ctx)
  │   └─ 拦截 → 返回替代卡片或阻止
  │
  ├─ render / onAction 正常执行
  │   │
  │   └─ onAction 返回 NavigateResult →
  │       ├─ 【beforeLeave】当前页面.beforeLeave(ctx)
  │       │   └─ 拦截 → 返回替代卡片或阻止
  │       ├─ 【全局 beforeEach】
  │       └─ 【页面 beforeEnter】目标页面.beforeEnter(ctx)
  │
  └─ 最终渲染目标页面 render()
```

#### 内置守卫工厂

| 工厂函数 | 说明 |
| --- | --- |
| `requireBinding()` | 检查飞书账号绑定，未绑定时渲染"未绑定账号"提示卡片 |
| `requireRepoPermission(permission)` | 检查仓库操作权限，从 `params.owner/repo` 或 `params.repoFullName` 定位仓库 |
| `guards(...fns)` | 组合多个守卫，按序执行，任一拦截即停 |

## 架构设计

### 文件结构

```
server/
├── card-kit/                              # 框架核心
│   ├── index.ts                           # 统一导出
│   ├── types.ts                           # 类型定义
│   ├── router.ts                          # CardRouter 实现
│   └── builder.ts                         # EnhancedCardBuilder（包装 FeishuCardBuilder）
│
├── card-pages/                            # 卡片页面（扁平结构）
│   ├── cp-home.page.ts                    # cp:home — 控制面板首页
│   ├── cp-repos.page.ts                   # cp:repos — 组织仓库列表
│   ├── cp-repo-menu.page.ts               # cp:repo-menu — 仓库功能菜单
│   ├── cp-actions.page.ts                 # cp:actions — Actions 运行记录
│   ├── cp-feature.page.ts                 # cp:feature — 功能详情
│   ├── account-home.page.ts               # account:home — 账户信息
│   ├── account-guide.page.ts              # account:guide — 绑定教程
│   ├── account-unbound.page.ts            # account:unbound — 解绑成功
│   ├── preset-console.page.ts             # preset:console — 预设控制台
│   ├── wf-select.page.ts                  # wf:select — 工作流选择
│   ├── wf-params.page.ts                  # wf:params — 工作流参数填写
│   ├── approval-pending.page.ts           # approval:pending — 审批待处理
│   ├── test-form.page.ts                  # test:form — 表单测试
│   └── test-result.page.ts                # test:result — 表单结果
│
├── utils/
│   └── feishu-card-builder.ts             # FeishuCardBuilder（底层 JSON 构建器）
│
└── services/
    └── bot-command.service.ts             # handleCardAction → cardRouter.dispatch
```

### 路由机制

#### 路由编码

`navigate()` 和 `action` 按钮在 `value` 字段中编码路由信息和状态：

```json
// navigate 按钮 — 跳转到目标页面，不携带 data（目标页用自己的 data() 初始值）
{
  "__page": "cp:org",
  "__params": { "orgName": "my-org" }
}

// action 按钮 — 回调到当前页面 onAction，携带当前 data 快照
{
  "__page": "cp:repos",
  "__action": "next_page",
  "__params": { "orgName": "my-org" },
  "__data": { "page": 1, "filter": "" }
}
```

前缀 `__` 作为框架保留字段：`__page`（路由）、`__params`（参数）、`__action`（行为标识）、`__data`（页面状态）、`__formName`（表单名）。

#### 路由分发流程

```text
用户点击按钮 / 提交表单
  → 飞书回调 card.action.trigger
  → feishu-longconnection.ts handleCardActionEvent()
  → handleCardAction()
  → cardRouter.dispatch(ctx)
      ├─ 从 action.value 解析 __page
      ├─ 查找注册的 CardPage
      ├─ 解码状态：value.__data 存在？
      │    → ctx.data = __data
      │    否则 → ctx.data = page.data?.() ?? {}
      │
      ├─ 【守卫】全局 beforeEach → 页面 beforeEnter
      │    → 拦截时直接返回替代卡片 / 重定向 / undefined
      │
      ├─ 注入 ctx.card / ctx.setData / ctx.update
      ├─ form_value 存在？
      │    → 调用 page.onAction(ctx)，ctx.type="form_submit"，ctx.formValue={...}
      ├─ value.__action 存在？
      │    → 调用 page.onAction(ctx)，ctx.type="button"，ctx.action=__action
      ├─ 都不存在？（纯 navigate）
      │    → 调用目标页面的 render(ctx)
      │
      └─ 处理 onAction 返回值：
           ├─ NavigateResult → beforeLeave(当前) → beforeEach + beforeEnter(目标) → render(目标)
           ├─ AsyncTaskResult → 立即返回 loadingCard，后台执行 task()
           ├─ ToastResult → 返回飞书 toast 格式
           └─ CardJSON → 直接返回
```

#### 表单提交路由

表单提交（`action_type: "form_submit"`）通过提交按钮的 `value.__page` 路由，和普通按钮一致：

```json
// 提交按钮的 value（由 formButtons() 自动注入）
{
  "__page": "preset:form"
}
```

回调数据结构：

```json
{
  "tag": "button",
  "name": "form_submit_btn",
  "value": { "__page": "preset:form" },
  "form_value": {
    "username": "alice",
    "priority": "high"
  }
}
```

Router 检测到 `form_value` 存在时，从 `value.__page` 解析目标页面，调用 `page.onAction(ctx)`。此时 `ctx.type = "form_submit"`，`ctx.formValue` 包含表单字段值，`ctx.formName` 为表单容器的 `name`。

> **实现备注：** 需要验证飞书 `form_submit` 按钮的 `value` 字段是否在回调中返回。如果飞书不支持，则 fallback 到 `name` 字段编码（格式 `__page:preset:form`），Router 从 `action.name` 解析路由。实现时优先尝试 `value.__page`，未命中则解析 `name`。

### Builder 增强

在现有 `FeishuCardBuilder` 基础上扩展。CardKit 的 `EnhancedCardBuilder` 强制使用 **JSON 2.0 schema**，`value` 为对象类型。按钮支持 `navigate` / `action` / `url` 三种模式。

**按钮布局规则（JSON 2.0）：**

- **单个按钮** — 独立 body element
- **多个按钮（`buttons()` 调用）** — 使用 `column_set` 布局并排显示，每个按钮放在一个 `column` 中

```typescript
// 在 render(ctx) 内使用 ctx.card() 创建 builder
const myCard = ctx.card({ title: "测试", theme: "blue" })
  // ─── 基础元素（与 FeishuCardBuilder 一致）───
  .text("**Hello**", true)
  .divider()
  .fields([{ label: "名称", value: "test" }])

  // ─── 布局：多列 ───
  .columns([
    { width: "weighted", weight: 1, elements: (col) => col
      .text("左侧内容", true)
      .button("操作A", { action: "a" })
    },
    { width: "weighted", weight: 1, elements: (col) => col
      .text("右侧内容", true)
      .button("操作B", { action: "b" })
    },
  ])

  // ─── 布局：简单两列（语法糖）───
  .columnSet({ flexMode: "bisect", horizontalSpacing: "default" }, (cs) => cs
    .column({ width: "weighted", weight: 1 }, (col) => col
      .text("**状态:** 运行中", true)
    )
    .column({ width: "weighted", weight: 1 }, (col) => col
      .text("**分支:** main", true)
    )
  )

  // ─── 按钮（三种模式）───
  .button("📁 进入", { navigate: ["cp:org", { orgName: "my-org" }] })
  .button("✅ 批准", { type: "primary", action: "approve" })
  .button("❌ 拒绝", { type: "danger", action: "reject" })
  .button("🔗 链接", { url: "https://example.com" })

  // ─── 表单 ───
  .form("my_form")
    .input({ name: "username", label: "用户名" })
    .select({ name: "level", options: [...] })
    .formButtons({ submit: { text: "提交" }, reset: { text: "取消" } })
  .endForm()

  .build();
```

> **布局 API 说明：**
>
> - **`.columns([])`** — 快捷多列布局，每列通过回调 `(col) => col.text(...).button(...)` 声明内容
> - **`.columnSet(opts, cb)`** — 完整 `column_set` 控制（flexMode / horizontalSpacing / backgroundStyle）
> - **`.column(opts, cb)`** — `columnSet` 内部的列，`opts` 支持 `width`（"weighted" / "auto" / "px"）、`weight`、`verticalAlign`
> - 回调中的 `col` 是一个子 builder，支持 `text` / `button` / `divider` / `fields` 等所有基础元素

#### 编码规则

| Builder 方法 | 编码位置 | 编码内容 |
| --- | --- | --- |
| `navigate: ["cp:org", { orgName }]` | 按钮 `value` | `{ "__page": "cp:org", "__params": { orgName } }` |
| `action: "approve"` | 按钮 `value` | `{ "__page": "当前页面", "__action": "approve", "__params": { ... } }` |
| `.formButtons({ submit })` | 提交按钮 `value` | `{ "__page": "当前页面" }` |
| `url: "..."` | 飞书原生 | 链接跳转，不走回调 |

> - `navigate` → 目标页面 `render()`
> - `action` → 当前页面 `onAction(ctx)`
> - `formButtons` → 当前页面 `onAction(ctx)`，`ctx.type="form_submit"`，`ctx.formValue` 包含表单字段值

### 与现有系统的兼容

#### 1. 现有 FeishuCardBuilder 保留

`card-kit/builder.ts` 是 `FeishuCardBuilder` 的**增强包装**，不是替代。底层仍然使用 `FeishuCardBuilder` 生成 JSON，在交互元素上增加语法糖：普通按钮的 `navigate` / `action`，以及表单按钮的 `formButtons`，均自动将路由信息编码到按钮 `value` 中。

**`ctx.card()` 创建 builder，自动绑定 pageName + data：**

```typescript
// card-kit/builder.ts
import { FeishuCardBuilder } from "~~/server/utils/feishu-card-builder";

// ctx.card() 由框架在构造 context 时注入，自动绑定当前页面名 + 状态
class EnhancedCardBuilder {
  private inner: FeishuCardBuilder;
  private pageName: string;
  /** 当前页面状态（编码到每个 action 按钮的 value.__data 中） */
  private currentData: Record<string, unknown>;
  /** 当前 form 名称（form() 时设置，endForm() 时清除） */
  private currentFormName: string | null = null;

  constructor(config: CardConfig, pageName: string, data: Record<string, unknown> = {}) {
    // CardKit 强制 JSON 2.0：按钮不用 action 容器，value 直接为对象
    this.inner = new FeishuCardBuilder({ ...config, schema: "2.0" });
    this.pageName = pageName;
    this.currentData = data;
  }

  // ─── 基础元素（委托给 inner）───
  text(content: string, isMarkdown?: boolean): this { ... }
  divider(): this { ... }
  fields(items: { label: string; value: string }[]): this { ... }
  input(config: InputConfig): this { ... }
  inputV2(config: InputV2Config): this { ... }
  select(config: SelectConfig): this { ... }

  form(name: string): this {
    this.currentFormName = name;  // 记录当前 form 名称
    this.inner.addForm({ name });
    return this;
  }

  endForm(): this {
    this.currentFormName = null;
    this.inner.endForm();
    return this;
  }

  // ─── 布局组件 ───

  /**
   * 快捷多列布局。
   * 每列通过回调声明子元素，子 builder 支持 text/button/divider/fields 等。
   */
  columns(cols: ColumnDef[]): this {
    const columns = cols.map((def) => {
      const colBuilder = new ColumnBuilder(this.pageName, this.currentData);
      def.elements(colBuilder);
      return {
        tag: "column" as const,
        width: def.width || "weighted",
        weight: def.weight || 1,
        vertical_align: def.verticalAlign || "top",
        elements: colBuilder.getElements(),
      };
    });
    this.inner.pushElement({
      tag: "column_set",
      flex_mode: "none",
      horizontal_spacing: "default",
      columns,
    });
    return this;
  }

  /**
   * 完整 column_set 控制，支持 flexMode / horizontalSpacing 等。
   * 在回调中通过 cs.column() 添加列。
   */
  columnSet(
    opts: ColumnSetOpts,
    cb: (cs: ColumnSetBuilder) => ColumnSetBuilder,
  ): this {
    const csBuilder = new ColumnSetBuilder(this.pageName, this.currentData);
    cb(csBuilder);
    this.inner.pushElement({
      tag: "column_set",
      flex_mode: opts.flexMode || "none",
      horizontal_spacing: opts.horizontalSpacing || "default",
      background_style: opts.backgroundStyle || "default",
      columns: csBuilder.getColumns(),
    });
    return this;
  }

  // ─── 表单按钮 ───

  /**
   * 添加表单提交/重置按钮。
   * 自动将 __page 编码到提交按钮的 value 中，
   * 使 Router 在收到 form_submit 回调时能找到对应页面。
   */
  formButtons(config: {
    submit?: { text: string; type?: string };
    reset?: { text: string; type?: string };
  }): this {
    // 提交按钮注入 value：__page 用于路由，__formName 用于 ctx.formName，__data 用于状态回传
    // 注意：需要扩展底层 FeishuCardBuilder.addFormButtons 以支持 value 参数
    const submitValue: Record<string, unknown> = {
      __page: this.pageName,
      __formName: this.currentFormName,
    };
    if (Object.keys(this.currentData).length > 0) {
      submitValue.__data = this.currentData;
    }
    this.inner.addFormButtons({
      submit: config.submit
        ? {
            ...config.submit,
            value: JSON.stringify(submitValue),
          }
        : undefined,
      reset: config.reset,
    });
    return this;
  }

  // ─── 普通按钮（三种模式）───

  button(text: string, opts?: ButtonOpts): this {
    if (opts?.navigate) {
      // navigate — 跳转到目标页面
      // JSON 2.0: value 直接传对象
      this.inner.addButtons([{
        text,
        type: opts.type,
        value: {
          __page: opts.navigate[0],
          __params: opts.navigate[1] || {},
        },
        rawValue: true,
      }]);
    } else if (opts?.url) {
      // url — 外部链接
      this.inner.addButtons([{ text, type: opts.type, url: opts.url }]);
    } else if (opts?.action) {
      // action — 标记按钮行为，回调到当前页面 onAction
      // 自动携带当前页面状态快照（__data）
      const value: Record<string, unknown> = {
        __page: this.pageName,
        __action: opts.action,
        __params: opts.params || {},
      };
      // 有状态时才编码 __data，避免无状态页面浪费空间
      if (Object.keys(this.currentData).length > 0) {
        value.__data = this.currentData;
      }
      // JSON 2.0: value 直接传对象，rawValue 告知底层不再 stringify
      this.inner.addButtons([{
        text,
        type: opts.type,
        value,
        rawValue: true,
      }]);
    }
    return this;
  }

  /** 批量添加按钮（多按钮时并排显示） */
  buttons(items: EnhancedButtonConfig[]): this {
    // 收集所有按钮配置后一次性传入 addButtons()，
    // 底层 JSON 2.0 多按钮时使用 column_set 并排布局
    const rawButtons = items.map((btn) => buildRawButton(btn, this.pageName, this.currentData));
    if (rawButtons.length > 0) {
      this.inner.addButtons(rawButtons);
    }
    return this;
  }

  // ─── 构建 ───

  build(): CardJSON {
    return this.inner.build().card;
  }
}
```

#### 2. 迁移状态

> **✅ 迁移已全部完成。** 所有卡片交互均通过 CardKit 路由处理，所有只读通知卡片统一使用 `EnhancedCardBuilder`。旧的 if-else 分发逻辑、`CardStateMachine`、手写 JSON 1.0 卡片代码已全部删除。

## 类型定义

```typescript
// card-kit/types.ts

// ─── 导航守卫 ──────────────────────────

/** 导航守卫上下文（类似 vue-router 的 to/from） */
export interface NavigationGuardContext {
  /** 当前用户 openId */
  openId: string;
  /** 目标页面名称 */
  to: { page: string; params: Record<string, unknown> };
  /** 来源页面名称（首次进入时为 null） */
  from: { page: string; params: Record<string, unknown> } | null;
}

/**
 * 导航守卫返回值（参考 vue-router）：
 * - undefined / true → 放行
 * - false → 阻止导航（保持当前卡片）
 * - CardJSON → 阻止并渲染替代卡片
 * - NavigateResult → 重定向到另一个页面
 */
export type GuardResult = boolean | CardJSON | NavigateResult | undefined;

// ─── 页面定义 ──────────────────────────

/** 卡片页面定义 */
export interface CardPageDef<D extends Record<string, unknown> = Record<string, unknown>> {
  /** 页面唯一标识，作为路由地址。建议格式: "module:page"，如 "cp:home" */
  name: string;

  /**
   * 可选，声明页面初始状态。
   * 状态编码在每个 action 按钮的 value.__data 中，
   * 点击时飞书原样返回，实现零存储状态管理。
   */
  data?: () => D;

  /**
   * 进入页面前的导航守卫（类似 vue-router beforeEnter）。
   * 在 render 和 onAction 之前执行。
   */
  beforeEnter?: (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>;

  /**
   * 离开页面时的导航守卫（类似 vue-router beforeRouteLeave）。
   * 仅在 onAction 返回 NavigateResult 时触发。
   */
  beforeLeave?: (ctx: NavigationGuardContext) => GuardResult | Promise<GuardResult>;

  /** 渲染卡片。ctx.data 包含当前状态，ctx.params 来自 navigate() 参数。 */
  render: (ctx: CardRenderContext<D>) => Promise<CardJSON>;

  /**
   * 处理所有交互（按钮点击 + 表单提交）。
   * - ctx.type 区分交互类型："button" | "form_submit"
   * - ctx.action 标识按钮行为（表单提交时为 "form_submit"）
   * - ctx.data 当前状态，ctx.setData() 更新状态并重渲染
   * - ctx.formValue 取表单数据（仅 form_submit 时有值）
   */
  onAction?: (ctx: CardActionContext<D>) => CardActionResult | Promise<CardActionResult>;
}

// ─── 上下文 ──────────────────────────

/** 渲染上下文 */
export interface CardRenderContext<D extends Record<string, unknown> = Record<string, unknown>> {
  openId: string;
  params: Record<string, unknown>;
  /** 当前页面状态（首次渲染用 data() 初始值，后续从 value.__data 解码） */
  data: D;
  /** 创建 EnhancedCardBuilder，自动绑定 pageName + data */
  card: (config: CardConfig) => EnhancedCardBuilder;
}

/** 交互上下文（按钮点击 + 表单提交统一） */
export interface CardActionContext<D extends Record<string, unknown> = Record<string, unknown>>
  extends CardRenderContext<D> {
  /** 交互类型 */
  type: "button" | "form_submit";
  /** 按钮的 action 标识（来自 button({ action: "approve" })），表单提交时为 "form_submit" */
  action: string;
  /**
   * 更新页面状态并重渲染当前页面。
   * 底层等价于 navigate(当前页面, 当前params, { data: merge(ctx.data, partial) })
   */
  setData: (partial: Partial<D>) => NavigateResult;
  /** 表单字段值（仅 type === "form_submit" 时有值） */
  formValue: Record<string, string> | null;
  /** 表单名称（仅 type === "form_submit" 时有值，来自 formButtons 编码的 __formName） */
  formName: string | null;
  token: string;
  updateCard: (card: CardJSON) => Promise<void>;
}

// ─── 返回值 ──────────────────────────

/** 卡片 JSON（2.0 或 1.0 均可） */
export type CardJSON = Record<string, unknown>;

/** 页面跳转结果 */
export interface NavigateResult {
  __type: "navigate";
  page: string;
  params: Record<string, unknown>;
}

/** Toast 提示结果 */
export interface ToastResult {
  __type: "toast";
  type: "success" | "info" | "warning" | "error";
  content: string;
}

/** 异步任务结果：立即返回 loading 卡片，后台执行 task */
export interface AsyncTaskResult {
  __type: "async_task";
  /** 立即返回给飞书渲染的 loading 卡片 */
  loadingCard: CardJSON;
  /** 后台异步执行的任务，通过闭包访问 ctx.update 更新最终结果 */
  task: () => Promise<void>;
}

/** Action handler 返回值 */
export type CardActionResult =
  | NavigateResult
  | ToastResult
  | AsyncTaskResult
  | CardJSON
  | undefined;

// ─── Builder 配置 ──────────────────────────

/** 按钮配置 */
export interface ButtonOpts {
  type?: "default" | "primary" | "danger";
  /** 跳转到指定页面 [pageName, params] */
  navigate?: [string, Record<string, unknown>?];
  /** 按钮行为标识，回调到当前页面 onAction */
  action?: string;
  /** 额外参数（与 action 配合使用） */
  params?: Record<string, unknown>;
  /** 打开外部链接，不触发回调 */
  url?: string;
}

/** 批量按钮配置 */
export interface EnhancedButtonConfig extends ButtonOpts {
  text: string;
}

// ─── 布局配置 ──────────────────────────

/** columns() 快捷多列的列定义 */
export interface ColumnDef {
  width?: "weighted" | "auto";
  weight?: number;
  verticalAlign?: "top" | "center" | "bottom";
  /** 回调声明列内元素，col 是子 builder */
  elements: (col: ColumnBuilder) => ColumnBuilder;
}

/** columnSet() 完整布局选项 */
export interface ColumnSetOpts {
  flexMode?: "none" | "stretch" | "flow" | "bisect" | "trisect";
  horizontalSpacing?: "default" | "small";
  backgroundStyle?: "default" | "grey";
}

/**
 * 列内子 builder。
 * 支持 text / divider / fields / button / buttons 等基础元素，
 * 不支持 form（表单不能嵌在列内）。
 * 构造时接收 pageName + data，确保列内按钮也编码 __data。
 */
export class ColumnBuilder {
  constructor(pageName: string, data?: Record<string, unknown>);
  text(content: string, isMarkdown?: boolean): this;
  divider(): this;
  fields(items: { label: string; value: string }[]): this;
  button(text: string, opts?: ButtonOpts): this;
  buttons(items: EnhancedButtonConfig[]): this;
  /** 嵌套多列 */
  columns(cols: ColumnDef[]): this;
  getElements(): CardElement[];
}

/**
 * columnSet 回调中的 builder，用于添加列。
 */
export class ColumnSetBuilder {
  constructor(pageName: string, data?: Record<string, unknown>);
  column(
    opts: { width?: "weighted" | "auto"; weight?: number; verticalAlign?: string },
    cb: (col: ColumnBuilder) => ColumnBuilder,
  ): this;
  getColumns(): CardElement[];
}
```

## 路由命名规范

采用 `module:page` 格式，模块名作为命名空间：

| 模块 | 页面名 | 说明 |
| --- | --- | --- |
| `cp` | `cp:home` | 控制面板首页（组织选择） |
| `cp` | `cp:repos` | 组织仓库列表 |
| `cp` | `cp:repo-menu` | 仓库功能菜单 |
| `cp` | `cp:actions` | Actions 运行记录 |
| `cp` | `cp:feature` | 功能详情 |
| `account` | `account:home` | 账户信息 |
| `account` | `account:guide` | 绑定教程 |
| `account` | `account:unbound` | 解绑成功 |
| `preset` | `preset:console` | 预设控制台 |
| `wf` | `wf:select` | 工作流选择 |
| `wf` | `wf:params` | 工作流参数填写 |
| `approval` | `approval:pending` | 审批待处理 |
| `test` | `test:form` | 表单测试 |
| `test` | `test:result` | 表单提交结果 |

## 完整示例

### 示例 1：控制面板（多页面导航）

```typescript
// server/card-pages/control-panel/home.page.ts
import { defineCardPage } from "~~/server/card-kit";

export default defineCardPage({
  name: "cp:home",

  async render(ctx) {
    const orgs = await fetchUserOrgs(ctx.openId);

    if (orgs.length === 0) {
      return ctx.card({ title: "📋 控制面板", theme: "blue" })
        .text("您还没有加入任何组织")
        .build();
    }

    return ctx.card({ title: "📋 控制面板", theme: "blue" })
      .text("**请选择组织**")
      .divider()
      .buttons(
        orgs.map((org) => ({
          text: `📁 ${org.name}`,
          navigate: ["cp:org", { orgName: org.name }],
        })),
      )
      .build();
  },
});

// server/card-pages/control-panel/org.page.ts
export default defineCardPage({
  name: "cp:org",

  async render(ctx) {
    const orgName = ctx.params.orgName as string;
    const repos = await fetchOrgRepos(orgName);

    return ctx.card({ title: `📁 ${orgName}`, theme: "blue" })
      .text(`**${orgName}** 的仓库列表`)
      .divider()
      .buttons(
        repos.map((repo) => ({
          text: `📦 ${repo.name}`,
          navigate: ["cp:repo", { owner: orgName, repo: repo.name }],
        })),
      )
      .divider()
      .buttons([
        { text: "⬅️ 返回", navigate: ["cp:home"] },
      ])
      .build();
  },
});
```

### 示例 2：表单提交（preset-console）

```typescript
// server/card-pages/preset-console/form.page.ts
import { defineCardPage, navigate } from "~~/server/card-kit";

export default defineCardPage({
  name: "preset:form",

  async render(ctx) {
    // 注意：shareToken 为敏感标识，实际实现中应存 Redis 只传 key
    // 此处为演示简化，直接通过 params 传递
    const token = ctx.params.shareToken as string;
    const { preset, branches, inputDefs } = await resolvePresetData(token);

    // CardKit 已强制 schema 2.0，无需手动指定
    const builder = ctx.card({
      title: `🚀 ${preset.name}`,
      theme: "blue",
    })
      .text(`**仓库**: ${preset.repo}\n**工作流**: ${preset.workflow_path}`, true)
      .divider()
      .form("preset_form");

    // 动态添加分支选择
    if (branches.length > 0) {
      builder.select({
        name: "branch",
        placeholder: "选择分支",
        required: true,
        options: branches.map((b) => ({ label: b, value: b })),
      });
    }

    // 动态添加输入字段
    for (const [key, def] of Object.entries(inputDefs)) {
      if (def.type === "choice") {
        builder.select({ name: key, options: def.options });
      } else {
        builder.input({ name: key, label: def.description || key });
      }
    }

    builder
      .formButtons({ submit: { text: "🚀 触发工作流" } })
      .endForm();

    return builder.build();
  },

  async onAction(ctx) {
    if (ctx.type === "form_submit") {
      const token = ctx.params.shareToken as string;
      const result = await triggerWorkflow(token, ctx.openId, ctx.formValue!);

      return navigate("preset:result", {
        shareToken: token,
        runId: result.runId,
        success: result.success,
      });
    }
  },
});

// server/card-pages/preset-console/result.page.ts
export default defineCardPage({
  name: "preset:result",

  async render(ctx) {
    const { runId, success } = ctx.params;

    return ctx.card({
      title: success ? "✅ 工作流已触发" : "❌ 触发失败",
      theme: success ? "green" : "red",
    })
      .text(`运行编号: #${runId}`)
      .build();
  },
});
```

### 示例 3：测试表单（JSON 2.0 form）

```typescript
// server/card-pages/test/form.page.ts
import { defineCardPage, navigate } from "~~/server/card-kit";

export default defineCardPage({
  name: "test:form",

  async render(ctx) {
    // CardKit 已强制 schema 2.0，无需手动指定
    return ctx.card({ title: "🧪 表单组件测试", theme: "blue" })
      .text("此卡片演示 `form` 表单容器（JSON 2.0 特性）。")
      .divider()
      .form("test_form")
        .inputV2({
          name: "test_username",
          label: "用户名",
          placeholder: "请输入用户名",
          required: true,
        })
        .inputV2({
          name: "test_password",
          label: "密码",
          input_type: "password",
        })
        .select({
          name: "test_priority",
          placeholder: "选择优先级",
          required: true,
          options: [
            { label: "🟢 低", value: "low" },
            { label: "🟡 中", value: "medium" },
            { label: "🔴 高", value: "high" },
          ],
        })
        .formButtons({
          submit: { text: "提交" },
          reset: { text: "取消" },
        })
      .endForm()
      .build();
  },

  async onAction(ctx) {
    if (ctx.type === "form_submit") {
      return navigate("test:result", { formData: ctx.formValue });
    }
  },
});

// server/card-pages/test/result.page.ts
export default defineCardPage({
  name: "test:result",

  async render(ctx) {
    const data = ctx.params.formData as Record<string, string>;

    return ctx.card({ title: "✅ 表单提交成功", theme: "green" })
      .text("**表单数据如下：**", true)
      .divider()
      .fields(
        Object.entries(data).map(([k, v]) => ({ label: k, value: v || "(空)" })),
      )
      .divider()
      .buttons([
        { text: "🔄 重新填写", navigate: ["test:form"] },
      ])
      .build();
  },
});
```

### 示例 4：审批卡片（action 模式 — 多按钮不同行为）

```typescript
// server/card-pages/approval/detail.page.ts
import { defineCardPage, navigate, toast } from "~~/server/card-kit";

export default defineCardPage({
  name: "approval:detail",

  async render(ctx) {
    const flowId = ctx.params.flowId as string;
    const flow = await getApprovalFlow(flowId);

    return ctx.card({ title: `📋 审批: ${flow.title}`, theme: "blue" })
      .fields([
        { label: "申请人", value: flow.requester },
        { label: "仓库", value: flow.repository },
        { label: "分支", value: flow.branch },
      ])
      .divider()
      .text(`**原因**: ${flow.reason}`, true)
      .divider()
      // action 按钮显式传 params，保证 onAction 中能拿到 flowId
      .button("✅ 批准", { type: "primary", action: "approve", params: { flowId } })
      .button("❌ 拒绝", { type: "danger", action: "reject", params: { flowId } })
      .button("💬 留言", { action: "comment", params: { flowId } })
      .build();
  },

  async onAction(ctx) {
    const flowId = ctx.params.flowId as string;

    switch (ctx.action) {
      case "approve":
        await approveFlow(flowId, ctx.openId);
        return navigate("approval:done", { flowId, result: "approved" });
      case "reject":
        await rejectFlow(flowId, ctx.openId);
        return navigate("approval:done", { flowId, result: "rejected" });
      case "comment":
        return navigate("approval:comment", { flowId });
    }
  },
});

// server/card-pages/approval/done.page.ts
export default defineCardPage({
  name: "approval:done",

  async render(ctx) {
    const { flowId, result } = ctx.params;
    const isApproved = result === "approved";

    return ctx.card({
      title: isApproved ? "✅ 已批准" : "❌ 已拒绝",
      theme: isApproved ? "green" : "red",
    })
      .text(`审批编号: ${flowId}`)
      .text(`处理结果: ${isApproved ? "已批准" : "已拒绝"}`)
      .build();
  },
});
```

## 实现状态

> **✅ 全部完成。** 框架核心 + 所有页面迁移 + 旧代码清理已全部完成。

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| Phase 1：核心框架 | ✅ | `card-kit/` 四个文件（types / router / builder / index） |
| Phase 2：首个页面 | ✅ | `test:form` + `test:result` |
| Phase 3：控制面板 | ✅ | `cp:home` / `cp:repos` / `cp:repo-menu` / `cp:actions` / `cp:feature` |
| Phase 4：账户 + 预设 | ✅ | `account:*` / `preset:console` / `wf:*` / `approval:pending` |
| Phase 5：清理 | ✅ | 旧 if-else 分发、CardStateMachine、手写 JSON 1.0 卡片、死代码全部删除 |
| Phase 6：异步任务 | ✅ | `AsyncTaskResult` + `asyncTask()` 辅助方法，`cp-trigger-wf` / `preset-console` / `wf-params` 迁移 |
| Phase 7：导航守卫 | ✅ | `beforeEnter` / `beforeLeave` / 全局 `beforeEach`，内置守卫 `requireBinding()` / `requireRepoPermission()` / `guards()` |

## 安全考虑

- **路由参数不存敏感数据** — `__params` 会被序列化到 action.value（明文 JSON），不要放密码/token 等。shareToken 等敏感标识应存 Redis，只传 Redis key
- **权限检查通过导航守卫集中管理** — 使用 `beforeEnter` 守卫（如 `requireBinding()`、`requireRepoPermission()`）统一校验用户权限，避免在每个 render / onAction 中重复编写
- **参数大小限制** — 飞书 action.value 有大小限制（约 2KB），大数据走 Redis
- **幂等性** — 飞书回调可能重试，用户也可能连点多次。审批/触发等副作用操作必须在 onAction 中做幂等检查（如检查状态是否已变更）
- **全局错误处理** — `cardRouter.dispatch()` 内部应 try-catch 包装 `onAction` / `render` 调用，异常时返回通用错误卡片或 toast，而不是让飞书显示原始错误

## FAQ

### Q: navigate 的 params 大小有限制吗？

飞书 `action.value` 序列化后不超过 2000 字节。`__page + __params + __action + __data` 合计不能超过此限制。如果参数过大，应该只传关键 ID，在 render 内查库获取完整数据。

### Q: data 和 params 的区别是什么？

- **params** — 来自 `navigate()` 调用，代表"从哪里来、带了什么参数"。跳转时由调用方传入，类似 URL query params。
- **data** — 来自 `data()` 声明 + `setData()` 更新，代表"当前页面的内部状态"。不跨页面传递，跳转到新页面时用目标页的 `data()` 初始值。

简单规则：**跨页面传递用 params，页面内状态用 data**。

### Q: 一个页面能同时有按钮和表单吗？

可以。所有交互都走 `onAction`，通过 `ctx.type` 区分：按钮点击时 `ctx.type === "button"`，表单提交时 `ctx.type === "form_submit"`（此时 `ctx.formValue` 有值）。

### Q: 如何处理同一张卡片上多个不同按钮的不同行为？

在按钮上设置 `action` 标识，然后在 `onAction` 中用 `switch(ctx.action)` 区分：

```typescript
// 构建时
.button("✅ 批准", { type: "primary", action: "approve" })
.button("❌ 拒绝", { type: "danger", action: "reject" })

// 处理时
async onAction(ctx) {
  switch (ctx.action) {
    case "approve": ...
    case "reject": ...
  }
}
```

### Q: 审批流程如何处理？

审批卡片已迁移到 `approval:pending` 页面，通过 CardKit 路由处理。审批结果通知使用 `EnhancedCardBuilder` 构建只读卡片。旧的 `approval-flow/card-handler.ts` 已删除。
