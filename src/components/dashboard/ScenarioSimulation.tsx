import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FlaskConical, Play, RotateCcw, Clock, TrendingUp, AlertTriangle,
  CheckCircle2, X, Zap, Timer, Route, MapPin, Ban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { useLogAction } from '@/hooks/useAuditLog';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { toast } from 'sonner';
import { useRouteStations } from '@/hooks/useFreightData';
import { supabase } from '@/integrations/supabase/client';

interface ScenarioSimulationProps {
  onClose?: () => void;
}

interface SimulationResult {
  scenario: string;
  impact: {
    delayReduction: number;
    throughputChange: number;
    trainsAffected: number;
  };
  recommendation: string;
  confidence: number;
}

const disruptionTypes = [
  { value: 'block', label: 'Block Section', description: 'Complete track blockage', icon: Ban },
  { value: 'speed_restriction', label: 'Speed Restriction', description: 'Reduced speed zone', icon: Zap },
  { value: 'signal_failure', label: 'Signal Failure', description: 'Signal malfunction', icon: AlertTriangle },
  { value: 'maintenance', label: 'Maintenance Block', description: 'Scheduled maintenance', icon: Timer },
  { value: 'congestion', label: 'Congestion', description: 'Heavy traffic buildup', icon: Route },
];

const severityLevels = [
  { value: 'low', label: 'Low', color: 'text-success' },
  { value: 'medium', label: 'Medium', color: 'text-warning' },
  { value: 'high', label: 'High', color: 'text-destructive' },
  { value: 'critical', label: 'Critical', color: 'text-destructive' },
];

