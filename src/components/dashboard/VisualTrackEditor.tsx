import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Pencil, Plus, Save, Trash2, Train, CircleDot, ArrowLeftRight, 
  Gauge, MapPin, AlertTriangle, Check, X, Info
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface TrackSection {
  id: number;
  name: string;
  length: number;
  max_speed: number;
  status: string;
  signalling_type: string;
  track_count: number;
  has_loop: boolean;
  has_crossover: boolean;
  block_length_km: number;
}

interface LoopLine {
  id?: number;
  track_section_id: number;
  loop_name: string;
  length_m: number;
  max_speed: number;
  direction: string;
  status: string;
}

interface Crossover {
  id: number;
  from_track_id: number;
  to_track_id: number;
  position_km: number;
  crossover_type: string;
  max_speed: number;
  status: string;
}

// Signal spacing constants (in meters for display)
const SIGNAL_SPACING = {
  automatic: 1200, // 1.2 km for AT sections
  'semi-automatic': 800,
  absolute: 0, // No intermediate signals in AB
  yard: 130, // 130m in station yards
};

// Signal component
const Signal = ({ 
  type, 
  position, 
  label,
  aspect = 'green'
}: { 
  type: 'home' | 'starter' | 'distant' | 'intermediate';
  position: 'left' | 'right' | 'center';
  label?: string;
  aspect?: 'red' | 'yellow' | 'green';
}) => {
  const aspectColors = {
    red: 'bg-red-500 shadow-red-500/50',
    yellow: 'bg-amber-500 shadow-amber-500/50',
    green: 'bg-green-500 shadow-green-500/50',
  };

  const positionClasses = {
    left: 'left-2',
    right: 'right-2',
    center: 'left-1/2 -translate-x-1/2',
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            'absolute top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 cursor-help',
            positionClasses[position]
          )}>
            <div className={cn(
              'w-2 h-5 rounded-sm shadow-lg',
              aspectColors[aspect]
            )} />
            {label && (
              <span className="text-[8px] font-mono text-muted-foreground whitespace-nowrap">
                {label}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium capitalize">{type} Signal</p>
          <p className="text-muted-foreground capitalize">Aspect: {aspect}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Cross line visualization
const CrossLine = ({ position }: { position: number }) => (
  <div 
    className="absolute top-0 h-full w-0.5 bg-gradient-to-b from-transparent via-blue-400/50 to-transparent"
    style={{ left: `${position}%` }}
  >
    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-2 h-2 rounded-full bg-blue-400/80 border border-blue-300" />
    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1 w-2 h-2 rounded-full bg-blue-400/80 border border-blue-300" />
  </div>
);

export const VisualTrackEditor = () => {
  const [sections, setSections] = useState<TrackSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TrackSection | null>(null);
  const [loops, setLoops] = useState<LoopLine[]>([]);
  const [crossovers, setCrossovers] = useState<Crossover[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSection, setEditedSection] = useState<Partial<TrackSection>>({});
  const [showLoopDialog, setShowLoopDialog] = useState(false);
  const [newLoop, setNewLoop] = useState<Partial<LoopLine>>({
    loop_name: "",
    length_m: 750,
    max_speed: 30,
    direction: "both",
    status: "available"
  });

  useEffect(() => {
    loadSections();
  }, []);

  useEffect(() => {
    if (selectedSection) {
      loadLoops(selectedSection.id);
      loadCrossovers(selectedSection.id);
    }
  }, [selectedSection]);

  const loadSections = async () => {
    const { data, error } = await supabase
      .from('track_sections')
      .select('*')
      .order('id');

    if (error) {
      console.error("Error loading sections:", error);
      return;
    }

    setSections(data as TrackSection[]);
    if (data.length > 0 && !selectedSection) {
      setSelectedSection(data[0] as TrackSection);
    }
  };

  const loadLoops = async (sectionId: number) => {
    const { data, error } = await supabase
      .from('loop_lines')
      .select('*')
      .eq('track_section_id', sectionId);

    if (!error && data) {
      setLoops(data as LoopLine[]);
    }
  };

  const loadCrossovers = async (sectionId: number) => {
    const { data, error } = await supabase
      .from('crossovers')
      .select('*')
      .eq('from_track_id', sectionId);

    if (!error && data) {
      setCrossovers(data as Crossover[]);
    }
  };

  // Calculate signal positions based on signalling type
  const signalPositions = useMemo(() => {
    if (!selectedSection) return [];
    
    const signalType = selectedSection.signalling_type || 'absolute';
    const sectionLengthM = selectedSection.length * 1000; // Convert km to m
    const spacing = SIGNAL_SPACING[signalType as keyof typeof SIGNAL_SPACING] || 0;
    
    if (signalType === 'absolute' || spacing === 0) {
      // AB: Only entry and exit signals
      return [
        { position: 5, label: 'S1', type: 'home' },
        { position: 95, label: 'S2', type: 'starter' },
      ];
    }
    
    // AT: Calculate intermediate signals
    const signals: Array<{ position: number; label: string; type: string }> = [
      { position: 5, label: 'S1', type: 'home' },
    ];
    
    const numIntermediateSignals = Math.floor(sectionLengthM / spacing) - 1;
    for (let i = 1; i <= Math.min(numIntermediateSignals, 5); i++) {
      const pos = 5 + (i * (90 / (numIntermediateSignals + 1)));
      signals.push({ position: pos, label: `S${i + 1}`, type: 'intermediate' });
    }
    
    signals.push({ position: 95, label: `S${signals.length + 1}`, type: 'starter' });
    
    return signals;
  }, [selectedSection]);

  const handleSectionSelect = (section: TrackSection) => {
    setSelectedSection(section);
    setIsEditing(false);
    setEditedSection({});
  };

  const handleEditStart = () => {
    if (selectedSection) {
      setEditedSection({ ...selectedSection });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!selectedSection || !editedSection) return;

    const { error } = await supabase
      .from('track_sections')
      .update({
        name: editedSection.name,
        max_speed: editedSection.max_speed,
        signalling_type: editedSection.signalling_type,
        track_count: editedSection.track_count,
        has_loop: editedSection.has_loop,
        has_crossover: editedSection.has_crossover,
        block_length_km: editedSection.block_length_km
      })
      .eq('id', selectedSection.id);

    if (error) {
      toast.error("Failed to save changes");
      return;
    }

    toast.success("Section updated successfully");
    setIsEditing(false);
    loadSections();
  };

  const handleAddLoop = async () => {
    if (!selectedSection || !newLoop.loop_name) return;

    const { error } = await supabase
      .from('loop_lines')
      .insert({
        track_section_id: selectedSection.id,
        loop_name: newLoop.loop_name,
        length_m: newLoop.length_m || 750,
        max_speed: newLoop.max_speed || 30,
        direction: newLoop.direction || 'both',
        status: newLoop.status || 'available'
      });

    if (error) {
      toast.error("Failed to add loop");
      return;
    }

    toast.success("Loop added successfully");
    setShowLoopDialog(false);
    setNewLoop({ loop_name: "", length_m: 750, max_speed: 30, direction: "both", status: "available" });
    loadLoops(selectedSection.id);
    
    // Update section has_loop flag
    await supabase
      .from('track_sections')
      .update({ has_loop: true })
      .eq('id', selectedSection.id);
    loadSections();
  };

  const handleDeleteLoop = async (loopId: number) => {
    const { error } = await supabase
      .from('loop_lines')
      .delete()
      .eq('id', loopId);

    if (error) {
      toast.error("Failed to delete loop");
      return;
    }

    toast.success("Loop deleted");
    if (selectedSection) {
      loadLoops(selectedSection.id);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "clear": return "bg-green-500";
      case "occupied": return "bg-amber-500";
      case "blocked": return "bg-red-500";
      default: return "bg-muted";
    }
  };

  const getSignallingBadge = (type: string) => {
    switch (type) {
      case "automatic":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">AT</Badge>;
      case "semi-automatic":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Semi-AT</Badge>;
      default:
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">AB</Badge>;
    }
  };

  const getSignalSpacingLabel = (type: string) => {
    switch (type) {
      case "automatic":
        return "1.2 km signal spacing";
      case "semi-automatic":
        return "800m signal spacing";
      default:
        return "Station-to-station block";
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Section List */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-primary" />
            Track Sections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionSelect(section)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selectedSection?.id === section.id
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{section.name}</span>
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(section.status)}`} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{section.length} km</span>
                    <span>•</span>
                    <span>{section.max_speed} km/h</span>
                    {section.has_loop && <Badge variant="outline" className="text-[10px] px-1">Loop</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Visual Track Display */}
      <Card className="bg-card/50 backdrop-blur border-border/50 lg:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Train className="h-5 w-5 text-primary" />
            Track Visualization
          </CardTitle>
          {selectedSection && (
            <CardDescription className="flex items-center gap-2">
              {getSignallingBadge(selectedSection.signalling_type || 'absolute')}
              <span className="text-xs">{getSignalSpacingLabel(selectedSection.signalling_type || 'absolute')}</span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {selectedSection && (
            <div className="space-y-6">
              {/* Enhanced Visual Track Diagram */}
              <div className="relative p-4 bg-muted/30 rounded-lg border border-border/50 min-h-[200px]">
                {/* Section Type Label */}
                <div className="absolute top-2 left-2 flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-[10px] font-mono",
                      selectedSection.signalling_type === 'automatic' 
                        ? "border-green-500/50 text-green-400 bg-green-500/10" 
                        : "border-amber-500/50 text-amber-400 bg-amber-500/10"
                    )}
                  >
                    {selectedSection.signalling_type === 'automatic' ? 'AT Section' : 'AB Section'}
                  </Badge>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-3 w-3 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[200px]">
                        {selectedSection.signalling_type === 'automatic' ? (
                          <p className="text-xs">Automatic Block: Signals change automatically based on track occupancy. Multiple trains can travel with safe spacing.</p>
                        ) : (
                          <p className="text-xs">Absolute Block: Only one train allowed in a block section at a time. Requires manual permission.</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Signal Spacing Indicator */}
                <div className="absolute top-2 right-2 text-[10px] text-muted-foreground font-mono">
                  {selectedSection.signalling_type === 'automatic' && (
                    <span className="flex items-center gap-1">
                      <span className="w-4 h-0.5 bg-primary/50" />
                      1.2 km
                    </span>
                  )}
                  {selectedSection.signalling_type === 'absolute' && (
                    <span className="flex items-center gap-1">
                      <span className="w-8 h-0.5 bg-amber-500/50" />
                      Full block
                    </span>
                  )}
                </div>

                {/* Main Track(s) with Signals */}
                <div className="mt-8 space-y-6">
                  {Array.from({ length: selectedSection.track_count || 1 }).map((_, trackIndex) => (
                    <div key={trackIndex} className="relative">
                      {/* Track Label */}
                      <span className="absolute -left-1 top-1/2 -translate-y-1/2 -translate-x-full text-xs font-mono text-muted-foreground bg-background px-1">
                        {trackIndex === 0 ? "Main" : "Add'l"}
                      </span>

                      {/* Track Line */}
                      <div className="h-4 bg-gradient-to-r from-muted via-foreground/20 to-muted rounded-full border border-border/50 relative overflow-visible">
                        {/* Signals along the track */}
                        {signalPositions.map((signal, idx) => (
                          <div 
                            key={idx}
                            className="absolute top-1/2 -translate-y-1/2 flex flex-col items-center"
                            style={{ left: `${signal.position}%` }}
                          >
                            <div className={cn(
                              "w-2 h-5 rounded-sm shadow-lg -translate-y-3",
                              signal.type === 'home' ? "bg-green-500 shadow-green-500/50" :
                              signal.type === 'starter' ? "bg-amber-500 shadow-amber-500/50" :
                              "bg-green-400 shadow-green-400/30"
                            )} />
                            <span className="text-[8px] font-mono text-muted-foreground mt-4">
                              {signal.label}
                            </span>
                          </div>
                        ))}

                        {/* Signal spacing markers for AT sections */}
                        {selectedSection.signalling_type === 'automatic' && signalPositions.length > 2 && (
                          <>
                            {signalPositions.slice(0, -1).map((signal, idx) => {
                              const nextSignal = signalPositions[idx + 1];
                              if (!nextSignal) return null;
                              const midPoint = (signal.position + nextSignal.position) / 2;
                              return (
                                <div
                                  key={`spacing-${idx}`}
                                  className="absolute top-full translate-y-6 text-[8px] text-primary/70 font-mono"
                                  style={{ left: `${midPoint}%`, transform: 'translateX(-50%) translateY(1.5rem)' }}
                                >
                                  1.2km
                                </div>
                              );
                            })}
                          </>
                        )}
                      </div>

                      {/* Direction arrow */}
                      <div className="absolute right-0 top-1/2 translate-x-2 -translate-y-1/2">
                        <span className="text-xs text-muted-foreground">→</span>
                      </div>
                    </div>
                  ))}

                  {/* Cross Lines connecting tracks */}
                  {(selectedSection.track_count || 1) > 1 && selectedSection.has_crossover && (
                    <div className="relative h-0 -mt-4">
                      <CrossLine position={30} />
                      <CrossLine position={70} />
                      <div className="absolute left-[30%] -translate-x-1/2 top-2 text-[8px] text-blue-400 font-mono">
                        X1
                      </div>
                      <div className="absolute left-[70%] -translate-x-1/2 top-2 text-[8px] text-blue-400 font-mono">
                        X2
                      </div>
                    </div>
                  )}
                </div>

                {/* Loop Lines */}
                {loops.length > 0 && (
                  <div className="mt-8 pt-4 border-t border-dashed border-border/50">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] text-muted-foreground font-medium">LOOP LINES</span>
                      <Badge variant="outline" className="text-[8px] h-4">130m yard spacing</Badge>
                    </div>
                    {loops.map((loop, i) => (
                      <div key={loop.id || i} className="relative mb-4">
                        {/* Loop track */}
                        <div className="h-3 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent rounded-full border border-amber-500/30 mx-12 relative">
                          {/* Loop entry/exit points */}
                          <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-500/60 border border-amber-400" />
                          <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-500/60 border border-amber-400" />
                          
                          {/* Yard signals */}
                          <div className="absolute left-[15%] top-1/2 -translate-y-1/2">
                            <div className="w-1.5 h-3 bg-amber-400 rounded-sm -translate-y-2" />
                          </div>
                          <div className="absolute left-[85%] top-1/2 -translate-y-1/2">
                            <div className="w-1.5 h-3 bg-amber-400 rounded-sm -translate-y-2" />
                          </div>
                        </div>
                        
                        {/* Loop label */}
                        <div className="flex items-center justify-center mt-1 gap-2">
                          <span className="text-[10px] text-amber-400 font-medium">{loop.loop_name}</span>
                          <span className="text-[8px] text-muted-foreground">({loop.length_m}m • {loop.max_speed}km/h)</span>
                        </div>

                        {/* Cross line to main */}
                        <div className="absolute left-10 top-0 w-0.5 h-3 bg-gradient-to-b from-blue-400/50 to-transparent -translate-y-full" />
                        <div className="absolute right-10 top-0 w-0.5 h-3 bg-gradient-to-b from-blue-400/50 to-transparent -translate-y-full" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Crossover indicator for single track */}
                {selectedSection.has_crossover && (selectedSection.track_count || 1) === 1 && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mt-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <ArrowLeftRight className="h-5 w-5 text-blue-400" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Crossover point for track switching</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {/* Legend */}
                <div className="mt-6 pt-3 border-t border-border/30 flex flex-wrap gap-3 text-[9px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-3 bg-green-500 rounded-sm" />
                    <span>Home Signal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-3 bg-amber-500 rounded-sm" />
                    <span>Starter Signal</span>
                  </div>
                  {selectedSection.signalling_type === 'automatic' && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-3 bg-green-400 rounded-sm" />
                      <span>Intermediate (AT)</span>
                    </div>
                  )}
                  {selectedSection.has_crossover && (
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full bg-blue-400" />
                      <span>Cross Line</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Length</div>
                  <div className="font-mono text-lg">{selectedSection.length} km</div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Max Speed</div>
                  <div className="font-mono text-lg">{selectedSection.max_speed} km/h</div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Block Length</div>
                  <div className="font-mono text-lg">{selectedSection.block_length_km || 10} km</div>
                </div>
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="text-xs text-muted-foreground">Signal Spacing</div>
                  <div className="font-mono text-lg">
                    {selectedSection.signalling_type === 'automatic' ? '1.2 km' : 
                     selectedSection.signalling_type === 'semi-automatic' ? '800 m' : 'N/A'}
                  </div>
                </div>
              </div>

              {/* Loop List with delete */}
              {loops.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Loop Lines ({loops.length})</Label>
                  </div>
                  {loops.map((loop) => (
                    <div key={loop.id} className="flex items-center justify-between p-2 bg-muted/20 rounded border border-border/30">
                      <div>
                        <span className="text-sm font-medium">{loop.loop_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          {loop.length_m}m • {loop.max_speed} km/h
                        </span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-red-400"
                        onClick={() => loop.id && handleDeleteLoop(loop.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Panel */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg">
            <span className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" />
              Edit Section
            </span>
            {selectedSection && !isEditing && (
              <Button size="sm" variant="outline" onClick={handleEditStart}>
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedSection && (
            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>Section Name</Label>
                    <Input
                      value={editedSection.name || ""}
                      onChange={(e) => setEditedSection({ ...editedSection, name: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Max Speed (km/h)</Label>
                    <Input
                      type="number"
                      value={editedSection.max_speed || 0}
                      onChange={(e) => setEditedSection({ ...editedSection, max_speed: parseInt(e.target.value) })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Signalling Type</Label>
                    <Select
                      value={editedSection.signalling_type || "absolute"}
                      onValueChange={(v) => setEditedSection({ ...editedSection, signalling_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="absolute">Absolute Block (AB)</SelectItem>
                        <SelectItem value="semi-automatic">Semi-Automatic</SelectItem>
                        <SelectItem value="automatic">Automatic Block (AT)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Track Count</Label>
                    <Select
                      value={String(editedSection.track_count || 1)}
                      onValueChange={(v) => setEditedSection({ ...editedSection, track_count: parseInt(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Single Line</SelectItem>
                        <SelectItem value="2">Double Line</SelectItem>
                        <SelectItem value="3">Triple Line</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Block Length (km)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={editedSection.block_length_km || 10}
                      onChange={(e) => setEditedSection({ ...editedSection, block_length_km: parseFloat(e.target.value) })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Has Crossover</Label>
                    <Switch
                      checked={editedSection.has_crossover || false}
                      onCheckedChange={(v) => setEditedSection({ ...editedSection, has_crossover: v })}
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button onClick={handleSave} className="flex-1">
                      <Save className="h-4 w-4 mr-1" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Name</span>
                      <span className="font-medium">{selectedSection.name}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Length</span>
                      <span className="font-mono">{selectedSection.length} km</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Max Speed</span>
                      <span className="font-mono">{selectedSection.max_speed} km/h</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Signalling</span>
                      {getSignallingBadge(selectedSection.signalling_type || 'absolute')}
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Tracks</span>
                      <span>{selectedSection.track_count || 1} line(s)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Block Length</span>
                      <span className="font-mono">{selectedSection.block_length_km || 10} km</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/30">
                      <span className="text-muted-foreground">Crossover</span>
                      {selectedSection.has_crossover ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Add Loop Button */}
                  <Dialog open={showLoopDialog} onOpenChange={setShowLoopDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="w-full mt-4">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Loop Line
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add Loop Line</DialogTitle>
                        <DialogDescription>
                          Add a new loop line to {selectedSection.name}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label>Loop Name</Label>
                          <Input
                            value={newLoop.loop_name || ""}
                            onChange={(e) => setNewLoop({ ...newLoop, loop_name: e.target.value })}
                            placeholder="e.g., Loop 1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Length (m)</Label>
                            <Input
                              type="number"
                              value={newLoop.length_m || 750}
                              onChange={(e) => setNewLoop({ ...newLoop, length_m: parseInt(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Max Speed (km/h)</Label>
                            <Input
                              type="number"
                              value={newLoop.max_speed || 30}
                              onChange={(e) => setNewLoop({ ...newLoop, max_speed: parseInt(e.target.value) })}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Direction</Label>
                          <Select
                            value={newLoop.direction || "both"}
                            onValueChange={(v) => setNewLoop({ ...newLoop, direction: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="up">UP Direction</SelectItem>
                              <SelectItem value="down">DOWN Direction</SelectItem>
                              <SelectItem value="both">Both Directions</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button onClick={handleAddLoop} className="w-full">
                          Add Loop
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
