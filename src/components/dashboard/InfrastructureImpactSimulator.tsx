import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Train, Gauge, Clock, TrendingUp, TrendingDown, AlertTriangle,
  Plus, Minus, RotateCcw, Play, Pause, Settings2, GitBranch,
  Repeat, Zap, ArrowLeftRight, Activity, Target, ChevronDown,
  ChevronUp, Timer, Route, Layers, Database, RefreshCw, FastForward
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

// ===========================================
// Animated Train Type
// ===========================================

interface TrainTrailPoint {
  positionKm: number;
  timestamp: number;
  status: 'moving' | 'stopped' | 'waiting';
}

interface AnimatedTrain {
  id: string;
  loadId: string;
  color: string;
  currentPositionKm: number;
  targetPositionKm: number;
  speed: number;
  status: 'moving' | 'stopped' | 'waiting';
  currentStationIdx: number;
  direction: 'up' | 'down';
  waitTimeRemaining: number;
  trail: TrainTrailPoint[];
}

const MAX_TRAIL_LENGTH = 20; // Maximum number of trail points to keep

// ===========================================
// Types
// ===========================================

interface RouteStationData {
  id: number;
  seq_no: number;
  station_code: string;
  station_name: string;
  is_junction: boolean | null;
  cumulative_distance_km: number | null;
  signal_type: string | null;
  no_of_tracks: number | null;
}

interface FreightMovementData {
  id: string;
  load_id: string;
  station_code: string;
  arrival_time: string | null;
  departure_time: string | null;
  speed: number | null;
  is_stoppage: boolean | null;
  halt_minutes: number | null;
  delay_minutes: number | null;
}

interface Station {
  id: string;
  code: string;
  name: string;
  type: 'station' | 'junction' | 'halt';
  positionKm: number;
  seqNo: number;
  signalType: string;
  tracks: number;
  loops: LoopLine[];
}

interface LoopLine {
  id: string;
  name: string;
  lengthM: number;
  maxSpeed: number;
  direction: 'up' | 'down' | 'both';
}

interface BlockSection {
  id: string;
  fromStation: string;
  toStation: string;
  distanceKm: number;
  signallingType: 'absolute' | 'automatic' | 'semi-automatic';
  mainLines: number;
  maxSpeed: number;
  crossovers: Crossover[];
}

interface Crossover {
  id: string;
  positionKm: number;
  type: 'single' | 'double' | 'scissors';
}

interface InfraState {
  stations: Station[];
  sections: BlockSection[];
}

interface KPIMetrics {
  throughputTrainsPerDay: number;
  avgSpeedKmh: number;
  avgDelayMin: number;
  capacityTrainsPerDay: number;
  utilizationPercent: number;
  conflictRiskPercent: number;
  bottleneckSection: string | null;
  totalStoppages: number;
  totalHaltMinutes: number;
}

interface TrainPath {
  loadId: string;
  color: string;
  movements: {
    stationCode: string;
    seqNo: number;
    positionKm: number;
    arrivalTime: Date | null;
    departureTime: Date | null;
    speed: number;
    isStoppage: boolean;
    haltMinutes: number;
    delayMinutes: number;
  }[];
}

const TRAIN_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#0ea5e9', '#d946ef',
];

// ===========================================
// Data Processing Functions
// ===========================================

function processRouteStations(data: RouteStationData[]): Station[] {
  return data.map((station, idx) => ({
    id: station.station_code.toLowerCase(),
    code: station.station_code,
    name: station.station_name,
    type: station.is_junction ? 'junction' : 'station',
    positionKm: station.cumulative_distance_km || (idx * 10),
    seqNo: station.seq_no,
    signalType: station.signal_type || 'AB',
    tracks: station.no_of_tracks || 2,
    loops: [],
  }));
}

function buildSectionsFromStations(stations: Station[]): BlockSection[] {
  const sections: BlockSection[] = [];
  
  for (let i = 0; i < stations.length - 1; i++) {
    const from = stations[i];
    const to = stations[i + 1];
    
    sections.push({
      id: `${from.code}-${to.code}`.toLowerCase(),
      fromStation: from.id,
      toStation: to.id,
      distanceKm: Math.round((to.positionKm - from.positionKm) * 10) / 10,
      signallingType: to.signalType === 'AT' ? 'automatic' : 'absolute',
      mainLines: Math.min(from.tracks, to.tracks),
      maxSpeed: 100,
      crossovers: [],
    });
  }
  
  return sections;
}

function processFreightMovements(
  movements: FreightMovementData[], 
  stationMap: Map<string, Station>
): TrainPath[] {
  const pathMap = new Map<string, TrainPath>();
  
  movements.forEach((m, idx) => {
    const station = stationMap.get(m.station_code);
    if (!station) return;
    
    if (!pathMap.has(m.load_id)) {
      pathMap.set(m.load_id, {
        loadId: m.load_id,
        color: TRAIN_COLORS[pathMap.size % TRAIN_COLORS.length],
        movements: [],
      });
    }
    
    const path = pathMap.get(m.load_id)!;
    path.movements.push({
      stationCode: m.station_code,
      seqNo: station.seqNo,
      positionKm: station.positionKm,
      arrivalTime: m.arrival_time ? new Date(m.arrival_time) : null,
      departureTime: m.departure_time ? new Date(m.departure_time) : null,
      speed: m.speed || 0,
      isStoppage: m.is_stoppage || false,
      haltMinutes: m.halt_minutes || 0,
      delayMinutes: m.delay_minutes || 0,
    });
  });
  
  // Sort movements by sequence
  pathMap.forEach(path => {
    path.movements.sort((a, b) => a.seqNo - b.seqNo);
  });
  
  return Array.from(pathMap.values()).slice(0, 15); // Limit to 15 trains for performance
}

// ===========================================
// KPI Calculator with Real Data
// ===========================================

