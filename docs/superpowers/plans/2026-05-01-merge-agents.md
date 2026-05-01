# 合并两个 Agent 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将「内容工厂创作与分发」(B) 的全部能力并入「内容工厂采集与分析」(A)，得到一个 Next.js 项目同时承载两个 Agent，并提供顶部菜单切换。

**Architecture:** 路径前缀 + 命名空间隔离。创作 Agent 全部落到 `/studio` 路由前缀下；其代码限定在 `lib/studio/`、`components/studio/`、`app/api/studio/` 子目录；采集 Agent 通过 Next 路由组 `(monitor)/` 承载，URL 不变。CSS 设计 token 用 `.studio-scope` class 隔离，避免与采集侧 shadcn 主题碰撞。

**Tech Stack:** Next.js 16.2 / React 19 / Tailwind 4 / TypeScript 5 / vitest 4 / better-sqlite3 / Tiptap 3 / Zustand 5 / sonner / @base-ui/react

**Working directory（每个 task 都从这里出发）：** `/Users/yves/ai编程项目/内容工厂采集与分析`

---

## 关键路径速查

迁移前后对照（A = 采集项目工作目录 `/Users/yves/ai编程项目/内容工厂采集与分析`，B = 创作项目源 `/Users/yves/ai编程项目/内容工厂创作与分发`）：

| B 源路径 | 合并后落点（A 内） |
|---|---|
| `lib/types.ts` | `lib/studio/types.ts` |
| `lib/runGeneration.ts` | `lib/studio/runGeneration.ts` |
| `lib/wechat.ts` / `lib/wechat.test.ts` | `lib/studio/wechat.ts` / `lib/studio/wechat.test.ts` |
| `lib/twitter.ts` / `lib/twitter.test.ts` | `lib/studio/twitter.ts` / `lib/studio/twitter.test.ts` |
| `lib/__tests__/smoke.test.ts` | `lib/studio/__tests__/smoke.test.ts` |
| `lib/ai/*.{ts,test.ts}` | `lib/studio/ai/*.{ts,test.ts}` |
| `lib/api/wechatPublish.ts` | `lib/studio/api/wechatPublish.ts` |
| `lib/store/*.{ts,test.ts}` | `lib/studio/store/*.{ts,test.ts}` |
| `components/nav/TopNav.tsx` | `components/studio/nav/TopNav.tsx`（保留不挂载） |
| `components/home/*` | `components/studio/home/*` |
| `components/workspace/*` | `components/studio/workspace/*` |
| `components/editors/*` | `components/studio/editors/*` |
| `components/ui/*` | `components/studio/ui/*` |
| `app/page.tsx` | `app/studio/page.tsx` |
| `app/workspace/page.tsx` | （删除：原内容只是 redirect 到 `/`） |
| `app/workspace/[id]/page.tsx` | `app/studio/workspace/[id]/page.tsx` |
| `app/settings/page.tsx` | `app/studio/settings/page.tsx` |
| `app/api/generate/route.ts` | `app/api/studio/generate/route.ts` |
| `app/api/wechat/accounts/route.ts` | `app/api/studio/wechat/accounts/route.ts` |
| `app/api/wechat/publish/route.ts` | `app/api/studio/wechat/publish/route.ts` |
| `vitest.setup.ts` | `vitest.setup.ts`（A 根目录新增） |

A 自身路径不变。所有迁移文件内的 `@/` import 也要按上表替换。

---

## Task 1：合并依赖与配置文件

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `eslint.config.mjs`
- Modify: `.env.local`（增加 B 用到的 keys）
- Modify: `next.config.ts`（视情况调整，预期无变化）

- [ ] **Step 1：合并 `package.json`**

读 A 的 `package.json`，把 B 独有依赖追加进 dependencies / devDependencies。最终内容：

```json
{
  "name": "content-monitor-prototype",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@base-ui/react": "^1.4.0",
    "@tiptap/extension-image": "^3.22.5",
    "@tiptap/extension-placeholder": "^3.22.5",
    "@tiptap/pm": "^3.22.5",
    "@tiptap/react": "^3.22.5",
    "@tiptap/starter-kit": "^3.22.5",
    "better-sqlite3": "^12.9.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "dayjs": "^1.11.20",
    "lucide-react": "^1.8.0",
    "nanoid": "^5.1.9",
    "next": "^16.2.4",
    "next-themes": "^0.4.6",
    "react": "^19.2.5",
    "react-dom": "^19.2.5",
    "shadcn": "^4.3.0",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.5.0",
    "tw-animate-css": "^1.4.0",
    "zustand": "^5.0.12"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.2",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.2",
    "@types/better-sqlite3": "^7.6.13",
    "@types/node": "^22",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitejs/plugin-react": "^6.0.1",
    "@vitest/ui": "^4.1.4",
    "eslint": "^9",
    "eslint-config-next": "16.2.4",
    "jsdom": "^29.1.0",
    "tailwindcss": "^4.2.2",
    "typescript": "^5",
    "vitest": "^4.1.4"
  }
}
```

