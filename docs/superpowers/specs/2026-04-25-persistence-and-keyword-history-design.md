# 持久化 + 关键词查询历史 设计文档

**日期:** 2026-04-25
**状态:** 已与用户确认,待落实施计划

## 目标

将目前只存在于 React state 的"分类 / 关键词配置"持久化到 SQLite,并新增"关键词查询历史"功能——每次刷新数据时记录查询事件,用户可在分类下的新 Tab 里回看历史关键词、当时抓到的选题以及热度快照。

## 背景:当前持久化状态

- ✅ 小红书笔记 → SQLite (`collected_notes` 表,含 raw JSON)
- ❌ 分类 / 关键词配置 / 平台设置 → 只在 `CategoriesProvider` 的 React state,硬刷新回到 `CATEGORIES_SEED` 种子
- ❌ 公众号文章 → 只有内存 5 分钟缓存,未落库
- ❌ 关键词查询历史 → 完全没记录

## 架构

在已有的 Node runtime + better-sqlite3 栈上叠加:新增 3 张表(`categories`, `keyword_configs`, `keyword_queries`, `query_notes`)并复用 `collected_notes`。分类/关键词改为服务端源真实、前端首屏水合、写操作走新增 API 路由。"查询历史" 作为 `/c/[id]/history` 新 Tab 呈现,详情页通过 `query_id` 懒加载该次命中的笔记及其热度快照。

## 一、数据模型

### 新表

```sql
-- 分类,代替 fixture seed
CREATE TABLE categories (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  created_at TEXT NOT NULL,
  accounts   TEXT NOT NULL DEFAULT '[]'  -- JSON: Array<{platform, handle, displayName}>
);

-- 分类下的关键词配置
CREATE TABLE keyword_configs (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  value       TEXT NOT NULL,
  platforms   TEXT NOT NULL,            -- JSON: Platform[]
  created_at  TEXT NOT NULL,
  UNIQUE(category_id, value)
);
CREATE INDEX idx_keyword_configs_category ON keyword_configs(category_id);

-- 每次"刷新"= 1 行(单关键词 × 单平台);"全部更新"展开为多条
CREATE TABLE keyword_queries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id    TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  keyword        TEXT NOT NULL,
  platform       TEXT NOT NULL,         -- 'xiaohongshu' | 'wechat' | ...
  started_at     TEXT NOT NULL,
  finished_at    TEXT,
  status         TEXT NOT NULL,         -- 'success' | 'error'
  returned_count INTEGER NOT NULL DEFAULT 0,
  error_message  TEXT
);
CREATE INDEX idx_queries_category_started ON keyword_queries(category_id, started_at DESC);

-- 事件 ↔ 笔记 N:M;热度快照冻结"当时的样子"
CREATE TABLE query_notes (
  query_id          INTEGER NOT NULL REFERENCES keyword_queries(id) ON DELETE CASCADE,
  note_id           TEXT NOT NULL REFERENCES collected_notes(id),
  hot_score_snapshot INTEGER,
  likes_snapshot     INTEGER,
  comments_snapshot  INTEGER,
  views_snapshot     INTEGER,
  PRIMARY KEY (query_id, note_id)
);
CREATE INDEX idx_query_notes_note ON query_notes(note_id);
```

### `collected_notes` 不动

已有列足够容纳 wechat。xhs 专属字段在 wechat 行为 `null`。

### Wechat → collected_notes 字段映射

| collected_notes | Wechat 源字段 | 说明 |
|---|---|---|
| `id` | `wechat-${sha1(url).slice(0,16)}` | url 是稳定唯一键 |
| `platform` | `'wechat'` | |
| `keyword` | 查询时的关键词 | |
| `title` | `title` | |
| `summary` | `content.slice(0,200)` | |
| `author` | `wx_name` | |
| `author_id` | `wx_id` | |
| `author_avatar` | `avatar` | |
| `author_red_id` | `NULL` | xhs 专属 |
| `url` | `url`(fallback `short_link`) | |
| `cover_image` | `NULL` | wechat search 不返回封面 |
| `published_at` | `new Date(publish_time*1000).toISOString()` | |
| `likes` | `praise` | |
| `comments` | `NULL` | wechat 不提供 |
| `shares` | `NULL` | |
| `views` | `read` | |
| `hot_score` | 复用 `hotScoreOf(praise, 0, 0)`——wechat 无评论/收藏,`hotScoreOf` 公式自然退化 | |
| `tags` | `JSON.stringify([classify].filter(Boolean))` | |
| `raw` | 整条原始 JSON | |

### 快照字段的意义

`query_notes.hot_score_snapshot` + `likes/comments/views_snapshot`:笔记本体只保留最新副本(upsert),但历史视图需要"我当时看到的数字"。四个快照列够用且便宜。

## 二、API 层

### 新增路由

```
GET    /api/categories                 → 首屏 hydrate,返回 Category[] 含 keywords
POST   /api/categories                 → body: { name } → 新建 + 默认色
PATCH  /api/categories/[id]            → body: { name?, accounts? }
DELETE /api/categories/[id]            → 级联删关键词/事件/query_notes
PUT    /api/categories/[id]/keywords   → body: { keywords: KeywordConfig[] },整体替换

GET    /api/queries?categoryId=&keyword=&platform=&status=&limit=50&cursor=
  → { items: Array<QuerySummary>, nextCursor?: string }
GET    /api/queries/[id]                 → { query: Query, notes: NoteWithSnapshot[] }
```

### 扩展现有路由

