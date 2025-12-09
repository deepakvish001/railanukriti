import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Clock, Train, ZoomIn, ZoomOut, GitCompare, Timer, TrendingUp, AlertTriangle, Users, AlertCircle, Lightbulb, Route, CheckCircle2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useRouteStations, useDisruptions, Disruption } from '@/hooks/useFreightData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO, differenceInMinutes, addHours, startOfDay, addSeconds } from 'date-fns';

interface MovementData {
  id: string;
  load_id: string;
  station_code: string;
  arrival_time: string | null;
  departure_time: string | null;
  speed: number | null;
  is_stoppage: boolean;
  halt_minutes: number | null;
  freight_train_id: string | null;
}

interface PassengerScheduleData {
  id: string;
  train_number: string;
  train_id: string;
  station_code: string;
  arrival_seconds: number | null;
  departure_seconds: number | null;
  route_seq_no: number;
  direction: string | null;
  is_halt: boolean | null;
}

interface TrainPath {
  load_id: string;
  color: string;
  movements: {
    station_code: string;
    station_seq: number;
    arrival: Date | null;
    departure: Date | null;
    speed: number;
    is_stoppage: boolean;
    halt_minutes: number;
  }[];
}

interface PassengerPath {
  train_number: string;
  train_id: string;
  direction: string;
  color: string;
  stops: {
    station_code: string;
    station_seq: number;
    arrival: Date | null;
    departure: Date | null;
    is_halt: boolean;
  }[];
}

const TRAIN_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#a855f7', '#eab308', '#0ea5e9', '#d946ef',
];

const COMPARE_COLORS = ['#22d3ee', '#f472b6']; // Cyan and Pink for comparison
const PASSENGER_COLOR = '#a78bfa'; // Purple for passenger trains

// Rescheduling suggestion types
interface ReschedulingSuggestion {
  id: string;
  trainId: string;
  trainColor: string;
  type: 'delay_departure' | 'speed_adjustment' | 'alternate_route' | 'hold_at_station' | 'priority_change';
  priority: 'high' | 'medium' | 'low';
  description: string;
  details: string;
  estimatedBenefit: string;
  affectedDisruption: Disruption;
  originalDelay: number;
  suggestedAction: {
    delayMinutes?: number;
    holdStation?: string;
    speedReduction?: number;
    alternateRoute?: string[];
  };
}

