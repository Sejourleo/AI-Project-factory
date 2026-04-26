import type { LLMClient } from './client'

export function createOpenAIClient(opts: {
  baseUrl: string; apiKey: string; model: string
}): LLMClient {
  return {
    modelId: opts.model,
    async generateStructured<T>(args: {
      system: string; user: string
      schema: Record<string, unknown>; schemaName: string
      maxTokens?: number
    }): Promise<T> {
      const url = `${opts.baseUrl.replace(/\/$/, '')}/v1/chat/completions`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: 'system', content: args.system },
            { role: 'user', content: args.user },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: args.schemaName, schema: args.schema, strict: true },
          },
          max_tokens: args.maxTokens ?? 4096,
        }),
      })
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        throw new Error(`OpenAI HTTP ${res.status}: ${detail.slice(0, 200)}`)
      }
      const json = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = json.choices?.[0]?.message?.content
      if (!content) throw new Error('OpenAI: empty content')
      return JSON.parse(content) as T
    },
  }
}
