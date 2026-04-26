import { createOpenAIClient } from './openai'
import { createAnthropicClient } from './anthropic'

export interface LLMClient {
  generateStructured<T>(opts: {
    system: string
    user: string
    schema: Record<string, unknown>
    schemaName: string
    maxTokens?: number
  }): Promise<T>
  readonly modelId: string
}

export function getLLMClient(): LLMClient | null {
  const provider = process.env.LLM_PROVIDER
  const baseUrl = process.env.LLM_BASE_URL
  const apiKey = process.env.LLM_API_KEY
  const model = process.env.LLM_MODEL
  if (!provider || !baseUrl || !apiKey || !model) return null
  if (provider === 'openai') return createOpenAIClient({ baseUrl, apiKey, model })
  if (provider === 'anthropic') return createAnthropicClient({ baseUrl, apiKey, model })
  return null
}
