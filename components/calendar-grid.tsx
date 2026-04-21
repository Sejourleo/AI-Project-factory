'use client'

import { useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PLATFORMS, type Platform } from '@/lib/types'
import { getMonthCells, type MonthCell } from '@/lib/data/contents'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

export function CalendarGrid({
  categoryId,
  value,
  onChange,
}: {
  categoryId: string
  value: string
  onChange: (date: string) => void
}) {
  const [cursor, setCursor] = useState(() => dayjs(value).startOf('month'))
  const [cells, setCells] = useState<MonthCell[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getMonthCells(categoryId, cursor.year(), cursor.month() + 1).then((r) => {
      if (!cancelled) {
        setCells(r)
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [categoryId, cursor])

  const cellByDate = useMemo(() => {
    const m = new Map<string, MonthCell>()
    for (const c of cells) m.set(c.date, c)
    return m
  }, [cells])

  const todayStr = dayjs().format('YYYY-MM-DD')
  const firstDow = (cursor.day() + 6) % 7 // Mon=0..Sun=6
  const daysInMonth = cursor.daysInMonth()
  const cellCount = Math.ceil((firstDow + daysInMonth) / 7) * 7

  function goPrev() { setCursor((c) => c.subtract(1, 'month')) }
  function goNext() { setCursor((c) => c.add(1, 'month')) }
  function goToday() {
    const t = dayjs()
    setCursor(t.startOf('month'))
    onChange(t.format('YYYY-MM-DD'))
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-[0_1px_3px_0_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            {cursor.format('YYYY 年 M 月')}
          </h2>
          <button
            onClick={goToday}
            className="text-xs text-neutral-500 hover:text-neutral-900 px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors"
          >
            今天
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={goPrev}
            className="size-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            aria-label="上个月"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={goNext}
            className="size-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition-colors"
            aria-label="下个月"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] text-neutral-400 py-1.5">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: cellCount }).map((_, idx) => {
          const dayNum = idx - firstDow + 1
          if (dayNum < 1 || dayNum > daysInMonth) {
            return <div key={idx} className="aspect-square" />
          }
          const date = cursor.date(dayNum).format('YYYY-MM-DD')
          const cell = cellByDate.get(date)
          const active = date === value
          const isToday = date === todayStr
          const empty = !cell || cell.count === 0

          return (
            <button
              key={idx}
              onClick={() => onChange(date)}
              className={cn(
                'aspect-square rounded-lg p-1.5 flex flex-col transition-colors relative text-left',
                active
                  ? 'bg-neutral-900 text-white'
                  : empty
                    ? 'text-neutral-300 hover:bg-neutral-50'
                    : 'text-neutral-700 hover:bg-neutral-50'
              )}
            >
              <span className={cn(
                'text-xs leading-none',
                active ? 'font-semibold' : isToday ? 'font-semibold text-neutral-900' : ''
              )}>
                {dayNum}
              </span>
              {cell && cell.count > 0 && (
                <div className="mt-auto flex items-center gap-[2px]">
                  {PLATFORMS.map((p) => {
                    const n = cell.platforms[p.id as Platform]
                    if (n === 0) {
                      return (
                        <span
                          key={p.id}
                          className={cn(
                            'flex-1 h-4 rounded-sm',
                            active ? 'bg-white/15' : 'bg-neutral-100'
                          )}
                        />
                      )
                    }
                    return (
                      <span
                        key={p.id}
                        className="flex-1 h-4 rounded-sm flex items-center justify-center text-[9px] font-medium leading-none text-white"
                        style={{ backgroundColor: active ? 'rgba(255,255,255,0.85)' : p.color, color: active ? '#111' : '#fff' }}
                      >
                        {n}
                      </span>
                    )
                  })}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between mt-5 pt-4 border-t border-neutral-100">
        <div className="flex items-center gap-4">
          {PLATFORMS.map((p) => (
            <div key={p.id} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-sm"
                style={{ backgroundColor: p.color }}
              />
              <span className="text-[11px] text-neutral-500">{p.name}</span>
            </div>
          ))}
        </div>
        <span className="text-[11px] text-neutral-400">
          {loading ? '加载中…' : '已选 ' + dayjs(value).format('M 月 D 日')}
        </span>
      </div>
    </div>
  )
}