export const ScenarioSimulation = ({ onClose }: ScenarioSimulationProps) => {
  const { stations, loading: stationsLoading } = useRouteStations();
  const [selectedStation, setSelectedStation] = useState<string>('');
  const [selectedStation2, setSelectedStation2] = useState<string>('');
  const [disruptionType, setDisruptionType] = useState<string>('');
  const [severity, setSeverity] = useState<string>('high');
  const [duration, setDuration] = useState(30);
  const [maxSpeed, setMaxSpeed] = useState(30);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const { logAction } = useLogAction();
  const { playSound } = useNotificationSound();

  const runSimulation = () => {
    if (!selectedStation || !disruptionType) return;

    setIsSimulating(true);
    setResult(null);

    const station = stations.find(s => s.station_code === selectedStation);

    // Simulate AI processing
    setTimeout(() => {
      const mockResults: Record<string, SimulationResult> = {
        block: {
          scenario: 'Block Section',
          impact: {
            delayReduction: -Math.floor(15 + Math.random() * 20),
            throughputChange: -Math.floor(30 + Math.random() * 20),
            trainsAffected: Math.floor(5 + Math.random() * 10),
          },
          recommendation: `Complete block at ${station?.station_name || selectedStation} will affect ${Math.floor(5 + Math.random() * 10)} trains. Recommend diverting freight via loop lines and holding passenger trains at previous stations.`,
          confidence: Math.floor(85 + Math.random() * 10),
        },
        speed_restriction: {
          scenario: 'Speed Restriction',
          impact: {
            delayReduction: -Math.floor(5 + Math.random() * 10),
            throughputChange: -Math.floor(10 + Math.random() * 15),
            trainsAffected: Math.floor(8 + Math.random() * 12),
          },
          recommendation: `Speed restriction to ${maxSpeed} km/h at ${station?.station_name || selectedStation} will add ~${Math.floor(3 + Math.random() * 5)} min delay per train. Consider adjusting upstream departures.`,
          confidence: Math.floor(82 + Math.random() * 12),
        },
        signal_failure: {
          scenario: 'Signal Failure',
          impact: {
            delayReduction: -Math.floor(20 + Math.random() * 15),
            throughputChange: -Math.floor(40 + Math.random() * 20),
            trainsAffected: Math.floor(10 + Math.random() * 8),
          },
          recommendation: `Signal failure at ${station?.station_name || selectedStation} requires manual authority. All trains must follow T/A 912 protocol. Estimated recovery: ${Math.floor(30 + Math.random() * 30)} min.`,
          confidence: Math.floor(75 + Math.random() * 10),
        },
        maintenance: {
          scenario: 'Maintenance Block',
          impact: {
            delayReduction: -Math.floor(10 + Math.random() * 10),
            throughputChange: -Math.floor(20 + Math.random() * 15),
            trainsAffected: Math.floor(6 + Math.random() * 6),
          },
          recommendation: `Planned maintenance at ${station?.station_name || selectedStation} for ${duration} min. Pre-schedule freight trains to clear section before block. ${Math.floor(2 + Math.random() * 3)} express trains need rescheduling.`,
          confidence: Math.floor(90 + Math.random() * 8),
        },
        congestion: {
          scenario: 'Congestion',
          impact: {
            delayReduction: -Math.floor(8 + Math.random() * 8),
            throughputChange: -Math.floor(15 + Math.random() * 10),
            trainsAffected: Math.floor(12 + Math.random() * 8),
          },
          recommendation: `Heavy congestion at ${station?.station_name || selectedStation}. Hold low-priority freight at loops, prioritize express trains. Consider temporary speed increase on approach sections.`,
          confidence: Math.floor(80 + Math.random() * 10),
        },
      };

      setResult(mockResults[disruptionType] || mockResults.block);
      setIsSimulating(false);
      playSound('info');
      
      logAction('simulation', 'scenario', 
        `Ran ${disruptionType} simulation for station ${station?.station_name || selectedStation}`,
        selectedStation, { disruptionType, severity, result: mockResults[disruptionType]?.impact });
    }, 2000);
  };

  const applyDisruption = async () => {
    if (!selectedStation || !disruptionType) return;

    setIsApplying(true);
    const station = stations.find(s => s.station_code === selectedStation);

    try {
      const { error } = await supabase.from('disruptions').insert({
        station_code: selectedStation,
        disruption_type: disruptionType,
        severity: severity,
        is_active: true,
        max_speed_allowed: disruptionType === 'speed_restriction' ? maxSpeed : null,
        description: `${disruptionType} at ${station?.station_name || selectedStation} - Simulation applied`,
        affected_direction: 'BOTH',
      });

      if (error) throw error;

      playSound('warning');
      toast.success(`Disruption applied at ${station?.station_name || selectedStation}`, {
        description: 'Chart will update in real-time',
      });

      logAction('apply_disruption', 'disruption',
        `Applied ${disruptionType} disruption at ${station?.station_name || selectedStation}`,
        selectedStation, { disruptionType, severity });

      resetSimulation();
    } catch (err) {
      console.error('Error applying disruption:', err);
      toast.error('Failed to apply disruption');
    } finally {
      setIsApplying(false);
    }
  };

  const resetSimulation = () => {
    setSelectedStation('');
    setSelectedStation2('');
    setDisruptionType('');
    setSeverity('high');
    setResult(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-card border border-border rounded-lg overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-md bg-accent/20 border border-accent/30">
            <FlaskConical className="w-4 h-4 text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">What-If Simulation</h3>
            <p className="text-xs text-muted-foreground">Analyze disruption scenarios by station</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Station Selection */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              Primary Station
            </label>
            <Select value={selectedStation} onValueChange={setSelectedStation}>
              <SelectTrigger className="h-9 bg-muted border-border">
                <SelectValue placeholder="Select station" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {stationsLoading ? (
                  <SelectItem value="loading" disabled>Loading stations...</SelectItem>
                ) : (
                  stations.map(station => (
                    <SelectItem key={station.station_code} value={station.station_code}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{station.station_code}</span>
                        <span>{station.station_name}</span>
                        {station.is_junction && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/20 text-accent">JN</span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              End Station (Optional)
            </label>
            <Select value={selectedStation2} onValueChange={setSelectedStation2}>
              <SelectTrigger className="h-9 bg-muted border-border">
                <SelectValue placeholder="Select end station" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {stations.filter(s => s.station_code !== selectedStation).map(station => (
                  <SelectItem key={station.station_code} value={station.station_code}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{station.station_code}</span>
                      <span>{station.station_name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Disruption Type */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Disruption Type</label>
          <div className="grid grid-cols-2 gap-2">
            {disruptionTypes.map(d => (
              <button
                key={d.value}
                onClick={() => setDisruptionType(d.value)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  disruptionType === d.value
                    ? 'bg-destructive/10 border-destructive/30 ring-1 ring-destructive/20'
                    : 'bg-muted/50 border-border hover:border-muted-foreground/30'
                )}
              >
                <div className="flex items-center gap-2">
                  <d.icon className={cn('w-3.5 h-3.5', disruptionType === d.value ? 'text-destructive' : 'text-muted-foreground')} />
                  <p className="text-xs font-medium text-foreground">{d.label}</p>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{d.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Severity Selection */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Severity Level</label>
          <div className="flex gap-2">
            {severityLevels.map(s => (
              <button
                key={s.value}
                onClick={() => setSeverity(s.value)}
                className={cn(
                  'flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all',
                  severity === s.value
                    ? 'bg-primary/10 border-primary/30 text-foreground'
                    : 'bg-muted/50 border-border text-muted-foreground hover:border-muted-foreground/30'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Additional Parameters */}
        {disruptionType === 'speed_restriction' && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Maximum Speed Allowed</label>
              <span className="text-xs font-mono text-foreground">{maxSpeed} km/h</span>
            </div>
            <Slider
              value={[maxSpeed]}
              onValueChange={(v) => setMaxSpeed(v[0])}
              min={10}
              max={80}
              step={5}
            />
          </div>
        )}

        {disruptionType === 'maintenance' && (
          <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Block Duration</label>
              <span className="text-xs font-mono text-foreground">{duration} min</span>
            </div>
            <Slider
              value={[duration]}
              onValueChange={(v) => setDuration(v[0])}
              min={15}
              max={180}
              step={15}
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={runSimulation}
            disabled={!selectedStation || !disruptionType || isSimulating}
            className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground"
          >
            {isSimulating ? (
              <>
                <div className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin mr-2" />
                Simulating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Run Simulation
              </>
            )}
          </Button>
          <Button variant="outline" onClick={resetSimulation} className="border-border">
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Results */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3"
            >
              <div className="h-px bg-border" />
              
              {/* Impact Metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-center">
                  <Clock className="w-4 h-4 text-destructive mx-auto mb-1" />
                  <p className="text-lg font-bold text-destructive font-mono">{result.impact.delayReduction}</p>
                  <p className="text-[10px] text-muted-foreground">Min Delay</p>
                </div>
                <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-center">
                  <TrendingUp className="w-4 h-4 text-warning mx-auto mb-1" />
                  <p className="text-lg font-bold text-warning font-mono">{result.impact.throughputChange}%</p>
                  <p className="text-[10px] text-muted-foreground">Throughput</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 text-center">
                  <AlertTriangle className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-lg font-bold text-primary font-mono">{result.impact.trainsAffected}</p>
                  <p className="text-[10px] text-muted-foreground">Trains Affected</p>
                </div>
              </div>

              {/* AI Recommendation */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs text-foreground">{result.recommendation}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${result.confidence}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {result.confidence}% confidence
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Apply Button */}
              <Button 
                className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                onClick={applyDisruption}
                disabled={isApplying}
              >
                {isApplying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-destructive-foreground/30 border-t-destructive-foreground rounded-full animate-spin mr-2" />
                    Applying...
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Apply Disruption to Chart
                  </>
                )}
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">
                This will add a real disruption that appears on the Distance-Time chart in real-time
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
