import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { 
  ArrowLeft, Maximize2, Minimize2, Layers, Train, 
  Radio, ZoomIn, ZoomOut, LocateFixed, Loader2, Navigation
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTrains, useTrackSections } from '@/hooks/useRailwayData';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { Train as TrainType } from '@/types/railway';

// Track coordinates (Kanpur to Allahabad line - approximate)
const trackCoordinates: [number, number][] = [
  [80.3319, 26.4499], // Kanpur Junction
  [80.5500, 26.3800], // Bhaupur
  [80.8200, 26.3200], // Etawah region
  [81.0500, 26.2500], // Manauri
  [81.3000, 26.1800], // Fatehpur
  [81.5500, 26.1000], // Kaushambi
  [81.8000, 25.9500], // Near Allahabad
  [81.8463, 25.4358], // Allahabad Junction
];

const stations = [
  { name: 'Kanpur Junction', code: 'CNB', coords: [80.3319, 26.4499] as [number, number] },
  { name: 'Bhaupur', code: 'BHP', coords: [80.5500, 26.3800] as [number, number] },
  { name: 'Manauri', code: 'MNI', coords: [81.0500, 26.2500] as [number, number] },
  { name: 'Fatehpur', code: 'FTP', coords: [81.3000, 26.1800] as [number, number] },
  { name: 'Kaushambi', code: 'KSI', coords: [81.5500, 26.1000] as [number, number] },
  { name: 'Allahabad Junction', code: 'ALD', coords: [81.8463, 25.4358] as [number, number] },
];

const typeColors: Record<string, string> = {
  express: '#00d4ff',
  freight: '#f59e0b',
  local: '#22c55e',
  special: '#a855f7',
};

const statusColors: Record<string, string> = {
  'on-time': '#22c55e',
  delayed: '#ef4444',
  halted: '#f59e0b',
  approaching: '#00d4ff',
};

// Calculate position along track for a train
const calculateTrainPosition = (train: TrainType): { lng: number; lat: number; bearing: number } => {
  const progress = train.currentSection / 6;
  const coordIndex = Math.min(
    Math.floor(progress * (trackCoordinates.length - 1)),
    trackCoordinates.length - 2
  );
  const localProgress = (progress * (trackCoordinates.length - 1)) % 1;

  const startCoord = trackCoordinates[coordIndex];
  const endCoord = trackCoordinates[coordIndex + 1];

  const lng = startCoord[0] + (endCoord[0] - startCoord[0]) * localProgress;
  const lat = startCoord[1] + (endCoord[1] - startCoord[1]) * localProgress;
  
  // Calculate bearing for train direction
  const bearing = Math.atan2(endCoord[0] - startCoord[0], endCoord[1] - startCoord[1]) * (180 / Math.PI);

  return { lng, lat, bearing };
};

interface TrainMarkerData {
  marker: mapboxgl.Marker;
  element: HTMLDivElement;
  currentPos: { lng: number; lat: number };
  targetPos: { lng: number; lat: number };
  bearing: number;
  trail: [number, number][];
}

