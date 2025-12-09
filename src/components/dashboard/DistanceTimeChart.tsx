import { useMemo, useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ZoomIn, ZoomOut, RefreshCw, Loader2, Download, Train, ArrowUpDown } from 'lucide-react';
import { useRouteStations } from '@/hooks/useFreightData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, addHours, startOfDay, addSeconds } from 'date-fns';

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

interface TrainPath {
  id: string;
  type: 'freight' | 'passenger';
  direction: 'UP' | 'DN';
  color: string;
  movements: {
    station_code: string;
    distance_km: number;
    seq_no: number;
    arrival: Date;
    departure: Date | null;
    is_halt: boolean;
  }[];
}

// Theme-aware colors using CSS variables mapped to HSL
const THEME_COLORS = {
  passengerDN: 'hsl(0, 84%, 60%)',      // Red - Downline Passenger
  passengerUP: 'hsl(221, 83%, 53%)',    // Blue - Upline Passenger  
  freightDN: 'hsl(142, 76%, 36%)',      // Green - Downline Freight
  freightUP: 'hsl(280, 70%, 50%)',      // Purple - Upline Freight
  halt: 'hsl(215, 16%, 47%)',           // Muted - Waiting/dwell
  stationMarker: 'hsl(38, 92%, 50%)',   // Accent - Station markers
};

