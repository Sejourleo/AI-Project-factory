# 合并「内容工厂采集与分析」与「内容工厂创作与分发」Agent 设计

## 背景

当前在 `/Users/yves/ai编程项目/` 下并列存在两个 Next.js 项目：

- **A · 内容工厂采集与分析**：监控 / 采集 / 选题分析 Agent。Next 16.2.4 + React 19 + Tailwind 4 + better-sqlite3。左侧 `AppSidebar`，无顶栏。
- **B · 内容工厂创作与分发**：多平台创作 Agent。Next 16.2.4 + React 19 + Tailwind 4 + Tiptap + Zustand。顶部 `TopNav`。

需求是把 B 合并进 A，得到一个项目，并在顶部加一个菜单切换两个 Agent。两个 Agent 的主体功能必须保持不变。

## 目标

1. 同一个 Next 应用同时承载两个 Agent 的全部能力。
2. 顶部一个全局切换栏，左 logo + 两个 pill（"内容采集与选题创作 Agent" / "内容创作 Agent"），创作路由下右侧补一个「设置」入口。
3. 采集侧的现有 URL 保持不变（`/`、`/c/[id]/...`、`/api/...`）。
4. 创作侧整体落到 `/studio` 路径前缀下，避免根路径冲突。
5. 后续两个 Agent 可独立演进，不再互相污染命名空间。

## 非目标

- 不重构两个 Agent 各自的内部架构。
- 不合并 `Platform` 类型 / 设计系统（两边语义完全不同）。
- 不动数据库 schema、不动 SQLite 数据文件。
- 不改造数据流、状态管理。
- 不删除原 B 项目目录（用户验收后自行处理）。

## 路由结构

```
/                                    采集 Agent 首页（redirect → /c/<first>/content）
/c/[categoryId]/content              采集页面（保持不变）
/c/[categoryId]/insights             ...
/api/categories/...                  采集 API
/api/cron/...
/api/insights/...
/api/notes/...
/api/queries/...
/api/wechat/search                   采集侧公众号搜索
/api/xhs/...

/studio                              创作 Agent 首页（原 B app/page.tsx）
/studio/workspace/[id]               创作工作台
/studio/settings                     创作平台设置
/api/studio/generate                 创作生成接口
/api/studio/wechat/accounts          创作侧公众号账号
/api/studio/wechat/publish           创作侧公众号发布
```

设计要点：
- 采集 API 一律保留在根 `/api/` 下；创作 API 一律落到 `/api/studio/` 下。当前两侧 `/api/wechat/*` 子路径不冲突，但仍坚持隔离，避免后续撞车。
- 采集页用 Next 路由组 `(monitor)` 承载，URL 保持原样。

## 目录结构

```
app/
  layout.tsx                          # 根布局：fonts + AgentSwitcher + Toaster + ToastProvider
  globals.css                         # 合并后的全局样式（追加 .studio-scope 节）
  page.tsx                            # 采集 redirect（保持，归属 (monitor) 组）
  (monitor)/
    layout.tsx                        # CategoriesProvider + AppSidebar
    c/[categoryId]/
      content/page.tsx                # 现有页面平移
      insights/page.tsx               # 现有页面平移
      ...
  studio/
    layout.tsx                        # <div className="studio-scope">
    page.tsx                          # 创作首页
    workspace/[id]/page.tsx
    settings/page.tsx
  api/                                # 采集 API 不动
    categories/...
    cron/...
    insights/...
    notes/...
    queries/...
    wechat/search/route.ts
    xhs/...
    studio/                           # 创作 API 落点
      generate/route.ts
      wechat/
        accounts/route.ts
        publish/route.ts

components/
  agent-switcher.tsx                  # 新增：顶栏组件
  app-sidebar.tsx                     # 采集（不变）
  categories-provider.tsx             # 采集（不变）
  ...                                 # 其余采集组件（不变）
  ui/                                 # 采集 shadcn ui（不变）
  studio/
    nav/TopNav.tsx                    # 创作原 TopNav（保留但不再渲染，后续可删）
    home/{GenerateButton,PlatformPicker,PromptInput}.tsx
    workspace/{Sidebar,PlatformTabs,WorkspaceActions,PlatformEditor,GenerateStatus}.tsx
    editors/{WechatEditor,XhsEditor,TwitterEditor,VideoEditor}.tsx
    ui/{Button,Dialog,IconButton,InlineEdit,PublishWechatDialog,Toast,ToastProvider}.tsx

lib/
  data/                               # 采集（不变）
  db/                                 # 采集（不变）
  fixtures/
  llm/
  types.ts                            # 采集 types（不变）
  utils/
  utils.ts
  studio/
    types.ts                          # 创作 Platform / Settings / Session 等
    runGeneration.ts
    wechat.ts | wechat.test.ts
    twitter.ts | twitter.test.ts
    ai/{generate,prompt,streamWechat,mock-data}.ts
    api/wechatPublish.ts
    store/{sessions,settings}.ts
    __tests__/smoke.test.ts
```

