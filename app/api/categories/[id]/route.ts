import { NextResponse } from 'next/server'
import {
  getCategoryById, updateCategoryName,
  updateCategoryAccounts, deleteCategory,
} from '@/lib/db/categories'
import type { MonitorSettings } from '@/lib/types'

export const runtime = 'nodejs'

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  let body: { name?: string; accounts?: MonitorSettings['accounts'] }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  if (!(await getCategoryById(id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (typeof body.name === 'string') {
    const trimmed = body.name.trim()
    if (!trimmed) return NextResponse.json({ error: 'Empty name' }, { status: 400 })
    await updateCategoryName(id, trimmed)
  }
  if (Array.isArray(body.accounts)) {
    await updateCategoryAccounts(id, body.accounts)
  }
  return NextResponse.json({ category: await getCategoryById(id) })
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params
  if (!(await getCategoryById(id))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  await deleteCategory(id)
  return NextResponse.json({ ok: true })
}
