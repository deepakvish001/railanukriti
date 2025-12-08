import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ComposedChart, ReferenceLine
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Clock, Activity, AlertTriangle, 
  Train, Calendar, ChevronDown, BarChart3, LineChartIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useMetricsHistory, MetricsDataPoint } from '@/hooks/useMetricsHistory';
import { cn } from '@/lib/utils';

const timeRanges = [
  { label: '6 Hours', value: 6 },
  { label: '12 Hours', value: 12 },
  { label: '24 Hours', value: 24 },
  { label: '48 Hours', value: 48 },
  { label: '7 Days', value: 168 },
];

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const calculateTrend = (data: MetricsDataPoint[], key: keyof MetricsDataPoint): { value: number; isPositive: boolean } => {
  if (data.length < 2) return { value: 0, isPositive: true };
  
  const recent = data.slice(-Math.ceil(data.length / 4));
  const earlier = data.slice(0, Math.ceil(data.length / 4));
  
  const recentAvg = recent.reduce((sum, d) => sum + Number(d[key]), 0) / recent.length;
  const earlierAvg = earlier.reduce((sum, d) => sum + Number(d[key]), 0) / earlier.length;
  
  const change = earlierAvg !== 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0;
  
  return { value: Math.abs(change), isPositive: change >= 0 };
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-2">{formatDate(label)} {formatTime(label)}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-mono text-foreground">{entry.value.toFixed(1)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend: { value: number; isPositive: boolean };
  icon: React.ReactNode;
  color: string;
  invertTrend?: boolean;
}

const StatCard = ({ title, value, unit, trend, icon, color, invertTrend }: StatCardProps) => {
  const trendIsGood = invertTrend ? !trend.isPositive : trend.isPositive;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <Card className="bg-card/50 border-border/50 backdrop-blur-sm overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1" style={{ background: color }} />
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">{title}</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold font-mono text-foreground">{value}</span>
                {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
              </div>
            </div>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
              {icon}
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1">
            {trend.value > 0 ? (
              <>
                {trend.isPositive ? (
                  <TrendingUp className={cn("w-3 h-3", trendIsGood ? "text-success" : "text-destructive")} />
                ) : (
                  <TrendingDown className={cn("w-3 h-3", trendIsGood ? "text-success" : "text-destructive")} />
                )}
                <span className={cn("text-xs font-mono", trendIsGood ? "text-success" : "text-destructive")}>
                  {trend.value.toFixed(1)}%
                </span>
                <span className="text-xs text-muted-foreground">vs previous</span>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">No change</span>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const AnalyticsDashboard = () => {
  const [selectedRange, setSelectedRange] = useState(24);
  const { data, loading } = useMetricsHistory(selectedRange);

  const currentMetrics = data.length > 0 ? data[data.length - 1] : null;
  
  const throughputTrend = calculateTrend(data, 'throughput');
  const delayTrend = calculateTrend(data, 'averageDelay');
  const utilizationTrend = calculateTrend(data, 'utilization');
  const otpTrend = calculateTrend(data, 'onTimePerformance');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <Activity className="w-8 h-8 animate-pulse text-primary" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Time Range Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Performance Analytics</h2>
          <p className="text-sm text-muted-foreground">Historical trends and operational insights</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Calendar className="w-4 h-4" />
              {timeRanges.find(r => r.value === selectedRange)?.label}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {timeRanges.map((range) => (
              <DropdownMenuItem 
                key={range.value} 
                onClick={() => setSelectedRange(range.value)}
                className={cn(selectedRange === range.value && "bg-primary/10")}
              >
                {range.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Throughput"
          value={currentMetrics?.throughput || 0}
          unit="trains/hr"
          trend={throughputTrend}
          icon={<Train className="w-5 h-5" style={{ color: '#00d4ff' }} />}
          color="#00d4ff"
        />
        <StatCard
          title="Avg Delay"
          value={currentMetrics?.averageDelay.toFixed(1) || '0.0'}
          unit="min"
          trend={delayTrend}
          icon={<Clock className="w-5 h-5" style={{ color: '#ef4444' }} />}
          color="#ef4444"
          invertTrend
        />
        <StatCard
          title="Utilization"
          value={currentMetrics?.utilization.toFixed(1) || '0.0'}
          unit="%"
          trend={utilizationTrend}
          icon={<Activity className="w-5 h-5" style={{ color: '#22c55e' }} />}
          color="#22c55e"
        />
        <StatCard
          title="On-Time Performance"
          value={currentMetrics?.onTimePerformance.toFixed(1) || '0.0'}
          unit="%"
          trend={otpTrend}
          icon={<TrendingUp className="w-5 h-5" style={{ color: '#a855f7' }} />}
          color="#a855f7"
        />
      </div>

      {/* Main Charts */}
      <Tabs defaultValue="throughput" className="space-y-4">
        <TabsList className="bg-card/50 border border-border/50">
          <TabsTrigger value="throughput" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Throughput
          </TabsTrigger>
          <TabsTrigger value="delays" className="gap-2">
            <Clock className="w-4 h-4" />
            Delays
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-2">
            <LineChartIcon className="w-4 h-4" />
            Performance
          </TabsTrigger>
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="w-4 h-4" />
            Overview
          </TabsTrigger>
        </TabsList>

        <TabsContent value="throughput">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Train className="w-4 h-4 text-primary" />
                Train Throughput Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data}>
                    <defs>
                      <linearGradient id="throughputGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={selectedRange > 48 ? formatDate : formatTime}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine 
                      y={data.reduce((sum, d) => sum + d.throughput, 0) / data.length} 
                      stroke="#f59e0b" 
                      strokeDasharray="5 5"
                      label={{ value: 'Avg', fill: '#f59e0b', fontSize: 10 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="throughput" 
                      fill="url(#throughputGradient)" 
                      stroke="#00d4ff"
                      strokeWidth={2}
                      name="Throughput"
                    />
                    <Bar dataKey="activeTrains" fill="#00d4ff40" name="Active Trains" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="delays">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-destructive" />
                Average Delay & Conflicts Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data}>
                    <defs>
                      <linearGradient id="delayGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={selectedRange > 48 ? formatDate : formatTime}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                    />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="averageDelay" 
                      fill="url(#delayGradient)" 
                      stroke="#ef4444"
                      strokeWidth={2}
                      name="Avg Delay (min)"
                    />
                    <Bar 
                      yAxisId="right" 
                      dataKey="pendingConflicts" 
                      fill="#f59e0b" 
                      name="Conflicts"
                      radius={[4, 4, 0, 0]}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance">
          <Card className="bg-card/50 border-border/50">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-success" />
                On-Time Performance & Utilization
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                    <XAxis 
                      dataKey="timestamp" 
                      tickFormatter={selectedRange > 48 ? formatDate : formatTime}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <ReferenceLine y={90} stroke="#22c55e" strokeDasharray="5 5" label={{ value: 'Target', fill: '#22c55e', fontSize: 10 }} />
                    <Line 
                      type="monotone" 
                      dataKey="onTimePerformance" 
                      stroke="#a855f7" 
                      strokeWidth={2}
                      dot={false}
                      name="OTP %"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="utilization" 
                      stroke="#22c55e" 
                      strokeWidth={2}
                      dot={false}
                      name="Utilization %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium">Operational Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data}>
                      <defs>
                        <linearGradient id="trainsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={selectedRange > 48 ? formatDate : formatTime}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area 
                        type="monotone" 
                        dataKey="activeTrains" 
                        fill="url(#trainsGradient)"
                        stroke="#00d4ff"
                        strokeWidth={2}
                        name="Active Trains"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-warning" />
                  Conflict Frequency
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="timestamp" 
                        tickFormatter={selectedRange > 48 ? formatDate : formatTime}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar 
                        dataKey="pendingConflicts" 
                        fill="#f59e0b" 
                        name="Conflicts"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Summary Statistics */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Period Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { 
                label: 'Peak Throughput', 
                value: Math.max(...data.map(d => d.throughput)),
                unit: 'trains/hr',
                color: '#00d4ff'
              },
              { 
                label: 'Min Delay', 
                value: Math.min(...data.map(d => d.averageDelay)).toFixed(1),
                unit: 'min',
                color: '#22c55e'
              },
              { 
                label: 'Max Delay', 
                value: Math.max(...data.map(d => d.averageDelay)).toFixed(1),
                unit: 'min',
                color: '#ef4444'
              },
              { 
                label: 'Avg OTP', 
                value: (data.reduce((sum, d) => sum + d.onTimePerformance, 0) / data.length).toFixed(1),
                unit: '%',
                color: '#a855f7'
              },
              { 
                label: 'Total Conflicts', 
                value: data.reduce((sum, d) => sum + d.pendingConflicts, 0),
                unit: '',
                color: '#f59e0b'
              },
              { 
                label: 'Peak Utilization', 
                value: Math.max(...data.map(d => d.utilization)).toFixed(1),
                unit: '%',
                color: '#22c55e'
              },
            ].map((stat, index) => (
              <div key={index} className="text-center p-3 rounded-lg bg-background/50">
                <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                <p className="text-lg font-bold font-mono" style={{ color: stat.color }}>
                  {stat.value}
                  <span className="text-xs text-muted-foreground ml-1">{stat.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;
