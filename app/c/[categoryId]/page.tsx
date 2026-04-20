import { redirect } from 'next/navigation'

export default async function CategoryIndex({
  params,
}: {
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = await params
  redirect(`/c/${categoryId}/content`)
}
