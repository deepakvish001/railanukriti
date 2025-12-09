import { useMemo, useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Train, ZoomIn, ZoomOut, Clock, RefreshCw, Loader2 } from 'lucide-react';
import { useRouteStations } from '@/hooks/useFreightData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, differenceInHours, startOfDay, addHours } from 'date-fns';

interface MovementData {
  load_id: string;
  station_code: string;
  arrival_time: string;
  departure_time: string | null;
  speed: number | null;
  is_stoppage: boolean;
}

interface TrainPath {
  load_id: string;
  color: string;
  movements: {
    station_code: string;
    distance_km: number;
    seq_no: number;
    arrival: Date;
    departure: Date | null;
    speed: number;
    is_stoppage: boolean;
  }[];
}

const TRAIN_COLORS = [
  '#f59e0b', '#22c55e', '#3b82f6', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#0ea5e9', '#d946ef',
];

export function DistanceTimeChart() {
  const { stations, loading: stationsLoading } = useRouteStations();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [hoveredTrain, setHoveredTrain] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Fetch movements data
  const { data: movements, isLoading, refetch } = useQuery({
    queryKey: ['distance-time-movements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freight_movements')
        .select('load_id, station_code, arrival_time, departure_time, speed, is_stoppage')
        .not('arrival_time', 'is', null)
        .order('load_id')
        .order('arrival_time', { ascending: true })
        .limit(3000);
      
      if (error) throw error;
      return data as MovementData[];
    },
  });

  // Create station distance and sequence map
  const stationDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    stations.forEach(s => {
      const distance = s.cumulative_distance_km ?? 0;
      map.set(s.station_code, distance);
    });
    return map;
  }, [stations]);

  const stationSeqMap = useMemo(() => {
    const map = new Map<string, number>();
    stations.forEach(s => {
      map.set(s.station_code, s.seq_no);
    });
    return map;
  }, [stations]);

  // Ordered stations for Y-axis
  const orderedStations = useMemo(() => {
    return [...stations].sort((a, b) => a.seq_no - b.seq_no);
  }, [stations]);

  // Max distance for scaling
  const maxDistance = useMemo(() => {
    if (orderedStations.length === 0) return 180;
    const last = orderedStations[orderedStations.length - 1];
    return last.cumulative_distance_km ?? 180;
  }, [orderedStations]);

  // Process movements into train paths - sorted by route sequence
  const trainPaths = useMemo(() => {
    if (!movements || movements.length === 0) return [];

    const pathMap = new Map<string, TrainPath>();
    
    movements.forEach((m) => {
      const distance = stationDistanceMap.get(m.station_code);
      const seq = stationSeqMap.get(m.station_code);
      
      // Skip if station not in our route
      if (distance === undefined || seq === undefined) return;

      if (!pathMap.has(m.load_id)) {
        pathMap.set(m.load_id, {
          load_id: m.load_id,
          color: TRAIN_COLORS[pathMap.size % TRAIN_COLORS.length],
          movements: [],
        });
      }

      pathMap.get(m.load_id)!.movements.push({
        station_code: m.station_code,
        distance_km: distance,
        seq_no: seq,
        arrival: parseISO(m.arrival_time),
        departure: m.departure_time ? parseISO(m.departure_time) : null,
        speed: m.speed || 0,
        is_stoppage: m.is_stoppage,
      });
    });

    // Sort movements within each train by route sequence (station order)
    pathMap.forEach(path => {
      path.movements.sort((a, b) => a.seq_no - b.seq_no);
    });

    // Filter trains with at least 2 movements to show proper path
    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [movements, stationDistanceMap, stationSeqMap]);

  // Time range calculations
  const timeRange = useMemo(() => {
    if (trainPaths.length === 0) {
      const now = new Date();
      return {
        start: startOfDay(now),
        end: addHours(startOfDay(now), 24),
        hours: 24,
      };
    }

    let minTime = Infinity;
    let maxTime = -Infinity;

    trainPaths.forEach(path => {
      path.movements.forEach(m => {
        minTime = Math.min(minTime, m.arrival.getTime());
        if (m.departure) {
          maxTime = Math.max(maxTime, m.departure.getTime());
        } else {
          maxTime = Math.max(maxTime, m.arrival.getTime());
        }
      });
    });

    const start = new Date(minTime);
    const end = new Date(maxTime);
    const hours = Math.max(differenceInHours(end, start), 1);

    return { start, end, hours };
  }, [trainPaths]);

  // Chart dimensions
  const MARGIN = { top: 40, right: 30, bottom: 40, left: 80 };
  const BASE_WIDTH = 1200;
  const BASE_HEIGHT = 600;
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
    return MARGIN.top + (distance / maxDistance) * innerHeight;
  };

  // Generate path string for a train
  const generatePath = (path: TrainPath) => {
    if (path.movements.length === 0) return '';
    
    const points = path.movements.map(m => ({
      x: xScale(m.arrival),
      y: yScale(m.distance_km),
    }));

    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  };

  // Generate hour labels for X-axis
  const hourLabels = useMemo(() => {
    const labels = [];
    const startHour = timeRange.start.getHours();
    const totalHours = Math.ceil(timeRange.hours);
    
    for (let i = 0; i <= totalHours; i += Math.max(1, Math.floor(totalHours / 12))) {
      const time = addHours(timeRange.start, i);
      labels.push({
        time,
        x: xScale(time),
        label: format(time, 'HH:mm'),
      });
    }
    return labels;
  }, [timeRange, innerWidth]);

  if (isLoading || stationsLoading) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="flex items-center justify-center h-[600px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading chart data...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-lg font-semibold text-foreground">
              Distance–Time Graph (Marey Chart)
            </CardTitle>
            <Badge variant="outline" className="border-primary/50 text-primary">
              {trainPaths.length} trains
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Select 
              value={selectedTrain || 'all'} 
              onValueChange={(v) => setSelectedTrain(v === 'all' ? null : v)}
            >
              <SelectTrigger className="w-[200px] h-8 text-sm">
                <SelectValue placeholder="All trains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trains</SelectItem>
                {trainPaths.slice(0, 20).map((path) => (
                  <SelectItem key={path.load_id} value={path.load_id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: path.color }}
                      />
                      <span className="truncate max-w-[150px]">{path.load_id}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <ScrollArea className="w-full" style={{ height: chartHeight + 40 }}>
          <TooltipProvider>
            <svg 
              ref={svgRef}
              width={chartWidth} 
              height={chartHeight}
              className="bg-background/50 rounded-lg"
            >
              {/* Grid lines */}
              <g className="grid-lines">
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
                        strokeDasharray={station.is_junction ? "0" : "4,4"}
                        opacity={station.is_junction ? 0.6 : 0.3}
                      />
                      {/* Station label */}
                      <text
                        x={MARGIN.left - 8}
                        y={y}
                        textAnchor="end"
                        dominantBaseline="middle"
                        fill="hsl(var(--muted-foreground))"
                        fontSize="11"
                        fontFamily="monospace"
                      >
                        {station.station_code}
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
                      fontFamily="monospace"
                    >
                      {label.label}
                    </text>
                  </g>
                ))}
              </g>

              {/* Y-axis label */}
              <text
                x={15}
                y={chartHeight / 2}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize="12"
                fontWeight="500"
                transform={`rotate(-90, 15, ${chartHeight / 2})`}
              >
                Stations (Distance km)
              </text>

              {/* X-axis label */}
              <text
                x={chartWidth / 2}
                y={chartHeight - 5}
                textAnchor="middle"
                fill="hsl(var(--muted-foreground))"
                fontSize="12"
                fontWeight="500"
              >
                Time
              </text>

              {/* Train paths */}
              {trainPaths
                .filter(path => !selectedTrain || path.load_id === selectedTrain)
                .map((path) => {
                  const isHighlighted = hoveredTrain === path.load_id || selectedTrain === path.load_id;
                  const opacity = hoveredTrain ? (isHighlighted ? 1 : 0.2) : (selectedTrain ? (isHighlighted ? 1 : 0.3) : 0.8);
                  
                  return (
                    <g 
                      key={path.load_id}
                      onMouseEnter={() => setHoveredTrain(path.load_id)}
                      onMouseLeave={() => setHoveredTrain(null)}
                      style={{ cursor: 'pointer' }}
                    >
                      {/* Path line */}
                      <path
                        d={generatePath(path)}
                        fill="none"
                        stroke={path.color}
                        strokeWidth={isHighlighted ? 3 : 2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={opacity}
                        strokeDasharray={path.movements.some(m => m.is_stoppage) ? "6,3" : "0"}
                      />

                      {/* Station points */}
                      {path.movements.map((m, i) => (
                        <Tooltip key={`${path.load_id}-${i}`}>
                          <TooltipTrigger asChild>
                            <circle
                              cx={xScale(m.arrival)}
                              cy={yScale(m.distance_km)}
                              r={isHighlighted ? 5 : 3}
                              fill={m.is_stoppage ? '#ef4444' : path.color}
                              stroke="hsl(var(--background))"
                              strokeWidth="1.5"
                              opacity={opacity}
                            />
                          </TooltipTrigger>
                          <TooltipContent className="bg-popover border-border">
                            <div className="text-sm space-y-1">
                              <div className="font-semibold text-foreground">{path.load_id}</div>
                              <div className="text-muted-foreground">
                                Station: <span className="text-foreground">{m.station_code}</span>
                              </div>
                              <div className="text-muted-foreground">
                                Arrival: <span className="text-foreground">{format(m.arrival, 'HH:mm')}</span>
                              </div>
                              {m.departure && (
                                <div className="text-muted-foreground">
                                  Departure: <span className="text-foreground">{format(m.departure, 'HH:mm')}</span>
                                </div>
                              )}
                              <div className="text-muted-foreground">
                                Speed: <span className="text-foreground">{m.speed} km/h</span>
                              </div>
                              {m.is_stoppage && (
                                <Badge variant="destructive" className="text-xs">Stoppage</Badge>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      ))}

                      {/* Train label at start */}
                      {path.movements.length > 0 && isHighlighted && (
                        <g>
                          <rect
                            x={xScale(path.movements[0].arrival) - 4}
                            y={yScale(path.movements[0].distance_km) - 24}
                            width={Math.min(path.load_id.length * 6 + 16, 120)}
                            height={18}
                            rx={4}
                            fill={path.color}
                          />
                          <text
                            x={xScale(path.movements[0].arrival) + 4}
                            y={yScale(path.movements[0].distance_km) - 12}
                            fill="white"
                            fontSize="10"
                            fontWeight="600"
                          >
                            {path.load_id.length > 15 ? path.load_id.substring(0, 15) + '...' : path.load_id}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
            </svg>
          </TooltipProvider>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 items-center justify-between border-t border-border pt-4">
          <div className="flex flex-wrap gap-2">
            {trainPaths.slice(0, 10).map((path) => (
              <Button
                key={path.load_id}
                variant={selectedTrain === path.load_id ? "default" : "ghost"}
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => setSelectedTrain(selectedTrain === path.load_id ? null : path.load_id)}
              >
                <div 
                  className="w-2 h-2 rounded-full mr-1.5" 
                  style={{ backgroundColor: path.color }} 
                />
                {path.load_id.substring(0, 12)}...
              </Button>
            ))}
            {trainPaths.length > 10 && (
              <Badge variant="secondary">+{trainPaths.length - 10} more</Badge>
            )}
          </div>
          
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <div className="w-8 h-0.5 bg-primary" />
              <span>Running</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-8 h-0.5 bg-primary" style={{ borderTop: '2px dashed' }} />
              <span>Stoppage</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-destructive" />
              <span>Halt Point</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
