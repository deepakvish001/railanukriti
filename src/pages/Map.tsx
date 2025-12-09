import { useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Train, MapPin, Loader2 } from 'lucide-react';
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

const Map = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const navigate = useNavigate();

  // Fetch Mapbox token from edge function
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

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken || stations.length === 0) return;

    mapboxgl.accessToken = mapboxToken;

    // Calculate center of the route
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

      // Create route line coordinates
      const routeCoordinates = stations.map(s => [s.longitude, s.latitude]);

      // Add route line
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
          'line-opacity': 0.8
        }
      });

      // Add stations as markers
      stations.forEach((station) => {
        const el = document.createElement('div');
        el.className = 'station-marker';
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
        el.addEventListener('mouseenter', () => {
          el.style.transform = 'scale(1.3)';
        });
        el.addEventListener('mouseleave', () => {
          el.style.transform = 'scale(1)';
        });
        el.addEventListener('click', () => {
          setSelectedStation(station);
        });

        new mapboxgl.Marker(el)
          .setLngLat([station.longitude, station.latitude])
          .setPopup(
            new mapboxgl.Popup({ offset: 25 })
              .setHTML(`
                <div style="padding: 8px; font-family: sans-serif;">
                  <strong style="font-size: 14px; color: #1e3a8a;">${station.station_name}</strong>
                  <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
                    Code: ${station.station_code}
                  </div>
                  <div style="font-size: 12px; color: #64748b;">
                    Distance: ${station.cumulative_distance_km?.toFixed(1) ?? 0} km
                  </div>
                  ${station.is_junction ? '<div style="font-size: 11px; color: #dc2626; font-weight: 600; margin-top: 4px;">⚡ Junction</div>' : ''}
                </div>
              `)
          )
          .addTo(map.current!);
      });

      // Fit bounds to show all stations
      const bounds = new mapboxgl.LngLatBounds();
      stations.forEach(s => bounds.extend([s.longitude, s.latitude]));
      map.current.fitBounds(bounds, { padding: 60 });
    });

    return () => {
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
        <meta name="description" content="Interactive map showing Kottavalasa to Palasa railway route with all stations." />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-10 p-4">
          <div className="flex items-center justify-between">
            <Button 
              variant="secondary" 
              onClick={() => navigate('/freight-analysis')}
              className="gap-2 bg-card/90 backdrop-blur-sm shadow-lg"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Analysis
            </Button>
            
            <Card className="px-4 py-2 bg-card/90 backdrop-blur-sm">
              <h1 className="text-lg font-bold text-primary">
                Kottavalasa → Palasa Route Map
              </h1>
              <p className="text-xs text-muted-foreground">
                {stations.length} stations • 176.83 km total distance
              </p>
            </Card>
          </div>
        </header>

        {/* Map Container */}
        <div ref={mapContainer} className="w-full h-screen" />

        {/* Station List Panel */}
        <Card className="absolute bottom-4 left-4 w-80 max-h-[400px] overflow-hidden bg-card/95 backdrop-blur-sm shadow-xl">
          <div className="p-3 border-b border-border bg-muted/50">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-primary" />
              Stations ({stations.length})
            </h3>
          </div>
          <div className="overflow-y-auto max-h-[320px]">
            {stations.map((station, index) => (
              <button
                key={station.station_code}
                onClick={() => {
                  setSelectedStation(station);
                  map.current?.flyTo({
                    center: [station.longitude, station.latitude],
                    zoom: 12,
                    duration: 1500
                  });
                }}
                className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-muted/50 transition-colors border-b border-border/50 text-left ${
                  selectedStation?.station_code === station.station_code ? 'bg-primary/10' : ''
                }`}
              >
                <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                  station.is_junction ? 'bg-destructive' : 'bg-primary'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {station.station_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {station.station_code} • {station.cumulative_distance_km?.toFixed(1) ?? 0} km
                  </p>
                </div>
                {station.is_junction && (
                  <span className="text-[10px] px-1.5 py-0.5 bg-destructive/10 text-destructive rounded font-medium">
                    JN
                  </span>
                )}
              </button>
            ))}
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
