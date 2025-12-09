import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFreightMovements, useFreightTrains, useRouteStations } from '@/hooks/useFreightData';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';
import { 
  Clock, MapPin, AlertTriangle, TrendingUp, 
  Train, CircleStop, Timer, BarChart3 
} from 'lucide-react';
import { motion } from 'framer-motion';

interface StoppageRecord {
  load_id: string;
  station_code: string;
  halt_minutes: number;
  delay_minutes: number;
  is_stoppage: boolean;
  stoppage_reason: string | null;
  commodity?: string;
  source_station?: string;
  destination_station?: string;
}

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function StoppageAnalysis() {
  const { movements, loading: movementsLoading } = useFreightMovements();
  const { trains, loading: trainsLoading } = useFreightTrains();
  const { stations, loading: stationsLoading } = useRouteStations();
  const [selectedTrain, setSelectedTrain] = useState<string>('all');

  const loading = movementsLoading || trainsLoading || stationsLoading;

  // Join movements with train data
  const enrichedMovements = useMemo(() => {
    if (!movements || !trains) return [];
    
    const trainMap = new Map(trains.map(t => [t.id, t]));
    
    return movements.map(m => {
      const train = trainMap.get(m.freight_train_id || '');
      return {
        ...m,
        commodity: train?.commodity || 'Unknown',
        source_station: train?.source_station || '',
        destination_station: train?.destination_station || '',
      };
    }).filter(m => 
      (m.halt_minutes && m.halt_minutes > 0) || 
      (m.delay_minutes && m.delay_minutes > 0) || 
      m.is_stoppage
    );
  }, [movements, trains]);

  // Filter by selected train
  const filteredMovements = useMemo(() => {
    if (selectedTrain === 'all') return enrichedMovements;
    return enrichedMovements.filter(m => m.load_id === selectedTrain);
  }, [enrichedMovements, selectedTrain]);

  // Unique trains for filter
  const uniqueTrains = useMemo(() => {
    const trainIds = [...new Set(enrichedMovements.map(m => m.load_id))];
    return trainIds.slice(0, 50); // Limit to 50 for performance
  }, [enrichedMovements]);

  // Summary statistics
  const summaryStats = useMemo(() => {
    const totalHaltMinutes = filteredMovements.reduce((sum, m) => sum + (m.halt_minutes || 0), 0);
    const totalDelayMinutes = filteredMovements.reduce((sum, m) => sum + (m.delay_minutes || 0), 0);
    const stoppageCount = filteredMovements.filter(m => m.is_stoppage).length;
    const affectedStations = new Set(filteredMovements.map(m => m.station_code)).size;
    
    return {
      totalHaltMinutes: Math.round(totalHaltMinutes),
      totalDelayMinutes: Math.round(totalDelayMinutes),
      stoppageCount,
      affectedStations,
      avgHaltDuration: filteredMovements.length > 0 
        ? Math.round(totalHaltMinutes / filteredMovements.length) 
        : 0,
    };
  }, [filteredMovements]);

  // Station-wise breakdown
  const stationBreakdown = useMemo(() => {
    const stationMap = new Map<string, { 
      halts: number; 
      delays: number; 
      stoppages: number; 
      totalHaltMins: number;
      totalDelayMins: number;
    }>();

    filteredMovements.forEach(m => {
      const existing = stationMap.get(m.station_code) || { 
        halts: 0, delays: 0, stoppages: 0, totalHaltMins: 0, totalDelayMins: 0 
      };
      
      stationMap.set(m.station_code, {
        halts: existing.halts + (m.halt_minutes && m.halt_minutes > 0 ? 1 : 0),
        delays: existing.delays + (m.delay_minutes && m.delay_minutes > 0 ? 1 : 0),
        stoppages: existing.stoppages + (m.is_stoppage ? 1 : 0),
        totalHaltMins: existing.totalHaltMins + (m.halt_minutes || 0),
        totalDelayMins: existing.totalDelayMins + (m.delay_minutes || 0),
      });
    });

    return Array.from(stationMap.entries())
      .map(([station, data]) => ({
        station,
        ...data,
        stationName: stations?.find(s => s.station_code === station)?.station_name || station,
      }))
      .sort((a, b) => (b.totalHaltMins + b.totalDelayMins) - (a.totalHaltMins + a.totalDelayMins));
  }, [filteredMovements, stations]);

  // Reason breakdown
  const reasonBreakdown = useMemo(() => {
    const reasonMap = new Map<string, number>();
    
    filteredMovements.forEach(m => {
      const reason = m.stoppage_reason || 
        (m.is_stoppage ? 'Unscheduled Stoppage' : 
          (m.delay_minutes && m.delay_minutes > 0 ? 'Delay' : 'Scheduled Halt'));
      
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1);
    });

    return Array.from(reasonMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredMovements]);

  // Duration distribution
  const durationDistribution = useMemo(() => {
    const ranges = [
      { range: '0-5 min', min: 0, max: 5, count: 0 },
      { range: '5-15 min', min: 5, max: 15, count: 0 },
      { range: '15-30 min', min: 15, max: 30, count: 0 },
      { range: '30-60 min', min: 30, max: 60, count: 0 },
      { range: '60+ min', min: 60, max: Infinity, count: 0 },
    ];

    filteredMovements.forEach(m => {
      const duration = (m.halt_minutes || 0) + (m.delay_minutes || 0);
      const range = ranges.find(r => duration >= r.min && duration < r.max);
      if (range) range.count++;
    });

    return ranges;
  }, [filteredMovements]);

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with filter */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <CircleStop className="h-5 w-5 text-destructive" />
          Stoppage Analysis
        </h3>
        <Select value={selectedTrain} onValueChange={setSelectedTrain}>
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="Filter by train" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trains</SelectItem>
            {uniqueTrains.map(id => (
              <SelectItem key={id} value={id}>{id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-amber-500/10 border-amber-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-amber-500">
                <Timer className="h-4 w-4" />
                <span className="text-xs uppercase">Total Halt Time</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.totalHaltMinutes} min</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-destructive/10 border-destructive/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-destructive">
                <Clock className="h-4 w-4" />
                <span className="text-xs uppercase">Total Delay</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.totalDelayMinutes} min</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-orange-500/10 border-orange-500/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-orange-500">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-xs uppercase">Stoppages</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.stoppageCount}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card className="bg-primary/10 border-primary/30">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-primary">
                <MapPin className="h-4 w-4" />
                <span className="text-xs uppercase">Affected Stations</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.affectedStations}</p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-muted/50 border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
                <span className="text-xs uppercase">Avg Halt Duration</span>
              </div>
              <p className="text-2xl font-bold mt-1">{summaryStats.avgHaltDuration} min</p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Detailed Analysis Tabs */}
      <Tabs defaultValue="location" className="mt-6">
        <TabsList>
          <TabsTrigger value="location" className="gap-2">
            <MapPin className="h-4 w-4" />
            By Location
          </TabsTrigger>
          <TabsTrigger value="reason" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            By Reason
          </TabsTrigger>
          <TabsTrigger value="duration" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Duration Distribution
          </TabsTrigger>
          <TabsTrigger value="details" className="gap-2">
            <Train className="h-4 w-4" />
            Detailed Records
          </TabsTrigger>
        </TabsList>

        {/* Location Breakdown */}
        <TabsContent value="location" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Station-wise Stoppage Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart 
                    data={stationBreakdown.slice(0, 15)} 
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="stationName" 
                      type="category" 
                      tick={{ fontSize: 11 }}
                      width={75}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Bar dataKey="totalHaltMins" name="Halt (min)" fill="hsl(var(--chart-1))" stackId="stack" />
                    <Bar dataKey="totalDelayMins" name="Delay (min)" fill="hsl(var(--destructive))" stackId="stack" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reason Breakdown */}
        <TabsContent value="reason" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Stoppage Reason Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={reasonBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={150}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                    >
                      {reasonBreakdown.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Duration Distribution */}
        <TabsContent value="duration" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Duration Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={durationDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="range" />
                    <YAxis />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar dataKey="count" name="Number of Events" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Detailed Records */}
        <TabsContent value="details" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detailed Stoppage Records</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {filteredMovements.slice(0, 100).map((m, idx) => (
                    <motion.div
                      key={`${m.load_id}-${m.station_code}-${idx}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="font-mono text-sm font-medium truncate max-w-[200px]">
                            {m.load_id}
                          </span>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {m.station_code}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {m.halt_minutes && m.halt_minutes > 0 && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                            Halt: {m.halt_minutes}m
                          </Badge>
                        )}
                        {m.delay_minutes && m.delay_minutes > 0 && (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                            Delay: {m.delay_minutes}m
                          </Badge>
                        )}
                        {m.is_stoppage && (
                          <Badge variant="destructive">
                            Stoppage
                          </Badge>
                        )}
                        {m.stoppage_reason && (
                          <span className="text-xs text-muted-foreground max-w-[150px] truncate">
                            {m.stoppage_reason}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
