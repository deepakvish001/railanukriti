import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ZoomIn, ZoomOut, RefreshCw, Loader2, Download, Train, ArrowUpDown, AlertTriangle, Radio, Info } from 'lucide-react';
import { useRouteStations } from '@/hooks/useFreightData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, addHours, startOfDay, addSeconds } from 'date-fns';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

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

// Professional color scheme - Red = Passenger, Green = Freight
const COLORS = {
  passenger: '#DC2626',      // Red-600 for passenger trains
  freight: '#16A34A',        // Green-600 for freight trains
  disrupted: '#F59E0B',      // Amber for disrupted trains
  station: '#6366F1',        // Indigo for major stations
  stationMuted: '#94A3B8',   // Slate for minor stations
  disruption: '#EF4444',     // Red for disruption zones
  grid: '#334155',           // Slate-700 for grid
  gridLight: '#1E293B',      // Slate-800 for light grid
};

export function DistanceTimeChart() {
  const { stations, loading: stationsLoading } = useRouteStations();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showFreight, setShowFreight] = useState(true);
  const [showPassenger, setShowPassenger] = useState(true);
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
        .limit(5000);
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
        .limit(10000);
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
        { event: '*', schema: 'public', table: 'disruptions' },
        (payload) => {
          setLastUpdate(new Date());
          queryClient.invalidateQueries({ queryKey: ['disruptions-chart'] });
          
          if (payload.eventType === 'INSERT') {
            const newDisruption = payload.new as Disruption;
            toast.error(`New Disruption: ${newDisruption.disruption_type}`, {
              description: `At ${newDisruption.station_code || newDisruption.block_section_code}`,
              duration: 5000,
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedDisruption = payload.new as Disruption;
            if (!updatedDisruption.is_active) {
              toast.success('Disruption Resolved', { duration: 4000 });
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isLive, queryClient]);

  // Process stations with proper distance (fix null first station)
  const processedStations = useMemo(() => {
    return stations.map(s => ({
      ...s,
      cumulative_distance_km: s.cumulative_distance_km ?? 0,
    })).sort((a, b) => a.seq_no - b.seq_no);
  }, [stations]);

  // Station maps
  const stationDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    processedStations.forEach(s => map.set(s.station_code, s.cumulative_distance_km));
    return map;
  }, [processedStations]);

  const stationSeqMap = useMemo(() => {
    const map = new Map<string, number>();
    processedStations.forEach(s => map.set(s.station_code, s.seq_no));
    return map;
  }, [processedStations]);

  // Disrupted stations set
  const disruptedStations = useMemo(() => {
    const set = new Set<string>();
    disruptions?.forEach(d => {
      if (d.station_code) set.add(d.station_code);
    });
    return set;
  }, [disruptions]);

  // Max distance for Y-axis
  const maxDistance = useMemo(() => {
    if (processedStations.length === 0) return 180;
    return Math.max(...processedStations.map(s => s.cumulative_distance_km), 180);
  }, [processedStations]);

  const baseDate = useMemo(() => startOfDay(new Date()), []);

  // Process freight movements into paths
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
          color: COLORS.freight,
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
        if (path.isAffected) path.color = COLORS.disrupted;
      }
    });

    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [freightMovements, stationDistanceMap, stationSeqMap, disruptedStations]);

  // Process passenger schedules into paths
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
          color: COLORS.passenger,
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
      path.movements.sort((a, b) => a.seq_no - b.seq_no);
      if (path.isAffected) path.color = COLORS.disrupted;
    });

    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [passengerSchedule, stationDistanceMap, stationSeqMap, baseDate, disruptedStations]);

  // Combine all paths based on filters
  const allPaths = useMemo(() => {
    let paths: TrainPath[] = [];
    if (showFreight) paths = [...paths, ...freightPaths];
    if (showPassenger) paths = [...paths, ...passengerPaths];
    return paths;
  }, [freightPaths, passengerPaths, showFreight, showPassenger]);

  // Time range - 24 hours
  const timeRange = useMemo(() => ({
    start: baseDate,
    end: addHours(baseDate, 24),
    hours: 24,
  }), [baseDate]);

  // Chart dimensions
  const MARGIN = { top: 70, right: 80, bottom: 60, left: 140 };
  const BASE_WIDTH = 1800;
  const BASE_HEIGHT = 700;
  const chartWidth = BASE_WIDTH * zoomLevel;
  const chartHeight = BASE_HEIGHT;
  const innerWidth = chartWidth - MARGIN.left - MARGIN.right;
  const innerHeight = chartHeight - MARGIN.top - MARGIN.bottom;

  const xScale = useCallback((time: Date) => {
    const elapsed = time.getTime() - timeRange.start.getTime();
    const totalRange = timeRange.end.getTime() - timeRange.start.getTime();
    return MARGIN.left + (elapsed / totalRange) * innerWidth;
  }, [timeRange, innerWidth]);

  const yScale = useCallback((distance: number) => {
    return MARGIN.top + ((maxDistance - distance) / maxDistance) * innerHeight;
  }, [maxDistance, innerHeight]);

  // Generate SVG path
  const generatePath = useCallback((path: TrainPath) => {
    if (path.movements.length === 0) return '';
    
    let d = '';
    path.movements.forEach((m, i) => {
      const x1 = xScale(m.arrival);
      const y = yScale(m.distance_km);
      
      if (i === 0) {
        d += `M ${x1} ${y}`;
      } else {
        d += ` L ${x1} ${y}`;
      }
      
      // Add horizontal line for halt
      if (m.departure && m.departure.getTime() > m.arrival.getTime()) {
        const x2 = xScale(m.departure);
        d += ` L ${x2} ${y}`;
      }
    });

    return d;
  }, [xScale, yScale]);

  // Hour labels for X-axis
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= 24; i++) {
      const time = addHours(timeRange.start, i);
      labels.push({
        time,
        x: xScale(time),
        label: format(time, 'HH:mm'),
        major: i % 2 === 0,
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
    a.download = `marey-chart-${format(new Date(), 'yyyy-MM-dd')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const refetch = () => {
    refetchFreight();
    refetchPassenger();
    refetchDisruptions();
    toast.success('Data refreshed');
  };

  // Stats
  const stats = useMemo(() => ({
    passenger: passengerPaths.length,
    freight: freightPaths.length,
    affected: allPaths.filter(p => p.isAffected).length,
  }), [allPaths, passengerPaths.length, freightPaths.length]);

  const activeDisruptions = disruptions?.filter(d => d.is_active) ?? [];

  if (freightLoading || passengerLoading || stationsLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center h-[600px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading chart data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card overflow-hidden">
      <CardContent className="p-0">
        {/* Header */}
        <div className="p-4 border-b border-border bg-gradient-to-r from-muted/50 to-muted/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <ArrowUpDown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-bold text-lg text-foreground">Time-Distance Graph (Marey Chart)</h3>
                  <button 
                    onClick={() => setIsLive(!isLive)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      isLive 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                        : 'bg-muted text-muted-foreground border border-border'
                    }`}
                  >
                    <Radio className={`w-3 h-3 ${isLive ? 'animate-pulse' : ''}`} />
                    {isLive ? 'LIVE' : 'PAUSED'}
                  </button>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  KTV → PSA Section • {format(new Date(), 'dd MMM yyyy HH:mm')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}>
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom Out</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Badge variant="outline" className="px-3 font-mono">{Math.round(zoomLevel * 100)}%</Badge>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="sm" onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}>
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Zoom In</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="w-px h-6 bg-border mx-2" />
              <Button variant="outline" size="sm" onClick={refetch}>
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={exportSVG}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Disruption Alert */}
        {activeDisruptions.length > 0 && (
          <div className="px-4 py-2 bg-destructive/10 border-b border-destructive/30">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="w-4 h-4 text-destructive animate-pulse" />
              <span className="font-semibold text-destructive">{activeDisruptions.length} Active Disruption{activeDisruptions.length > 1 ? 's' : ''}:</span>
              <span className="text-muted-foreground">
                {activeDisruptions.map(d => `${d.disruption_type} at ${d.station_code || d.block_section_code}`).join(' | ')}
              </span>
            </div>
          </div>
        )}

        {/* Filters & Legend */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-4 bg-muted/20">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="passenger" checked={showPassenger} onCheckedChange={setShowPassenger} />
              <Label htmlFor="passenger" className="text-sm flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-1 rounded" style={{ backgroundColor: COLORS.passenger }} />
                <span>Passenger</span>
                <Badge variant="secondary" className="text-xs">{stats.passenger}</Badge>
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="freight" checked={showFreight} onCheckedChange={setShowFreight} />
              <Label htmlFor="freight" className="text-sm flex items-center gap-2 cursor-pointer">
                <div className="w-8 h-1 rounded border-t-2 border-dashed" style={{ borderColor: COLORS.freight }} />
                <span>Freight</span>
                <Badge variant="secondary" className="text-xs">{stats.freight}</Badge>
              </Label>
            </div>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <Switch id="disruptions" checked={showDisruptions} onCheckedChange={setShowDisruptions} />
              <Label htmlFor="disruptions" className="text-sm flex items-center gap-2 cursor-pointer">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span>Show Disruptions</span>
              </Label>
            </div>
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Total: <strong className="text-foreground">{allPaths.length}</strong> trains</span>
            {stats.affected > 0 && (
              <span className="text-amber-500">Affected: <strong>{stats.affected}</strong></span>
            )}
          </div>
        </div>

        {/* Chart */}
        <ScrollArea className="w-full" style={{ height: chartHeight + 20 }}>
          <svg 
            ref={svgRef}
            width={chartWidth} 
            height={chartHeight}
            className="bg-slate-950"
          >
            {/* Definitions */}
            <defs>
              <linearGradient id="chartBg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0F172A" />
                <stop offset="100%" stopColor="#020617" />
              </linearGradient>
              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <pattern id="disruptionPattern" patternUnits="userSpaceOnUse" width="8" height="8">
                <line x1="0" y1="8" x2="8" y2="0" stroke={COLORS.disruption} strokeWidth="1" opacity="0.4" />
              </pattern>
            </defs>

            {/* Background */}
            <rect width={chartWidth} height={chartHeight} fill="url(#chartBg)" />
            <rect x={MARGIN.left} y={MARGIN.top} width={innerWidth} height={innerHeight} fill="#0F172A" />

            {/* Title */}
            <text x={chartWidth / 2} y={30} textAnchor="middle" fill="#F8FAFC" fontSize="16" fontWeight="700" fontFamily="system-ui">
              KOTTAVALASA (KTV) — PALASA (PSA) SECTION
            </text>
            <text x={chartWidth / 2} y={50} textAnchor="middle" fill="#94A3B8" fontSize="12" fontFamily="system-ui">
              Distance: {maxDistance.toFixed(1)} km • Stations: {processedStations.length} • Time: 24 Hours
            </text>

            {/* Disruption Zones */}
            {showDisruptions && activeDisruptions.map((disruption) => {
              const stationCode = disruption.station_code;
              if (!stationCode) return null;
              const distance = stationDistanceMap.get(stationCode);
              if (distance === undefined) return null;
              
              const y = yScale(distance);
              const bandHeight = 24;

              return (
                <g key={disruption.id}>
                  <rect
                    x={MARGIN.left}
                    y={y - bandHeight / 2}
                    width={innerWidth}
                    height={bandHeight}
                    fill="url(#disruptionPattern)"
                  />
                  <rect
                    x={MARGIN.left}
                    y={y - bandHeight / 2}
                    width={innerWidth}
                    height={bandHeight}
                    fill={COLORS.disruption}
                    opacity="0.15"
                  />
                  <circle cx={MARGIN.left - 15} cy={y} r={10} fill={COLORS.disruption} className="animate-pulse" />
                  <text x={MARGIN.left - 15} y={y} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="12" fontWeight="bold">!</text>
                </g>
              );
            })}

            {/* Grid Lines - Stations (Horizontal) */}
            {processedStations.map((station) => {
              const y = yScale(station.cumulative_distance_km);
              const isJunction = station.is_junction;
              const isDisrupted = disruptedStations.has(station.station_code);
              
              return (
                <g key={station.station_code}>
                  <line
                    x1={MARGIN.left}
                    y1={y}
                    x2={chartWidth - MARGIN.right}
                    y2={y}
                    stroke={isDisrupted ? COLORS.disruption : (isJunction ? COLORS.grid : COLORS.gridLight)}
                    strokeWidth={isJunction ? 1 : 0.5}
                    opacity={isDisrupted ? 0.8 : 0.6}
                  />
                  {/* Station marker */}
                  <circle
                    cx={MARGIN.left - 8}
                    cy={y}
                    r={isJunction ? 4 : 2.5}
                    fill={isDisrupted ? COLORS.disruption : (isJunction ? COLORS.station : COLORS.stationMuted)}
                  />
                  {/* Station name */}
                  <text
                    x={MARGIN.left - 14}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill={isDisrupted ? COLORS.disruption : (isJunction ? '#E2E8F0' : '#94A3B8')}
                    fontSize={isJunction ? 11 : 9}
                    fontWeight={isJunction ? 600 : 400}
                    fontFamily="system-ui"
                  >
                    {station.station_code}
                  </text>
                  {/* Distance on right */}
                  <text
                    x={chartWidth - MARGIN.right + 8}
                    y={y}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fill="#64748B"
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {station.cumulative_distance_km.toFixed(0)}km
                  </text>
                </g>
              );
            })}

            {/* Grid Lines - Time (Vertical) */}
            {hourLabels.map((label, i) => (
              <g key={i}>
                <line
                  x1={label.x}
                  y1={MARGIN.top}
                  x2={label.x}
                  y2={chartHeight - MARGIN.bottom}
                  stroke={COLORS.gridLight}
                  strokeWidth={label.major ? 1 : 0.5}
                  opacity={label.major ? 0.5 : 0.3}
                />
                {label.major && (
                  <text
                    x={label.x}
                    y={chartHeight - MARGIN.bottom + 20}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="11"
                    fontWeight="500"
                    fontFamily="monospace"
                  >
                    {label.label}
                  </text>
                )}
              </g>
            ))}

            {/* Axis border */}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerWidth}
              height={innerHeight}
              fill="none"
              stroke={COLORS.grid}
              strokeWidth="1"
            />

            {/* Axis Labels */}
            <text
              x={20}
              y={chartHeight / 2}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="12"
              fontWeight="600"
              transform={`rotate(-90, 20, ${chartHeight / 2})`}
              fontFamily="system-ui"
            >
              STATIONS (Distance)
            </text>
            <text
              x={chartWidth / 2}
              y={chartHeight - 15}
              textAnchor="middle"
              fill="#94A3B8"
              fontSize="12"
              fontWeight="600"
              fontFamily="system-ui"
            >
              TIME (Hours)
            </text>

            {/* Train Paths - Non-highlighted */}
            {allPaths
              .filter(p => hoveredTrain !== `${p.type}-${p.id}` && selectedTrain !== `${p.type}-${p.id}`)
              .map((path) => (
                <path
                  key={`${path.type}-${path.id}`}
                  d={generatePath(path)}
                  fill="none"
                  stroke={path.color}
                  strokeWidth={path.type === 'passenger' ? 2 : 1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={path.type === 'freight' ? "6,3" : "0"}
                  opacity={0.7}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHoveredTrain(`${path.type}-${path.id}`)}
                  onMouseLeave={() => setHoveredTrain(null)}
                  onClick={() => setSelectedTrain(s => s === `${path.type}-${path.id}` ? null : `${path.type}-${path.id}`)}
                />
              ))}

            {/* Train Paths - Highlighted */}
            {allPaths
              .filter(p => hoveredTrain === `${p.type}-${p.id}` || selectedTrain === `${p.type}-${p.id}`)
              .map((path) => (
                <g key={`highlighted-${path.type}-${path.id}`} filter="url(#glow)">
                  <path
                    d={generatePath(path)}
                    fill="none"
                    stroke={path.color}
                    strokeWidth={path.type === 'passenger' ? 4 : 3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={path.type === 'freight' ? "6,3" : "0"}
                    opacity={1}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredTrain(`${path.type}-${path.id}`)}
                    onMouseLeave={() => setHoveredTrain(null)}
                    onClick={() => setSelectedTrain(s => s === `${path.type}-${path.id}` ? null : `${path.type}-${path.id}`)}
                  />
                  {/* Train ID label */}
                  {path.movements.length > 0 && (
                    <text
                      x={xScale(path.movements[0].arrival) + 5}
                      y={yScale(path.movements[0].distance_km) - 8}
                      fill={path.color}
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="system-ui"
                    >
                      {path.id}
                    </text>
                  )}
                  {/* Station markers */}
                  {path.movements.map((m, i) => (
                    <circle
                      key={i}
                      cx={xScale(m.arrival)}
                      cy={yScale(m.distance_km)}
                      r={m.is_halt ? 4 : 2.5}
                      fill={m.isDisrupted ? COLORS.disruption : path.color}
                      stroke="#0F172A"
                      strokeWidth={1}
                    />
                  ))}
                </g>
              ))}
          </svg>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="p-4 border-t border-border bg-muted/10">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 rounded" style={{ backgroundColor: COLORS.passenger }} />
              <span className="text-muted-foreground">Passenger (Red - Solid)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0 border-t-2 border-dashed" style={{ borderColor: COLORS.freight }} />
              <span className="text-muted-foreground">Freight (Green - Dashed)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 rounded" style={{ backgroundColor: COLORS.disrupted }} />
              <span className="text-muted-foreground">Disrupted (Amber)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: COLORS.disruption }}>!</div>
              <span className="text-muted-foreground">Disruption Zone</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
