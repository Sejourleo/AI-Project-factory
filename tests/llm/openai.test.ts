import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createOpenAIClient } from '@/lib/llm/openai'

const fetchMock = vi.fn()
beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset() })
afterEach(() => { vi.unstubAllGlobals() })

describe('OpenAI-compatible LLM client', () => {
  it('POST /v1/chat/completions with response_format json_schema', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ ok: true, n: 5 }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const client = createOpenAIClient({
      baseUrl: 'https://api.example.com',
      apiKey: 'sk-x',
      model: 'gpt-test',
    })
    const result = await client.generateStructured<{ ok: boolean; n: number }>({
      system: 'sys', user: 'usr',
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, n: { type: 'number' } }, required: ['ok','n'] },
      schemaName: 'demo',
    })
    expect(result).toEqual({ ok: true, n: 5 })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example.com/v1/chat/completions')
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer sk-x',
      'Content-Type': 'application/json',
    })
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.model).toBe('gpt-test')
    expect(body.messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ])
    expect(body.response_format.type).toBe('json_schema')
    expect(body.response_format.json_schema.name).toBe('demo')
    expect(body.response_format.json_schema.strict).toBe(true)
  })

  it('throws on non-2xx', async () => {
    fetchMock.mockResolvedValueOnce(new Response('boom', { status: 500 }))
    const client = createOpenAIClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await expect(client.generateStructured({
      system: 's', user: 'u', schema: {}, schemaName: 'n',
    })).rejects.toThrow(/500/)
  })

  it('throws on invalid JSON content', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      choices: [{ message: { content: 'not json' } }],
    }), { status: 200 }))
    const client = createOpenAIClient({ baseUrl: 'https://x', apiKey: 'k', model: 'm' })
    await expect(client.generateStructured({
      system: 's', user: 'u', schema: {}, schemaName: 'n',
    })).rejects.toThrow()
  })
})
