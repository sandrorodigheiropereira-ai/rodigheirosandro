import { LayoutDashboard, Map, Building2, FileSpreadsheet, Briefcase, ExternalLink, LogOut } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { CompanyLogo } from '@/components/CompanyLogo';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
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
  { title: 'AtomoDash', url: 'https://atomodash.app/pt-br/', icon: ExternalLink },
  { title: 'Siscard', url: 'https://www.siscard.maissabor.ind.br/login', icon: ExternalLink },
  { title: 'Sheets', url: 'https://docs.google.com/spreadsheets/d/1-CinFq0rTXDGlGgFFQZ22Vfr2qraQeoSbhyET3p8oxA/edit?usp=sharing', icon: ExternalLink },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`p-4 ${collapsed ? 'px-2' : ''}`}>
          <CompanyLogo collapsed={collapsed} />
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
                      <ExternalLink className="ml-auto h-3 w-3 opacity-60" />
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-3 space-y-2">
          {!collapsed && user && (
            <div className="text-[10px] text-muted-foreground truncate px-1">{user.email}</div>
          )}
          <Button variant="outline" size="sm" onClick={signOut} className="w-full">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
