import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import { createCategory } from '@/lib/db/categories'
import {
  logQuerySuccess, logQueryError, listQueries, getQueryWithNotes,
} from '@/lib/db/queries'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
})

function seedNote(id: string, categoryId: string) {
  db.prepare(`
    INSERT INTO collected_notes
      (id, category_id, platform, keyword, title, summary, author, url,
       published_at, collected_at, likes, views, hot_score)
    VALUES (?, ?, 'xiaohongshu', 'kw', 'T', 'S', 'A', 'http://x',
            '2026-04-25', '2026-04-25', 100, 200, 80)
  `).run(id, categoryId)
}

describe('queries DB', () => {
  it('logQuerySuccess 单事务写 keyword_queries + query_notes', () => {
    const c = createCategory(db, { name: 'C', color: '#000' })
    seedNote('n1', c.id)
    seedNote('n2', c.id)
    const queryId = logQuerySuccess(db, {
      categoryId: c.id,
      keyword: 'kw',
      platform: 'xiaohongshu',
      startedAt: '2026-04-25T10:00:00.000Z',
      finishedAt: '2026-04-25T10:00:04.000Z',
      notes: [
        { noteId: 'n1', hotScore: 80, likes: 100, comments: 5, views: 200 },
        { noteId: 'n2', hotScore: 60, likes: 50, comments: null, views: 100 },
      ],
    })
    expect(queryId).toBeGreaterThan(0)

    const queries = listQueries(db, { categoryId: c.id })
    expect(queries.items).toHaveLength(1)
    expect(queries.items[0].returnedCount).toBe(2)
    expect(queries.items[0].status).toBe('success')

    const detail = getQueryWithNotes(db, queryId)!
    expect(detail.notes).toHaveLength(2)
    expect(detail.notes.find((n) => n.id === 'n1')?.snapshot.hotScore).toBe(80)
  })

  it('logQueryError 写 status=error,无 query_notes', () => {
    const c = createCategory(db, { name: 'C', color: '#000' })
    const id = logQueryError(db, {
      categoryId: c.id,
      keyword: 'kw',
      platform: 'xiaohongshu',
      startedAt: '2026-04-25T10:00:00.000Z',
      finishedAt: '2026-04-25T10:00:01.000Z',
      errorMessage: '账户积分用尽',
    })
    const detail = getQueryWithNotes(db, id)!
    expect(detail.query.status).toBe('error')
    expect(detail.query.errorMessage).toBe('账户积分用尽')
    expect(detail.notes).toEqual([])
  })

  it('listQueries 支持 keyword / platform / status 过滤', () => {
    const c = createCategory(db, { name: 'C', color: '#000' })
    logQueryError(db, { categoryId: c.id, keyword: 'a', platform: 'xiaohongshu',
      startedAt: '2026-04-25T10:00:00.000Z', finishedAt: '2026-04-25T10:00:01.000Z',
      errorMessage: 'e1' })
    logQueryError(db, { categoryId: c.id, keyword: 'b', platform: 'wechat',
      startedAt: '2026-04-25T10:00:02.000Z', finishedAt: '2026-04-25T10:00:03.000Z',
      errorMessage: 'e2' })
    expect(listQueries(db, { categoryId: c.id, keyword: 'a' }).items).toHaveLength(1)
    expect(listQueries(db, { categoryId: c.id, platform: 'wechat' }).items).toHaveLength(1)
    expect(listQueries(db, { categoryId: c.id, status: 'error' }).items).toHaveLength(2)
  })

  it('listQueries 按 started_at DESC + 支持 cursor 分页', () => {
    const c = createCategory(db, { name: 'C', color: '#000' })
    for (let i = 0; i < 5; i++) {
      logQueryError(db, { categoryId: c.id, keyword: `k${i}`, platform: 'xiaohongshu',
        startedAt: `2026-04-25T10:00:0${i}.000Z`,
        finishedAt: `2026-04-25T10:00:0${i}.500Z`, errorMessage: 'e' })
    }
    const page1 = listQueries(db, { categoryId: c.id, limit: 2 })
    expect(page1.items.map((q) => q.keyword)).toEqual(['k4', 'k3'])
    expect(page1.nextCursor).toBeDefined()
    const page2 = listQueries(db, { categoryId: c.id, limit: 2, cursor: page1.nextCursor })
    expect(page2.items.map((q) => q.keyword)).toEqual(['k2', 'k1'])
  })
})
