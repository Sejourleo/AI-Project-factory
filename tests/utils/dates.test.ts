import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { today, yesterday, pastNDays, formatDow } from '@/lib/utils/dates'

describe('dates utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-20T12:00:00Z'))
  })
  afterEach(() => vi.useRealTimers())

  it('today() 返回 YYYY-MM-DD 格式的今天', () => {
    expect(today()).toBe('2026-04-20')
  })

  it('yesterday() 返回昨天', () => {
    expect(yesterday()).toBe('2026-04-19')
  })

  it('pastNDays(14) 返回过去 14 天（含今天），按时间升序', () => {
    const days = pastNDays(14)
    expect(days).toHaveLength(14)
    expect(days[0]).toBe('2026-04-07')
    expect(days[13]).toBe('2026-04-20')
  })

  it('formatDow 对给定日期返回中文星期', () => {
    expect(formatDow('2026-04-20')).toBe('周一')
    expect(formatDow('2026-04-19')).toBe('周日')
  })
})
