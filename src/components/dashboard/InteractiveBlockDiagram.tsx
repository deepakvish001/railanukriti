import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Plus, Minus, Train, CircleDot, ArrowLeftRight, Gauge, 
  TrendingUp, TrendingDown, Zap, Clock, AlertTriangle, 
  RotateCcw, Play, Pause, Eye, EyeOff, Settings2,
  GitBranch, Repeat, ArrowUpDown
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// Types for infrastructure
interface Station {
  id: string;
  code: string;
  name: string;
  type: 'station' | 'junction' | 'halt';
  position: number;
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
  signals: Signal[];
  crossovers: Crossover[];
}

interface Signal {
  id: string;
  type: 'home' | 'starter' | 'distant' | 'intermediate';
  positionKm: number;
  aspect: 'red' | 'yellow' | 'green';
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
  avgSpeed: number;
  avgDelay: number;
  capacity: number;
  utilization: number;
  conflictRisk: number;
}

// Initial mock data for the KTV route
const getInitialInfraState = (): InfraState => ({
  stations: [
    { id: 'jbp', code: 'JBP', name: 'Jabalpur', type: 'junction', position: 0, platforms: 6, loops: [] },
    { id: 'mni', code: 'MNI', name: 'Madan Mahal', type: 'station', position: 8, platforms: 2, loops: [] },
    { id: 'nrsh', code: 'NRSH', name: 'Narsinghpur', type: 'station', position: 45, platforms: 3, loops: [{ id: 'nrsh-l1', name: 'Loop 1', lengthM: 750, maxSpeed: 30, direction: 'both' }] },
    { id: 'gdw', code: 'GDW', name: 'Gadarwara', type: 'station', position: 85, platforms: 2, loops: [] },
    { id: 'ppr', code: 'PPR', name: 'Pipariya', type: 'junction', position: 115, platforms: 3, loops: [{ id: 'ppr-l1', name: 'Loop 1', lengthM: 750, maxSpeed: 30, direction: 'both' }] },
    { id: 'itr', code: 'ITR', name: 'Itarsi', type: 'junction', position: 155, platforms: 7, loops: [] },
  ],
  sections: [
    { 
      id: 'jbp-mni', fromStation: 'jbp', toStation: 'mni', distanceKm: 8, signallingType: 'automatic', 
      mainLines: 2, maxSpeed: 110, signals: [], crossovers: []
    },
    { 
      id: 'mni-nrsh', fromStation: 'mni', toStation: 'nrsh', distanceKm: 37, signallingType: 'automatic', 
      mainLines: 2, maxSpeed: 100, signals: [], crossovers: []
    },
    { 
      id: 'nrsh-gdw', fromStation: 'nrsh', toStation: 'gdw', distanceKm: 40, signallingType: 'absolute', 
      mainLines: 1, maxSpeed: 90, signals: [], crossovers: []
    },
    { 
      id: 'gdw-ppr', fromStation: 'gdw', toStation: 'ppr', distanceKm: 30, signallingType: 'absolute', 
      mainLines: 1, maxSpeed: 85, signals: [], crossovers: []
    },
    { 
      id: 'ppr-itr', fromStation: 'ppr', toStation: 'itr', distanceKm: 40, signallingType: 'automatic', 
      mainLines: 2, maxSpeed: 110, signals: [], crossovers: []
    },
  ],
});

