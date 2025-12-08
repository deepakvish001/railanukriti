import { motion } from 'framer-motion';
import { TrendingUp, Clock, Gauge, Target, Train, AlertTriangle } from 'lucide-react';
import { SectionMetrics } from '@/types/railway';

interface MetricsPanelProps {
  metrics: SectionMetrics;
}

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  status?: 'success' | 'warning' | 'danger';
  delay?: number;
}

const MetricCard = ({ label, value, unit, icon, trend, trendValue, status = 'success', delay = 0 }: MetricCardProps) => {
  const statusColors = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
  };

  const statusBg = {
    success: 'bg-success/10 border-success/20',
    warning: 'bg-warning/10 border-warning/20',
    danger: 'bg-destructive/10 border-destructive/20',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: delay * 0.1 }}
      className="bg-card border border-border rounded-lg p-4 card-glow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-md ${statusBg[status]}`}>
          <div className={statusColors[status]}>{icon}</div>
        </div>
        {trend && trendValue && (
          <div className={`flex items-center gap-1 text-xs ${trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'}`}>
            <TrendingUp className={`w-3 h-3 ${trend === 'down' ? 'rotate-180' : ''}`} />
            <span>{trendValue}</span>
          </div>
        )}
      </div>
      <p className="data-label mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-foreground font-mono tabular-nums">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
    </motion.div>
  );
};

export const MetricsPanel = ({ metrics }: MetricsPanelProps) => {
  return (
    <div className="grid grid-cols-6 gap-4">
      <MetricCard
        label="Section Throughput"
        value={metrics.throughput}
        unit="trains/hr"
        icon={<TrendingUp className="w-4 h-4" />}
        trend="up"
        trendValue="+12%"
        status="success"
        delay={0}
      />
      <MetricCard
        label="Avg. Delay"
        value={metrics.averageDelay.toFixed(1)}
        unit="min"
        icon={<Clock className="w-4 h-4" />}
        trend="down"
        trendValue="-3.2"
        status={metrics.averageDelay > 10 ? 'warning' : 'success'}
        delay={1}
      />
      <MetricCard
        label="Track Utilization"
        value={metrics.utilization}
        unit="%"
        icon={<Gauge className="w-4 h-4" />}
        status={metrics.utilization > 85 ? 'warning' : 'success'}
        delay={2}
      />
      <MetricCard
        label="On-Time Performance"
        value={metrics.onTimePerformance}
        unit="%"
        icon={<Target className="w-4 h-4" />}
        trend="up"
        trendValue="+5%"
        status={metrics.onTimePerformance < 75 ? 'warning' : 'success'}
        delay={3}
      />
      <MetricCard
        label="Active Trains"
        value={metrics.activeTrains}
        icon={<Train className="w-4 h-4" />}
        status="success"
        delay={4}
      />
      <MetricCard
        label="Pending Conflicts"
        value={metrics.pendingConflicts}
        icon={<AlertTriangle className="w-4 h-4" />}
        status={metrics.pendingConflicts > 0 ? 'warning' : 'success'}
        delay={5}
      />
    </div>
  );
};
