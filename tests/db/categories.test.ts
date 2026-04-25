import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { applyMigrations } from '@/lib/db/client'
import {
  listCategories, createCategory, updateCategoryName,
  updateCategoryAccounts, deleteCategory, replaceKeywords,
  getCategoryById,
} from '@/lib/db/categories'

let db: Database.Database

beforeEach(() => {
  db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  applyMigrations(db)
})

describe('categories DB', () => {
  it('createCategory + listCategories 往返', () => {
    const created = createCategory(db, { name: '测试', color: '#abc' })
    expect(created.id).toMatch(/^cat-/)
    expect(created.name).toBe('测试')
    expect(created.settings.keywords).toEqual([])

    const list = listCategories(db)
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(created.id)
  })

  it('replaceKeywords 整体替换并按写入顺序保留', () => {
    const c = createCategory(db, { name: 'X', color: '#000' })
    replaceKeywords(db, c.id, [
      { value: 'a', platforms: ['xiaohongshu'] },
      { value: 'b', platforms: ['wechat', 'xiaohongshu'] },
    ])
    const got = getCategoryById(db, c.id)!
    expect(got.settings.keywords.map((k) => k.value)).toEqual(['a', 'b'])
    expect(got.settings.keywords[1].platforms).toEqual(['wechat', 'xiaohongshu'])

    replaceKeywords(db, c.id, [{ value: 'c', platforms: ['weibo'] }])
    const after = getCategoryById(db, c.id)!
    expect(after.settings.keywords.map((k) => k.value)).toEqual(['c'])
  })

  it('updateCategoryName 改名;updateCategoryAccounts 改账号', () => {
    const c = createCategory(db, { name: '原', color: '#000' })
    updateCategoryName(db, c.id, '新')
    expect(getCategoryById(db, c.id)?.name).toBe('新')

    updateCategoryAccounts(db, c.id, [
      { platform: 'weibo', handle: 'h', displayName: 'd' },
    ])
    expect(getCategoryById(db, c.id)?.settings.accounts).toHaveLength(1)
  })

  it('createCategory 同毫秒内连续调用不重复 id', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      ids.add(createCategory(db, { name: `c${i}`, color: '#000' }).id)
    }
    expect(ids.size).toBe(50)
  })

  it('deleteCategory 级联删 keyword_configs', () => {
    const c = createCategory(db, { name: 'D', color: '#000' })
    replaceKeywords(db, c.id, [{ value: 'k', platforms: ['xiaohongshu'] }])
    deleteCategory(db, c.id)
    const kw = db.prepare('SELECT count(*) as n FROM keyword_configs').get() as { n: number }
    expect(kw.n).toBe(0)
    expect(listCategories(db)).toHaveLength(0)
  })
})
