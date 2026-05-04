# 内容工厂

Next.js 16 + Postgres，单仓库承载两个 Agent：内容采集与选题分析（`/`）+ 多平台内容创作与发布（`/studio`）。

## 快速开始

```bash
npm install
docker compose up -d            # 拉本地 Postgres 16；首次 ~150MB
cp .env.example .env.local      # 按下方"环境变量"段填值
npm run dev
```

访问 http://localhost:3000。首次访问任意 API 路由会自动建表 + seed 默认分类。

## 环境变量

| Key | 用途 |
|---|---|
| `POSTGRES_URL` | 数据库连接（本地 docker 默认 `postgres://dev:dev@localhost:5432/content_factory`；生产由 Vercel Postgres 自动注入） |
| `WECHAT_SEARCH_API_KEY` / `WECHAT_SEARCH_API_URL` | 采集侧公众号关键词搜索 |
| `LLM_PROVIDER` / `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | 采集侧选题分析（OpenAI 兼容协议） |
| `SILICONFLOW_API_KEY` / `SILICONFLOW_BASE_URL` / `SILICONFLOW_MODEL` | 创作侧多平台生成 |
| `WECHAT_API_KEY` / `WECHAT_API_BASE_URL` | 创作侧公众号一键发布 |
| `CRON_SECRET` | 保护 `/api/cron/daily-insights`（手动 curl 触发时用） |

## 部署到 Vercel

1. push 代码到 GitHub
2. Vercel → Import Project → 选 Next.js（自动识别）
3. Storage → Create Database → Postgres → 自动注入 `POSTGRES_URL`
4. 环境变量手填上面其余 keys
5. Deploy

`/api/cron/daily-insights` 不挂 schedule（避免 Pro 计划费用），手动触发：
```
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-domain>/api/cron/daily-insights
```

## 功能

- **分类侧栏**：管理多个监控分类，支持新建；每个分类配色点
- **Tab 1 · 内容**：月历视图（各平台色柱）+ 平台筛选 + 内容卡片网格 + 右侧统计面板（总数 / 覆盖平台 / 热门标签 / 最新动态）
- **Tab 2 · 选题分析**：按日期阅读每日 AI 报告（前一天热点 + 选题建议，支持重新生成），或按选题聚合近 7/30 天并按标签筛选
- **Tab 3 · 监控设置**：平台开关 / 关键词标签 / 对标博主管理（新增 / 暂停 / 删除）

## 测试

```bash
docker compose up -d   # postgres 必须已起（db 测试连真实 PG）
npm run test           # monitor (node) + studio (jsdom) 双 environment
```

## 目录结构

- `app/(monitor)/` — 采集侧页面（路由组，URL 不含 `(monitor)/`）
- `app/studio/` — 创作侧页面（URL 前缀 `/studio`）
- `app/api/` — 采集 API；`app/api/studio/` — 创作 API
- `components/` — 采集组件 + shadcn/ui（`components/ui/`）
- `components/studio/` — 创作侧组件（独立 UI 体系）
- `lib/db/` — 采集侧 Postgres 数据层（`@vercel/postgres` 兼容的 `pg.Pool` 封装）
- `lib/data/` — 高层数据访问（部分 fixture，部分 db）
- `lib/fixtures/` — 默认 seed 数据
- `lib/studio/` — 创作侧 Zustand store + 业务模块
- `tests/` — vitest 单测（双 project：monitor 串行连真 PG / studio jsdom）

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
