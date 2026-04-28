import { LayoutDashboard, Map, Building2, FileSpreadsheet, Briefcase, ExternalLink } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const items = [
  { title: 'Consolidado', url: '/', icon: LayoutDashboard },
  { title: 'Regional', url: '/regional', icon: Map },
  { title: 'Unidade', url: '/unidade', icon: Building2 },
  { title: 'Administrativo', url: '/administrativo', icon: Briefcase },
];

const externalItems = [
  { title: 'Vialex', url: 'https://vialexpro.base44.app/dashboard', icon: ExternalLink },
  { title: 'AtomoDash', url: 'https://atomodash.app/pt-br/?d=216', icon: ExternalLink },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-4 ${collapsed ? 'px-2' : ''}`}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-primary-foreground" />
            </div>
            {!collapsed && (
              <div>
                <h2 className="text-sm font-display font-bold">FinanceHub</h2>
                <p className="text-[10px] text-muted-foreground">Gestão Financeira</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Dashboards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Painéis Externos</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {externalItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:bg-sidebar-accent/50"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {!collapsed && (
          <div className="mt-auto p-4">
            <div className="glass-card rounded-lg p-3 text-center">
              <FileSpreadsheet className="w-5 h-5 mx-auto mb-1 text-success" />
              <p className="text-[10px] text-muted-foreground">Google Sheets</p>
              <div className="flex items-center justify-center gap-1 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] text-success">Conectado</span>
              </div>
            </div>
          </div>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
