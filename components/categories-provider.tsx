'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { Category, MonitorSettings } from '@/lib/types'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'
import { today } from '@/lib/utils/dates'

type Ctx = {
  categories: Category[]
  getById: (id: string) => Category | undefined
  addCategory: (name: string) => Category
  updateSettings: (id: string, settings: MonitorSettings) => void
}

const CategoriesContext = createContext<Ctx | null>(null)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(CATEGORIES_SEED)

  const getById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories]
  )

  const addCategory = useCallback((name: string): Category => {
    const id = `cat-${Date.now()}`
    const created: Category = {
      id,
      name,
      createdAt: today(),
      settings: {
        platforms: ['douyin', 'xiaohongshu', 'weibo', 'bilibili'],
        keywords: [],
        accounts: [],
      },
    }
    setCategories((prev) => [...prev, created])
    return created
  }, [])

  const updateSettings = useCallback((id: string, settings: MonitorSettings) => {
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, settings } : c))
    )
  }, [])

  return (
    <CategoriesContext.Provider value={{ categories, getById, addCategory, updateSettings }}>
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories(): Ctx {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used inside <CategoriesProvider>')
  return ctx
}