// Calculate KPIs based on infrastructure
const calculateKPIs = (infra: InfraState): KPIMetrics => {
  let totalCapacity = 0;
  let weightedSpeed = 0;
  let totalDistance = 0;
  let conflictRiskSum = 0;
  
  infra.sections.forEach(section => {
    const distance = section.distanceKm;
    totalDistance += distance;
    
    // Base capacity based on signalling
    let baseCapacity = section.signallingType === 'automatic' ? 48 : 
                       section.signallingType === 'semi-automatic' ? 36 : 24;
    
    // Track multiplier
    baseCapacity *= section.mainLines;
    
    // Loop bonus from adjacent stations
    const fromStation = infra.stations.find(s => s.id === section.fromStation);
    const toStation = infra.stations.find(s => s.id === section.toStation);
    const loopCount = (fromStation?.loops.length || 0) + (toStation?.loops.length || 0);
    baseCapacity += loopCount * 4;
    
    // Crossover bonus
    baseCapacity += section.crossovers.length * 2;
    
    totalCapacity += baseCapacity;
    weightedSpeed += section.maxSpeed * distance;
    
    // Conflict risk (higher for single line absolute block)
    if (section.mainLines === 1 && section.signallingType === 'absolute') {
      conflictRiskSum += 30;
    } else if (section.mainLines === 1) {
      conflictRiskSum += 15;
    } else {
      conflictRiskSum += 5;
    }
  });
  
  const sectionCount = infra.sections.length;
  const avgCapacity = Math.round(totalCapacity / sectionCount);
  const avgSpeed = Math.round(weightedSpeed / totalDistance);
  const avgConflictRisk = Math.round(conflictRiskSum / sectionCount);
  
  // Simulated metrics
  const currentTrains = 35;
  const utilizationPercent = Math.min(100, Math.round((currentTrains / avgCapacity) * 100));
  
  // Delay estimation (inversely related to capacity and speed)
  const baseDelay = 15;
  const capacityFactor = avgCapacity > 40 ? 0.5 : avgCapacity > 30 ? 0.75 : 1;
  const avgDelay = Math.round(baseDelay * capacityFactor);
  
  return {
    throughputTrainsPerDay: avgCapacity,
    avgSpeed,
    avgDelay,
    capacity: avgCapacity,
    utilization: utilizationPercent,
    conflictRisk: avgConflictRisk,
  };
};

interface BlockDiagramProps {
  onInfraChange?: (infra: InfraState, kpis: KPIMetrics) => void;
}

