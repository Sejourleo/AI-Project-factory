import { use } from 'react'
import { HistoryDetail } from '@/components/history-detail'

export default function HistoryDetailPage({
  params,
}: {
  params: Promise<{ categoryId: string; queryId: string }>
}) {
  const { categoryId, queryId } = use(params)
  return <HistoryDetail categoryId={categoryId} queryId={Number(queryId)} />
}
