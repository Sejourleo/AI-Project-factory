import { createOpenAIClient } from './openai'
import { createAnthropicClient } from './anthropic'

export interface LLMClient {
  /**
   * Returns the model's structured output cast to T without runtime schema
   * validation. Callers must treat the result as untrusted: validate critical
   * fields before using.
   *
   * @param signal Optional AbortSignal. Defaults to a 60s timeout if not provided.
   */
  generateStructured<T>(opts: {
    system: string
    user: string
    schema: Record<string, unknown>
    schemaName: string
    maxTokens?: number
    signal?: AbortSignal
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
