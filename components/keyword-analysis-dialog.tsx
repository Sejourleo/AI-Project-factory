'use client'

import { useState } from 'react'
import { Search, Plus, X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader,
  DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { generateByKeyword } from '@/lib/data/reports'
import { cn } from '@/lib/utils'

export function KeywordAnalysisDialog({
  categoryId,
  configuredKeywords,
  onGenerated,
}: {
  categoryId: string
  configuredKeywords: string[]
  onGenerated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [customInput, setCustomInput] = useState('')
  const [customKeywords, setCustomKeywords] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)

  function reset() {
    setSelected(new Set())
    setCustomInput('')
    setCustomKeywords([])
  }

  function toggleKeyword(kw: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(kw)) next.delete(kw)
      else next.add(kw)
      return next
    })
  }

  function addCustom() {
    const v = customInput.trim()
    if (!v) return
    if (selected.has(v) || customKeywords.includes(v)) return
    setCustomKeywords((prev) => [...prev, v])
    setSelected((prev) => new Set(prev).add(v))
    setCustomInput('')
  }

  function removeCustom(kw: string) {
    setCustomKeywords((prev) => prev.filter((k) => k !== kw))
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(kw)
      return next
    })
  }

  const allSelected = Array.from(selected)

  async function handleAnalyze() {
    if (allSelected.length === 0) return
    setAnalyzing(true)
    const r = await generateByKeyword(categoryId, allSelected)
    setAnalyzing(false)
    if (!r.ok) {
      toast.error(`分析失败：${r.error}`)
      return
    }
    toast.success(`已生成 ${r.insightsCount} 条洞察（基于 ${r.sourceCount} 篇笔记）`)
    setOpen(false)
    reset()
    onGenerated()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => { setOpen(v); if (!v) reset() }}
    >
      <DialogTrigger
        render={
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70 transition-colors" />
        }
      >
        <Search size={13} />
        定向分析
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>定向关键词分析</DialogTitle>
          <DialogDescription>
            选择或输入关键词，针对性地生成选题洞察
          </DialogDescription>
        </DialogHeader>

        {configuredKeywords.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-neutral-500">已配置的关键词</p>
            <div className="flex flex-wrap gap-1.5">
              {configuredKeywords.map((kw) => (
                <button
                  key={kw}
                  onClick={() => toggleKeyword(kw)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-md border transition-colors',
                    selected.has(kw)
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                  )}
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs text-neutral-500">自定义关键词</p>
          <div className="flex gap-2">
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
              placeholder="输入关键词按回车添加"
              className="text-sm"
            />
            <Button variant="outline" size="sm" onClick={addCustom} disabled={!customInput.trim()}>
              <Plus size={14} />
            </Button>
          </div>
          {customKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {customKeywords.map((kw) => (
                <span
                  key={kw}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded-md bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {kw}
                  <button onClick={() => removeCustom(kw)} className="hover:text-blue-900">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleAnalyze}
            disabled={allSelected.length === 0 || analyzing}
            className={cn(analyzing && 'cursor-wait')}
          >
            {analyzing
              ? <><Loader2 size={14} className="animate-spin mr-1.5" />分析中…</>
              : <>开始分析（{allSelected.length} 个关键词）</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
