import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Map, ZoomIn, ZoomOut, Maximize2, Train, CircleDot,
  ArrowRight, Info, Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Mock data for demonstration (used when DB is empty)
const mockStations = [
  { id: 1, code: "JBP", name: "Jabalpur", type: "junction", platforms: 6, latitude: 23.1815, longitude: 79.9864 },
  { id: 2, code: "MNI", name: "Madan Mahal", type: "station", platforms: 2, latitude: 23.1600, longitude: 79.9500 },
  { id: 3, code: "SDN", name: "Sohagpur", type: "station", platforms: 2, latitude: 22.9800, longitude: 78.9200 },
  { id: 4, code: "PPR", name: "Pipariya", type: "junction", platforms: 3, latitude: 22.7600, longitude: 78.4300 },
  { id: 5, code: "GDW", name: "Gadarwara", type: "station", platforms: 2, latitude: 22.9200, longitude: 78.7800 },
  { id: 6, code: "NMR", name: "Narsinghpur", type: "station", platforms: 3, latitude: 22.9500, longitude: 79.2000 },
  { id: 7, code: "KY", name: "Kareli", type: "station", platforms: 2, latitude: 22.9100, longitude: 79.0600 },
  { id: 8, code: "ITR", name: "Itarsi", type: "junction", platforms: 7, latitude: 22.6150, longitude: 77.7610 },
];

const mockBlockSections = [
  { id: 1, section_code: "JBP-MNI", from_station_id: 1, to_station_id: 2, distance_km: 8, signalling_type: "automatic", max_speed: 110 },
  { id: 2, section_code: "MNI-SDN", from_station_id: 2, to_station_id: 3, distance_km: 25, signalling_type: "automatic", max_speed: 100 },
  { id: 3, section_code: "SDN-NMR", from_station_id: 3, to_station_id: 6, distance_km: 32, signalling_type: "absolute", max_speed: 90 },
  { id: 4, section_code: "NMR-KY", from_station_id: 6, to_station_id: 7, distance_km: 18, signalling_type: "automatic", max_speed: 100 },
  { id: 5, section_code: "KY-GDW", from_station_id: 7, to_station_id: 5, distance_km: 22, signalling_type: "absolute", max_speed: 85 },
  { id: 6, section_code: "GDW-PPR", from_station_id: 5, to_station_id: 4, distance_km: 28, signalling_type: "automatic", max_speed: 100 },
  { id: 7, section_code: "PPR-ITR", from_station_id: 4, to_station_id: 8, distance_km: 45, signalling_type: "automatic", max_speed: 110 },
];

interface Station {
  id: number;
  code: string;
  name: string;
  type: string;
  platforms: number;
}

interface BlockSection {
  id: number;
  section_code: string;
  from_station_id: number;
  to_station_id: number;
  distance_km: number;
  signalling_type: string;
  max_speed: number;
}

interface Signal {
  id: number;
  signal_code: string;
  signal_type: string;
  station_id: number | null;
  block_section_id: number | null;
  position_km: number;
  aspect: string;
  direction: string;
}