export function FreightGanttChart() {
  const { stations } = useRouteStations();
  const { disruptions } = useDisruptions();
  const [zoomLevel, setZoomLevel] = useState(1);
  const [timeOffset, setTimeOffset] = useState(0);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareTrain1, setCompareTrain1] = useState<string | null>(null);
  const [compareTrain2, setCompareTrain2] = useState<string | null>(null);
  const [showPassengerTrains, setShowPassengerTrains] = useState(false);
  const [showDisruptions, setShowDisruptions] = useState(true);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<string>>(new Set());
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());

  // Fetch movements data
  const { data: movements, isLoading } = useQuery({
    queryKey: ['freight-movements-gantt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freight_movements')
        .select('id, load_id, station_code, arrival_time, departure_time, speed, is_stoppage, halt_minutes, freight_train_id')
        .not('arrival_time', 'is', null)
        .order('arrival_time', { ascending: true })
        .limit(2000);
      
      if (error) throw error;
      return data as MovementData[];
    },
  });

  // Fetch passenger schedule data
  const { data: passengerSchedule } = useQuery({
    queryKey: ['passenger-schedule-gantt'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_schedule')
        .select('id, train_number, train_id, station_code, arrival_seconds, departure_seconds, route_seq_no, direction, is_halt')
        .order('train_id', { ascending: true })
        .order('route_seq_no', { ascending: true })
        .limit(5000);
      
      if (error) throw error;
      return data as PassengerScheduleData[];
    },
    enabled: showPassengerTrains, // Only fetch when toggle is on
  });

  // Create station sequence map
  const stationSeqMap = useMemo(() => {
    const map = new Map<string, number>();
    stations.forEach(s => map.set(s.station_code, s.seq_no));
    return map;
  }, [stations]);

  const orderedStations = useMemo(() => {
    return [...stations].sort((a, b) => a.seq_no - b.seq_no);
  }, [stations]);

  // Process movements into train paths
  const trainPaths = useMemo(() => {
    if (!movements || movements.length === 0) return [];

    const pathMap = new Map<string, TrainPath>();
    
    movements.forEach((m, idx) => {
      if (!pathMap.has(m.load_id)) {
        pathMap.set(m.load_id, {
          load_id: m.load_id,
          color: TRAIN_COLORS[pathMap.size % TRAIN_COLORS.length],
          movements: [],
        });
      }

      const stationSeq = stationSeqMap.get(m.station_code);
      if (stationSeq === undefined) return;

      pathMap.get(m.load_id)!.movements.push({
        station_code: m.station_code,
        station_seq: stationSeq,
        arrival: m.arrival_time ? parseISO(m.arrival_time) : null,
        departure: m.departure_time ? parseISO(m.departure_time) : null,
        speed: m.speed || 0,
        is_stoppage: m.is_stoppage,
        halt_minutes: m.halt_minutes || 0,
      });
    });

    // Sort movements within each train by arrival time
    pathMap.forEach(path => {
      path.movements.sort((a, b) => {
        if (!a.arrival || !b.arrival) return 0;
        return a.arrival.getTime() - b.arrival.getTime();
      });
    });

    return Array.from(pathMap.values());
  }, [movements, stationSeqMap]);

  // Process passenger schedule into paths
  const passengerPaths = useMemo(() => {
    if (!passengerSchedule || passengerSchedule.length === 0 || !showPassengerTrains) return [];
    
    // Use the base date from freight movements for alignment
    const baseDate = movements && movements.length > 0 && movements[0].arrival_time
      ? startOfDay(parseISO(movements[0].arrival_time))
      : startOfDay(new Date());

    const pathMap = new Map<string, PassengerPath>();
    
    passengerSchedule.forEach((s) => {
      const key = s.train_id;
      if (!pathMap.has(key)) {
        pathMap.set(key, {
          train_number: s.train_number,
          train_id: s.train_id,
          direction: s.direction || 'UP',
          color: PASSENGER_COLOR,
          stops: [],
        });
      }

      const stationSeq = stationSeqMap.get(s.station_code);
      if (stationSeq === undefined) return;

      // Convert seconds from midnight to Date objects
      const arrivalDate = s.arrival_seconds !== null 
        ? addSeconds(baseDate, s.arrival_seconds)
        : null;
      const departureDate = s.departure_seconds !== null
        ? addSeconds(baseDate, s.departure_seconds)
        : null;

      pathMap.get(key)!.stops.push({
        station_code: s.station_code,
        station_seq: stationSeq,
        arrival: arrivalDate,
        departure: departureDate,
        is_halt: s.is_halt || false,
      });
    });

    // Sort stops by route sequence
    pathMap.forEach(path => {
      path.stops.sort((a, b) => a.station_seq - b.station_seq);
    });

    return Array.from(pathMap.values());
  }, [passengerSchedule, stationSeqMap, showPassengerTrains, movements]);

  // Detect conflicts between freight and passenger trains
  interface Conflict {
    id: string;
    freightLoadId: string;
    passengerTrainNumber: string;
    stationCode: string;
    stationSeq: number;
    freightArrival: Date;
    freightDeparture: Date;
    passengerArrival: Date;
    passengerDeparture: Date;
    overlapMinutes: number;
  }

  const conflicts = useMemo((): Conflict[] => {
    if (!showPassengerTrains || passengerPaths.length === 0 || trainPaths.length === 0) {
      return [];
    }

    const detected: Conflict[] = [];
    const CONFLICT_THRESHOLD_MINUTES = 5; // Minimum overlap to consider a conflict

    // For each freight train movement
    trainPaths.forEach(freightTrain => {
      freightTrain.movements.forEach((fMovement, fIdx) => {
        if (!fMovement.arrival || !fMovement.departure) return;
        
        // Check against each passenger train stop at the same station
        passengerPaths.forEach(passengerTrain => {
          passengerTrain.stops.forEach((pStop) => {
            if (pStop.station_code !== fMovement.station_code) return;
            if (!pStop.arrival || !pStop.departure) return;

            // Check for time overlap
            const fStart = fMovement.arrival!.getTime();
            const fEnd = fMovement.departure!.getTime();
            const pStart = pStop.arrival!.getTime();
            const pEnd = pStop.departure!.getTime();

            // Calculate overlap
            const overlapStart = Math.max(fStart, pStart);
            const overlapEnd = Math.min(fEnd, pEnd);
            const overlapMs = overlapEnd - overlapStart;
            const overlapMinutes = overlapMs / 60000;

            if (overlapMinutes >= CONFLICT_THRESHOLD_MINUTES) {
              detected.push({
                id: `${freightTrain.load_id}-${passengerTrain.train_id}-${fMovement.station_code}`,
                freightLoadId: freightTrain.load_id,
                passengerTrainNumber: passengerTrain.train_number,
                stationCode: fMovement.station_code,
                stationSeq: fMovement.station_seq,
                freightArrival: fMovement.arrival!,
                freightDeparture: fMovement.departure!,
                passengerArrival: pStop.arrival!,
                passengerDeparture: pStop.departure!,
                overlapMinutes: Math.round(overlapMinutes),
              });
            }
          });
        });
      });
    });

    return detected;
  }, [showPassengerTrains, passengerPaths, trainPaths]);

  // Create a set of conflict locations for quick lookup
  const conflictLocations = useMemo(() => {
    const set = new Set<string>();
    conflicts.forEach(c => {
      set.add(`${c.freightLoadId}-${c.stationCode}`);
    });
    return set;
  }, [conflicts]);

  // Disruption impact analysis - find which trains are affected by each disruption
  interface DisruptionImpact {
    disruption: Disruption;
    affectedTrains: {
      loadId: string;
      color: string;
      stationsAffected: string[];
      estimatedDelayMinutes: number;
    }[];
    totalTrainsAffected: number;
    severity: 'critical' | 'high' | 'medium' | 'low';
  }

  const disruptionImpacts = useMemo((): DisruptionImpact[] => {
    if (!showDisruptions || disruptions.length === 0 || trainPaths.length === 0) {
      return [];
    }

    return disruptions.map(disruption => {
      const affectedTrains: DisruptionImpact['affectedTrains'] = [];
      
      // Get affected station codes from disruption
      const affectedStationCodes = new Set<string>();
      
      if (disruption.station_code) {
        affectedStationCodes.add(disruption.station_code);
      } else if (disruption.block_section_code) {
        // Parse block section code to get station codes
        const parts = disruption.block_section_code.split('-');
        parts.forEach(code => {
          if (code && stationSeqMap.has(code)) {
            affectedStationCodes.add(code);
          }
        });
      }

      // Check each train's path for overlap with disruption
      trainPaths.forEach(train => {
        const stationsAffected: string[] = [];
        
        train.movements.forEach(movement => {
          if (affectedStationCodes.has(movement.station_code)) {
            stationsAffected.push(movement.station_code);
          }
        });

        if (stationsAffected.length > 0) {
          // Estimate delay based on disruption type and severity
          let baseDelay = 0;
          switch (disruption.disruption_type) {
            case 'block': baseDelay = 60; break;
            case 'accident': baseDelay = 90; break;
            case 'signal_failure': baseDelay = 30; break;
            case 'speed_restriction': baseDelay = 15; break;
            case 'maintenance': baseDelay = 20; break;
            default: baseDelay = 15;
          }
          
          const severityMultiplier: Record<string, number> = {
            critical: 2.0,
            high: 1.5,
            medium: 1.0,
            low: 0.5,
          };
          
          const estimatedDelayMinutes = Math.round(
            baseDelay * (severityMultiplier[disruption.severity] || 1) * stationsAffected.length
          );

          affectedTrains.push({
            loadId: train.load_id,
            color: train.color,
            stationsAffected,
            estimatedDelayMinutes,
          });
        }
      });

      return {
        disruption,
        affectedTrains,
        totalTrainsAffected: affectedTrains.length,
        severity: disruption.severity as DisruptionImpact['severity'],
      };
    });
  }, [showDisruptions, disruptions, trainPaths, stationSeqMap]);

  // Create lookup for trains affected by disruptions
  const trainsAffectedByDisruption = useMemo(() => {
    const map = new Map<string, { disruption: Disruption; estimatedDelay: number }[]>();
    
    disruptionImpacts.forEach(impact => {
      impact.affectedTrains.forEach(train => {
        if (!map.has(train.loadId)) {
          map.set(train.loadId, []);
        }
        map.get(train.loadId)!.push({
          disruption: impact.disruption,
          estimatedDelay: train.estimatedDelayMinutes,
        });
      });
    });
    
    return map;
  }, [disruptionImpacts]);

  // Generate automatic rescheduling suggestions for affected trains
  const reschedulingSuggestions = useMemo((): ReschedulingSuggestion[] => {
    if (!showDisruptions || disruptionImpacts.length === 0) return [];
    
    const suggestions: ReschedulingSuggestion[] = [];
    
    disruptionImpacts.forEach(impact => {
      if (impact.totalTrainsAffected === 0) return;
      
      const disruption = impact.disruption;
      
      impact.affectedTrains.forEach((train, trainIndex) => {
        // Skip if already applied or dismissed
        const baseId = `${train.loadId}-${disruption.id}`;
        if (appliedSuggestions.has(baseId) || dismissedSuggestions.has(baseId)) return;
        
        // Find train path for more context
        const trainPath = trainPaths.find(tp => tp.load_id === train.loadId);
        if (!trainPath) return;
        
        // Find the first station before the disruption
        const affectedStationSeqs = train.stationsAffected
          .map(s => stationSeqMap.get(s))
          .filter(s => s !== undefined) as number[];
        const minAffectedSeq = Math.min(...affectedStationSeqs);
        
        const stationsBeforeDisruption = trainPath.movements
          .filter(m => m.station_seq < minAffectedSeq)
          .sort((a, b) => b.station_seq - a.station_seq);
        
        const holdStation = stationsBeforeDisruption[0]?.station_code;
        
        // Generate different types of suggestions based on disruption type and severity
        switch (disruption.disruption_type) {
          case 'block':
          case 'accident':
            // High severity - suggest holding at previous station
            if (holdStation) {
              suggestions.push({
                id: `${baseId}-hold`,
                trainId: train.loadId,
                trainColor: train.color,
                type: 'hold_at_station',
                priority: 'high',
                description: `Hold at ${holdStation} until disruption clears`,
                details: `Train ${train.loadId} is approaching a ${disruption.disruption_type} at ${disruption.block_section_code || disruption.station_code}. Recommend holding at ${holdStation} to avoid congestion.`,
                estimatedBenefit: `Avoids ${train.estimatedDelayMinutes}min delay cascade`,
                affectedDisruption: disruption,
                originalDelay: train.estimatedDelayMinutes,
                suggestedAction: {
                  holdStation,
                  delayMinutes: Math.max(30, train.estimatedDelayMinutes),
                },
              });
            }
            break;
            
          case 'signal_failure':
            // Suggest speed reduction
            suggestions.push({
              id: `${baseId}-speed`,
              trainId: train.loadId,
              trainColor: train.color,
              type: 'speed_adjustment',
              priority: 'medium',
              description: `Reduce speed through ${disruption.station_code || disruption.block_section_code}`,
              details: `Signal failure requires cautious approach. Reduce speed to ${disruption.max_speed_allowed || 30} km/h through affected section.`,
              estimatedBenefit: `Safe passage, reduces delay to ~${Math.round(train.estimatedDelayMinutes * 0.6)}min`,
              affectedDisruption: disruption,
              originalDelay: train.estimatedDelayMinutes,
              suggestedAction: {
                speedReduction: disruption.max_speed_allowed || 30,
              },
            });
            break;
            
          case 'speed_restriction':
            // Suggest delay departure to avoid bunching
            const delayMinutes = Math.max(15, Math.round(train.estimatedDelayMinutes * 0.5));
            suggestions.push({
              id: `${baseId}-delay`,
              trainId: train.loadId,
              trainColor: train.color,
              type: 'delay_departure',
              priority: 'low',
              description: `Delay departure by ${delayMinutes} minutes`,
              details: `Speed restriction in effect. Delaying departure spreads out traffic and reduces overall congestion through the restricted zone.`,
              estimatedBenefit: `Reduces total delay from ${train.estimatedDelayMinutes}min to ~${Math.round(train.estimatedDelayMinutes * 0.7)}min`,
              affectedDisruption: disruption,
              originalDelay: train.estimatedDelayMinutes,
              suggestedAction: {
                delayMinutes,
              },
            });
            break;
            
          case 'maintenance':
            // Suggest alternate timing
            suggestions.push({
              id: `${baseId}-timing`,
              trainId: train.loadId,
              trainColor: train.color,
              type: 'delay_departure',
              priority: 'medium',
              description: `Reschedule departure by ${Math.round(train.estimatedDelayMinutes * 1.5)} minutes`,
              details: `Planned maintenance window active. Recommend rescheduling to avoid overlap with maintenance period.`,
              estimatedBenefit: `Avoids maintenance conflict entirely`,
              affectedDisruption: disruption,
              originalDelay: train.estimatedDelayMinutes,
              suggestedAction: {
                delayMinutes: Math.round(train.estimatedDelayMinutes * 1.5),
              },
            });
            break;
            
          default:
            // Generic suggestion
            if (holdStation && train.estimatedDelayMinutes > 20) {
              suggestions.push({
                id: `${baseId}-generic`,
                trainId: train.loadId,
                trainColor: train.color,
                type: 'hold_at_station',
                priority: 'medium',
                description: `Consider holding at ${holdStation}`,
                details: `Disruption ahead may cause significant delays. Pre-emptive holding could prevent congestion buildup.`,
                estimatedBenefit: `Reduces network-wide delay impact`,
                affectedDisruption: disruption,
                originalDelay: train.estimatedDelayMinutes,
                suggestedAction: {
                  holdStation,
                },
              });
            }
        }
        
        // For high-delay situations, also suggest alternate routes if junctions exist
        if (train.estimatedDelayMinutes > 45) {
          const junctions = orderedStations.filter(s => s.is_junction);
          const nearbyJunction = junctions.find(j => {
            const jSeq = j.seq_no;
            return jSeq < minAffectedSeq && jSeq > (trainPath.movements[0]?.station_seq || 0);
          });
          
          if (nearbyJunction) {
            suggestions.push({
              id: `${baseId}-route`,
              trainId: train.loadId,
              trainColor: train.color,
              type: 'alternate_route',
              priority: 'high',
              description: `Consider alternate route via ${nearbyJunction.station_code}`,
              details: `Junction at ${nearbyJunction.station_name} (${nearbyJunction.station_code}) may allow rerouting to bypass the disruption. Check track availability and clearance.`,
              estimatedBenefit: `Could save up to ${Math.round(train.estimatedDelayMinutes * 0.8)}min`,
              affectedDisruption: disruption,
              originalDelay: train.estimatedDelayMinutes,
              suggestedAction: {
                alternateRoute: [nearbyJunction.station_code],
              },
            });
          }
        }
      });
    });
    
    // Sort by priority and estimated delay impact
    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.originalDelay - a.originalDelay;
    });
  }, [disruptionImpacts, showDisruptions, trainPaths, stationSeqMap, orderedStations, appliedSuggestions, dismissedSuggestions]);

  // Handle applying a suggestion
  const handleApplySuggestion = (suggestion: ReschedulingSuggestion) => {
    setAppliedSuggestions(prev => new Set([...prev, suggestion.id]));
    // In a real system, this would send the action to the backend
    console.log('Applied suggestion:', suggestion);
  };

  // Handle dismissing a suggestion
  const handleDismissSuggestion = (suggestion: ReschedulingSuggestion) => {
    setDismissedSuggestions(prev => new Set([...prev, suggestion.id]));
  };

  const getCompareTrains = useMemo(() => {
    if (!compareMode) return [];
    return trainPaths.filter(tp => 
      tp.load_id === compareTrain1 || tp.load_id === compareTrain2
    ).map((tp, idx) => ({
      ...tp,
      color: COMPARE_COLORS[idx % 2],
      compareIndex: idx
    }));
  }, [compareMode, compareTrain1, compareTrain2, trainPaths]);

  // Comparison stats
  const comparisonStats = useMemo(() => {
    if (!compareMode || getCompareTrains.length !== 2) return null;
    
    const [train1, train2] = getCompareTrains;
    
    const calcStats = (tp: TrainPath) => {
      const movements = tp.movements.filter(m => m.arrival && m.departure);
      if (movements.length < 2) return null;
      
      const first = movements[0];
      const last = movements[movements.length - 1];
      const totalTime = first.arrival && last.departure 
        ? differenceInMinutes(last.departure, first.arrival) 
        : 0;
      const totalHalts = movements.reduce((sum, m) => sum + m.halt_minutes, 0);
      const stoppages = movements.filter(m => m.is_stoppage).length;
      const speeds = movements.filter(m => m.speed > 0).map(m => m.speed);
      const avgSpeed = speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
      
      return { totalTime, totalHalts, stoppages, avgSpeed, stationCount: movements.length };
    };
    
    const stats1 = calcStats(train1);
    const stats2 = calcStats(train2);
    
    if (!stats1 || !stats2) return null;
    
    return {
      train1: { loadId: train1.load_id, ...stats1 },
      train2: { loadId: train2.load_id, ...stats2 },
      timeDiff: stats1.totalTime - stats2.totalTime,
      haltDiff: stats1.totalHalts - stats2.totalHalts,
      speedDiff: stats1.avgSpeed - stats2.avgSpeed
    };
  }, [compareMode, getCompareTrains]);

  // Calculate time range
  const timeRange = useMemo(() => {
    if (!movements || movements.length === 0) {
      const now = new Date();
      return { start: startOfDay(now), end: addHours(now, 24) };
    }

    const times = movements
      .filter(m => m.arrival_time)
      .map(m => parseISO(m.arrival_time!).getTime());
    
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    return {
      start: new Date(minTime),
      end: new Date(maxTime + 3600000), // Add 1 hour buffer
    };
  }, [movements]);

  // Chart dimensions
  const chartWidth = 1200 * zoomLevel;
  const chartHeight = Math.max(400, orderedStations.length * 30);
  const marginLeft = 80;
  const marginTop = 40;
  const marginBottom = 60;
  const marginRight = 20;

  const plotWidth = chartWidth - marginLeft - marginRight;
  const plotHeight = chartHeight - marginTop - marginBottom;

  // Time to X position
  const timeToX = (time: Date) => {
    const totalMinutes = differenceInMinutes(timeRange.end, timeRange.start);
    const minutesFromStart = differenceInMinutes(time, timeRange.start);
    return marginLeft + (minutesFromStart / totalMinutes) * plotWidth;
  };

  // Station to Y position
  const stationToY = (stationSeq: number) => {
    const minSeq = Math.min(...orderedStations.map(s => s.seq_no));
    const maxSeq = Math.max(...orderedStations.map(s => s.seq_no));
    const range = maxSeq - minSeq || 1;
    return marginTop + ((stationSeq - minSeq) / range) * plotHeight;
  };

  // Generate time axis ticks
  const timeTicks = useMemo(() => {
    const ticks: Date[] = [];
    const totalHours = differenceInMinutes(timeRange.end, timeRange.start) / 60;
    const tickInterval = Math.max(1, Math.floor(totalHours / (12 * zoomLevel)));
    
    let current = new Date(timeRange.start);
    while (current <= timeRange.end) {
      ticks.push(new Date(current));
      current = addHours(current, tickInterval);
    }
    return ticks;
  }, [timeRange, zoomLevel]);

  // Determine which trains to display - MUST be before any early returns to avoid hook order issues
  // Always show all trains, but highlight the selected one
  const displayTrains = useMemo(() => {
    if (compareMode) {
      return getCompareTrains;
    }
    // Always return all trains - selection only highlights, doesn't filter
    return trainPaths;
  }, [compareMode, getCompareTrains, trainPaths]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading freight movement data...
        </CardContent>
      </Card>
    );
  }

  if (!movements || movements.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No freight movement data available. Please import data first.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Freight Train Time-Distance Chart
              <Badge variant="secondary">{trainPaths.length} trains</Badge>
            </CardTitle>
            <div className="flex items-center gap-4">
              {/* Passenger Trains Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="passenger-overlay"
                  checked={showPassengerTrains}
                  onCheckedChange={setShowPassengerTrains}
                />
                <Label htmlFor="passenger-overlay" className="text-sm flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  Passengers
                </Label>
                {showPassengerTrains && passengerPaths.length > 0 && (
                  <Badge variant="outline" className="text-xs" style={{ borderColor: PASSENGER_COLOR, color: PASSENGER_COLOR }}>
                    {passengerPaths.length}
                  </Badge>
                )}
                {showPassengerTrains && conflicts.length > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    {conflicts.length} conflicts
                  </Badge>
                )}
              </div>

              {/* Disruptions Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="disruptions-overlay"
                  checked={showDisruptions}
                  onCheckedChange={setShowDisruptions}
                />
                <Label htmlFor="disruptions-overlay" className="text-sm flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  Disruptions
                </Label>
                {showDisruptions && disruptions.length > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    {disruptions.length} active
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="compare-mode"
                  checked={compareMode}
                  onCheckedChange={(checked) => {
                    setCompareMode(checked);
                    if (!checked) {
                      setCompareTrain1(null);
                      setCompareTrain2(null);
                    }
                  }}
                />
                <Label htmlFor="compare-mode" className="text-sm flex items-center gap-1">
                  <GitCompare className="h-4 w-4" />
                  Compare
                </Label>
              </div>
              
              {/* Zoom controls */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground">{Math.round(zoomLevel * 100)}%</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setZoomLevel(Math.min(3, zoomLevel + 0.25))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Compare mode selectors */}
          {compareMode ? (
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COMPARE_COLORS[0] }} />
                <Select value={compareTrain1 || ""} onValueChange={setCompareTrain1}>
                  <SelectTrigger className="w-[200px] h-8 bg-background/50">
                    <SelectValue placeholder="Select Train 1" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainPaths.map(tp => (
                      <SelectItem 
                        key={tp.load_id} 
                        value={tp.load_id}
                        disabled={tp.load_id === compareTrain2}
                      >
                        {tp.load_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-muted-foreground">vs</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COMPARE_COLORS[1] }} />
                <Select value={compareTrain2 || ""} onValueChange={setCompareTrain2}>
                  <SelectTrigger className="w-[200px] h-8 bg-background/50">
                    <SelectValue placeholder="Select Train 2" />
                  </SelectTrigger>
                  <SelectContent>
                    {trainPaths.map(tp => (
                      <SelectItem 
                        key={tp.load_id} 
                        value={tp.load_id}
                        disabled={tp.load_id === compareTrain1}
                      >
                        {tp.load_id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <Select
              value={selectedTrain || "all"}
              onValueChange={(v) => setSelectedTrain(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[200px] h-8">
                <SelectValue placeholder="All trains" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Trains</SelectItem>
                {trainPaths.slice(0, 30).map(tp => (
                  <SelectItem key={tp.load_id} value={tp.load_id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tp.color }} />
                      <span className="truncate">{tp.load_id.slice(0, 20)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Comparison Stats Panel */}
          {compareMode && comparisonStats && (
            <div className="grid grid-cols-4 gap-3 p-3 bg-background/50 rounded-lg border border-border/50">
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Time Difference</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparisonStats.timeDiff > 0 ? 'text-destructive' : 'text-green-500'
                }`}>
                  <Timer className="h-4 w-4" />
                  {Math.abs(comparisonStats.timeDiff)}m
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparisonStats.timeDiff > 0 ? 'Train 1 slower' : comparisonStats.timeDiff < 0 ? 'Train 1 faster' : 'Equal'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Halt Difference</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparisonStats.haltDiff > 0 ? 'text-warning' : 'text-green-500'
                }`}>
                  <AlertTriangle className="h-4 w-4" />
                  {Math.abs(comparisonStats.haltDiff)}m
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparisonStats.haltDiff > 0 ? 'Train 1 more halts' : comparisonStats.haltDiff < 0 ? 'Train 1 fewer' : 'Equal'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Avg Speed Diff</div>
                <div className={`font-bold flex items-center justify-center gap-1 ${
                  comparisonStats.speedDiff > 0 ? 'text-green-500' : 'text-destructive'
                }`}>
                  <TrendingUp className="h-4 w-4" />
                  {Math.abs(Math.round(comparisonStats.speedDiff))} km/h
                </div>
                <div className="text-xs text-muted-foreground">
                  {comparisonStats.speedDiff > 0 ? 'Train 1 faster' : comparisonStats.speedDiff < 0 ? 'Train 1 slower' : 'Equal'}
                </div>
              </div>
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-1">Station Stops</div>
                <div className="font-bold flex items-center justify-center gap-2">
                  <span style={{ color: COMPARE_COLORS[0] }}>{comparisonStats.train1.stationCount}</span>
                  <span className="text-muted-foreground">vs</span>
                  <span style={{ color: COMPARE_COLORS[1] }}>{comparisonStats.train2.stationCount}</span>
                </div>
              </div>
            </div>
          )}

          {/* Disruption Impact Summary Panel */}
          {showDisruptions && disruptionImpacts.length > 0 && disruptionImpacts.some(i => i.totalTrainsAffected > 0) && (
            <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/30">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="font-medium text-destructive">Disruption Impact Analysis</span>
                <Badge variant="destructive" className="text-xs">
                  {disruptionImpacts.reduce((sum, i) => sum + i.totalTrainsAffected, 0)} trains affected
                </Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {disruptionImpacts.filter(i => i.totalTrainsAffected > 0).map((impact) => {
                  const severityColors: Record<string, string> = {
                    critical: 'border-red-500 bg-red-500/10',
                    high: 'border-orange-500 bg-orange-500/10',
                    medium: 'border-amber-500 bg-amber-500/10',
                    low: 'border-green-500 bg-green-500/10',
                  };
                  const totalDelay = impact.affectedTrains.reduce((sum, t) => sum + t.estimatedDelayMinutes, 0);
                  
                  return (
                    <div 
                      key={impact.disruption.id}
                      className={`p-2 rounded border ${severityColors[impact.severity] || 'border-border'}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-xs truncate">
                          {impact.disruption.block_section_code || impact.disruption.station_code}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {impact.disruption.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-[10px] text-muted-foreground mb-1">
                        {impact.disruption.disruption_type.replace('_', ' ')}
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1">
                          <Train className="h-3 w-3" />
                          <span>{impact.totalTrainsAffected} trains</span>
                        </div>
                        <span className="text-amber-500 font-medium">~{totalDelay} min delay</span>
                      </div>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {impact.affectedTrains.slice(0, 5).map((t) => (
                          <div 
                            key={t.loadId}
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: t.color }}
                            title={t.loadId}
                          />
                        ))}
                        {impact.affectedTrains.length > 5 && (
                          <span className="text-[9px] text-muted-foreground">+{impact.affectedTrains.length - 5}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Rescheduling Suggestions Panel */}
          {showDisruptions && reschedulingSuggestions.length > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => setShowSuggestions(!showSuggestions)}
              >
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <span className="font-medium text-primary">Rescheduling Suggestions</span>
                  <Badge variant="secondary" className="text-xs bg-primary/20 text-primary">
                    {reschedulingSuggestions.length} recommendations
                  </Badge>
                  {appliedSuggestions.size > 0 && (
                    <Badge variant="outline" className="text-xs text-green-500 border-green-500">
                      {appliedSuggestions.size} applied
                    </Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                  {showSuggestions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>
              
              {showSuggestions && (
                <div className="mt-3 space-y-2 max-h-80 overflow-y-auto">
                  {reschedulingSuggestions.slice(0, 10).map((suggestion) => {
                    const priorityColors: Record<string, string> = {
                      high: 'border-red-500 bg-red-500/10',
                      medium: 'border-amber-500 bg-amber-500/10',
                      low: 'border-green-500 bg-green-500/10',
                    };
                    const typeIcons: Record<string, React.ReactNode> = {
                      delay_departure: <Timer className="h-3.5 w-3.5" />,
                      speed_adjustment: <TrendingUp className="h-3.5 w-3.5" />,
                      alternate_route: <Route className="h-3.5 w-3.5" />,
                      hold_at_station: <AlertCircle className="h-3.5 w-3.5" />,
                      priority_change: <Train className="h-3.5 w-3.5" />,
                    };
                    
                    return (
                      <div 
                        key={suggestion.id}
                        className={`p-3 rounded-lg border ${priorityColors[suggestion.priority] || 'border-border'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: suggestion.trainColor }}
                              />
                              <span className="font-medium text-sm truncate">{suggestion.trainId}</span>
                              <Badge variant="outline" className="text-[10px] flex-shrink-0">
                                {suggestion.priority.toUpperCase()}
                              </Badge>
                              <span className="text-muted-foreground flex items-center gap-1 text-xs flex-shrink-0">
                                {typeIcons[suggestion.type]}
                                {suggestion.type.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">{suggestion.description}</p>
                            <p className="text-xs text-muted-foreground mb-2">{suggestion.details}</p>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-500 font-medium flex items-center gap-1">
                                <TrendingUp className="h-3 w-3" />
                                {suggestion.estimatedBenefit}
                              </span>
                              <span className="text-muted-foreground">|</span>
                              <span className="text-amber-500">
                                Original delay: {suggestion.originalDelay}min
                              </span>
                            </div>
                            {suggestion.suggestedAction.delayMinutes && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span className="font-medium">Action: </span>
                                Delay by {suggestion.suggestedAction.delayMinutes} minutes
                              </div>
                            )}
                            {suggestion.suggestedAction.holdStation && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span className="font-medium">Action: </span>
                                Hold at {suggestion.suggestedAction.holdStation}
                              </div>
                            )}
                            {suggestion.suggestedAction.speedReduction && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span className="font-medium">Action: </span>
                                Reduce speed to {suggestion.suggestedAction.speedReduction} km/h
                              </div>
                            )}
                            {suggestion.suggestedAction.alternateRoute && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                <span className="font-medium">Action: </span>
                                Reroute via {suggestion.suggestedAction.alternateRoute.join(' → ')}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col gap-1 flex-shrink-0">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1 text-green-500 border-green-500 hover:bg-green-500/10"
                              onClick={() => handleApplySuggestion(suggestion)}
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDismissSuggestion(suggestion)}
                            >
                              <X className="h-3 w-3" />
                              Dismiss
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {reschedulingSuggestions.length > 10 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      +{reschedulingSuggestions.length - 10} more suggestions...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="w-full">
          <TooltipProvider>
            <svg width={chartWidth} height={chartHeight} className="bg-muted/20 rounded-lg">
              {/* Grid lines */}
              <g className="grid-lines">
                {/* Horizontal grid (stations) */}
                {orderedStations.map((station) => (
                  <line
                    key={`h-${station.id}`}
                    x1={marginLeft}
                    y1={stationToY(station.seq_no)}
                    x2={chartWidth - marginRight}
                    y2={stationToY(station.seq_no)}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4,4"
                  />
                ))}
                {/* Vertical grid (time) */}
                {timeTicks.map((tick, i) => (
                  <line
                    key={`v-${i}`}
                    x1={timeToX(tick)}
                    y1={marginTop}
                    x2={timeToX(tick)}
                    y2={chartHeight - marginBottom}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4,4"
                  />
                ))}
              </g>

              {/* Y-axis labels (stations) */}
              <g className="y-axis">
                {orderedStations.map((station) => (
                  <text
                    key={`y-${station.id}`}
                    x={marginLeft - 8}
                    y={stationToY(station.seq_no)}
                    textAnchor="end"
                    alignmentBaseline="middle"
                    className="fill-muted-foreground text-[10px] font-mono"
                  >
                    {station.station_code}
                  </text>
                ))}
              </g>

              {/* X-axis labels (time) */}
              <g className="x-axis">
                {timeTicks.map((tick, i) => (
                  <g key={`x-${i}`}>
                    <text
                      x={timeToX(tick)}
                      y={chartHeight - marginBottom + 20}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[10px]"
                    >
                      {format(tick, 'HH:mm')}
                    </text>
                    <text
                      x={timeToX(tick)}
                      y={chartHeight - marginBottom + 35}
                      textAnchor="middle"
                      className="fill-muted-foreground text-[9px]"
                    >
                      {format(tick, 'dd MMM')}
                    </text>
                  </g>
                ))}
              </g>

              {/* Disruption zones */}
              {showDisruptions && disruptions.length > 0 && (
                <g className="disruption-zones">
                  {disruptions.map((disruption) => {
                    // Find station(s) affected by this disruption
                    let stationSeqs: number[] = [];
                    
                    if (disruption.station_code) {
                      const seq = stationSeqMap.get(disruption.station_code);
                      if (seq !== undefined) {
                        stationSeqs = [seq];
                      }
                    } else if (disruption.block_section_code) {
                      // Block section affects area between two stations
                      // Parse block section code (e.g., "KTV-PSA" -> from KTV to PSA)
                      const parts = disruption.block_section_code.split('-');
                      if (parts.length >= 2) {
                        const fromSeq = stationSeqMap.get(parts[0]);
                        const toSeq = stationSeqMap.get(parts[1]);
                        if (fromSeq !== undefined && toSeq !== undefined) {
                          stationSeqs = [fromSeq, toSeq];
                        }
                      }
                    }
                    
                    if (stationSeqs.length === 0) return null;
                    
                    const minSeq = Math.min(...stationSeqs);
                    const maxSeq = Math.max(...stationSeqs);
                    const y1 = stationToY(minSeq);
                    const y2 = stationSeqs.length > 1 ? stationToY(maxSeq) : y1;
                    const height = Math.max(20, Math.abs(y2 - y1) + 20);
                    const yPos = Math.min(y1, y2) - 10;
                    
                    // Get color based on severity
                    const severityColors: Record<string, string> = {
                      critical: '#ef4444',
                      high: '#f97316',
                      medium: '#f59e0b',
                      low: '#22c55e',
                    };
                    const color = severityColors[disruption.severity] || '#ef4444';
                    
                    return (
                      <g key={disruption.id}>
                        {/* Disruption zone rectangle spanning full time range */}
                        <rect
                          x={marginLeft}
                          y={yPos}
                          width={plotWidth}
                          height={height}
                          fill={color}
                          fillOpacity={0.15}
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray="8,4"
                          strokeOpacity={0.6}
                          className="animate-pulse"
                        />
                        
                        {/* Disruption label with affected trains count */}
                        {(() => {
                          const impact = disruptionImpacts.find(i => i.disruption.id === disruption.id);
                          const affectedCount = impact?.totalTrainsAffected || 0;
                          const totalEstimatedDelay = impact?.affectedTrains.reduce((sum, t) => sum + t.estimatedDelayMinutes, 0) || 0;
                          
                          return (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <g className="cursor-pointer">
                                  <rect
                                    x={marginLeft + 5}
                                    y={yPos + 2}
                                    width={180}
                                    height={18}
                                    rx={4}
                                    fill={color}
                                    fillOpacity={0.9}
                                  />
                                  <text
                                    x={marginLeft + 10}
                                    y={yPos + 14}
                                    className="fill-white text-[10px] font-bold"
                                  >
                                    ⚠ {disruption.disruption_type.replace('_', ' ').toUpperCase()}
                                  </text>
                                  <text
                                    x={marginLeft + 120}
                                    y={yPos + 14}
                                    className="fill-white text-[9px]"
                                  >
                                    {affectedCount > 0 ? `${affectedCount} trains ↓` : 'No trains'}
                                  </text>
                                </g>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="max-w-xs bg-background border-destructive">
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-destructive font-bold">
                                    <AlertTriangle className="h-4 w-4" />
                                    {disruption.disruption_type.replace('_', ' ').toUpperCase()}
                                  </div>
                                  <div className="text-sm space-y-1">
                                    <p><span className="text-muted-foreground">Location:</span> {disruption.block_section_code || disruption.station_code}</p>
                                    <p><span className="text-muted-foreground">Severity:</span> <span className="font-medium" style={{ color }}>{disruption.severity.toUpperCase()}</span></p>
                                    {disruption.description && (
                                      <p className="text-muted-foreground italic">{disruption.description}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground">
                                      Since: {format(new Date(disruption.start_time), 'dd MMM HH:mm')}
                                    </p>
                                    {disruption.max_speed_allowed && (
                                      <p><span className="text-muted-foreground">Max Speed:</span> {disruption.max_speed_allowed} km/h</p>
                                    )}
                                  </div>
                                  
                                  {/* Affected trains section */}
                                  {affectedCount > 0 && (
                                    <div className="pt-2 border-t border-border">
                                      <p className="font-medium text-sm flex items-center gap-1 mb-2">
                                        <Train className="h-3 w-3" />
                                        {affectedCount} Trains Affected
                                      </p>
                                      <p className="text-xs text-amber-500 mb-2">
                                        Est. Total Delay: ~{totalEstimatedDelay} min
                                      </p>
                                      <div className="max-h-24 overflow-y-auto space-y-1">
                                        {impact?.affectedTrains.slice(0, 6).map(t => (
                                          <div key={t.loadId} className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-1">
                                              <div 
                                                className="w-2 h-2 rounded-full" 
                                                style={{ backgroundColor: t.color }}
                                              />
                                              <span className="truncate max-w-[100px]">{t.loadId}</span>
                                            </div>
                                            <span className="text-amber-500">+{t.estimatedDelayMinutes}m</span>
                                          </div>
                                        ))}
                                        {(impact?.affectedTrains.length || 0) > 6 && (
                                          <p className="text-xs text-muted-foreground">
                                            +{(impact?.affectedTrains.length || 0) - 6} more trains...
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })()}
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Train paths */}
              <g className="train-paths">
                {displayTrains.map((train) => (
                    <g key={train.load_id}>
                      {/* Draw lines between consecutive movements */}
                      {train.movements.map((movement, idx) => {
                        if (idx === 0) return null;
                        const prev = train.movements[idx - 1];
                        
                        if (!prev.departure || !movement.arrival) return null;
                        
                        const x1 = timeToX(prev.departure);
                        const y1 = stationToY(prev.station_seq);
                        const x2 = timeToX(movement.arrival);
                        const y2 = stationToY(movement.station_seq);

                        const isSelected = selectedTrain === train.load_id;
                        const isOtherSelected = selectedTrain && !isSelected;
                        const disruptionInfo = trainsAffectedByDisruption.get(train.load_id);
                        const isAffectedByDisruption = showDisruptions && disruptionInfo && disruptionInfo.length > 0;
                        const totalDisruptionDelay = disruptionInfo?.reduce((sum, d) => sum + d.estimatedDelay, 0) || 0;

                        return (
                          <Tooltip key={`line-${train.load_id}-${idx}`}>
                            <TooltipTrigger asChild>
                              <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={isAffectedByDisruption ? '#f97316' : train.color}
                                strokeWidth={compareMode ? 4 : (isSelected ? 4 : (isAffectedByDisruption ? 3 : 2))}
                                strokeOpacity={isOtherSelected ? 0.3 : 0.9}
                                strokeDasharray={isAffectedByDisruption ? '6,3' : undefined}
                                className="cursor-pointer hover:stroke-[5px] transition-all"
                                onClick={() => !compareMode && setSelectedTrain(isSelected ? null : train.load_id)}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold" style={{ color: train.color }}>{train.load_id}</p>
                                <p>{prev.station_code} → {movement.station_code}</p>
                                <p>Speed: {movement.speed} km/h</p>
                                {isAffectedByDisruption && (
                                  <div className="mt-1 pt-1 border-t border-border">
                                    <p className="text-amber-500 font-medium flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" />
                                      Affected by {disruptionInfo.length} disruption(s)
                                    </p>
                                    <p className="text-amber-400 text-xs">Est. delay: +{totalDisruptionDelay} min</p>
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}

                      {/* Draw halt indicators at stations */}
                      {train.movements.map((movement, idx) => {
                        if (!movement.arrival) return null;
                        
                        const x = timeToX(movement.arrival);
                        const y = stationToY(movement.station_seq);
                        const hasConflict = conflictLocations.has(`${train.load_id}-${movement.station_code}`);
                        const conflictInfo = conflicts.find(
                          c => c.freightLoadId === train.load_id && c.stationCode === movement.station_code
                        );

                        const isSelected = selectedTrain === train.load_id;
                        const isOtherSelected = selectedTrain && !isSelected;

                        return (
                          <g key={`stop-${train.load_id}-${idx}`} opacity={isOtherSelected ? 0.3 : 1}>
                            {/* Conflict highlight ring */}
                            {hasConflict && (
                              <circle
                                cx={x}
                                cy={y}
                                r={10}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth={2}
                                strokeDasharray="3,3"
                                className="animate-pulse"
                              />
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <circle
                                  cx={x}
                                  cy={y}
                                  r={hasConflict ? 6 : (compareMode ? 6 : (isSelected ? 6 : (movement.is_stoppage ? 5 : movement.halt_minutes > 10 ? 4 : 3)))}
                                  fill={hasConflict ? '#ef4444' : (movement.is_stoppage ? '#ef4444' : movement.halt_minutes > 10 ? '#f59e0b' : train.color)}
                                  stroke={hasConflict ? '#fef2f2' : (compareMode ? train.color : (isSelected ? train.color : "white"))}
                                  strokeWidth={hasConflict ? 2 : (isSelected ? 3 : (compareMode ? 2 : 1))}
                                  className="cursor-pointer"
                                  onClick={() => !compareMode && setSelectedTrain(isSelected ? null : train.load_id)}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-sm">
                                  <p className="font-semibold" style={{ color: hasConflict ? '#ef4444' : train.color }}>
                                    {train.load_id}
                                    {hasConflict && <span className="ml-2 text-red-500">⚠ CONFLICT</span>}
                                  </p>
                                  <p>Station: {movement.station_code}</p>
                                  <p>Arrival: {movement.arrival ? format(movement.arrival, 'HH:mm') : '-'}</p>
                                  <p>Departure: {movement.departure ? format(movement.departure, 'HH:mm') : '-'}</p>
                                  {movement.halt_minutes > 0 && (
                                    <p className={movement.is_stoppage ? 'text-red-500' : 'text-amber-500'}>
                                      {movement.is_stoppage ? 'Stoppage' : 'Halt'}: {movement.halt_minutes} min
                                    </p>
                                  )}
                                  {conflictInfo && (
                                    <div className="mt-2 pt-2 border-t border-red-500/30">
                                      <p className="text-red-400 font-medium">Conflict with Passenger Train:</p>
                                      <p>{conflictInfo.passengerTrainNumber}</p>
                                      <p>Overlap: {conflictInfo.overlapMinutes} min</p>
                                    </div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </g>
                        );
                      })}
                    </g>
                  ))}
              </g>

              {/* Passenger train paths overlay */}
              {showPassengerTrains && passengerPaths.length > 0 && (
                <g className="passenger-paths">
                  {passengerPaths.map((pTrain) => (
                    <g key={pTrain.train_id}>
                      {/* Draw dashed lines between stops */}
                      {pTrain.stops.map((stop, idx) => {
                        if (idx === 0) return null;
                        const prev = pTrain.stops[idx - 1];
                        
                        if (!prev.departure || !stop.arrival) return null;
                        
                        const x1 = timeToX(prev.departure);
                        const y1 = stationToY(prev.station_seq);
                        const x2 = timeToX(stop.arrival);
                        const y2 = stationToY(stop.station_seq);

                        return (
                          <Tooltip key={`pline-${pTrain.train_id}-${idx}`}>
                            <TooltipTrigger asChild>
                              <line
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke={PASSENGER_COLOR}
                                strokeWidth={2}
                                strokeOpacity={0.6}
                                strokeDasharray="6,4"
                                className="pointer-events-auto"
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold" style={{ color: PASSENGER_COLOR }}>
                                  <Users className="h-3 w-3 inline mr-1" />
                                  {pTrain.train_number}
                                </p>
                                <p>{prev.station_code} → {stop.station_code}</p>
                                <p className="text-muted-foreground">Passenger Train ({pTrain.direction})</p>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}

                      {/* Draw small diamonds at passenger stops */}
                      {pTrain.stops.map((stop, idx) => {
                        if (!stop.arrival) return null;
                        
                        const x = timeToX(stop.arrival);
                        const y = stationToY(stop.station_seq);

                        return (
                          <Tooltip key={`pstop-${pTrain.train_id}-${idx}`}>
                            <TooltipTrigger asChild>
                              <polygon
                                points={`${x},${y - 4} ${x + 4},${y} ${x},${y + 4} ${x - 4},${y}`}
                                fill={stop.is_halt ? PASSENGER_COLOR : 'transparent'}
                                stroke={PASSENGER_COLOR}
                                strokeWidth={1.5}
                                opacity={0.8}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm">
                                <p className="font-semibold" style={{ color: PASSENGER_COLOR }}>
                                  {pTrain.train_number}
                                </p>
                                <p>Station: {stop.station_code}</p>
                                <p>Arrival: {stop.arrival ? format(stop.arrival, 'HH:mm') : '-'}</p>
                                <p>Departure: {stop.departure ? format(stop.departure, 'HH:mm') : '-'}</p>
                                {stop.is_halt && (
                                  <p className="text-purple-400">Commercial Halt</p>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </g>
                  ))}
                </g>
              )}

              <text
                x={chartWidth / 2}
                y={chartHeight - 10}
                textAnchor="middle"
                className="fill-foreground text-xs font-medium"
              >
                Time
              </text>
              <text
                x={15}
                y={chartHeight / 2}
                textAnchor="middle"
                transform={`rotate(-90, 15, ${chartHeight / 2})`}
                className="fill-foreground text-xs font-medium"
              >
                Stations
              </text>
            </svg>
          </TooltipProvider>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs">
          {compareMode ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-1 rounded" style={{ backgroundColor: COMPARE_COLORS[0] }} />
                <span>{compareTrain1 || 'Train 1'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-1 rounded" style={{ backgroundColor: COMPARE_COLORS[1] }} />
                <span>{compareTrain2 || 'Train 2'}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5">
              <div className="w-6 h-0.5 bg-green-500" />
              <span>Train Path</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Station Stop</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3.5 h-3.5 rounded-full bg-amber-500" />
            <span>Long Halt (&gt;10 min)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span>Stoppage (&gt;30 min)</span>
          </div>
          {showPassengerTrains && (
            <>
              <div className="border-l border-border/50 h-4 mx-2" />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-0.5 border-t-2 border-dashed" style={{ borderColor: PASSENGER_COLOR }} />
                <span style={{ color: PASSENGER_COLOR }}>Passenger Train</span>
              </div>
              <div className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <polygon points="6,2 10,6 6,10 2,6" fill={PASSENGER_COLOR} />
                </svg>
                <span className="text-muted-foreground">Passenger Halt</span>
              </div>
              {conflicts.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-dashed border-red-300" />
                  <span className="text-red-500">Conflict</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Conflicts Summary Panel */}
        {showPassengerTrains && conflicts.length > 0 && (
          <div className="mt-4 p-3 border border-red-500/30 rounded-lg bg-red-500/5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="font-semibold text-red-500">
                {conflicts.length} Freight-Passenger Conflict{conflicts.length > 1 ? 's' : ''} Detected
              </span>
            </div>
            <ScrollArea className="max-h-[150px]">
              <div className="space-y-2">
                {conflicts.slice(0, 10).map((conflict) => (
                  <div 
                    key={conflict.id}
                    className="flex items-center justify-between text-xs p-2 rounded bg-background/50 border border-red-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="font-mono text-foreground">{conflict.freightLoadId.slice(0, 15)}</span>
                        <span className="text-muted-foreground mx-2">×</span>
                        <span className="font-mono" style={{ color: PASSENGER_COLOR }}>{conflict.passengerTrainNumber}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-muted-foreground">
                      <span>@ {conflict.stationCode}</span>
                      <span className="text-red-400 font-medium">{conflict.overlapMinutes}m overlap</span>
                    </div>
                  </div>
                ))}
                {conflicts.length > 10 && (
                  <div className="text-xs text-muted-foreground text-center py-2">
                    +{conflicts.length - 10} more conflicts...
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Selected train details - only show when not in compare mode */}
        {!compareMode && selectedTrain && (
          <div className="mt-4 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Train className="h-4 w-4" />
                <span className="font-mono font-semibold">{selectedTrain}</span>
                {trainPaths.find(tp => tp.load_id === selectedTrain) && (
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: trainPaths.find(tp => tp.load_id === selectedTrain)?.color }}
                  />
                )}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedTrain(null)}>
                Clear Selection
              </Button>
            </div>
            {trainPaths.find(tp => tp.load_id === selectedTrain) && (
              <div className="mt-2 text-sm text-muted-foreground">
                {trainPaths.find(tp => tp.load_id === selectedTrain)!.movements.length} station stops
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
