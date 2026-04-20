'use client'

import { useCategories } from '@/components/categories-provider'

export function CategoryName({ id, fallback }: { id: string; fallback?: string }) {
  const { getById } = useCategories()
  const cat = getById(id)
  return <>{cat?.name ?? fallback ?? '未知分类'}</>
}
