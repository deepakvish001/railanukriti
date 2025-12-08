import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calculator, Train, ArrowRight, Gauge, TrendingUp } from "lucide-react";

interface ThroughputResult {
  baseCapacity: number;
  signalBonus: number;
  loopBonus: number;
  crossoverBonus: number;
  trackMultiplier: number;
  finalCapacity: number;
  trainsPerHour: number;
  utilizationPercent: number;
}

export const ThroughputCalculator = () => {
  const [signallingType, setSignallingType] = useState<string>("absolute");
  const [blockLength, setBlockLength] = useState<number>(10);
  const [trackCount, setTrackCount] = useState<number>(1);
  const [hasLoops, setHasLoops] = useState<boolean>(false);
  const [loopCount, setLoopCount] = useState<number>(0);
  const [hasCrossovers, setHasCrossovers] = useState<boolean>(false);
  const [currentTrains, setCurrentTrains] = useState<number>(15);

  const calculateThroughput = (): ThroughputResult => {
    // Base capacity based on signalling type
    let baseCapacity: number;
    let signalBonus = 0;

    switch (signallingType) {
      case "automatic":
        // Automatic Block: 1-2 km blocks, high capacity
        baseCapacity = 48; // Base for 2km blocks
        // Shorter blocks = higher capacity
        if (blockLength <= 1.5) {
          signalBonus = 24; // Very short blocks
        } else if (blockLength <= 2) {
          signalBonus = 12;
        }
        break;
      case "semi-automatic":
        baseCapacity = 36;
        if (blockLength <= 3) {
          signalBonus = 8;
        }
        break;
      case "absolute":
      default:
        // Absolute Block: 7-10 km blocks, low capacity
        baseCapacity = 24;
        // Longer blocks = lower capacity
        if (blockLength > 10) {
          signalBonus = -4;
        } else if (blockLength <= 5) {
          signalBonus = 4;
        }
        break;
    }

    // Loop bonus: +30% per loop for overtaking/crossing
    const loopBonus = hasLoops ? Math.round(baseCapacity * 0.15 * Math.min(loopCount, 4)) : 0;

    // Crossover bonus: +10% for operational flexibility
    const crossoverBonus = hasCrossovers ? Math.round(baseCapacity * 0.1) : 0;

    // Track multiplier
    const trackMultiplier = trackCount;
    
    // Final capacity
    const finalCapacity = Math.round((baseCapacity + signalBonus + loopBonus + crossoverBonus) * trackMultiplier);
    
    // Trains per hour (assuming 16-hour operational day)
    const trainsPerHour = Math.round((finalCapacity / 16) * 10) / 10;
    
    // Utilization
    const utilizationPercent = Math.min(100, Math.round((currentTrains / finalCapacity) * 100));

    return {
      baseCapacity,
      signalBonus,
      loopBonus,
      crossoverBonus,
      trackMultiplier,
      finalCapacity,
      trainsPerHour,
      utilizationPercent
    };
  };

  const result = calculateThroughput();

  const getUtilizationColor = (percent: number) => {
    if (percent < 50) return "text-green-500";
    if (percent < 75) return "text-amber-500";
    return "text-red-500";
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Input Panel */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Section Configuration
          </CardTitle>
          <CardDescription>
            Configure infrastructure parameters to calculate throughput
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Signalling Type */}
          <div className="space-y-2">
            <Label>Signalling System</Label>
            <Select value={signallingType} onValueChange={setSignallingType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absolute">
                  <div className="flex items-center gap-2">
                    <span>Absolute Block (AB)</span>
                    <Badge variant="secondary" className="text-xs">Low Capacity</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="semi-automatic">
                  <div className="flex items-center gap-2">
                    <span>Semi-Automatic Block</span>
                    <Badge variant="secondary" className="text-xs">Medium</Badge>
                  </div>
                </SelectItem>
                <SelectItem value="automatic">
                  <div className="flex items-center gap-2">
                    <span>Automatic Block (AT)</span>
                    <Badge className="bg-green-500/20 text-green-400 text-xs">High Capacity</Badge>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {signallingType === "absolute" && "One train per block. Block length 7-10 km. Low throughput."}
              {signallingType === "semi-automatic" && "Improved capacity with partial automation."}
              {signallingType === "automatic" && "Multiple trains can follow closely. Block length 1-2 km. High throughput."}
            </p>
          </div>

          {/* Block Length */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Block Section Length</Label>
              <span className="text-sm font-mono text-primary">{blockLength} km</span>
            </div>
            <Slider
              value={[blockLength]}
              onValueChange={(v) => setBlockLength(v[0])}
              min={1}
              max={15}
              step={0.5}
              className="py-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 km (Dense signals)</span>
              <span>15 km (Sparse signals)</span>
            </div>
          </div>

          {/* Track Count */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Number of Main Lines</Label>
              <span className="text-sm font-mono text-primary">{trackCount === 1 ? "Single" : trackCount === 2 ? "Double" : "Triple"} Line</span>
            </div>
            <Slider
              value={[trackCount]}
              onValueChange={(v) => setTrackCount(v[0])}
              min={1}
              max={3}
              step={1}
              className="py-2"
            />
            <p className="text-xs text-muted-foreground">
              Each additional line doubles capacity. Very costly but most effective.
            </p>
          </div>

          {/* Loop Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label>Loop Lines</Label>
                <p className="text-xs text-muted-foreground">For overtaking & crossing</p>
              </div>
              <Switch checked={hasLoops} onCheckedChange={setHasLoops} />
            </div>
            {hasLoops && (
              <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                <div className="flex justify-between">
                  <Label className="text-sm">Number of Loops</Label>
                  <span className="text-sm font-mono text-primary">{loopCount}</span>
                </div>
                <Slider
                  value={[loopCount]}
                  onValueChange={(v) => setLoopCount(v[0])}
                  min={1}
                  max={6}
                  step={1}
                  className="py-2"
                />
              </div>
            )}
          </div>

          {/* Crossovers */}
          <div className="flex items-center justify-between">
            <div>
              <Label>Crossovers Available</Label>
              <p className="text-xs text-muted-foreground">Track switching flexibility</p>
            </div>
            <Switch checked={hasCrossovers} onCheckedChange={setHasCrossovers} />
          </div>

          {/* Current Trains */}
          <div className="space-y-2 pt-4 border-t border-border/50">
            <div className="flex justify-between">
              <Label>Current Trains/Day</Label>
              <span className="text-sm font-mono text-primary">{currentTrains}</span>
            </div>
            <Slider
              value={[currentTrains]}
              onValueChange={(v) => setCurrentTrains(v[0])}
              min={0}
              max={100}
              step={1}
              className="py-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Panel */}
      <div className="space-y-6">
        {/* Main Result */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-primary">
              <Gauge className="h-5 w-5" />
              Calculated Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mb-4">
              <span className="text-5xl font-bold text-foreground">{result.finalCapacity}</span>
              <span className="text-xl text-muted-foreground mb-1">trains/day</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Train className="h-4 w-4 text-muted-foreground" />
                <span>{result.trainsPerHour} trains/hour</span>
              </div>
              <div className={`flex items-center gap-1 ${getUtilizationColor(result.utilizationPercent)}`}>
                <TrendingUp className="h-4 w-4" />
                <span>{result.utilizationPercent}% utilized</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Capacity Breakdown */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Capacity Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Base Capacity ({signallingType})</span>
              <span className="font-mono">{result.baseCapacity}</span>
            </div>
            
            {result.signalBonus !== 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Signal Density Bonus</span>
                <span className={`font-mono ${result.signalBonus > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {result.signalBonus > 0 ? '+' : ''}{result.signalBonus}
                </span>
              </div>
            )}
            
            {result.loopBonus > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Loop Lines Bonus ({loopCount} loops)</span>
                <span className="font-mono text-green-400">+{result.loopBonus}</span>
              </div>
            )}
            
            {result.crossoverBonus > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Crossover Flexibility</span>
                <span className="font-mono text-green-400">+{result.crossoverBonus}</span>
              </div>
            )}
            
            {result.trackMultiplier > 1 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Track Multiplier</span>
                <span className="font-mono text-blue-400">×{result.trackMultiplier}</span>
              </div>
            )}

            <div className="border-t border-border/50 pt-3 flex items-center justify-between">
              <span className="font-medium">Final Capacity</span>
              <span className="font-mono text-lg text-primary">{result.finalCapacity}</span>
            </div>
          </CardContent>
        </Card>

        {/* Utilization Gauge */}
        <Card className="bg-card/50 backdrop-blur border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Section Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{currentTrains} trains running</span>
                <span className={getUtilizationColor(result.utilizationPercent)}>
                  {result.utilizationPercent}%
                </span>
              </div>
              <Progress 
                value={result.utilizationPercent} 
                className="h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Under-utilized</span>
                <span>Optimal</span>
                <span>Congested</span>
              </div>
            </div>
            
            {result.utilizationPercent >= 75 && (
              <div className="mt-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-sm text-amber-400">
                  ⚠️ High utilization detected. Consider upgrading to {signallingType === "absolute" ? "Automatic Block" : "additional main line"}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
