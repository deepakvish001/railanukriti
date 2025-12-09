import { useMemo, useState, useRef, useCallback, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ZoomIn, ZoomOut, RotateCcw, Download, Loader2, Train, MapPin, Clock, ArrowRight, Package, Users, X } from 'lucide-react';
import { useRouteStations } from '@/hooks/useFreightData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO, addHours, startOfDay, addSeconds, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';

interface SelectedTrainInfo {
  path: TrainPath;
  freightDetails?: {
    source_station: string;
    destination_station: string;
    commodity: string | null;
    load_type: string | null;
    total_km: number | null;
  };
  passengerDetails?: {
    train_name: string | null;
    source_station: string;
    destination_station: string;
    train_type: string | null;
  };
}

interface FreightMovement {
  load_id: string;
  station_code: string;
  arrival_time: string;
  departure_time: string | null;
  speed: number | null;
  is_stoppage: boolean;
}

interface PassengerSchedule {
  train_number: string;
  train_id: string;
  station_code: string;
  arrival_seconds: number | null;
  departure_seconds: number | null;
  route_seq_no: number;
  direction: string | null;
  is_halt: boolean | null;
}

interface Disruption {
  id: string;
  station_code: string | null;
  block_section_code: string | null;
  disruption_type: string;
  severity: string;
  start_time: string;
  end_time: string | null;
  is_active: boolean;
  affected_direction: string | null;
  description: string | null;
}

interface TrainPath {
  id: string;
  type: 'freight' | 'passenger';
  direction: 'UP' | 'DN';
  color: string;
  isDashed: boolean;
  isAffected: boolean;
  movements: {
    station_code: string;
    distance_km: number;
    seq_no: number;
    arrival: Date;
    departure: Date | null;
    is_halt: boolean;
  }[];
}

// Professional color scheme matching reference image
const COLORS = {
  // Passenger trains
  passengerDN: '#DC2626',    // Red - Downline Passenger (solid)
  passengerUP: '#2563EB',    // Blue - Upline Passenger (solid)
  // Freight trains  
  freightDN: '#374151',      // Dark gray - Downline Freight (dashed)
  freightUP: '#0891B2',      // Cyan/Teal - Upline Freight (dashed)
  // Other
  waiting: '#9CA3AF',        // Gray - Waiting/dwell
  disruption: '#FCD34D',     // Yellow - Disruption window
  prioritization: '#10B981', // Green - Prioritization decision
  // Grid
  gridLine: '#E5E7EB',       // Light gray grid
  gridLineMajor: '#D1D5DB',  // Slightly darker for major lines
  text: '#374151',           // Dark gray text
  textMuted: '#6B7280',      // Muted text
};