## 顶栏：AgentSwitcher

`components/agent-switcher.tsx`，client component，根布局直接渲染。

```
+-------------------------------------------------------------+
| 内容工厂   [ 采集 Agent ]  [ 创作 Agent ]            [ 设置 ]|  ← 仅 /studio* 显示
+-------------------------------------------------------------+
```

- 高度 56px，sticky `top-0 z-50`，浅色背景 + 下边线。
- pill 用 `usePathname()` 判定 active：
  - 采集 active：pathname === `/` 或以 `/c/` 开头。
  - 创作 active：pathname 以 `/studio` 开头。
- 「设置」链接 `href="/studio/settings"`，仅 `/studio*` 路由可见。
- 删除创作原 `TopNav` 的全局渲染（可保留文件但不挂载，避免短期内丢失参考；后续 PR 清理）。

## CSS 隔离方案

冲突变量：`--color-border` / `--color-muted` / `--color-accent` 在两边都被定义但值不同。

策略：把创作侧 12 个设计 token 限定到 `.studio-scope` 类下，**不进入 Tailwind 4 `@theme`**（创作组件普遍使用 `bg-[var(--color-x)]` 这类任意值语法，不依赖 utility 生成）。

`globals.css` 末尾追加：

```css
.studio-scope {
  --color-bg: #f6f6f8;
  --color-surface: #ffffff;
  --color-elevated: #f1f1f4;
  --color-border: #e5e7eb;
  --color-fg: #1a1a1f;
  --color-muted: #71717a;
  --color-accent: #6d56f0;
  --color-accent-soft: #ede9fe;
  --color-platform-wechat: #2e9162;
  --color-platform-xhs: #e84a68;
  --color-platform-twitter: #1d9bf0;
  --color-platform-video: #c47e35;

  --font-display: var(--font-sora), ui-sans-serif, system-ui, sans-serif;
  --font-serif: var(--font-noto-serif-sc), 'Noto Serif SC', serif;
  --font-mono: var(--font-dm-mono), ui-monospace, 'SF Mono', monospace;

  background: var(--color-bg);
  color: var(--color-fg);
  font-family: var(--font-display);
  min-height: 100vh;
}

.studio-scope ::selection {
  background: var(--color-accent-soft);
}

.studio-scope .ProseMirror:focus { outline: none; }
.studio-scope .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  color: var(--color-muted);
  pointer-events: none;
  float: left;
  height: 0;
}
/* B 项目 globals.css 中所有 .prose-invert 规则原样搬过来，前缀加上 .studio-scope —— */
/* 包括 h1 / h2 / p / blockquote / hr / strong / em / img / img[src=""] 共 9 条。 */
.studio-scope .prose-invert h1 { font-family: var(--font-serif); font-size: 1.875rem; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
.studio-scope .prose-invert h2 { font-family: var(--font-serif); font-size: 1.5rem; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
.studio-scope .prose-invert p  { margin: 0.6em 0; }
.studio-scope .prose-invert blockquote { border-left: 3px solid var(--color-accent); padding-left: 1em; color: var(--color-muted); font-style: italic; margin: 1em 0; }
.studio-scope .prose-invert hr { border: 0; border-top: 1px solid var(--color-border); margin: 2em 0; }
.studio-scope .prose-invert strong { color: var(--color-fg); font-weight: 700; }
.studio-scope .prose-invert em { color: var(--color-fg); font-style: italic; }
.studio-scope .prose-invert img { display: block; max-width: 100%; padding: 2rem 1rem; background: var(--color-elevated); border: 1px dashed var(--color-border); margin: 1em 0; text-align: center; }
.studio-scope .prose-invert img[src=""] { content: '🖼  图片占位'; padding: 3rem; }
```

字体在根 `<html>` 的 `className` 上挂全套 `--font-sora / --font-noto-serif-sc / --font-dm-mono`，但只在 `.studio-scope` 下激活为 `--font-display / --font-serif / --font-mono`，采集侧不受影响。

