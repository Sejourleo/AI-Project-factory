'use client'

import Image from 'next/image'
import { Heart, MessageCircle, Share2 } from 'lucide-react'
import dayjs from 'dayjs'
import { PLATFORMS, type ContentItem } from '@/lib/types'

function fmtNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}w`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

export function ContentCard({ item }: { item: ContentItem }) {
  const platform = PLATFORMS.find((p) => p.id === item.platform)

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white rounded-xl overflow-hidden flex flex-col transition-shadow hover:shadow-[0_4px_16px_0_rgba(0,0,0,0.06)]"
    >
      <div className="relative aspect-video bg-neutral-100">
        {item.coverImage ? (
          <Image
            src={item.coverImage}
            alt=""
            fill
            sizes="(max-width: 1280px) 50vw, 33vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-neutral-400 text-xs">
            {platform?.name}
          </div>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1.5 bg-white/90 backdrop-blur px-2 py-0.5 rounded-full">
          <span
            className="size-1.5 rounded-full"
            style={{ backgroundColor: platform?.color }}
          />
          <span className="text-[10px] text-neutral-700 font-medium">
            {platform?.name}
          </span>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2.5 flex-1 min-w-0">
        <h3 className="text-sm text-neutral-900 line-clamp-2 leading-snug">
          {item.title}
        </h3>
        <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 truncate">
          <span className="truncate">@{item.author}</span>
          <span>·</span>
          <span>{dayjs(item.publishedAt).format('HH:mm')}</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-neutral-500">
          <span className="flex items-center gap-1"><Heart size={11} />{fmtNum(item.stats.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle size={11} />{fmtNum(item.stats.comments)}</span>
          <span className="flex items-center gap-1"><Share2 size={11} />{fmtNum(item.stats.shares)}</span>
        </div>
        <div className="text-[10px] text-neutral-400 truncate pt-1">
          对标{item.matchedBy.type === 'keyword' ? '关键词' : '博主'} · {item.matchedBy.value}
        </div>
      </div>
    </a>
  )
}
