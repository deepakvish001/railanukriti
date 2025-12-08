import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import {
  Train, Clock, Gauge, AlertTriangle, Activity, Brain,
  TrendingUp, TrendingDown, Zap, CloudRain, Radio, Route,
  BarChart3, Target, Percent, Timer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useKPIData, AllKPIs } from '@/hooks/useKPIData';
import { useTrains } from '@/hooks/useRailwayData';
import { useMetricsHistory } from '@/hooks/useMetricsHistory';
import { cn } from '@/lib/utils';

const COLORS = ['#00d4ff', '#22c55e', '#f59e0b', '#ef4444', '#a855f7'];

interface KPICardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  subtitle?: string;
}

const KPICard = ({ title, value, unit, icon, color, trend, trendValue, subtitle }: KPICardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden"
  >
    <Card className="bg-card/50 border-border/50">
      <div className="absolute top-0 left-0 w-full h-1" style={{ background: color }} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-bold font-mono" style={{ color }}>{value}</span>
              {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
            </div>
            {subtitle && <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>}
          </div>
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}20` }}>
            {icon}
          </div>
        </div>
        {trend && trendValue && (
          <div className="mt-2 flex items-center gap-1">
            {trend === 'up' ? (
              <TrendingUp className="w-3 h-3 text-success" />
            ) : trend === 'down' ? (
              <TrendingDown className="w-3 h-3 text-destructive" />
            ) : null}
            <span className={cn(
              "text-xs font-mono",
              trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground'
            )}>
              {trendValue}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  </motion.div>
);

const TrainPerformanceSection = ({ kpis }: { kpis: AllKPIs['trainPerformance'] }) => {
  const delayData = [
    { name: 'Passenger', delay: kpis.avgDelayPassenger, fill: '#00d4ff' },
    { name: 'Freight', delay: kpis.avgDelayFreight, fill: '#f59e0b' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <KPICard
          title="On-Time Performance"
          value={kpis.onTimePerformance.toFixed(1)}
          unit="%"
          icon={<Target className="w-5 h-5" style={{ color: '#22c55e' }} />}
          color="#22c55e"
          trend={kpis.onTimePerformance >= 85 ? 'up' : 'down'}
          trendValue={kpis.onTimePerformance >= 85 ? 'Above target' : 'Below target'}
        />
        <KPICard
          title="Schedule Adherence"
          value={kpis.scheduleAdherence.toFixed(1)}
          unit="%"
          icon={<Clock className="w-5 h-5" style={{ color: '#a855f7' }} />}
          color="#a855f7"
        />
        <KPICard
          title="Max Delay"
          value={kpis.maxDelay}
          unit="min"
          icon={<AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />}
          color="#ef4444"
          subtitle={`Train ${kpis.maxDelayTrain}`}
        />
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Train className="w-4 h-4 text-primary" />
            Average Delay by Train Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={delayData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} unit=" min" />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={70} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  formatter={(value: number) => [`${value.toFixed(1)} min`, 'Avg Delay']}
                />
                <Bar dataKey="delay" radius={[0, 4, 4, 0]}>
                  {delayData.map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const SpeedTravelSection = ({ kpis }: { kpis: AllKPIs['speedTravel'] }) => {
  const speedData = [
    { type: 'Express', speed: kpis.avgSpeedExpress, target: 110 },
    { type: 'Freight', speed: kpis.avgSpeedFreight, target: 60 },
    { type: 'Local', speed: kpis.avgSpeedLocal, target: 80 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Avg Express Speed"
          value={kpis.avgSpeedExpress}
          unit="km/h"
          icon={<Gauge className="w-5 h-5" style={{ color: '#00d4ff' }} />}
          color="#00d4ff"
        />
        <KPICard
          title="Avg Freight Speed"
          value={kpis.avgSpeedFreight}
          unit="km/h"
          icon={<Gauge className="w-5 h-5" style={{ color: '#f59e0b' }} />}
          color="#f59e0b"
        />
        <KPICard
          title="Speed Variance"
          value={kpis.speedVariance.toFixed(1)}
          unit="km/h"
          icon={<Activity className="w-5 h-5" style={{ color: '#a855f7' }} />}
          color="#a855f7"
        />
        <KPICard
          title="Section Travel Time"
          value={kpis.avgSectionTravelTime}
          unit="min"
          icon={<Timer className="w-5 h-5" style={{ color: '#22c55e' }} />}
          color="#22c55e"
          subtitle="280 km section"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Gauge className="w-4 h-4 text-primary" />
              Speed vs Target
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={speedData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend />
                  <Bar dataKey="speed" name="Actual" fill="#00d4ff" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="target" name="Target" fill="#22c55e40" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              Halt Time Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Actual Halt Time</span>
                  <span className="font-mono">{kpis.avgHaltTime.toFixed(1)} min</span>
                </div>
                <Progress value={(kpis.avgHaltTime / 20) * 100} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Scheduled Halt Time</span>
                  <span className="font-mono">{kpis.scheduledHaltTime} min</span>
                </div>
                <Progress value={(kpis.scheduledHaltTime / 20) * 100} className="h-2 [&>div]:bg-success" />
              </div>
              <div className="pt-2 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">Halt Efficiency</span>
                  <Badge variant={kpis.avgHaltTime <= kpis.scheduledHaltTime * 1.1 ? 'default' : 'destructive'}>
                    {((kpis.scheduledHaltTime / kpis.avgHaltTime) * 100).toFixed(0)}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const DisruptionSection = ({ kpis }: { kpis: AllKPIs['disruption'] }) => {
  const disruptionData = [
    { name: 'Signal Failure', value: kpis.delayBySignalFailure, color: '#ef4444' },
    { name: 'Track Block', value: kpis.delayByTrackBlock, color: '#f59e0b' },
    { name: 'Weather', value: kpis.delayByWeather, color: '#00d4ff' },
    { name: 'Other', value: kpis.delayByOther, color: '#a855f7' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Trains Affected"
          value={kpis.trainsAffected}
          icon={<Train className="w-5 h-5" style={{ color: '#ef4444' }} />}
          color="#ef4444"
        />
        <KPICard
          title="Affected Distance"
          value={kpis.affectedDistance}
          unit="km"
          icon={<Route className="w-5 h-5" style={{ color: '#f59e0b' }} />}
          color="#f59e0b"
        />
        <KPICard
          title="Avg Recovery Time"
          value={kpis.avgRecoveryTime.toFixed(0)}
          unit="min"
          icon={<Timer className="w-5 h-5" style={{ color: '#22c55e' }} />}
          color="#22c55e"
        />
        <KPICard
          title="Total Delay Impact"
          value={kpis.delayBySignalFailure + kpis.delayByTrackBlock + kpis.delayByWeather + kpis.delayByOther}
          unit="min"
          icon={<Clock className="w-5 h-5" style={{ color: '#a855f7' }} />}
          color="#a855f7"
        />
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            Delay by Disruption Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={disruptionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {disruptionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {disruptionData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
                  </div>
                  <span className="text-sm font-mono font-medium">{item.value} min</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const OperationalSection = ({ kpis }: { kpis: AllKPIs['operational'] }) => {
  const radarData = [
    { metric: 'Utilization', value: kpis.sectionUtilization, fullMark: 100 },
    { metric: 'Density', value: kpis.trainDensity * 20, fullMark: 100 },
    { metric: 'P/F Ratio', value: kpis.passengerDelayRatio * 50, fullMark: 100 },
    { metric: 'Efficiency', value: 100 - kpis.congestionIndex * 10, fullMark: 100 },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Section Utilization"
          value={kpis.sectionUtilization.toFixed(1)}
          unit="%"
          icon={<Percent className="w-5 h-5" style={{ color: '#22c55e' }} />}
          color="#22c55e"
        />
        <KPICard
          title="Train Density"
          value={kpis.trainDensity.toFixed(1)}
          unit="trains/hr"
          icon={<BarChart3 className="w-5 h-5" style={{ color: '#00d4ff' }} />}
          color="#00d4ff"
        />
        <KPICard
          title="Congestion Index"
          value={kpis.congestionIndex.toFixed(2)}
          icon={<Radio className="w-5 h-5" style={{ color: kpis.congestionIndex > 0.5 ? '#ef4444' : '#22c55e' }} />}
          color={kpis.congestionIndex > 0.5 ? '#ef4444' : '#22c55e'}
          trend={kpis.congestionIndex <= 0.5 ? 'up' : 'down'}
          trendValue={kpis.congestionIndex <= 0.5 ? 'Low congestion' : 'High congestion'}
        />
        <KPICard
          title="P/F Delay Ratio"
          value={kpis.passengerDelayRatio.toFixed(2)}
          icon={<Activity className="w-5 h-5" style={{ color: '#a855f7' }} />}
          color="#a855f7"
          subtitle="Passenger vs Freight"
        />
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Operational Efficiency Radar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Current" dataKey="value" stroke="#00d4ff" fill="#00d4ff" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const PredictiveSection = ({ kpis }: { kpis: AllKPIs['predictive'] }) => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard
          title="Prediction Accuracy"
          value={kpis.predictionAccuracy.toFixed(1)}
          unit="%"
          icon={<Brain className="w-5 h-5" style={{ color: '#a855f7' }} />}
          color="#a855f7"
          trend={kpis.predictionAccuracy >= 85 ? 'up' : 'down'}
          trendValue="AI Model Performance"
        />
        <KPICard
          title="Delay Prediction"
          value={kpis.delayPredictionAccuracy.toFixed(1)}
          unit="%"
          icon={<Target className="w-5 h-5" style={{ color: '#00d4ff' }} />}
          color="#00d4ff"
        />
        <KPICard
          title="Scenario Impact"
          value={kpis.scenarioImpactScore.toFixed(0)}
          unit="/100"
          icon={<Zap className="w-5 h-5" style={{ color: '#f59e0b' }} />}
          color="#f59e0b"
        />
        <KPICard
          title="Bottleneck Risk"
          value={kpis.bottleneckRisk.toFixed(0)}
          unit="%"
          icon={<AlertTriangle className="w-5 h-5" style={{ color: kpis.bottleneckRisk > 50 ? '#ef4444' : '#22c55e' }} />}
          color={kpis.bottleneckRisk > 50 ? '#ef4444' : '#22c55e'}
          trend={kpis.bottleneckRisk <= 50 ? 'up' : 'down'}
          trendValue={kpis.bottleneckRisk <= 50 ? 'Low risk' : 'High risk'}
        />
      </div>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            AI Model Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Arrival Time Prediction</span>
                  <span className="font-mono text-primary">{kpis.predictionAccuracy.toFixed(1)}%</span>
                </div>
                <Progress value={kpis.predictionAccuracy} className="h-2" />
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Delay Prediction</span>
                  <span className="font-mono text-primary">{kpis.delayPredictionAccuracy.toFixed(1)}%</span>
                </div>
                <Progress value={kpis.delayPredictionAccuracy} className="h-2" />
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-muted/30 rounded-lg">
              <div className="text-3xl font-bold font-mono text-primary mb-1">
                {((kpis.predictionAccuracy + kpis.delayPredictionAccuracy) / 2).toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground text-center">Overall AI Accuracy</p>
              <Badge variant="outline" className="mt-2">
                <Brain className="w-3 h-3 mr-1" />
                RailOptimizer v2.1
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export const KPIDashboard = () => {
  const { trains } = useTrains();
  const { data: metricsHistory } = useMetricsHistory(24);
  const kpis = useKPIData(trains, metricsHistory);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Section KPI Dashboard</h2>
          <p className="text-xs text-muted-foreground">Jabalpur – Itarsi Section Performance Metrics</p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Radio className="w-3 h-3 animate-pulse text-success" />
          Live Data
        </Badge>
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="bg-card/50 border border-border/50 h-auto flex-wrap">
          <TabsTrigger value="performance" className="text-xs gap-1">
            <Target className="w-3 h-3" />
            Train Performance
          </TabsTrigger>
          <TabsTrigger value="speed" className="text-xs gap-1">
            <Gauge className="w-3 h-3" />
            Speed & Travel
          </TabsTrigger>
          <TabsTrigger value="disruption" className="text-xs gap-1">
            <AlertTriangle className="w-3 h-3" />
            Disruption Impact
          </TabsTrigger>
          <TabsTrigger value="operational" className="text-xs gap-1">
            <Activity className="w-3 h-3" />
            Operational
          </TabsTrigger>
          <TabsTrigger value="predictive" className="text-xs gap-1">
            <Brain className="w-3 h-3" />
            Predictive
          </TabsTrigger>
        </TabsList>

        <TabsContent value="performance">
          <TrainPerformanceSection kpis={kpis.trainPerformance} />
        </TabsContent>
        <TabsContent value="speed">
          <SpeedTravelSection kpis={kpis.speedTravel} />
        </TabsContent>
        <TabsContent value="disruption">
          <DisruptionSection kpis={kpis.disruption} />
        </TabsContent>
        <TabsContent value="operational">
          <OperationalSection kpis={kpis.operational} />
        </TabsContent>
        <TabsContent value="predictive">
          <PredictiveSection kpis={kpis.predictive} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KPIDashboard;
