import { NextRequest } from 'next/server';
import type { Platform, PlatformSettings } from '@/lib/studio/types';
import { buildMessages } from '@/lib/studio/ai/prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RequestBody {
  platform: Platform;
  input: string;
  settings: PlatformSettings;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.SILICONFLOW_API_KEY;
  const baseUrl = process.env.SILICONFLOW_BASE_URL ?? 'https://api.siliconflow.cn/v1';
  const model = process.env.SILICONFLOW_MODEL ?? 'Pro/moonshotai/Kimi-K2-Instruct-0905';

  if (!apiKey) {
    return Response.json({ error: 'SILICONFLOW_API_KEY not configured' }, { status: 500 });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { platform, input, settings } = body;
  if (!input?.trim()) {
    return Response.json({ error: 'input required' }, { status: 400 });
  }
  if (platform !== 'wechat') {
    return Response.json({ error: `platform ${platform} not yet supported, currently only wechat` }, { status: 400 });
  }

  const messages = buildMessages({ platform, input, settings });

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: Math.max(512, Math.min(8192, Math.ceil(settings.maxLength / 1.5))),
    }),
    signal: req.signal,
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => '');
    return Response.json(
      { error: `SiliconFlow ${upstream.status}: ${errText.slice(0, 500)}` },
      { status: 502 },
    );
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
