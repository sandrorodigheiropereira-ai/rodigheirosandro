import { LayoutDashboard, Map, Building2, Briefcase, ExternalLink, LogOut, BellRing } from 'lucide-react';
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
  { title: 'Alertas', url: '/alertas', icon: BellRing },
];

const externalItems = [
  { title: 'AtomoDash', url: 'https://atomodash.app/pt-br/', icon: ExternalLink },
  { title: 'Sheets', url: 'https://docs.google.com/spreadsheets/d/1-CinFq0rTXDGlGgFFQZ22Vfr2qraQeoSbhyET3p8oxA/edit?usp=sharing', icon: ExternalLink },
  { title: 'Siscard', url: 'https://www.siscard.maissabor.ind.br/login', icon: ExternalLink },
  { title: 'TecDiet', url: 'http://maissabor-tecdiet-next.teknisa.com/', icon: ExternalLink },
  { title: 'TecFood', url: 'https://maissabor-food.teknisa.com//login/#/login#authentication', icon: ExternalLink },
  { title: 'Vialex', url: 'https://vialexpro.base44.app/dashboard', icon: ExternalLink },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="p-4 flex items-center justify-center border-b">
          <CompanyLogo />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Dashboards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className="flex items-center gap-2 hover:bg-muted/50">
                      <item.icon className="h-4 w-4" />
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
                      className="flex items-center gap-2 hover:bg-muted/50"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.title}</span>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <div className="mt-auto p-3 border-t space-y-2">
          {!collapsed && user && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={() => signOut()}
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