function calculateKPIs(infra: InfraState, trainPaths: TrainPath[]): KPIMetrics {
  let totalCapacity = 0;
  let weightedSpeed = 0;
  let totalDistance = 0;
  let conflictRiskSum = 0;
  let minCapacity = Infinity;
  let bottleneckSection: string | null = null;
  
  infra.sections.forEach(section => {
    const distance = section.distanceKm;
    totalDistance += distance;
    
    // Base capacity based on signalling
    let baseCapacity = section.signallingType === 'automatic' ? 52 : 
                       section.signallingType === 'semi-automatic' ? 40 : 26;
    
    // Track multiplier
    baseCapacity *= section.mainLines;
    
    // Loop bonus
    const fromStation = infra.stations.find(s => s.id === section.fromStation);
    const toStation = infra.stations.find(s => s.id === section.toStation);
    const loopCount = (fromStation?.loops.length || 0) + (toStation?.loops.length || 0);
    baseCapacity += loopCount * 5;
    
    // Crossover bonus
    baseCapacity += section.crossovers.length * 3;
    
    // Track bottleneck
    if (baseCapacity < minCapacity) {
      minCapacity = baseCapacity;
      bottleneckSection = `${fromStation?.code || ''}-${toStation?.code || ''}`;
    }
    
    totalCapacity += baseCapacity;
    weightedSpeed += section.maxSpeed * distance;
    
    // Conflict risk
    if (section.mainLines === 1 && section.signallingType === 'absolute') {
      conflictRiskSum += 35;
    } else if (section.mainLines === 1) {
      conflictRiskSum += 18;
    } else {
      conflictRiskSum += 6;
    }
  });
  
  const sectionCount = infra.sections.length || 1;
  const avgCapacity = Math.round(totalCapacity / sectionCount);
  const avgSpeed = Math.round(weightedSpeed / Math.max(totalDistance, 1));
  const avgConflictRisk = Math.round(conflictRiskSum / sectionCount);
  const effectiveCapacity = Math.round(minCapacity === Infinity ? avgCapacity : minCapacity);
  
  // Calculate from real train data
  let totalDelay = 0;
  let totalStoppages = 0;
  let totalHaltMinutes = 0;
  let speedSum = 0;
  let speedCount = 0;
  
  trainPaths.forEach(train => {
    train.movements.forEach(m => {
      totalDelay += m.delayMinutes;
      if (m.isStoppage) totalStoppages++;
      totalHaltMinutes += m.haltMinutes;
      if (m.speed > 0) {
        speedSum += m.speed;
        speedCount++;
      }
    });
  });
  
  const currentTrains = trainPaths.length;
  const utilizationPercent = effectiveCapacity > 0 
    ? Math.min(100, Math.round((currentTrains / effectiveCapacity) * 100))
    : 0;
  
  const movementCount = trainPaths.reduce((sum, t) => sum + t.movements.length, 0);
  const avgDelayFromData = movementCount > 0 ? Math.round(totalDelay / movementCount) : 0;
  const avgSpeedFromData = speedCount > 0 ? Math.round(speedSum / speedCount) : avgSpeed;
  
  return {
    throughputTrainsPerDay: currentTrains,
    avgSpeedKmh: avgSpeedFromData || avgSpeed,
    avgDelayMin: avgDelayFromData,
    capacityTrainsPerDay: effectiveCapacity,
    utilizationPercent,
    conflictRiskPercent: avgConflictRisk,
    bottleneckSection,
    totalStoppages,
    totalHaltMinutes: Math.round(totalHaltMinutes),
  };
}

// ===========================================
// Time-Distance Chart with Real Data
// ===========================================

interface RealTimeDistanceProps {
  infra: InfraState;
  trainPaths: TrainPath[];
  isSimulating: boolean;
  infraModifications: number;
}

