import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const apiKey = process.env.WECHAT_API_KEY;
  const baseUrl = process.env.WECHAT_API_BASE_URL ?? 'https://wx.limyai.com/api/openapi';

  if (!apiKey) {
    return Response.json({ error: 'WECHAT_API_KEY not configured' }, { status: 500 });
  }

  const upstream = await fetch(`${baseUrl}/wechat-accounts`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    signal: req.signal,
  });

  const text = await upstream.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return Response.json(
      { error: `公众号接口返回非 JSON：${text.slice(0, 300)}` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const err = parsed as { error?: string; message?: string } | null;
    return Response.json(
      { error: err?.error ?? err?.message ?? `HTTP ${upstream.status}`, upstreamStatus: upstream.status },
      { status: upstream.status },
    );
  }

  return Response.json(parsed);
}