注意：保留了 A 的 `next dev`（不开 turbopack；保护 better-sqlite3）；脚本 `lint` 改为 `eslint`（来自 B）。

- [ ] **Step 2：保留 `tsconfig.json` 现状**

A 现状已经是 `target: ES2022`，覆盖 B 的 ES2017。无需改动。

- [ ] **Step 3：拷贝 ESLint 配置**

新建 `/Users/yves/ai编程项目/内容工厂采集与分析/eslint.config.mjs`，内容：

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

- [ ] **Step 4：合并 `.env.local`**

读 A 的 `.env.local`，把 B 的额外 keys 追加进去（不要覆盖已有 key）。需要追加的：

```
SILICONFLOW_API_KEY=<从 B 的 .env.local 复制>
SILICONFLOW_BASE_URL=<同上>
SILICONFLOW_MODEL=<同上>
WECHAT_API_KEY=<同上>
WECHAT_API_BASE_URL=<同上>
```

具体值从 B 项目 `.env.local` 复制粘贴。**注意**：A 已经有 `WECHAT_SEARCH_API_KEY` 和 `WECHAT_SEARCH_API_URL`（采集侧用），这与 B 的 `WECHAT_API_KEY` / `WECHAT_API_BASE_URL`（创作侧用）是两组不同的凭据，都保留。

- [ ] **Step 5：检查 `next.config.ts`**

A 现状已配置 `images.remotePatterns`，B 为空配置，A 现状已足够。**不动。**

- [ ] **Step 6：安装新依赖**

```bash
cd "/Users/yves/ai编程项目/内容工厂采集与分析" && npm install
```

预期：node_modules 安装新包成功，无 npm error。

- [ ] **Step 7：commit**

```bash
git add package.json package-lock.json tsconfig.json eslint.config.mjs .env.local
git commit -m "chore(merge): bring in studio agent deps and configs"
```

---

## Task 2：搭建 vitest 双 environment 配置

**Files:**
- Modify: `vitest.config.ts`
- Create: `vitest.setup.ts`

A 当前 vitest 用 `node` env，只跑 `tests/**`。B 用 `jsdom` + react plugin，跑 `lib/**` 中的测试。合并后两侧测试都要跑。

策略：用 vitest 的 `test.projects` 把两个环境拆开。

- [ ] **Step 1：创建 `vitest.setup.ts`**

新建 `/Users/yves/ai编程项目/内容工厂采集与分析/vitest.setup.ts`：

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2：重写 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    projects: [
      {
        plugins: [],
        resolve: {
          alias: { '@': path.resolve(__dirname, '.') },
        },
        test: {
          name: 'monitor',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
        },
      },
      {
        plugins: [react()],
        resolve: {
          alias: { '@': path.resolve(__dirname, '.') },
        },
        test: {
          name: 'studio',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          fakeTimers: { toFake: ['Date'] },
          include: ['lib/studio/**/*.test.ts', 'lib/studio/**/__tests__/*.test.ts'],
        },
      },
    ],
  },
})
```

- [ ] **Step 3：跑一次现有测试确认 monitor project 通过**

```bash
npm run test
```

预期：monitor project 跑过原 13 条测试。studio project 当前没文件、报告 0 测试通过（不报错）。

- [ ] **Step 4：commit**

```bash
git add vitest.config.ts vitest.setup.ts
git commit -m "test(merge): split vitest into monitor (node) and studio (jsdom) projects"
```

---

## Task 3：迁移创作 lib 到 `lib/studio/`

**Files:**
- Create: `lib/studio/types.ts`
- Create: `lib/studio/runGeneration.ts`
- Create: `lib/studio/wechat.ts`、`lib/studio/twitter.ts`
- Create: `lib/studio/ai/{generate,prompt,streamWechat,mock-data}.ts`
- Create: `lib/studio/api/wechatPublish.ts`
- Create: `lib/studio/store/{sessions,settings}.ts`

- [ ] **Step 1：建立目录骨架并复制文件**

```bash
cd "/Users/yves/ai编程项目/内容工厂采集与分析"
mkdir -p lib/studio/ai lib/studio/api lib/studio/store
B="/Users/yves/ai编程项目/内容工厂创作与分发"

