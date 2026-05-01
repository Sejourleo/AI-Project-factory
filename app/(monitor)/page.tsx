import { redirect } from 'next/navigation'
import { CATEGORIES_SEED } from '@/lib/fixtures/categories'

export default function Home() {
  redirect(`/c/${CATEGORIES_SEED[0].id}/content`)
}