const Map = () => {
  const navigate = useNavigate();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const trainMarkersRef = useRef<globalThis.Map<string, TrainMarkerData>>(new globalThis.Map());
  const animationFrameRef = useRef<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapToken, setMapToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState<string | null>(null);

  const { trains } = useTrains();
  const { sections } = useTrackSections();

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error || !data?.token) {
          setTokenError(true);
          return;
        }
        setMapToken(data.token);
      } catch {
        setTokenError(true);
      }
    };
    fetchToken();
  }, []);

  // Create train marker element
  const createTrainMarkerElement = useCallback((train: TrainType, bearing: number): HTMLDivElement => {
    const el = document.createElement('div');
    el.className = 'train-marker-container cursor-pointer';
    el.style.transition = 'transform 0.1s ease-out';
    
    const isMoving = train.status !== 'halted' && train.speed > 0;
    const pulseClass = isMoving ? 'animate-ping' : '';
    
    el.innerHTML = `
      <div class="relative" style="transform: rotate(${bearing}deg)">
        <div class="absolute -inset-3 rounded-full ${pulseClass} opacity-20" style="background: ${typeColors[train.type]}"></div>
        <div class="relative w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all duration-300" 
             style="background: linear-gradient(135deg, ${typeColors[train.type]}, ${typeColors[train.type]}99); box-shadow: 0 0 25px ${typeColors[train.type]}80">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transform: rotate(-${bearing}deg)">
            <path d="M12 2L4 9l8 6 8-6-8-7z"/>
            <path d="M4 15l8 6 8-6"/>
            <path d="M4 9v6"/>
            <path d="M20 9v6"/>
          </svg>
        </div>
        <div class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-card flex items-center justify-center" 
             style="background: ${statusColors[train.status]}">
          ${train.speed > 0 ? `<span class="text-[8px] font-bold text-white">${Math.round(train.speed / 10)}</span>` : ''}
        </div>
        ${train.delay > 5 ? `
          <div class="absolute -top-1 -left-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center animate-pulse">
            <span class="text-[8px] font-bold text-white">!</span>
          </div>
        ` : ''}
      </div>
    `;
    
    return el;
  }, []);

  // Update trail visualization
  const updateTrailLayer = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    const trailFeatures = Array.from(trainMarkersRef.current.entries()).map(([id, data]) => ({
      type: 'Feature' as const,
      properties: {
        trainId: id,
        color: typeColors[trains.find(t => t.id === id)?.type || 'express']
      },
      geometry: {
        type: 'LineString' as const,
        coordinates: data.trail.length > 1 ? data.trail : [[data.currentPos.lng, data.currentPos.lat], [data.currentPos.lng, data.currentPos.lat]]
      }
    }));

    const source = map.current.getSource('train-trails') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'FeatureCollection',
        features: trailFeatures
      });
    }
  }, [mapLoaded, trains]);

  // Smooth animation loop
  const animateTrains = useCallback(() => {
    const lerp = (start: number, end: number, t: number) => start + (end - start) * t;
    
    trainMarkersRef.current.forEach((data, trainId) => {
      const lerpFactor = 0.08; // Smooth interpolation
      
      // Interpolate position
      const newLng = lerp(data.currentPos.lng, data.targetPos.lng, lerpFactor);
      const newLat = lerp(data.currentPos.lat, data.targetPos.lat, lerpFactor);
      
      // Update current position
      data.currentPos = { lng: newLng, lat: newLat };
      
      // Update marker position
      data.marker.setLngLat([newLng, newLat]);
      
      // Add to trail (limit trail length)
      if (data.trail.length === 0 || 
          Math.abs(data.trail[data.trail.length - 1][0] - newLng) > 0.001 ||
          Math.abs(data.trail[data.trail.length - 1][1] - newLat) > 0.001) {
        data.trail.push([newLng, newLat]);
        if (data.trail.length > 50) {
          data.trail.shift();
        }
      }
    });

    updateTrailLayer();
    animationFrameRef.current = requestAnimationFrame(animateTrains);
  }, [updateTrailLayer]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapToken) return;

    mapboxgl.accessToken = mapToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [81.0, 26.0],
      zoom: 8,
      pitch: 45,
      bearing: -15,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'bottom-right'
    );

    map.current.on('load', () => {
      if (!map.current) return;
      setMapLoaded(true);

      // Add track line
      map.current.addSource('track-line', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: trackCoordinates,
          },
        },
      });

      // Add train trails source
      map.current.addSource('train-trails', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: []
        }
      });

      // Track glow effect
      map.current.addLayer({
        id: 'track-line-glow',
        type: 'line',
        source: 'track-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#00d4ff',
          'line-width': 12,
          'line-opacity': 0.3,
          'line-blur': 8,
        },
      });

      // Main track line
      map.current.addLayer({
        id: 'track-line-main',
        type: 'line',
        source: 'track-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#00d4ff',
          'line-width': 4,
          'line-opacity': 0.9,
        },
      });

      // Track dashes (sleepers effect)
      map.current.addLayer({
        id: 'track-line-dashes',
        type: 'line',
        source: 'track-line',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 1,
          'line-opacity': 0.5,
          'line-dasharray': [0.5, 2],
        },
      });

      // Train trail layer with gradient effect
      map.current.addLayer({
        id: 'train-trails-layer',
        type: 'line',
        source: 'train-trails',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 3,
          'line-opacity': 0.6,
          'line-blur': 2,
        },
      });

      // Add stations
      stations.forEach((station) => {
        const el = document.createElement('div');
        el.className = 'station-marker';
        el.innerHTML = `
          <div class="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg shadow-primary/50 animate-pulse"></div>
        `;

        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
          .setHTML(`
            <div class="bg-card p-2 rounded-lg border border-border">
              <p class="font-bold text-foreground text-sm">${station.name}</p>
              <p class="text-xs text-muted-foreground font-mono">${station.code}</p>
            </div>
          `);

        new mapboxgl.Marker(el)
          .setLngLat(station.coords)
          .setPopup(popup)
          .addTo(map.current!);
      });

      // Start animation loop
      animationFrameRef.current = requestAnimationFrame(animateTrains);
    });

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      trainMarkersRef.current.forEach((data) => data.marker.remove());
      trainMarkersRef.current.clear();
      map.current?.remove();
    };
  }, [mapToken, animateTrains]);

  // Update train markers and target positions
  useEffect(() => {
    if (!map.current || !mapLoaded || trains.length === 0) return;

    const currentTrainIds = new Set(trains.map(t => t.id));
    
    // Remove markers for trains that no longer exist
    trainMarkersRef.current.forEach((data, trainId) => {
      if (!currentTrainIds.has(trainId)) {
        data.marker.remove();
        trainMarkersRef.current.delete(trainId);
      }
    });

    // Update or create markers for each train
    trains.forEach((train) => {
      const position = calculateTrainPosition(train);
      const existingData = trainMarkersRef.current.get(train.id);

      if (existingData) {
        // Update target position for smooth interpolation
        existingData.targetPos = { lng: position.lng, lat: position.lat };
        existingData.bearing = position.bearing;
        
        // Update marker element content
        const newElement = createTrainMarkerElement(train, position.bearing);
        existingData.element.innerHTML = newElement.innerHTML;
        
        // Update popup content
        existingData.marker.getPopup()?.setHTML(createPopupContent(train));
      } else {
        // Create new marker
        const element = createTrainMarkerElement(train, position.bearing);
        
        const popup = new mapboxgl.Popup({ offset: 25, closeButton: false })
          .setHTML(createPopupContent(train));

        const marker = new mapboxgl.Marker(element)
          .setLngLat([position.lng, position.lat])
          .setPopup(popup)
          .addTo(map.current!);

        element.addEventListener('click', () => {
          setSelectedTrain(train.id);
          map.current?.flyTo({
            center: [position.lng, position.lat],
            zoom: 11,
            duration: 1000
          });
        });

        trainMarkersRef.current.set(train.id, {
          marker,
          element,
          currentPos: { lng: position.lng, lat: position.lat },
          targetPos: { lng: position.lng, lat: position.lat },
          bearing: position.bearing,
          trail: [[position.lng, position.lat]]
        });
      }
    });
  }, [trains, mapLoaded, createTrainMarkerElement]);

  const createPopupContent = (train: TrainType): string => {
    return `
      <div class="bg-card p-3 rounded-lg border border-border min-w-[200px]">
        <div class="flex items-center justify-between mb-2">
          <span class="font-mono font-bold text-foreground">${train.number}</span>
          <span class="text-xs px-2 py-0.5 rounded-full" style="background: ${statusColors[train.status]}20; color: ${statusColors[train.status]}">${train.status}</span>
        </div>
        <p class="text-sm text-foreground mb-1">${train.name}</p>
        <p class="text-xs text-muted-foreground">${train.origin} → ${train.destination}</p>
        <div class="mt-2 pt-2 border-t border-border grid grid-cols-3 gap-2 text-xs">
          <div>
            <span class="text-muted-foreground">Speed</span>
            <p class="font-mono text-foreground">${train.speed} km/h</p>
          </div>
          <div>
            <span class="text-muted-foreground">Delay</span>
            <p class="font-mono" style="color: ${train.delay > 0 ? '#ef4444' : '#22c55e'}">${train.delay > 0 ? '+' : ''}${train.delay} min</p>
          </div>
          <div>
            <span class="text-muted-foreground">ETA</span>
            <p class="font-mono text-foreground">${train.eta}</p>
          </div>
        </div>
        <div class="mt-2 pt-2 border-t border-border text-xs">
          <span class="text-muted-foreground">Next Station</span>
          <p class="font-mono text-foreground">${train.nextStation}</p>
        </div>
      </div>
    `;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleZoomIn = () => map.current?.zoomIn();
  const handleZoomOut = () => map.current?.zoomOut();
  const handleResetView = () => {
    setSelectedTrain(null);
    map.current?.flyTo({
      center: [81.0, 26.0],
      zoom: 8,
      pitch: 45,
      bearing: -15,
    });
  };

  const followTrain = (trainId: string) => {
    const data = trainMarkersRef.current.get(trainId);
    if (data) {
      setSelectedTrain(trainId);
      map.current?.flyTo({
        center: [data.currentPos.lng, data.currentPos.lat],
        zoom: 12,
        duration: 1000
      });
    }
  };

  if (!mapToken && !tokenError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Train className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">Map Configuration Required</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Please ensure the Mapbox public token is configured correctly in the project secrets.
          </p>
          <Button onClick={() => navigate('/')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Track Network Map | Section Control AI</title>
      </Helmet>

      <div className="relative w-full h-screen bg-background">
        {/* Map Container */}
        <div ref={mapContainer} className="absolute inset-0" />

        {/* Overlay Controls */}
        <div className="absolute top-4 left-4 z-10">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate('/')}
              className="bg-card/90 backdrop-blur-sm border-border hover:bg-card"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            <div className="bg-card/90 backdrop-blur-sm border border-border rounded-lg px-4 py-2 flex items-center gap-3">
              <Train className="w-5 h-5 text-primary" />
              <div>
                <h1 className="text-sm font-semibold text-foreground">Track Network Map</h1>
                <p className="text-xs text-muted-foreground">Kanpur - Allahabad Section</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Right Controls */}
        <div className="absolute top-4 right-4 z-10">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-col gap-2"
          >
            <Button
              variant="outline"
              size="icon"
              onClick={toggleFullscreen}
              className="bg-card/90 backdrop-blur-sm border-border hover:bg-card"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomIn}
              className="bg-card/90 backdrop-blur-sm border-border hover:bg-card"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomOut}
              className="bg-card/90 backdrop-blur-sm border-border hover:bg-card"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleResetView}
              className="bg-card/90 backdrop-blur-sm border-border hover:bg-card"
            >
              <LocateFixed className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>

        {/* Train List Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-20 right-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-3 w-56 max-h-[400px] overflow-y-auto"
        >
          <h3 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
            <Navigation className="w-4 h-4 text-primary" />
            Track Train
          </h3>
          <div className="space-y-1">
            {trains.map((train) => (
              <button
                key={train.id}
                onClick={() => followTrain(train.id)}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors",
                  selectedTrain === train.id 
                    ? "bg-primary/20 text-primary" 
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <span 
                    className="w-2 h-2 rounded-full" 
                    style={{ background: typeColors[train.type] }}
                  />
                  <span className="font-mono font-medium">{train.number}</span>
                  <span 
                    className="ml-auto w-2 h-2 rounded-full"
                    style={{ background: statusColors[train.status] }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground truncate pl-4">{train.name}</p>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Legend */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-6 left-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg p-4"
        >
          <h3 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Legend
          </h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#00d4ff]" />
              <span className="text-xs text-muted-foreground">Express</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
              <span className="text-xs text-muted-foreground">Freight</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
              <span className="text-xs text-muted-foreground">Local</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#a855f7]" />
              <span className="text-xs text-muted-foreground">Special</span>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#22c55e]" />
              <span className="text-xs text-muted-foreground">On Time</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#ef4444]" />
              <span className="text-xs text-muted-foreground">Delayed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#f59e0b]" />
              <span className="text-xs text-muted-foreground">Halted</span>
            </div>
          </div>
        </motion.div>

        {/* Train Count Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-6 right-4 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-success animate-pulse" />
              <span className="text-xs text-muted-foreground">Live Tracking</span>
            </div>
            <div className="w-px h-4 bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-foreground font-mono">{trains.length}</p>
              <p className="text-[10px] text-muted-foreground">Active Trains</p>
            </div>
          </div>
        </motion.div>
      </div>
    </>
  );
};

export default Map;
