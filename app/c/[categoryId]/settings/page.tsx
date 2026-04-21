'use client'

import { use } from 'react'
import { SettingsForm } from '@/components/settings-form'

export default function SettingsPage({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = use(params)
  return <SettingsForm categoryId={categoryId} />
}
