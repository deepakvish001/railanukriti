import { useMemo, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ZoomIn, ZoomOut, RefreshCw, Loader2, Download } from 'lucide-react';
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

// Colors based on reference image
const COLORS = {
  passengerDN: '#dc2626', // Red - Downline Passenger (solid)
  passengerUP: '#2563eb', // Blue - Upline Passenger (solid)
  freightDN: '#059669',   // Green - Downline Freight (dashed)
  freightUP: '#7c3aed',   // Purple - Upline Freight (dashed)
  halt: '#94a3b8',        // Gray - Waiting/dwell
};

export function DistanceTimeChart() {
  const { stations, loading: stationsLoading } = useRouteStations();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showFreight, setShowFreight] = useState(true);
  const [showPassenger, setShowPassenger] = useState(true);
  const [showUpline, setShowUpline] = useState(true);
  const [showDownline, setShowDownline] = useState(true);
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

  // Ordered stations for Y-axis (PSA at top, KTV at bottom like reference)
  const orderedStations = useMemo(() => {
    return [...stations].sort((a, b) => b.seq_no - a.seq_no); // Reverse order
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
          direction: 'DN', // Will determine from movement pattern
          color: COLORS.freightDN,
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
        // If distance increases, it's DN (KTV→PSA), else UP (PSA→KTV)
        path.direction = first.distance_km < last.distance_km ? 'DN' : 'UP';
        path.color = path.direction === 'DN' ? COLORS.freightDN : COLORS.freightUP;
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
          color: dir === 'DN' ? COLORS.passengerDN : COLORS.passengerUP,
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

  // Time range (0:00 to 24:00 for a full day)
  const timeRange = useMemo(() => {
    return {
      start: baseDate,
      end: addHours(baseDate, 24),
      hours: 24,
    };
  }, [baseDate]);

  // Chart dimensions
  const MARGIN = { top: 60, right: 80, bottom: 100, left: 140 };
  const BASE_WIDTH = 1400;
  const BASE_HEIGHT = 700;
  const chartWidth = BASE_WIDTH * zoomLevel;
  const chartHeight = BASE_HEIGHT;
  const innerWidth = chartWidth - MARGIN.left - MARGIN.right;
  const innerHeight = chartHeight - MARGIN.top - MARGIN.bottom;

  // Scale functions
  const xScale = (time: Date) => {
    const elapsed = time.getTime() - timeRange.start.getTime();
    const totalRange = timeRange.end.getTime() - timeRange.start.getTime();
    return MARGIN.left + (elapsed / totalRange) * innerWidth;
  };

  const yScale = (distance: number) => {
    // Inverted so PSA (max distance) is at top
    return MARGIN.top + ((maxDistance - distance) / maxDistance) * innerHeight;
  };

  // Generate path with dwell times
  const generatePath = (path: TrainPath) => {
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
  };

  // Hour labels
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= 12; i++) {
      const time = addHours(timeRange.start, i * 2);
      labels.push({
        time,
        x: xScale(time),
        label: format(time, 'H:mm'),
      });
    }
    return labels;
  }, [timeRange, innerWidth]);

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

  if (freightLoading || passengerLoading || stationsLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center h-[700px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading chart data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Live Marey diagram · KTV → PSA</span>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}>
              <ZoomIn className="w-4 h-4 mr-1" /> Zoom in
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}>
              <ZoomOut className="w-4 h-4 mr-1" /> Zoom out
            </Button>
            <Button variant="outline" size="sm" onClick={() => setZoomLevel(1)}>Reset</Button>
            <Button variant="outline" size="sm" onClick={exportSVG}>
              <Download className="w-4 h-4 mr-1" /> Export SVG
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-6 mb-4 p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Switch id="passenger" checked={showPassenger} onCheckedChange={setShowPassenger} />
            <Label htmlFor="passenger" className="text-sm">Passenger</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="freight" checked={showFreight} onCheckedChange={setShowFreight} />
            <Label htmlFor="freight" className="text-sm">Freight</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="upline" checked={showUpline} onCheckedChange={setShowUpline} />
            <Label htmlFor="upline" className="text-sm">Upline (PSA→KTV)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="downline" checked={showDownline} onCheckedChange={setShowDownline} />
            <Label htmlFor="downline" className="text-sm">Downline (KTV→PSA)</Label>
          </div>
          <Badge variant="secondary">{allPaths.length} trains</Badge>
        </div>

        <ScrollArea className="w-full" style={{ height: chartHeight + 20 }}>
          <TooltipProvider>
            <svg 
              ref={svgRef}
              width={chartWidth} 
              height={chartHeight}
              className="bg-background rounded-lg"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              {/* Title */}
              <text
                x={chartWidth / 2}
                y={30}
                textAnchor="middle"
                fill="hsl(var(--foreground))"
                fontSize="16"
                fontWeight="600"
              >
                Kottavalasa (KTV) → Palasa (PSA) — Time vs Distance Simulation
              </text>

              {/* Grid */}
              <g>
                {/* Horizontal grid lines (stations) */}
                {orderedStations.map((station) => {
                  const y = yScale(station.cumulative_distance_km ?? 0);
                  return (
                    <g key={station.station_code}>
                      <line
                        x1={MARGIN.left}
                        y1={y}
                        x2={chartWidth - MARGIN.right}
                        y2={y}
                        stroke="hsl(var(--border))"
                        strokeWidth="1"
                        opacity="0.5"
                      />
                      {/* Station name on left */}
                      <text
                        x={MARGIN.left - 8}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="hsl(var(--foreground))"
                        fontSize="11"
                      >
                        {station.station_name}
                      </text>
                      {/* Distance on right */}
                      <text
                        x={chartWidth - MARGIN.right + 8}
                        y={y}
                        textAnchor="start"
                        dominantBaseline="middle"
                        fill="hsl(var(--muted-foreground))"
                        fontSize="10"
                      >
                        {(station.cumulative_distance_km ?? 0).toFixed(2)} km
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
                      strokeWidth="1"
                      opacity="0.3"
                    />
                    <text
                      x={label.x}
                      y={chartHeight - MARGIN.bottom + 20}
                      textAnchor="middle"
                      fill="hsl(var(--muted-foreground))"
                      fontSize="11"
                    >
                      {label.label}
                    </text>
                  </g>
                ))}
              </g>

              {/* Axis labels */}
              <text
                x={20}
                y={chartHeight / 2}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize="12"
                fontWeight="500"
                transform={`rotate(-90, 20, ${chartHeight / 2})`}
              >
                Distance (km) - Stations
              </text>
              <text
                x={chartWidth / 2}
                y={chartHeight - MARGIN.bottom + 45}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize="12"
                fontWeight="500"
              >
                Time (hours)
              </text>

              {/* Train paths */}
              {allPaths.map((path) => (
                <g key={`${path.type}-${path.id}`}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <path
                        d={generatePath(path)}
                        fill="none"
                        stroke={path.color}
                        strokeWidth={path.type === 'passenger' ? 2.5 : 1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray={path.type === 'freight' ? "6,4" : "0"}
                        opacity={0.85}
                        style={{ cursor: 'pointer' }}
                      />
                    </TooltipTrigger>
                    <TooltipContent className="bg-popover border-border">
                      <div className="text-sm space-y-1">
                        <div className="font-semibold">{path.id}</div>
                        <div className="text-muted-foreground">
                          Type: <span className="text-foreground capitalize">{path.type}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Direction: <span className="text-foreground">{path.direction === 'DN' ? 'Downline (KTV→PSA)' : 'Upline (PSA→KTV)'}</span>
                        </div>
                        <div className="text-muted-foreground">
                          Stops: <span className="text-foreground">{path.movements.length}</span>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>

                  {/* Halt markers */}
                  {path.movements.filter(m => m.is_halt).map((m, i) => (
                    <circle
                      key={i}
                      cx={xScale(m.arrival)}
                      cy={yScale(m.distance_km)}
                      r={3}
                      fill={COLORS.halt}
                      stroke="white"
                      strokeWidth="1"
                    />
                  ))}
                </g>
              ))}
            </svg>
          </TooltipProvider>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-6 pt-4 border-t border-border text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5" style={{ backgroundColor: COLORS.passengerDN }} />
            <span>Downline Passenger (solid)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5" style={{ backgroundColor: COLORS.passengerUP }} />
            <span>Upline Passenger (solid)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: COLORS.freightDN }} />
            <span>Downline Freight (dashed)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 border-t-2 border-dashed" style={{ borderColor: COLORS.freightUP }} />
            <span>Upline Freight (dashed)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.halt }} />
            <span>Waiting / dwell</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
