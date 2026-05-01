import { CategoriesProvider } from '@/components/categories-provider'
import { AppSidebar } from '@/components/app-sidebar'

export default function MonitorLayout({ children }: { children: React.ReactNode }) {
  return (
    <CategoriesProvider>
      <div className="flex min-h-[calc(100vh-56px)]">
        <AppSidebar />
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </div>
    </CategoriesProvider>
  )
}
