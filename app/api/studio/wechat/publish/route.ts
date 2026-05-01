import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  wechatAppid: string;
  title: string;
  content: string;
  summary?: string;
  coverImage?: string;
  author?: string;
  contentFormat?: 'markdown' | 'html';
  articleType?: 'news' | 'newspic';
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.WECHAT_API_KEY;
  const baseUrl = process.env.WECHAT_API_BASE_URL ?? 'https://wx.limyai.com/api/openapi';

  if (!apiKey) {
    return Response.json({ error: 'WECHAT_API_KEY not configured' }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.wechatAppid?.trim()) {
    return Response.json({ error: '请选择公众号' }, { status: 400 });
  }
  if (!body.title?.trim()) {
    return Response.json({ error: '标题不能为空' }, { status: 400 });
  }
  if (!body.content?.trim()) {
    return Response.json({ error: '内容不能为空' }, { status: 400 });
  }
  if (body.title.length > 64) {
    return Response.json({ error: '标题超过 64 字符' }, { status: 400 });
  }
  if (body.summary && body.summary.length > 120) {
    return Response.json({ error: '摘要超过 120 字符' }, { status: 400 });
  }

  const upstream = await fetch(`${baseUrl}/wechat-publish`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      wechatAppid: body.wechatAppid.trim(),
      title: body.title.trim(),
      content: body.content,
      summary: body.summary?.trim() || undefined,
      coverImage: body.coverImage?.trim() || undefined,
      author: body.author?.trim() || undefined,
      contentFormat: body.contentFormat ?? 'markdown',
      articleType: body.articleType ?? 'news',
    }),
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

  const isObj = (v: unknown): v is { success?: boolean; error?: string; message?: string; code?: string } =>
    typeof v === 'object' && v !== null;

  if (!upstream.ok || !isObj(parsed) || parsed.success !== true) {
    const err = isObj(parsed) ? parsed : null;
    return Response.json(
      {
        error: err?.error ?? err?.message ?? `HTTP ${upstream.status}`,
        code: err?.code,
        upstreamStatus: upstream.status,
      },
      { status: upstream.status || 502 },
    );
  }

  return Response.json(parsed);
}