export const SchematicView = () => {
  const [stations, setStations] = useState<Station[]>([]);
  const [blockSections, setBlockSections] = useState<BlockSection[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [zoom, setZoom] = useState(100);
  const [showSignals, setShowSignals] = useState(true);
  const [showDistances, setShowDistances] = useState(true);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Try loading from database first
      const [stationsRes, sectionsRes, signalsRes] = await Promise.all([
        supabase.from('stations').select('*').order('id'),
        supabase.from('block_sections').select('*').order('id'),
        supabase.from('signals').select('*').order('position_km'),
      ]);

      // Use real data if available, otherwise use mock data
      if (stationsRes.data && stationsRes.data.length > 0) {
        setStations(stationsRes.data as Station[]);
      } else {
        setStations(mockStations);
      }

      if (sectionsRes.data && sectionsRes.data.length > 0) {
        setBlockSections(sectionsRes.data as BlockSection[]);
      } else {
        setBlockSections(mockBlockSections);
      }

      if (signalsRes.data) {
        setSignals(signalsRes.data as Signal[]);
      }
    } catch (error) {
      console.error("Error loading schematic data:", error);
      // Fall back to mock data
      setStations(mockStations);
      setBlockSections(mockBlockSections);
    } finally {
      setIsLoading(false);
    }
  };

  // Build ordered station list based on block sections
  const orderedStations = (() => {
    if (blockSections.length === 0) return stations;
    
    const visited = new Set<number>();
    const ordered: Station[] = [];
    
    // Find first station (one that only appears as from_station)
    const toStations = new Set(blockSections.map(b => b.to_station_id));
    let currentId = blockSections.find(b => !toStations.has(b.from_station_id))?.from_station_id 
      || blockSections[0]?.from_station_id;
    
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      const station = stations.find(s => s.id === currentId);
      if (station) ordered.push(station);
      
      const nextSection = blockSections.find(b => b.from_station_id === currentId);
      currentId = nextSection?.to_station_id;
    }
    
    return ordered.length > 0 ? ordered : stations;
  })();

  // Get section between two consecutive stations
  const getSectionBetween = (fromId: number, toId: number) => {
    return blockSections.find(
      b => (b.from_station_id === fromId && b.to_station_id === toId) ||
           (b.from_station_id === toId && b.to_station_id === fromId)
    );
  };

  // Calculate total route distance
  const totalDistance = blockSections.reduce((sum, s) => sum + s.distance_km, 0);

  const getSignallingColor = (type: string) => {
    switch (type) {
      case "automatic": return "text-green-400 border-green-500/50 bg-green-500/10";
      case "semi-automatic": return "text-blue-400 border-blue-500/50 bg-blue-500/10";
      default: return "text-amber-400 border-amber-500/50 bg-amber-500/10";
    }
  };

  const getStationTypeIcon = (type: string) => {
    switch (type) {
      case "junction": return "◆";
      case "terminal": return "◼";
      default: return "●";
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading schematic...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Map className="h-5 w-5 text-primary" />
              Section Schematic View
            </CardTitle>
            <CardDescription className="mt-1">
              {orderedStations.length} stations • {totalDistance.toFixed(1)} km total
            </CardDescription>
          </div>
          
          {/* Controls */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Signals</Label>
              <Switch checked={showSignals} onCheckedChange={setShowSignals} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Distances</Label>
              <Switch checked={showDistances} onCheckedChange={setShowDistances} />
            </div>
            <div className="flex items-center gap-2 border-l border-border pl-4">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(50, z - 25))}>
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs font-mono w-10 text-center">{zoom}%</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(200, z + 25))}>
                <ZoomIn className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 p-3 bg-muted/30 rounded-lg border border-border/50">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-lg">◆</span>
            <span className="text-muted-foreground">Junction</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-lg">●</span>
            <span className="text-muted-foreground">Station</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-8 h-1 bg-gradient-to-r from-green-500 to-green-400 rounded" />
            <span className="text-muted-foreground">AT Section</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-8 h-1 bg-gradient-to-r from-amber-500 to-amber-400 rounded" />
            <span className="text-muted-foreground">AB Section</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-4 bg-green-500 rounded-sm" />
            <span className="text-muted-foreground">Home Signal</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-2 h-4 bg-amber-500 rounded-sm" />
            <span className="text-muted-foreground">Starter Signal</span>
          </div>
        </div>

        {/* Schematic View */}
        <ScrollArea className="w-full" ref={scrollRef}>
          <div 
            className="relative py-16 px-8"
            style={{ 
              minWidth: `${Math.max(800, orderedStations.length * 180 * (zoom / 100))}px`,
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'left center'
            }}
          >
            {/* Main Track Line */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-0.5">
              {orderedStations.slice(0, -1).map((station, idx) => {
                const nextStation = orderedStations[idx + 1];
                const section = getSectionBetween(station.id, nextStation?.id);
                const sectionWidth = 100 / (orderedStations.length - 1);
                const isAutomatic = section?.signalling_type === 'automatic';
                
                return (
                  <div
                    key={`track-${idx}`}
                    className={cn(
                      "absolute h-1 top-0",
                      isAutomatic ? "bg-gradient-to-r from-green-500/80 to-green-400/80" : "bg-gradient-to-r from-amber-500/80 to-amber-400/80"
                    )}
                    style={{
                      left: `${idx * sectionWidth}%`,
                      width: `${sectionWidth}%`,
                    }}
                  />
                );
              })}
            </div>

            {/* Block Section Labels and Signals */}
            {orderedStations.slice(0, -1).map((station, idx) => {
              const nextStation = orderedStations[idx + 1];
              const section = getSectionBetween(station.id, nextStation?.id);
              const sectionWidth = 100 / (orderedStations.length - 1);
              const midPoint = idx * sectionWidth + sectionWidth / 2;
              const isAutomatic = section?.signalling_type === 'automatic';
              
              // Calculate intermediate signal positions for AT sections
              const signalCount = isAutomatic ? Math.max(1, Math.floor((section?.distance_km || 10) / 1.2) - 1) : 0;
              
              return (
                <div key={`section-${idx}`}>
                  {/* Section Info */}
                  <div
                    className="absolute -translate-x-1/2"
                    style={{ left: `${midPoint}%`, top: '75%' }}
                  >
                    <div className="flex flex-col items-center">
                      {showDistances && section && (
                        <span className="text-[10px] font-mono text-muted-foreground mb-1">
                          {section.distance_km} km
                        </span>
                      )}
                      <Badge 
                        variant="outline" 
                        className={cn("text-[8px] px-1.5 py-0", getSignallingColor(section?.signalling_type || 'absolute'))}
                      >
                        {isAutomatic ? 'AT' : 'AB'}
                      </Badge>
                      {showDistances && section && (
                        <span className="text-[8px] text-muted-foreground mt-0.5">
                          {section.max_speed} km/h
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Intermediate Signals for AT sections */}
                  {showSignals && isAutomatic && signalCount > 0 && (
                    <>
                      {Array.from({ length: Math.min(signalCount, 4) }).map((_, sigIdx) => {
                        const sigPosition = idx * sectionWidth + ((sigIdx + 1) * sectionWidth / (signalCount + 1));
                        return (
                          <TooltipProvider key={`sig-${idx}-${sigIdx}`}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute -translate-x-1/2 cursor-help"
                                  style={{ left: `${sigPosition}%`, top: 'calc(50% - 16px)' }}
                                >
                                  <div className="w-1.5 h-3 bg-green-400 rounded-sm shadow-lg shadow-green-400/30" />
                                  <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[7px] font-mono text-muted-foreground">
                                    S{sigIdx + 1}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Intermediate Signal (AT)</p>
                                <p className="text-xs text-muted-foreground">1.2km spacing</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}

            {/* Stations */}
            {orderedStations.map((station, idx) => {
              const positionPercent = orderedStations.length > 1 
                ? (idx / (orderedStations.length - 1)) * 100 
                : 50;
              const isJunction = station.type === 'junction';
              const isSelected = selectedStation?.id === station.id;
              
              return (
                <TooltipProvider key={station.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "absolute -translate-x-1/2 cursor-pointer transition-all duration-200 group",
                          isSelected && "scale-110"
                        )}
                        style={{ left: `${positionPercent}%`, top: '50%' }}
                        onClick={() => setSelectedStation(isSelected ? null : station)}
                      >
                        {/* Station Marker */}
                        <div className={cn(
                          "relative flex items-center justify-center -translate-y-1/2",
                          isJunction ? "w-6 h-6" : "w-4 h-4"
                        )}>
                          <div className={cn(
                            "absolute inset-0 rounded-full transition-all",
                            isJunction 
                              ? "bg-primary border-2 border-primary-foreground shadow-lg shadow-primary/50" 
                              : "bg-foreground border-2 border-background",
                            isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                          )}>
                            {isJunction && (
                              <div className="absolute inset-1 bg-primary-foreground/20 rounded-full" />
                            )}
                          </div>
                        </div>

                        {/* Station Label */}
                        <div className="absolute left-1/2 -translate-x-1/2 -top-10 flex flex-col items-center">
                          <span className={cn(
                            "text-[10px] font-bold whitespace-nowrap px-1 py-0.5 rounded",
                            isJunction ? "text-primary bg-primary/10" : "text-foreground"
                          )}>
                            {station.code}
                          </span>
                          <span className="text-[8px] text-muted-foreground whitespace-nowrap max-w-20 truncate">
                            {station.name}
                          </span>
                        </div>

                        {/* Platform Count */}
                        <div className="absolute left-1/2 -translate-x-1/2 top-4">
                          <span className="text-[8px] text-muted-foreground">
                            {station.platforms} pf
                          </span>
                        </div>

                        {/* Signals at Station */}
                        {showSignals && (
                          <>
                            {/* Home Signal (entry) */}
                            <div className="absolute -left-3 top-1/2 -translate-y-1/2">
                              <div className="w-1.5 h-3 bg-green-500 rounded-sm shadow-sm" />
                            </div>
                            {/* Starter Signal (exit) */}
                            <div className="absolute -right-3 top-1/2 -translate-y-1/2">
                              <div className="w-1.5 h-3 bg-amber-500 rounded-sm shadow-sm" />
                            </div>
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <div className="space-y-1">
                        <p className="font-medium">{station.name}</p>
                        <p className="text-xs text-muted-foreground">Code: {station.code}</p>
                        <p className="text-xs text-muted-foreground capitalize">Type: {station.type}</p>
                        <p className="text-xs text-muted-foreground">Platforms: {station.platforms}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}

            {/* Direction Arrow */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 text-muted-foreground">
              <ArrowRight className="h-4 w-4" />
              <span className="text-[10px]">UP</span>
            </div>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Selected Station Details */}
        {selectedStation && (
          <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  selectedStation.type === 'junction' ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
                )}>
                  <span className="text-lg">{getStationTypeIcon(selectedStation.type)}</span>
                </div>
                <div>
                  <h4 className="font-medium">{selectedStation.name}</h4>
                  <p className="text-sm text-muted-foreground">{selectedStation.code} • {selectedStation.platforms} platforms</p>
                </div>
              </div>
              <Badge variant="outline" className="capitalize">{selectedStation.type}</Badge>
            </div>
            
            {/* Connected Sections */}
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground mb-2">Connected Block Sections:</p>
              <div className="flex flex-wrap gap-2">
                {blockSections
                  .filter(s => s.from_station_id === selectedStation.id || s.to_station_id === selectedStation.id)
                  .map(section => (
                    <Badge 
                      key={section.id}
                      variant="outline"
                      className={cn("text-xs", getSignallingColor(section.signalling_type))}
                    >
                      {section.section_code} ({section.distance_km}km)
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};