export function DistanceTimeChart() {
  const { stations, loading: stationsLoading } = useRouteStations();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showFreight, setShowFreight] = useState(true);
  const [showPassenger, setShowPassenger] = useState(true);
  const [showUpline, setShowUpline] = useState(true);
  const [showDownline, setShowDownline] = useState(true);
  const [hoveredTrain, setHoveredTrain] = useState<string | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

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

  // Ordered stations for Y-axis (PSA at top, KTV at bottom)
  const orderedStations = useMemo(() => {
    return [...stations].sort((a, b) => b.seq_no - a.seq_no);
  }, [stations]);

  const maxDistance = useMemo(() => {
    if (orderedStations.length === 0) return 180;
    return Math.max(...stations.map(s => s.cumulative_distance_km ?? 0));
  }, [orderedStations, stations]);

  // Base date for passenger schedules
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
          color: THEME_COLORS.freightDN,
          movements: [],
        });
      }

      pathMap.get(m.load_id)!.movements.push({
        station_code: m.station_code,
        distance_km: distance,
        seq_no: seq,
        arrival: parseISO(m.arrival_time),
        departure: m.departure_time ? parseISO(m.departure_time) : null,
        is_halt: m.is_stoppage,
      });
    });

    // Sort and determine direction
    pathMap.forEach(path => {
      path.movements.sort((a, b) => a.arrival.getTime() - b.arrival.getTime());
      
      if (path.movements.length >= 2) {
        const first = path.movements[0];
        const last = path.movements[path.movements.length - 1];
        path.direction = first.distance_km < last.distance_km ? 'DN' : 'UP';
        path.color = path.direction === 'DN' ? THEME_COLORS.freightDN : THEME_COLORS.freightUP;
      }
    });

    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [freightMovements, stationDistanceMap, stationSeqMap]);

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
          color: dir === 'DN' ? THEME_COLORS.passengerDN : THEME_COLORS.passengerUP,
          movements: [],
        });
      }

      const arrivalDate = s.arrival_seconds !== null ? addSeconds(baseDate, s.arrival_seconds) : null;
      const departureDate = s.departure_seconds !== null ? addSeconds(baseDate, s.departure_seconds) : null;

      if (arrivalDate) {
        pathMap.get(key)!.movements.push({
          station_code: s.station_code,
          distance_km: distance,
          seq_no: seq,
          arrival: arrivalDate,
          departure: departureDate,
          is_halt: s.is_halt || false,
        });
      }
    });

    // Sort by route sequence
    pathMap.forEach(path => {
      path.movements.sort((a, b) => {
        if (path.direction === 'DN') return a.seq_no - b.seq_no;
        return b.seq_no - a.seq_no;
      });
    });

    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [passengerSchedule, stationDistanceMap, stationSeqMap, baseDate]);

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

  // Time range (0:00 to 24:00)
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

  // Scale functions
  const xScale = useCallback((time: Date) => {
    const elapsed = time.getTime() - timeRange.start.getTime();
    const totalRange = timeRange.end.getTime() - timeRange.start.getTime();
    return MARGIN.left + (elapsed / totalRange) * innerWidth;
  }, [timeRange, innerWidth, MARGIN.left]);

  const yScale = useCallback((distance: number) => {
    return MARGIN.top + ((maxDistance - distance) / maxDistance) * innerHeight;
  }, [maxDistance, innerHeight, MARGIN.top]);

  // Generate smooth path
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
      
      // Add horizontal line for dwell time
      if (m.departure && m.departure.getTime() > m.arrival.getTime()) {
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

  // Export SVG
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
  };

  // Stats
  const stats = useMemo(() => ({
    totalTrains: allPaths.length,
    passenger: allPaths.filter(p => p.type === 'passenger').length,
    freight: allPaths.filter(p => p.type === 'freight').length,
    upline: allPaths.filter(p => p.direction === 'UP').length,
    downline: allPaths.filter(p => p.direction === 'DN').length,
  }), [allPaths]);

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
                <h3 className="font-semibold text-foreground">Distance-Time (Marey) Chart</h3>
                <p className="text-sm text-muted-foreground">KTV → PSA Section · Real-time train movements</p>
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
        </div>

        {/* Filters & Stats */}
        <div className="p-4 border-b border-border flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch id="passenger" checked={showPassenger} onCheckedChange={setShowPassenger} />
              <Label htmlFor="passenger" className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: THEME_COLORS.passengerDN }} />
                Passenger
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="freight" checked={showFreight} onCheckedChange={setShowFreight} />
              <Label htmlFor="freight" className="text-sm flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: THEME_COLORS.freightDN }} />
                Freight
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
          </div>
          
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="gap-1">
              <Train className="w-3 h-3" /> {stats.totalTrains} trains
            </Badge>
            <Badge variant="outline" className="text-xs">
              P: {stats.passenger} | F: {stats.freight}
            </Badge>
            <Badge variant="outline" className="text-xs">
              ↑{stats.upline} | ↓{stats.downline}
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
            {/* Definitions for gradients and effects */}
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
            </defs>

            {/* Background */}
            <rect x={MARGIN.left} y={MARGIN.top} width={innerWidth} height={innerHeight} fill="url(#chartBg)" />

            {/* Title */}
            <text
              x={chartWidth / 2}
              y={35}
              textAnchor="middle"
              fill="hsl(var(--foreground))"
              fontSize="18"
              fontWeight="600"
            >
              Kottavalasa (KTV) → Palasa (PSA) Section
            </text>
            <text
              x={chartWidth / 2}
              y={55}
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
              fontSize="13"
            >
              Time vs Distance Simulation · {format(new Date(), 'dd MMM yyyy')}
            </text>

            {/* Horizontal grid lines (stations) */}
            {orderedStations.map((station, idx) => {
              const y = yScale(station.cumulative_distance_km ?? 0);
              const isJunction = station.is_junction;
              return (
                <g key={station.station_code}>
                  <line
                    x1={MARGIN.left}
                    y1={y}
                    x2={chartWidth - MARGIN.right}
                    y2={y}
                    stroke="hsl(var(--border))"
                    strokeWidth={isJunction ? 1.5 : 0.5}
                    opacity={isJunction ? 0.8 : 0.4}
                  />
                  {/* Station marker circle */}
                  <circle
                    cx={MARGIN.left - 12}
                    cy={y}
                    r={isJunction ? 5 : 3}
                    fill={isJunction ? THEME_COLORS.stationMarker : 'hsl(var(--muted-foreground))'}
                    stroke="hsl(var(--background))"
                    strokeWidth={1}
                  />
                  {/* Station name */}
                  <text
                    x={MARGIN.left - 22}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill="hsl(var(--foreground))"
                    fontSize={isJunction ? 12 : 10}
                    fontWeight={isJunction ? 600 : 400}
                  >
                    {station.station_name}
                  </text>
                  {/* Station code */}
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
                  {/* Distance */}
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

            {/* Train paths - render non-hovered first, then hovered on top */}
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
                    strokeDasharray={path.type === 'freight' ? "8,4" : "0"}
                    opacity={0.7}
                  />
                </g>
              ))}

            {/* Hovered/Selected paths on top */}
            {allPaths
              .filter(p => hoveredTrain === `${p.type}-${p.id}` || selectedTrain === `${p.type}-${p.id}`)
              .map((path) => {
                const isSelected = selectedTrain === `${path.type}-${path.id}`;
                return (
                  <g 
                    key={`highlighted-${path.type}-${path.id}`}
                    onMouseEnter={() => setHoveredTrain(`${path.type}-${path.id}`)}
                    onMouseLeave={() => setHoveredTrain(null)}
                    onClick={() => setSelectedTrain(s => s === `${path.type}-${path.id}` ? null : `${path.type}-${path.id}`)}
                    style={{ cursor: 'pointer' }}
                    filter="url(#glow)"
                  >
                    {/* Glow effect */}
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
                    {/* Main line */}
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
                    
                    {/* Station markers for highlighted train */}
                    {path.movements.map((m, i) => (
                      <g key={i}>
                        <circle
                          cx={xScale(m.arrival)}
                          cy={yScale(m.distance_km)}
                          r={m.is_halt ? 5 : 3}
                          fill={m.is_halt ? THEME_COLORS.halt : path.color}
                          stroke="hsl(var(--background))"
                          strokeWidth={1.5}
                        />
                        {/* Dwell time marker */}
                        {m.departure && m.departure.getTime() > m.arrival.getTime() && (
                          <circle
                            cx={xScale(m.departure)}
                            cy={yScale(m.distance_km)}
                            r={3}
                            fill={path.color}
                            stroke="hsl(var(--background))"
                            strokeWidth={1}
                          />
                        )}
                      </g>
                    ))}

                    {/* Train label */}
                    {path.movements.length > 0 && (
                      <g>
                        <rect
                          x={xScale(path.movements[0].arrival) - 30}
                          y={yScale(path.movements[0].distance_km) - 20}
                          width={60}
                          height={16}
                          rx={3}
                          fill="hsl(var(--popover))"
                          stroke={path.color}
                          strokeWidth={1}
                        />
                        <text
                          x={xScale(path.movements[0].arrival)}
                          y={yScale(path.movements[0].distance_km) - 9}
                          textAnchor="middle"
                          fill={path.color}
                          fontSize="10"
                          fontWeight="600"
                        >
                          {path.id.length > 8 ? path.id.slice(0, 8) + '…' : path.id}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
          </svg>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="p-4 border-t border-border bg-muted/20">
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-0.5 rounded" style={{ backgroundColor: THEME_COLORS.passengerDN }} />
              <span className="text-muted-foreground">DN Passenger</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-0.5 rounded" style={{ backgroundColor: THEME_COLORS.passengerUP }} />
              <span className="text-muted-foreground">UP Passenger</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-0.5 border-t-2 border-dashed" style={{ borderColor: THEME_COLORS.freightDN }} />
              <span className="text-muted-foreground">DN Freight</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-0.5 border-t-2 border-dashed" style={{ borderColor: THEME_COLORS.freightUP }} />
              <span className="text-muted-foreground">UP Freight</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: THEME_COLORS.halt }} />
              <span className="text-muted-foreground">Halt/Stoppage</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: THEME_COLORS.stationMarker }} />
              <span className="text-muted-foreground">Junction</span>
            </div>
          </div>
          <p className="text-center text-xs text-muted-foreground mt-3">
            Click on any train path to highlight · Hover for details · Use scroll to pan horizontally
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
