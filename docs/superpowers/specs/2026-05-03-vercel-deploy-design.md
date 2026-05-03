# Vercel 部署改造设计

## 背景

合并后的项目「内容工厂」(monitor + studio) 当前用 `better-sqlite3` + 本地 `data/content.db` 文件作为采集 Agent 数据层。Vercel serverless 函数无法持久化文件系统，部署上去会丢所有写入。需要把 DB 层换成托管 Postgres，同时保证本地开发体验不退化。

## 目标

1. 采集 Agent 在 Vercel 上能完整跑通（categories / queries / insights / notes 全部能持久化）
2. 创作 Agent 在 Vercel 上零改动跑通
3. 本地 `npm run dev` 仍然可用，完全离线（除了第三方 LLM/API 调用）
4. 现有 13 条 monitor + 57 条 studio 测试全部通过
5. 代码托管到 `https://github.com/Sejourleo/AI-Project-factory`，main 分支即生产分支

## 非目标

- 不引入 ORM（Drizzle / Prisma），保持 raw SQL + 类型安全的轻量风格
- 不上 Vercel Cron（不付 Pro 费）；`/api/cron/daily-insights` 路由保留为手动触发端点
- 不迁移 SQLite 历史数据（原型阶段，本地数据无保留价值）
- 不改造 monitor / studio 任何业务逻辑、UI、API 形状
- 不改 studio 侧（无 DB 依赖）

## 架构选型

| 维度 | 选择 | 理由 |
|---|---|---|
| 数据库 | Vercel Postgres（Neon 后端） | 用户已确认（路径 1b）；Vercel 集成最丝滑 |
| 客户端 | `@vercel/postgres` + `sql\`...\`` 模板 | 官方推荐；零配置自动读 `POSTGRES_URL`；本地连任何 Postgres 也工作 |
| 本地 DB | Docker Compose `postgres:16` | 与生产同引擎，离线可用 |
| 测试 DB | 复用 Docker PG，每个 test file 用独立 schema 隔离 | 真 PG 行为，避免 mock 偏差 |
| 部署分支 | `main`（直接 push 当前 `feat/prototype` 内容覆盖远端空 main） | 用户偏好（更快） |

## 改动文件清单

### 新增
- `docker-compose.yml`（根目录，5432 端口暴露 postgres:16，volume 持久化）
- `lib/db/migrations.ts`（DDL 从 client.ts 抽出，便于 test setup 复用）
- `scripts/db-reset.sh`（dev 便利：drop public schema + 重建）

### 修改
- `lib/db/client.ts` — 重写：去 better-sqlite3，引入 `@vercel/postgres`；保留 `getDb()` / `applyMigrations()` / lazy seed 接口形状
- `lib/db/categories.ts` — SQL 改 PG 方言，参数 `?` → `$N`，去 `JSON.parse(accounts)` 改读 JSONB
- `lib/db/queries.ts` — 同上
- `lib/db/insights.ts` — 同上；JSON 字段（source_note_ids、insights）改 JSONB
- `lib/db/seed.ts` — `INSERT OR IGNORE` → `ON CONFLICT DO NOTHING`；时间戳生成方式
- `package.json` — 删 `better-sqlite3` + `@types/better-sqlite3`，加 `@vercel/postgres`
- `.gitignore` — 删 `data/` 条目；加 `postgres-data/` (Docker volume)
- `.env.example` — 加 `POSTGRES_URL` 占位
- `README.md` — 新增「本地数据库准备」段
- `tests/db/{schema,categories,queries,insights,insights-schema,seed}.test.ts` — 改用 PG，每个文件 setUp 独立 schema

### 删除
- `data/` 目录（含 `content.db`、`content.db-wal`、`content.db-shm`）
- `.gitignore` 中关于 SQLite 文件的条目（如有）

### 不动
- `app/` 全部 routes 和 pages（API 路由调用 `getDb()` / `lib/db/*` 函数，签名不变）
- `lib/data/` 数据访问层（它消费 `lib/db/`，签名不变）
- `lib/studio/` 整套创作 Agent
- `components/`、`app/(monitor)/`、`app/studio/`
- 其他配置文件

## DB 接口契约（保持不变）

`lib/db/*` 文件对外暴露的函数签名一律不变。例如：

```ts
// lib/db/categories.ts
export function listCategories(db: Database): Category[]
export function getCategory(db: Database, id: string): Category | null
export function upsertCategory(db: Database, c: Category): void
// ...
```

只改内部实现：把 `db.prepare(...).all(...)` 换成 `await sql\`...\``。**注意：所有函数变成 `async`**，调用方需要 await。这是不可避免的破坏性变化。

修改 caller 的位置（`app/api/...`、`lib/data/...`）需要：
- 凡是接 `listCategories(db, ...)` 等的地方改成 `await listCategories(db, ...)`
- 上层 API 路由 handler 早就是 async，无额外成本
- `lib/data/*.ts` 里的同步函数变成 async，需要在所有 page/component 用 await（实际上它们已经是 async，因为之前用 `Promise.resolve(syncResult)` 包过；可去掉包装）

## Schema 映射规则

