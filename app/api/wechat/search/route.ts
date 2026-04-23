import { NextResponse } from 'next/server'

export type WechatDatum = {
  avatar: string
  classify: string
  content: string
  ghid: string
  ip_wording: string
  is_original: number
  looking: number
  praise: number
  publish_time: number
  publish_time_str: string
  read: number
  short_link: string
  title: string
  update_time: number
  update_time_str: string
  url: string
  wx_id: string
  wx_name: string
}

type UpstreamResponse = {
  code: number
  data: { data: WechatDatum[]; data_number: number; page: number; total: number; total_page: number }
  msg: string
  requestId: string
}

export async function POST(req: Request) {
  const apiKey = process.env.WECHAT_SEARCH_API_KEY
  const apiUrl = process.env.WECHAT_SEARCH_API_URL
  if (!apiKey || !apiUrl) {
    return NextResponse.json(
      { error: 'WECHAT_SEARCH_API_KEY or WECHAT_SEARCH_API_URL not configured' },
      { status: 500 }
    )
  }

  let body: { keyword?: string; period?: number; page?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const keyword = (body.keyword ?? '').trim()
  if (!keyword) {
    return NextResponse.json({ error: 'Missing keyword' }, { status: 400 })
  }

  const payload = {
    kw: keyword,
    sort_type: 1,
    mode: 1,
    period: body.period ?? 7,
    page: body.page ?? 1,
    any_kw: '',
    ex_kw: '',
    verifycode: '',
    type: 1,
  }

  try {
    const upstream = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return NextResponse.json(
        { error: `Upstream ${upstream.status}`, detail: text.slice(0, 500) },
        { status: 502 }
      )
    }

    const json = (await upstream.json()) as UpstreamResponse
    if (json.code !== 0 && json.code !== 200) {
      return NextResponse.json(
        { error: `Upstream code=${json.code}`, msg: json.msg },
        { status: 502 }
      )
    }

    return NextResponse.json({ items: json.data?.data ?? [], total: json.data?.total ?? 0 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'Upstream fetch failed', detail: msg }, { status: 502 })
  }
}
