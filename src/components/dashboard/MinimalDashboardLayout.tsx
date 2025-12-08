import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/dashboard/Header';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSectionMetrics, useTrains } from '@/hooks/useRailwayData';
import { Train, AlertTriangle, TrendingUp, Clock, Target } from 'lucide-react';

interface MinimalDashboardLayoutProps {
  children: ReactNode;
  title: string;
}

interface MetricItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  bgColor: string;
  onClick?: () => void;
  tooltip: string;
  className?: string;
}

const MetricItem = ({ icon, label, value, unit, bgColor, onClick, tooltip, className = '' }: MetricItemProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        className={`flex items-center gap-2 shrink-0 hover:bg-muted/50 rounded-lg px-2 py-1 -mx-2 -my-1 transition-colors ${className}`}
      >
        <div className={`p-1.5 rounded ${bgColor}`}>
          {icon}
        </div>
        <div className="flex flex-col text-left">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {value}
            {unit && <span className="text-xs text-muted-foreground ml-0.5">{unit}</span>}
          </span>
        </div>
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom" className="text-xs">
      {tooltip}
    </TooltipContent>
  </Tooltip>
);

const CompactMetricsBar = () => {
  const navigate = useNavigate();
  const { metrics } = useSectionMetrics();
  const { trains } = useTrains();

  const onTimeCount = trains.filter(t => t.status === 'on-time').length;
  const delayedCount = trains.filter(t => t.status === 'delayed').length;

  return (
    <div className="px-3 lg:px-4 py-2 border-b border-border/30 bg-card/30 backdrop-blur-sm">
      <div className="flex items-center gap-3 lg:gap-6 overflow-x-auto">
        <MetricItem
          icon={<Train className="w-3.5 h-3.5 text-primary" />}
          label="Active"
          value={metrics?.activeTrains ?? trains.length}
          bgColor="bg-primary/10"
          onClick={() => navigate('/dashboard')}
          tooltip="Go to Dashboard"
        />

        <div className="w-px h-8 bg-border/50 shrink-0" />

        <MetricItem
          icon={<AlertTriangle className="w-3.5 h-3.5 text-warning" />}
          label="Conflicts"
          value={metrics?.pendingConflicts ?? 0}
          bgColor="bg-warning/10"
          onClick={() => navigate('/conflicts')}
          tooltip="Go to Conflict Detection"
        />

        <div className="w-px h-8 bg-border/50 shrink-0 hidden sm:block" />

        <MetricItem
          icon={<TrendingUp className="w-3.5 h-3.5 text-success" />}
          label="Throughput"
          value={metrics?.throughput ?? 0}
          unit="/hr"
          bgColor="bg-success/10"
          onClick={() => navigate('/kpis')}
          tooltip="Go to KPI Dashboard"
          className="hidden sm:flex"
        />

        <div className="w-px h-8 bg-border/50 shrink-0 hidden md:block" />

        <MetricItem
          icon={<Clock className="w-3.5 h-3.5 text-destructive" />}
          label="Avg Delay"
          value={metrics?.averageDelay?.toFixed(1) ?? '0'}
          unit="min"
          bgColor="bg-destructive/10"
          onClick={() => navigate('/predictions')}
          tooltip="Go to Delay Prediction"
          className="hidden md:flex"
        />

        <div className="w-px h-8 bg-border/50 shrink-0 hidden lg:block" />

        <MetricItem
          icon={<Target className="w-3.5 h-3.5 text-primary" />}
          label="On-Time"
          value={metrics?.onTimePerformance ?? 0}
          unit="%"
          bgColor="bg-primary/10"
          onClick={() => navigate('/analytics')}
          tooltip="Go to Analytics"
          className="hidden lg:flex"
        />

        <div className="ml-auto flex items-center gap-2 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 border border-success/20 hover:bg-success/20 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                <span className="text-[10px] text-success font-medium">{onTimeCount} On Time</span>
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">Go to Dashboard</TooltipContent>
          </Tooltip>
          {delayedCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/alerts')}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-warning/10 border border-warning/20 hover:bg-warning/20 transition-colors"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  <span className="text-[10px] text-warning font-medium">{delayedCount} Delayed</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Go to Active Alerts</TooltipContent>
            </Tooltip>
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
