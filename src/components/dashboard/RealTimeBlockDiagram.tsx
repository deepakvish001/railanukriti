import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Slider } from '@/components/ui/slider';
import { 
  Play, Pause, RotateCcw, Train, CircleDot, Gauge, 
  TrendingUp, TrendingDown, Clock, AlertTriangle, 
  GitBranch, ArrowRight, ArrowLeft, Zap, Plus, Minus,
  Settings2, Eye, EyeOff, ChevronLeft, ChevronRight,
  Activity, BarChart3, Signal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

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
  lines: StationLine[];
}

interface StationLine {
  id: number;
  lineNumber: string;
  lineName: string;
  lineType: string;
  isPlatform: boolean;
  lengthM: number;
  maxSpeed: number;
  direction: 'UP' | 'DN' | 'BOTH';
}

interface BlockSection {
  id: number;
  code: string;
  fromStation: string;
  toStation: string;
  distanceKm: number;
  signalType: 'AT' | 'AB';
  noOfLines: number;
}

interface SimulatedTrain {
  id: string;
  loadId: string;
  position: number; // km from start
  speed: number;
  direction: 'UP' | 'DN';
  status: 'running' | 'stopped' | 'halted';
  commodity?: string;
  destination?: string;
  currentStation?: string;
  nextStation?: string;
  color: string;
}

interface KPIMetrics {
  throughputTrainsPerHour: number;
  avgSpeed: number;
  utilization: number;
  activeTrains: number;
  abSections: number;
  atSections: number;
  totalLoops: number;
  conflictRisk: number;
}

// Signal aspect colors
const signalColors = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
};

// Train colors based on commodity
const trainColors = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6',
  '#6366f1', '#84cc16', '#f43f5e', '#0ea5e9', '#a855f7'
];