function RealTimeDistanceChart({ infra, trainPaths, isSimulating, infraModifications }: RealTimeDistanceProps) {
  const totalDistance = infra.stations.length > 0 
    ? infra.stations[infra.stations.length - 1]?.positionKm || 180
    : 180;
  
  const chartHeight = 350;
  const chartWidth = 700;
  const padding = { top: 30, right: 30, bottom: 50, left: 70 };
  
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  
  // Find time range from actual data
  const { minTime, maxTime } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    
    trainPaths.forEach(train => {
      train.movements.forEach(m => {
        if (m.arrivalTime) {
          const time = m.arrivalTime.getTime();
          if (time < min) min = time;
          if (time > max) max = time;
        }
      });
    });
    
    if (min === Infinity) {
      const now = new Date();
      min = now.setHours(0, 0, 0, 0);
      max = now.setHours(24, 0, 0, 0);
    }
    
    return { minTime: min, maxTime: max };
  }, [trainPaths]);
  
  const timeRange = maxTime - minTime || 24 * 60 * 60 * 1000;
  
  const timeToX = (time: Date | number) => {
    const t = typeof time === 'number' ? time : time.getTime();
    return padding.left + ((t - minTime) / timeRange) * innerWidth;
  };
  
  const distToY = (km: number) => padding.top + ((totalDistance - km) / totalDistance) * innerHeight;
  
  // Build station position map
  const stationPositionMap = useMemo(() => {
    const map = new Map<string, number>();
    infra.stations.forEach(s => map.set(s.code, s.positionKm));
    return map;
  }, [infra.stations]);
  
  // Calculate delay impact based on infrastructure
  const delayModifier = useMemo(() => {
    // More AT sections and loops = less delay
    const atCount = infra.sections.filter(s => s.signallingType === 'automatic').length;
    const loopCount = infra.stations.reduce((sum, s) => sum + s.loops.length, 0);
    const multiTrackCount = infra.sections.filter(s => s.mainLines > 1).length;
    
    const improvement = (atCount * 0.1) + (loopCount * 0.05) + (multiTrackCount * 0.08);
    return Math.max(0.3, 1 - improvement);
  }, [infra, infraModifications]);
  
  if (trainPaths.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-12 text-center">
          <Train className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No freight movement data available</p>
          <p className="text-xs text-muted-foreground mt-1">Import freight data to see train paths</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Route className="h-4 w-4 text-primary" />
              Real Train Paths
              <Badge variant="outline" className="text-[10px]">
                <Database className="h-3 w-3 mr-1" />
                Live Data
              </Badge>
            </CardTitle>
            <CardDescription className="text-xs">
              {trainPaths.length} freight trains • Delays adjusted by infrastructure changes
            </CardDescription>
          </div>
          {delayModifier < 1 && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
              <TrendingDown className="h-3 w-3 mr-1" />
              {Math.round((1 - delayModifier) * 100)}% delay reduction
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <svg width={chartWidth} height={chartHeight} className="overflow-visible">
            {/* Background grid */}
            <defs>
              <pattern id="sim-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
              </pattern>
            </defs>
            <rect x={padding.left} y={padding.top} width={innerWidth} height={innerHeight} fill="url(#sim-grid)" />
            
            {/* Highlight AB sections (bottlenecks) */}
            {infra.sections.filter(s => s.signallingType === 'absolute' && s.mainLines === 1).map(section => {
              const fromStation = infra.stations.find(s => s.id === section.fromStation);
              const toStation = infra.stations.find(s => s.id === section.toStation);
              if (!fromStation || !toStation) return null;
              
              const y1 = distToY(fromStation.positionKm);
              const y2 = distToY(toStation.positionKm);
              
              return (
                <rect
                  key={section.id}
                  x={padding.left}
                  y={Math.min(y1, y2)}
                  width={innerWidth}
                  height={Math.abs(y2 - y1)}
                  fill="hsl(var(--destructive))"
                  opacity={0.08}
                />
              );
            })}
            
            {/* Station lines */}
            {infra.stations.map(station => {
              const y = distToY(station.positionKm);
              const isJunction = station.type === 'junction';
              
              return (
                <g key={station.id}>
                  <line 
                    x1={padding.left} 
                    y1={y} 
                    x2={padding.left + innerWidth} 
                    y2={y}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={isJunction ? 1 : 0.5}
                    strokeDasharray={isJunction ? 'none' : '3,3'}
                    opacity={0.4}
                  />
                  <text
                    x={padding.left - 8}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    className="text-[9px] fill-muted-foreground"
                  >
                    {station.code}
                  </text>
                  {/* Show loop indicator */}
                  {station.loops.length > 0 && (
                    <circle
                      cx={padding.left - 4}
                      cy={y}
                      r={3}
                      fill="hsl(var(--primary))"
                      opacity={0.6}
                    />
                  )}
                </g>
              );
            })}
            
            {/* Time axis */}
            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
              const time = new Date(minTime + ratio * timeRange);
              const x = padding.left + ratio * innerWidth;
              
              return (
                <text
                  key={ratio}
                  x={x}
                  y={chartHeight - 15}
                  textAnchor="middle"
                  className="text-[9px] fill-muted-foreground"
                >
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </text>
              );
            })}
            
            <text
              x={chartWidth / 2}
              y={chartHeight - 2}
              textAnchor="middle"
              className="text-[10px] fill-muted-foreground"
            >
              Time
            </text>
            
            {/* Train paths */}
            {trainPaths.map((train, trainIdx) => {
              if (train.movements.length < 2) return null;
              
              // Build path with actual positions
              let pathD = '';
              
              train.movements.forEach((m, idx) => {
                const pos = stationPositionMap.get(m.stationCode);
                if (pos === undefined || !m.arrivalTime) return;
                
                const x = timeToX(m.arrivalTime);
                const y = distToY(pos);
                
                if (idx === 0 || pathD === '') {
                  pathD = `M ${x} ${y}`;
                } else {
                  // Add delay visualization (horizontal line for waiting)
                  const prevM = train.movements[idx - 1];
                  if (prevM.departureTime && m.arrivalTime) {
                    const adjustedDelay = m.delayMinutes * delayModifier;
                    if (adjustedDelay > 5) {
                      // Show waiting period with modified delay
                      const waitX = timeToX(new Date(m.arrivalTime.getTime() - adjustedDelay * 60000));
                      const prevY = distToY(stationPositionMap.get(prevM.stationCode) || 0);
                      pathD += ` L ${waitX} ${prevY}`;
                    }
                  }
                  pathD += ` L ${x} ${y}`;
                }
              });
              
              return (
                <g key={train.loadId}>
                  <motion.path
                    d={pathD}
                    fill="none"
                    stroke={train.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 0.8 }}
                    transition={{ duration: 1.5, delay: trainIdx * 0.1 }}
                  />
                  
                  {/* Stoppage markers */}
                  {train.movements.filter(m => m.isStoppage).map((m, idx) => {
                    const pos = stationPositionMap.get(m.stationCode);
                    if (pos === undefined || !m.arrivalTime) return null;
                    
                    return (
                      <motion.circle
                        key={idx}
                        cx={timeToX(m.arrivalTime)}
                        cy={distToY(pos)}
                        r={4}
                        fill="hsl(var(--destructive))"
                        stroke="hsl(var(--background))"
                        strokeWidth={1}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 1 + trainIdx * 0.1 }}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-3 bg-destructive/20 rounded" />
            <span>AB Section (bottleneck)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-green-500 rounded" />
            <span>Train Path</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-destructive" />
            <span>Stoppage</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-primary" />
            <span>Loop Available</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================
// Main Component
// ===========================================

export function InfrastructureImpactSimulator() {
  const [infraModifications, setInfraModifications] = useState(0);
  const [baselineKPIs, setBaselineKPIs] = useState<KPIMetrics | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [simulationSpeed, setSimulationSpeed] = useState(1);
  
  // Animated trains state
  const [animatedTrains, setAnimatedTrains] = useState<AnimatedTrain[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);
  
  // Dialogs
  const [addLoopDialog, setAddLoopDialog] = useState(false);
  const [addMainLineDialog, setAddMainLineDialog] = useState(false);
  const [addCrossoverDialog, setAddCrossoverDialog] = useState(false);
  const [upgradeSignalDialog, setUpgradeSignalDialog] = useState(false);
  
  // Form state
  const [newLoopName, setNewLoopName] = useState('New Loop');
  const [crossoverPosition, setCrossoverPosition] = useState(50);
  
  // Fetch route stations from database
  const { data: routeStationsData, isLoading: stationsLoading } = useQuery({
    queryKey: ['route-stations-simulator'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_stations')
        .select('id, seq_no, station_code, station_name, is_junction, cumulative_distance_km, signal_type, no_of_tracks')
        .order('seq_no', { ascending: true })
        .limit(30);
      
      if (error) throw error;
      return data as RouteStationData[];
    },
  });
  
  // Fetch freight movements from database
  const { data: freightMovementsData, isLoading: movementsLoading, refetch: refetchMovements } = useQuery({
    queryKey: ['freight-movements-simulator'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freight_movements')
        .select('id, load_id, station_code, arrival_time, departure_time, speed, is_stoppage, halt_minutes, delay_minutes')
        .not('arrival_time', 'is', null)
        .order('load_id', { ascending: true })
        .order('arrival_time', { ascending: true })
        .limit(500);
      
      if (error) throw error;
      return data as FreightMovementData[];
    },
  });
  
  // Process stations into infrastructure state
  const [infra, setInfra] = useState<InfraState>({ stations: [], sections: [] });
  
  useEffect(() => {
    if (routeStationsData && routeStationsData.length > 0) {
      const stations = processRouteStations(routeStationsData);
      const sections = buildSectionsFromStations(stations);
      setInfra({ stations, sections });
    }
  }, [routeStationsData]);
  
  // Build station map for quick lookup
  const stationMap = useMemo(() => {
    const map = new Map<string, Station>();
    infra.stations.forEach(s => map.set(s.code, s));
    return map;
  }, [infra.stations]);
  
  // Process freight movements into train paths
  const trainPaths = useMemo(() => {
    if (!freightMovementsData || freightMovementsData.length === 0) return [];
    return processFreightMovements(freightMovementsData, stationMap);
  }, [freightMovementsData, stationMap]);
  
  // Calculate KPIs
  const currentKPIs = useMemo(() => calculateKPIs(infra, trainPaths), [infra, trainPaths, infraModifications]);
  
  // KPI changes from baseline
  const kpiChanges = useMemo(() => {
    if (!baselineKPIs) return null;
    return {
      throughput: currentKPIs.throughputTrainsPerDay - baselineKPIs.throughputTrainsPerDay,
      capacity: currentKPIs.capacityTrainsPerDay - baselineKPIs.capacityTrainsPerDay,
      speed: currentKPIs.avgSpeedKmh - baselineKPIs.avgSpeedKmh,
      delay: currentKPIs.avgDelayMin - baselineKPIs.avgDelayMin,
      risk: currentKPIs.conflictRiskPercent - baselineKPIs.conflictRiskPercent,
    };
  }, [currentKPIs, baselineKPIs]);
  
  // Total distance
  const totalDistance = infra.stations.length > 0 
    ? infra.stations[infra.stations.length - 1]?.positionKm || 180
    : 180;
  
  // Set baseline
  const handleSetBaseline = () => {
    setBaselineKPIs(currentKPIs);
    toast.success('Baseline set! Changes will be compared.');
  };
  
  // Reset infrastructure
  const handleReset = () => {
    if (routeStationsData && routeStationsData.length > 0) {
      const stations = processRouteStations(routeStationsData);
      const sections = buildSectionsFromStations(stations);
      setInfra({ stations, sections });
    }
    setBaselineKPIs(null);
    setSelectedStation(null);
    setSelectedSection(null);
    setInfraModifications(0);
    toast.info('Infrastructure reset to original state');
  };
  
  // Add loop
  const handleAddLoop = () => {
    if (!selectedStation) return;
    
    setInfra(prev => ({
      ...prev,
      stations: prev.stations.map(station => {
        if (station.id === selectedStation) {
          return {
            ...station,
            loops: [
              ...station.loops,
              {
                id: `${station.id}-loop-${Date.now()}`,
                name: newLoopName,
                lengthM: 750,
                maxSpeed: 30,
                direction: 'both',
              }
            ]
          };
        }
        return station;
      })
    }));
    
    setInfraModifications(prev => prev + 1);
    setAddLoopDialog(false);
    setNewLoopName('New Loop');
    toast.success('Loop line added - capacity increased');
  };
  
  // Remove loop
  const handleRemoveLoop = (stationId: string, loopId: string) => {
    setInfra(prev => ({
      ...prev,
      stations: prev.stations.map(station => {
        if (station.id === stationId) {
          return {
            ...station,
            loops: station.loops.filter(l => l.id !== loopId)
          };
        }
        return station;
      })
    }));
    setInfraModifications(prev => prev + 1);
    toast.info('Loop removed');
  };
  
  // Add main line
  const handleAddMainLine = () => {
    if (!selectedSection) return;
    
    setInfra(prev => ({
      ...prev,
      sections: prev.sections.map(sec => {
        if (sec.id === selectedSection && sec.mainLines < 3) {
          return { ...sec, mainLines: sec.mainLines + 1 };
        }
        return sec;
      })
    }));
    
    setInfraModifications(prev => prev + 1);
    setAddMainLineDialog(false);
    toast.success('Main line added - capacity doubled!');
  };
  
  // Add crossover
  const handleAddCrossover = () => {
    if (!selectedSection) return;
    
    const section = infra.sections.find(s => s.id === selectedSection);
    if (!section || section.mainLines < 2) {
      toast.error('Crossovers require double/triple line sections');
      return;
    }
    
    setInfra(prev => ({
      ...prev,
      sections: prev.sections.map(sec => {
        if (sec.id === selectedSection) {
          return {
            ...sec,
            crossovers: [
              ...sec.crossovers,
              {
                id: `${sec.id}-xover-${Date.now()}`,
                positionKm: (crossoverPosition / 100) * sec.distanceKm,
                type: 'double',
              }
            ]
          };
        }
        return sec;
      })
    }));
    
    setInfraModifications(prev => prev + 1);
    setAddCrossoverDialog(false);
    toast.success('Crossover installed');
  };
  
  // Upgrade signalling
  const handleUpgradeSignalling = (newType: 'automatic' | 'semi-automatic') => {
    if (!selectedSection) return;
    
    setInfra(prev => ({
      ...prev,
      sections: prev.sections.map(sec => {
        if (sec.id === selectedSection) {
          return { ...sec, signallingType: newType };
        }
        return sec;
      })
    }));
    
    setInfraModifications(prev => prev + 1);
    setUpgradeSignalDialog(false);
    toast.success(`Signalling upgraded to ${newType === 'automatic' ? 'Automatic Block' : 'Semi-Automatic Block'}`);
  };
  
  // Get station by id
  const getStation = (id: string) => infra.stations.find(s => s.id === id);
  
  // Initialize animated trains when simulation starts
  const initializeAnimatedTrains = useCallback(() => {
    if (trainPaths.length === 0 || infra.stations.length === 0) return;
    
    const trains: AnimatedTrain[] = trainPaths.slice(0, 10).map((path, idx) => {
      const startStation = infra.stations.find(s => s.code === path.movements[0]?.stationCode);
      const isUpDirection = Math.random() > 0.5;
      const startStationIdx = isUpDirection ? 0 : infra.stations.length - 1;
      const startPos = infra.stations[startStationIdx]?.positionKm || 0;
      
      return {
        id: `train-${idx}`,
        loadId: path.loadId,
        color: path.color,
        currentPositionKm: startPos,
        targetPositionKm: startPos,
        speed: 40 + Math.random() * 40, // 40-80 km/h
        status: 'moving' as const,
        currentStationIdx: startStationIdx,
        direction: isUpDirection ? 'up' as const : 'down' as const,
        waitTimeRemaining: 0,
        trail: [{ positionKm: startPos, timestamp: Date.now(), status: 'moving' as const }],
      };
    });
    
    setAnimatedTrains(trains);
  }, [trainPaths, infra.stations]);
  
  // Calculate section speed based on infrastructure
  const getSectionSpeed = useCallback((fromKm: number, toKm: number): number => {
    const section = infra.sections.find(s => {
      const from = getStation(s.fromStation);
      const to = getStation(s.toStation);
      if (!from || !to) return false;
      return (fromKm >= from.positionKm && toKm <= to.positionKm) ||
             (fromKm <= to.positionKm && toKm >= from.positionKm);
    });
    
    if (!section) return 60;
    
    // AT sections are faster
    let speed = section.signallingType === 'automatic' ? 100 : 
                section.signallingType === 'semi-automatic' ? 80 : 60;
    
    // Multi-line sections reduce delays
    if (section.mainLines > 1) speed *= 1.1;
    
    return speed;
  }, [infra.sections, getStation]);
  
  // Check if station has loop (for waiting)
  const stationHasLoop = useCallback((stationId: string): boolean => {
    const station = infra.stations.find(s => s.id === stationId);
    return station ? station.loops.length > 0 : false;
  }, [infra.stations]);
  
  // Animation loop
  useEffect(() => {
    if (!isSimulating) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }
    
    // Initialize trains if not done
    if (animatedTrains.length === 0) {
      initializeAnimatedTrains();
    }
    
    const animate = (timestamp: number) => {
      if (!lastUpdateRef.current) lastUpdateRef.current = timestamp;
      const deltaTime = (timestamp - lastUpdateRef.current) / 1000; // seconds
      lastUpdateRef.current = timestamp;
      
      setAnimatedTrains(prevTrains => {
        return prevTrains.map(train => {
          // Handle waiting
          if (train.status === 'waiting' && train.waitTimeRemaining > 0) {
            const newWaitTime = train.waitTimeRemaining - deltaTime * simulationSpeed * 10;
            if (newWaitTime <= 0) {
              return { ...train, status: 'moving' as const, waitTimeRemaining: 0 };
            }
            return { ...train, waitTimeRemaining: newWaitTime };
          }
          
          // Calculate next position
          const direction = train.direction === 'up' ? 1 : -1;
          const currentSpeed = getSectionSpeed(train.currentPositionKm, train.currentPositionKm + direction * 5);
          const movement = (currentSpeed / 3600) * deltaTime * simulationSpeed * 100; // km moved
          
          let newPosition = train.currentPositionKm + direction * movement;
          let newStationIdx = train.currentStationIdx;
          let newStatus = train.status;
          let newWaitTime = train.waitTimeRemaining;
          let newDirection = train.direction;
          
          // Check if reached a station
          const nextStationIdx = train.direction === 'up' 
            ? Math.min(train.currentStationIdx + 1, infra.stations.length - 1)
            : Math.max(train.currentStationIdx - 1, 0);
          
          const nextStation = infra.stations[nextStationIdx];
          
          if (nextStation) {
            const reachedStation = train.direction === 'up'
              ? newPosition >= nextStation.positionKm
              : newPosition <= nextStation.positionKm;
            
            if (reachedStation) {
              newPosition = nextStation.positionKm;
              newStationIdx = nextStationIdx;
              
              // Random wait at station (shorter if has loop)
              const hasLoop = stationHasLoop(nextStation.id);
              const baseWait = hasLoop ? 1 : 3;
              const shouldWait = Math.random() > 0.6;
              
              if (shouldWait) {
                newStatus = 'waiting';
                newWaitTime = baseWait + Math.random() * (hasLoop ? 2 : 5);
              }
              
              // Reverse at endpoints
              if (nextStationIdx === 0 || nextStationIdx === infra.stations.length - 1) {
                newDirection = newDirection === 'up' ? 'down' : 'up';
                newStatus = 'waiting';
                newWaitTime = 2;
              }
            }
          }
          
          // Clamp position to track bounds
          const minKm = infra.stations[0]?.positionKm || 0;
          const maxKm = infra.stations[infra.stations.length - 1]?.positionKm || 180;
          newPosition = Math.max(minKm, Math.min(maxKm, newPosition));
          
          // Update trail - add current position to trail history
          const now = Date.now();
          const lastTrailPoint = train.trail[train.trail.length - 1];
          let newTrail = train.trail;
          
          // Only add a new trail point if position changed significantly (0.5km) or status changed
          if (!lastTrailPoint || 
              Math.abs(newPosition - lastTrailPoint.positionKm) > 0.5 ||
              newStatus !== lastTrailPoint.status) {
            newTrail = [
              ...train.trail,
              { positionKm: newPosition, timestamp: now, status: newStatus }
            ].slice(-MAX_TRAIL_LENGTH); // Keep only last N points
          }
          
          return {
            ...train,
            currentPositionKm: newPosition,
            currentStationIdx: newStationIdx,
            status: newStatus,
            waitTimeRemaining: newWaitTime,
            direction: newDirection,
            speed: currentSpeed,
            trail: newTrail,
          };
        });
      });
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isSimulating, simulationSpeed, infra.stations, initializeAnimatedTrains, getSectionSpeed, stationHasLoop]);
  
  // Reset animated trains when simulation stops
  useEffect(() => {
    if (!isSimulating) {
      setAnimatedTrains([]);
      lastUpdateRef.current = 0;
    }
  }, [isSimulating]);
  
  const isLoading = stationsLoading || movementsLoading;
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  
  if (infra.stations.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-12 text-center">
          <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No Route Data Found</p>
          <p className="text-muted-foreground mt-1">Import route station data to use the infrastructure simulator</p>
          <Button variant="outline" className="mt-4" onClick={() => refetchMovements()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Train className="h-5 w-5 text-primary" />
              <span className="font-medium">Infrastructure Impact Simulator</span>
              <Badge variant="outline" className="text-xs">
                <Database className="h-3 w-3 mr-1" />
                {infra.stations.length} stations • {Math.round(totalDistance)} km
              </Badge>
              <Badge variant="outline" className="text-xs">
                {trainPaths.length} trains loaded
              </Badge>
              {infraModifications > 0 && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                  {infraModifications} changes
                </Badge>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetchMovements()}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh Data
              </Button>
              <Button variant="outline" size="sm" onClick={handleSetBaseline}>
                <Target className="h-4 w-4 mr-1" />
                Set Baseline
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
              
              {/* Simulation Speed Control */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-md">
                <FastForward className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{simulationSpeed}x</span>
                <Slider
                  value={[simulationSpeed]}
                  onValueChange={(v) => setSimulationSpeed(v[0])}
                  min={0.5}
                  max={5}
                  step={0.5}
                  className="w-20"
                />
              </div>
              
              <Button 
                size="sm" 
                variant={isSimulating ? "destructive" : "default"}
                onClick={() => setIsSimulating(!isSimulating)}
              >
                {isSimulating ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                {isSimulating ? 'Stop' : 'Simulate'}
              </Button>
            </div>
          </div>
          
          {/* Animated Trains Counter */}
          {isSimulating && animatedTrains.length > 0 && (
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                <Train className="h-3 w-3 mr-1" />
                {animatedTrains.filter(t => t.status === 'moving').length} moving
              </Badge>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                <Clock className="h-3 w-3 mr-1" />
                {animatedTrains.filter(t => t.status === 'waiting').length} waiting
              </Badge>
              <span className="text-xs text-muted-foreground">
                Avg speed: {Math.round(animatedTrains.reduce((sum, t) => sum + t.speed, 0) / Math.max(1, animatedTrains.length))} km/h
              </span>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Live KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <KPICard 
          label="Capacity"
          value={currentKPIs.capacityTrainsPerDay}
          unit="trains/day"
          change={kpiChanges?.capacity}
          icon={<Gauge className="h-4 w-4" />}
          positive={true}
          highlight={true}
        />
        <KPICard 
          label="Throughput"
          value={currentKPIs.throughputTrainsPerDay}
          unit="trains"
          change={kpiChanges?.throughput}
          icon={<Train className="h-4 w-4" />}
          positive={true}
        />
        <KPICard 
          label="Avg Speed"
          value={currentKPIs.avgSpeedKmh}
          unit="km/h"
          change={kpiChanges?.speed}
          icon={<Activity className="h-4 w-4" />}
          positive={true}
        />
        <KPICard 
          label="Avg Delay"
          value={currentKPIs.avgDelayMin}
          unit="min"
          change={kpiChanges?.delay}
          icon={<Clock className="h-4 w-4" />}
          positive={false}
        />
        <KPICard 
          label="Stoppages"
          value={currentKPIs.totalStoppages}
          unit=""
          change={null}
          icon={<AlertTriangle className="h-4 w-4" />}
          positive={false}
        />
        <KPICard 
          label="Total Halt"
          value={currentKPIs.totalHaltMinutes}
          unit="min"
          change={null}
          icon={<Timer className="h-4 w-4" />}
          positive={false}
        />
        <Card className={cn(
          "bg-card/50 backdrop-blur border-destructive/30",
          currentKPIs.bottleneckSection && "bg-destructive/5"
        )}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Bottleneck</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-sm font-bold text-destructive">
              {currentKPIs.bottleneckSection || 'None'}
            </span>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content */}
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Block Diagram */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-primary" />
                  Block Diagram
                </CardTitle>
                <CardDescription className="text-xs">
                  Click stations/sections to add infrastructure
                </CardDescription>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full pb-4">
              <div className="relative min-w-[600px] h-[180px] py-4 px-2">
                {/* Section tracks */}
                {infra.sections.map((section) => {
                  const fromStation = getStation(section.fromStation);
                  const toStation = getStation(section.toStation);
                  if (!fromStation || !toStation) return null;
                  
                  const startPercent = (fromStation.positionKm / totalDistance) * 100;
                  const widthPercent = ((toStation.positionKm - fromStation.positionKm) / totalDistance) * 100;
                  const isSelected = selectedSection === section.id;
                  const isAT = section.signallingType === 'automatic';
                  const isSemiAT = section.signallingType === 'semi-automatic';
                  const isBottleneck = currentKPIs.bottleneckSection === `${fromStation.code}-${toStation.code}`;
                  
                  return (
                    <div
                      key={section.id}
                      className="absolute"
                      style={{ 
                        left: `${startPercent}%`, 
                        width: `${widthPercent}%`,
                        top: '50%',
                        transform: 'translateY(-50%)'
                      }}
                    >
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                "relative w-full h-10 group cursor-pointer transition-all rounded",
                                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background"
                              )}
                              onClick={() => setSelectedSection(isSelected ? null : section.id)}
                            >
                              {/* Main lines */}
                              {Array.from({ length: section.mainLines }).map((_, lineIdx) => (
                                <div
                                  key={lineIdx}
                                  className={cn(
                                    "absolute left-0 right-0 h-2 rounded-full transition-all",
                                    isAT ? "bg-gradient-to-r from-green-600 to-green-500" :
                                    isSemiAT ? "bg-gradient-to-r from-blue-600 to-blue-500" :
                                    "bg-gradient-to-r from-amber-600 to-amber-500",
                                    isBottleneck && "ring-2 ring-destructive ring-offset-1 animate-pulse",
                                    "group-hover:shadow-lg"
                                  )}
                                  style={{
                                    top: `${50 - (section.mainLines - 1) * 12 / 2 + lineIdx * 12}%`,
                                    transform: 'translateY(-50%)'
                                  }}
                                />
                              ))}
                              
                              {/* Crossovers */}
                              {section.crossovers.map(xover => (
                                <div
                                  key={xover.id}
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                                  style={{ left: `${(xover.positionKm / section.distanceKm) * 100}%` }}
                                >
                                  <Repeat className="h-3 w-3 text-cyan-400" />
                                </div>
                              ))}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">{fromStation.code} → {toStation.code}</p>
                              <p className="text-xs text-muted-foreground">
                                {section.distanceKm} km • {section.mainLines} line{section.mainLines > 1 ? 's' : ''}
                              </p>
                              <Badge variant="outline" className={cn(
                                "text-[10px]",
                                isAT && "border-green-500/50 text-green-400",
                                isSemiAT && "border-blue-500/50 text-blue-400",
                                !isAT && !isSemiAT && "border-amber-500/50 text-amber-400"
                              )}>
                                {isAT ? 'AT' : isSemiAT ? 'Semi-AT' : 'AB'}
                              </Badge>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {showDetails && (
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[8px] text-muted-foreground font-mono">
                          {section.distanceKm}km
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {/* Stations */}
                {infra.stations.map(station => {
                  const posPercent = (station.positionKm / totalDistance) * 100;
                  const isSelected = selectedStation === station.id;
                  const isJunction = station.type === 'junction';
                  
                  return (
                    <div
                      key={station.id}
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10"
                      style={{ left: `${posPercent}%` }}
                    >
                      {/* Loop lines */}
                      {station.loops.map((loop, loopIdx) => (
                        <div
                          key={loop.id}
                          className="absolute left-1/2 -translate-x-1/2 group"
                          style={{ top: `${-22 - loopIdx * 18}px` }}
                        >
                          <div className="relative">
                            <div className="w-10 h-2.5 border-2 border-purple-500/60 rounded-full bg-purple-500/10" />
                            <button
                              className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveLoop(station.id, loop.id)}
                            >
                              <Minus className="h-2 w-2" />
                            </button>
                          </div>
                        </div>
                      ))}
                      
                      {/* Station marker */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                "relative flex items-center justify-center transition-all",
                                isJunction ? "w-5 h-5" : "w-3.5 h-3.5",
                                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background rounded-full"
                              )}
                              onClick={() => setSelectedStation(isSelected ? null : station.id)}
                            >
                              <div className={cn(
                                "absolute inset-0 rounded-full",
                                isJunction 
                                  ? "bg-primary border-2 border-primary-foreground shadow-lg shadow-primary/50" 
                                  : "bg-foreground border border-background"
                              )} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{station.name} ({station.code})</p>
                            <p className="text-xs text-muted-foreground">
                              {station.tracks} tracks • {station.loops.length} loops
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Station label */}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 flex flex-col items-center">
                        <span className={cn(
                          "text-[8px] font-bold whitespace-nowrap",
                          isJunction ? "text-primary" : "text-foreground"
                        )}>
                          {station.code}
                        </span>
                      </div>
                    </div>
                  );
                })}
                
                {/* Train Trails */}
                {isSimulating && animatedTrains.map((train) => {
                  if (train.trail.length < 2) return null;
                  
                  const topOffset = train.direction === 'up' ? '35%' : '65%';
                  
                  return (
                    <svg
                      key={`trail-${train.id}`}
                      className="absolute inset-0 pointer-events-none z-10"
                      style={{ width: '100%', height: '100%' }}
                    >
                      <defs>
                        <linearGradient id={`trail-gradient-${train.id}`} x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={train.color} stopOpacity="0" />
                          <stop offset="100%" stopColor={train.color} stopOpacity="0.6" />
                        </linearGradient>
                      </defs>
                      {train.trail.map((point, idx) => {
                        if (idx === 0) return null;
                        const prevPoint = train.trail[idx - 1];
                        const x1 = (prevPoint.positionKm / totalDistance) * 100;
                        const x2 = (point.positionKm / totalDistance) * 100;
                        const opacity = (idx / train.trail.length) * 0.6; // Fade older points
                        
                        return (
                          <line
                            key={idx}
                            x1={`${x1}%`}
                            y1={topOffset}
                            x2={`${x2}%`}
                            y2={topOffset}
                            stroke={train.color}
                            strokeWidth={3}
                            strokeOpacity={opacity}
                            strokeLinecap="round"
                          />
                        );
                      })}
                      {/* Trail dots at key positions */}
                      {train.trail.filter((_, idx) => idx % 3 === 0).map((point, idx) => {
                        const x = (point.positionKm / totalDistance) * 100;
                        const opacity = ((idx + 1) / (train.trail.length / 3)) * 0.5;
                        
                        return (
                          <circle
                            key={`dot-${idx}`}
                            cx={`${x}%`}
                            cy={topOffset}
                            r={2}
                            fill={train.color}
                            fillOpacity={opacity}
                          />
                        );
                      })}
                    </svg>
                  );
                })}
                
                {/* Animated Trains */}
                <AnimatePresence>
                  {isSimulating && animatedTrains.map((train) => {
                    const posPercent = (train.currentPositionKm / totalDistance) * 100;
                    const isMoving = train.status === 'moving';
                    const isWaiting = train.status === 'waiting';
                    
                    return (
                      <motion.div
                        key={train.id}
                        className="absolute z-20"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ 
                          opacity: 1, 
                          scale: 1,
                          left: `${posPercent}%`,
                        }}
                        exit={{ opacity: 0, scale: 0 }}
                        transition={{ 
                          left: { type: "spring", stiffness: 100, damping: 20 },
                          opacity: { duration: 0.3 }
                        }}
                        style={{ 
                          top: train.direction === 'up' ? '35%' : '65%',
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div 
                                className={cn(
                                  "relative flex items-center justify-center cursor-pointer",
                                  "transition-all duration-200"
                                )}
                              >
                                {/* Train glow effect */}
                                <div 
                                  className={cn(
                                    "absolute -inset-1 rounded-full blur-sm transition-opacity",
                                    isMoving && "animate-pulse"
                                  )}
                                  style={{ 
                                    backgroundColor: train.color,
                                    opacity: isMoving ? 0.4 : 0.2
                                  }}
                                />
                                
                                {/* Train body */}
                                <div 
                                  className={cn(
                                    "relative w-4 h-4 rounded-full border-2 flex items-center justify-center",
                                    isWaiting && "ring-2 ring-amber-400/50"
                                  )}
                                  style={{ 
                                    backgroundColor: train.color,
                                    borderColor: 'hsl(var(--background))'
                                  }}
                                >
                                  {/* Direction indicator */}
                                  <div 
                                    className={cn(
                                      "absolute w-1.5 h-1.5 bg-white/80 rounded-full",
                                      train.direction === 'up' ? "-right-0.5" : "-left-0.5"
                                    )}
                                  />
                                </div>
                                
                                {/* Speed indicator */}
                                {showDetails && isMoving && (
                                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[7px] font-mono text-muted-foreground whitespace-nowrap">
                                    {Math.round(train.speed)}
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="space-y-1">
                                <p className="font-medium text-xs">{train.loadId}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{Math.round(train.speed)} km/h</span>
                                  <span>•</span>
                                  <span>{train.direction === 'up' ? '↑ UP' : '↓ DN'}</span>
                                  <span>•</span>
                                  <Badge 
                                    variant="outline" 
                                    className={cn(
                                      "text-[9px] h-4",
                                      isMoving && "border-green-500/50 text-green-400",
                                      isWaiting && "border-amber-500/50 text-amber-400"
                                    )}
                                  >
                                    {train.status}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Position: {train.currentPositionKm.toFixed(1)} km
                                </p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2 text-[9px]">
              <div className="flex items-center gap-1">
                <div className="w-4 h-1.5 bg-gradient-to-r from-green-600 to-green-500 rounded" />
                <span className="text-muted-foreground">AT</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-1.5 bg-gradient-to-r from-amber-600 to-amber-500 rounded" />
                <span className="text-muted-foreground">AB</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-3 h-2 border border-purple-500/60 rounded-full" />
                <span className="text-muted-foreground">Loop</span>
              </div>
              <div className="flex items-center gap-1">
                <Repeat className="h-3 w-3 text-cyan-400" />
                <span className="text-muted-foreground">Crossover</span>
              </div>
              {isSimulating && (
                <>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-muted-foreground">Train Moving</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-3 h-3 rounded-full bg-amber-500 ring-2 ring-amber-400/50" />
                    <span className="text-muted-foreground">Train Waiting</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-6 h-0.5 bg-gradient-to-r from-transparent via-blue-400/50 to-blue-400 rounded" />
                    <span className="text-muted-foreground">Trail</span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
        
        {/* Real Time-Distance Chart */}
        <RealTimeDistanceChart 
          infra={infra} 
          trainPaths={trainPaths}
          isSimulating={isSimulating}
          infraModifications={infraModifications}
        />
      </div>
      
      {/* Action Panel */}
      <AnimatePresence>
        {(selectedStation || selectedSection) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-primary" />
                  {selectedStation 
                    ? `Add Infrastructure to ${infra.stations.find(s => s.id === selectedStation)?.name}`
                    : `Modify Section ${infra.sections.find(s => s.id === selectedSection)?.id.toUpperCase().replace('-', ' → ')}`
                  }
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {selectedStation && (
                    <Dialog open={addLoopDialog} onOpenChange={setAddLoopDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                          <Plus className="h-4 w-4 mr-1" />
                          Add Loop Line
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add Loop Line</DialogTitle>
                          <DialogDescription>
                            Loop lines enable train crossing and overtaking, increasing section capacity.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Loop Name</Label>
                            <Input 
                              value={newLoopName}
                              onChange={(e) => setNewLoopName(e.target.value)}
                              placeholder="e.g., Loop 1"
                            />
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-sm text-muted-foreground">
                              <span className="text-green-400 font-medium">+5 trains/day</span> capacity increase expected
                            </p>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button onClick={handleAddLoop}>Add Loop</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                  
                  {selectedSection && (
                    <>
                      <Dialog open={addMainLineDialog} onOpenChange={setAddMainLineDialog}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            disabled={(infra.sections.find(s => s.id === selectedSection)?.mainLines || 1) >= 3}
                          >
                            <Layers className="h-4 w-4 mr-1" />
                            Add Main Line
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Parallel Main Line</DialogTitle>
                            <DialogDescription>
                              Adding a second/third main line dramatically increases capacity.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                              <p className="text-sm text-green-400 font-medium">
                                ~100% capacity increase per additional line
                              </p>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleAddMainLine}>Add Main Line</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      
                      <Dialog open={addCrossoverDialog} onOpenChange={setAddCrossoverDialog}>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            disabled={(infra.sections.find(s => s.id === selectedSection)?.mainLines || 1) < 2}
                          >
                            <Repeat className="h-4 w-4 mr-1" />
                            Add Crossover
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Install Crossover</DialogTitle>
                            <DialogDescription>
                              Crossovers allow trains to switch between parallel tracks.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Position in section: {crossoverPosition}%</Label>
                              <Slider 
                                value={[crossoverPosition]}
                                onValueChange={(v) => setCrossoverPosition(v[0])}
                                min={10}
                                max={90}
                                step={5}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={handleAddCrossover}>Install Crossover</Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                      
                      {infra.sections.find(s => s.id === selectedSection)?.signallingType !== 'automatic' && (
                        <Dialog open={upgradeSignalDialog} onOpenChange={setUpgradeSignalDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              <Zap className="h-4 w-4 mr-1" />
                              Upgrade to AT
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Upgrade Signalling System</DialogTitle>
                              <DialogDescription>
                                Convert from Absolute Block to Automatic Block signalling.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-4 space-y-3">
                              <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                                <p className="text-sm text-green-400 font-medium">~100% capacity increase</p>
                              </div>
                            </div>
                            <DialogFooter className="gap-2">
                              <Button variant="outline" onClick={() => handleUpgradeSignalling('semi-automatic')}>
                                Semi-Automatic
                              </Button>
                              <Button onClick={() => handleUpgradeSignalling('automatic')}>
                                Full Automatic
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </>
                  )}
                  
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => { setSelectedStation(null); setSelectedSection(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ===========================================
// KPI Card Component
// ===========================================

interface KPICardProps {
  label: string;
  value: number;
  unit: string;
  change: number | null | undefined;
  icon: React.ReactNode;
  positive: boolean;
  highlight?: boolean;
}

function KPICard({ label, value, unit, change, icon, positive, highlight }: KPICardProps) {
  const hasChange = change !== null && change !== undefined && change !== 0;
  const isGoodChange = positive ? (change || 0) > 0 : (change || 0) < 0;
  
  return (
    <Card className={cn(
      "bg-card/50 backdrop-blur border-border/50 transition-all",
      highlight && "border-primary/30 bg-primary/5"
    )}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className={cn("text-xl font-bold", highlight && "text-primary")}>{value}</span>
          {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
        </div>
        {hasChange && (
          <div className={cn(
            "flex items-center gap-1 text-[10px] mt-1",
            isGoodChange ? "text-green-400" : "text-red-400"
          )}>
            {isGoodChange ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{(change || 0) > 0 ? '+' : ''}{change}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
