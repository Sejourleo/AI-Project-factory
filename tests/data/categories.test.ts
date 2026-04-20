import { describe, it, expect } from 'vitest'
import { getInitialCategories, getCategoryByIdFromSeed } from '@/lib/data/categories'

describe('categories data access', () => {
  it('getInitialCategories 返回预置分类', async () => {
    const categories = await getInitialCategories()
    expect(categories.length).toBeGreaterThanOrEqual(3)
    expect(categories.map((c) => c.id)).toContain('claudecode')
  })

  it('getCategoryByIdFromSeed 命中返回对应分类，未命中返回 undefined', async () => {
    const hit = await getCategoryByIdFromSeed('claudecode')
    expect(hit?.name).toBe('ClaudeCode 选题监控')
    const miss = await getCategoryByIdFromSeed('nonexistent')
    expect(miss).toBeUndefined()
  })
})
