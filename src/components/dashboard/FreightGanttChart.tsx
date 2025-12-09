import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Clock, Train, ZoomIn, ZoomOut, GitCompare, Timer, TrendingUp, AlertTriangle } from 'lucide-react';
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

const COMPARE_COLORS = ['#22d3ee', '#f472b6']; // Cyan and Pink for comparison

export function FreightGanttChart() {
  const { stations } = useRouteStations();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [timeOffset, setTimeOffset] = useState(0);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareTrain1, setCompareTrain1] = useState<string | null>(null);
  const [compareTrain2, setCompareTrain2] = useState<string | null>(null);

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

  // Get comparison train data
  const getCompareTrains = useMemo(() => {
    if (!compareMode) return [];
    return trainPaths.filter(tp => 
      tp.load_id === compareTrain1 || tp.load_id === compareTrain2
    ).map((tp, idx) => ({
      ...tp,
      color: COMPARE_COLORS[idx % 2],
      compareIndex: idx
    }));
  }, [compareMode, compareTrain1, compareTrain2, trainPaths]);

  // Comparison stats
  const comparisonStats = useMemo(() => {
    if (!compareMode || getCompareTrains.length !== 2) return null;
    
    const [train1, train2] = getCompareTrains;
    
    const calcStats = (tp: TrainPath) => {
      const movements = tp.movements.filter(m => m.arrival && m.departure);
      if (movements.length < 2) return null;
      
      const first = movements[0];
      const last = movements[movements.length - 1];
      const totalTime = first.arrival && last.departure 
        ? differenceInMinutes(last.departure, first.arrival) 
        : 0;
      const totalHalts = movements.reduce((sum, m) => sum + m.halt_minutes, 0);
      const stoppages = movements.filter(m => m.is_stoppage).length;
      const speeds = movements.filter(m => m.speed > 0).map(m => m.speed);
      const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      
      return { totalTime, totalHalts, stoppages, avgSpeed, stationCount: movements.length };
    };
    
    const stats1 = calcStats(train1);
    const stats2 = calcStats(train2);
    
    if (!stats1 || !stats2) return null;
    
    return {
      train1: { loadId: train1.load_id, ...stats1 },
      train2: { loadId: train2.load_id, ...stats2 },
      timeDiff: stats1.totalTime - stats2.totalTime,
      haltDiff: stats1.totalHalts - stats2.totalHalts,
      speedDiff: stats1.avgSpeed - stats2.avgSpeed
    };
  }, [compareMode, getCompareTrains]);

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

  // Determine which trains to display
  const displayTrains = useMemo(() => {
    if (compareMode) {
      return getCompareTrains;
    }
    if (selectedTrain) {
      return trainPaths.filter(tp => tp.load_id === selectedTrain);
    }
    return trainPaths;
  }, [compareMode, getCompareTrains, selectedTrain, trainPaths]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Freight Train Time-Distance Chart
              <Badge variant="secondary">{trainPaths.length} trains</Badge>
            </CardTitle>
            <div className="flex items-center gap-4">
              {/* Compare Mode Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="compare-mode"
                  checked={compareMode}
                  onCheckedChange={(checked) => {
                    setCompareMode(checked);
                    if (!checked) {
                      setCompareTrain1(null);
                      setCompareTrain2(null);
                    }
                  }}
                />
                <Label htmlFor="compare-mode" className="text-sm flex items-center gap-1">
                  <GitCompare className="h-4 w-4" />
                  Compare
                </Label>
              </div>
              
              {/* Zoom controls */}
              <div className="flex items-center gap-2">
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
          </div>

          {/* Compare mode selectors */}
          {compareMode ? (
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COMPARE_COLORS[0] }} />
                <Select value={compareTrain1 || ""} onValueChange={setCompareTrain1}>
                  <SelectTrigger className="w-[200px] h-8 bg-background/50">
                    <SelectValue placeholder="Select Train 1" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainPaths.map(tp => (
                      <SelectItem 
                        key={tp.load_id} 
                        value={tp.load_id}
                        disabled={tp.load_id === compareTrain2}
                      >
                        {tp.load_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground">vs</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COMPARE_COLORS[1] }} />
                <Select value={compareTrain2 || ""} onValueChange={setCompareTrain2}>
                  <SelectTrigger className="w-[200px] h-8 bg-background/50">
                    <SelectValue placeholder="Select Train 2" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainPaths.map(tp => (
                      <SelectItem 
                        key={tp.load_id} 
                        value={tp.load_id}
                        disabled={tp.load_id === compareTrain1}
                      >
                        {tp.load_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <Select
              value={selectedTrain || "all"}
              onValueChange={(v) => setSelectedTrain(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[200px] h-8">
                <SelectValue placeholder="All trains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trains</SelectItem>
                {trainPaths.slice(0, 30).map(tp => (
                  <SelectItem key={tp.load_id} value={tp.load_id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tp.color }} />
                      <span className="truncate">{tp.load_id.slice(0, 20)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Comparison Stats Panel */}
          {compareMode && comparisonStats && (
            <div className="grid grid-cols-4 gap-3 p-3 bg-background/50 rounded-lg border border-border/50">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Time Difference</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparisonStats.timeDiff > 0 ? 'text-destructive' : 'text-green-500'
                }`}>
                  <Timer className="h-4 w-4" />
                  {Math.abs(comparisonStats.timeDiff)}m
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparisonStats.timeDiff > 0 ? 'Train 1 slower' : comparisonStats.timeDiff < 0 ? 'Train 1 faster' : 'Equal'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Halt Difference</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparisonStats.haltDiff > 0 ? 'text-warning' : 'text-green-500'
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                  {Math.abs(comparisonStats.haltDiff)}m
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparisonStats.haltDiff > 0 ? 'Train 1 more halts' : comparisonStats.haltDiff < 0 ? 'Train 1 fewer' : 'Equal'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Avg Speed Diff</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparisonStats.speedDiff > 0 ? 'text-green-500' : 'text-destructive'
                }`}>
                  <TrendingUp className="h-4 w-4" />
                  {Math.abs(Math.round(comparisonStats.speedDiff))} km/h
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparisonStats.speedDiff > 0 ? 'Train 1 faster' : comparisonStats.speedDiff < 0 ? 'Train 1 slower' : 'Equal'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Station Stops</div>
                <div className="font-bold flex items-center justify-center gap-2">
                  <span style={{ color: COMPARE_COLORS[0] }}>{comparisonStats.train1.stationCount}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span style={{ color: COMPARE_COLORS[1] }}>{comparisonStats.train2.stationCount}</span>
                </div>
              </div>
            </div>
          )}
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
                {displayTrains.map((train) => (
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
                                strokeWidth={compareMode ? 4 : (selectedTrain === train.load_id ? 3 : 2)}
                                strokeOpacity={0.9}
                                className="cursor-pointer hover:stroke-[5px] transition-all"
                                onClick={() => !compareMode && setSelectedTrain(train.load_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold" style={{ color: train.color }}>{train.load_id}</p>
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
                                r={compareMode ? 6 : (movement.is_stoppage ? 5 : movement.halt_minutes > 10 ? 4 : 3)}
                                fill={movement.is_stoppage ? '#ef4444' : movement.halt_minutes > 10 ? '#f59e0b' : train.color}
                                stroke={compareMode ? train.color : "white"}
                                strokeWidth={compareMode ? 2 : 1}
                                className="cursor-pointer"
                                onClick={() => !compareMode && setSelectedTrain(train.load_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold" style={{ color: train.color }}>{train.load_id}</p>
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
          {compareMode ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-1 rounded" style={{ backgroundColor: COMPARE_COLORS[0] }} />
                <span>{compareTrain1 || 'Train 1'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-1 rounded" style={{ backgroundColor: COMPARE_COLORS[1] }} />
                <span>{compareTrain2 || 'Train 2'}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-green-500" />
              <span>Train Path</span>
            </div>
          )}
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

        {/* Selected train details - only show when not in compare mode */}
        {!compareMode && selectedTrain && (
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
