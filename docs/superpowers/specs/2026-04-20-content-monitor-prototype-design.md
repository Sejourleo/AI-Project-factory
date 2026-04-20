# 内容监控工具 · 前端原型设计

**日期**：2026-04-20
**状态**：设计待实现
**性质**：纯前端原型（假数据）

## 背景

需要一个内容监控工具，用于按分类管理不同关键词 / 博主的内容监控任务。系统将来会对接真实采集器和 AI 大模型做热门内容分析并产出选题报告，每天定时运行。本阶段交付**前端原型**：UI、交互、假数据齐备；后端、采集、AI、定时任务均不实现，但代码结构为将来接入预留。

## 目标用户

内容运营人员。日常高频操作：按日期回看采集内容、阅读每日选题报告、维护监控关键词和对标博主列表。

---

## 架构与技术栈

### 技术选型

- **Next.js 15（App Router） + TypeScript**
- **Tailwind CSS v4** — 样式
- **shadcn/ui** — 按需引入（Tabs / Button / Card / Input / Badge / Toggle 等）
- **lucide-react** — 图标
- **dayjs** — 日期处理
- 状态：React `useState` + URL search params，不引入全局状态库

### 不引入的依赖（及原因）

- Zustand / Redux — 状态复杂度不够
- Recharts / Chart.js — 本阶段仅需数字徽标，无真正图表
- next-intl / i18n — 中文单语
- localStorage 持久化 — 保持原型定位，避免假数据与本地数据不一致

### 架构约束（为将来接入后端预留）

**数据访问层抽象**。所有组件**禁止**直接 `import` fixtures 数据。取数走 `lib/data/*.ts` 的 async 函数：

```ts
// lib/data/contents.ts
export async function getContentsByDate(
  categoryId: string,
  date: string,
  platforms?: Platform[]
): Promise<ContentItem[]> {
  // 原型：从 fixtures 过滤 + 模拟 100ms 延迟
  // 将来：改为 fetch('/api/contents?...')
}
```

组件永远 `await getContentsByDate(...)`。将来换真实后端时，**组件一行不用改**。

**TODO(api) 锚点约定**。所有未来需要变成 API Route 的调用处，代码里用 `// TODO(api): ...` 注释标注，便于将来检索迁移：

```ts
// TODO(api): POST /api/reports/generate
async function regenerateReport(categoryId: string, date: string) { ... }
```

### TypeScript 类型（契约）

```ts
type Platform = 'douyin' | 'xiaohongshu' | 'weibo' | 'bilibili'

type Category = {
  id: string
  name: string
  createdAt: string
  settings: MonitorSettings
}

type MonitorSettings = {
  platforms: Platform[]
  keywords: string[]
  accounts: Array<{
    platform: Platform
    handle: string
    displayName: string
  }>
}

type ContentItem = {
  id: string
  categoryId: string
  platform: Platform
  title: string
  author: string
  publishedAt: string
  collectedAt: string        // 决定归到哪一天
  url: string
  coverImage?: string
  stats: { likes: number; comments: number; shares: number }
  hotScore: number
  matchedBy: { type: 'keyword' | 'account'; value: string }
}

type TopicSuggestion = {
  id: string
  title: string
  brief: {
    why: string              // 为什么做这个选题
    hook: string             // 爆点在哪
    growth: string           // 增长空间
  }
  tags: string[]             // 用于"按选题"视图筛选
  relatedContentIds: string[]
}

type DailyReport = {
  id: string
  categoryId: string
  date: string               // YYYY-MM-DD
  summary: string            // 列表预览要用
  yesterdayHotspots: string[]
  topics: TopicSuggestion[]
  analyzedContentIds: string[]
}
```

这些类型即"真实数据该有的形状"。将来真实后端只要返回匹配这些类型的 JSON，前端即插即用。

### 平台常量

```ts
const PLATFORMS: Array<{ id: Platform; name: string; color: string }> = [
  { id: 'douyin',       name: '抖音',     color: '#000000' },
  { id: 'xiaohongshu',  name: '小红书',   color: '#FE2C55' },
  { id: 'weibo',        name: '微博',     color: '#E6162D' },
  { id: 'bilibili',     name: 'B站',      color: '#FB7299' },
]
```

---

## 路由结构

```
/                                    → 重定向至第一个分类的 content tab
/c/[categoryId]                      → 重定向至 content tab
/c/[categoryId]/content              → Tab 1 内容
/c/[categoryId]/reports              → Tab 2 选题分析
/c/[categoryId]/settings             → Tab 3 监控设置
```

**URL search params**：
- `/c/[id]/content?date=2026-04-19&platforms=douyin,weibo`（默认 date = 昨天，platforms 不填 = 全部）
- `/c/[id]/reports?view=by-date&date=2026-04-19`（默认 view=by-date，date=最新有报告的日期）
- `/c/[id]/reports?view=by-topic&range=7d&tags=工作流,入门教程`

