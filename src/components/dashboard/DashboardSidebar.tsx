import {
  Sparkles, Bell, FlaskConical, History, BarChart3, AlertTriangle,
  GanttChart, Download, TrendingUp, Target, Brain, Train, ChevronLeft, ChevronRight,
  LayoutDashboard, Upload, Settings2
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
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { NavLink, useLocation } from 'react-router-dom';

const mainItems = [
  { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, path: '/' },
];

const aiItems = [
  { id: 'recommendations', title: 'AI Recommendations', icon: Sparkles, path: '/recommendations' },
  { id: 'predictions', title: 'Delay Prediction', icon: Brain, path: '/predictions' },
  { id: 'conflicts', title: 'Conflict Detection', icon: AlertTriangle, path: '/conflicts' },
];

const operationsItems = [
  { id: 'alerts', title: 'Active Alerts', icon: Bell, path: '/alerts' },
  { id: 'schedule', title: 'Train Schedule', icon: GanttChart, path: '/schedule' },
  { id: 'simulation', title: 'Scenario Sim', icon: FlaskConical, path: '/simulation' },
  { id: 'infrastructure', title: 'Infrastructure', icon: Settings2, path: '/infrastructure' },
];

const analyticsItems = [
  { id: 'kpis', title: 'KPI Dashboard', icon: Target, path: '/kpis' },
  { id: 'charts', title: 'Performance', icon: BarChart3, path: '/charts' },
  { id: 'analytics', title: 'Analytics', icon: TrendingUp, path: '/analytics' },
];

const systemItems = [
  { id: 'data-import', title: 'Data Import', icon: Upload, path: '/data-import' },
  { id: 'audit', title: 'Audit Log', icon: History, path: '/audit' },
  { id: 'export', title: 'Export Data', icon: Download, path: '/export' },
];

export const DashboardSidebar = () => {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();

  const renderMenuItem = (item: { id: string; title: string; icon: any; path: string }) => {
    const isActive = location.pathname === item.path;
    const Icon = item.icon;
    
    const buttonContent = (
      <SidebarMenuButton
        asChild
        isActive={isActive}
        className={cn(
          "w-full gap-3 h-9 transition-all duration-200 rounded-lg",
          collapsed ? "justify-center px-2" : "justify-start px-3",
          isActive 
            ? "bg-primary/15 text-primary shadow-sm shadow-primary/10 border border-primary/20" 
            : "hover:bg-muted/60 text-muted-foreground hover:text-foreground border border-transparent"
        )}
      >
        <NavLink to={item.path}>
          <Icon className={cn(
            "h-4 w-4 shrink-0 transition-colors",
            isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
          )} />
          {!collapsed && (
            <span className="truncate text-sm flex-1">{item.title}</span>
          )}
        </NavLink>
      </SidebarMenuButton>
    );

    return (
      <SidebarMenuItem key={item.id} className="relative">
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              {buttonContent}
            </TooltipTrigger>
            <TooltipContent side="right" className="flex items-center gap-2">
              {item.title}
            </TooltipContent>
          </Tooltip>
        ) : (
          buttonContent
        )}
      </SidebarMenuItem>
    );
  };

  const renderGroup = (label: string, items: typeof aiItems) => (
    <SidebarGroup className={cn("px-2", collapsed && "px-1")}>
      {!collapsed && (
        <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold px-3 mb-1">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu className="space-y-0.5">
          {items.map(renderMenuItem)}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar 
      collapsible="icon" 
      className={cn(
        "border-r border-border/50 bg-gradient-to-b from-card via-card/98 to-card/95 transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Header with Logo and Toggle */}
      <SidebarHeader className={cn(
        "border-b border-border/30 p-3",
        collapsed && "px-2"
      )}>
        <div className={cn(
          "flex items-center",
          collapsed ? "justify-center" : "justify-between"
        )}>
          <div className={cn(
            "flex items-center gap-2",
            collapsed && "justify-center"
          )}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/30">
              <Train className="w-4 h-4 text-primary" />
            </div>
            {!collapsed && (
              <span className="text-sm font-semibold text-foreground">Control</span>
            )}
          </div>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-7 w-7 rounded-md hover:bg-muted/50"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          )}
        </div>
        {collapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-7 w-7 rounded-md hover:bg-muted/50 mt-2 mx-auto"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent className="pt-3 gap-3">
        {renderGroup('Main', mainItems)}
        
        <div className={cn("h-px bg-border/30", collapsed ? "mx-2" : "mx-4")} />
        
        {renderGroup('AI Intelligence', aiItems)}
        
        <div className={cn("h-px bg-border/30", collapsed ? "mx-2" : "mx-4")} />
        
        {renderGroup('Operations', operationsItems)}
        
        <div className={cn("h-px bg-border/30", collapsed ? "mx-2" : "mx-4")} />
        
        {renderGroup('Analytics', analyticsItems)}
        
        <div className={cn("h-px bg-border/30", collapsed ? "mx-2" : "mx-4")} />
        
        {renderGroup('System', systemItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/30 p-2">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/30",
          collapsed && "justify-center px-2"
        )}>
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
          {!collapsed && (
            <span className="text-[10px] text-muted-foreground">System Online</span>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default DashboardSidebar;
