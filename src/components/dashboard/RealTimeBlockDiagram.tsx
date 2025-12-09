import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Play, Pause, RotateCcw, Train, Gauge, 
  TrendingUp, Clock, AlertTriangle, 
  GitBranch, ArrowRight, ArrowLeft, Zap, Plus, Minus,
  Activity, BarChart3, Signal, RefreshCw, Database, Wifi,
  Edit3, Wrench, X, Check, Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// Types
interface Station {
  id: number;
  code: string;
  name: string;
  seqNo: number;
  cumulativeDistance: number;
  noOfTracks: number;
  signalType: 'AT' | 'AB';
  isJunction: boolean;
  blockSection: string;
  hasLoop: boolean;
  loopCount: number;
}

interface FreightTrain {
  id: string;
  loadId: string;
  position: number;
  speed: number;
  direction: 'UP' | 'DN';
  status: 'running' | 'stopped' | 'halted';
  commodity?: string;
  destination?: string;
  currentStation: string;
  line: 'main' | 'loop' | 'additional';
  color: string;
  lastUpdate: Date;
}

interface KPIMetrics {
  throughputTrainsPerHour: number;
  avgSpeed: number;
  utilization: number;
  activeTrains: number;
  abSections: number;
  atSections: number;
  totalLoops: number;
  totalCrossovers: number;
  conflictRisk: number;
  capacityGain: number;
}

interface InfrastructureEdit {
  stationCode: string;
  type: 'loop' | 'crossover' | 'upgrade_at';
}

// Train colors based on commodity
const commodityColors: Record<string, string> = {
  'COAL': '#374151',
  'IRON': '#dc2626',
  'CEMENT': '#6b7280',
  'FOOD': '#16a34a',
  'OIL': '#ca8a04',
  'AUTO': '#2563eb',
  'SLAG': '#78716c',
  'IORE': '#b91c1c',
  'PHC': '#0891b2',
  'NPKF': '#7c3aed',
  'default': '#3b82f6',
};

const getTrainColor = (commodity?: string): string => {
  if (!commodity) return commodityColors.default;
  return commodityColors[commodity.toUpperCase()] || commodityColors.default;
};