export function RealTimeBlockDiagram() {
  // States
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  const [showSignals, setShowSignals] = useState(true);
  const [showLoops, setShowLoops] = useState(true);
  const [showTrainDetails, setShowTrainDetails] = useState(true);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [trains, setTrains] = useState<SimulatedTrain[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  
  const animationRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(Date.now());

  // Fetch stations data
  const { data: stationsData, isLoading: stationsLoading } = useQuery({
    queryKey: ['route-stations-diagram'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_stations')
        .select('*')
        .order('seq_no');
      if (error) throw error;
      return data;
    },
  });

  // Fetch station lines (loops, platforms)
  const { data: stationLinesData } = useQuery({
    queryKey: ['station-lines-diagram'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('station_lines')
        .select('*')
        .order('station_code, line_number');
      if (error) throw error;
      return data;
    },
  });

  // Fetch block sections
  const { data: blockSectionsData } = useQuery({
    queryKey: ['block-sections-diagram'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_block_sections')
        .select('*');
      if (error) throw error;
      return data;
    },
  });

  // Fetch active freight movements for real positions
  const { data: freightMovementsData } = useQuery({
    queryKey: ['freight-movements-diagram'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freight_movements')
        .select(`
          *,
          freight_trains!inner(load_id, commodity, destination_station)
        `)
        .order('arrival_time', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Process stations with lines
  const stations = useMemo<Station[]>(() => {
    if (!stationsData) return [];
    
    const linesMap = new Map<string, StationLine[]>();
    stationLinesData?.forEach((line: any) => {
      const existing = linesMap.get(line.station_code) || [];
      existing.push({
        id: line.id,
        lineNumber: line.line_number?.toString() || '1',
        lineName: line.line_name || '',
        lineType: line.line_type || 'RL',
        isPlatform: line.is_platform || false,
        lengthM: line.line_length_m || 500,
        maxSpeed: line.max_speed || 15,
        direction: line.direction || 'BOTH',
      });
      linesMap.set(line.station_code, existing);
    });

    return stationsData.map((s: any) => ({
      id: s.id,
      code: s.station_code,
      name: s.station_name,
      seqNo: s.seq_no,
      cumulativeDistance: s.cumulative_distance_km || 0,
      noOfTracks: s.no_of_tracks || 2,
      signalType: s.signal_type === 'AT' ? 'AT' : 'AB',
      isJunction: s.is_junction || false,
      blockSection: s.block_section || '',
      lines: linesMap.get(s.station_code) || [],
    }));
  }, [stationsData, stationLinesData]);

  // Process block sections with unique entries
  const blockSections = useMemo<BlockSection[]>(() => {
    if (!blockSectionsData) return [];
    
    const uniqueSections = new Map<string, BlockSection>();
    blockSectionsData.forEach((bs: any) => {
      const key = `${bs.from_station_code}-${bs.to_station_code}`;
      const reverseKey = `${bs.to_station_code}-${bs.from_station_code}`;
      
      if (!uniqueSections.has(key) && !uniqueSections.has(reverseKey)) {
        uniqueSections.set(key, {
          id: bs.id,
          code: bs.block_section_code,
          fromStation: bs.from_station_code,
          toStation: bs.to_station_code,
          distanceKm: bs.distance_km,
          signalType: bs.signal_type === 'AT' ? 'AT' : 'AB',
          noOfLines: bs.no_of_lines || 1,
        });
      }
    });
    
    return Array.from(uniqueSections.values());
  }, [blockSectionsData]);

  // Total route distance
  const totalDistance = useMemo(() => {
    if (stations.length === 0) return 100;
    return Math.max(...stations.map(s => s.cumulativeDistance), 100);
  }, [stations]);

  // Initialize trains from freight movements
  useEffect(() => {
    if (!freightMovementsData || trains.length > 0) return;

    const uniqueLoads = new Map<string, any>();
    freightMovementsData.forEach((fm: any) => {
      if (!uniqueLoads.has(fm.load_id)) {
        uniqueLoads.set(fm.load_id, fm);
      }
    });

    const initialTrains: SimulatedTrain[] = [];
    let colorIndex = 0;
    
    uniqueLoads.forEach((fm, loadId) => {
      const station = stations.find(s => s.code === fm.station_code);
      const position = station?.cumulativeDistance || Math.random() * totalDistance;
      
      initialTrains.push({
        id: `train-${loadId}`,
        loadId: loadId.substring(0, 15),
        position,
        speed: fm.speed || 30 + Math.random() * 40,
        direction: Math.random() > 0.5 ? 'UP' : 'DN',
        status: 'running',
        commodity: fm.freight_trains?.commodity,
        destination: fm.freight_trains?.destination_station,
        currentStation: fm.station_code,
        color: trainColors[colorIndex % trainColors.length],
      });
      colorIndex++;
    });

    // Add some simulated trains if not enough
    if (initialTrains.length < 8) {
      for (let i = initialTrains.length; i < 8; i++) {
        const pos = (i / 8) * totalDistance;
        initialTrains.push({
          id: `sim-train-${i}`,
          loadId: `FRT-${1000 + i}`,
          position: pos,
          speed: 30 + Math.random() * 50,
          direction: i % 2 === 0 ? 'UP' : 'DN',
          status: 'running',
          commodity: ['COAL', 'IRON', 'CEMENT', 'FOOD'][i % 4],
          color: trainColors[i % trainColors.length],
        });
      }
    }

    setTrains(initialTrains.slice(0, 12));
  }, [freightMovementsData, stations, totalDistance]);

  // Animation loop for train movement
  useEffect(() => {
    if (!isSimulating) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      return;
    }

    const animate = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateRef.current) / 1000; // seconds
      lastUpdateRef.current = now;

      setCurrentTime(new Date());
      
      setTrains(prevTrains => {
        return prevTrains.map(train => {
          if (train.status === 'stopped') return train;

          // Calculate new position based on speed and direction
          const speedKmPerSecond = (train.speed / 3600) * simulationSpeed;
          let newPosition = train.position + (train.direction === 'UP' ? speedKmPerSecond : -speedKmPerSecond) * deltaTime * 60;

          // Boundary checks
          if (newPosition <= 0) {
            newPosition = 0;
            return { ...train, position: newPosition, direction: 'UP' as const };
          }
          if (newPosition >= totalDistance) {
            newPosition = totalDistance;
            return { ...train, position: newPosition, direction: 'DN' as const };
          }

          // Random halts at stations
          const nearStation = stations.find(s => 
            Math.abs(s.cumulativeDistance - newPosition) < 0.5
          );
          
          if (nearStation && Math.random() < 0.002 * simulationSpeed) {
            return {
              ...train,
              position: newPosition,
              status: 'halted' as const,
              currentStation: nearStation.code,
            };
          }

          // Resume halted trains after some time
          if (train.status === 'halted' && Math.random() < 0.01 * simulationSpeed) {
            return { ...train, position: newPosition, status: 'running' as const };
          }

          return { ...train, position: newPosition };
        });
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    lastUpdateRef.current = Date.now();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isSimulating, simulationSpeed, stations, totalDistance]);

  // Calculate KPIs
  const kpis = useMemo<KPIMetrics>(() => {
    const runningTrains = trains.filter(t => t.status === 'running').length;
    const avgSpeed = trains.length > 0 
      ? trains.reduce((sum, t) => sum + t.speed, 0) / trains.length 
      : 0;

    const abSections = blockSections.filter(s => s.signalType === 'AB').length;
    const atSections = blockSections.filter(s => s.signalType === 'AT').length;
    const totalLoops = stations.reduce((sum, s) => sum + s.lines.filter(l => !l.isPlatform).length, 0);

    // Calculate utilization based on trains and sections
    const sectionCapacity = (atSections * 12) + (abSections * 6); // AT allows more trains
    const utilization = sectionCapacity > 0 ? Math.min(100, (trains.length / sectionCapacity) * 100) : 0;

    // Conflict risk based on single line sections
    const singleLineSections = blockSections.filter(s => s.noOfLines === 1).length;
    const conflictRisk = blockSections.length > 0 
      ? Math.round((singleLineSections / blockSections.length) * 100) 
      : 0;

    // Throughput calculation
    const baseThrough = atSections * 4 + abSections * 2;
    const loopBonus = Math.floor(totalLoops / 3);

    return {
      throughputTrainsPerHour: baseThrough + loopBonus,
      avgSpeed: Math.round(avgSpeed),
      utilization: Math.round(utilization),
      activeTrains: runningTrains,
      abSections,
      atSections,
      totalLoops,
      conflictRisk,
    };
  }, [trains, blockSections, stations]);

  // Position to X coordinate
  const positionToX = useCallback((position: number) => {
    const baseX = (position / totalDistance) * 100;
    return baseX * zoomLevel + panOffset;
  }, [totalDistance, zoomLevel, panOffset]);

  // Handle pan
  const handlePan = (direction: 'left' | 'right') => {
    const step = 10;
    setPanOffset(prev => direction === 'left' ? prev + step : prev - step);
  };

  // Reset view
  const resetView = () => {
    setZoomLevel(1);
    setPanOffset(0);
  };

  // Render signal
  const renderSignal = (type: 'home' | 'starter' | 'distant', x: number, y: number, aspect: 'green' | 'yellow' | 'red') => (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={-3} y={-20} width={6} height={20} fill="#1e293b" rx={1} />
      <circle cx={0} cy={-15} r={4} fill={aspect === 'red' ? signalColors.red : '#374151'} />
      <circle cx={0} cy={-8} r={4} fill={aspect === 'yellow' ? signalColors.yellow : '#374151'} />
      <circle cx={0} cy={-1} r={4} fill={aspect === 'green' ? signalColors.green : '#374151'} />
    </g>
  );

  if (stationsLoading) {
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
      {/* Controls Header */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* View toggles */}
            <div className="flex items-center gap-4">
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
                <Eye className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs">Details</Label>
                <Switch checked={showTrainDetails} onCheckedChange={setShowTrainDetails} />
              </div>
            </div>

            {/* Simulation controls */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Speed:</Label>
                <Select 
                  value={simulationSpeed.toString()} 
                  onValueChange={(v) => setSimulationSpeed(Number(v))}
                >
                  <SelectTrigger className="w-20 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5x</SelectItem>
                    <SelectItem value="1">1x</SelectItem>
                    <SelectItem value="2">2x</SelectItem>
                    <SelectItem value="5">5x</SelectItem>
                    <SelectItem value="10">10x</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                size="sm" 
                variant={isSimulating ? "destructive" : "default"}
                onClick={() => {
                  setIsSimulating(!isSimulating);
                  if (!isSimulating) {
                    toast.success('Simulation started');
                  }
                }}
              >
                {isSimulating ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {isSimulating ? 'Stop' : 'Start'}
              </Button>

              <Button variant="outline" size="sm" onClick={resetView}>
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
        <KPICard 
          label="Active Trains" 
          value={kpis.activeTrains}
          icon={<Train className="h-3 w-3" />}
        />
        <KPICard 
          label="Throughput" 
          value={`${kpis.throughputTrainsPerHour}/hr`}
          icon={<TrendingUp className="h-3 w-3" />}
        />
        <KPICard 
          label="Avg Speed" 
          value={`${kpis.avgSpeed} km/h`}
          icon={<Gauge className="h-3 w-3" />}
        />
        <KPICard 
          label="Utilization" 
          value={`${kpis.utilization}%`}
          icon={<BarChart3 className="h-3 w-3" />}
        />
        <KPICard 
          label="AT Sections" 
          value={kpis.atSections}
          icon={<Zap className="h-3 w-3 text-green-500" />}
        />
        <KPICard 
          label="AB Sections" 
          value={kpis.abSections}
          icon={<CircleDot className="h-3 w-3 text-amber-500" />}
        />
        <KPICard 
          label="Loop Lines" 
          value={kpis.totalLoops}
          icon={<GitBranch className="h-3 w-3 text-blue-500" />}
        />
        <KPICard 
          label="Conflict Risk" 
          value={`${kpis.conflictRisk}%`}
          icon={<AlertTriangle className="h-3 w-3 text-red-500" />}
          highlight={kpis.conflictRisk > 50}
        />
      </div>

      {/* Block Diagram */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="h-5 w-5 text-primary" />
                Real-Time Block Diagram
                {isSimulating && (
                  <Badge variant="outline" className="ml-2 bg-green-500/20 text-green-500 animate-pulse">
                    LIVE
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>
                {stations.length} stations • {blockSections.length} block sections • {trains.length} trains
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {currentTime.toLocaleTimeString()}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Pan controls */}
          <div className="flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={() => handlePan('left')}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground">{Math.round(zoomLevel * 100)}%</span>
              <Button variant="ghost" size="sm" onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => handlePan('right')}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="w-full">
            <div className="relative min-w-[1200px]" style={{ width: `${zoomLevel * 100}%` }}>
              <svg viewBox="0 0 1200 400" className="w-full h-[400px]">
                <defs>
                  {/* Gradient for track */}
                  <linearGradient id="trackGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#374151" />
                    <stop offset="50%" stopColor="#4b5563" />
                    <stop offset="100%" stopColor="#374151" />
                  </linearGradient>
                  
                  {/* Glow filter for trains */}
                  <filter id="trainGlow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feFlood floodColor="#3b82f6" floodOpacity="0.5" />
                    <feComposite in2="blur" operator="in" />
                    <feMerge>
                      <feMergeNode />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Background grid */}
                <g opacity={0.1}>
                  {Array.from({ length: 25 }).map((_, i) => (
                    <line 
                      key={`vgrid-${i}`}
                      x1={i * 50} 
                      y1={0} 
                      x2={i * 50} 
                      y2={400} 
                      stroke="currentColor" 
                      strokeDasharray="2,4"
                    />
                  ))}
                </g>

                {/* Main track lines */}
                <g>
                  {/* Double line track representation */}
                  <line x1={50} y1={195} x2={1150} y2={195} stroke="#475569" strokeWidth={3} />
                  <line x1={50} y1={205} x2={1150} y2={205} stroke="#475569" strokeWidth={3} />
                  
                  {/* Track sleepers */}
                  {Array.from({ length: 60 }).map((_, i) => (
                    <rect 
                      key={`sleeper-${i}`}
                      x={50 + i * 18.5} 
                      y={192} 
                      width={4} 
                      height={16} 
                      fill="#64748b" 
                      opacity={0.3}
                    />
                  ))}
                </g>

                {/* Block sections with signalling type */}
                {stations.slice(0, -1).map((station, idx) => {
                  const nextStation = stations[idx + 1];
                  if (!nextStation) return null;

                  const x1 = 50 + (station.cumulativeDistance / totalDistance) * 1100;
                  const x2 = 50 + (nextStation.cumulativeDistance / totalDistance) * 1100;
                  const isAT = station.signalType === 'AT';
                  const width = x2 - x1;

                  return (
                    <g key={`section-${station.code}`}>
                      {/* Section background */}
                      <rect
                        x={x1}
                        y={180}
                        width={width}
                        height={40}
                        fill={isAT ? 'rgba(34, 197, 94, 0.1)' : 'rgba(234, 179, 8, 0.1)'}
                        stroke={isAT ? '#22c55e' : '#eab308'}
                        strokeWidth={0.5}
                        strokeDasharray={isAT ? '' : '4,2'}
                        rx={2}
                      />

                      {/* Section label */}
                      <text
                        x={(x1 + x2) / 2}
                        y={170}
                        textAnchor="middle"
                        className="text-[8px] fill-muted-foreground"
                      >
                        {station.blockSection || `${station.code}-${nextStation.code}`}
                      </text>

                      {/* AT/AB badge */}
                      <rect
                        x={(x1 + x2) / 2 - 10}
                        y={155}
                        width={20}
                        height={12}
                        rx={2}
                        fill={isAT ? '#22c55e' : '#eab308'}
                      />
                      <text
                        x={(x1 + x2) / 2}
                        y={163}
                        textAnchor="middle"
                        className="text-[7px] font-bold fill-black"
                      >
                        {isAT ? 'AT' : 'AB'}
                      </text>

                      {/* Signal indicators for AT sections */}
                      {showSignals && isAT && (
                        <>
                          {/* Multiple signals in AT territory (1.2km spacing simulation) */}
                          {Array.from({ length: Math.max(1, Math.floor(width / 30)) }).map((_, sigIdx) => {
                            const sigX = x1 + 20 + sigIdx * 30;
                            if (sigX > x2 - 20) return null;
                            return (
                              <g key={`sig-${idx}-${sigIdx}`} transform={`translate(${sigX}, 190)`}>
                                <line x1={0} y1={-25} x2={0} y2={-5} stroke="#475569" strokeWidth={2} />
                                <circle cx={0} cy={-30} r={4} fill="#22c55e" />
                              </g>
                            );
                          })}
                        </>
                      )}
                    </g>
                  );
                })}

                {/* Stations */}
                {stations.map((station, idx) => {
                  const x = 50 + (station.cumulativeDistance / totalDistance) * 1100;
                  const loopLines = station.lines.filter(l => !l.isPlatform);
                  const platformCount = station.lines.filter(l => l.isPlatform).length;

                  return (
                    <g key={station.code}>
                      {/* Station marker */}
                      <rect
                        x={x - 15}
                        y={185}
                        width={30}
                        height={30}
                        fill={station.isJunction ? '#8b5cf6' : '#3b82f6'}
                        rx={station.isJunction ? 4 : 15}
                        stroke="white"
                        strokeWidth={2}
                      />
                      
                      {/* Station code */}
                      <text
                        x={x}
                        y={205}
                        textAnchor="middle"
                        className="text-[9px] font-bold fill-white"
                      >
                        {station.code}
                      </text>

                      {/* Station name below */}
                      <text
                        x={x}
                        y={235}
                        textAnchor="middle"
                        className="text-[8px] fill-muted-foreground"
                        transform={`rotate(45, ${x}, 235)`}
                      >
                        {station.name.substring(0, 12)}
                      </text>

                      {/* Platform count badge */}
                      <circle
                        cx={x + 12}
                        cy={182}
                        r={8}
                        fill="#1e293b"
                        stroke="#475569"
                      />
                      <text
                        x={x + 12}
                        y={185}
                        textAnchor="middle"
                        className="text-[7px] fill-foreground"
                      >
                        {platformCount || station.noOfTracks}
                      </text>

                      {/* Loop lines visualization */}
                      {showLoops && loopLines.length > 0 && (
                        <g>
                          {loopLines.slice(0, 2).map((loop, loopIdx) => {
                            const loopY = loopIdx === 0 ? 150 : 250;
                            const curveDir = loopIdx === 0 ? -1 : 1;
                            
                            return (
                              <g key={`loop-${station.code}-${loopIdx}`}>
                                {/* Loop line */}
                                <path
                                  d={`M ${x - 25} 200 Q ${x - 25} ${200 + curveDir * 30}, ${x} ${200 + curveDir * 30} Q ${x + 25} ${200 + curveDir * 30}, ${x + 25} 200`}
                                  fill="none"
                                  stroke="#6366f1"
                                  strokeWidth={2}
                                  strokeDasharray="4,2"
                                />
                                
                                {/* Loop label */}
                                <text
                                  x={x}
                                  y={200 + curveDir * 45}
                                  textAnchor="middle"
                                  className="text-[7px] fill-indigo-400"
                                >
                                  Loop {loopIdx + 1}
                                </text>
                              </g>
                            );
                          })}

                          {/* Cross line indicator */}
                          {loopLines.length > 0 && (
                            <g>
                              <line
                                x1={x - 8}
                                y1={195}
                                x2={x + 8}
                                y2={205}
                                stroke="#f97316"
                                strokeWidth={2}
                              />
                              <line
                                x1={x + 8}
                                y1={195}
                                x2={x - 8}
                                y2={205}
                                stroke="#f97316"
                                strokeWidth={2}
                              />
                            </g>
                          )}
                        </g>
                      )}

                      {/* Distance marker */}
                      <text
                        x={x}
                        y={275}
                        textAnchor="middle"
                        className="text-[7px] fill-muted-foreground font-mono"
                      >
                        {station.cumulativeDistance.toFixed(1)} km
                      </text>
                    </g>
                  );
                })}

                {/* Trains */}
                {trains.map((train, idx) => {
                  const x = 50 + (train.position / totalDistance) * 1100;
                  const isSelected = selectedTrain === train.id;
                  const y = train.direction === 'UP' ? 185 : 215;

                  return (
                    <g 
                      key={train.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedTrain(isSelected ? null : train.id)}
                      filter={isSelected ? 'url(#trainGlow)' : undefined}
                    >
                      {/* Train body */}
                      <rect
                        x={x - 12}
                        y={y - 8}
                        width={24}
                        height={16}
                        rx={4}
                        fill={train.color}
                        stroke={isSelected ? 'white' : 'none'}
                        strokeWidth={isSelected ? 2 : 0}
                        className={cn(
                          'transition-all',
                          train.status === 'running' && isSimulating && 'animate-pulse'
                        )}
                      />

                      {/* Direction arrow */}
                      <polygon
                        points={train.direction === 'UP' 
                          ? `${x + 12},${y} ${x + 18},${y} ${x + 15},${y - 4}` 
                          : `${x - 12},${y} ${x - 18},${y} ${x - 15},${y - 4}`
                        }
                        fill={train.color}
                      />

                      {/* Headlight */}
                      <circle
                        cx={train.direction === 'UP' ? x + 10 : x - 10}
                        cy={y}
                        r={2}
                        fill="#fef08a"
                        className={train.status === 'running' ? 'opacity-100' : 'opacity-30'}
                      />

                      {/* Speed indicator */}
                      {showTrainDetails && (
                        <text
                          x={x}
                          y={train.direction === 'UP' ? y - 15 : y + 25}
                          textAnchor="middle"
                          className="text-[7px] fill-foreground font-mono"
                        >
                          {Math.round(train.speed)} km/h
                        </text>
                      )}

                      {/* Status indicator */}
                      {train.status === 'halted' && (
                        <circle
                          cx={x}
                          cy={y - 20}
                          r={4}
                          fill="#ef4444"
                          className="animate-pulse"
                        />
                      )}

                      {/* Train tooltip */}
                      {isSelected && (
                        <g>
                          <rect
                            x={x - 50}
                            y={train.direction === 'UP' ? y - 65 : y + 30}
                            width={100}
                            height={45}
                            rx={4}
                            fill="#1e293b"
                            stroke="#475569"
                          />
                          <text
                            x={x}
                            y={train.direction === 'UP' ? y - 50 : y + 45}
                            textAnchor="middle"
                            className="text-[8px] fill-foreground font-semibold"
                          >
                            {train.loadId}
                          </text>
                          <text
                            x={x}
                            y={train.direction === 'UP' ? y - 38 : y + 57}
                            textAnchor="middle"
                            className="text-[7px] fill-muted-foreground"
                          >
                            {train.commodity || 'Freight'} • {train.direction}
                          </text>
                          <text
                            x={x}
                            y={train.direction === 'UP' ? y - 26 : y + 69}
                            textAnchor="middle"
                            className="text-[7px] fill-muted-foreground"
                          >
                            {train.position.toFixed(1)} km
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                {/* Legend */}
                <g transform="translate(50, 320)">
                  <text className="text-[10px] fill-foreground font-semibold" x={0} y={0}>Legend:</text>
                  
                  {/* AT Section */}
                  <rect x={0} y={10} width={30} height={12} fill="rgba(34, 197, 94, 0.3)" stroke="#22c55e" rx={2} />
                  <text x={35} y={19} className="text-[8px] fill-muted-foreground">AT - Automatic Block</text>
                  
                  {/* AB Section */}
                  <rect x={150} y={10} width={30} height={12} fill="rgba(234, 179, 8, 0.2)" stroke="#eab308" strokeDasharray="4,2" rx={2} />
                  <text x={185} y={19} className="text-[8px] fill-muted-foreground">AB - Absolute Block</text>
                  
                  {/* Junction */}
                  <rect x={320} y={8} width={16} height={16} fill="#8b5cf6" rx={3} />
                  <text x={340} y={19} className="text-[8px] fill-muted-foreground">Junction</text>
                  
                  {/* Station */}
                  <circle cx={428} cy={16} r={8} fill="#3b82f6" />
                  <text x={440} y={19} className="text-[8px] fill-muted-foreground">Station</text>
                  
                  {/* Loop */}
                  <path d="M 510 16 Q 520 6, 530 16 Q 540 26, 550 16" fill="none" stroke="#6366f1" strokeWidth={2} strokeDasharray="4,2" />
                  <text x={555} y={19} className="text-[8px] fill-muted-foreground">Loop Line</text>
                  
                  {/* Cross line */}
                  <g transform="translate(660, 10)">
                    <line x1={0} y1={0} x2={10} y2={10} stroke="#f97316" strokeWidth={2} />
                    <line x1={10} y1={0} x2={0} y2={10} stroke="#f97316" strokeWidth={2} />
                  </g>
                  <text x={680} y={19} className="text-[8px] fill-muted-foreground">Cross Line</text>

                  {/* Train */}
                  <rect x={770} y={10} width={20} height={12} rx={3} fill="#3b82f6" />
                  <text x={795} y={19} className="text-[8px] fill-muted-foreground">Train</text>
                </g>

                {/* Signal spacing info */}
                <g transform="translate(50, 355)">
                  <text className="text-[8px] fill-muted-foreground">
                    Signal Spacing: AT sections ~1.2 km | AB sections one train per block | Yard signals ~130m
                  </text>
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
            <Train className="h-4 w-4" />
            Active Trains ({trains.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {trains.map(train => (
              <div
                key={train.id}
                className={cn(
                  'p-2 rounded-lg border cursor-pointer transition-all',
                  selectedTrain === train.id 
                    ? 'border-primary bg-primary/10' 
                    : 'border-border/50 hover:border-primary/50',
                  train.status === 'halted' && 'border-red-500/50 bg-red-500/10'
                )}
                onClick={() => setSelectedTrain(selectedTrain === train.id ? null : train.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: train.color }}
                  />
                  <span className="text-xs font-mono truncate">{train.loadId}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    {train.direction === 'UP' ? <ArrowRight className="h-3 w-3" /> : <ArrowLeft className="h-3 w-3" />}
                    {train.speed.toFixed(0)} km/h
                  </span>
                  <Badge 
                    variant="outline" 
                    className={cn(
                      'text-[8px] px-1',
                      train.status === 'running' && 'bg-green-500/20 text-green-500',
                      train.status === 'halted' && 'bg-red-500/20 text-red-500',
                      train.status === 'stopped' && 'bg-yellow-500/20 text-yellow-500'
                    )}
                  >
                    {train.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// KPI Card component
function KPICard({ 
  label, 
  value, 
  icon,
  highlight = false
}: { 
  label: string; 
  value: string | number; 
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={cn(
      'bg-card/50 backdrop-blur border-border/50',
      highlight && 'border-red-500/50 bg-red-500/10'
    )}>
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