export function DistanceTimeChart() {
  const { stations, loading: stationsLoading } = useRouteStations();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [hoveredTrain, setHoveredTrain] = useState<string | null>(null);
  const [selectedTrain, setSelectedTrain] = useState<SelectedTrainInfo | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const svgRef = useRef<SVGSVGElement>(null);
  const queryClient = useQueryClient();

  // Update current time every second for live marker
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch ALL freight movements without limit
  const { data: freightMovements, isLoading: freightLoading, refetch: refetchFreight } = useQuery({
    queryKey: ['freight-movements-chart-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freight_movements')
        .select('load_id, station_code, arrival_time, departure_time, speed, is_stoppage')
        .not('arrival_time', 'is', null)
        .order('load_id')
        .order('arrival_time', { ascending: true });
      if (error) throw error;
      return data as FreightMovement[];
    },
  });

  // Fetch ALL passenger schedules
  const { data: passengerSchedule, isLoading: passengerLoading, refetch: refetchPassenger } = useQuery({
    queryKey: ['passenger-schedule-chart-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_schedule')
        .select('train_number, train_id, station_code, arrival_seconds, departure_seconds, route_seq_no, direction, is_halt')
        .order('train_id')
        .order('route_seq_no', { ascending: true });
      if (error) throw error;
      return data as PassengerSchedule[];
    },
  });

  // Fetch active disruptions
  const { data: disruptions, refetch: refetchDisruptions } = useQuery({
    queryKey: ['disruptions-chart'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('disruptions')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data as Disruption[];
    },
  });

  // Real-time subscription for disruptions
  useEffect(() => {
    const channel = supabase
      .channel('disruptions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'disruptions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['disruptions-chart'] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Process stations with proper distance
  const processedStations = useMemo(() => {
    return stations.map(s => ({
      ...s,
      cumulative_distance_km: s.cumulative_distance_km ?? 0,
    })).sort((a, b) => a.seq_no - b.seq_no);
  }, [stations]);

  // Station maps
  const stationDistanceMap = useMemo(() => {
    const map = new Map<string, number>();
    processedStations.forEach(s => map.set(s.station_code, s.cumulative_distance_km));
    return map;
  }, [processedStations]);

  const stationSeqMap = useMemo(() => {
    const map = new Map<string, number>();
    processedStations.forEach(s => map.set(s.station_code, s.seq_no));
    return map;
  }, [processedStations]);

  // Station name map
  const stationNameMap = useMemo(() => {
    const map = new Map<string, string>();
    processedStations.forEach(s => map.set(s.station_code, s.station_name || s.station_code));
    return map;
  }, [processedStations]);

  // Max distance for Y-axis
  const maxDistance = useMemo(() => {
    if (processedStations.length === 0) return 180;
    return Math.max(...processedStations.map(s => s.cumulative_distance_km), 180);
  }, [processedStations]);

  // Calculate actual data time range from freight movements
  const dataTimeRange = useMemo(() => {
    if (!freightMovements || freightMovements.length === 0) {
      return { start: startOfDay(new Date()), end: addHours(startOfDay(new Date()), 24) };
    }
    
    let minTime = Infinity;
    let maxTime = -Infinity;
    
    freightMovements.forEach(m => {
      const arrTime = parseISO(m.arrival_time).getTime();
      if (arrTime < minTime) minTime = arrTime;
      if (arrTime > maxTime) maxTime = arrTime;
      if (m.departure_time) {
        const depTime = parseISO(m.departure_time).getTime();
        if (depTime > maxTime) maxTime = depTime;
      }
    });
    
    // Add some padding
    const start = new Date(minTime - 30 * 60 * 1000); // 30 min before
    const end = new Date(maxTime + 30 * 60 * 1000); // 30 min after
    
    return { start, end };
  }, [freightMovements]);
  
  const baseDate = useMemo(() => startOfDay(dataTimeRange.start), [dataTimeRange]);

  // Process freight movements into paths
  const freightPaths = useMemo((): TrainPath[] => {
    if (!freightMovements || freightMovements.length === 0) return [];

    const pathMap = new Map<string, TrainPath>();
    
    freightMovements.forEach((m) => {
      const distance = stationDistanceMap.get(m.station_code);
      const seq = stationSeqMap.get(m.station_code);
      if (distance === undefined || seq === undefined) return;

      if (!pathMap.has(m.load_id)) {
        pathMap.set(m.load_id, {
          id: m.load_id,
          type: 'freight',
          direction: 'DN',
          color: COLORS.freightDN,
          isDashed: true,
          isAffected: false,
          movements: [],
        });
      }

      pathMap.get(m.load_id)!.movements.push({
        station_code: m.station_code,
        distance_km: distance,
        seq_no: seq,
        arrival: parseISO(m.arrival_time),
        departure: m.departure_time ? parseISO(m.departure_time) : null,
        is_halt: m.is_stoppage,
      });
    });

    pathMap.forEach(path => {
      path.movements.sort((a, b) => a.arrival.getTime() - b.arrival.getTime());
      
      if (path.movements.length >= 2) {
        const first = path.movements[0];
        const last = path.movements[path.movements.length - 1];
        // Determine direction based on distance change
        if (first.distance_km < last.distance_km) {
          path.direction = 'DN';
          path.color = COLORS.freightDN;
        } else {
          path.direction = 'UP';
          path.color = COLORS.freightUP;
        }
      }
    });

    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [freightMovements, stationDistanceMap, stationSeqMap]);

  // Process passenger schedules into paths
  const passengerPaths = useMemo((): TrainPath[] => {
    if (!passengerSchedule || passengerSchedule.length === 0) return [];

    const pathMap = new Map<string, TrainPath>();
    
    passengerSchedule.forEach((s) => {
      const distance = stationDistanceMap.get(s.station_code);
      const seq = stationSeqMap.get(s.station_code);
      if (distance === undefined || seq === undefined) return;

      const key = s.train_id;
      if (!pathMap.has(key)) {
        const isDown = s.direction === 'DN';
        pathMap.set(key, {
          id: s.train_number,
          type: 'passenger',
          direction: isDown ? 'DN' : 'UP',
          color: isDown ? COLORS.passengerDN : COLORS.passengerUP,
          isDashed: false,
          isAffected: false,
          movements: [],
        });
      }

      const arrivalDate = s.arrival_seconds !== null ? addSeconds(baseDate, s.arrival_seconds) : null;
      const departureDate = s.departure_seconds !== null ? addSeconds(baseDate, s.departure_seconds) : null;

      if (arrivalDate) {
        pathMap.get(key)!.movements.push({
          station_code: s.station_code,
          distance_km: distance,
          seq_no: seq,
          arrival: arrivalDate,
          departure: departureDate,
          is_halt: s.is_halt || false,
        });
      }
    });

    pathMap.forEach(path => {
      path.movements.sort((a, b) => a.seq_no - b.seq_no);
    });

    return Array.from(pathMap.values()).filter(p => p.movements.length >= 2);
  }, [passengerSchedule, stationDistanceMap, stationSeqMap, baseDate]);

  // Combine all paths
  const allPaths = useMemo(() => {
    return [...passengerPaths, ...freightPaths];
  }, [freightPaths, passengerPaths]);

  // Time range - based on actual data with at least 24 hours
  const timeRange = useMemo(() => {
    const start = dataTimeRange.start;
    const end = dataTimeRange.end;
    const diffMs = end.getTime() - start.getTime();
    const hours = Math.max(24, Math.ceil(diffMs / (1000 * 60 * 60)));
    return { start, end: addHours(start, hours), hours };
  }, [dataTimeRange]);

  // Chart dimensions
  const MARGIN = { top: 60, right: 80, bottom: 70, left: 150 };
  const BASE_WIDTH = 1600;
  const BASE_HEIGHT = 800;
  const chartWidth = BASE_WIDTH * zoomLevel;
  const chartHeight = BASE_HEIGHT;
  const innerWidth = chartWidth - MARGIN.left - MARGIN.right;
  const innerHeight = chartHeight - MARGIN.top - MARGIN.bottom;

  const xScale = useCallback((time: Date) => {
    const elapsed = time.getTime() - timeRange.start.getTime();
    const totalRange = timeRange.end.getTime() - timeRange.start.getTime();
    return MARGIN.left + (elapsed / totalRange) * innerWidth;
  }, [timeRange, innerWidth]);

  const yScale = useCallback((distance: number) => {
    // Inverted - 0 at bottom, max at top
    return MARGIN.top + ((maxDistance - distance) / maxDistance) * innerHeight;
  }, [maxDistance, innerHeight]);

  // Generate SVG path
  const generatePath = useCallback((path: TrainPath) => {
    if (path.movements.length === 0) return '';
    
    let d = '';
    path.movements.forEach((m, i) => {
      const x1 = xScale(m.arrival);
      const y = yScale(m.distance_km);
      
      if (i === 0) {
        d += `M ${x1} ${y}`;
      } else {
        d += ` L ${x1} ${y}`;
      }
      
      // Add horizontal line for halt (waiting/dwell)
      if (m.departure && m.departure.getTime() > m.arrival.getTime()) {
        const x2 = xScale(m.departure);
        d += ` L ${x2} ${y}`;
      }
    });

    return d;
  }, [xScale, yScale]);

  // Hour labels for X-axis based on actual time range
  const hourLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i <= timeRange.hours; i++) {
      const time = addHours(timeRange.start, i);
      labels.push({
        time,
        x: xScale(time),
        label: format(time, 'HH:mm'),
      });
    }
    return labels;
  }, [timeRange, xScale]);

  const exportSVG = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marey-chart-${format(new Date(), 'yyyy-MM-dd')}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setZoomLevel(1);
    setSelectedTrain(null);
    refetchFreight();
    refetchPassenger();
    refetchDisruptions();
    toast.success('Chart reset');
  };

  // Handle train click to show details
  const handleTrainClick = async (path: TrainPath) => {
    setIsLoadingDetails(true);
    try {
      if (path.type === 'freight') {
        const { data, error } = await supabase
          .from('freight_trains')
          .select('source_station, destination_station, commodity, load_type, total_km')
          .eq('load_id', path.id)
          .single();
        
        setSelectedTrain({
          path,
          freightDetails: data ? {
            source_station: data.source_station,
            destination_station: data.destination_station,
            commodity: data.commodity,
            load_type: data.load_type,
            total_km: data.total_km,
          } : undefined,
        });
      } else {
        const { data, error } = await supabase
          .from('passenger_trains')
          .select('train_name, source_station, destination_station, train_type')
          .eq('train_number', path.id)
          .single();
        
        setSelectedTrain({
          path,
          passengerDetails: data ? {
            train_name: data.train_name,
            source_station: data.source_station,
            destination_station: data.destination_station,
            train_type: data.train_type,
          } : undefined,
        });
      }
    } catch (error) {
      console.error('Error fetching train details:', error);
      setSelectedTrain({ path });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const activeDisruptions = disruptions?.filter(d => d.is_active) ?? [];

  if (freightLoading || passengerLoading || stationsLoading) {
    return (
      <Card className="border-border bg-white">
        <CardContent className="flex items-center justify-center h-[600px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="ml-3 text-gray-600">Loading chart data...</span>
        </CardContent>
      </Card>
    );
  }

  // Get first and last station names
  const firstStation = processedStations[0];
  const lastStation = processedStations[processedStations.length - 1];
  const routeTitle = `${firstStation?.station_name || 'KTV'} (${firstStation?.station_code || 'KTV'}) → ${lastStation?.station_name || 'PSA'} (${lastStation?.station_code || 'PSA'}) — Time vs Distance Simulation`;

  return (
    <Card className="border border-gray-200 bg-white overflow-hidden shadow-sm">
      <CardContent className="p-0">
        {/* Header with controls */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Live Marey diagram · {firstStation?.station_code || 'KTV'} → {lastStation?.station_code || 'PSA'}</span>
            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              {passengerPaths.length} Passenger
            </span>
            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs font-medium">
              {freightPaths.length} Freight
            </span>
            <span className="text-xs text-gray-500">
              {format(timeRange.start, 'MMM d, HH:mm')} - {format(timeRange.end, 'MMM d, HH:mm')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
              className="h-8 px-3 text-sm bg-white border-gray-300 hover:bg-gray-100"
            >
              Zoom in
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setZoomLevel(z => Math.max(0.5, z - 0.25))}
              className="h-8 px-3 text-sm bg-white border-gray-300 hover:bg-gray-100"
            >
              Zoom out
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={reset}
              className="h-8 px-3 text-sm bg-white border-gray-300 hover:bg-gray-100"
            >
              Reset
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportSVG}
              className="h-8 px-3 text-sm bg-white border-gray-300 hover:bg-gray-100"
            >
              Export SVG
            </Button>
          </div>
        </div>

        {/* Chart */}
        <ScrollArea className="w-full bg-white" style={{ height: chartHeight + 20 }}>
          <svg 
            ref={svgRef}
            width={chartWidth} 
            height={chartHeight}
            style={{ backgroundColor: 'white' }}
          >
            {/* Background */}
            <rect width={chartWidth} height={chartHeight} fill="white" />

            {/* Title */}
            <text 
              x={chartWidth / 2} 
              y={30} 
              textAnchor="middle" 
              fill={COLORS.text} 
              fontSize="16" 
              fontWeight="600" 
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {routeTitle}
            </text>

            {/* Disruption zones (time-bounded yellow bands) */}
            {activeDisruptions.map((disruption) => {
              const stationCode = disruption.station_code || disruption.block_section_code;
              if (!stationCode) return null;
              
              // For station-based disruptions
              let yPos: number | null = null;
              let bandHeight = 25;
              
              const distance = stationDistanceMap.get(stationCode);
              if (distance !== undefined) {
                yPos = yScale(distance);
              } else {
                // Try to find block section (format: "STA1-STA2")
                const parts = stationCode.split('-');
                if (parts.length === 2) {
                  const d1 = stationDistanceMap.get(parts[0]);
                  const d2 = stationDistanceMap.get(parts[1]);
                  if (d1 !== undefined && d2 !== undefined) {
                    const minDist = Math.min(d1, d2);
                    const maxDist = Math.max(d1, d2);
                    yPos = yScale(maxDist);
                    bandHeight = Math.abs(yScale(minDist) - yScale(maxDist));
                  }
                }
              }
              
              if (yPos === null) return null;
              
              // Calculate time bounds
              const startTime = parseISO(disruption.start_time);
              const endTime = disruption.end_time ? parseISO(disruption.end_time) : addHours(startTime, 4); // Default 4 hour duration
              
              // Check if disruption overlaps with chart time range
              if (endTime < timeRange.start || startTime > timeRange.end) return null;
              
              const x1 = Math.max(xScale(startTime), MARGIN.left);
              const x2 = Math.min(xScale(endTime), chartWidth - MARGIN.right);
              const rectWidth = x2 - x1;
              
              if (rectWidth <= 0) return null;
              
              const severityColor = disruption.severity === 'critical' ? '#EF4444' : 
                                   disruption.severity === 'major' ? '#F97316' : COLORS.disruption;

              return (
                <g key={disruption.id}>
                  {/* Disruption rectangle */}
                  <rect
                    x={x1}
                    y={yPos - bandHeight / 2}
                    width={rectWidth}
                    height={bandHeight}
                    fill={severityColor}
                    opacity={0.4}
                    stroke={severityColor}
                    strokeWidth={1}
                    strokeDasharray="4,2"
                  />
                  {/* Disruption pattern overlay */}
                  <pattern id={`diag-${disruption.id}`} patternUnits="userSpaceOnUse" width="8" height="8">
                    <path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke={severityColor} strokeWidth="1" opacity="0.5"/>
                  </pattern>
                  <rect
                    x={x1}
                    y={yPos - bandHeight / 2}
                    width={rectWidth}
                    height={bandHeight}
                    fill={`url(#diag-${disruption.id})`}
                  />
                  {/* Disruption label */}
                  {rectWidth > 80 && (
                    <text
                      x={x1 + rectWidth / 2}
                      y={yPos}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={disruption.severity === 'critical' ? '#7F1D1D' : '#92400E'}
                      fontSize="9"
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {disruption.disruption_type.toUpperCase()}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Grid Lines - Stations (Horizontal) */}
            {processedStations.map((station) => {
              const y = yScale(station.cumulative_distance_km);
              const stationName = stationNameMap.get(station.station_code) || station.station_code;
              
              return (
                <g key={station.station_code}>
                  {/* Horizontal grid line */}
                  <line
                    x1={MARGIN.left}
                    y1={y}
                    x2={chartWidth - MARGIN.right}
                    y2={y}
                    stroke={COLORS.gridLine}
                    strokeWidth={0.5}
                  />
                  {/* Station name on left */}
                  <text
                    x={MARGIN.left - 10}
                    y={y}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill={COLORS.text}
                    fontSize="10"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {stationName}
                  </text>
                  {/* Distance on right */}
                  <text
                    x={chartWidth - MARGIN.right + 10}
                    y={y}
                    textAnchor="start"
                    dominantBaseline="middle"
                    fill={COLORS.textMuted}
                    fontSize="10"
                    fontFamily="system-ui, -apple-system, sans-serif"
                  >
                    {station.cumulative_distance_km.toFixed(2)} km
                  </text>
                </g>
              );
            })}

            {/* Grid Lines - Time (Vertical) */}
            {hourLabels.map((label, i) => (
              <g key={i}>
                <line
                  x1={label.x}
                  y1={MARGIN.top}
                  x2={label.x}
                  y2={chartHeight - MARGIN.bottom}
                  stroke={COLORS.gridLine}
                  strokeWidth={0.5}
                />
                <text
                  x={label.x}
                  y={chartHeight - MARGIN.bottom + 20}
                  textAnchor="middle"
                  fill={COLORS.textMuted}
                  fontSize="11"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {label.label}
                </text>
              </g>
            ))}

            {/* Axis border */}
            <rect
              x={MARGIN.left}
              y={MARGIN.top}
              width={innerWidth}
              height={innerHeight}
              fill="none"
              stroke={COLORS.gridLineMajor}
              strokeWidth="1"
            />

            {/* Y-Axis Label */}
            <text
              x={25}
              y={chartHeight / 2}
              textAnchor="middle"
              fill={COLORS.text}
              fontSize="12"
              fontWeight="500"
              transform={`rotate(-90, 25, ${chartHeight / 2})`}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Distance (km) - Stations
            </text>

            {/* X-Axis Label */}
            <text
              x={chartWidth / 2}
              y={chartHeight - 15}
              textAnchor="middle"
              fill={COLORS.text}
              fontSize="12"
              fontWeight="500"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              Time (hours)
            </text>

            {/* Train Paths */}
            {allPaths.map((path) => {
              const isHovered = hoveredTrain === `${path.type}-${path.id}`;
              const isSelected = selectedTrain?.path.id === path.id && selectedTrain?.path.type === path.type;
              const strokeWidth = isSelected ? 3 : isHovered ? 2.5 : 1.5;
              const opacity = isSelected ? 1 : isHovered ? 1 : 0.8;
              
              return (
                <g key={`${path.type}-${path.id}`}>
                  <path
                    d={generatePath(path)}
                    fill="none"
                    stroke={isSelected ? '#8B5CF6' : path.color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={path.isDashed ? "5,3" : "0"}
                    opacity={opacity}
                    style={{ cursor: 'pointer', transition: 'stroke-width 0.2s, opacity 0.2s, stroke 0.2s' }}
                    onMouseEnter={() => setHoveredTrain(`${path.type}-${path.id}`)}
                    onMouseLeave={() => setHoveredTrain(null)}
                    onClick={() => handleTrainClick(path)}
                  />
                  {/* Show train ID on hover or when selected */}
                  {(isHovered || isSelected) && path.movements.length > 0 && (
                    <text
                      x={xScale(path.movements[0].arrival) + 5}
                      y={yScale(path.movements[0].distance_km) - 10}
                      fill={isSelected ? '#8B5CF6' : path.color}
                      fontSize="10"
                      fontWeight="600"
                      fontFamily="system-ui, -apple-system, sans-serif"
                    >
                      {path.id}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Live Current Time Marker */}
            {currentTime >= timeRange.start && currentTime <= timeRange.end && (
              <g>
                {/* Glowing vertical line */}
                <line
                  x1={xScale(currentTime)}
                  y1={MARGIN.top}
                  x2={xScale(currentTime)}
                  y2={chartHeight - MARGIN.bottom}
                  stroke="#EF4444"
                  strokeWidth={3}
                  opacity={0.3}
                />
                <line
                  x1={xScale(currentTime)}
                  y1={MARGIN.top}
                  x2={xScale(currentTime)}
                  y2={chartHeight - MARGIN.bottom}
                  stroke="#EF4444"
                  strokeWidth={2}
                  strokeDasharray="8,4"
                />
                {/* Time label at top */}
                <rect
                  x={xScale(currentTime) - 30}
                  y={MARGIN.top - 22}
                  width={60}
                  height={18}
                  rx={4}
                  fill="#EF4444"
                />
                <text
                  x={xScale(currentTime)}
                  y={MARGIN.top - 10}
                  textAnchor="middle"
                  fill="white"
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="system-ui, -apple-system, sans-serif"
                >
                  {format(currentTime, 'HH:mm:ss')}
                </text>
                {/* "NOW" indicator */}
                <circle
                  cx={xScale(currentTime)}
                  cy={MARGIN.top - 28}
                  r={4}
                  fill="#EF4444"
                >
                  <animate
                    attributeName="opacity"
                    values="1;0.5;1"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            )}
          </svg>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            {/* Downline Passenger */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 rounded" style={{ backgroundColor: COLORS.passengerDN }} />
              <span className="text-gray-600">Downline Passenger (solid)</span>
            </div>
            {/* Upline Passenger */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 rounded" style={{ backgroundColor: COLORS.passengerUP }} />
              <span className="text-gray-600">Upline Passenger (solid)</span>
            </div>
            {/* Downline Freight */}
            <div className="flex items-center gap-2">
              <svg width="32" height="2">
                <line x1="0" y1="1" x2="32" y2="1" stroke={COLORS.freightDN} strokeWidth="2" strokeDasharray="5,3" />
              </svg>
              <span className="text-gray-600">Downline Freight (dashed)</span>
            </div>
            {/* Upline Freight */}
            <div className="flex items-center gap-2">
              <svg width="32" height="2">
                <line x1="0" y1="1" x2="32" y2="1" stroke={COLORS.freightUP} strokeWidth="2" strokeDasharray="5,3" />
              </svg>
              <span className="text-gray-600">Upline Freight (dashed)</span>
            </div>
            {/* Waiting/dwell */}
            <div className="flex items-center gap-2">
              <svg width="32" height="2">
                <line x1="0" y1="1" x2="32" y2="1" stroke={COLORS.waiting} strokeWidth="2" strokeDasharray="2,2" />
              </svg>
              <span className="text-gray-600">Waiting / dwell</span>
            </div>
            {/* Disruption window */}
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: COLORS.disruption, opacity: 0.5 }} />
              <span className="text-gray-600">Disruption window</span>
            </div>
            {/* Prioritization decision */}
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: COLORS.prioritization }} />
              <span className="text-gray-600">Prioritization decision</span>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Train Details Dialog */}
      <Dialog open={!!selectedTrain} onOpenChange={() => setSelectedTrain(null)}>
        <DialogContent className="max-w-lg bg-white border-gray-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedTrain?.path.type === 'freight' ? (
                <Package className="w-5 h-5 text-gray-600" />
              ) : (
                <Users className="w-5 h-5 text-blue-600" />
              )}
              <span>Train {selectedTrain?.path.id}</span>
              <Badge 
                variant="outline" 
                className={selectedTrain?.path.type === 'freight' 
                  ? 'bg-gray-100 text-gray-700 border-gray-300' 
                  : 'bg-blue-100 text-blue-700 border-blue-300'}
              >
                {selectedTrain?.path.type === 'freight' ? 'Freight' : 'Passenger'}
              </Badge>
              <Badge 
                variant="outline" 
                className={selectedTrain?.path.direction === 'UP' 
                  ? 'bg-cyan-100 text-cyan-700 border-cyan-300' 
                  : 'bg-red-100 text-red-700 border-red-300'}
              >
                {selectedTrain?.path.direction === 'UP' ? '↑ UP' : '↓ DN'}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              <span className="ml-2 text-gray-600">Loading details...</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Route Info */}
              {selectedTrain?.freightDetails && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> Route Information
                  </h4>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-700">{selectedTrain.freightDetails.source_station}</span>
                    <ArrowRight className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-700">{selectedTrain.freightDetails.destination_station}</span>
                  </div>
                  {selectedTrain.freightDetails.total_km && (
                    <p className="text-sm text-gray-500 mt-1">Total: {selectedTrain.freightDetails.total_km} km</p>
                  )}
                  {selectedTrain.freightDetails.commodity && (
                    <p className="text-sm text-gray-600 mt-2">
                      <span className="font-medium">Commodity:</span> {selectedTrain.freightDetails.commodity}
                    </p>
                  )}
                  {selectedTrain.freightDetails.load_type && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Load Type:</span> {selectedTrain.freightDetails.load_type}
                    </p>
                  )}
                </div>
              )}

              {selectedTrain?.passengerDetails && (
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-3 flex items-center gap-2">
                    <Train className="w-4 h-4" /> Train Information
                  </h4>
                  {selectedTrain.passengerDetails.train_name && (
                    <p className="font-semibold text-blue-800 mb-2">{selectedTrain.passengerDetails.train_name}</p>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-blue-700">{selectedTrain.passengerDetails.source_station}</span>
                    <ArrowRight className="w-4 h-4 text-blue-400" />
                    <span className="font-medium text-blue-700">{selectedTrain.passengerDetails.destination_station}</span>
                  </div>
                  {selectedTrain.passengerDetails.train_type && (
                    <p className="text-sm text-blue-600 mt-2">
                      <span className="font-medium">Type:</span> {selectedTrain.passengerDetails.train_type}
                    </p>
                  )}
                </div>
              )}

              {/* Movement Timeline */}
              {selectedTrain?.path.movements && selectedTrain.path.movements.length > 0 && (
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4" /> Movement Timeline ({selectedTrain.path.movements.length} stops)
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {selectedTrain.path.movements.map((m, idx) => {
                      const stationName = stationNameMap.get(m.station_code) || m.station_code;
                      const dwellTime = m.departure ? differenceInMinutes(m.departure, m.arrival) : 0;
                      
                      return (
                        <div key={idx} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${m.is_halt ? 'bg-amber-500' : 'bg-green-500'}`} />
                            <span className="font-medium text-gray-700">{stationName}</span>
                            <span className="text-gray-400 text-xs">({m.distance_km.toFixed(1)} km)</span>
                          </div>
                          <div className="text-right">
                            <span className="text-gray-600">{format(m.arrival, 'HH:mm')}</span>
                            {dwellTime > 0 && (
                              <span className="text-amber-600 text-xs ml-2">(+{dwellTime}m)</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stats Summary */}
              {selectedTrain?.path.movements && selectedTrain.path.movements.length >= 2 && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                    <p className="text-xs text-green-600 font-medium">Start</p>
                    <p className="text-sm font-bold text-green-800">
                      {format(selectedTrain.path.movements[0].arrival, 'HH:mm')}
                    </p>
                  </div>
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
                    <p className="text-xs text-red-600 font-medium">End</p>
                    <p className="text-sm font-bold text-red-800">
                      {format(selectedTrain.path.movements[selectedTrain.path.movements.length - 1].arrival, 'HH:mm')}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                    <p className="text-xs text-purple-600 font-medium">Duration</p>
                    <p className="text-sm font-bold text-purple-800">
                      {differenceInMinutes(
                        selectedTrain.path.movements[selectedTrain.path.movements.length - 1].arrival,
                        selectedTrain.path.movements[0].arrival
                      )} min
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
