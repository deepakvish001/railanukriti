import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Pencil, Plus, Save, Trash2, Train, CircleDot, ArrowLeftRight, 
  Gauge, MapPin, AlertTriangle, Check, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

export const VisualTrackEditor = () => {
  const [sections, setSections] = useState<TrackSection[]>([]);
  const [selectedSection, setSelectedSection] = useState<TrackSection | null>(null);
  const [loops, setLoops] = useState<LoopLine[]>([]);
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
        return <Badge className="bg-green-500/20 text-green-400">AT</Badge>;
      case "semi-automatic":
        return <Badge className="bg-blue-500/20 text-blue-400">Semi</Badge>;
      default:
        return <Badge className="bg-amber-500/20 text-amber-400">AB</Badge>;
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
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Train className="h-5 w-5 text-primary" />
            Track Visualization
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selectedSection && (
            <div className="space-y-6">
              {/* Visual Track Diagram */}
              <div className="relative p-6 bg-muted/30 rounded-lg border border-border/50">
                {/* Main Track(s) */}
                <div className="space-y-3">
                  {Array.from({ length: selectedSection.track_count || 1 }).map((_, i) => (
                    <div key={i} className="relative">
                      <div className="h-3 bg-gradient-to-r from-muted via-primary/30 to-muted rounded-full border border-border/50" />
                      {/* Signals */}
                      <div className="absolute left-4 top-1/2 -translate-y-1/2">
                        <div className="w-2 h-4 bg-green-500 rounded-sm" title="Home Signal" />
                      </div>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="w-2 h-4 bg-amber-500 rounded-sm" title="Starter Signal" />
                      </div>
                      {/* Track label */}
                      <span className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full text-xs text-muted-foreground">
                        {i === 0 ? "UP" : "DN"}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Loop Lines */}
                {loops.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dashed border-border/50">
                    <p className="text-xs text-muted-foreground mb-2">Loop Lines</p>
                    {loops.map((loop, i) => (
                      <div key={loop.id || i} className="relative mb-2">
                        <div className="h-2 bg-gradient-to-r from-transparent via-amber-500/50 to-transparent rounded-full border border-amber-500/30 mx-8" />
                        <span className="absolute left-1/2 -translate-x-1/2 -bottom-4 text-[10px] text-muted-foreground">
                          {loop.loop_name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Crossover */}
                {selectedSection.has_crossover && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <ArrowLeftRight className="h-6 w-6 text-blue-400" />
                  </div>
                )}
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
                  <div className="text-xs text-muted-foreground">Signalling</div>
                  <div className="mt-1">{getSignallingBadge(selectedSection.signalling_type || 'absolute')}</div>
                </div>
              </div>

              {/* Loop List */}
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
