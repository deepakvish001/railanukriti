import { NavLink, useLocation } from 'react-router-dom';
import {
  Sparkles, Bell, FlaskConical, History, BarChart3, AlertTriangle,
  GanttChart, Download, TrendingUp, Target, Brain, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const menuItems = [
  { id: 'recommendations', title: 'AI Recommendations', icon: Sparkles },
  { id: 'alerts', title: 'Alerts', icon: Bell },
  { id: 'simulation', title: 'Simulation', icon: FlaskConical },
  { id: 'audit', title: 'Audit Log', icon: History },
  { id: 'charts', title: 'Charts', icon: BarChart3 },
  { id: 'conflicts', title: 'Conflicts', icon: AlertTriangle },
  { id: 'schedule', title: 'Schedule', icon: GanttChart },
  { id: 'export', title: 'Export', icon: Download },
  { id: 'analytics', title: 'Analytics', icon: TrendingUp },
  { id: 'kpis', title: 'KPIs', icon: Target },
  { id: 'predictions', title: 'AI Predict', icon: Brain },
];

interface DashboardSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const DashboardSidebar = ({ activeTab, onTabChange }: DashboardSidebarProps) => {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card/50">
      <SidebarContent className="pt-2">
        <SidebarGroup>
          <SidebarGroupLabel className={cn("text-xs uppercase tracking-wider", collapsed && "sr-only")}>
            Dashboard
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => onTabChange(item.id)}
                      tooltip={item.title}
                      isActive={isActive}
                      className={cn(
                        "w-full justify-start gap-3 transition-colors",
                        isActive 
                          ? "bg-primary/10 text-primary border-l-2 border-primary" 
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                      <span className={cn("truncate", collapsed && "sr-only")}>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default DashboardSidebar;