分类和 Tab 走路由的好处：浏览器前进 / 后退、深链接分享。

---

## 布局骨架

**左侧分类栏 + 主区顶部 Tab**（Notion / Linear 风格）：

```
┌──────────────────────────────────────────────────────┐
│ [Logo] 内容工厂                                       │
├──────────┬───────────────────────────────────────────┤
│ 监控分类  │ [内容] [选题分析] [监控设置]               │
│          │ ─────────────────────────────────────      │
│ • Claude │                                            │
│   Code   │   主内容区                                 │
│ • Vibe   │                                            │
│ • AI 产品│                                            │
│ ─────    │                                            │
│ + 新建   │                                            │
└──────────┴───────────────────────────────────────────┘
```

- 左栏：`CategoryList` 组件。分类支持新建；暂不支持重命名（重命名 = 删掉重建）
- 顶部 Tab：shadcn `Tabs`，active 态高亮
- 分类顶部可显示"该分类最近采集：N 条 / 昨日"的小状态

---

## Tab 1 · 内容

### 布局（自上而下）

1. **平台筛选栏**（sticky，顶部）
   - 平铺 Pills，多选 + "全部"。例：`[全部 (138)] [抖音 (42)] [小红书 (56)] [微博 (18)] [B站 (22)]`
   - Pill 上的数字 = 当前选中日期下该平台的条数
   - 数量为 0 时 Pill 变灰但可点（切过去显示空状态）

2. **日期卡片横向滚动栏**（sticky）
   - 每张卡片：星期 + 日期 + 采集数量徽标
   - 默认选中**昨天**（最具分析价值的一天）
   - 展示过去 14 天（含今天）；原型不提供"加载更多历史"
   - 选中态：黑底白字

3. **内容卡片网格**（主区）
   - 2 列（<1280px） / 3 列（≥1280px），响应式
   - 每张卡片字段：封面图（16:9，无封面时占位色块 + 平台图标）、平台角标、标题（2 行截断）、作者 · 发布时间、点赞 / 评论 / 转发三个小指标、右下角"对标来源：关键词 X" 或 "博主 Y"
   - 点击 → 新标签打开 `url`
   - 默认按 `hotScore` 降序。右上角有排序切换："按热度 / 按时间"
   - 空状态：当天 / 当前筛选无数据时显示插画 + "该日尚未采集到内容"

### 取数

```ts
getContentsByDate(categoryId, date, platforms?) : Promise<ContentItem[]>
getDateBuckets(categoryId, days=14): Promise<Array<{ date: string; count: number }>>
getPlatformCounts(categoryId, date): Promise<Record<Platform, number>>
```

---

## Tab 2 · 选题分析与报告

### 视图切换器

页面顶部 Segmented Toggle：`[按日期] [按选题]`。默认"按日期"。切换通过 `?view=` 保留状态。

### 视图 A · 按日期（两栏）

**左栏：报告列表**（固定 280px 宽）
- 每条：日期（2026-04-19 · 周六）+ 摘要预览（2 行截断）+ "最新"徽标（仅最顶一条）
- 选中态：白底 + 浅描边 + 轻阴影
- 默认滚动位置：最顶（最新报告）

**右主：当日报告阅读区**
- 顶部元信息：日期 · 覆盖 N 个平台 · 分析了 Top 10 热门内容 · [重新生成] 按钮（原型：点击转圈 2 秒后 toast "AI 分析完成（原型演示）"）
- **前一天热点** 区块：胶囊标签平铺，点击可关联跳转 Tab 1 的对应日期 + 关键词
- **选题建议** 区块：每个 `TopicSuggestion` 一张卡片：
  - 方向标题（大号字）
  - 三段 brief：`为什么做` / `爆点在哪` / `增长空间`（可折叠，默认全部展开）
  - 底部折叠抽屉："关联的 N 条源内容" → 展开显示内容卡片小样（复用 Tab 1 卡片组件的紧凑版）
  - 右上角 tags

### 视图 B · 按选题（聚合）

**顶部筛选条**
- 时间范围：`[近 7 天] [近 30 天] [自定义]`
- 标签筛选：多选 dropdown，从所有命中报告的 topic tags 汇总去重

**主区**
- 所有命中选题平铺（卡片复用视图 A 的选题卡片组件）
- 每张卡片额外显示"来自 X 月 X 日报告"小字，可点 → 跳回"按日期"视图并打开对应报告
- 空状态：未命中时显示"调整筛选条件或等待更多报告生成"

### 取数

```ts
getReportList(categoryId): Promise<Array<Pick<DailyReport, 'id' | 'date' | 'summary'>>>
getReportByDate(categoryId, date): Promise<DailyReport | null>
getTopicsByRange(categoryId, days: 7 | 30, tags?: string[]): Promise<Array<TopicSuggestion & { reportDate: string }>>

// TODO(api): POST /api/reports/generate
async function regenerateReport(categoryId: string, date: string): Promise<void> {
  // 原型：await sleep(2000); toast('AI 分析完成（原型演示）')
}
```

