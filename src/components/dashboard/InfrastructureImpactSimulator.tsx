import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Progress } from '@/components/ui/progress';
import { 
  Train, Gauge, Clock, TrendingUp, TrendingDown, AlertTriangle,
  Plus, Minus, RotateCcw, Play, Pause, Settings2, GitBranch,
  Repeat, Zap, ArrowLeftRight, Activity, Target, ChevronDown,
  ChevronUp, Eye, Timer, Route, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

// ===========================================
// Types
// ===========================================

interface Station {
  id: string;
  code: string;
  name: string;
  type: 'station' | 'junction' | 'halt';
  positionKm: number;
  platforms: number;
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
}

interface SimulatedTrain {
  id: string;
  loadId: string;
  currentPositionKm: number;
  speed: number;
  status: 'running' | 'waiting' | 'stopped';
  delay: number;
  color: string;
}

// ===========================================
// Initial Data - KTV Route
// ===========================================

const getInitialInfra = (): InfraState => ({
  stations: [
    { id: 'jbp', code: 'JBP', name: 'Jabalpur', type: 'junction', positionKm: 0, platforms: 6, loops: [] },
    { id: 'mni', code: 'MNI', name: 'Madan Mahal', type: 'station', positionKm: 8, platforms: 2, loops: [] },
    { id: 'sgh', code: 'SGH', name: 'Sohagpur', type: 'station', positionKm: 35, platforms: 2, loops: [] },
    { id: 'nrsh', code: 'NRSH', name: 'Narsinghpur', type: 'station', positionKm: 55, platforms: 3, loops: [
      { id: 'nrsh-l1', name: 'Loop 1', lengthM: 750, maxSpeed: 30, direction: 'both' }
    ]},
    { id: 'krli', code: 'KRLI', name: 'Kareli', type: 'station', positionKm: 75, platforms: 2, loops: [] },
    { id: 'gdw', code: 'GDW', name: 'Gadarwara', type: 'station', positionKm: 95, platforms: 2, loops: [] },
    { id: 'ppr', code: 'PPR', name: 'Pipariya', type: 'junction', positionKm: 120, platforms: 3, loops: [
      { id: 'ppr-l1', name: 'Loop 1', lengthM: 750, maxSpeed: 30, direction: 'both' }
    ]},
    { id: 'itr', code: 'ITR', name: 'Itarsi', type: 'junction', positionKm: 155, platforms: 7, loops: [] },
  ],
  sections: [
    { id: 'jbp-mni', fromStation: 'jbp', toStation: 'mni', distanceKm: 8, signallingType: 'automatic', mainLines: 2, maxSpeed: 110, crossovers: [] },
    { id: 'mni-sgh', fromStation: 'mni', toStation: 'sgh', distanceKm: 27, signallingType: 'automatic', mainLines: 2, maxSpeed: 100, crossovers: [] },
    { id: 'sgh-nrsh', fromStation: 'sgh', toStation: 'nrsh', distanceKm: 20, signallingType: 'absolute', mainLines: 1, maxSpeed: 90, crossovers: [] },
    { id: 'nrsh-krli', fromStation: 'nrsh', toStation: 'krli', distanceKm: 20, signallingType: 'absolute', mainLines: 1, maxSpeed: 85, crossovers: [] },
    { id: 'krli-gdw', fromStation: 'krli', toStation: 'gdw', distanceKm: 20, signallingType: 'absolute', mainLines: 1, maxSpeed: 85, crossovers: [] },
    { id: 'gdw-ppr', fromStation: 'gdw', toStation: 'ppr', distanceKm: 25, signallingType: 'automatic', mainLines: 2, maxSpeed: 100, crossovers: [] },
    { id: 'ppr-itr', fromStation: 'ppr', toStation: 'itr', distanceKm: 35, signallingType: 'automatic', mainLines: 2, maxSpeed: 110, crossovers: [] },
  ],
});

// ===========================================
// KPI Calculator
// ===========================================

const calculateKPIs = (infra: InfraState): KPIMetrics => {
  let totalCapacity = 0;
  let weightedSpeed = 0;
  let totalDistance = 0;
  let conflictRiskSum = 0;
  let minCapacity = Infinity;
  let bottleneckSection: string | null = null;
  
  infra.sections.forEach(section => {
    const distance = section.distanceKm;
    totalDistance += distance;
    
    // Base capacity based on signalling (trains per day)
    let baseCapacity = section.signallingType === 'automatic' ? 52 : 
                       section.signallingType === 'semi-automatic' ? 40 : 26;
    
    // Track multiplier
    baseCapacity *= section.mainLines;
    
    // Loop bonus from adjacent stations
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
    
    // Conflict risk (higher for single line absolute block)
    if (section.mainLines === 1 && section.signallingType === 'absolute') {
      conflictRiskSum += 35;
    } else if (section.mainLines === 1) {
      conflictRiskSum += 18;
    } else {
      conflictRiskSum += 6;
    }
  });
  
  const sectionCount = infra.sections.length;
  const avgCapacity = Math.round(totalCapacity / sectionCount);
  const avgSpeed = Math.round(weightedSpeed / totalDistance);
  const avgConflictRisk = Math.round(conflictRiskSum / sectionCount);
  
  // Overall capacity is limited by bottleneck
  const effectiveCapacity = Math.round(minCapacity);
  
  // Simulated current usage
  const currentTrains = 32;
  const utilizationPercent = Math.min(100, Math.round((currentTrains / effectiveCapacity) * 100));
  
  // Delay estimation
  const baseDelay = 18;
  const capacityFactor = effectiveCapacity > 45 ? 0.4 : effectiveCapacity > 35 ? 0.65 : 1;
  const avgDelay = Math.round(baseDelay * capacityFactor);
  
  return {
    throughputTrainsPerDay: currentTrains,
    avgSpeedKmh: avgSpeed,
    avgDelayMin: avgDelay,
    capacityTrainsPerDay: effectiveCapacity,
    utilizationPercent,
    conflictRiskPercent: avgConflictRisk,
    bottleneckSection,
  };
};

// ===========================================
// Simple Time-Distance Chart Component
// ===========================================

interface SimpleTimeDistanceProps {
  infra: InfraState;
  simulatedTrains: SimulatedTrain[];
  isSimulating: boolean;
}

function SimpleTimeDistanceChart({ infra, simulatedTrains, isSimulating }: SimpleTimeDistanceProps) {
  const totalDistance = infra.stations[infra.stations.length - 1]?.positionKm || 155;
  const chartHeight = 300;
  const chartWidth = 600;
  const padding = { top: 30, right: 20, bottom: 40, left: 60 };
  
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;
  
  // Time scale: 0-24 hours
  const timeToX = (hour: number) => padding.left + (hour / 24) * innerWidth;
  const distToY = (km: number) => padding.top + ((totalDistance - km) / totalDistance) * innerHeight;
  
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          Simulated Time-Distance Graph
        </CardTitle>
        <CardDescription className="text-xs">
          Shows predicted train movements based on current infrastructure
        </CardDescription>
      </CardHeader>
      <CardContent>
        <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overflow-visible">
          {/* Background grid */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.3" />
            </pattern>
          </defs>
          <rect x={padding.left} y={padding.top} width={innerWidth} height={innerHeight} fill="url(#grid)" />
          
          {/* Station lines (horizontal) */}
          {infra.stations.map(station => {
            const y = distToY(station.positionKm);
            return (
              <g key={station.id}>
                <line 
                  x1={padding.left} 
                  y1={y} 
                  x2={padding.left + innerWidth} 
                  y2={y}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={station.type === 'junction' ? 1.5 : 0.5}
                  strokeDasharray={station.type === 'junction' ? 'none' : '4,4'}
                  opacity={0.4}
                />
                <text
                  x={padding.left - 5}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-[10px] fill-muted-foreground"
                >
                  {station.code}
                </text>
              </g>
            );
          })}
          
          {/* Time axis labels */}
          {[0, 6, 12, 18, 24].map(hour => (
            <text
              key={hour}
              x={timeToX(hour)}
              y={chartHeight - 10}
              textAnchor="middle"
              className="text-[10px] fill-muted-foreground"
            >
              {hour}:00
            </text>
          ))}
          
          {/* Axis labels */}
          <text
            x={chartWidth / 2}
            y={chartHeight - 2}
            textAnchor="middle"
            className="text-[10px] fill-muted-foreground"
          >
            Time (hours)
          </text>
          <text
            x={12}
            y={chartHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, 12, ${chartHeight / 2})`}
            className="text-[10px] fill-muted-foreground"
          >
            Distance (km)
          </text>
          
          {/* Simulated train paths */}
          {simulatedTrains.map((train, idx) => {
            // Generate a simple path based on train position
            const startHour = (idx * 2) % 20;
            const endHour = startHour + 5;
            const startDist = 0;
            const endDist = totalDistance;
            
            // Add some variation for waiting at AB sections
            const abSections = infra.sections.filter(s => s.signallingType === 'absolute');
            const waitPoints = abSections.map(s => {
              const station = infra.stations.find(st => st.id === s.fromStation);
              return station?.positionKm || 0;
            });
            
            // Build path
            let pathD = `M ${timeToX(startHour)} ${distToY(startDist)}`;
            let currentHour = startHour;
            let currentDist = startDist;
            
            infra.stations.forEach((station, stIdx) => {
              if (stIdx === 0) return;
              
              const dist = station.positionKm;
              const section = infra.sections[stIdx - 1];
              const travelTime = section.distanceKm / (section.maxSpeed * 0.6); // simplified
              currentHour += travelTime;
              
              // Add wait time for AB sections
              if (section.signallingType === 'absolute' && section.mainLines === 1) {
                // Horizontal line for waiting
                pathD += ` L ${timeToX(currentHour)} ${distToY(currentDist)}`;
                currentHour += 0.3 + Math.random() * 0.4; // 18-42 min wait
              }
              
              currentDist = dist;
              pathD += ` L ${timeToX(currentHour)} ${distToY(currentDist)}`;
            });
            
            return (
              <motion.path
                key={train.id}
                d={pathD}
                fill="none"
                stroke={train.color}
                strokeWidth={2}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ 
                  pathLength: isSimulating ? 1 : 0.8,
                  opacity: 1 
                }}
                transition={{ duration: isSimulating ? 2 : 0.5, delay: idx * 0.3 }}
              />
            );
          })}
          
          {/* AB section markers */}
          {infra.sections.filter(s => s.signallingType === 'absolute').map(section => {
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
                opacity={0.05}
              />
            );
          })}
        </svg>
        
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="w-4 h-2 bg-destructive/20 rounded" />
            <span>AB Section (bottleneck)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-0.5 bg-green-500 rounded" />
            <span>Train Path</span>
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
  const [infra, setInfra] = useState<InfraState>(getInitialInfra);
  const [baselineKPIs, setBaselineKPIs] = useState<KPIMetrics | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  
  // Dialogs
  const [addLoopDialog, setAddLoopDialog] = useState(false);
  const [addMainLineDialog, setAddMainLineDialog] = useState(false);
  const [addCrossoverDialog, setAddCrossoverDialog] = useState(false);
  const [upgradeSignalDialog, setUpgradeSignalDialog] = useState(false);
  
  // Form state
  const [newLoopName, setNewLoopName] = useState('New Loop');
  const [crossoverPosition, setCrossoverPosition] = useState(50);
  
  // Calculate KPIs
  const currentKPIs = useMemo(() => calculateKPIs(infra), [infra]);
  
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
  
  // Simulated trains
  const simulatedTrains = useMemo<SimulatedTrain[]>(() => {
    const colors = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];
    return Array.from({ length: 8 }, (_, i) => ({
      id: `train-${i}`,
      loadId: `LOAD-${1000 + i}`,
      currentPositionKm: (i * 20) % 155,
      speed: 60 + Math.random() * 40,
      status: i % 3 === 0 ? 'waiting' : 'running',
      delay: Math.floor(Math.random() * 15),
      color: colors[i % colors.length],
    }));
  }, [infra]);
  
  // Total distance
  const totalDistance = infra.stations[infra.stations.length - 1]?.positionKm || 155;
  
  // Set baseline
  const handleSetBaseline = () => {
    setBaselineKPIs(currentKPIs);
    toast.success('Baseline set! Changes will be compared.');
  };
  
  // Reset infrastructure
  const handleReset = () => {
    setInfra(getInitialInfra());
    setBaselineKPIs(null);
    setSelectedStation(null);
    setSelectedSection(null);
    toast.info('Infrastructure reset to initial state');
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
    
    setAddLoopDialog(false);
    setNewLoopName('New Loop');
    toast.success('Loop line added');
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
    
    setAddMainLineDialog(false);
    toast.success('Main line added - capacity increased!');
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
    
    setUpgradeSignalDialog(false);
    toast.success(`Signalling upgraded to ${newType === 'automatic' ? 'Automatic Block' : 'Semi-Automatic Block'}`);
  };
  
  // Get station by id
  const getStation = (id: string) => infra.stations.find(s => s.id === id);
  
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
                {infra.stations.length} stations • {totalDistance} km
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSetBaseline}>
                <Target className="h-4 w-4 mr-1" />
                Set Baseline
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
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
          unit="trains/day"
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
          label="Utilization"
          value={currentKPIs.utilizationPercent}
          unit="%"
          change={null}
          icon={<TrendingUp className="h-4 w-4" />}
          positive={true}
        />
        <KPICard 
          label="Conflict Risk"
          value={currentKPIs.conflictRiskPercent}
          unit="%"
          change={kpiChanges?.risk}
          icon={<AlertTriangle className="h-4 w-4" />}
          positive={false}
        />
        <Card className={cn(
          "bg-card/50 backdrop-blur border-destructive/30",
          currentKPIs.bottleneckSection && "bg-destructive/5"
        )}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Bottleneck</span>
              <AlertTriangle className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-lg font-bold text-destructive">
              {currentKPIs.bottleneckSection || 'None'}
            </span>
          </CardContent>
        </Card>
      </div>
      
      {/* Main Content - Block Diagram + Time-Distance */}
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
              <div className="relative min-w-[600px] h-[200px] py-4 px-2">
                {/* Section tracks */}
                {infra.sections.map((section, idx) => {
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
                                "relative w-full h-12 group cursor-pointer transition-all rounded",
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
                              
                              {/* AT signals */}
                              {isAT && Array.from({ length: Math.min(Math.floor(section.distanceKm / 2), 4) }).map((_, sigIdx) => (
                                <div
                                  key={sigIdx}
                                  className="absolute top-1/2 -translate-y-1/2"
                                  style={{ left: `${((sigIdx + 1) / (Math.floor(section.distanceKm / 2) + 1)) * 100}%` }}
                                >
                                  <div className="w-1 h-3 bg-green-400 rounded-sm shadow shadow-green-400/50" />
                                </div>
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
                                {section.distanceKm} km • {section.mainLines} line{section.mainLines > 1 ? 's' : ''} • {section.maxSpeed} km/h
                              </p>
                              <Badge variant="outline" className={cn(
                                "text-[10px]",
                                isAT && "border-green-500/50 text-green-400",
                                isSemiAT && "border-blue-500/50 text-blue-400",
                                !isAT && !isSemiAT && "border-amber-500/50 text-amber-400"
                              )}>
                                {isAT ? 'Automatic Block' : isSemiAT ? 'Semi-Automatic' : 'Absolute Block'}
                              </Badge>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Distance label */}
                      {showDetails && (
                        <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground font-mono">
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
                      {/* Loop lines above station */}
                      {station.loops.map((loop, loopIdx) => (
                        <div
                          key={loop.id}
                          className="absolute left-1/2 -translate-x-1/2 group"
                          style={{ top: `${-25 - loopIdx * 20}px` }}
                        >
                          <div className="relative">
                            <div className="w-12 h-3 border-2 border-purple-500/60 rounded-full bg-purple-500/10" />
                            <button
                              className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
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
                                isJunction ? "w-6 h-6" : "w-4 h-4",
                                isSelected && "ring-2 ring-primary ring-offset-1 ring-offset-background rounded-full"
                              )}
                              onClick={() => setSelectedStation(isSelected ? null : station.id)}
                            >
                              <div className={cn(
                                "absolute inset-0 rounded-full",
                                isJunction 
                                  ? "bg-primary border-2 border-primary-foreground shadow-lg shadow-primary/50" 
                                  : "bg-foreground border-2 border-background"
                              )} />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">{station.name} ({station.code})</p>
                            <p className="text-xs text-muted-foreground">
                              {station.platforms} platforms • {station.loops.length} loop{station.loops.length !== 1 ? 's' : ''}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Station label */}
                      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 flex flex-col items-center">
                        <span className={cn(
                          "text-[10px] font-bold whitespace-nowrap",
                          isJunction ? "text-primary" : "text-foreground"
                        )}>
                          {station.code}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2 text-[10px]">
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
            </div>
          </CardContent>
        </Card>
        
        {/* Time-Distance Chart */}
        <SimpleTimeDistanceChart 
          infra={infra} 
          simulatedTrains={simulatedTrains}
          isSimulating={isSimulating}
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
                            <div className="p-3 bg-muted/50 rounded-lg">
                              <p className="text-sm text-muted-foreground">
                                <span className="text-cyan-400 font-medium">+3 trains/day</span> capacity increase expected
                              </p>
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
                                <p className="text-sm">
                                  <span className="text-green-400 font-medium">Automatic Block (AT)</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Multiple trains can operate in the section with safe spacing. ~100% capacity increase.
                                </p>
                              </div>
                              <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                                <p className="text-sm">
                                  <span className="text-blue-400 font-medium">Semi-Automatic Block</span>
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Intermediate upgrade with partial automation. ~50% capacity increase.
                                </p>
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
