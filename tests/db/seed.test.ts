import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import { seedIfEmpty } from '@/lib/db/seed'

function freshDb() {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
  return db
}

describe('seedIfEmpty', () => {
  it('空库 → 插入 3 条种子分类与关键词', () => {
    const db = freshDb()
    seedIfEmpty(db)
    const cats = db.prepare('SELECT id FROM categories ORDER BY id').all() as Array<{ id: string }>
    expect(cats.map((c) => c.id)).toEqual(['ai-product', 'claudecode', 'vibecoding'])
    const kwCount = db.prepare('SELECT count(*) as n FROM keyword_configs').get() as { n: number }
    expect(kwCount.n).toBeGreaterThanOrEqual(3)
  })

  it('再次调用幂等 → 不重复插入', () => {
    const db = freshDb()
    seedIfEmpty(db)
    seedIfEmpty(db)
    const cats = db.prepare('SELECT count(*) as n FROM categories').get() as { n: number }
    expect(cats.n).toBe(3)
  })

  it('已有分类 → 不动种子', () => {
    const db = freshDb()
    db.prepare(`INSERT INTO categories (id, name, color, created_at) VALUES (?,?,?,?)`)
      .run('custom', '自定义', '#000', '2026-04-25')
    seedIfEmpty(db)
    const cats = db.prepare('SELECT id FROM categories').all() as Array<{ id: string }>
    expect(cats.map((c) => c.id)).toEqual(['custom'])
  })
})
