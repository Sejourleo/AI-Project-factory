import { db, ensureMigrated } from '@/lib/db/client'

let warmedUp = false

/**
 * Warm up the lib/db/client cache: run applyMigrations + seedIfEmpty once
 * so the next ensureMigrated() call within tests is a cache hit (no re-seed).
 * Must be called before any truncate, otherwise seed data leaks back.
 */
async function warmup(): Promise<void> {
  if (warmedUp) return
  await ensureMigrated()
  warmedUp = true
}

export async function ensureSchema(): Promise<void> {
  await warmup()
}

/**
 * 在每个测试 beforeEach 调一次，清空所有业务表。
 * RESTART IDENTITY 把 SERIAL/IDENTITY 重置为 1。
 * CASCADE 顺带处理依赖，避免顺序问题。
 */
export async function truncateAll(): Promise<void> {
  await warmup()
  await db.query(`
    TRUNCATE TABLE
      query_notes,
      keyword_queries,
      note_summaries,
      topic_insights,
      keyword_configs,
      collected_notes,
      categories
    RESTART IDENTITY CASCADE
  `)
}

/** alias for truncateAll */
export async function resetDb(): Promise<void> {
  await truncateAll()
}
