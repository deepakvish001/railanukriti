import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface TrainPosition {
  id: string;
  load_id: string;
  train_type: 'freight' | 'passenger';
  current_station: string;
  next_station: string | null;
  position_km: number;
  speed: number;
  direction: 'UP' | 'DN';
  status: 'moving' | 'stopped' | 'halted';
  commodity?: string;
  source_station?: string;
  destination_station?: string;
}

export function useTrainPositions(stationsList: { station_code: string; cumulative_distance_km: number | null; seq_no: number }[]) {
  const [trainPositions, setTrainPositions] = useState<TrainPosition[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);

  // Create a map of station distances for quick lookup
  const stationDistances = useMemo(() => {
    const map = new Map<string, number>();
    stationsList.forEach(s => {
      if (s.cumulative_distance_km !== null) {
        map.set(s.station_code, s.cumulative_distance_km);
      }
    });
    return map;
  }, [stationsList]);

  // Create station sequence map
  const stationSeq = useMemo(() => {
    const map = new Map<string, number>();
    stationsList.forEach(s => map.set(s.station_code, s.seq_no));
    return map;
  }, [stationsList]);

  // Fetch active trains from recent movements
  const fetchActiveTrains = useCallback(async () => {
    if (stationsList.length === 0) return;

    try {
      // Get recent freight movements to determine active trains
      const { data: movements, error } = await supabase
        .from('freight_movements')
        .select(`
          id,
          load_id,
          station_code,
          speed,
          arrival_time,
          departure_time,
          is_stoppage,
          freight_trains!freight_movements_freight_train_id_fkey (
            load_id,
            source_station,
            destination_station,
            commodity
          )
        `)
        .not('arrival_time', 'is', null)
        .order('arrival_time', { ascending: false })
        .limit(500);

      if (error) {
        console.error('Error fetching movements:', error);
        return;
      }

      // Group movements by load_id to find latest position of each train
      const latestByTrain = new Map<string, any>();
      movements?.forEach(m => {
        if (!latestByTrain.has(m.load_id)) {
          latestByTrain.set(m.load_id, m);
        }
      });

      // Convert to train positions
      const positions: TrainPosition[] = [];
      latestByTrain.forEach((movement, loadId) => {
        const stationDist = stationDistances.get(movement.station_code);
        const stationSeqNo = stationSeq.get(movement.station_code);
        
        if (stationDist !== undefined && stationSeqNo !== undefined) {
          // Find next station
          const nextStation = stationsList.find(s => s.seq_no === stationSeqNo + 1);
          
          // Determine direction based on source/destination
          const freightTrain = movement.freight_trains;
          const sourceSeq = freightTrain?.source_station ? stationSeq.get(freightTrain.source_station) : null;
          const destSeq = freightTrain?.destination_station ? stationSeq.get(freightTrain.destination_station) : null;
          let direction: 'UP' | 'DN' = 'UP';
          if (sourceSeq !== null && destSeq !== null && sourceSeq !== undefined && destSeq !== undefined) {
            direction = destSeq > sourceSeq ? 'UP' : 'DN';
          }

          positions.push({
            id: movement.id,
            load_id: loadId,
            train_type: 'freight',
            current_station: movement.station_code,
            next_station: nextStation?.station_code || null,
            position_km: stationDist,
            speed: movement.speed || 0,
            direction,
            status: movement.is_stoppage ? 'halted' : movement.speed > 0 ? 'moving' : 'stopped',
            commodity: freightTrain?.commodity || undefined,
            source_station: freightTrain?.source_station || undefined,
            destination_station: freightTrain?.destination_station || undefined,
          });
        }
      });

      // Limit to show only some trains for visualization
      setTrainPositions(positions.slice(0, 15));
    } catch (error) {
      console.error('Error in fetchActiveTrains:', error);
    }
  }, [stationDistances, stationSeq, stationsList]);

  // Start simulation - animate train positions
  const startSimulation = useCallback(() => {
    setIsSimulating(true);
  }, []);

  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
  }, []);

  // Animation effect
  useEffect(() => {
    if (!isSimulating || trainPositions.length === 0) return;

    const interval = setInterval(() => {
      setTrainPositions(prev => 
        prev.map(train => {
          if (train.status !== 'moving' || train.speed === 0) return train;
          
          // Calculate new position based on speed and direction
          const speedKmPerSecond = train.speed / 3600; // Convert km/h to km/s
          const deltaKm = speedKmPerSecond * 2; // 2 second interval
          
          const newPosition = train.direction === 'UP' 
            ? train.position_km + deltaKm 
            : train.position_km - deltaKm;

          // Check if reached next station
          const nextStationDist = train.next_station ? stationDistances.get(train.next_station) : null;
          if (nextStationDist !== null && nextStationDist !== undefined) {
            if ((train.direction === 'UP' && newPosition >= nextStationDist) ||
                (train.direction === 'DN' && newPosition <= nextStationDist)) {
              // Find the station after next
              const currentSeq = stationSeq.get(train.next_station);
              const afterNextStation = currentSeq !== undefined 
                ? stationsList.find(s => s.seq_no === currentSeq + (train.direction === 'UP' ? 1 : -1))
                : null;

              return {
                ...train,
                current_station: train.next_station,
                next_station: afterNextStation?.station_code || null,
                position_km: nextStationDist,
              };
            }
          }

          return { ...train, position_km: newPosition };
        })
      );
    }, 2000);

    return () => clearInterval(interval);
  }, [isSimulating, trainPositions.length, stationDistances, stationSeq, stationsList]);

  // Initial fetch
  useEffect(() => {
    fetchActiveTrains();
  }, [fetchActiveTrains]);

  return {
    trainPositions,
    isSimulating,
    startSimulation,
    stopSimulation,
    refetch: fetchActiveTrains,
  };
}
