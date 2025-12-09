import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Plus, X, MapPin, Clock, AlertCircle } from 'lucide-react';
import { useDisruptions, useRouteBlockSections, useRouteStations } from '@/hooks/useFreightData';
import { format } from 'date-fns';

const DISRUPTION_TYPES = [
  { value: 'block', label: 'Complete Block', color: 'bg-red-500' },
  { value: 'speed_restriction', label: 'Speed Restriction', color: 'bg-amber-500' },
  { value: 'signal_failure', label: 'Signal Failure', color: 'bg-orange-500' },
  { value: 'accident', label: 'Accident', color: 'bg-red-600' },
  { value: 'maintenance', label: 'Maintenance', color: 'bg-blue-500' },
];

const SEVERITY_LEVELS = [
  { value: 'low', label: 'Low', color: 'bg-green-500' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
];

export function DisruptionManager() {
  const { disruptions, addDisruption, resolveDisruption, loading } = useDisruptions();
  const { sections } = useRouteBlockSections();
  const { stations } = useRouteStations();
  
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    block_section_code: '',
    station_code: '',
    disruption_type: 'block',
    severity: 'high',
    description: '',
    affected_direction: 'BOTH',
    max_speed_allowed: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await addDisruption({
        block_section_code: formData.block_section_code || null,
        station_code: formData.station_code || null,
        disruption_type: formData.disruption_type,
        severity: formData.severity,
        description: formData.description || null,
        start_time: new Date().toISOString(),
        end_time: null,
        is_active: true,
        affected_direction: formData.affected_direction,
        max_speed_allowed: formData.disruption_type === 'speed_restriction' ? formData.max_speed_allowed : null,
      });
      
      setShowForm(false);
      setFormData({
        block_section_code: '',
        station_code: '',
        disruption_type: 'block',
        severity: 'high',
        description: '',
        affected_direction: 'BOTH',
        max_speed_allowed: 0,
      });
    } catch (error) {
      // Error already handled in hook
    }
  };

  const getSeverityBadge = (severity: string) => {
    const level = SEVERITY_LEVELS.find(l => l.value === severity);
    return (
      <Badge className={`${level?.color || 'bg-gray-500'} text-white`}>
        {level?.label || severity}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const disruption = DISRUPTION_TYPES.find(t => t.value === type);
    return (
      <Badge variant="outline" className="border-current">
        {disruption?.label || type}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Active Disruptions
            {disruptions.length > 0 && (
              <Badge variant="destructive">{disruptions.length}</Badge>
            )}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            variant={showForm ? 'outline' : 'destructive'}
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showForm ? 'Cancel' : 'Add Disruption'}
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-4 p-4 border rounded-lg bg-background space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Block Section</Label>
                  <Select
                    value={formData.block_section_code || "none"}
                    onValueChange={(v) => setFormData({ ...formData, block_section_code: v === "none" ? "" : v, station_code: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select block section" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.block_section_code || `section-${section.id}`}>
                          {section.block_section_code} ({section.distance_km} km)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Or Station</Label>
                  <Select
                    value={formData.station_code || "none"}
                    onValueChange={(v) => setFormData({ ...formData, station_code: v === "none" ? "" : v, block_section_code: '' })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select station" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {stations.map((station) => (
                        <SelectItem key={station.id} value={station.station_code || `station-${station.id}`}>
                          {station.station_code} - {station.station_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Disruption Type</Label>
                  <Select
                    value={formData.disruption_type}
                    onValueChange={(v) => setFormData({ ...formData, disruption_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISRUPTION_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Severity</Label>
                  <Select
                    value={formData.severity}
                    onValueChange={(v) => setFormData({ ...formData, severity: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITY_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Direction Affected</Label>
                  <Select
                    value={formData.affected_direction}
                    onValueChange={(v) => setFormData({ ...formData, affected_direction: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UP">UP Only</SelectItem>
                      <SelectItem value="DN">DOWN Only</SelectItem>
                      <SelectItem value="BOTH">Both Directions</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.disruption_type === 'speed_restriction' && (
                <div className="space-y-2">
                  <Label>Max Speed Allowed (km/h)</Label>
                  <Input
                    type="number"
                    value={formData.max_speed_allowed}
                    onChange={(e) => setFormData({ ...formData, max_speed_allowed: parseInt(e.target.value) || 0 })}
                    placeholder="Enter max speed"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe the disruption..."
                />
              </div>

              <Button type="submit" variant="destructive" className="w-full">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Add Disruption
              </Button>
            </form>
          )}

          {loading ? (
            <div className="text-center py-4 text-muted-foreground">Loading disruptions...</div>
          ) : disruptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No active disruptions</p>
              <p className="text-sm">All sections are clear for traffic</p>
            </div>
          ) : (
            <div className="space-y-3">
              {disruptions.map((disruption) => (
                <div
                  key={disruption.id}
                  className="flex items-center justify-between p-3 border rounded-lg bg-background"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono font-semibold">
                          {disruption.block_section_code || disruption.station_code}
                        </span>
                        {getSeverityBadge(disruption.severity)}
                        {getTypeBadge(disruption.disruption_type)}
                      </div>
                      {disruption.description && (
                        <p className="text-sm text-muted-foreground">{disruption.description}</p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        Since {format(new Date(disruption.start_time), 'dd MMM HH:mm')}
                        {disruption.affected_direction && (
                          <Badge variant="outline" className="text-xs">
                            {disruption.affected_direction}
                          </Badge>
                        )}
                        {disruption.max_speed_allowed && (
                          <Badge variant="outline" className="text-xs">
                            Max {disruption.max_speed_allowed} km/h
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveDisruption(disruption.id)}
                  >
                    Resolve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
