import { getCategoryById } from '@/lib/db/categories'
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
  const cat = await getCategoryById(categoryId)
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
