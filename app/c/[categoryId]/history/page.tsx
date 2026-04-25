import { use } from 'react'
import { HistoryList } from '@/components/history-list'

export default function HistoryPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  return <HistoryList categoryId={categoryId} />
}
