import {
  LayoutDashboard,
  Map,
  Building2,
  FileSpreadsheet,
  Briefcase,
  ExternalLink,
  LogOut,
  BellRing,
  Coffee,
  Users,
  Shield,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useSystemConfig } from "@/hooks/useSystemConfig";
import { useSheetData } from "@/hooks/useSheetData";
import { generateAlerts, groupBy } from "@/lib/calculations";
import { filterOutAdm } from "@/lib/constants";
import { useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/sidebar";

const items = [
  { title: "Briefing", url: "/briefing", icon: Coffee },
  { title: "Admin", url: "/admin", icon: Shield },
  { title: "Administrativo", url: "/administrativo", icon: Briefcase },
  { title: "Alertas", url: "/alertas", icon: BellRing },
  { title: "Consolidado", url: "/", icon: LayoutDashboard },
  { title: "Pessoas", url: "/rh", icon: Users },
  { title: "Regional", url: "/regional", icon: Map },
  { title: "Unidade", url: "/unidade", icon: Building2 },
];

const externalItems = [
  { title: "AtomoDash", url: "https://atomodash.app/pt-br/", icon: ExternalLink },
  {
    title: "Sheets",
    url: "https://docs.google.com/spreadsheets/d/1-CinFq0rTXDGlGgFFQZ22Vfr2qraQeoSbhyET3p8oxA/edit?usp=sharing",
    icon: ExternalLink,
  },
  { title: "Siscard", url: "https://www.siscard.maissabor.ind.br/login", icon: ExternalLink },
  { title: "TecDiet", url: "http://maissabor-tecdiet-next.teknisa.com/", icon: ExternalLink },
  { title: "TecFood", url: "https://maissabor-food.teknisa.com//login/#/login#authentication", icon: ExternalLink },
  { title: "Vialex", url: "https://vialexpro.base44.app/dashboard", icon: ExternalLink },
];

function useDangerAlertCount() {
  const { data: sysConfigData } = useSystemConfig();
  const sysConfig = sysConfigData;
  const { data: sheetData } = useSheetData();
  return useMemo(() => {
    const records = filterOutAdm(sheetData?.data || []);
    const months = [...new Set(records.map((r) => r.data))].filter(Boolean).sort();
    const lastMonth = months[months.length - 1];
    if (!lastMonth) return 0;
    const lastRecs = records.filter((r) => r.data === lastMonth);
    return generateAlerts(lastRecs, sysConfig).filter((a) => a.type === "danger").length;
  }, [sheetData]);
}

export function AppSidebar() {
  const { state } = useSidebar();
  const dangerCount = useDangerAlertCount();
  const collapsed = state === "collapsed";
  const { user, signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo — fundo branco */}
        <div
          className={`flex items-center justify-center bg-white border-b border-sidebar-border/30 ${collapsed ? "p-3" : "p-4"}`}
        >
          <img
            src="/logo.png"
            alt="Mais Sabor"
            className={`object-contain ${collapsed ? "h-7 w-auto" : "h-10 w-auto"}`}
          />
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Dashboards</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                    >
                      <div className="relative mr-2 shrink-0">
                        <item.icon className="h-4 w-4" />
                        {item.title === "Alertas" && dangerCount > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-danger text-white text-[9px] font-bold leading-none">
                            {dangerCount > 99 ? "99+" : dangerCount}
                          </span>
                        )}
                      </div>
                      {!collapsed && <span>{item.title}</span>}
                      {!collapsed && item.title === "Alertas" && dangerCount > 0 && (
                        <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-danger/10 text-danger text-[9px] font-bold">
                          {dangerCount > 99 ? "99+" : dangerCount}
                        </span>
                      )}
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
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:bg-sidebar-accent/50">
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
          {!collapsed && user && <div className="text-[10px] text-muted-foreground truncate px-1">{user.email}</div>}
          <Button variant="outline" size="sm" onClick={signOut} className="w-full">
            <LogOut className="h-4 w-4" />
            {!collapsed && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
