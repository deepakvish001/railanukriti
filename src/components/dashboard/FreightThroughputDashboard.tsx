import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Train, 
  Clock, 
  Gauge, 
  TrendingUp, 
  AlertTriangle, 
  MapPin,
  Timer,
  Pause,
  StopCircle,
  Activity
} from 'lucide-react';
import { 
  useFreightTrains, 
  useFreightMovements, 
  useRouteStations,
  useRouteBlockSections,
  useDisruptions 
} from '@/hooks/useFreightData';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  Legend,
} from 'recharts';

interface StationMetrics {
  station_code: string;
  station_name: string;
  freight_count: number;
  avg_halt_minutes: number;
  total_delay_minutes: number;
  stoppage_count: number;
  avg_speed: number;
}

export function FreightThroughputDashboard() {
  const { trains, loading: trainsLoading } = useFreightTrains();
  const { movements, loading: movementsLoading } = useFreightMovements();
  const { stations } = useRouteStations();
  const { sections } = useRouteBlockSections();
  const { disruptions } = useDisruptions();
  
  const [selectedStation, setSelectedStation] = useState<string>('all');

  // Calculate station-wise metrics
  const stationMetrics = useMemo<StationMetrics[]>(() => {
    const metricsMap = new Map<string, StationMetrics>();
    
    stations.forEach(station => {
      metricsMap.set(station.station_code, {
        station_code: station.station_code,
        station_name: station.station_name,
        freight_count: 0,
        avg_halt_minutes: 0,
        total_delay_minutes: 0,
        stoppage_count: 0,
        avg_speed: 0,
      });
    });

    const stationMovements = new Map<string, { halts: number[], delays: number[], speeds: number[], stoppages: number }>();
    
    movements.forEach(movement => {
      if (!stationMovements.has(movement.station_code)) {
        stationMovements.set(movement.station_code, { halts: [], delays: [], speeds: [], stoppages: 0 });
      }
      const data = stationMovements.get(movement.station_code)!;
      
      if (movement.halt_minutes && movement.halt_minutes > 0) {
        data.halts.push(movement.halt_minutes);
      }
      if (movement.delay_minutes) {
        data.delays.push(movement.delay_minutes);
      }
      if (movement.speed) {
        data.speeds.push(movement.speed);
      }
      if (movement.is_stoppage) {
        data.stoppages++;
      }
    });

    stationMovements.forEach((data, code) => {
      const existing = metricsMap.get(code);
      if (existing) {
        metricsMap.set(code, {
          ...existing,
          freight_count: data.halts.length + data.speeds.length,
          avg_halt_minutes: data.halts.length > 0 ? data.halts.reduce((a, b) => a + b, 0) / data.halts.length : 0,
          total_delay_minutes: data.delays.reduce((a, b) => a + b, 0),
          stoppage_count: data.stoppages,
          avg_speed: data.speeds.length > 0 ? data.speeds.reduce((a, b) => a + b, 0) / data.speeds.length : 0,
        });
      }
    });

    return Array.from(metricsMap.values()).filter(m => m.freight_count > 0);
  }, [movements, stations]);

  // Calculate overall metrics
  const overallMetrics = useMemo(() => {
    const totalTrains = trains.length;
    const totalHaltMinutes = movements.reduce((acc, m) => acc + (m.halt_minutes || 0), 0);
    const totalDelayMinutes = movements.reduce((acc, m) => acc + (m.delay_minutes || 0), 0);
    const totalStoppages = movements.filter(m => m.is_stoppage).length;
    const avgSpeed = movements.length > 0 
      ? movements.reduce((acc, m) => acc + (m.speed || 0), 0) / movements.filter(m => m.speed).length 
      : 0;

    // Calculate throughput (trains per hour estimate)
    const throughput = movements.length > 0 ? (totalTrains / (totalHaltMinutes / 60 + 1)) : 0;

    return {
      totalTrains,
      totalHaltMinutes: Math.round(totalHaltMinutes),
      totalDelayMinutes: Math.round(totalDelayMinutes),
      totalStoppages,
      avgSpeed: Math.round(avgSpeed * 10) / 10,
      throughput: Math.round(throughput * 10) / 10,
      activeDisruptions: disruptions.length,
    };
  }, [trains, movements, disruptions]);

  // Prepare chart data
  const haltDelayChartData = useMemo(() => {
    return stationMetrics.slice(0, 20).map(m => ({
      name: m.station_code,
      halt: Math.round(m.avg_halt_minutes),
      delay: Math.round(m.total_delay_minutes / Math.max(m.freight_count, 1)),
    }));
  }, [stationMetrics]);

  const throughputBySection = useMemo(() => {
    const sectionData = new Map<string, { count: number, totalSpeed: number }>();
    
    movements.forEach(m => {
      if (m.block_section) {
        if (!sectionData.has(m.block_section)) {
          sectionData.set(m.block_section, { count: 0, totalSpeed: 0 });
        }
        const data = sectionData.get(m.block_section)!;
        data.count++;
        data.totalSpeed += m.speed || 0;
      }
    });

    return Array.from(sectionData.entries()).map(([section, data]) => ({
      section,
      trains: data.count,
      avgSpeed: Math.round(data.totalSpeed / data.count) || 0,
    })).slice(0, 15);
  }, [movements]);

  const loading = trainsLoading || movementsLoading;

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Train className="h-5 w-5 text-blue-500" />
              <span className="text-sm text-muted-foreground">Freight Trains</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overallMetrics.totalTrains}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <span className="text-sm text-muted-foreground">Throughput/hr</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overallMetrics.throughput}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Gauge className="h-5 w-5 text-cyan-500" />
              <span className="text-sm text-muted-foreground">Avg Speed</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overallMetrics.avgSpeed} <span className="text-sm">km/h</span></p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Pause className="h-5 w-5 text-amber-500" />
              <span className="text-sm text-muted-foreground">Total Halt</span>
            </div>
            <p className="text-2xl font-bold mt-1">{Math.round(overallMetrics.totalHaltMinutes / 60)} <span className="text-sm">hrs</span></p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-500" />
              <span className="text-sm text-muted-foreground">Total Delay</span>
            </div>
            <p className="text-2xl font-bold mt-1">{Math.round(overallMetrics.totalDelayMinutes / 60)} <span className="text-sm">hrs</span></p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-red-500" />
              <span className="text-sm text-muted-foreground">Stoppages</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overallMetrics.totalStoppages}</p>
          </CardContent>
        </Card>

        <Card className={`border-destructive/50 ${disruptions.length > 0 ? 'bg-destructive/10' : 'bg-green-500/10'}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-5 w-5 ${disruptions.length > 0 ? 'text-destructive' : 'text-green-500'}`} />
              <span className="text-sm text-muted-foreground">Disruptions</span>
            </div>
            <p className="text-2xl font-bold mt-1">{overallMetrics.activeDisruptions}</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="analysis" className="w-full">
        <TabsList>
          <TabsTrigger value="analysis">Throughput Analysis</TabsTrigger>
          <TabsTrigger value="stations">Station-wise Details</TabsTrigger>
          <TabsTrigger value="sections">Section Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="analysis" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Halt vs Delay by Station</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={haltDelayChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={50} fontSize={10} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="halt" name="Avg Halt (min)" fill="#f59e0b" />
                      <Bar dataKey="delay" name="Avg Delay (min)" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Trains by Block Section</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={throughputBySection}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="section" fontSize={8} angle={-45} textAnchor="end" height={60} />
                      <YAxis />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="trains" 
                        name="Train Count"
                        stroke="#3b82f6" 
                        fill="#3b82f6" 
                        fillOpacity={0.3} 
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stations" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Station-wise Freight Metrics</CardTitle>
                <Select value={selectedStation} onValueChange={setSelectedStation}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by station" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stations</SelectItem>
                    {stations.map(s => (
                      <SelectItem key={s.station_code} value={s.station_code}>
                        {s.station_code} - {s.station_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Station</th>
                      <th className="text-right py-2 px-3">Freight Count</th>
                      <th className="text-right py-2 px-3">Avg Halt (min)</th>
                      <th className="text-right py-2 px-3">Total Delay (min)</th>
                      <th className="text-right py-2 px-3">Stoppages</th>
                      <th className="text-right py-2 px-3">Avg Speed</th>
                      <th className="text-center py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stationMetrics
                      .filter(m => selectedStation === 'all' || m.station_code === selectedStation)
                      .map((metric) => {
                        const hasDisruption = disruptions.some(
                          d => d.station_code === metric.station_code || 
                               d.block_section_code?.includes(metric.station_code)
                        );
                        
                        return (
                          <tr key={metric.station_code} className="border-b hover:bg-muted/50">
                            <td className="py-2 px-3">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                <span className="font-mono">{metric.station_code}</span>
                                <span className="text-muted-foreground text-xs">{metric.station_name}</span>
                              </div>
                            </td>
                            <td className="text-right py-2 px-3 font-semibold">{metric.freight_count}</td>
                            <td className="text-right py-2 px-3">
                              <span className={metric.avg_halt_minutes > 30 ? 'text-amber-500' : ''}>
                                {Math.round(metric.avg_halt_minutes)}
                              </span>
                            </td>
                            <td className="text-right py-2 px-3">
                              <span className={metric.total_delay_minutes > 60 ? 'text-red-500' : ''}>
                                {Math.round(metric.total_delay_minutes)}
                              </span>
                            </td>
                            <td className="text-right py-2 px-3">{metric.stoppage_count}</td>
                            <td className="text-right py-2 px-3">
                              <span className={metric.avg_speed < 20 ? 'text-red-500' : metric.avg_speed > 40 ? 'text-green-500' : ''}>
                                {Math.round(metric.avg_speed)} km/h
                              </span>
                            </td>
                            <td className="text-center py-2 px-3">
                              {hasDisruption ? (
                                <Badge variant="destructive">Disrupted</Badge>
                              ) : (
                                <Badge variant="outline" className="text-green-500 border-green-500">Clear</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Block Section Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {sections.map((section) => {
                  const sectionMovements = movements.filter(m => m.block_section === section.block_section_code);
                  const trainCount = sectionMovements.length;
                  const avgSpeed = sectionMovements.length > 0
                    ? sectionMovements.reduce((acc, m) => acc + (m.speed || 0), 0) / sectionMovements.filter(m => m.speed).length
                    : 0;
                  const hasDisruption = disruptions.some(d => d.block_section_code === section.block_section_code);

                  return (
                    <div
                      key={section.id}
                      className={`p-3 rounded-lg border ${hasDisruption ? 'border-destructive bg-destructive/10' : 'border-border'}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-semibold">{section.block_section_code}</span>
                        <Badge variant={section.signal_type === 'AT' ? 'default' : 'secondary'}>
                          {section.signal_type}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Distance</span>
                          <p className="font-semibold">{section.distance_km} km</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Trains</span>
                          <p className="font-semibold">{trainCount}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg Speed</span>
                          <p className={`font-semibold ${avgSpeed < 20 ? 'text-red-500' : ''}`}>
                            {Math.round(avgSpeed) || '-'} km/h
                          </p>
                        </div>
                      </div>
                      {hasDisruption && (
                        <div className="mt-2 flex items-center gap-1 text-destructive text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          Active disruption
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