export function RealTimeBlockDiagram() {
  const queryClient = useQueryClient();
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [showSignals, setShowSignals] = useState(true);
  const [showLoops, setShowLoops] = useState(true);
  const [showAdditionalLine, setShowAdditionalLine] = useState(true);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [trains, setTrains] = useState<FreightTrain[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isConnected, setIsConnected] = useState(false);
  const [lastDataUpdate, setLastDataUpdate] = useState<Date | null>(null);
  
  // Infrastructure editing state
  const [isEditMode, setIsEditMode] = useState(false);
  const [pendingEdits, setPendingEdits] = useState<InfrastructureEdit[]>([]);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [localStationOverrides, setLocalStationOverrides] = useState<Map<string, { hasLoop?: boolean; hasCrossover?: boolean; signalType?: 'AT' | 'AB' }>>(new Map());
  
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Fetch stations data
  const { data: stationsData, isLoading } = useQuery({
    queryKey: ['route-stations-block'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_stations')
        .select('*')
        .order('seq_no')
        .limit(12);
      if (error) throw error;
      return data;
    },
  });

  // Fetch station lines for loop info
  const { data: stationLinesData } = useQuery({
    queryKey: ['station-lines-block'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_lines')
        .select('station_code, line_type, is_platform')
        .not('is_platform', 'eq', true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch freight movements with train info
  const { data: freightMovementsData, refetch: refetchMovements } = useQuery({
    queryKey: ['freight-movements-realtime'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freight_movements')
        .select(`
          id,
          load_id,
          station_code,
          arrival_time,
          departure_time,
          speed,
          delay_minutes,
          halt_minutes,
          is_stoppage,
          freight_trains!inner(
            id,
            load_id,
            commodity,
            destination_station,
            source_station
          )
        `)
        .order('arrival_time', { ascending: false })
        .limit(150);
      if (error) throw error;
      return data;
    },
    refetchInterval: isSimulating ? 5000 : false, // Auto-refetch every 5s when simulating
  });

  // Process stations
  const stations = useMemo<Station[]>(() => {
    if (!stationsData) return [];
    
    const loopCounts = new Map<string, number>();
    stationLinesData?.forEach((line: any) => {
      const count = loopCounts.get(line.station_code) || 0;
      loopCounts.set(line.station_code, count + 1);
    });

    return stationsData.slice(0, 8).map((s: any) => ({
      id: s.id,
      code: s.station_code,
      name: s.station_name,
      seqNo: s.seq_no,
      cumulativeDistance: s.cumulative_distance_km || 0,
      noOfTracks: s.no_of_tracks || 2,
      signalType: s.signal_type === 'AT' ? 'AT' : 'AB',
      isJunction: s.is_junction || false,
      blockSection: s.block_section || '',
      hasLoop: (loopCounts.get(s.station_code) || 0) > 0,
      loopCount: loopCounts.get(s.station_code) || 0,
    }));
  }, [stationsData, stationLinesData]);

  // Create station distance lookup
  const stationDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    stations.forEach(s => {
      map.set(s.code, s.cumulativeDistance);
    });
    return map;
  }, [stations]);

  const totalDistance = useMemo(() => {
    if (stations.length === 0) return 100;
    return Math.max(...stations.map(s => s.cumulativeDistance), 100);
  }, [stations]);

  // Process freight movements into train positions
  useEffect(() => {
    if (!freightMovementsData || stations.length === 0) return;

    // Group movements by load_id to get latest position per train
    const latestByTrain = new Map<string, any>();
    
    freightMovementsData.forEach((movement: any) => {
      const loadId = movement.load_id;
      const existing = latestByTrain.get(loadId);
      
      if (!existing || new Date(movement.arrival_time) > new Date(existing.arrival_time)) {
        latestByTrain.set(loadId, movement);
      }
    });

    // Convert to train objects
    const processedTrains: FreightTrain[] = [];
    let colorIndex = 0;

    latestByTrain.forEach((movement, loadId) => {
      const stationCode = movement.station_code;
      const stationDistance = stationDistanceMap.get(stationCode);
      
      // Only include trains at stations we have in our diagram
      if (stationDistance === undefined) return;
      
      const commodity = movement.freight_trains?.commodity;
      const isHalted = movement.is_stoppage || (movement.halt_minutes && movement.halt_minutes > 30);
      
      // Determine direction based on source and destination
      const sourceStation = movement.freight_trains?.source_station;
      const destStation = movement.freight_trains?.destination_station;
      let direction: 'UP' | 'DN' = 'UP';
      
      if (sourceStation && destStation) {
        const sourceDistance = stationDistanceMap.get(sourceStation) || 0;
        const destDistance = stationDistanceMap.get(destStation) || totalDistance;
        direction = destDistance > sourceDistance ? 'UP' : 'DN';
      }

      processedTrains.push({
        id: movement.id,
        loadId: loadId.substring(0, 15),
        position: stationDistance,
        speed: movement.speed || 0,
        direction,
        status: isHalted ? 'halted' : (movement.speed > 0 ? 'running' : 'stopped'),
        commodity,
        destination: destStation,
        currentStation: stationCode,
        line: colorIndex % 3 === 0 ? 'additional' : 'main',
        color: getTrainColor(commodity),
        lastUpdate: new Date(movement.arrival_time),
      });
      
      colorIndex++;
    });

    // Limit to top 12 trains for visibility
    setTrains(processedTrains.slice(0, 12));
    setLastDataUpdate(new Date());
  }, [freightMovementsData, stations, stationDistanceMap, totalDistance]);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('freight-movements-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_movements'
        },
        (payload) => {
          console.log('Real-time update:', payload);
          setIsConnected(true);
          refetchMovements();
          toast.info('Train position updated', { duration: 2000 });
        }
      )
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          toast.success('Connected to real-time updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchMovements]);

  // Animation loop for smooth train movement
  useEffect(() => {
    if (!isSimulating) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000;
      lastUpdateRef.current = now;
      setCurrentTime(new Date());

      setTrains(prevTrains => prevTrains.map(train => {
        if (train.status === 'stopped' || train.status === 'halted') return train;

        const speedKmPerSecond = (train.speed / 3600) * simulationSpeed;
        let newPosition = train.position + (train.direction === 'UP' ? speedKmPerSecond : -speedKmPerSecond) * deltaTime * 60;

        // Boundary checks
        if (newPosition <= 0) {
          return { ...train, position: 0, direction: 'UP' as const };
        }
        if (newPosition >= totalDistance) {
          return { ...train, position: totalDistance, direction: 'DN' as const };
        }

        return { ...train, position: newPosition };
      }));

      animationRef.current = requestAnimationFrame(animate);
    };

    lastUpdateRef.current = Date.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isSimulating, simulationSpeed, totalDistance]);

  // Calculate KPIs with infrastructure edits included
  const effectiveStations = useMemo(() => {
    return stations.map(s => {
      const override = localStationOverrides.get(s.code);
      if (!override) return s;
      return {
        ...s,
        hasLoop: override.hasLoop ?? s.hasLoop,
        signalType: override.signalType ?? s.signalType,
      };
    });
  }, [stations, localStationOverrides]);

  const crossoverCount = useMemo(() => {
    let count = 0;
    localStationOverrides.forEach(override => {
      if (override.hasCrossover) count++;
    });
    return count;
  }, [localStationOverrides]);

  // Calculate KPIs
  const kpis = useMemo<KPIMetrics>(() => {
    const runningTrains = trains.filter(t => t.status === 'running').length;
    const avgSpeed = trains.length > 0 ? trains.reduce((sum, t) => sum + t.speed, 0) / trains.length : 0;
    const abSections = effectiveStations.filter(s => s.signalType === 'AB').length;
    const atSections = effectiveStations.filter(s => s.signalType === 'AT').length;
    const totalLoops = effectiveStations.reduce((sum, s) => sum + (s.hasLoop ? 1 : 0), 0);
    
    // Capacity calculation: AT=12 trains/hr, AB=6 trains/hr, +2 per loop, +1 per crossover
    const baseCapacity = (atSections * 12) + (abSections * 6);
    const loopBonus = totalLoops * 2;
    const crossoverBonus = crossoverCount * 1;
    const totalCapacity = baseCapacity + loopBonus + crossoverBonus;
    
    const utilization = totalCapacity > 0 ? Math.min(100, (trains.length / totalCapacity) * 100) : 0;

    // Calculate capacity gain from pending edits
    const originalAT = stations.filter(s => s.signalType === 'AT').length;
    const originalLoops = stations.reduce((sum, s) => sum + (s.hasLoop ? 1 : 0), 0);
    const originalCapacity = (originalAT * 12) + ((stations.length - originalAT) * 6) + (originalLoops * 2);
    const capacityGain = totalCapacity - originalCapacity;

    return {
      throughputTrainsPerHour: atSections * 4 + abSections * 2 + totalLoops + crossoverCount,
      avgSpeed: Math.round(avgSpeed),
      utilization: Math.round(utilization),
      activeTrains: runningTrains,
      abSections,
      atSections,
      totalLoops,
      totalCrossovers: crossoverCount,
      conflictRisk: Math.max(5, 40 - (atSections * 3) - (totalLoops * 2) - (crossoverCount * 1)),
      capacityGain,
    };
  }, [trains, effectiveStations, stations, crossoverCount]);

  // Manual refresh
  const handleRefresh = useCallback(() => {
    refetchMovements();
    toast.success('Data refreshed');
  }, [refetchMovements]);

  // Infrastructure editing handlers
  const handleAddLoop = useCallback((stationCode: string) => {
    setLocalStationOverrides(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(stationCode) || {};
      newMap.set(stationCode, { ...existing, hasLoop: true });
      return newMap;
    });
    setPendingEdits(prev => [...prev, { stationCode, type: 'loop' }]);
    toast.success(`Loop line added at ${stationCode}`);
  }, []);

  const handleAddCrossover = useCallback((stationCode: string) => {
    setLocalStationOverrides(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(stationCode) || {};
      newMap.set(stationCode, { ...existing, hasCrossover: true });
      return newMap;
    });
    setPendingEdits(prev => [...prev, { stationCode, type: 'crossover' }]);
    toast.success(`Crossover added near ${stationCode}`);
  }, []);

  const handleUpgradeToAT = useCallback((stationCode: string) => {
    setLocalStationOverrides(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(stationCode) || {};
      newMap.set(stationCode, { ...existing, signalType: 'AT' });
      return newMap;
    });
    setPendingEdits(prev => [...prev, { stationCode, type: 'upgrade_at' }]);
    toast.success(`Section upgraded to Automatic Block at ${stationCode}`);
  }, []);

  const handleRemoveEdit = useCallback((index: number) => {
    const edit = pendingEdits[index];
    if (!edit) return;
    
    setLocalStationOverrides(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(edit.stationCode);
      if (existing) {
        if (edit.type === 'loop') delete existing.hasLoop;
        if (edit.type === 'crossover') delete existing.hasCrossover;
        if (edit.type === 'upgrade_at') delete existing.signalType;
        if (Object.keys(existing).length === 0) {
          newMap.delete(edit.stationCode);
        } else {
          newMap.set(edit.stationCode, existing);
        }
      }
      return newMap;
    });
    setPendingEdits(prev => prev.filter((_, i) => i !== index));
    toast.info('Edit removed');
  }, [pendingEdits]);

  const handleClearAllEdits = useCallback(() => {
    setLocalStationOverrides(new Map());
    setPendingEdits([]);
    setSelectedStation(null);
    toast.info('All edits cleared');
  }, []);

  const handleApplyEdits = useCallback(async () => {
    // In a real implementation, this would save to the database
    toast.success(`Applied ${pendingEdits.length} infrastructure changes - KPIs updated!`);
    // Keep the edits applied visually
  }, [pendingEdits]);

  // Render station building
  const renderStation = (x: number, y: number, code: string, hasLoop: boolean, isJunction: boolean) => (
    <g>
      {/* Station platform */}
      <rect x={x - 30} y={y + 8} width={60} height={12} fill="#94a3b8" stroke="#64748b" strokeWidth={1} rx={2} />
      
      {/* Station building */}
      <g transform={`translate(${x}, ${y - 25})`}>
        <rect x={-18} y={0} width={36} height={25} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={1.5} />
        <polygon points="-22,0 0,-12 22,0" fill="#475569" stroke="#334155" strokeWidth={1} />
        <rect x={-5} y={12} width={10} height={13} fill="#64748b" />
        <rect x={-14} y={5} width={6} height={6} fill="#0ea5e9" opacity={0.7} />
        <rect x={8} y={5} width={6} height={6} fill="#0ea5e9" opacity={0.7} />
      </g>

      {/* Station code label */}
      <rect x={x - 16} y={y + 22} width={32} height={14} fill="#1e293b" rx={2} />
      <text x={x} y={y + 32} textAnchor="middle" className="text-[9px] font-bold fill-white">{code}</text>

      {/* Junction indicator */}
      {isJunction && <circle cx={x + 22} cy={y - 30} r={6} fill="#8b5cf6" stroke="white" strokeWidth={1} />}
    </g>
  );

  // Render signal
  const renderSignal = (x: number, y: number, direction: 'left' | 'right', aspect: 'red' | 'yellow' | 'green' = 'green') => (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={-2} y={0} width={4} height={20} fill="#374151" />
      <rect x={direction === 'left' ? -14 : 2} y={-8} width={12} height={28} fill="#1e293b" stroke="#475569" rx={2} />
      <circle cx={direction === 'left' ? -8 : 8} cy={-2} r={4} fill={aspect === 'red' ? '#ef4444' : '#374151'} />
      <circle cx={direction === 'left' ? -8 : 8} cy={8} r={4} fill={aspect === 'yellow' ? '#eab308' : '#374151'} />
      <circle cx={direction === 'left' ? -8 : 8} cy={18} r={4} fill={aspect === 'green' ? '#22c55e' : '#374151'} />
    </g>
  );

  // Render train with real data
  const renderTrain = (train: FreightTrain, baseY: number) => {
    const x = 80 + (train.position / totalDistance) * 1040;
    const y = train.line === 'additional' ? baseY + 180 : baseY;
    const isSelected = selectedTrain === train.id;

    return (
      <g
        key={train.id}
        className="cursor-pointer transition-all"
        onClick={() => setSelectedTrain(isSelected ? null : train.id)}
      >
        {/* Train glow effect */}
        {isSelected && (
          <rect
            x={x - 22} y={y - 12} width={44} height={24}
            rx={6} fill="none" stroke={train.color} strokeWidth={3} opacity={0.5}
            className="animate-pulse"
          />
        )}

        {/* Train body */}
        <rect
          x={x - 18} y={y - 8} width={36} height={16} rx={4}
          fill={train.color}
          stroke={isSelected ? 'white' : train.color}
          strokeWidth={isSelected ? 2 : 0}
        />

        {/* Train front */}
        <polygon
          points={train.direction === 'UP' 
            ? `${x + 18},${y - 6} ${x + 26},${y} ${x + 18},${y + 6}`
            : `${x - 18},${y - 6} ${x - 26},${y} ${x - 18},${y + 6}`
          }
          fill={train.color}
        />

        {/* Headlight */}
        <circle
          cx={train.direction === 'UP' ? x + 24 : x - 24}
          cy={y}
          r={3}
          fill={train.status === 'running' ? '#fef08a' : '#4b5563'}
        />

        {/* Train ID */}
        <text x={x} y={y + 3} textAnchor="middle" className="text-[7px] fill-white font-bold">
          {train.loadId.slice(-4)}
        </text>

        {/* Speed indicator */}
        <text x={x} y={y - 14} textAnchor="middle" className="text-[8px] fill-foreground font-mono">
          {Math.round(train.speed)} km/h
        </text>

        {/* Status indicator */}
        {train.status === 'halted' && (
          <circle cx={x} cy={y - 22} r={4} fill="#ef4444" className="animate-pulse" />
        )}

        {/* Info tooltip when selected */}
        {isSelected && (
          <g>
            <rect
              x={x - 60} y={y + 20} width={120} height={55}
              rx={4} fill="#1e293b" stroke="#475569" opacity={0.95}
            />
            <text x={x} y={y + 35} textAnchor="middle" className="text-[9px] fill-white font-semibold">
              {train.loadId}
            </text>
            <text x={x} y={y + 47} textAnchor="middle" className="text-[8px] fill-muted-foreground">
              {train.commodity || 'Freight'} → {train.destination || 'Unknown'}
            </text>
            <text x={x} y={y + 59} textAnchor="middle" className="text-[8px] fill-muted-foreground">
              Station: {train.currentStation} • {train.direction}
            </text>
            <text x={x} y={y + 71} textAnchor="middle" className="text-[7px] fill-green-400">
              Updated: {train.lastUpdate.toLocaleTimeString()}
            </text>
          </g>
        )}
      </g>
    );
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-16 text-center">
          <Activity className="h-8 w-8 animate-pulse mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Loading block diagram...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              {/* Connection status */}
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                )} />
                <span className="text-xs text-muted-foreground">
                  {isConnected ? 'Live' : 'Connecting...'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs">Signals</Label>
                <Switch checked={showSignals} onCheckedChange={setShowSignals} />
              </div>
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs">Loops</Label>
                <Switch checked={showLoops} onCheckedChange={setShowLoops} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Add. Line</Label>
                <Switch checked={showAdditionalLine} onCheckedChange={setShowAdditionalLine} />
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Edit Mode Toggle */}
              <Button 
                variant={isEditMode ? "default" : "outline"} 
                size="sm" 
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(isEditMode && "bg-primary")}
              >
                <Edit3 className="h-4 w-4 mr-1" />
                {isEditMode ? 'Editing' : 'Edit Infra'}
              </Button>

              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>

              <div className="flex items-center gap-2">
                <Label className="text-xs">Speed:</Label>
                <Select value={simulationSpeed.toString()} onValueChange={(v) => setSimulationSpeed(Number(v))}>
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="1">1x</SelectItem>
                    <SelectItem value="2">2x</SelectItem>
                    <SelectItem value="5">5x</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                size="sm"
                variant={isSimulating ? "destructive" : "default"}
                onClick={() => {
                  setIsSimulating(!isSimulating);
                  if (!isSimulating) toast.success('Simulation started - trains will animate');
                }}
              >
                {isSimulating ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {isSimulating ? 'Stop' : 'Animate'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Edits Panel */}
      {isEditMode && pendingEdits.length > 0 && (
        <Card className="bg-primary/5 border-primary/30">
          <CardContent className="py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wrench className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">
                  {pendingEdits.length} Pending Infrastructure Changes
                </span>
                {kpis.capacityGain > 0 && (
                  <Badge variant="outline" className="bg-green-500/20 text-green-500">
                    +{kpis.capacityGain} capacity gain
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={handleClearAllEdits}>
                  <X className="h-4 w-4 mr-1" />
                  Clear All
                </Button>
                <Button size="sm" variant="default" onClick={handleApplyEdits}>
                  <Check className="h-4 w-4 mr-1" />
                  Apply Changes
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {pendingEdits.map((edit, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {edit.type === 'loop' && <GitBranch className="h-3 w-3" />}
                  {edit.type === 'crossover' && <ArrowRight className="h-3 w-3" />}
                  {edit.type === 'upgrade_at' && <Zap className="h-3 w-3" />}
                  {edit.stationCode}: {edit.type === 'loop' ? 'Loop' : edit.type === 'crossover' ? 'Crossover' : 'AB→AT'}
                  <button onClick={() => handleRemoveEdit(idx)} className="ml-1 hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Mode Instructions */}
      {isEditMode && pendingEdits.length === 0 && (
        <Card className="bg-amber-500/10 border-amber-500/30">
          <CardContent className="py-3 flex items-center gap-3">
            <Edit3 className="h-4 w-4 text-amber-500" />
            <span className="text-sm text-amber-200">
              Click on any station in the diagram to add loops, crossovers, or upgrade AB→AT sections. KPIs update in real-time.
            </span>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 lg:grid-cols-10 gap-2">
        <KPICard label="Active" value={kpis.activeTrains} icon={<Train className="h-3 w-3" />} />
        <KPICard label="Throughput" value={`${kpis.throughputTrainsPerHour}/hr`} icon={<TrendingUp className="h-3 w-3" />} highlight={kpis.capacityGain > 0} />
        <KPICard label="Avg Speed" value={`${kpis.avgSpeed}`} icon={<Gauge className="h-3 w-3" />} />
        <KPICard label="Utilization" value={`${kpis.utilization}%`} icon={<BarChart3 className="h-3 w-3" />} />
        <KPICard label="AT Sections" value={kpis.atSections} icon={<Zap className="h-3 w-3 text-green-500" />} highlight={kpis.atSections > stations.filter(s => s.signalType === 'AT').length} />
        <KPICard label="AB Sections" value={kpis.abSections} icon={<Clock className="h-3 w-3 text-amber-500" />} />
        <KPICard label="Loops" value={kpis.totalLoops} icon={<GitBranch className="h-3 w-3 text-blue-500" />} highlight={kpis.totalLoops > stations.filter(s => s.hasLoop).length} />
        <KPICard label="Crossovers" value={kpis.totalCrossovers} icon={<ArrowRight className="h-3 w-3 text-orange-500" />} highlight={kpis.totalCrossovers > 0} />
        <KPICard label="Risk" value={`${kpis.conflictRisk}%`} icon={<AlertTriangle className="h-3 w-3 text-red-500" />} highlight={kpis.conflictRisk > 30} />
        {kpis.capacityGain > 0 && (
          <KPICard label="Gain" value={`+${kpis.capacityGain}`} icon={<TrendingUp className="h-3 w-3 text-green-500" />} highlight />
        )}
      </div>

      {/* Block Diagram */}
      <Card className="bg-card/50 backdrop-blur border-border/50 overflow-hidden">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" />
                Real-Time Block Diagram
                {isConnected && (
                  <Badge variant="outline" className="ml-2 bg-green-500/20 text-green-500 animate-pulse">
                    <Wifi className="h-3 w-3 mr-1" />
                    LIVE DATA
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {stations.length} stations • {trains.length} freight trains from database
                {lastDataUpdate && (
                  <span className="ml-2 text-green-500">
                    • Last update: {lastDataUpdate.toLocaleTimeString()}
                  </span>
                )}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoomLevel * 100)}%</span>
              <Button variant="ghost" size="sm" onClick={() => setZoomLevel(z => Math.min(2, z + 0.25))}>
                <Plus className="h-3 w-3" />
              </Button>
              <Badge variant="outline" className="font-mono ml-2">
                {currentTime.toLocaleTimeString()}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <div style={{ width: `${Math.max(100, zoomLevel * 100)}%`, minWidth: '1200px' }}>
              <svg viewBox="0 0 1200 500" className="w-full h-[500px] bg-gradient-to-b from-background to-muted/20">
                <defs>
                  <pattern id="sleepers" patternUnits="userSpaceOnUse" width="16" height="12">
                    <rect x="6" y="0" width="4" height="12" fill="#64748b" opacity="0.4" />
                  </pattern>
                </defs>

                {/* Title labels */}
                <text x="30" y="120" className="text-[11px] fill-muted-foreground font-semibold">Main Line</text>
                {showAdditionalLine && (
                  <text x="30" y="300" className="text-[11px] fill-muted-foreground font-semibold">Additional Main Line</text>
                )}

                {/* Main line track - UP direction */}
                <g>
                  <rect x="60" y="125" width="1080" height="16" fill="url(#sleepers)" />
                  <line x1="60" y1="128" x2="1140" y2="128" stroke="#475569" strokeWidth="3" />
                  <line x1="60" y1="138" x2="1140" y2="138" stroke="#475569" strokeWidth="3" />
                  <g className="fill-muted-foreground">
                    {[200, 400, 600, 800, 1000].map(x => (
                      <polygon key={x} points={`${x},133 ${x + 10},128 ${x + 10},138`} />
                    ))}
                  </g>
                </g>

                {/* Main line track - DN direction */}
                <g>
                  <rect x="60" y="165" width="1080" height="16" fill="url(#sleepers)" />
                  <line x1="60" y1="168" x2="1140" y2="168" stroke="#475569" strokeWidth="3" />
                  <line x1="60" y1="178" x2="1140" y2="178" stroke="#475569" strokeWidth="3" />
                  <g className="fill-muted-foreground">
                    {[250, 450, 650, 850, 1050].map(x => (
                      <polygon key={x} points={`${x},173 ${x - 10},168 ${x - 10},178`} />
                    ))}
                  </g>
                </g>

                {/* Additional main line */}
                {showAdditionalLine && (
                  <g>
                    <rect x="60" y="305" width="1080" height="16" fill="url(#sleepers)" />
                    <line x1="60" y1="308" x2="1140" y2="308" stroke="#475569" strokeWidth="3" />
                    <line x1="60" y1="318" x2="1140" y2="318" stroke="#475569" strokeWidth="3" />
                    <g className="fill-muted-foreground">
                      {[300, 600, 900].map(x => (
                        <polygon key={x} points={`${x},313 ${x + 10},308 ${x + 10},318`} />
                      ))}
                    </g>
                  </g>
                )}

                {/* Block section labels - use effectiveStations for edits */}
                {effectiveStations.slice(0, -1).map((station, idx) => {
                  const nextStation = effectiveStations[idx + 1];
                  if (!nextStation) return null;
                  const x1 = 80 + (station.cumulativeDistance / totalDistance) * 1040;
                  const x2 = 80 + (nextStation.cumulativeDistance / totalDistance) * 1040;
                  const isAT = station.signalType === 'AT';
                  const midX = (x1 + x2) / 2;
                  const wasUpgraded = localStationOverrides.get(station.code)?.signalType === 'AT';

                  return (
                    <g key={`section-${station.code}`}>
                      <rect
                        x={x1} y={110} width={x2 - x1} height={85}
                        fill={isAT ? 'rgba(34, 197, 94, 0.05)' : 'rgba(234, 179, 8, 0.05)'}
                        stroke={isAT ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)'}
                        strokeDasharray={isAT ? '' : '8,4'}
                        className={wasUpgraded ? 'animate-pulse' : ''}
                      />
                      <text x={midX} y="105" textAnchor="middle" className={cn(
                        "text-[10px]",
                        wasUpgraded ? "fill-green-400 font-semibold" : "fill-muted-foreground"
                      )}>
                        {isAT ? 'Automatic Block (AT)' : 'Absolute Block (AB)'}
                        {wasUpgraded && ' ✓'}
                      </text>
                      {isAT && showSignals && (
                        <g>
                          {Array.from({ length: Math.floor((x2 - x1) / 40) }).map((_, i) => {
                            const sigX = x1 + 30 + i * 40;
                            if (sigX > x2 - 30) return null;
                            return (
                              <g key={`at-sig-${idx}-${i}`}>
                                <text x={sigX} y="98" textAnchor="middle" className="text-[7px] fill-green-500">1.2 km</text>
                                <line x1={sigX - 15} y1="100" x2={sigX + 15} y2="100" stroke="#22c55e" strokeWidth="1" strokeDasharray="2,2" />
                              </g>
                            );
                          })}
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Loop lines - original + added */}
                {showLoops && effectiveStations.filter(s => s.hasLoop).map((station) => {
                  const x = 80 + (station.cumulativeDistance / totalDistance) * 1040;
                  const isNewLoop = localStationOverrides.get(station.code)?.hasLoop && !stations.find(s => s.code === station.code)?.hasLoop;
                  return (
                    <g key={`loop-${station.code}`}>
                      <path
                        d={`M ${x - 50} 128 C ${x - 50} 70, ${x - 30} 50, ${x} 50 C ${x + 30} 50, ${x + 50} 70, ${x + 50} 128`}
                        fill="none" 
                        stroke={isNewLoop ? "#22c55e" : "#475569"} 
                        strokeWidth="3"
                        className={isNewLoop ? "animate-pulse" : ""}
                      />
                      <text x={x} y="40" textAnchor="middle" className={cn(
                        "text-[9px] font-medium",
                        isNewLoop ? "fill-green-400" : "fill-indigo-400"
                      )}>
                        {station.code} Loop {isNewLoop && '(NEW)'}
                      </text>
                      {showSignals && (
                        <>
                          {renderSignal(x - 45, 60, 'right', 'green')}
                          {renderSignal(x + 45, 60, 'left', 'red')}
                        </>
                      )}
                      <circle cx={x - 50} cy={128} r={4} fill={isNewLoop ? "#22c55e" : "#f97316"} />
                      <circle cx={x + 50} cy={128} r={4} fill={isNewLoop ? "#22c55e" : "#f97316"} />
                    </g>
                  );
                })}

                {/* Added crossovers visualization */}
                {Array.from(localStationOverrides.entries())
                  .filter(([_, v]) => v.hasCrossover)
                  .map(([stationCode]) => {
                    const station = effectiveStations.find(s => s.code === stationCode);
                    if (!station) return null;
                    const x = 80 + (station.cumulativeDistance / totalDistance) * 1040;
                    return (
                      <g key={`crossover-${stationCode}`}>
                        {/* Crossover lines between UP and DN tracks */}
                        <path 
                          d={`M ${x - 15} 138 L ${x + 15} 168`} 
                          stroke="#22c55e" strokeWidth="3" 
                          className="animate-pulse"
                        />
                        <path 
                          d={`M ${x + 15} 138 L ${x - 15} 168`} 
                          stroke="#22c55e" strokeWidth="3" 
                          className="animate-pulse"
                        />
                        <circle cx={x - 15} cy={138} r={4} fill="#22c55e" />
                        <circle cx={x + 15} cy={138} r={4} fill="#22c55e" />
                        <circle cx={x - 15} cy={168} r={4} fill="#22c55e" />
                        <circle cx={x + 15} cy={168} r={4} fill="#22c55e" />
                        <text x={x} y="235" textAnchor="middle" className="text-[8px] fill-green-400 font-medium">
                          Crossover (NEW)
                        </text>
                      </g>
                    );
                  })}

                {/* Cross lines */}
                {showAdditionalLine && effectiveStations.filter((_, i) => i % 3 === 1).slice(0, 2).map((station, idx) => {
                  const x = 80 + (station.cumulativeDistance / totalDistance) * 1040;
                  return (
                    <g key={`cross-${station.code}`}>
                      <path d={`M ${x - 20} 178 C ${x - 20} 220, ${x - 60} 260, ${x - 80} 308`} fill="none" stroke="#475569" strokeWidth="2.5" />
                      <path d={`M ${x + 20} 178 C ${x + 20} 220, ${x + 60} 260, ${x + 80} 308`} fill="none" stroke="#475569" strokeWidth="2.5" />
                      {showSignals && (
                        <>
                          {renderSignal(x - 30, 210, 'right', 'yellow')}
                          {renderSignal(x + 30, 210, 'left', 'yellow')}
                        </>
                      )}
                      <circle cx={x - 20} cy={178} r={4} fill="#f97316" />
                      <circle cx={x + 20} cy={178} r={4} fill="#f97316" />
                      <circle cx={x - 80} cy={308} r={4} fill="#f97316" />
                      <circle cx={x + 80} cy={308} r={4} fill="#f97316" />
                    </g>
                  );
                })}

                {/* Stations - clickable in edit mode */}
                {effectiveStations.map((station) => {
                  const x = 80 + (station.cumulativeDistance / totalDistance) * 1040;
                  const override = localStationOverrides.get(station.code);
                  const hasEdits = override && (override.hasLoop || override.hasCrossover || override.signalType);
                  
                  return (
                    <g key={station.code}>
                      {/* Edit mode click area */}
                      {isEditMode && (
                        <g 
                          className="cursor-pointer" 
                          onClick={() => setSelectedStation(selectedStation === station.code ? null : station.code)}
                        >
                          <rect 
                            x={x - 45} y={100} width={90} height={120} 
                            fill="transparent" 
                            className="hover:fill-primary/10"
                          />
                        </g>
                      )}
                      
                      {renderStation(x, 155, station.code, station.hasLoop, station.isJunction)}
                      
                      {/* Edit indicator */}
                      {hasEdits && (
                        <circle cx={x + 25} cy={125} r={8} fill="#22c55e" className="animate-pulse">
                          <title>Infrastructure changes pending</title>
                        </circle>
                      )}
                      
                      {/* Edit mode selection highlight */}
                      {isEditMode && selectedStation === station.code && (
                        <rect 
                          x={x - 45} y={100} width={90} height={120} 
                          fill="none" stroke="#3b82f6" strokeWidth="2" 
                          strokeDasharray="4,2" className="animate-pulse"
                        />
                      )}
                      
                      {showSignals && (
                        <>
                          {renderSignal(x - 35, 115, 'right', 'green')}
                          {renderSignal(x + 35, 115, 'left', 'green')}
                        </>
                      )}
                      <text x={x} y={210} textAnchor="middle" className="text-[8px] fill-muted-foreground font-mono">
                        {station.cumulativeDistance.toFixed(1)} km
                      </text>
                      
                      {/* Edit popup */}
                      {isEditMode && selectedStation === station.code && (
                        <foreignObject x={x - 80} y={220} width={160} height={130}>
                          <div className="bg-popover border border-border rounded-lg p-2 shadow-xl">
                            <div className="text-xs font-semibold text-foreground mb-2">{station.code} - Add Infrastructure</div>
                            <div className="flex flex-col gap-1.5">
                              <button
                                onClick={() => { handleAddLoop(station.code); setSelectedStation(null); }}
                                disabled={station.hasLoop}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                                  station.hasLoop 
                                    ? "bg-muted text-muted-foreground cursor-not-allowed" 
                                    : "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                )}
                              >
                                <GitBranch className="h-3 w-3" />
                                Add Loop Line
                              </button>
                              <button
                                onClick={() => { handleAddCrossover(station.code); setSelectedStation(null); }}
                                disabled={override?.hasCrossover}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                                  override?.hasCrossover 
                                    ? "bg-muted text-muted-foreground cursor-not-allowed" 
                                    : "bg-orange-500/20 text-orange-400 hover:bg-orange-500/30"
                                )}
                              >
                                <ArrowRight className="h-3 w-3" />
                                Add Crossover
                              </button>
                              <button
                                onClick={() => { handleUpgradeToAT(station.code); setSelectedStation(null); }}
                                disabled={station.signalType === 'AT'}
                                className={cn(
                                  "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                                  station.signalType === 'AT' 
                                    ? "bg-muted text-muted-foreground cursor-not-allowed" 
                                    : "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                )}
                              >
                                <Zap className="h-3 w-3" />
                                Upgrade AB → AT
                              </button>
                            </div>
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}

                {/* Additional line stations */}
                {showAdditionalLine && stations.filter((_, i) => i % 2 === 1).slice(0, 3).map((station, idx) => {
                  const x = 180 + idx * 350;
                  return (
                    <g key={`add-${idx}`}>
                      {renderStation(x, 335, `S${idx + 4}`, false, false)}
                      {showSignals && (
                        <>
                          {renderSignal(x - 35, 295, 'right', 'green')}
                          {renderSignal(x + 35, 295, 'left', 'green')}
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Trains from database */}
                {trains.map(train => renderTrain(train, 133))}

                {/* Legend */}
                <g transform="translate(60, 420)">
                  <rect x={0} y={0} width={1080} height={70} fill="rgba(30, 41, 59, 0.5)" rx={4} />
                  <text x={20} y={20} className="text-[11px] fill-foreground font-semibold">Legend:</text>
                  
                  <rect x={20} y={30} width={40} height={20} fill="rgba(234, 179, 8, 0.2)" stroke="#eab308" strokeDasharray="4,2" rx={2} />
                  <text x={70} y={43} className="text-[9px] fill-muted-foreground">[AB] Absolute Block</text>
                  
                  <rect x={220} y={30} width={40} height={20} fill="rgba(34, 197, 94, 0.2)" stroke="#22c55e" rx={2} />
                  <text x={270} y={43} className="text-[9px] fill-muted-foreground">[AT] Automatic Block</text>
                  
                  <g transform="translate(430, 35)">
                    <rect x={0} y={-5} width={8} height={18} fill="#1e293b" rx={1} />
                    <circle cx={4} cy={-1} r={3} fill="#ef4444" />
                    <circle cx={4} cy={6} r={3} fill="#374151" />
                    <circle cx={4} cy={13} r={3} fill="#374151" />
                  </g>
                  <text x={450} y={43} className="text-[9px] fill-muted-foreground">Signal</text>
                  
                  <circle cx={530} cy={40} r={5} fill="#f97316" />
                  <text x={545} y={43} className="text-[9px] fill-muted-foreground">Points</text>
                  
                  <rect x={610} y={32} width={30} height={14} rx={3} fill="#3b82f6" />
                  <text x={650} y={43} className="text-[9px] fill-muted-foreground">Train</text>

                  {/* Commodity colors */}
                  <text x={720} y={20} className="text-[9px] fill-muted-foreground">Commodities:</text>
                  <rect x={720} y={30} width={16} height={12} rx={2} fill={commodityColors.COAL} />
                  <text x={740} y={40} className="text-[7px] fill-muted-foreground">Coal</text>
                  <rect x={780} y={30} width={16} height={12} rx={2} fill={commodityColors.IRON} />
                  <text x={800} y={40} className="text-[7px] fill-muted-foreground">Iron</text>
                  <rect x={840} y={30} width={16} height={12} rx={2} fill={commodityColors.CEMENT} />
                  <text x={860} y={40} className="text-[7px] fill-muted-foreground">Cement</text>
                  <rect x={920} y={30} width={16} height={12} rx={2} fill={commodityColors.OIL} />
                  <text x={940} y={40} className="text-[7px] fill-muted-foreground">Oil</text>
                  <rect x={980} y={30} width={16} height={12} rx={2} fill={commodityColors.FOOD} />
                  <text x={1000} y={40} className="text-[7px] fill-muted-foreground">Food</text>
                </g>
              </svg>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Train List */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Database className="h-4 w-4" />
            Freight Trains from Database ({trains.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {trains.map(train => (
              <div
                key={train.id}
                className={cn(
                  'p-3 rounded-lg border cursor-pointer transition-all hover:scale-[1.02]',
                  selectedTrain === train.id ? 'border-primary bg-primary/10 ring-2 ring-primary/20' : 'border-border/50 hover:border-primary/50',
                  train.status === 'halted' && 'border-red-500/50 bg-red-500/10'
                )}
                onClick={() => setSelectedTrain(selectedTrain === train.id ? null : train.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: train.color }} />
                  <span className="text-sm font-mono font-semibold truncate">{train.loadId}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-1">
                    {train.direction === 'UP' ? <ArrowRight className="h-3 w-3" /> : <ArrowLeft className="h-3 w-3" />}
                    {train.speed.toFixed(0)} km/h
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] px-1',
                      train.status === 'running' && 'bg-green-500/20 text-green-500',
                      train.status === 'halted' && 'bg-red-500/20 text-red-500',
                      train.status === 'stopped' && 'bg-yellow-500/20 text-yellow-500'
                    )}
                  >
                    {train.status}
                  </Badge>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {train.commodity && (
                    <span className="inline-flex items-center gap-1 mr-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: train.color }} />
                      {train.commodity}
                    </span>
                  )}
                  @ {train.currentStation}
                </div>
                {train.destination && (
                  <div className="text-[10px] text-blue-400 mt-1">
                    → {train.destination}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ label, value, icon, highlight = false }: { label: string; value: string | number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={cn('bg-card/50 backdrop-blur border-border/50', highlight && 'border-red-500/50 bg-red-500/10')}>
      <CardContent className="p-2">
        <div className="flex items-center gap-1.5">
          <div className="text-muted-foreground">{icon}</div>
          <div>
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <p className="text-sm font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