---

## Tab 3 · 监控设置

### 布局（单列纵向表单）

**顶部只读信息条**（浅蓝背景）
> "该分类将于每天 08:00 自动运行采集任务"

（展示定时概念，不做任何真实行为）

**区块 1 · 监控平台**
- 4 个平台的 Card，每张：平台 logo + 名称 + 启用开关（shadcn Switch）
- 至少启用一个，全关时保存按钮 disabled

**区块 2 · 对标关键词**
- Tag Input：输入框回车加 tag，每个 tag 带 `×` 删除
- 下方显示 `共 N 个关键词`
- 允许空

**区块 3 · 对标博主 / 账号**
- 顶部"+ 新增博主"按钮 → 打开对话框：平台下拉 + 账号 handle + 显示名称
- 列表展示已添加博主，每条 Card：平台图标 + displayName + handle + [暂停] / [删除]
- 允许空

**底部**
- 固定底栏："保存设置" 按钮（primary）+ "取消" 按钮
- 点击保存：toast "设置已保存（原型演示）"；原型内状态仍存于内存，刷新即重置

### 取数 / 写入

```ts
getCategorySettings(categoryId): Promise<MonitorSettings>

// TODO(api): PUT /api/categories/:id/settings
async function saveCategorySettings(categoryId: string, settings: MonitorSettings): Promise<void> {
  // 原型：await sleep(300); 原地更新内存中的 category
}
```

---

## 假数据策略

放于 `lib/fixtures/`：

- `categories.ts` — 3 个分类：
  - "ClaudeCode 选题监控"
  - "Vibecoding 选题监控"
  - "AI 产品监控"
  - 每个分类预置一组监控设置（全部平台开启 + 5-8 个关键词 + 3-5 个博主）

- `contents.ts` — 约 14 天 × 3 分类 × 15-25 条 / 天 ≈ 800-1000 条内容
  - 标题用真实感强的中文（围绕 Claude Code / AI 编程 / Vibe Coding）
  - 封面图用占位服务（picsum.photos 按 id 生成）
  - hotScore 分布：每天有 1-2 条高分（>90）、大部分中等（40-80）、少量低分
  - 关键词/博主匹配分布均衡

- `reports.ts` — 3 分类 × 7 天 ≈ 21 份报告
  - 每份报告：3-5 个 topic suggestions
  - tags 有重复以便"按选题"视图能做聚合筛选
  - 前一天热点 3-5 条

生成假数据可用**脚本**（`scripts/generate-fixtures.ts`）而非全部手写，结构一致、内容可调。

---

## 不做的事（YAGNI）

### 后端相关（本阶段完全不做，但架构预留）
- 不接 OpenAI / Anthropic API，不做真实 AI 生成
- 不做真实平台采集（抖音 / 小红书 / 微博 / B 站）
- 不做定时任务 / cron / 服务端逻辑
- 不做数据库 / 数据持久化
- 不做用户登录 / 多租户

### 功能扩展
- 不做移动端响应式优化（桌面优先，保证不错位即可）
- 不做暗色模式
- 不做导出报告（PDF / Markdown）
- 不做内容详情页（内容卡片点击 → 跳外链）
- 不做通知 / 订阅 / 邮件推送
- 不做图表可视化（本阶段数字徽标足够）
- 不做权限管理和协作功能

### 交互细节
- 不做拖拽排序
- 不做分类重命名（需重命名 = 删除重建）
- 不做键盘快捷键
- 不做无限滚动

---

## 交付物清单

- `app/`（页面、layout、路由）
- `components/`（分类侧栏、日期卡片、内容卡片、报告列表、选题卡片、设置表单组件）
- `lib/data/`（数据访问层，仅从 fixtures 读）
- `lib/fixtures/`（假数据）
- `lib/types.ts`（类型定义）
- `scripts/generate-fixtures.ts`（假数据生成脚本，可选）
- `README.md`（本地启动说明）

---

## 将来接入真实后端的迁移路径（非本阶段交付）

| 需求 | 新增位置 | 预估工作量 |
|---|---|---|
| AI 分析（OpenAI / Anthropic） | `app/api/reports/generate/route.ts` | 0.5 天 |
| 平台采集器 | `lib/collectors/{platform}.ts`，共同 `Collector` 接口 | 每平台 1-3 天 |
| 数据库 | Postgres / Supabase（schema 直接对应 TS 类型） | 0.5 天 |
| 每日定时运行 | Vercel Cron 或外部 worker | 0.5 天 |
| 认证 | NextAuth | 0.5 天 |

原型的页面、组件、交互、路由、类型、数据访问层签名全部原封不动保留。
