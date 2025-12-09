import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ZoomIn, ZoomOut, RefreshCw, Loader2, Download, Train, ArrowUpDown, AlertTriangle, Radio } from 'lucide-react';
import { useRouteStations } from '@/hooks/useFreightData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, addHours, startOfDay, addSeconds } from 'date-fns';
import { toast } from 'sonner';

interface FreightMovement {
  load_id: string;
  station_code: string;
  arrival_time: string;
  departure_time: string | null;
  speed: number | null;
  is_stoppage: boolean;
}

interface PassengerSchedule {
  train_number: string;
  train_id: string;
  station_code: string;
  arrival_seconds: number | null;
  departure_seconds: number | null;
  route_seq_no: number;
  direction: string | null;
  is_halt: boolean | null;
}

interface Disruption {
  id: string;
  station_code: string | null;
  block_section_code: string | null;
  disruption_type: string;
  severity: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  affected_direction: string | null;
  description: string | null;
}

interface TrainPath {
  id: string;
  type: 'freight' | 'passenger';
  direction: 'UP' | 'DN';
  color: string;
  isAffected: boolean;
  affectedAt?: string;
  movements: {
    station_code: string;
    distance_km: number;
    seq_no: number;
    arrival: Date;
    departure: Date | null;
    is_halt: boolean;
    isDisrupted?: boolean;
  }[];
}

// Theme-aware colors - Simple: Red = Passenger, Green = Freight
const THEME_COLORS = {
  passenger: 'hsl(0, 84%, 55%)',      // Red for all passenger trains
  freight: 'hsl(142, 76%, 40%)',       // Green for all freight trains
  halt: 'hsl(215, 16%, 47%)',
  stationMarker: 'hsl(38, 92%, 50%)',
  disruption: 'hsl(0, 84%, 60%)',
  disrupted: 'hsl(38, 92%, 50%)',      // Amber for disrupted trains
};

