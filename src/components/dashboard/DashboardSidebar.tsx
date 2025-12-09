import {
  Brain, History, BarChart3, Train, ChevronLeft, ChevronRight,
  LayoutDashboard, Upload, Download, Container
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
  { id: 'freight-analysis', title: 'Freight Analysis', icon: Container, path: '/freight-analysis' },
];

const analyticsItems = [
  { id: 'ai-predictions', title: 'AI Predictions', icon: Brain, path: '/ai-predictions' },
  { id: 'kpis', title: 'KPI Dashboard', icon: BarChart3, path: '/kpis' },
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
            ? "bg-primary/10 text-primary border border-primary/20" 
            : "hover:bg-muted text-muted-foreground hover:text-foreground border border-transparent"
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

  const renderGroup = (label: string, items: typeof mainItems) => (
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
        "border-r border-border bg-card transition-all duration-300",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      {/* Header with Logo and Toggle */}
      <SidebarHeader className={cn(
        "border-b border-border p-3",
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
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
              <Train className="w-4 h-4 text-primary" />
            </div>
            {!collapsed && (
              <span className="text-sm font-semibold text-foreground">RailAnukriti</span>
            )}
          </div>
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="h-7 w-7 rounded-md hover:bg-muted"
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
            className="h-7 w-7 rounded-md hover:bg-muted mt-2 mx-auto"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </SidebarHeader>

      <SidebarContent className="pt-3 gap-3">
        {renderGroup('Main', mainItems)}
        
        <div className={cn("h-px bg-border", collapsed ? "mx-2" : "mx-4")} />
        
        {renderGroup('Analytics', analyticsItems)}
        
        <div className={cn("h-px bg-border", collapsed ? "mx-2" : "mx-4")} />
        
        {renderGroup('System', systemItems)}
      </SidebarContent>

      <SidebarFooter className="border-t border-border p-2">
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50",
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
