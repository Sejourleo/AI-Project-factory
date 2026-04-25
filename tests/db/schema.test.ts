import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'

describe('db schema', () => {
  it('applyMigrations 创建所有表', () => {
    const db = new Database(':memory:')
    applyMigrations(db)
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as Array<{ name: string }>
    const names = tables.map((t) => t.name)
    expect(names).toEqual(expect.arrayContaining([
      'categories',
      'collected_notes',
      'keyword_configs',
      'keyword_queries',
      'query_notes',
    ]))
  })

  it('外键级联:删除 category 自动清 keyword_configs / keyword_queries / query_notes', () => {
    const db = new Database(':memory:')
    db.pragma('foreign_keys = ON')
    applyMigrations(db)
    db.prepare(`INSERT INTO categories (id, name, color, created_at) VALUES (?,?,?,?)`)
      .run('c1', '测', '#000', '2026-04-25')
    db.prepare(`INSERT INTO keyword_configs (category_id, value, platforms, created_at) VALUES (?,?,?,?)`)
      .run('c1', 'kw', '[]', '2026-04-25')
    db.prepare(`DELETE FROM categories WHERE id = ?`).run('c1')
    const cnt = db.prepare(`SELECT count(*) as n FROM keyword_configs`).get() as { n: number }
    expect(cnt.n).toBe(0)
  })
})
