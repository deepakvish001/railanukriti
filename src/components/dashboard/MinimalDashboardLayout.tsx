import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/dashboard/Header';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { useSectionMetrics, useTrains } from '@/hooks/useRailwayData';
import { Train, AlertTriangle, TrendingUp, Clock, Gauge, Target } from 'lucide-react';

interface MinimalDashboardLayoutProps {
  children: ReactNode;
  title: string;
}

const CompactMetricsBar = () => {
  const { metrics } = useSectionMetrics();
  const { trains } = useTrains();

  const onTimeCount = trains.filter(t => t.status === 'on-time').length;
  const delayedCount = trains.filter(t => t.status === 'delayed').length;

  return (
    <div className="px-3 lg:px-4 py-2 border-b border-border/30 bg-card/30 backdrop-blur-sm">
      <div className="flex items-center gap-3 lg:gap-6 overflow-x-auto">
        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded bg-primary/10">
            <Train className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Active</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">{metrics?.activeTrains ?? trains.length}</span>
          </div>
        </div>

        <div className="w-px h-8 bg-border/50 shrink-0" />

        <div className="flex items-center gap-2 shrink-0">
          <div className="p-1.5 rounded bg-warning/10">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Conflicts</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">{metrics?.pendingConflicts ?? 0}</span>
          </div>
        </div>

        <div className="w-px h-8 bg-border/50 shrink-0 hidden sm:block" />

        <div className="flex items-center gap-2 shrink-0 hidden sm:flex">
          <div className="p-1.5 rounded bg-success/10">
            <TrendingUp className="w-3.5 h-3.5 text-success" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Throughput</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">{metrics?.throughput ?? 0}<span className="text-xs text-muted-foreground ml-0.5">/hr</span></span>
          </div>
        </div>

        <div className="w-px h-8 bg-border/50 shrink-0 hidden md:block" />

        <div className="flex items-center gap-2 shrink-0 hidden md:flex">
          <div className="p-1.5 rounded bg-destructive/10">
            <Clock className="w-3.5 h-3.5 text-destructive" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Avg Delay</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">{metrics?.averageDelay?.toFixed(1) ?? '0'}<span className="text-xs text-muted-foreground ml-0.5">min</span></span>
          </div>
        </div>

        <div className="w-px h-8 bg-border/50 shrink-0 hidden lg:block" />

        <div className="flex items-center gap-2 shrink-0 hidden lg:flex">
          <div className="p-1.5 rounded bg-primary/10">
            <Target className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">On-Time</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">{metrics?.onTimePerformance ?? 0}<span className="text-xs text-muted-foreground ml-0.5">%</span></span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            <span className="text-[10px] text-success font-medium">{onTimeCount} On Time</span>
          </span>
          {delayedCount > 0 && (
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/10 border border-warning/20">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              <span className="text-[10px] text-warning font-medium">{delayedCount} Delayed</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const MinimalDashboardLayout = ({ children, title }: MinimalDashboardLayoutProps) => {
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-background flex w-full">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <Header />
          
          <main className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/10">
            {/* Compact Metrics Bar */}
            <CompactMetricsBar />
            
            {/* Page Content */}
            <div className="flex-1 p-4 lg:p-6 overflow-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full"
              >
                <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden h-full flex flex-col">
                  <div className="px-4 py-3 border-b border-border/30 bg-muted/20 shrink-0">
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                  </div>
                  <div className="flex-1 p-4 lg:p-6 overflow-auto">
                    {children}
                  </div>
                </div>
              </motion.div>
            </div>
          </main>
          
          {/* Footer Status Bar */}
          <footer className="border-t border-border/30 bg-card/50 backdrop-blur-sm px-4 lg:px-6 py-2">
            <div className="flex items-center justify-between text-[10px] lg:text-xs text-muted-foreground">
              <div className="flex items-center gap-3 lg:gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Synced
                </span>
                <span className="hidden sm:inline text-border/50">•</span>
                <span className="hidden sm:inline">Network: Connected</span>
                <span className="hidden md:inline text-border/50">•</span>
                <span className="hidden md:inline">TMS Integration: Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span>All systems operational</span>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default MinimalDashboardLayout;