export function InteractiveBlockDiagram({ onInfraChange }: BlockDiagramProps) {
  const [infra, setInfra] = useState<InfraState>(getInitialInfraState);
  const [baselineKPIs, setBaselineKPIs] = useState<KPIMetrics | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<string | null>(null);
  const [showSignals, setShowSignals] = useState(true);
  const [showLoops, setShowLoops] = useState(true);
  const [showCrossovers, setShowCrossovers] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  
  // Add dialogs
  const [addLoopDialog, setAddLoopDialog] = useState(false);
  const [addCrossoverDialog, setAddCrossoverDialog] = useState(false);
  const [addMainLineDialog, setAddMainLineDialog] = useState(false);
  const [upgradeSignalDialog, setUpgradeSignalDialog] = useState(false);
  
  // New infrastructure form state
  const [newLoopName, setNewLoopName] = useState('');
  const [newLoopLength, setNewLoopLength] = useState(750);
  const [newCrossoverPosition, setNewCrossoverPosition] = useState(50);
  
  // Calculate current KPIs
  const currentKPIs = useMemo(() => calculateKPIs(infra), [infra]);
  
  // Calculate KPI changes from baseline
  const kpiChanges = useMemo(() => {
    if (!baselineKPIs) return null;
    return {
      throughput: currentKPIs.throughputTrainsPerDay - baselineKPIs.throughputTrainsPerDay,
      speed: currentKPIs.avgSpeed - baselineKPIs.avgSpeed,
      delay: currentKPIs.avgDelay - baselineKPIs.avgDelay,
      risk: currentKPIs.conflictRisk - baselineKPIs.conflictRisk,
    };
  }, [currentKPIs, baselineKPIs]);
  
  // Notify parent of changes
  const notifyChange = useCallback((newInfra: InfraState) => {
    const newKPIs = calculateKPIs(newInfra);
    if (onInfraChange) {
      onInfraChange(newInfra, newKPIs);
    }
  }, [onInfraChange]);
  
  // Set baseline for comparison
  const setBaseline = () => {
    setBaselineKPIs(currentKPIs);
    toast.success('Baseline set! Changes will be compared against current state.');
  };
  
  // Reset to initial state
  const resetInfra = () => {
    const initial = getInitialInfraState();
    setInfra(initial);
    setBaselineKPIs(null);
    notifyChange(initial);
    toast.info('Infrastructure reset to initial state');
  };
  
  // Add loop to station
  const handleAddLoop = () => {
    if (!selectedStation || !newLoopName) return;
    
    const newInfra = {
      ...infra,
      stations: infra.stations.map(station => {
        if (station.id === selectedStation) {
          return {
            ...station,
            loops: [
              ...station.loops,
              {
                id: `${station.id}-loop-${Date.now()}`,
                name: newLoopName || `Loop ${station.loops.length + 1}`,
                lengthM: newLoopLength,
                maxSpeed: 30,
                direction: 'both' as const,
              }
            ]
          };
        }
        return station;
      })
    };
    
    setInfra(newInfra);
    notifyChange(newInfra);
    setAddLoopDialog(false);
    setNewLoopName('');
    toast.success(`Loop added to ${infra.stations.find(s => s.id === selectedStation)?.name}`);
  };
  
  // Remove loop from station
  const handleRemoveLoop = (stationId: string, loopId: string) => {
    const newInfra = {
      ...infra,
      stations: infra.stations.map(station => {
        if (station.id === stationId) {
          return {
            ...station,
            loops: station.loops.filter(l => l.id !== loopId)
          };
        }
        return station;
      })
    };
    
    setInfra(newInfra);
    notifyChange(newInfra);
    toast.info('Loop removed');
  };
  
  // Add crossover to section
  const handleAddCrossover = () => {
    if (!selectedSection) return;
    
    const section = infra.sections.find(s => s.id === selectedSection);
    if (!section || section.mainLines < 2) {
      toast.error('Crossovers require at least 2 main lines');
      return;
    }
    
    const newInfra = {
      ...infra,
      sections: infra.sections.map(sec => {
        if (sec.id === selectedSection) {
          return {
            ...sec,
            crossovers: [
              ...sec.crossovers,
              {
                id: `${sec.id}-xover-${Date.now()}`,
                positionKm: (newCrossoverPosition / 100) * sec.distanceKm,
                type: 'double' as const,
              }
            ]
          };
        }
        return sec;
      })
    };
    
    setInfra(newInfra);
    notifyChange(newInfra);
    setAddCrossoverDialog(false);
    toast.success('Crossover added');
  };
  
  // Add main line to section
  const handleAddMainLine = () => {
    if (!selectedSection) return;
    
    const newInfra = {
      ...infra,
      sections: infra.sections.map(sec => {
        if (sec.id === selectedSection && sec.mainLines < 3) {
          return { ...sec, mainLines: sec.mainLines + 1 };
        }
        return sec;
      })
    };
    
    setInfra(newInfra);
    notifyChange(newInfra);
    setAddMainLineDialog(false);
    toast.success('Main line added - capacity doubled!');
  };
  
  // Upgrade signalling
  const handleUpgradeSignalling = (newType: 'automatic' | 'semi-automatic') => {
    if (!selectedSection) return;
    
    const newInfra = {
      ...infra,
      sections: infra.sections.map(sec => {
        if (sec.id === selectedSection) {
          return { ...sec, signallingType: newType };
        }
        return sec;
      })
    };
    
    setInfra(newInfra);
    notifyChange(newInfra);
    setUpgradeSignalDialog(false);
    toast.success(`Signalling upgraded to ${newType === 'automatic' ? 'Automatic Block' : 'Semi-Automatic'}`);
  };
  
  // Get station by id
  const getStation = (id: string) => infra.stations.find(s => s.id === id);
  
  // Total route distance
  const totalDistance = infra.sections.reduce((sum, s) => sum + s.distanceKm, 0);
  
  return (
    <div className="space-y-4">
      {/* Controls Header */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Label className="text-xs">Signals</Label>
                <Switch checked={showSignals} onCheckedChange={setShowSignals} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Loops</Label>
                <Switch checked={showLoops} onCheckedChange={setShowLoops} />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Crossovers</Label>
                <Switch checked={showCrossovers} onCheckedChange={setShowCrossovers} />
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={setBaseline}>
                <Gauge className="h-4 w-4 mr-1" />
                Set Baseline
              </Button>
              <Button variant="outline" size="sm" onClick={resetInfra}>
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
      
      {/* Live KPIs Panel */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPICard 
          label="Throughput" 
          value={`${currentKPIs.throughputTrainsPerDay}`}
          unit="trains/day"
          change={kpiChanges?.throughput}
          icon={<Train className="h-4 w-4" />}
          positive={true}
        />
        <KPICard 
          label="Avg Speed" 
          value={`${currentKPIs.avgSpeed}`}
          unit="km/h"
          change={kpiChanges?.speed}
          icon={<Gauge className="h-4 w-4" />}
          positive={true}
        />
        <KPICard 
          label="Avg Delay" 
          value={`${currentKPIs.avgDelay}`}
          unit="min"
          change={kpiChanges?.delay}
          icon={<Clock className="h-4 w-4" />}
          positive={false}
        />
        <KPICard 
          label="Capacity" 
          value={`${currentKPIs.capacity}`}
          unit="trains/day"
          change={null}
          icon={<TrendingUp className="h-4 w-4" />}
          positive={true}
        />
        <KPICard 
          label="Conflict Risk" 
          value={`${currentKPIs.conflictRisk}%`}
          unit=""
          change={kpiChanges?.risk}
          icon={<AlertTriangle className="h-4 w-4" />}
          positive={false}
        />
      </div>
      
      {/* Block Diagram */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <GitBranch className="h-5 w-5 text-primary" />
            Interactive Block Diagram
          </CardTitle>
          <CardDescription>
            Click on stations or sections to modify infrastructure. Changes update KPIs in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="w-full pb-4">
            <div className="relative min-w-[1000px] py-8 px-4">
              {/* Main track line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-8 flex items-center">
                {infra.sections.map((section, idx) => {
                  const startPos = (getStation(section.fromStation)?.position || 0) / totalDistance * 100;
                  const endPos = (getStation(section.toStation)?.position || 0) / totalDistance * 100;
                  const width = endPos - startPos;
                  const isSelected = selectedSection === section.id;
                  const isAT = section.signallingType === 'automatic';
                  const isSemiAT = section.signallingType === 'semi-automatic';
                  
                  return (
                    <div
                      key={section.id}
                      className="absolute"
                      style={{ left: `${startPos}%`, width: `${width}%` }}
                    >
                      {/* Section container - clickable */}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className={cn(
                                "absolute inset-0 group cursor-pointer transition-all",
                                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded"
                              )}
                              onClick={() => setSelectedSection(isSelected ? null : section.id)}
                            >
                              {/* Main lines */}
                              {Array.from({ length: section.mainLines }).map((_, lineIdx) => (
                                <div
                                  key={lineIdx}
                                  className={cn(
                                    "absolute left-0 right-0 h-2 rounded transition-all",
                                    isAT ? "bg-gradient-to-r from-green-600 to-green-500" :
                                    isSemiAT ? "bg-gradient-to-r from-blue-600 to-blue-500" :
                                    "bg-gradient-to-r from-amber-600 to-amber-500",
                                    "group-hover:shadow-lg",
                                    isAT && "group-hover:shadow-green-500/30",
                                    isSemiAT && "group-hover:shadow-blue-500/30",
                                    !isAT && !isSemiAT && "group-hover:shadow-amber-500/30"
                                  )}
                                  style={{ 
                                    top: `${20 + lineIdx * 14}%`,
                                    marginTop: section.mainLines > 1 ? `${(lineIdx - (section.mainLines - 1) / 2) * 8}px` : 0
                                  }}
                                />
                              ))}
                              
                              {/* Signals for AT sections */}
                              {showSignals && isAT && (
                                <>
                                  {Array.from({ length: Math.min(Math.floor(section.distanceKm / 1.2), 6) }).map((_, sigIdx) => (
                                    <div
                                      key={sigIdx}
                                      className="absolute top-1/2 -translate-y-1/2"
                                      style={{ left: `${((sigIdx + 1) / (Math.floor(section.distanceKm / 1.2) + 1)) * 100}%` }}
                                    >
                                      <div className="w-1.5 h-4 bg-green-400 rounded-sm shadow-lg shadow-green-400/50" />
                                    </div>
                                  ))}
                                </>
                              )}
                              
                              {/* Crossovers */}
                              {showCrossovers && section.crossovers.map((xover, xIdx) => (
                                <div
                                  key={xover.id}
                                  className="absolute top-0 bottom-0 w-4 flex items-center justify-center"
                                  style={{ left: `${(xover.positionKm / section.distanceKm) * 100}%` }}
                                >
                                  <div className="h-full w-0.5 bg-cyan-400/60" />
                                  <Repeat className="absolute h-3 w-3 text-cyan-400" />
                                </div>
                              ))}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <div className="space-y-1">
                              <p className="font-medium">{getStation(section.fromStation)?.code} → {getStation(section.toStation)?.code}</p>
                              <p className="text-xs text-muted-foreground">{section.distanceKm} km • {section.maxSpeed} km/h</p>
                              <div className="flex gap-2">
                                <Badge variant="outline" className={cn(
                                  "text-[10px]",
                                  isAT && "border-green-500/50 text-green-400",
                                  isSemiAT && "border-blue-500/50 text-blue-400",
                                  !isAT && !isSemiAT && "border-amber-500/50 text-amber-400"
                                )}>
                                  {isAT ? 'AT' : isSemiAT ? 'Semi-AT' : 'AB'}
                                </Badge>
                                <Badge variant="outline" className="text-[10px]">
                                  {section.mainLines} {section.mainLines > 1 ? 'Lines' : 'Line'}
                                </Badge>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      
                      {/* Distance label below */}
                      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground font-mono">
                        {section.distanceKm} km
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Stations */}
              {infra.stations.map((station) => {
                const positionPercent = (station.position / totalDistance) * 100;
                const isSelected = selectedStation === station.id;
                const isJunction = station.type === 'junction';
                
                return (
                  <div
                    key={station.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                    style={{ left: `${positionPercent}%` }}
                  >
                    {/* Loop lines */}
                    {showLoops && station.loops.map((loop, loopIdx) => (
                      <div
                        key={loop.id}
                        className="absolute left-1/2 -translate-x-1/2"
                        style={{ top: `${-30 - loopIdx * 25}px` }}
                      >
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="relative">
                                <div className="w-16 h-4 border-2 border-purple-500/60 rounded-full bg-purple-500/10" />
                                <button
                                  className="absolute -right-1 -top-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveLoop(station.id, loop.id);
                                  }}
                                >
                                  <Minus className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-medium">{loop.name}</p>
                              <p className="text-xs text-muted-foreground">{loop.lengthM}m • {loop.maxSpeed} km/h</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                    
                    {/* Station marker */}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              "relative flex items-center justify-center transition-all",
                              isJunction ? "w-8 h-8" : "w-6 h-6",
                              isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background rounded-full"
                            )}
                            onClick={() => setSelectedStation(isSelected ? null : station.id)}
                          >
                            <div className={cn(
                              "absolute inset-0 rounded-full transition-all",
                              isJunction 
                                ? "bg-primary border-2 border-primary-foreground shadow-lg shadow-primary/50" 
                                : "bg-foreground border-2 border-background"
                            )}>
                              {isJunction && (
                                <div className="absolute inset-1 bg-primary-foreground/20 rounded-full" />
                              )}
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="space-y-1">
                            <p className="font-medium">{station.name} ({station.code})</p>
                            <p className="text-xs text-muted-foreground">{station.platforms} platforms • {station.loops.length} loops</p>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    
                    {/* Station label */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 flex flex-col items-center">
                      <span className={cn(
                        "text-xs font-bold whitespace-nowrap px-1.5 py-0.5 rounded",
                        isJunction ? "text-primary bg-primary/10" : "text-foreground"
                      )}>
                        {station.code}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{station.platforms}P</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-4 p-3 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-2 bg-gradient-to-r from-green-600 to-green-500 rounded" />
              <span className="text-muted-foreground">Automatic Block (AT)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-2 bg-gradient-to-r from-blue-600 to-blue-500 rounded" />
              <span className="text-muted-foreground">Semi-Automatic</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-6 h-2 bg-gradient-to-r from-amber-600 to-amber-500 rounded" />
              <span className="text-muted-foreground">Absolute Block (AB)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-4 h-3 border-2 border-purple-500/60 rounded-full bg-purple-500/10" />
              <span className="text-muted-foreground">Loop Line</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Repeat className="h-3 w-3 text-cyan-400" />
              <span className="text-muted-foreground">Crossover</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">Junction</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full bg-foreground" />
              <span className="text-muted-foreground">Station</span>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Action Panel - Shows when station or section is selected */}
      {(selectedStation || selectedSection) && (
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-primary" />
              {selectedStation 
                ? `Modify ${infra.stations.find(s => s.id === selectedStation)?.name}`
                : `Modify Section ${infra.sections.find(s => s.id === selectedSection)?.id.toUpperCase()}`
              }
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedStation && (
                <>
                  <Dialog open={addLoopDialog} onOpenChange={setAddLoopDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Loop Line
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Loop Line</DialogTitle>
                        <DialogDescription>
                          Add a loop line for train crossing/overtaking at this station.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Loop Name</Label>
                          <Input 
                            placeholder="e.g., Loop 1" 
                            value={newLoopName}
                            onChange={(e) => setNewLoopName(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Length (meters)</Label>
                          <Input 
                            type="number" 
                            value={newLoopLength}
                            onChange={(e) => setNewLoopLength(parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddLoop}>Add Loop</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              )}
              
              {selectedSection && (
                <>
                  <Dialog open={addMainLineDialog} onOpenChange={setAddMainLineDialog}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" disabled={
                        infra.sections.find(s => s.id === selectedSection)?.mainLines >= 3
                      }>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Main Line
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Main Line</DialogTitle>
                        <DialogDescription>
                          Adding a parallel main line will significantly increase capacity.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4">
                        <p className="text-sm text-muted-foreground">
                          This will upgrade the section from{' '}
                          <Badge variant="outline">
                            {infra.sections.find(s => s.id === selectedSection)?.mainLines} line
                          </Badge>
                          {' '}to{' '}
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            {(infra.sections.find(s => s.id === selectedSection)?.mainLines || 1) + 1} lines
                          </Badge>
                        </p>
                        <p className="text-sm text-green-400 mt-2">
                          Expected capacity increase: ~100%
                        </p>
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
                        disabled={infra.sections.find(s => s.id === selectedSection)?.mainLines < 2}
                      >
                        <ArrowLeftRight className="h-4 w-4 mr-1" />
                        Add Crossover
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Crossover</DialogTitle>
                        <DialogDescription>
                          Crossovers allow trains to switch between tracks.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Position in section (%)</Label>
                          <Input 
                            type="number" 
                            min="10"
                            max="90"
                            value={newCrossoverPosition}
                            onChange={(e) => setNewCrossoverPosition(parseInt(e.target.value))}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleAddCrossover}>Add Crossover</Button>
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
                          <DialogTitle>Upgrade Signalling</DialogTitle>
                          <DialogDescription>
                            Upgrade from Absolute Block to Automatic Block signalling.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <p className="text-sm text-muted-foreground">
                            Automatic Block (AT) allows multiple trains in a section with safe spacing, 
                            significantly increasing throughput.
                          </p>
                          <p className="text-sm text-green-400 mt-2">
                            Expected capacity increase: ~60-100%
                          </p>
                        </div>
                        <DialogFooter>
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
                onClick={() => { setSelectedSection(null); setSelectedStation(null); }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// KPI Card Component
function KPICard({ 
  label, 
  value, 
  unit, 
  change, 
  icon,
  positive 
}: { 
  label: string; 
  value: string; 
  unit: string;
  change: number | null | undefined;
  icon: React.ReactNode;
  positive: boolean;
}) {
  const hasChange = change !== null && change !== undefined && change !== 0;
  const isPositiveChange = positive ? change! > 0 : change! < 0;
  
  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardContent className="py-3 px-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{value}</span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
        {hasChange && (
          <div className={cn(
            "flex items-center gap-1 text-xs mt-1",
            isPositiveChange ? "text-green-400" : "text-red-400"
          )}>
            {isPositiveChange ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            <span>{change! > 0 ? '+' : ''}{change}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InteractiveBlockDiagram;
