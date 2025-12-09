import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertTriangle, Train, MapPin } from 'lucide-react';
import { useRouteStations, useRouteBlockSections, useDisruptions } from '@/hooks/useFreightData';

export function RouteVisualization() {
  const { stations, loading: stationsLoading } = useRouteStations();
  const { sections } = useRouteBlockSections();
  const { disruptions } = useDisruptions();

  const orderedStations = useMemo(() => {
    return [...stations].sort((a, b) => a.seq_no - b.seq_no);
  }, [stations]);

  const getStationDisruption = (stationCode: string) => {
    return disruptions.find(d => 
      d.station_code === stationCode || 
      d.block_section_code?.includes(stationCode)
    );
  };

  const getSectionBetween = (fromCode: string, toCode: string) => {
    return sections.find(s => 
      (s.from_station_code === fromCode && s.to_station_code === toCode) ||
      (s.from_station_code === toCode && s.to_station_code === fromCode)
    );
  };

  const getSectionDisruption = (sectionCode: string) => {
    return disruptions.find(d => d.block_section_code === sectionCode);
  };

  if (stationsLoading || stations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {stationsLoading ? 'Loading route data...' : 'No route data available. Please import data first.'}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Train className="h-5 w-5" />
          KTV-PSA Route Visualization
          {disruptions.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {disruptions.length} Active Disruption{disruptions.length > 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto pb-4">
          <TooltipProvider>
            <div className="flex items-center min-w-max py-4">
              {orderedStations.map((station, index) => {
                const disruption = getStationDisruption(station.station_code);
                const nextStation = orderedStations[index + 1];
                const section = nextStation ? getSectionBetween(station.station_code, nextStation.station_code) : null;
                const sectionDisruption = section ? getSectionDisruption(section.block_section_code) : null;

                return (
                  <div key={station.id} className="flex items-center">
                    {/* Station marker */}
                    <Tooltip>
                      <TooltipTrigger>
                        <div className="flex flex-col items-center">
                          <div
                            className={`
                              w-4 h-4 rounded-full border-2 relative
                              ${disruption 
                                ? 'bg-red-500 border-red-600 animate-pulse' 
                                : station.is_junction 
                                  ? 'bg-blue-500 border-blue-600' 
                                  : station.is_halt
                                    ? 'bg-amber-400 border-amber-500'
                                    : 'bg-green-500 border-green-600'
                              }
                            `}
                          >
                            {disruption && (
                              <AlertTriangle className="h-3 w-3 text-white absolute -top-4 left-1/2 -translate-x-1/2" />
                            )}
                          </div>
                          <span className="text-[10px] font-mono mt-1 max-w-[50px] truncate">
                            {station.station_code}
                          </span>
                          <span className="text-[8px] text-muted-foreground">
                            {Math.round(station.cumulative_distance_km || 0)} km
                          </span>
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <div className="text-sm">
                          <p className="font-semibold">{station.station_name}</p>
                          <p className="text-muted-foreground">{station.station_code}</p>
                          <div className="flex gap-2 mt-1">
                            {station.is_junction && <Badge variant="outline">Junction</Badge>}
                            {station.is_halt && <Badge variant="outline">Halt</Badge>}
                            {station.signal_type && <Badge>{station.signal_type}</Badge>}
                          </div>
                          {disruption && (
                            <p className="text-red-500 mt-1">
                              ⚠️ {disruption.disruption_type}: {disruption.description}
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>

                    {/* Track section between stations */}
                    {nextStation && (
                      <Tooltip>
                        <TooltipTrigger>
                          <div className="flex flex-col items-center mx-1">
                            <div
                              className={`
                                h-1 rounded transition-all
                                ${sectionDisruption 
                                  ? 'bg-red-500 animate-pulse' 
                                  : section?.signal_type === 'AT' 
                                    ? 'bg-green-500' 
                                    : 'bg-amber-500'
                                }
                              `}
                              style={{ width: `${Math.max(30, (section?.distance_km || 5) * 4)}px` }}
                            />
                            <span className="text-[8px] text-muted-foreground mt-0.5">
                              {section?.distance_km?.toFixed(1) || '?'} km
                            </span>
                            <span className={`text-[8px] ${section?.signal_type === 'AT' ? 'text-green-600' : 'text-amber-600'}`}>
                              {section?.signal_type || '?'}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <div className="text-sm">
                            <p className="font-semibold">{section?.block_section_code}</p>
                            <p>{station.station_code} → {nextStation.station_code}</p>
                            <div className="flex gap-2 mt-1">
                              <Badge>{section?.signal_type}</Badge>
                              <Badge variant="outline">{section?.max_speed} km/h</Badge>
                              <Badge variant="outline">{section?.no_of_lines} lines</Badge>
                            </div>
                            {sectionDisruption && (
                              <p className="text-red-500 mt-1">
                                ⚠️ BLOCKED: {sectionDisruption.description}
                              </p>
                            )}
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span>Junction</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Station</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span>Halt</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Disrupted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-1 rounded bg-green-500" />
            <span>AT Section</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-1 rounded bg-amber-500" />
            <span>AB Section</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
