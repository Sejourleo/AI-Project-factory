import type { LLMClient } from './client'

export function createAnthropicClient(opts: {
  baseUrl: string; apiKey: string; model: string
}): LLMClient {
  return {
    modelId: opts.model,
    async generateStructured<T>(args: {
      system: string; user: string
      schema: Record<string, unknown>; schemaName: string
      maxTokens?: number
      signal?: AbortSignal
    }): Promise<T> {
      const url = `${opts.baseUrl.replace(/\/$/, '')}/v1/messages`
      const res = await fetch(url, {
        method: 'POST',
        signal: args.signal ?? AbortSignal.timeout(60_000),
        headers: {
          'x-api-key': opts.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          system: args.system,
          messages: [{ role: 'user', content: args.user }],
          tools: [{
            name: args.schemaName,
            description: 'Return structured data per schema.',
            input_schema: args.schema,
          }],
          tool_choice: { type: 'tool', name: args.schemaName },
          max_tokens: args.maxTokens ?? 4096,
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`Anthropic HTTP ${res.status}: ${detail.slice(0, 200)}`)
      }
      const json = (await res.json()) as {
        content?: Array<{ type: string; name?: string; input?: unknown }>
      }
      const tool = json.content?.find((b) => b.type === 'tool_use')
      if (!tool || !tool.input) throw new Error('Anthropic: missing tool_use block')
      return tool.input as T
    },
  }
}
