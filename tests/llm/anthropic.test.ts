import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createAnthropicClient } from '@/lib/llm/anthropic'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('Anthropic LLM client', () => {
  it('POST /v1/messages with tool_use forced', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      content: [{ type: 'tool_use', name: 'demo', input: { ok: true, n: 5 } }],
    }), { status: 200 }))

    const client = createAnthropicClient({
      baseUrl: 'https://api.anthropic.com',
      apiKey: 'sk-ant-x',
      model: 'claude-x',
    })
    const out = await client.generateStructured<{ ok: boolean; n: number }>({
      system: 'sys', user: 'usr',
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, n: { type: 'number' } }, required: ['ok','n'] },
      schemaName: 'demo',
    })
    expect(out).toEqual({ ok: true, n: 5 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.anthropic.com/v1/messages')
    expect((init as RequestInit).headers).toMatchObject({
      'x-api-key': 'sk-ant-x',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('claude-x')
    expect(body.system).toBe('sys')
    expect(body.messages).toEqual([{ role: 'user', content: 'usr' }])
    expect(body.tools).toHaveLength(1)
    expect(body.tools[0].name).toBe('demo')
    expect(body.tools[0].input_schema).toBeDefined()
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'demo' })
  })

  it('throws when content lacks tool_use block', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      content: [{ type: 'text', text: 'oops' }],
    }), { status: 200 }))
    const client = createAnthropicClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await expect(client.generateStructured({
      system: 's', user: 'u', schema: {}, schemaName: 'n',
    })).rejects.toThrow(/tool_use/)
  })

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
    const client = createAnthropicClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await expect(client.generateStructured({
      system: 's', user: 'u', schema: {}, schemaName: 'n',
    })).rejects.toThrow(/429/)
  })

  it('forwards caller-supplied signal to fetch', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      content: [{ type: 'tool_use', name: 'n', input: { ok: true } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const controller = new AbortController()
    const client = createAnthropicClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await client.generateStructured({ system: 's', user: 'u', schema: {}, schemaName: 'n', signal: controller.signal })

    const [, init] = fetchMock.mock.calls[0]
    expect((init as RequestInit).signal).toBe(controller.signal)
  })

  it('defaults to a timeout signal when none supplied', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      content: [{ type: 'tool_use', name: 'n', input: { ok: true } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const client = createAnthropicClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await client.generateStructured({ system: 's', user: 'u', schema: {}, schemaName: 'n' })

    const [, init] = fetchMock.mock.calls[0]
    expect((init as RequestInit).signal).toBeInstanceOf(AbortSignal)
    expect((init as RequestInit).signal).not.toBeUndefined()
  })
})