export function DistanceTimeChart() {
  const { stations, loading: stationsLoading } = useRouteStations();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showFreight, setShowFreight] = useState(true);
  const [showPassenger, setShowPassenger] = useState(true);
  const [showUpline, setShowUpline] = useState(true);
  const [showDownline, setShowDownline] = useState(true);
  const [showDisruptions, setShowDisruptions] = useState(true);
  const [hoveredTrain, setHoveredTrain] = useState<string | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const svgRef = useRef<SVGSVGElement>(null);
  const queryClient = useQueryClient();

  // Fetch freight movements
  const { data: freightMovements, isLoading: freightLoading, refetch: refetchFreight } = useQuery({
    queryKey: ['freight-movements-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freight_movements')
        .select('load_id, station_code, arrival_time, departure_time, speed, is_stoppage')
        .not('arrival_time', 'is', null)
        .order('load_id')
        .order('arrival_time', { ascending: true })
        .limit(3000);
      if (error) throw error;
      return data as FreightMovement[];
    },
  });

  // Fetch passenger schedules
  const { data: passengerSchedule, isLoading: passengerLoading, refetch: refetchPassenger } = useQuery({
    queryKey: ['passenger-schedule-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_schedule')
        .select('train_number, train_id, station_code, arrival_seconds, departure_seconds, route_seq_no, direction, is_halt')
        .order('train_id')
        .order('route_seq_no', { ascending: true })
        .limit(5000);
      if (error) throw error;
      return data as PassengerSchedule[];
    },
  });

  // Fetch active disruptions
  const { data: disruptions, refetch: refetchDisruptions } = useQuery({
    queryKey: ['disruptions-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disruptions')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as Disruption[];
    },
  });

  // Real-time subscription for disruptions
  useEffect(() => {
    if (!isLive) return;

    const channel = supabase
      .channel('disruptions-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'disruptions'
        },
        (payload) => {
          console.log('Disruption change detected:', payload);
          setLastUpdate(new Date());
          
          // Refetch disruptions data
          queryClient.invalidateQueries({ queryKey: ['disruptions-chart'] });
          
          // Show toast notification
          if (payload.eventType === 'INSERT') {
            const newDisruption = payload.new as Disruption;
            toast.error(`🚨 New Disruption: ${newDisruption.disruption_type} at ${newDisruption.station_code || newDisruption.block_section_code}`, {
              duration: 5000,
              description: `Severity: ${newDisruption.severity?.toUpperCase()}`,
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedDisruption = payload.new as Disruption;
            if (!updatedDisruption.is_active) {
              toast.success(`✅ Disruption resolved at ${updatedDisruption.station_code || updatedDisruption.block_section_code}`, {
                duration: 4000,
              });
            }
          } else if (payload.eventType === 'DELETE') {
            toast.success('✅ Disruption removed', { duration: 3000 });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isLive, queryClient]);

  // Station maps
  const stationDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    stations.forEach(s => map.set(s.station_code, s.cumulative_distance_km ?? 0));
    return map;
  }, [stations]);

  const stationSeqMap = useMemo(() => {
    const map = new Map<string, number>();
    stations.forEach(s => map.set(s.station_code, s.seq_no));
    return map;
  }, [stations]);

  // Disrupted stations set
  const disruptedStations = useMemo(() => {
    const set = new Set<string>();
    disruptions?.forEach(d => {
      if (d.station_code) set.add(d.station_code);
    });
    return set;
  }, [disruptions]);

  // Ordered stations for Y-axis
  const orderedStations = useMemo(() => {
    return [...stations].sort((a, b) => b.seq_no - a.seq_no);
  }, [stations]);

  const maxDistance = useMemo(() => {
    if (orderedStations.length === 0) return 180;
    return Math.max(...stations.map(s => s.cumulative_distance_km ?? 0));
  }, [orderedStations, stations]);

  const baseDate = useMemo(() => startOfDay(new Date()), []);

  // Process freight movements into paths with disruption awareness
  const freightPaths = useMemo((): TrainPath[] => {
    if (!freightMovements || freightMovements.length === 0) return [];

    const pathMap = new Map<string, TrainPath>();
    
    freightMovements.forEach((m) => {
      const distance = stationDistanceMap.get(m.station_code);
      const seq = stationSeqMap.get(m.station_code);
      if (distance === undefined || seq === undefined) return;

      if (!pathMap.has(m.load_id)) {
        pathMap.set(m.load_id, {
          id: m.load_id,
          type: 'freight',
          direction: 'DN',
          color: THEME_COLORS.freight,  // Green for freight
          isAffected: false,
          movements: [],
        });
      }

      const isDisrupted = disruptedStations.has(m.station_code);
      
      pathMap.get(m.load_id)!.movements.push({
        station_code: m.station_code,
        distance_km: distance,
        seq_no: seq,
        arrival: parseISO(m.arrival_time),
        departure: m.departure_time ? parseISO(m.departure_time) : null,
        is_halt: m.is_stoppage,
        isDisrupted,
      });

      if (isDisrupted) {
        const path = pathMap.get(m.load_id)!;
        path.isAffected = true;
        if (!path.affectedAt) path.affectedAt = m.station_code;
      }
    });

    pathMap.forEach(path => {
      path.movements.sort((a, b) => a.arrival.getTime() - b.arrival.getTime());
      
      if (path.movements.length >= 2) {
        const first = path.movements[0];
        const last = path.movements[path.movements.length - 1];
        path.direction = first.distance_km < last.distance_km ? 'DN' : 'UP';
        path.color = path.isAffected ? THEME_COLORS.disrupted : THEME_COLORS.freight;  // Green for freight
      }
    });

    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [freightMovements, stationDistanceMap, stationSeqMap, disruptedStations]);

  // Process passenger schedules into paths with disruption awareness
  const passengerPaths = useMemo((): TrainPath[] => {
    if (!passengerSchedule || passengerSchedule.length === 0) return [];

    const pathMap = new Map<string, TrainPath>();
    
    passengerSchedule.forEach((s) => {
      const distance = stationDistanceMap.get(s.station_code);
      const seq = stationSeqMap.get(s.station_code);
      if (distance === undefined || seq === undefined) return;

      const key = s.train_id;
      if (!pathMap.has(key)) {
        const dir = s.direction === 'DN' ? 'DN' : 'UP';
        pathMap.set(key, {
          id: s.train_number,
          type: 'passenger',
          direction: dir,
          color: THEME_COLORS.passenger,  // Red for passenger
          isAffected: false,
          movements: [],
        });
      }

      const arrivalDate = s.arrival_seconds !== null ? addSeconds(baseDate, s.arrival_seconds) : null;
      const departureDate = s.departure_seconds !== null ? addSeconds(baseDate, s.departure_seconds) : null;
      const isDisrupted = disruptedStations.has(s.station_code);

      if (arrivalDate) {
        pathMap.get(key)!.movements.push({
          station_code: s.station_code,
          distance_km: distance,
          seq_no: seq,
          arrival: arrivalDate,
          departure: departureDate,
          is_halt: s.is_halt || false,
          isDisrupted,
        });

        if (isDisrupted) {
          const path = pathMap.get(key)!;
          path.isAffected = true;
          if (!path.affectedAt) path.affectedAt = s.station_code;
        }
      }
    });

    pathMap.forEach(path => {
      path.movements.sort((a, b) => {
        if (path.direction === 'DN') return a.seq_no - b.seq_no;
        return b.seq_no - a.seq_no;
      });

      // Update color if affected by disruption
      if (path.isAffected) {
        path.color = THEME_COLORS.disrupted;  // Amber for disrupted
      }
    });

    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [passengerSchedule, stationDistanceMap, stationSeqMap, baseDate, disruptedStations]);

  // Combine all paths
  const allPaths = useMemo(() => {
    let paths: TrainPath[] = [];
    if (showFreight) paths = [...paths, ...freightPaths];
    if (showPassenger) paths = [...paths, ...passengerPaths];
    
    return paths.filter(p => {
      if (p.direction === 'UP' && !showUpline) return false;
      if (p.direction === 'DN' && !showDownline) return false;
      return true;
    });
  }, [freightPaths, passengerPaths, showFreight, showPassenger, showUpline, showDownline]);

  // Time range
  const timeRange = useMemo(() => ({
    start: baseDate,
    end: addHours(baseDate, 24),
    hours: 24,
  }), [baseDate]);

  // Chart dimensions
  const MARGIN = { top: 80, right: 100, bottom: 80, left: 160 };
  const BASE_WIDTH = 1600;
  const BASE_HEIGHT = 800;
  const chartWidth = BASE_WIDTH * zoomLevel;
  const chartHeight = BASE_HEIGHT;
  const innerWidth = chartWidth - MARGIN.left - MARGIN.right;
  const innerHeight = chartHeight - MARGIN.top - MARGIN.bottom;

  const xScale = useCallback((time: Date) => {
    const elapsed = time.getTime() - timeRange.start.getTime();
    const totalRange = timeRange.end.getTime() - timeRange.start.getTime();
    return MARGIN.left + (elapsed / totalRange) * innerWidth;
  }, [timeRange, innerWidth, MARGIN.left]);

  const yScale = useCallback((distance: number) => {
    return MARGIN.top + ((maxDistance - distance) / maxDistance) * innerHeight;
  }, [maxDistance, innerHeight, MARGIN.top]);

  // Generate path with rerouting visualization
  const generatePath = useCallback((path: TrainPath) => {
    if (path.movements.length === 0) return '';
    
    let d = '';
    let foundDisruption = false;
    
    path.movements.forEach((m, i) => {
      const x1 = xScale(m.arrival);
      const y = yScale(m.distance_km);
      
      if (i === 0) {
        d += `M ${x1} ${y}`;
      } else {
        // If previous point was disrupted, add a curve to show rerouting
        if (foundDisruption && !m.isDisrupted) {
          // Coming back from disruption - show smooth curve
          const prevM = path.movements[i - 1];
          const prevX = prevM.departure ? xScale(prevM.departure) : xScale(prevM.arrival);
          const prevY = yScale(prevM.distance_km);
          const controlX = (prevX + x1) / 2;
          d += ` Q ${controlX} ${prevY + 20} ${x1} ${y}`;
        } else {
          d += ` L ${x1} ${y}`;
        }
      }
      
      if (m.isDisrupted) {
        foundDisruption = true;
        // Add horizontal wait line at disrupted station
        if (m.departure && m.departure.getTime() > m.arrival.getTime()) {
          const x2 = xScale(m.departure);
          d += ` L ${x2} ${y}`;
        } else {
          // If no departure, show extended wait (disruption hold)
          const waitX = x1 + 30; // Show waiting at station
          d += ` L ${waitX} ${y}`;
        }
      } else if (m.departure && m.departure.getTime() > m.arrival.getTime()) {
        const x2 = xScale(m.departure);
        d += ` L ${x2} ${y}`;
      }
    });

    return d;
  }, [xScale, yScale]);

  // Hour labels
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= 24; i += 2) {
      const time = addHours(timeRange.start, i);
      labels.push({
        time,
        x: xScale(time),
        label: format(time, 'HH:mm'),
      });
    }
    return labels;
  }, [timeRange, xScale]);

  const exportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ktv-psa-time-distance.svg';
    a.click();
    URL.revokeObjectURL(url);
  };

  const refetch = () => {
    refetchFreight();
    refetchPassenger();
    refetchDisruptions();
  };

  // Stats
  const stats = useMemo(() => ({
    totalTrains: allPaths.length,
    passenger: allPaths.filter(p => p.type === 'passenger').length,
    freight: allPaths.filter(p => p.type === 'freight').length,
    upline: allPaths.filter(p => p.direction === 'UP').length,
    downline: allPaths.filter(p => p.direction === 'DN').length,
    affected: allPaths.filter(p => p.isAffected).length,
  }), [allPaths]);

  const activeDisruptions = disruptions?.filter(d => d.is_active) ?? [];

  if (freightLoading || passengerLoading || stationsLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center h-[800px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading Marey chart data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ArrowUpDown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">Distance-Time (Marey) Chart</h3>
                  {/* Live indicator */}
                  <button 
                    onClick={() => setIsLive(!isLive)}
                    className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${
                      isLive 
                        ? 'bg-success/20 text-success border border-success/30' 
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    <Radio className={`w-3 h-3 ${isLive ? 'animate-pulse' : ''}`} />
                    {isLive ? 'LIVE' : 'PAUSED'}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground">
                  KTV → PSA Section · Last update: {format(lastUpdate, 'HH:mm:ss')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}>
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}>
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setZoomLevel(1)}>
                {Math.round(zoomLevel * 100)}%
              </Button>
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportSVG}>
                <Download className="w-4 h-4 mr-1" /> Export
              </Button>
            </div>
          </div>

          {/* Active Disruptions Alert */}
          {activeDisruptions.length > 0 && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">
                  {activeDisruptions.length} Active Disruption{activeDisruptions.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {activeDisruptions.map(d => (
                  <Badge key={d.id} variant="destructive" className="text-xs">
                    {d.station_code || d.block_section_code} - {d.disruption_type}
                    {d.severity === 'critical' && ' ⚠️'}
                  </Badge>
                ))}
              </div>
              {stats.affected > 0 && (
                <p className="mt-2 text-xs text-destructive/80">
                  {stats.affected} trains affected - paths shown in orange with rerouting
                </p>
              )}
            </div>
          )}
        </div>

        {/* Filters & Stats */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="passenger" checked={showPassenger} onCheckedChange={setShowPassenger} />
              <Label htmlFor="passenger" className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: THEME_COLORS.passenger }} />
                Passenger (Red)
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="freight" checked={showFreight} onCheckedChange={setShowFreight} />
              <Label htmlFor="freight" className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: THEME_COLORS.freight }} />
                Freight (Green)
              </Label>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Switch id="upline" checked={showUpline} onCheckedChange={setShowUpline} />
              <Label htmlFor="upline" className="text-sm">↑ Upline</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="downline" checked={showDownline} onCheckedChange={setShowDownline} />
              <Label htmlFor="downline" className="text-sm">↓ Downline</Label>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Switch id="disruptions" checked={showDisruptions} onCheckedChange={setShowDisruptions} />
              <Label htmlFor="disruptions" className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                Disruptions
              </Label>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <Train className="w-3 h-3" /> {stats.totalTrains} trains
            </Badge>
            {stats.affected > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" /> {stats.affected} affected
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              P: {stats.passenger} | F: {stats.freight}
            </Badge>
          </div>
        </div>

        {/* Chart */}
        <ScrollArea className="w-full" style={{ height: chartHeight + 40 }}>
          <svg 
            ref={svgRef}
            width={chartWidth} 
            height={chartHeight}
            className="bg-background"
            style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
          >
            {/* Definitions */}
            <defs>
              <linearGradient id="chartBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.1" />
                <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <pattern id="disruptionPattern" patternUnits="userSpaceOnUse" width="10" height="10">
                <line x1="0" y1="10" x2="10" y2="0" stroke="hsl(0, 84%, 60%)" strokeWidth="1" opacity="0.3" />
              </pattern>
            </defs>

            {/* Background */}
            <rect x={MARGIN.left} y={MARGIN.top} width={innerWidth} height={innerHeight} fill="url(#chartBg)" />

            {/* Title */}
            <text x={chartWidth / 2} y={35} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="18" fontWeight="600">
              Kottavalasa (KTV) → Palasa (PSA) Section
            </text>
            <text x={chartWidth / 2} y={55} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="13">
              Time vs Distance Simulation · {format(new Date(), 'dd MMM yyyy')}
              {activeDisruptions.length > 0 && ` · ${activeDisruptions.length} Disruption${activeDisruptions.length > 1 ? 's' : ''} Active`}
            </text>

            {/* Disruption Zones */}
            {showDisruptions && activeDisruptions.map((disruption) => {
              const stationCode = disruption.station_code;
              if (!stationCode) return null;
              
              const distance = stationDistanceMap.get(stationCode);
              if (distance === undefined) return null;
              
              const y = yScale(distance);
              const bandHeight = 20;

              return (
                <g key={disruption.id}>
                  {/* Disruption zone band across full width */}
                  <rect
                    x={MARGIN.left}
                    y={y - bandHeight / 2}
                    width={innerWidth}
                    height={bandHeight}
                    fill="url(#disruptionPattern)"
                    className="animate-pulse"
                  />
                  <rect
                    x={MARGIN.left}
                    y={y - bandHeight / 2}
                    width={innerWidth}
                    height={bandHeight}
                    fill="hsl(0, 84%, 60%)"
                    opacity="0.15"
                  />
                  {/* Disruption marker */}
                  <circle
                    cx={MARGIN.left - 12}
                    cy={y}
                    r={8}
                    fill="hsl(0, 84%, 60%)"
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                    className="animate-pulse"
                  />
                  <text
                    x={MARGIN.left - 12}
                    y={y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="10"
                    fontWeight="bold"
                  >
                    !
                  </text>
                  {/* Disruption label */}
                  <text
                    x={MARGIN.left + 10}
                    y={y - bandHeight / 2 - 5}
                    fill="hsl(0, 84%, 60%)"
                    fontSize="10"
                    fontWeight="600"
                  >
                    ⚠ {disruption.disruption_type.toUpperCase()} - {stationCode}
                  </text>
                </g>
              );
            })}

            {/* Horizontal grid lines (stations) */}
            {orderedStations.map((station) => {
              const y = yScale(station.cumulative_distance_km ?? 0);
              const isJunction = station.is_junction;
              const isDisrupted = disruptedStations.has(station.station_code);
              
              return (
                <g key={station.station_code}>
                  <line
                    x1={MARGIN.left}
                    y1={y}
                    x2={chartWidth - MARGIN.right}
                    y2={y}
                    stroke={isDisrupted ? "hsl(0, 84%, 60%)" : "hsl(var(--border))"}
                    strokeWidth={isDisrupted ? 2 : (isJunction ? 1.5 : 0.5)}
                    opacity={isDisrupted ? 0.8 : (isJunction ? 0.8 : 0.4)}
                  />
                  <circle
                    cx={MARGIN.left - 12}
                    cy={y}
                    r={isDisrupted ? 6 : (isJunction ? 5 : 3)}
                    fill={isDisrupted ? "hsl(0, 84%, 60%)" : (isJunction ? THEME_COLORS.stationMarker : 'hsl(var(--muted-foreground))')}
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                  />
                  <text
                    x={MARGIN.left - 22}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill={isDisrupted ? "hsl(0, 84%, 60%)" : "hsl(var(--foreground))"}
                    fontSize={isJunction ? 12 : 10}
                    fontWeight={isDisrupted ? 700 : (isJunction ? 600 : 400)}
                  >
                    {station.station_name}
                  </text>
                  <text
                    x={chartWidth - MARGIN.right + 8}
                    y={y - 6}
                    textAnchor="start"
                    fill="hsl(var(--muted-foreground))"
                    fontSize="9"
                    fontWeight="500"
                  >
                    {station.station_code}
                  </text>
                  <text
                    x={chartWidth - MARGIN.right + 8}
                    y={y + 6}
                    textAnchor="start"
                    fill="hsl(var(--muted-foreground))"
                    fontSize="9"
                    opacity="0.7"
                  >
                    {(station.cumulative_distance_km ?? 0).toFixed(1)} km
                  </text>
                </g>
              );
            })}

            {/* Vertical grid lines (time) */}
            {hourLabels.map((label, i) => (
              <g key={i}>
                <line
                  x1={label.x}
                  y1={MARGIN.top}
                  x2={label.x}
                  y2={chartHeight - MARGIN.bottom}
                  stroke="hsl(var(--border))"
                  strokeWidth={i % 2 === 0 ? 1 : 0.5}
                  opacity={i % 2 === 0 ? 0.5 : 0.25}
                />
                <text
                  x={label.x}
                  y={chartHeight - MARGIN.bottom + 20}
                  textAnchor="middle"
                  fill="hsl(var(--muted-foreground))"
                  fontSize="11"
                  fontWeight={i % 2 === 0 ? 500 : 400}
                >
                  {label.label}
                </text>
              </g>
            ))}

            {/* Axis borders */}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerWidth}
              height={innerHeight}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="1"
            />

            {/* Axis labels */}
            <text
              x={25}
              y={chartHeight / 2}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontSize="13"
              fontWeight="500"
              transform={`rotate(-90, 25, ${chartHeight / 2})`}
            >
              STATIONS (Distance in km)
            </text>
            <text
              x={chartWidth / 2}
              y={chartHeight - 20}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontSize="13"
              fontWeight="500"
            >
              TIME (24-hour format)
            </text>

            {/* Train paths - non-highlighted first */}
            {allPaths
              .filter(p => hoveredTrain !== `${p.type}-${p.id}` && selectedTrain !== `${p.type}-${p.id}`)
              .map((path) => (
                <g 
                  key={`${path.type}-${path.id}`}
                  onMouseEnter={() => setHoveredTrain(`${path.type}-${path.id}`)}
                  onMouseLeave={() => setHoveredTrain(null)}
                  onClick={() => setSelectedTrain(s => s === `${path.type}-${path.id}` ? null : `${path.type}-${path.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <path
                    d={generatePath(path)}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={path.type === 'passenger' ? 2 : 1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={path.type === 'freight' ? "8,4" : (path.isAffected ? "4,2" : "0")}
                    opacity={path.isAffected ? 0.9 : 0.7}
                  />
                </g>
              ))}

            {/* Highlighted paths on top */}
            {allPaths
              .filter(p => hoveredTrain === `${p.type}-${p.id}` || selectedTrain === `${p.type}-${p.id}`)
              .map((path) => (
                <g 
                  key={`highlighted-${path.type}-${path.id}`}
                  onMouseEnter={() => setHoveredTrain(`${path.type}-${path.id}`)}
                  onMouseLeave={() => setHoveredTrain(null)}
                  onClick={() => setSelectedTrain(s => s === `${path.type}-${path.id}` ? null : `${path.type}-${path.id}`)}
                  style={{ cursor: 'pointer' }}
                  filter="url(#glow)"
                >
                  <path
                    d={generatePath(path)}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={path.type === 'passenger' ? 6 : 5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={path.type === 'freight' ? "8,4" : "0"}
                    opacity={0.3}
                  />
                  <path
                    d={generatePath(path)}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={path.type === 'passenger' ? 3 : 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={path.type === 'freight' ? "8,4" : "0"}
                    opacity={1}
                  />
                  
                  {/* Station markers */}
                  {path.movements.map((m, i) => (
                    <g key={i}>
                      <circle
                        cx={xScale(m.arrival)}
                        cy={yScale(m.distance_km)}
                        r={m.isDisrupted ? 7 : (m.is_halt ? 5 : 3)}
                        fill={m.isDisrupted ? "hsl(0, 84%, 60%)" : (m.is_halt ? THEME_COLORS.halt : path.color)}
                        stroke="hsl(var(--background))"
                        strokeWidth={1.5}
                        className={m.isDisrupted ? "animate-pulse" : ""}
                      />
                      {m.isDisrupted && (
                        <text
                          x={xScale(m.arrival)}
                          y={yScale(m.distance_km)}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fill="white"
                          fontSize="8"
                          fontWeight="bold"
                        >
                          !
                        </text>
                      )}
                    </g>
                  ))}

                  {/* Train label */}
                  {path.movements.length > 0 && (
                    <g>
                      <rect
                        x={xScale(path.movements[0].arrival) - 35}
                        y={yScale(path.movements[0].distance_km) - 22}
                        width={70}
                        height={18}
                        rx={3}
                        fill="hsl(var(--popover))"
                        stroke={path.color}
                        strokeWidth={1.5}
                      />
                      <text
                        x={xScale(path.movements[0].arrival)}
                        y={yScale(path.movements[0].distance_km) - 10}
                        textAnchor="middle"
                        fill={path.color}
                        fontSize="10"
                        fontWeight="600"
                      >
                        {path.isAffected ? '⚠ ' : ''}{path.id.length > 8 ? path.id.slice(0, 8) + '…' : path.id}
                      </text>
                    </g>
                  )}
                </g>
              ))}
          </svg>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="p-4 border-t border-border bg-muted/20">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-0.5 rounded" style={{ backgroundColor: THEME_COLORS.passenger }} />
              <span className="text-muted-foreground">Passenger (Red)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-0.5 border-t-2 border-dashed" style={{ borderColor: THEME_COLORS.freight }} />
              <span className="text-muted-foreground">Freight (Green)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-0.5 border-t-2 border-dashed" style={{ borderColor: THEME_COLORS.disrupted }} />
              <span className="text-muted-foreground">Disrupted (Amber)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full bg-destructive flex items-center justify-center">
                <span className="text-white text-xs font-bold">!</span>
              </div>
              <span className="text-muted-foreground">Disruption Zone</span>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Click on any train path to highlight · Affected trains shown in orange with curved rerouting paths
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