## 数据流 / 状态管理

- 采集侧：`CategoriesProvider`（React Context）+ 服务端 API + SQLite。**不动。** Provider 仅在 `(monitor)/layout.tsx` 中包裹。
- 创作侧：Zustand `useSessionsStore` + `useSettingsStore`，localStorage 持久化。**不动。** 在 `studio/layout.tsx` 中天然 client 化。
- Toast：保留两套——
  - 采集：`sonner` 的 `<Toaster />`，根布局渲染。
  - 创作：原 `<ToastProvider />`，根布局渲染（两者互不干扰，分别由各自 import 触发）。

## 配置文件合并

### `package.json`
- name 保持 `content-monitor-prototype`。
- dependencies 取并集：保留 A 现有全部 + 追加 `@tiptap/extension-image`、`@tiptap/extension-placeholder`、`@tiptap/pm`、`@tiptap/react`、`@tiptap/starter-kit`、`nanoid`、`zustand`。
- devDependencies 追加 `@testing-library/jest-dom`、`@testing-library/react`、`@vitejs/plugin-react`、`jsdom`、`eslint`、`eslint-config-next`。
- scripts：保留 A 的 `next dev`（不开 turbopack，避免 better-sqlite3 兼容问题）；保留 A 的 `vitest`。

### `tsconfig.json`
- target 统一 `ES2022`（A 现状，覆盖 B 的 `ES2017`）。
- `paths` 保留 `@/*: ["./*"]`。

### `vitest.config.ts`
- 保留 A 的现有配置；新增 jsdom environment 项目（创作侧测试需要 DOM）。
- 增加 `@vitejs/plugin-react`，注册到 vitest plugins。
- `setupFiles` 包含 `vitest.setup.ts`（B 侧 `@testing-library/jest-dom` 注入）。

### `eslint.config.mjs`
- 复制 B 项目的配置到 A，保持 next 推荐规则即可。

### `next.config.ts`
- 保留 A 的 `images.remotePatterns`，无需新增内容（B 当前为空配置）。

### `postcss.config.mjs`
- 两侧等价，保留 A 现状。

## 测试策略

- 采集既有测试：`tests/` 目录下 vitest 测试需继续通过。
- 创作既有测试：`lib/__tests__/smoke.test.ts`、`lib/ai/generate.test.ts`、`lib/store/sessions.test.ts`、`lib/store/settings.test.ts`、`lib/twitter.test.ts`、`lib/wechat.test.ts` 平移到 `lib/studio/...` 后必须继续通过。
- 浏览器手测：
  - `/` 自动跳转到首个分类，左侧 sidebar、内容卡片、刷新菜单均工作。
  - `/c/<id>/content` 平台筛选、日期切换、StatPanel 正常。
  - 顶栏点击「创作 Agent」跳到 `/studio`，输入 prompt 选平台，点生成进入 `/studio/workspace/<id>`。
  - 工作台四平台 Tab 切换、设置页保存读取。
  - 采集侧 `/api/insights/generate` 等关键接口仍可调用。

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| 创作侧 CSS 变量泄露到采集侧 | 统一限定在 `.studio-scope`；layout 强制包裹 |
| `@tiptap` 引入后构建时间增长 | 仅创作页面 import；Next 自动按路由分包 |
| `better-sqlite3` 与 `next dev --turbopack` 冲突 | scripts 不开 turbopack |
| Zustand persist localStorage key 与采集冲突 | B 用的是默认 key，但作用域限定在 `/studio*` 渲染期，且采集侧无 zustand store，无碰撞 |
| 路由组 `(monitor)/` 改造引入 layout 嵌套问题 | 根 layout 只放 AgentSwitcher + Toaster；sidebar 在 `(monitor)/layout.tsx`，studio 用自己的 layout |

## 验收标准

1. `npm run dev` 启动后两个 Agent 在浏览器内可独立完成各自核心动线。
2. `npm run test` 通过：包含两侧迁移后的全部 vitest 用例。
3. `npm run lint` 通过（如保留 lint 脚本）。
4. 采集 Agent 现有 URL 全部保持不变。
5. 创作 Agent 全部页面可在 `/studio` 前缀下访问。
6. 顶栏样式按 AgentSwitcher 章节描述实现，active 高亮正确。

## 待办

进入 `writing-plans` 生成详细任务拆分。
