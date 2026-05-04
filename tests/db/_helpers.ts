import { db } from '@/lib/db/client'
import { applyMigrations } from '@/lib/db/migrations'

let migrated = false

export async function ensureSchema(): Promise<void> {
  if (migrated) return
  await applyMigrations()
  migrated = true
}

/**
 * 在每个测试 beforeEach 调一次，清空所有业务表。
 * RESTART IDENTITY 把 SERIAL/IDENTITY 重置为 1。
 * CASCADE 顺带处理依赖，避免顺序问题。
 */
export async function truncateAll(): Promise<void> {
  await ensureSchema()
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

/** 给测试用的"空 db" — 不调用 seedIfEmpty，留给测试自己造数据 */
export async function resetDb(): Promise<void> {
  await truncateAll()
}
