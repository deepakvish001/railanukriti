import { useEffect, useRef, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet-async';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Train, MapPin, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Station {
  station_code: string;
  station_name: string;
  latitude: number;
  longitude: number;
  cumulative_distance_km: number | null;
  seq_no: number;
  is_junction: boolean;
  no_of_tracks: number;
}

interface TrainPosition {
  load_id: string;
  station_code: string;
  speed: number;
  commodity: string | null;
  source_station: string;
  destination_station: string;
  latitude: number;
  longitude: number;
  direction: 'UP' | 'DN';
}

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const trainMarkersRef = useRef<{ [key: string]: mapboxgl.Marker }>({});
  const [stations, setStations] = useState<Station[]>([]);
  const [trainPositions, setTrainPositions] = useState<TrainPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const navigate = useNavigate();

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data.token);
      } catch (error) {
        console.error('Failed to fetch Mapbox token:', error);
      }
    };
    fetchToken();
  }, []);

  // Fetch stations data
  useEffect(() => {
    const fetchStations = async () => {
      const { data, error } = await supabase
        .from('route_stations')
        .select('station_code, station_name, latitude, longitude, cumulative_distance_km, seq_no, is_junction, no_of_tracks')
        .not('latitude', 'is', null)
        .order('seq_no');
      
      if (!error && data) {
        setStations(data as Station[]);
      }
      setLoading(false);
    };
    fetchStations();
  }, []);

  // Fetch train positions from freight_movements
  const fetchTrainPositions = useCallback(async () => {
    if (stations.length === 0) return;

    // Get the most recent movement for each train
    const { data, error } = await supabase
      .from('freight_movements')
      .select(`
        load_id,
        station_code,
        speed,
        arrival_time,
        departure_time,
        freight_trains!inner(commodity, source_station, destination_station)
      `)
      .order('arrival_time', { ascending: false });

    if (error || !data) return;

    // Get unique trains with their latest position
    const trainMap: { [key: string]: any } = {};
    data.forEach((movement: any) => {
      if (!trainMap[movement.load_id]) {
        trainMap[movement.load_id] = movement;
      }
    });

    // Map to train positions with coordinates
    const positions: TrainPosition[] = [];
    Object.values(trainMap).forEach((movement) => {
      const station = stations.find(s => s.station_code === movement.station_code);
      if (station && station.latitude && station.longitude) {
        // Determine direction based on source/destination
        const sourceStation = stations.find(s => s.station_code === movement.freight_trains?.source_station);
        const destStation = stations.find(s => s.station_code === movement.freight_trains?.destination_station);
        const direction = (destStation?.seq_no || 0) > (sourceStation?.seq_no || 0) ? 'UP' : 'DN';

        positions.push({
          load_id: movement.load_id,
          station_code: movement.station_code,
          speed: movement.speed || 0,
          commodity: movement.freight_trains?.commodity,
          source_station: movement.freight_trains?.source_station || '',
          destination_station: movement.freight_trains?.destination_station || '',
          latitude: station.latitude,
          longitude: station.longitude,
          direction
        });
      }
    });

    setTrainPositions(positions.slice(0, 20)); // Show max 20 trains
  }, [stations]);

  useEffect(() => {
    if (stations.length > 0) {
      fetchTrainPositions();
    }
  }, [stations, fetchTrainPositions]);

  // Real-time subscription for freight movements
  useEffect(() => {
    const channel = supabase
      .channel('freight-movements-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'freight_movements'
        },
        () => {
          fetchTrainPositions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTrainPositions]);

  // Simulate train movement
  useEffect(() => {
    if (!isSimulating || trainPositions.length === 0 || stations.length === 0) return;

    const interval = setInterval(() => {
      setTrainPositions(prev => prev.map(train => {
        const currentStationIdx = stations.findIndex(s => s.station_code === train.station_code);
        if (currentStationIdx === -1) return train;

        // Move to next station based on direction
        let nextIdx = train.direction === 'UP' ? currentStationIdx + 1 : currentStationIdx - 1;
        
        // Wrap around or reverse direction
        if (nextIdx >= stations.length) {
          nextIdx = stations.length - 2;
          train.direction = 'DN';
        } else if (nextIdx < 0) {
          nextIdx = 1;
          train.direction = 'UP';
        }

        const nextStation = stations[nextIdx];
        if (!nextStation) return train;

        return {
          ...train,
          station_code: nextStation.station_code,
          latitude: nextStation.latitude,
          longitude: nextStation.longitude,
          speed: Math.floor(Math.random() * 40) + 20
        };
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [isSimulating, stations]);

  // Update train markers on map
  useEffect(() => {
    if (!map.current) return;

    trainPositions.forEach(train => {
      const existingMarker = trainMarkersRef.current[train.load_id];
      
      if (existingMarker) {
        // Update existing marker position with animation
        existingMarker.setLngLat([train.longitude, train.latitude]);
      } else {
        // Create new train marker
        const el = document.createElement('div');
        el.className = 'train-marker-element';
        el.innerHTML = `
          <div style="
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.3s;
            animation: trainPulse 2s ease-in-out infinite;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
          </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
          @keyframes trainPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
        `;
        document.head.appendChild(style);

        const marker = new mapboxgl.Marker(el)
          .setLngLat([train.longitude, train.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 12px; font-family: sans-serif; min-width: 180px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <div style="width: 10px; height: 10px; background: #f59e0b; border-radius: 50%;"></div>
                    <strong style="font-size: 13px; color: #1e3a8a;">Freight Train</strong>
                  </div>
                  <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
                    <b>Load ID:</b> ${train.load_id.substring(0, 15)}...
                  </div>
                  <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
                    <b>Current:</b> ${train.station_code}
                  </div>
                  <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">
                    <b>Route:</b> ${train.source_station} → ${train.destination_station}
                  </div>
                  ${train.commodity ? `<div style="font-size: 11px; color: #64748b; margin-bottom: 4px;"><b>Commodity:</b> ${train.commodity}</div>` : ''}
                  <div style="display: flex; align-items: center; gap: 4px; margin-top: 8px; padding: 4px 8px; background: #f0fdf4; border-radius: 4px;">
                    <span style="font-size: 12px; font-weight: 600; color: #16a34a;">${train.speed} km/h</span>
                    <span style="font-size: 10px; color: #64748b;">• ${train.direction}</span>
                  </div>
                </div>
              `)
          )
          .addTo(map.current!);

        trainMarkersRef.current[train.load_id] = marker;
      }
    });

    // Remove markers for trains that no longer exist
    Object.entries(trainMarkersRef.current).forEach(([loadId, marker]) => {
      if (!trainPositions.find(t => t.load_id === loadId)) {
        marker.remove();
        delete trainMarkersRef.current[loadId];
      }
    });
  }, [trainPositions]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || stations.length === 0) return;

    mapboxgl.accessToken = mapboxToken;

    const avgLat = stations.reduce((sum, s) => sum + s.latitude, 0) / stations.length;
    const avgLng = stations.reduce((sum, s) => sum + s.longitude, 0) / stations.length;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/light-v11',
      center: [avgLng, avgLat],
      zoom: 8,
      pitch: 30,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.current.on('load', () => {
      if (!map.current) return;

      const routeCoordinates = stations.map(s => [s.longitude, s.latitude]);

      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates
          }
        }
      });

      // Route background (thicker, lighter)
      map.current.addLayer({
        id: 'route-background',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#94a3b8',
          'line-width': 8,
          'line-opacity': 0.5
        }
      });

      // Route line (main track)
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2563eb',
          'line-width': 4,
          'line-opacity': 0.9
        }
      });

      // Add station markers
      stations.forEach((station) => {
        const el = document.createElement('div');
        el.style.cssText = `
          width: ${station.is_junction ? '20px' : '14px'};
          height: ${station.is_junction ? '20px' : '14px'};
          background-color: ${station.is_junction ? '#dc2626' : '#2563eb'};
          border: 3px solid white;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          transition: transform 0.2s;
        `;
        el.addEventListener('mouseenter', () => el.style.transform = 'scale(1.3)');
        el.addEventListener('mouseleave', () => el.style.transform = 'scale(1)');
        el.addEventListener('click', () => setSelectedStation(station));

        new mapboxgl.Marker(el)
          .setLngLat([station.longitude, station.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 8px; font-family: sans-serif;">
                  <strong style="font-size: 14px; color: #1e3a8a;">${station.station_name}</strong>
                  <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Code: ${station.station_code}</div>
                  <div style="font-size: 12px; color: #64748b;">Distance: ${station.cumulative_distance_km?.toFixed(1) ?? 0} km</div>
                  ${station.is_junction ? '<div style="font-size: 11px; color: #dc2626; font-weight: 600; margin-top: 4px;">⚡ Junction</div>' : ''}
                </div>
              `)
          )
          .addTo(map.current!);
      });

      const bounds = new mapboxgl.LngLatBounds();
      stations.forEach(s => bounds.extend([s.longitude, s.latitude]));
      map.current.fitBounds(bounds, { padding: 60 });
    });

    return () => {
      Object.values(trainMarkersRef.current).forEach(marker => marker.remove());
      trainMarkersRef.current = {};
      map.current?.remove();
    };
  }, [mapboxToken, stations]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Route Map | RailAnukriti</title>
        <meta name="description" content="Interactive map showing Kottavalasa to Palasa railway route with real-time train positions." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-10 p-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <Button 
              variant="secondary" 
              onClick={() => navigate('/freight-analysis')}
              className="gap-2 bg-card/90 backdrop-blur-sm shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>
            
            <Card className="px-4 py-2 bg-card/90 backdrop-blur-sm">
              <h1 className="text-lg font-bold text-primary">
                Kottavalasa → Palasa Route Map
              </h1>
              <p className="text-xs text-muted-foreground">
                {stations.length} stations • {trainPositions.length} active trains
              </p>
            </Card>

            <div className="flex gap-2">
              <Button
                variant={isSimulating ? "default" : "outline"}
                onClick={() => setIsSimulating(!isSimulating)}
                className="gap-2 bg-card/90 backdrop-blur-sm shadow-lg"
              >
                <Train className="w-4 h-4" />
                {isSimulating ? 'Stop Simulation' : 'Simulate'}
              </Button>
              <Button
                variant="outline"
                onClick={fetchTrainPositions}
                className="gap-2 bg-card/90 backdrop-blur-sm shadow-lg"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>
        </header>

        {/* Map Container */}
        <div ref={mapContainer} className="w-full h-screen" />

        {/* Train List Panel */}
        <Card className="absolute bottom-4 left-4 w-80 max-h-[400px] overflow-hidden bg-card/95 backdrop-blur-sm shadow-xl">
          <div className="p-3 border-b border-border bg-muted/50">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Train className="w-4 h-4 text-warning" />
              Active Trains ({trainPositions.length})
            </h3>
          </div>
          <div className="overflow-y-auto max-h-[320px]">
            {trainPositions.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No active trains. Click "Simulate" to see trains moving.
              </div>
            ) : (
              trainPositions.map((train) => (
                <button
                  key={train.load_id}
                  onClick={() => {
                    map.current?.flyTo({
                      center: [train.longitude, train.latitude],
                      zoom: 12,
                      duration: 1500
                    });
                  }}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/50 text-left"
                >
                  <div className="w-3 h-3 rounded-full bg-warning flex-shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {train.load_id.substring(0, 18)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {train.station_code} • {train.speed} km/h • {train.direction}
                    </p>
                  </div>
                  {train.commodity && (
                    <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-medium">
                      {train.commodity}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </Card>

        {/* Legend */}
        <Card className="absolute bottom-4 right-4 p-3 bg-card/95 backdrop-blur-sm shadow-xl">
          <h4 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Legend</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary border-2 border-white shadow" />
              <span className="text-xs text-foreground">Station</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-destructive border-2 border-white shadow" />
              <span className="text-xs text-foreground">Junction</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-warning border-2 border-white shadow animate-pulse" />
              <span className="text-xs text-foreground">Freight Train</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 rounded bg-primary" />
              <span className="text-xs text-foreground">Route Line</span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};

export default Map;
