import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { ChevronLeft, ChevronRight, Clock, Train, ZoomIn, ZoomOut } from 'lucide-react';
import { useRouteStations } from '@/hooks/useFreightData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, differenceInMinutes, addHours, startOfDay } from 'date-fns';

interface MovementData {
  id: string;
  load_id: string;
  station_code: string;
  arrival_time: string | null;
  departure_time: string | null;
  speed: number | null;
  is_stoppage: boolean;
  halt_minutes: number | null;
  freight_train_id: string | null;
}

interface TrainPath {
  load_id: string;
  color: string;
  movements: {
    station_code: string;
    station_seq: number;
    arrival: Date | null;
    departure: Date | null;
    speed: number;
    is_stoppage: boolean;
    halt_minutes: number;
  }[];
}

const TRAIN_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#0ea5e9', '#d946ef',
];

export function FreightGanttChart() {
  const { stations } = useRouteStations();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [timeOffset, setTimeOffset] = useState(0);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);

  // Fetch movements data
  const { data: movements, isLoading } = useQuery({
    queryKey: ['freight-movements-gantt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freight_movements')
        .select('id, load_id, station_code, arrival_time, departure_time, speed, is_stoppage, halt_minutes, freight_train_id')
        .not('arrival_time', 'is', null)
        .order('arrival_time', { ascending: true })
        .limit(2000);
      
      if (error) throw error;
      return data as MovementData[];
    },
  });

  // Create station sequence map
  const stationSeqMap = useMemo(() => {
    const map = new Map<string, number>();
    stations.forEach(s => map.set(s.station_code, s.seq_no));
    return map;
  }, [stations]);

  const orderedStations = useMemo(() => {
    return [...stations].sort((a, b) => a.seq_no - b.seq_no);
  }, [stations]);

  // Process movements into train paths
  const trainPaths = useMemo(() => {
    if (!movements || movements.length === 0) return [];

    const pathMap = new Map<string, TrainPath>();
    
    movements.forEach((m, idx) => {
      if (!pathMap.has(m.load_id)) {
        pathMap.set(m.load_id, {
          load_id: m.load_id,
          color: TRAIN_COLORS[pathMap.size % TRAIN_COLORS.length],
          movements: [],
        });
      }

      const stationSeq = stationSeqMap.get(m.station_code);
      if (stationSeq === undefined) return;

      pathMap.get(m.load_id)!.movements.push({
        station_code: m.station_code,
        station_seq: stationSeq,
        arrival: m.arrival_time ? parseISO(m.arrival_time) : null,
        departure: m.departure_time ? parseISO(m.departure_time) : null,
        speed: m.speed || 0,
        is_stoppage: m.is_stoppage,
        halt_minutes: m.halt_minutes || 0,
      });
    });

    // Sort movements within each train by arrival time
    pathMap.forEach(path => {
      path.movements.sort((a, b) => {
        if (!a.arrival || !b.arrival) return 0;
        return a.arrival.getTime() - b.arrival.getTime();
      });
    });

    return Array.from(pathMap.values());
  }, [movements, stationSeqMap]);

  // Calculate time range
  const timeRange = useMemo(() => {
    if (!movements || movements.length === 0) {
      const now = new Date();
      return { start: startOfDay(now), end: addHours(now, 24) };
    }

    const times = movements
      .filter(m => m.arrival_time)
      .map(m => parseISO(m.arrival_time!).getTime());
    
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return {
      start: new Date(minTime),
      end: new Date(maxTime + 3600000), // Add 1 hour buffer
    };
  }, [movements]);

  // Chart dimensions
  const chartWidth = 1200 * zoomLevel;
  const chartHeight = Math.max(400, orderedStations.length * 30);
  const marginLeft = 80;
  const marginTop = 40;
  const marginBottom = 60;
  const marginRight = 20;

  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  // Time to X position
  const timeToX = (time: Date) => {
    const totalMinutes = differenceInMinutes(timeRange.end, timeRange.start);
    const minutesFromStart = differenceInMinutes(time, timeRange.start);
    return marginLeft + (minutesFromStart / totalMinutes) * plotWidth;
  };

  // Station to Y position
  const stationToY = (stationSeq: number) => {
    const minSeq = Math.min(...orderedStations.map(s => s.seq_no));
    const maxSeq = Math.max(...orderedStations.map(s => s.seq_no));
    const range = maxSeq - minSeq || 1;
    return marginTop + ((stationSeq - minSeq) / range) * plotHeight;
  };

  // Generate time axis ticks
  const timeTicks = useMemo(() => {
    const ticks: Date[] = [];
    const totalHours = differenceInMinutes(timeRange.end, timeRange.start) / 60;
    const tickInterval = Math.max(1, Math.floor(totalHours / (12 * zoomLevel)));
    
    let current = new Date(timeRange.start);
    while (current <= timeRange.end) {
      ticks.push(new Date(current));
      current = addHours(current, tickInterval);
    }
    return ticks;
  }, [timeRange, zoomLevel]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading freight movement data...
        </CardContent>
      </Card>
    );
  }

  if (!movements || movements.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No freight movement data available. Please import data first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Freight Train Time-Distance Chart
            <Badge variant="secondary">{trainPaths.length} trains</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select
              value={selectedTrain || "all"}
              onValueChange={(v) => setSelectedTrain(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[180px] h-8">
                <SelectValue placeholder="All trains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trains</SelectItem>
                {trainPaths.slice(0, 20).map(tp => (
                  <SelectItem key={tp.load_id} value={tp.load_id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tp.color }} />
                      <span className="truncate">{tp.load_id.slice(0, 15)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">{Math.round(zoomLevel * 100)}%</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <TooltipProvider>
            <svg width={chartWidth} height={chartHeight} className="bg-muted/20 rounded-lg">
              {/* Grid lines */}
              <g className="grid-lines">
                {/* Horizontal grid (stations) */}
                {orderedStations.map((station) => (
                  <line
                    key={`h-${station.id}`}
                    x1={marginLeft}
                    y1={stationToY(station.seq_no)}
                    x2={chartWidth - marginRight}
                    y2={stationToY(station.seq_no)}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4,4"
                  />
                ))}
                {/* Vertical grid (time) */}
                {timeTicks.map((tick, i) => (
                  <line
                    key={`v-${i}`}
                    x1={timeToX(tick)}
                    y1={marginTop}
                    x2={timeToX(tick)}
                    y2={chartHeight - marginBottom}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4,4"
                  />
                ))}
              </g>

              {/* Y-axis labels (stations) */}
              <g className="y-axis">
                {orderedStations.map((station) => (
                  <text
                    key={`y-${station.id}`}
                    x={marginLeft - 8}
                    y={stationToY(station.seq_no)}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    className="fill-muted-foreground text-[10px] font-mono"
                  >
                    {station.station_code}
                  </text>
                ))}
              </g>

              {/* X-axis labels (time) */}
              <g className="x-axis">
                {timeTicks.map((tick, i) => (
                  <g key={`x-${i}`}>
                    <text
                      x={timeToX(tick)}
                      y={chartHeight - marginBottom + 20}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {format(tick, 'HH:mm')}
                    </text>
                    <text
                      x={timeToX(tick)}
                      y={chartHeight - marginBottom + 35}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[9px]"
                    >
                      {format(tick, 'dd MMM')}
                    </text>
                  </g>
                ))}
              </g>

              {/* Train paths */}
              <g className="train-paths">
                {trainPaths
                  .filter(tp => !selectedTrain || tp.load_id === selectedTrain)
                  .map((train) => (
                    <g key={train.load_id}>
                      {/* Draw lines between consecutive movements */}
                      {train.movements.map((movement, idx) => {
                        if (idx === 0) return null;
                        const prev = train.movements[idx - 1];
                        
                        if (!prev.departure || !movement.arrival) return null;
                        
                        const x1 = timeToX(prev.departure);
                        const y1 = stationToY(prev.station_seq);
                        const x2 = timeToX(movement.arrival);
                        const y2 = stationToY(movement.station_seq);

                        return (
                          <Tooltip key={`line-${train.load_id}-${idx}`}>
                            <TooltipTrigger asChild>
                              <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={train.color}
                                strokeWidth={selectedTrain === train.load_id ? 3 : 2}
                                strokeOpacity={selectedTrain && selectedTrain !== train.load_id ? 0.2 : 0.8}
                                className="cursor-pointer hover:stroke-[4px] transition-all"
                                onClick={() => setSelectedTrain(train.load_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold">{train.load_id}</p>
                                <p>{prev.station_code} → {movement.station_code}</p>
                                <p>Speed: {movement.speed} km/h</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}

                      {/* Draw halt indicators at stations */}
                      {train.movements.map((movement, idx) => {
                        if (!movement.arrival) return null;
                        
                        const x = timeToX(movement.arrival);
                        const y = stationToY(movement.station_seq);

                        return (
                          <Tooltip key={`stop-${train.load_id}-${idx}`}>
                            <TooltipTrigger asChild>
                              <circle
                                cx={x}
                                cy={y}
                                r={movement.is_stoppage ? 5 : movement.halt_minutes > 10 ? 4 : 3}
                                fill={movement.is_stoppage ? '#ef4444' : movement.halt_minutes > 10 ? '#f59e0b' : train.color}
                                stroke="white"
                                strokeWidth={1}
                                opacity={selectedTrain && selectedTrain !== train.load_id ? 0.2 : 1}
                                className="cursor-pointer"
                                onClick={() => setSelectedTrain(train.load_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold">{train.load_id}</p>
                                <p>Station: {movement.station_code}</p>
                                <p>Arrival: {movement.arrival ? format(movement.arrival, 'HH:mm') : '-'}</p>
                                <p>Departure: {movement.departure ? format(movement.departure, 'HH:mm') : '-'}</p>
                                {movement.halt_minutes > 0 && (
                                  <p className={movement.is_stoppage ? 'text-red-500' : 'text-amber-500'}>
                                    {movement.is_stoppage ? 'Stoppage' : 'Halt'}: {movement.halt_minutes} min
                                  </p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </g>
                  ))}
              </g>

              {/* Axis labels */}
              <text
                x={chartWidth / 2}
                y={chartHeight - 10}
                textAnchor="middle"
                className="fill-foreground text-xs font-medium"
              >
                Time
              </text>
              <text
                x={15}
                y={chartHeight / 2}
                textAnchor="middle"
                transform={`rotate(-90, 15, ${chartHeight / 2})`}
                className="fill-foreground text-xs font-medium"
              >
                Stations
              </text>
            </svg>
          </TooltipProvider>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-0.5 bg-green-500" />
            <span>Train Path</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Station Stop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-amber-500" />
            <span>Long Halt (&gt;10 min)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span>Stoppage (&gt;30 min)</span>
          </div>
        </div>

        {/* Selected train details */}
        {selectedTrain && (
          <div className="mt-4 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Train className="h-4 w-4" />
                <span className="font-mono font-semibold">{selectedTrain}</span>
                {trainPaths.find(tp => tp.load_id === selectedTrain) && (
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: trainPaths.find(tp => tp.load_id === selectedTrain)?.color }}
                  />
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTrain(null)}>
                Clear Selection
              </Button>
            </div>
            {trainPaths.find(tp => tp.load_id === selectedTrain) && (
              <div className="mt-2 text-sm text-muted-foreground">
                {trainPaths.find(tp => tp.load_id === selectedTrain)!.movements.length} station stops
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
