# 选题分析功能设计

## 概述

为「选题分析」页面增加三项核心能力：
1. SiliconFlow LLM 集成（替换当前 Anthropic 配置）
2. 每日定时自动分析前一天数据
3. 针对特定关键词的定向分析（支持从已配置关键词选择 + 临时输入）

## Part 1: SiliconFlow LLM 集成

### 环境变量

更新 `.env.local`：
```
LLM_PROVIDER=openai
LLM_BASE_URL=https://api.siliconflow.cn/v1
LLM_API_KEY=sk-kvxozdtvpjpejicxrukunlchvdvorfxvakmfhtyrehcpftop
LLM_MODEL=zai-org/GLM-5
```

### OpenAI 客户端兼容性修复

文件：`lib/llm/openai.ts`

当前实现拼接 URL 为 `${baseUrl}/v1/chat/completions`，但 SiliconFlow 的 base_url 已包含 `/v1`。修改为：`${baseUrl.replace(/\/$/, '')}/chat/completions`（去掉多余的 `/v1` 前缀）。

GLM-5 可能不支持 `response_format: json_schema` 的 strict 模式。策略：
- 先尝试带 `json_schema` 的请求
- 若返回 4xx 错误（400/422/不支持），fallback 到 `response_format: { type: "json_object" }`，并在 system prompt 末尾追加 schema 描述
- 缓存 fallback 状态，后续请求直接走 fallback 路径，避免重复失败

## Part 2: 每日定时分析

### API Route

文件：`app/api/cron/daily-insights/route.ts`

- 方法：GET（方便 cron 服务 curl 调用）
- 可选 `Authorization: Bearer <CRON_SECRET>` 鉴权（通过环境变量 `CRON_SECRET` 配置，不设则跳过鉴权）
- 逻辑：
  1. 获取所有分类
  2. 对每个分类，查询 `collected_notes` 中 `collected_at` 在前一天（UTC 00:00 ~ 23:59:59）的记录数
  3. 若 count > 0，调用已有的 `runInsightsPipeline(db, llm, categoryId)`
  4. 若 count = 0，跳过该分类
  5. 返回 JSON 汇总：`{ results: [{ categoryId, status: 'generated' | 'skipped' | 'error', detail }] }`

### 调度方式

本地开发：系统 crontab 或手动 curl。
生产部署：`vercel.json` 中配置 cron，或任何外部调度器调用该 GET 端点。

### 数据窗口调整

当前 `pickTopNotes` 查询最近 7 天数据。定时分析复用此函数，不改窗口——这样即使某天数据少，也能结合近 7 天的上下文生成有意义的洞察。

## Part 3: 定向关键词分析

### 新 API Route

文件：`app/api/insights/generate-by-keyword/route.ts`

- 方法：POST
- Body：`{ categoryId: string, keywords: string[] }`
- 逻辑：
  1. 从 `collected_notes` 中查询匹配任一关键词的笔记（`keyword IN (...)` 或 `title/summary LIKE %keyword%`），按 `hot_score DESC` 取 top 15
  2. 复用 stage1（摘要）和 stage2（洞察生成）管线
  3. 在 stage2 的 prompt 中额外注明「本次分析聚焦关键词：xxx」
  4. 结果存入 `topic_insights` 表，与普通洞察一样

### 前端组件

文件：`components/keyword-analysis-dialog.tsx`

Dialog 组件：
- 触发按钮：「定向分析」，放在 ReportViewer header 的「重新生成」按钮旁边
- Dialog 内容：
  - 上方：当前分类已配置的关键词，以 chip/tag 形式展示，可点击选中（多选）
  - 下方：输入框 + 添加按钮，可临时输入新关键词
  - 已选关键词列表展示
  - 底部：「开始分析」按钮（disabled 当无选中关键词时）
- 分析中显示 loading 状态
- 分析完成后关闭 dialog，触发 `onRegenerated` 刷新页面数据

### ReportViewer 修改

文件：`components/report-viewer.tsx`

- 在 header 区域的「重新生成」按钮旁加「定向分析」按钮
- 空状态下也显示「定向分析」按钮
- 需要传入 `categoryId` 对应的关键词列表（从 categories provider 获取）

## Part 4: 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `.env.local` | 修改 | LLM 配置指向 SiliconFlow |
| `lib/llm/openai.ts` | 修改 | 修复 URL 拼接，增加 json_schema fallback |
| `app/api/cron/daily-insights/route.ts` | 新增 | 每日定时分析端点 |
| `app/api/insights/generate-by-keyword/route.ts` | 新增 | 定向关键词分析端点 |
| `app/api/insights/generate/route.ts` | 修改 | 抽取 `pickNotesByKeywords` 函数供复用 |
| `components/keyword-analysis-dialog.tsx` | 新增 | 定向分析弹窗组件 |
| `components/report-viewer.tsx` | 修改 | 添加定向分析按钮 |
| `lib/data/reports.ts` | 修改 | 新增 `generateByKeyword` 客户端函数 |