| SQLite | Postgres |
|---|---|
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY` |
| `TEXT NOT NULL DEFAULT '[]'`（存 JSON） | `JSONB NOT NULL DEFAULT '[]'::jsonb` |
| `?` 占位符 | `$1`, `$2`, ... |
| `INSERT OR REPLACE` | `INSERT ... ON CONFLICT (...) DO UPDATE SET ...` |
| `INSERT OR IGNORE` | `INSERT ... ON CONFLICT DO NOTHING` |
| `datetime('now')` | `NOW()` 或 `CURRENT_TIMESTAMP` |
| `ON DELETE CASCADE` | 保留（兼容） |
| `CHECK (status IN (...))` | 保留（兼容） |
| `CREATE INDEX IF NOT EXISTS` | 保留（PG 9.5+ 兼容） |

时间字段类型保持为 `TEXT`（存 ISO-8601 字符串），避免 consumer 类型变化。

JSON 字段改为 `JSONB` 后，consumer 端：
- 读：直接拿到 object/array，不需要 `JSON.parse()`
- 写：`@vercel/postgres` 会自动把 JS object 序列化为 JSONB

## 本地 DB 启动方案

`docker-compose.yml`：

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: content-factory-pg
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: content_factory
    ports:
      - "5432:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dev -d content_factory"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres-data:
```

`.env.local` 增加：
```
POSTGRES_URL=postgres://dev:dev@localhost:5432/content_factory
```

启动顺序（README 写明）：
```bash
docker compose up -d        # 第一次，会拉镜像
npm run dev                 # 表会在首次 API 调用时由 applyMigrations() 自动建
```

## 测试隔离方案（方案 X）

每个 `tests/db/*.test.ts` 在 `beforeAll`：
1. 计算 schema 名 = `test_<file basename>`（如 `test_categories`）
2. `DROP SCHEMA IF EXISTS test_categories CASCADE`
3. `CREATE SCHEMA test_categories`
4. 在 schema 里跑 `applyMigrations()`
5. 测试函数里所有 SQL 走 `SET search_path TO test_categories`

`afterAll`：可选 drop schema（默认保留便于调试）。

抽出 `tests/db/_helpers.ts`：

```ts
export async function withTestSchema(name: string): Promise<TestDb> {
  // ... return { sql, cleanup }
}
```

测试运行依赖 `POSTGRES_URL` 环境变量；vitest config 不动，但 `tests/db` 测试要求 docker 已起。在 CI 上单独配 PG 服务（不在本任务范围）。

如果本地 PG 不可用，`tests/db/*` 测试会 fail-fast 给出明确错误（"无法连接 Postgres，请先 `docker compose up -d`"）—— 这是 `vitest.config.ts` 已分两个 project 的天然好处：`monitor` project 失败不影响 `studio` project。

## Cron 路由处理

保留 `app/api/cron/daily-insights/route.ts` 文件不动，但：
- 不在 `vercel.json` 写 cron schedule（也不创建 vercel.json）
- 路由用 `CRON_SECRET` 保护（已有逻辑）
- 用户需要触发时：
  ```bash
  curl -H "Authorization: Bearer $CRON_SECRET" https://<your-vercel-domain>/api/cron/daily-insights
  ```

## 部署流（用户在浏览器执行）

1. **代码 push**（我帮你做）：`git remote add origin ...` + `git push origin feat/prototype:main`
2. **Vercel 导入**：vercel.com → New Project → Import `Sejourleo/AI-Project-factory` → Framework `Next.js` 自动识别
3. **创建 Postgres**：项目 Storage tab → Create Database → Postgres → Create & Connect → 自动注入 `POSTGRES_URL` 等 6 个 env
4. **手填 9 个 env**（Settings → Environment Variables）：
   ```
   WECHAT_SEARCH_API_KEY        采集侧公众号搜索
   WECHAT_SEARCH_API_URL
   LLM_PROVIDER                 采集侧 insights
   LLM_BASE_URL
   LLM_API_KEY
   LLM_MODEL
   SILICONFLOW_API_KEY          创作侧生成
   SILICONFLOW_BASE_URL
   SILICONFLOW_MODEL
   WECHAT_API_KEY               创作侧公众号发布
   WECHAT_API_BASE_URL
   CRON_SECRET                  保护 cron 端点（自定一段随机字符串）
   ```
5. **触发 Deploy**（首次 push 后会自动；或 Vercel UI 点 Redeploy）
6. **烟雾测试**（我帮你写一份 curl 清单）：访问 `/`、`/studio`、`/api/categories`、`/api/studio/wechat/accounts` 等

## 验收标准

1. 本地 `docker compose up -d && npm run dev` 启动后两个 Agent 在浏览器内可独立完成各自核心动线
2. `npm run test` 通过：包括迁移后的全部 monitor + studio 测试（前提 docker PG 已起）
3. `npm run build` 通过
4. GitHub `main` 分支有合并后的代码
5. Vercel 上访问 `/c/<id>/content` 看得到 seed 进去的 6 个分类
6. Vercel 上访问 `/studio` 能打开创作首页
7. POST `/api/categories` + 后续 GET 数据持久（关掉 deployment 重启后仍在）
8. 创作侧 `POST /api/studio/wechat/accounts` 能拉到真实公众号账号

## 风险与缓解

| 风险 | 缓解 |
|---|---|
| Vercel Postgres 免费额度撑不住 | 先观察；超了直接迁 Neon 直连（一份连接串切换） |
| `applyMigrations()` 在 serverless 冷启动反复调用 | DDL 全部 `IF NOT EXISTS`，幂等无副作用 |
| 现有 caller 漏改 await，运行期 `Promise<Category[]>` 当数组用 | tsc 严格模式拦截，编译期暴露 |
| 本地 docker 没装/没起 → npm run test 报连接错误 | README 明确指引；测试给清晰错误消息 |
| `INTEGER GENERATED ALWAYS AS IDENTITY` 在某些 PG 版本不支持 | Vercel Postgres / Postgres 16 都支持；fallback `SERIAL` 同义可用 |
| `JSONB` 字段反序列化的边界——若库返回字符串而非 object | `@vercel/postgres` 默认会把 JSONB 反序列化为 JS 值，单元测试会捕获 |

## 待办

完成本 spec 后进 `writing-plans` 生成详细任务拆分。
