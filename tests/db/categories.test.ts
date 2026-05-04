import { describe, it, expect, beforeEach } from 'vitest'
import { sql } from '@/lib/db/client'
import {
  listCategories, createCategory, updateCategoryName,
  updateCategoryAccounts, deleteCategory, replaceKeywords,
  getCategoryById,
} from '@/lib/db/categories'
import { ensureSchema, truncateAll } from './_helpers'

beforeEach(async () => {
  await ensureSchema()
  await truncateAll()
})

describe('categories DB', () => {
  it('createCategory + listCategories 往返', async () => {
    const created = await createCategory({ name: '测试', color: '#abc' })
    expect(created.id).toMatch(/^cat-/)
    expect(created.name).toBe('测试')
    expect(created.settings.keywords).toEqual([])

    const list = await listCategories()
    expect(list).toHaveLength(1)
    expect(list[0].id).toBe(created.id)
  })

  it('replaceKeywords 整体替换并按写入顺序保留', async () => {
    const c = await createCategory({ name: 'X', color: '#000' })
    await replaceKeywords(c.id, [
      { value: 'a', platforms: ['xiaohongshu'] },
      { value: 'b', platforms: ['wechat', 'xiaohongshu'] },
    ])
    const got = (await getCategoryById(c.id))!
    expect(got.settings.keywords.map((k) => k.value)).toEqual(['a', 'b'])
    expect(got.settings.keywords[1].platforms).toEqual(['wechat', 'xiaohongshu'])

    await replaceKeywords(c.id, [{ value: 'c', platforms: ['weibo'] }])
    const after = (await getCategoryById(c.id))!
    expect(after.settings.keywords.map((k) => k.value)).toEqual(['c'])
  })

  it('updateCategoryName 改名;updateCategoryAccounts 改账号', async () => {
    const c = await createCategory({ name: '原', color: '#000' })
    await updateCategoryName(c.id, '新')
    expect((await getCategoryById(c.id))?.name).toBe('新')

    await updateCategoryAccounts(c.id, [
      { platform: 'weibo', handle: 'h', displayName: 'd' },
    ])
    expect((await getCategoryById(c.id))?.settings.accounts).toHaveLength(1)
  })

  it('createCategory 同毫秒内连续调用不重复 id', async () => {
    const ids = new Set<string>()
    for (let i = 0; i < 50; i++) {
      ids.add((await createCategory({ name: `c${i}`, color: '#000' })).id)
    }
    expect(ids.size).toBe(50)
  })

  it('deleteCategory 级联删 keyword_configs', async () => {
    const c = await createCategory({ name: 'D', color: '#000' })
    await replaceKeywords(c.id, [{ value: 'k', platforms: ['xiaohongshu'] }])
    await deleteCategory(c.id)
    const { rows } = await sql<{ n: number }>`SELECT count(*)::int AS n FROM keyword_configs`
    expect(rows[0].n).toBe(0)
    expect(await listCategories()).toHaveLength(0)
  })
})
