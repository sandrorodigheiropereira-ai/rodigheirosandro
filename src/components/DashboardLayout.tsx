import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/AppSidebar';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 gap-3">
            <SidebarTrigger className="mr-2" />
            <img src="/logo.png" alt="Mais Sabor" className="h-8 w-auto object-contain" />
            <span className="text-sm text-muted-foreground hidden sm:block">Plataforma de Gestão Financeira</span>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <ErrorBoundary fallbackTitle="Erro ao carregar o dashboard">
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
