# 内容工厂 · 前端原型

按分类管理内容监控任务的 Next.js 前端原型。所有数据为内置假数据，无后端。

## 快速开始

```bash
npm install
cp .env.example .env.local   # 填入公众号搜索 API key
npm run dev
```

访问 http://localhost:3000

> `.env.local` 中的 `WECHAT_SEARCH_API_KEY` 仅在服务端使用（`/api/wechat/search` 代理转发），
> 不会下发到浏览器。未配置时，公众号平台退化为空列表，其它平台仍正常展示。

## 功能

- **分类侧栏**：管理多个监控分类，支持新建；每个分类配色点
- **Tab 1 · 内容**：月历视图（各平台色柱）+ 平台筛选 + 内容卡片网格 + 右侧统计面板（总数 / 覆盖平台 / 热门标签 / 最新动态）
- **Tab 2 · 选题分析**：按日期阅读每日 AI 报告（前一天热点 + 选题建议，支持重新生成），或按选题聚合近 7/30 天并按标签筛选
- **Tab 3 · 监控设置**：平台开关 / 关键词标签 / 对标博主管理（新增 / 暂停 / 删除）

## 测试

```bash
npx vitest run         # 运行 data / utils 层单元测试
```

## 将来接入真实后端

所有取数走 `lib/data/*.ts` 的 async 函数。搜索 `TODO(api):` 定位需要改为真实 API 调用的位置。

## 目录结构

- `app/` — 路由页面（App Router）
- `components/` — 业务组件 + shadcn/ui（`components/ui/`）
- `lib/data/` — 数据访问层（当前读 fixtures）
- `lib/fixtures/` — 假数据（分类 / 内容 / 报告）
- `lib/types.ts` — 核心类型与平台常量
- `tests/` — Vitest 单元测试

## 双 Agent 项目结构

本项目同时承载两个 Agent，顶部菜单切换：

| Agent | URL 前缀 | 代码命名空间 |
|---|---|---|
| 内容采集与选题创作 | `/`、`/c/...` | 根目录（`app/(monitor)/`、`components/`、`lib/`、`app/api/<resource>/`） |
| 内容创作 | `/studio/...` | `studio/` 子目录（`app/studio/`、`components/studio/`、`lib/studio/`、`app/api/studio/<resource>/`） |

新增 API 时遵守对应前缀：
- 采集相关 → `app/api/<resource>/route.ts` + `lib/<resource>.ts`
- 创作相关 → `app/api/studio/<resource>/route.ts` + `lib/studio/<resource>.ts`

CSS 设计 token：
- 采集走 shadcn / Tailwind 4 默认主题（`@theme inline` + `oklch` 变量）
- 创作走 `.studio-scope` 内的 `--color-bg / -fg / -surface / -accent / -platform-*` 等独立 token，不污染采集侧

测试：vitest 用 `projects` 拆分两个 environment——`monitor`（node）跑 `tests/**`，`studio`（jsdom + react plugin）跑 `lib/studio/**/*.test.ts`。`npm run test` 同时执行两组。