- `POST /api/xhs/collect`:在现有 upsert 基础上,包一层
  ```
  startedAt = now
  1. 调上游 + retry(现有逻辑不变)
  2. 单个 db.transaction:
     a. 对每条命中笔记 upsert collected_notes
     b. INSERT keyword_queries(started_at=startedAt, finished_at=now,
                                status='success', returned_count=N)
     c. 对每条命中 INSERT query_notes(query_id=last_insert_rowid,
                                       note_id, hot_score_snapshot, ...)
  失败分支:事务里只写一条 keyword_queries(status='error', error_message),
          不写 query_notes。
  ```
  上游 HTTP 在事务外;DB 写入合并到一个事务,避免出现"有 query 但无 notes"或反之的中间态。
- `POST /api/wechat/search`:之前是纯代理,现在也落 `collected_notes` + 生成事件/quer_notes。路由结构和 xhs 一致。

### Provider 改造

- `CategoriesProvider` 首次 mount `useEffect` → fetch `/api/categories` → setState
- 所有现有 mutation(`addCategory` / `renameCategory` / `removeCategory` / `updateSettings`)改为"本地 setState(乐观) + 异步 fetch + catch 时 rollback + toast.error"
- 水合完成前的占位:渲染骨架屏或维持空数组(现代码已经能处理空 categories)

## 三、UI 线框图

### 3.1 Tab 栏

现有:`内容 · 选题分析 · 监控设置`
改为:`内容 · 查询历史 · 选题分析 · 监控设置`

### 3.2 查询历史页 `/c/[categoryId]/history`

```
内容 · 查询历史 · 选题分析 · 监控设置
─────────────────────────────────────────────────────────

[关键词 ▾ 全部]  [平台 ▾ 全部]  [状态 ▾ 全部]     更新数据 ↻
─────────────────────────────────────────────────────────
04-25  14:32   claude code  🔴 小红书   ✓  23 条  →
04-25  14:32   claude code  🟢 公众号   ✓  12 条  →
04-25  09:11   vibecoding   🔴 小红书   ✗  账户积分用尽
04-24  22:05   claude code  🔴 小红书   ✓  18 条  →
04-24  22:05   claude code  🟢 公众号   ✓   9 条  →
04-23  10:47   ai agent     🔴 小红书   ✓   0 条  →
                                          [ 加载更多 ]
```

- 时间按 `started_at DESC`
- 行 = 一次查询事件,点击整行跳 3.3
- 失败事件在数量位显示红色错误摘要,不可跳转
- 筛选项都是客户端 `useSearchParams`,走服务端 `GET /api/queries`
- 顶部"更新数据"按钮复用现有 `RefreshMenu` 组件

### 3.3 查询详情页 `/c/[categoryId]/history/[queryId]`

```
← 返回历史

claude code · 🔴 小红书 · 04-25 14:32
抓到 23 条 · 用时 4.2s
─────────────────────────────────────────────────────────
[ 只看本次 ✓ ]  [ 对比最新 ]  排序: 当时热度 ▾
─────────────────────────────────────────────────────────
┌────────┐ 标题 …………………………………………
│ cover  │ 作者 · 当时热度 87 · 现在 92
└────────┘ 点赞 1.2k · 评论 86 · 收藏 345
           [ 打开原文 ]

┌────────┐ 标题 ……
│  …     │
└────────┘
```

- "只看本次" = 只展示 `query_notes` 里的 note,热度/点赞用快照列
- "对比最新" = toggle 改用 `collected_notes` 当前数值;同一张卡同时并列两数("当时 87 → 现在 92")
- 卡片复用现有 `ContentGrid` 的卡片样式(新增 props 支持 snapshot/current 双数据源)

### 3.4 不改动

- 侧边栏分类右键"重命名/删除"已存在,在本次改造里只是让它真的写 DB
- 现有「内容」Tab 不动,仍按当前逻辑展示最新笔记

## 四、迁移 / 边界

1. **首次启动 seed:** `db.get('SELECT count(*) FROM categories')` === 0 时,事务插入 `CATEGORIES_SEED` 的 3 条 + 对应 keyword_configs。已有数据库不被覆写。
2. **历史 collected_notes 回填:** 之前(未接入新路由时)采集的小红书笔记没有 `query_id` 关联,**不伪造**。只从新路由上线后的查询开始记录。老笔记仍在「内容」Tab 可见。
3. **保留策略:** 初版无上限。未来裁剪:`DELETE FROM keyword_queries WHERE started_at < now-90d`(`query_notes` 通过 `ON DELETE CASCADE` 一起清)。
4. **去抖:** 同一 `(category_id, keyword, platform)` 5s 内重复点击 → 短路第二次,避免重复建事件。复用 `lib/data/*.ts` 里现有的 `inflight` Map 模式。
5. **失败事件的快照:** 业务失败(如 QUOTA_EXCEEDED)仍写入 `keyword_queries` 一条 status='error' 行,`query_notes` 为空。便于查"这个关键词今天刷过几次全失败了"。

## 五、验收清单

- [ ] 硬刷新浏览器后,自建分类/关键词/平台配置不丢
- [ ] 右键重命名/删除分类,重启 dev 服务器后状态保持
- [ ] 任一次"更新数据"点击会在「查询历史」Tab 出现新行
- [ ] 失败的刷新也出现在历史,显示错误摘要
- [ ] 查询详情页"只看本次"展示快照热度;"对比最新"显示"当时→现在"
- [ ] 公众号搜到的文章能在「内容」Tab 看到(对齐小红书)
- [ ] 种子分类在空 DB 场景下仍然自动出现,非空 DB 不被覆写
- [ ] 删除分类会级联清掉 keywords / queries / query_notes

## 非目标

- 不做"跨分类全局查询历史"视图(留给未来)
- 不做历史事件的手动编辑/补录
- 不做快照-现在的可视化 diff 页面(仅在卡片内显示两个数字)
- 不做保留策略的 UI 入口(需要时手跑 SQL)