cp "$B/lib/types.ts" lib/studio/types.ts
cp "$B/lib/runGeneration.ts" lib/studio/runGeneration.ts
cp "$B/lib/wechat.ts" lib/studio/wechat.ts
cp "$B/lib/twitter.ts" lib/studio/twitter.ts
cp "$B/lib/ai/generate.ts" lib/studio/ai/generate.ts
cp "$B/lib/ai/prompt.ts" lib/studio/ai/prompt.ts
cp "$B/lib/ai/streamWechat.ts" lib/studio/ai/streamWechat.ts
cp "$B/lib/ai/mock-data.ts" lib/studio/ai/mock-data.ts
cp "$B/lib/api/wechatPublish.ts" lib/studio/api/wechatPublish.ts
cp "$B/lib/store/sessions.ts" lib/studio/store/sessions.ts
cp "$B/lib/store/settings.ts" lib/studio/store/settings.ts
```

- [ ] **Step 2：批量替换 `lib/studio/` 内的 `@/lib/` import**

对 `lib/studio/` 下所有 `.ts` 文件执行字符串替换（按这个顺序，后置匹配优先）：

| 原 | 改 |
|---|---|
| `from '@/lib/api/wechatPublish'` | `from '@/lib/studio/api/wechatPublish'` |
| `from '@/lib/ai/generate'` | `from '@/lib/studio/ai/generate'` |
| `from '@/lib/ai/prompt'` | `from '@/lib/studio/ai/prompt'` |
| `from '@/lib/ai/streamWechat'` | `from '@/lib/studio/ai/streamWechat'` |
| `from '@/lib/ai/mock-data'` | `from '@/lib/studio/ai/mock-data'` |
| `from '@/lib/store/sessions'` | `from '@/lib/studio/store/sessions'` |
| `from '@/lib/store/settings'` | `from '@/lib/studio/store/settings'` |
| `from '@/lib/runGeneration'` | `from '@/lib/studio/runGeneration'` |
| `from '@/lib/wechat'` | `from '@/lib/studio/wechat'` |
| `from '@/lib/twitter'` | `from '@/lib/studio/twitter'` |
| `from '@/lib/types'` | `from '@/lib/studio/types'` |

可以用 sed 在 `lib/studio` 目录里批量做：

```bash
find lib/studio -type f -name "*.ts" -exec sed -i '' \
  -e "s|from '@/lib/api/wechatPublish'|from '@/lib/studio/api/wechatPublish'|g" \
  -e "s|from '@/lib/ai/generate'|from '@/lib/studio/ai/generate'|g" \
  -e "s|from '@/lib/ai/prompt'|from '@/lib/studio/ai/prompt'|g" \
  -e "s|from '@/lib/ai/streamWechat'|from '@/lib/studio/ai/streamWechat'|g" \
  -e "s|from '@/lib/ai/mock-data'|from '@/lib/studio/ai/mock-data'|g" \
  -e "s|from '@/lib/store/sessions'|from '@/lib/studio/store/sessions'|g" \
  -e "s|from '@/lib/store/settings'|from '@/lib/studio/store/settings'|g" \
  -e "s|from '@/lib/runGeneration'|from '@/lib/studio/runGeneration'|g" \
  -e "s|from '@/lib/wechat'|from '@/lib/studio/wechat'|g" \
  -e "s|from '@/lib/twitter'|from '@/lib/studio/twitter'|g" \
  -e "s|from '@/lib/types'|from '@/lib/studio/types'|g" {} \;
