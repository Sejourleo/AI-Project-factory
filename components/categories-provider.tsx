'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { toast } from 'sonner'
import type { Category, MonitorSettings } from '@/lib/types'

type Ctx = {
  categories: Category[]
  hydrated: boolean
  getById: (id: string) => Category | undefined
  addCategory: (name: string) => Promise<Category | null>
  renameCategory: (id: string, name: string) => Promise<void>
  removeCategory: (id: string) => Promise<void>
  updateSettings: (id: string, settings: MonitorSettings) => Promise<void>
}

const CategoriesContext = createContext<Ctx | null>(null)

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let alive = true
    fetch('/api/categories', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { items: Category[] }) => {
        if (!alive) return
        setCategories(data.items ?? [])
        setHydrated(true)
      })
      .catch((err) => {
        console.warn('[categories] hydrate failed', err)
        if (alive) setHydrated(true)
      })
    return () => { alive = false }
  }, [])

  const getById = useCallback(
    (id: string) => categories.find((c) => c.id === id),
    [categories]
  )

  const addCategory = useCallback(async (name: string): Promise<Category | null> => {
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as { category: Category }
      setCategories((prev) => [...prev, json.category])
      return json.category
    } catch (err) {
      toast.error(`新建分类失败：${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  }, [])

  const renameCategory = useCallback(async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    const prev = categories
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, name: trimmed } : c)))
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      setCategories(prev)
      toast.error(`重命名失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }, [categories])

  const removeCategory = useCallback(async (id: string) => {
    const prev = categories
    setCategories((cs) => cs.filter((c) => c.id !== id))
    try {
      const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      setCategories(prev)
      toast.error(`删除失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }, [categories])

  const updateSettings = useCallback(async (id: string, settings: MonitorSettings) => {
    const prev = categories
    setCategories((cs) => cs.map((c) => (c.id === id ? { ...c, settings } : c)))
    try {
      const [r1, r2] = await Promise.all([
        fetch(`/api/categories/${id}/keywords`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keywords: settings.keywords }),
        }),
        fetch(`/api/categories/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accounts: settings.accounts }),
        }),
      ])
      if (!r1.ok || !r2.ok) throw new Error(`HTTP ${r1.status}/${r2.status}`)
    } catch (err) {
      setCategories(prev)
      toast.error(`保存失败：${err instanceof Error ? err.message : String(err)}`)
    }
  }, [categories])

  return (
    <CategoriesContext.Provider
      value={{ categories, hydrated, getById, addCategory, renameCategory, removeCategory, updateSettings }}
    >
      {children}
    </CategoriesContext.Provider>
  )
}

export function useCategories(): Ctx {
  const ctx = useContext(CategoriesContext)
  if (!ctx) throw new Error('useCategories must be used inside <CategoriesProvider>')
  return ctx
}
