import type { Category } from '@/lib/types'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'

// 注意：分类的运行时状态由 CategoriesProvider Context 持有。
// 此处的函数用于读取"初始"分类数据（例如 SSR 场景或无 Context 的上下文）。
// TODO(api): 将来改为 fetch('/api/categories')

export async function getInitialCategories(): Promise<Category[]> {
  return CATEGORIES_SEED
}

export async function getCategoryByIdFromSeed(id: string): Promise<Category | undefined> {
  return CATEGORIES_SEED.find((c) => c.id === id)
}
