import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Train, 
  Clock, 
  MapPin, 
  ArrowRight, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Timer
} from 'lucide-react';
import { format, differenceInMinutes, parseISO } from 'date-fns';
import { useRouteStations, useFreightTrains } from '@/hooks/useFreightData';

interface MovementData {
  id: string;
  load_id: string;
  station_code: string;
  arrival_time: string | null;
  departure_time: string | null;
  delay_minutes: number | null;
  halt_minutes: number | null;
  is_stoppage: boolean | null;
  stoppage_reason: string | null;
  speed: number | null;
  block_km: number | null;
}

interface TrainJourney {
  loadId: string;
  trainInfo: {
    source: string;
    destination: string;
    commodity: string | null;
    totalKm: number | null;
  };
  movements: MovementData[];
  totalTime: number;
  totalDelay: number;
  totalHalts: number;
  stoppageCount: number;
  avgSpeed: number;
}

const TRAIN_COLORS = [
  { bg: 'hsl(var(--primary))', text: 'hsl(var(--primary-foreground))' },
  { bg: 'hsl(var(--accent))', text: 'hsl(var(--accent-foreground))' }
];

export function FreightPathComparison() {
  const [selectedTrain1, setSelectedTrain1] = useState<string>('');
  const [selectedTrain2, setSelectedTrain2] = useState<string>('');
  
  const { stations } = useRouteStations();
  const { trains } = useFreightTrains();

  // Fetch movements for selected trains
  const { data: movements1 } = useQuery({
    queryKey: ['freight-movements-compare', selectedTrain1],
    queryFn: async () => {
      if (!selectedTrain1) return [];
      const { data, error } = await supabase
        .from('freight_movements')
        .select('*')
        .eq('load_id', selectedTrain1)
        .order('arrival_time', { ascending: true });
      if (error) throw error;
      return data as MovementData[];
    },
    enabled: !!selectedTrain1
  });

  const { data: movements2 } = useQuery({
    queryKey: ['freight-movements-compare', selectedTrain2],
    queryFn: async () => {
      if (!selectedTrain2) return [];
      const { data, error } = await supabase
        .from('freight_movements')
        .select('*')
        .eq('load_id', selectedTrain2)
        .order('arrival_time', { ascending: true });
      if (error) throw error;
      return data as MovementData[];
    },
    enabled: !!selectedTrain2
  });

  // Get unique load IDs with movements
  const availableLoadIds = useMemo(() => {
    return trains.map(t => t.load_id).filter(Boolean);
  }, [trains]);

  // Station lookup
  const stationMap = useMemo(() => {
    const map: Record<string, { name: string; seq: number; distance: number }> = {};
    stations.forEach(s => {
      map[s.station_code] = {
        name: s.station_name,
        seq: s.seq_no,
        distance: s.cumulative_distance_km || 0
      };
    });
    return map;
  }, [stations]);

  // Process journey data
  const processJourney = (loadId: string, movements: MovementData[]): TrainJourney | null => {
    if (!movements || movements.length === 0) return null;

    const train = trains.find(t => t.load_id === loadId);
    const sortedMovements = [...movements].sort((a, b) => {
      const seqA = stationMap[a.station_code]?.seq || 0;
      const seqB = stationMap[b.station_code]?.seq || 0;
      return seqA - seqB;
    });

    const firstMovement = sortedMovements[0];
    const lastMovement = sortedMovements[sortedMovements.length - 1];
    
    let totalTime = 0;
    if (firstMovement.arrival_time && lastMovement.departure_time) {
      totalTime = differenceInMinutes(
        parseISO(lastMovement.departure_time),
        parseISO(firstMovement.arrival_time)
      );
    }

    const totalDelay = movements.reduce((sum, m) => sum + (m.delay_minutes || 0), 0);
    const totalHalts = movements.reduce((sum, m) => sum + (m.halt_minutes || 0), 0);
    const stoppageCount = movements.filter(m => m.is_stoppage).length;
    const speeds = movements.filter(m => m.speed && m.speed > 0).map(m => m.speed!);
    const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;

    return {
      loadId,
      trainInfo: {
        source: train?.source_station || 'Unknown',
        destination: train?.destination_station || 'Unknown',
        commodity: train?.commodity || null,
        totalKm: train?.total_km || null
      },
      movements: sortedMovements,
      totalTime,
      totalDelay,
      totalHalts,
      stoppageCount,
      avgSpeed
    };
  };

  const journey1 = useMemo(() => 
    selectedTrain1 && movements1 ? processJourney(selectedTrain1, movements1) : null,
    [selectedTrain1, movements1, trains, stationMap]
  );

  const journey2 = useMemo(() => 
    selectedTrain2 && movements2 ? processJourney(selectedTrain2, movements2) : null,
    [selectedTrain2, movements2, trains, stationMap]
  );

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '--:--';
    try {
      return format(parseISO(timeStr), 'HH:mm');
    } catch {
      return '--:--';
    }
  };

  const renderJourneyCard = (journey: TrainJourney | null, colorIdx: number, label: string) => {
    const color = TRAIN_COLORS[colorIdx];
    
    return (
      <Card className="flex-1 bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: color.bg }}
            />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!journey ? (
            <div className="text-center py-8 text-muted-foreground">
              Select a train to view journey
            </div>
          ) : (
            <div className="space-y-4">
              {/* Journey Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-background/50 rounded p-2">
                  <div className="text-muted-foreground">Route</div>
                  <div className="font-medium truncate">
                    {journey.trainInfo.source} → {journey.trainInfo.destination}
                  </div>
                </div>
                <div className="bg-background/50 rounded p-2">
                  <div className="text-muted-foreground">Commodity</div>
                  <div className="font-medium">{journey.trainInfo.commodity || 'N/A'}</div>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="text-center p-2 bg-background/50 rounded">
                  <Timer className="h-4 w-4 mx-auto mb-1 text-primary" />
                  <div className="font-bold">{Math.round(journey.totalTime / 60)}h {journey.totalTime % 60}m</div>
                  <div className="text-muted-foreground">Total Time</div>
                </div>
                <div className="text-center p-2 bg-background/50 rounded">
                  <AlertTriangle className="h-4 w-4 mx-auto mb-1 text-destructive" />
                  <div className="font-bold">{journey.totalDelay}m</div>
                  <div className="text-muted-foreground">Delay</div>
                </div>
                <div className="text-center p-2 bg-background/50 rounded">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-warning" />
                  <div className="font-bold">{journey.totalHalts}m</div>
                  <div className="text-muted-foreground">Halts</div>
                </div>
                <div className="text-center p-2 bg-background/50 rounded">
                  <TrendingUp className="h-4 w-4 mx-auto mb-1 text-accent" />
                  <div className="font-bold">{Math.round(journey.avgSpeed)}</div>
                  <div className="text-muted-foreground">Avg km/h</div>
                </div>
              </div>

              {/* Station Timeline */}
              <ScrollArea className="h-[300px]">
                <div className="space-y-1">
                  {journey.movements.map((m, idx) => {
                    const stationInfo = stationMap[m.station_code];
                    return (
                      <div 
                        key={m.id} 
                        className={`flex items-center gap-2 p-2 rounded text-xs ${
                          m.is_stoppage ? 'bg-destructive/10 border border-destructive/30' : 'bg-background/30'
                        }`}
                      >
                        <div className="w-16 text-right text-muted-foreground">
                          {formatTime(m.arrival_time)}
                        </div>
                        <div className="flex flex-col items-center">
                          <div 
                            className={`w-2 h-2 rounded-full ${
                              m.is_stoppage ? 'bg-destructive' : 'bg-primary'
                            }`}
                          />
                          {idx < journey.movements.length - 1 && (
                            <div className="w-px h-4 bg-border" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {stationInfo?.name || m.station_code}
                          </div>
                          <div className="flex gap-2 text-muted-foreground">
                            {m.delay_minutes && m.delay_minutes > 0 && (
                              <span className="text-destructive">+{m.delay_minutes}m delay</span>
                            )}
                            {m.halt_minutes && m.halt_minutes > 0 && (
                              <span className="text-warning">{m.halt_minutes}m halt</span>
                            )}
                            {m.is_stoppage && (
                              <span className="text-destructive">{m.stoppage_reason || 'Stoppage'}</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right text-muted-foreground">
                          {formatTime(m.departure_time)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Comparison metrics
  const comparison = useMemo(() => {
    if (!journey1 || !journey2) return null;

    const timeDiff = journey1.totalTime - journey2.totalTime;
    const delayDiff = journey1.totalDelay - journey2.totalDelay;
    const haltDiff = journey1.totalHalts - journey2.totalHalts;
    const speedDiff = journey1.avgSpeed - journey2.avgSpeed;

    return { timeDiff, delayDiff, haltDiff, speedDiff };
  }, [journey1, journey2]);

  return (
    <div className="space-y-4">
      {/* Train Selection */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Train className="h-4 w-4" />
            Select Trains to Compare
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Train 1</label>
              <Select value={selectedTrain1} onValueChange={setSelectedTrain1}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select first train" />
                </SelectTrigger>
                <SelectContent>
                  {availableLoadIds.map(loadId => (
                    <SelectItem key={loadId} value={loadId} disabled={loadId === selectedTrain2}>
                      {loadId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Train 2</label>
              <Select value={selectedTrain2} onValueChange={setSelectedTrain2}>
                <SelectTrigger className="bg-background/50">
                  <SelectValue placeholder="Select second train" />
                </SelectTrigger>
                <SelectContent>
                  {availableLoadIds.map(loadId => (
                    <SelectItem key={loadId} value={loadId} disabled={loadId === selectedTrain1}>
                      {loadId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Comparison Summary */}
      {comparison && (
        <Card className="bg-card/50 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Comparison Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div className="text-center p-3 bg-background/50 rounded">
                <div className="text-muted-foreground mb-1">Time Difference</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparison.timeDiff > 0 ? 'text-destructive' : 'text-success'
                }`}>
                  {comparison.timeDiff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {Math.abs(comparison.timeDiff)}m
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparison.timeDiff > 0 ? 'Train 1 slower' : 'Train 1 faster'}
                </div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded">
                <div className="text-muted-foreground mb-1">Delay Difference</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparison.delayDiff > 0 ? 'text-destructive' : 'text-success'
                }`}>
                  {comparison.delayDiff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {Math.abs(comparison.delayDiff)}m
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparison.delayDiff > 0 ? 'Train 1 more delayed' : 'Train 1 less delayed'}
                </div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded">
                <div className="text-muted-foreground mb-1">Halt Difference</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparison.haltDiff > 0 ? 'text-warning' : 'text-success'
                }`}>
                  {comparison.haltDiff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {Math.abs(comparison.haltDiff)}m
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparison.haltDiff > 0 ? 'Train 1 more halts' : 'Train 1 fewer halts'}
                </div>
              </div>
              <div className="text-center p-3 bg-background/50 rounded">
                <div className="text-muted-foreground mb-1">Speed Difference</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparison.speedDiff > 0 ? 'text-success' : 'text-destructive'
                }`}>
                  {comparison.speedDiff > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {Math.abs(Math.round(comparison.speedDiff))} km/h
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparison.speedDiff > 0 ? 'Train 1 faster avg' : 'Train 1 slower avg'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Side-by-side Journey Cards */}
      <div className="grid grid-cols-2 gap-4">
        {renderJourneyCard(journey1, 0, selectedTrain1 || 'Train 1')}
        {renderJourneyCard(journey2, 1, selectedTrain2 || 'Train 2')}
      </div>
    </div>
  );
}