```

替换完用 grep 验证 `lib/studio/` 内已没有非 studio 形式的 `@/lib/` import：

```bash
grep -rn "from '@/lib/" lib/studio/ | grep -v "@/lib/studio/"
```

预期：无输出。

- [ ] **Step 3：在 `lib/studio/api/wechatPublish.ts` 里把 fetch URL 改到新路径**

打开 `lib/studio/api/wechatPublish.ts`，将：

```
fetch('/api/wechat/accounts'    →  fetch('/api/studio/wechat/accounts'
fetch('/api/wechat/publish'     →  fetch('/api/studio/wechat/publish'
```

- [ ] **Step 4：在 `lib/studio/ai/streamWechat.ts` 里把 fetch URL 改到新路径**

```
fetch('/api/generate'    →  fetch('/api/studio/generate'
```

- [ ] **Step 5：TypeScript 编译验证**

```bash
npx tsc --noEmit
```

预期：可能有报错（因为 components 下还有未迁移文件引用旧路径），但 `lib/studio/` 内文件本身的报错应为 0。先记下其他报错，等 Task 4 后再回来确认。

- [ ] **Step 6：commit**

```bash
git add lib/studio/
git commit -m "feat(studio): migrate lib/* into lib/studio namespace"
```

---

## Task 4：迁移创作 components 到 `components/studio/`

**Files:**
- Create: `components/studio/nav/TopNav.tsx`（保留但不再被任何文件 import）
- Create: `components/studio/home/{GenerateButton,PlatformPicker,PromptInput}.tsx`
- Create: `components/studio/workspace/{Sidebar,PlatformTabs,WorkspaceActions,PlatformEditor,GenerateStatus}.tsx`
- Create: `components/studio/editors/{WechatEditor,XhsEditor,TwitterEditor,VideoEditor}.tsx`
- Create: `components/studio/ui/{Button,Dialog,IconButton,InlineEdit,PublishWechatDialog,Toast,ToastProvider}.tsx`

- [ ] **Step 1：复制目录**

```bash
B="/Users/yves/ai编程项目/内容工厂创作与分发"
mkdir -p components/studio
cp -R "$B/components/nav" components/studio/nav
cp -R "$B/components/home" components/studio/home
cp -R "$B/components/workspace" components/studio/workspace
cp -R "$B/components/editors" components/studio/editors
cp -R "$B/components/ui" components/studio/ui
```

- [ ] **Step 2：批量替换 `components/studio/` 内的 import 路径**

```bash
find components/studio -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i '' \
  -e "s|from '@/components/nav/|from '@/components/studio/nav/|g" \
  -e "s|from '@/components/home/|from '@/components/studio/home/|g" \
  -e "s|from '@/components/workspace/|from '@/components/studio/workspace/|g" \
  -e "s|from '@/components/editors/|from '@/components/studio/editors/|g" \
  -e "s|from '@/components/ui/|from '@/components/studio/ui/|g" \
  -e "s|from '@/lib/api/wechatPublish'|from '@/lib/studio/api/wechatPublish'|g" \
  -e "s|from '@/lib/ai/generate'|from '@/lib/studio/ai/generate'|g" \
  -e "s|from '@/lib/ai/prompt'|from '@/lib/studio/ai/prompt'|g" \
  -e "s|from '@/lib/ai/streamWechat'|from '@/lib/studio/ai/streamWechat'|g" \
  -e "s|from '@/lib/ai/mock-data'|from '@/lib/studio/ai/mock-data'|g" \
  -e "s|from '@/lib/store/sessions'|from '@/lib/studio/store/sessions'|g" \
  -e "s|from '@/lib/store/settings'|from '@/lib/studio/store/settings'|g" \
  -e "s|from '@/lib/runGeneration'|from '@/lib/studio/runGeneration'|g" \
  -e "s|from '@/lib/wechat'|from '@/lib/studio/wechat'|g" \
  -e "s|from '@/lib/twitter'|from '@/lib/studio/twitter'|g" \
  -e "s|from '@/lib/types'|from '@/lib/studio/types'|g" {} \;
```

**注意 components/studio/ui/ 里有些文件用 `@/components/ui/Foo` 引用同目录下的兄弟文件**——上面的替换会把所有 `@/components/ui/` 改成 `@/components/studio/ui/`，正是我们要的效果。

- [ ] **Step 3：人工确认 import**

```bash
grep -rn "from '@/" components/studio/ | grep -vE "@/(components/studio|lib/studio)"
```

预期：无输出。如果还有，逐条人工修复（对照表见 Task 3 Step 2 + Task 4 Step 2）。

- [ ] **Step 4：检查采集侧组件没引用上面这些路径**

```bash
grep -rn "from '@/components/\(nav\|home\|workspace\|editors\)/" components/ app/ lib/ | grep -v "components/studio/"
```

预期：无输出（采集侧没用过这些目录）。

- [ ] **Step 5：commit**

```bash
git add components/studio/
git commit -m "feat(studio): migrate components/* into components/studio namespace"
```

---

## Task 5：迁移创作测试到 `lib/studio/__tests__` 同级位置

**Files:**
- Create: `lib/studio/wechat.test.ts`、`lib/studio/twitter.test.ts`
- Create: `lib/studio/__tests__/smoke.test.ts`
- Create: `lib/studio/ai/generate.test.ts`
- Create: `lib/studio/store/{sessions.test.ts,settings.test.ts}`

- [ ] **Step 1：复制测试**

```bash
B="/Users/yves/ai编程项目/内容工厂创作与分发"
mkdir -p lib/studio/__tests__
cp "$B/lib/wechat.test.ts" lib/studio/wechat.test.ts
cp "$B/lib/twitter.test.ts" lib/studio/twitter.test.ts
cp "$B/lib/__tests__/smoke.test.ts" lib/studio/__tests__/smoke.test.ts
cp "$B/lib/ai/generate.test.ts" lib/studio/ai/generate.test.ts
cp "$B/lib/store/sessions.test.ts" lib/studio/store/sessions.test.ts
cp "$B/lib/store/settings.test.ts" lib/studio/store/settings.test.ts
```

- [ ] **Step 2：替换测试文件里的 import**

```bash
find lib/studio -type f -name "*.test.ts" -exec sed -i '' \
  -e "s|from '@/lib/api/wechatPublish'|from '@/lib/studio/api/wechatPublish'|g" \
  -e "s|from '@/lib/ai/generate'|from '@/lib/studio/ai/generate'|g" \
  -e "s|from '@/lib/ai/prompt'|from '@/lib/studio/ai/prompt'|g" \
  -e "s|from '@/lib/ai/streamWechat'|from '@/lib/studio/ai/streamWechat'|g" \
  -e "s|from '@/lib/ai/mock-data'|from '@/lib/studio/ai/mock-data'|g" \
  -e "s|from '@/lib/store/sessions'|from '@/lib/studio/store/sessions'|g" \
  -e "s|from '@/lib/store/settings'|from '@/lib/studio/store/settings'|g" \
  -e "s|from '@/lib/runGeneration'|from '@/lib/studio/runGeneration'|g" \
  -e "s|from '@/lib/wechat'|from '@/lib/studio/wechat'|g" \
  -e "s|from '@/lib/twitter'|from '@/lib/studio/twitter'|g" \
  -e "s|from '@/lib/types'|from '@/lib/studio/types'|g" {} \;
```

测试有时使用相对路径 `from './wechat'`、`from '../ai/prompt'`。这些不需要改（仍然指向同一个文件，只不过路径在 studio 命名空间下）。grep 验证：

```bash
grep -rn "from '\.\./" lib/studio/ | head
```

预期：相对路径仍然合法。

- [ ] **Step 3：跑 studio 测试**

```bash
npx vitest run --project studio
```

预期：所有 6 个测试文件全部通过。如果有 fail，对照具体错误修。

常见坑：
- `lib/studio/store/sessions.test.ts` 用了 `globalThis.localStorage` 或 `document` —— jsdom 应已注入，但若失败可能要在 `vitest.setup.ts` 里补 polyfill。
- `lib/studio/ai/generate.test.ts` 可能 mock 了 fetch—— 检查 vitest globals 是否启用。

- [ ] **Step 4：跑 monitor 测试确认未受影响**

```bash
npx vitest run --project monitor
```

预期：原 13 条测试全部通过。

- [ ] **Step 5：commit**

```bash
git add lib/studio/
git commit -m "test(studio): migrate vitest specs into lib/studio"
```

---

## Task 6：迁移创作页面到 `app/studio/`

**Files:**
- Create: `app/studio/page.tsx`
- Create: `app/studio/workspace/[id]/page.tsx`
- Create: `app/studio/settings/page.tsx`
- Create: `app/studio/layout.tsx`（新建，加 .studio-scope）

注意：B 的 `app/workspace/page.tsx` 仅仅是 `redirect('/')`，迁移后无意义（`/` 已经是采集侧），**直接丢弃**。

- [ ] **Step 1：复制页面**

```bash
B="/Users/yves/ai编程项目/内容工厂创作与分发"
mkdir -p app/studio/workspace/\[id\] app/studio/settings
cp "$B/app/page.tsx" app/studio/page.tsx
cp "$B/app/workspace/[id]/page.tsx" app/studio/workspace/\[id\]/page.tsx
cp "$B/app/settings/page.tsx" app/studio/settings/page.tsx
```

- [ ] **Step 2：替换 import**

```bash
find app/studio -type f -name "*.tsx" -exec sed -i '' \
  -e "s|from '@/components/home/|from '@/components/studio/home/|g" \
  -e "s|from '@/components/workspace/|from '@/components/studio/workspace/|g" \
  -e "s|from '@/components/editors/|from '@/components/studio/editors/|g" \
  -e "s|from '@/components/ui/|from '@/components/studio/ui/|g" \
  -e "s|from '@/lib/store/sessions'|from '@/lib/studio/store/sessions'|g" \
  -e "s|from '@/lib/store/settings'|from '@/lib/studio/store/settings'|g" \
  -e "s|from '@/lib/runGeneration'|from '@/lib/studio/runGeneration'|g" \
  -e "s|from '@/lib/ai/mock-data'|from '@/lib/studio/ai/mock-data'|g" \
  -e "s|from '@/lib/types'|from '@/lib/studio/types'|g" {} \;
```

- [ ] **Step 3：把首页跳转改成 `/studio`**

打开 `app/studio/page.tsx`，找到 `router.push(\`/workspace/${id}\`)`，改成：

```ts
router.push(`/studio/workspace/${id}`);
```

- [ ] **Step 4：把 workspace 页里跳回首页的 push 改成跳到 `/studio`**

打开 `app/studio/workspace/[id]/page.tsx`，找到 `if (!useSessionsStore.getState().sessions[id]) router.push('/');`，改成：

```ts
if (!useSessionsStore.getState().sessions[id]) router.push('/studio');
```

- [ ] **Step 5：把 settings 页面里的关闭按钮 `router.push('/')` 改成 `router.push('/studio')`**

打开 `app/studio/settings/page.tsx`，找到 `onClick={() => router.push('/')}`（关闭按钮），改成：

```ts
onClick={() => router.push('/studio')}
```

- [ ] **Step 6：检查 components/studio/workspace/Sidebar.tsx 里的 `Link href` 也要更新**

```bash
grep -n "href" components/studio/workspace/Sidebar.tsx
grep -rn "href=\"/\(workspace\|settings\)" components/studio app/studio
```

把所有 `href="/workspace/...` 改成 `href="/studio/workspace/...`，`href="/settings"` 改成 `href="/studio/settings"`，`href="/"`（如果跳转目标是创作首页）改成 `href="/studio"`。

具体行号靠 grep 输出锁定，用 Edit 工具逐处改。

如果 grep 后没有任何匹配，跳过本步。

- [ ] **Step 7：创建 `app/studio/layout.tsx`**

```tsx
export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio-scope min-h-screen">{children}</div>;
}
```

- [ ] **Step 8：commit**

```bash
git add app/studio/
git commit -m "feat(studio): port pages under /studio prefix with .studio-scope wrapper"
```

---

## Task 7：迁移创作 API 到 `app/api/studio/`

**Files:**
- Create: `app/api/studio/generate/route.ts`
- Create: `app/api/studio/wechat/accounts/route.ts`
- Create: `app/api/studio/wechat/publish/route.ts`

- [ ] **Step 1：复制 API**

```bash
B="/Users/yves/ai编程项目/内容工厂创作与分发"
mkdir -p app/api/studio/generate app/api/studio/wechat/accounts app/api/studio/wechat/publish
cp "$B/app/api/generate/route.ts" app/api/studio/generate/route.ts
cp "$B/app/api/wechat/accounts/route.ts" app/api/studio/wechat/accounts/route.ts
cp "$B/app/api/wechat/publish/route.ts" app/api/studio/wechat/publish/route.ts
```

- [ ] **Step 2：替换 API 文件里的 import**

```bash
find app/api/studio -type f -name "*.ts" -exec sed -i '' \
  -e "s|from '@/lib/types'|from '@/lib/studio/types'|g" \
  -e "s|from '@/lib/ai/prompt'|from '@/lib/studio/ai/prompt'|g" {} \;
```

- [ ] **Step 3：检查现有 `app/api/wechat/search/route.ts` 没被误伤**

```bash
ls app/api/wechat/
```

预期：`search` 子目录还在；不应有 `accounts` / `publish`（那是创作侧的，已落到 `app/api/studio/wechat/` 下）。

- [ ] **Step 4：commit**

```bash
git add app/api/studio/
git commit -m "feat(studio): expose creation APIs under /api/studio prefix"
```

---

## Task 8：把采集侧布局迁移到 `(monitor)` 路由组

A 当前结构：
```
app/layout.tsx          (root, 渲染 CategoriesProvider + AppSidebar)
app/page.tsx            (redirect)
app/c/[categoryId]/...  (页面)
```

合并后：根布局只放全局壳子（顶栏 + Toast）；采集侧的 sidebar/Provider 挂在 `(monitor)/layout.tsx` 下。

**Files:**
- Modify (move): `app/page.tsx` → `app/(monitor)/page.tsx`
- Modify (move): `app/c/[categoryId]/...` → `app/(monitor)/c/[categoryId]/...`
- Create: `app/(monitor)/layout.tsx`
- Modify: `app/layout.tsx`（精简）

- [ ] **Step 1：移动文件**

```bash
mkdir -p "app/(monitor)"
git mv app/page.tsx "app/(monitor)/page.tsx"
git mv app/c "app/(monitor)/c"
```

- [ ] **Step 2：创建 `app/(monitor)/layout.tsx`**

挪走根 layout 里的 `CategoriesProvider` + `AppSidebar`：

```tsx
import { CategoriesProvider } from '@/components/categories-provider'
import { AppSidebar } from '@/components/app-sidebar'

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoriesProvider>
      <div className="flex min-h-[calc(100vh-56px)]">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    </CategoriesProvider>
  )
}
```

注意：`min-h-[calc(100vh-56px)]` 是为了减去顶部 AgentSwitcher 的 56px 高度。

- [ ] **Step 3：精简 `app/layout.tsx`**（保留 metadata + body 包装，移除 sidebar）

完整新内容（只展示文件全文，避免 sed 出错）：

```tsx
import './globals.css'
import type { Metadata } from 'next'
import { Sora, Noto_Serif_SC, DM_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { ToastProvider } from '@/components/studio/ui/ToastProvider'
import { AgentSwitcher } from '@/components/agent-switcher'

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' })
const notoSerifSC = Noto_Serif_SC({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-noto-serif-sc' })
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-dm-mono' })

export const metadata: Metadata = {
  title: '内容工厂',
  description: '内容采集、选题分析与多平台创作工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className={`${sora.variable} ${notoSerifSC.variable} ${dmMono.variable}`}>
      <body className="antialiased bg-neutral-50 text-neutral-900">
        <AgentSwitcher />
        {children}
        <Toaster richColors position="top-right" />
        <ToastProvider />
      </body>
    </html>
  )
}
```

- [ ] **Step 4：dev 启动确认采集侧仍然可访问**

```bash
npm run dev
```

打开 http://localhost:3000/ ，预期：
- 跳到 `/c/<id>/content`，左侧 sidebar 仍出现（来自 `(monitor)/layout.tsx`）
- 顶部缺 AgentSwitcher 是预期的（下个 Task 才造）

如果跳不动或 sidebar 丢失，检查 `(monitor)` 目录路径是否正确，路由组的圆括号必须保留。

Ctrl+C 终止 dev。

- [ ] **Step 5：commit**

```bash
git add "app/(monitor)/" app/layout.tsx
git commit -m "refactor(monitor): move sidebar layout into (monitor) route group"
```

---

## Task 9：合并 globals.css，加 `.studio-scope` 节

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1：在 `app/globals.css` 末尾追加 studio scope 块**

打开 `app/globals.css`，在文件末尾追加：

```css

/* ───────────────────────── Studio Agent scope ───────────────────────── */
/* 创作 Agent 设计 token 与 prose 样式，限定在 .studio-scope 子树 */
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

.studio-scope .prose-invert h1 { font-family: var(--font-serif); font-size: 1.875rem; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
.studio-scope .prose-invert h2 { font-family: var(--font-serif); font-size: 1.5rem; font-weight: 700; margin-top: 1.5em; margin-bottom: 0.5em; }
.studio-scope .prose-invert p { margin: 0.6em 0; }
.studio-scope .prose-invert blockquote { border-left: 3px solid var(--color-accent); padding-left: 1em; color: var(--color-muted); font-style: italic; margin: 1em 0; }
.studio-scope .prose-invert hr { border: 0; border-top: 1px solid var(--color-border); margin: 2em 0; }
.studio-scope .prose-invert strong { color: var(--color-fg); font-weight: 700; }
.studio-scope .prose-invert em { color: var(--color-fg); font-style: italic; }
.studio-scope .prose-invert img { display: block; max-width: 100%; padding: 2rem 1rem; background: var(--color-elevated); border: 1px dashed var(--color-border); margin: 1em 0; text-align: center; }
.studio-scope .prose-invert img[src=""] { content: '🖼  图片占位'; padding: 3rem; }
```

- [ ] **Step 2：commit**

```bash
git add app/globals.css
git commit -m "style(merge): add .studio-scope CSS variables and prose rules"
```

---

## Task 10：实现 AgentSwitcher 顶部菜单组件

**Files:**
- Create: `components/agent-switcher.tsx`

需求：
- 高度 56px，sticky `top-0 z-50`，白底加底部分割线
- 左侧文字 logo「内容工厂」（链到 `/`）
- 居中两个 pill：「采集 Agent」`/` ；「创作 Agent」`/studio`
- 右侧仅当 pathname 以 `/studio` 开头时显示「设置」（链到 `/studio/settings`）
- active 判定：
  - 采集 active：`pathname === '/'` 或 `pathname.startsWith('/c/')`
  - 创作 active：`pathname.startsWith('/studio')`

- [ ] **Step 1：创建组件**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function AgentSwitcher() {
  const pathname = usePathname() ?? '/'
  const isMonitor = pathname === '/' || pathname.startsWith('/c/')
  const isStudio = pathname.startsWith('/studio')

  return (
    <header className="sticky top-0 z-50 h-14 bg-white/90 backdrop-blur-md border-b border-neutral-200">
      <div className="mx-auto h-full max-w-[1400px] px-6 flex items-center gap-6">
        <Link href="/" className="font-semibold tracking-tight text-neutral-900">
          内容工厂
        </Link>

        <nav className="flex items-center gap-1.5">
          <Link
            href="/"
            className={
              'px-3.5 py-1.5 rounded-full text-sm transition-colors ' +
              (isMonitor
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100')
            }
          >
            内容采集与选题创作 Agent
          </Link>
          <Link
            href="/studio"
            className={
              'px-3.5 py-1.5 rounded-full text-sm transition-colors ' +
              (isStudio
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100')
            }
          >
            内容创作 Agent
          </Link>
        </nav>

        <div className="ml-auto flex items-center">
          {isStudio && (
            <Link
              href="/studio/settings"
              className="text-sm text-neutral-600 hover:text-neutral-900 px-2 py-1"
            >
              设置
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2：dev 启动验证**

```bash
npm run dev
```

打开 http://localhost:3000/ ，预期：
- 顶部出现 AgentSwitcher，「内容采集与选题创作 Agent」pill 高亮（黑底白字）
- 点击「内容创作 Agent」跳到 `/studio`，pill 切换高亮，右侧出现「设置」
- 点击「设置」跳到 `/studio/settings`
- 浏览器后退，回到采集页面

Ctrl+C。

- [ ] **Step 3：commit**

```bash
git add components/agent-switcher.tsx
git commit -m "feat(merge): add AgentSwitcher top menu"
```

---

## Task 11：端到端验证（采集侧）

- [ ] **Step 1：dev 启动**

```bash
npm run dev
```

- [ ] **Step 2：浏览器手测采集动线**

在 http://localhost:3000/ 操作：
1. 顶栏「采集 Agent」高亮，左侧 sidebar 显示分类
2. 点击不同分类，URL 变 `/c/<id>/content`
3. 平台筛选切换工作
4. 日期 timeline 切换工作
5. RefreshMenu 触发刷新
6. 调用一次 `/api/insights/generate`（如果 LLM 可用）

如果哪一步坏了，比对 git log 找回归点。

- [ ] **Step 3：跑测试**

```bash
npm run test
```

预期：monitor 13 + studio 6 = 19 条测试全部通过。

如果 studio 项目里某个测试因为环境（jsdom）行为不同而失败，回到 Task 5 Step 3 的常见坑列表排查。

- [ ] **Step 4：commit（无代码改动则跳过）**

如果手测过程顺手发现并修了什么 bug，提一个 fix commit。

---

## Task 12：端到端验证（创作侧）

- [ ] **Step 1：dev 启动并访问 `/studio`**

```bash
npm run dev
```

打开 http://localhost:3000/studio：
- 顶栏「内容创作 Agent」高亮，右上「设置」可见
- 创作首页：标题、PromptInput、PlatformPicker、GenerateButton 显示正确（Sora + Noto Serif SC 字体生效）
- 字体如果没生效（仍是采集侧默认 sans），检查 `app/studio/layout.tsx` 是否正确套了 `.studio-scope`

- [ ] **Step 2：触发生成动线**

输入一段 prompt，勾选 wechat/xhs，点 GenerateButton：
- URL 跳到 `/studio/workspace/<id>`
- workspace Sidebar 显示新建会话
- PlatformTabs 渲染勾选的平台
- 点击 Tab 切换 PlatformEditor
- WorkspaceActions 「设置」/「发布」按钮可点

如果 fetch 报错，检查 Network tab 调用的是 `/api/studio/generate`、`/api/studio/wechat/accounts` —— 不是 `/api/generate` 等老路径。如果老路径仍出现，回 Task 3/4 grep 修补。

- [ ] **Step 3：访问 `/studio/settings`**

- 点 sidebar 不同平台切换
- 修改 systemPrompt，点保存，看 Toast 出现「已保存」
- 关闭按钮跳回 `/studio`

- [ ] **Step 4：访问 `/studio/workspace`**

刷新或直接打开 `/studio/workspace`：B 原版 redirect 到 `/`，我们已经丢弃这个文件。预期：Next 显示 404。如果你想保留 redirect，新建 `app/studio/workspace/page.tsx`：

```tsx
import { redirect } from 'next/navigation';
export default function WorkspaceIndex() { redirect('/studio'); }
```

可选：要不要补这个 404 → redirect，由你决定。本计划默认**不补**（404 即可，无人会直接访问空 id 的工作台）。

- [ ] **Step 5：commit（如果有 fix）**

```bash
git add -A
git commit -m "fix(studio): smoke-test follow-ups"
```

---

## Task 13：清理与文档

**Files:**
- Modify: `README.md`

- [ ] **Step 1：在 `README.md` 末尾新增「双 Agent 项目结构」段落**

打开根 `README.md`，在最后追加：

```md
## 双 Agent 项目结构

本项目同时承载两个 Agent：

| Agent | URL 前缀 | 代码命名空间 |
|---|---|---|
| 内容采集与选题创作 | `/`、`/c/...` | 根目录（`app/(monitor)/`、`components/`、`lib/`、`app/api/...`） |
| 内容创作 | `/studio/...` | `studio/` 子目录（`app/studio/`、`components/studio/`、`lib/studio/`、`app/api/studio/...`） |

新增 API 时遵守对应前缀：
- 采集相关 → `app/api/<resource>/route.ts` + `lib/<resource>.ts`
- 创作相关 → `app/api/studio/<resource>/route.ts` + `lib/studio/<resource>.ts`

CSS 设计 token：
- 采集走 shadcn / Tailwind 4 默认主题
- 创作走 `.studio-scope` 内的 `--color-bg/-fg/-surface/-accent/...`
```

- [ ] **Step 2：确认 build 成功**

```bash
npm run build
```

预期：build 成功输出 `.next/`，无 type 错误。

如果有 type 错误，按报错回到对应 Task 修补 import 路径。

- [ ] **Step 3：lint（可选）**

```bash
npm run lint
```

预期：无错。如有 warning（unused vars 等）可视情况修，不阻塞。

- [ ] **Step 4：最终 commit**

```bash
git add README.md
git commit -m "docs(merge): document dual-agent layout in README"
```

---

## 收尾说明

- B 项目的源目录 `/Users/yves/ai编程项目/内容工厂创作与分发` 在本计划中**不会被删**。验收通过后由用户自行决定是否归档。
- 顶栏样式（颜色、间距、文字）按 Task 10 提交后可再调整，不阻塞功能。
- 后续如要把采集侧组件改用 Sora / Serif 字体，只需在采集组件外层包 `.studio-scope` 类（或新建独立 scope）。当前计划保持采集原样。
