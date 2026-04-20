import { CATEGORIES_SEED } from '@/lib/fixtures/categories'
import { TabNav } from '@/components/tab-nav'
import { CategoryName } from '@/components/category-name'

export default async function CategoryLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ categoryId: string }>
}) {
  const { categoryId } = await params
  const cat = CATEGORIES_SEED.find((c) => c.id === categoryId)
  // Categories created at runtime live in Context, not SEED — don't notFound here; let child pages handle unknown ids.
  return (
    <>
      <header className="h-16 px-8 flex items-center bg-white sticky top-0 z-10">
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight">
            <CategoryName id={categoryId} fallback={cat?.name} />
          </h1>
        </div>
      </header>
      <TabNav categoryId={categoryId} />
      <div className="flex-1 overflow-auto">{children}</div>
    </>
  )
}
