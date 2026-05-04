import { NextResponse } from 'next/server'
import { listCategories, createCategory } from '@/lib/db/categories'

export const runtime = 'nodejs'

export async function GET() {
  return NextResponse.json({ items: await listCategories() })
}

export async function POST(req: Request) {
  let body: { name?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'Missing name' }, { status: 400 })
  const created = await createCategory({ name })
  return NextResponse.json({ category: created }, { status: 201 })
}
