import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  FlaskConical, Play, ArrowRight, TrendingUp, TrendingDown, 
  Minus, Train, Clock, Zap, AlertTriangle
} from "lucide-react";

interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  changes: {
    signallingChange?: string;
    addLoops?: number;
    addTracks?: number;
    addCrossovers?: boolean;
    reduceBlockLength?: number;
  };
}

interface SimulationResult {
  beforeCapacity: number;
  afterCapacity: number;
  capacityChange: number;
  percentChange: number;
  costEstimate: string;
  implementationTime: string;
  risks: string[];
  benefits: string[];
}

const PRESET_SCENARIOS: SimulationScenario[] = [
  {
    id: "ab-to-at",
    name: "Convert AB to Automatic Block",
    description: "Upgrade signalling system from Absolute Block to Automatic Block",
    changes: { signallingChange: "automatic", reduceBlockLength: 1.5 }
  },
  {
    id: "add-loops",
    name: "Add 2 Loop Lines",
    description: "Add loop lines for overtaking and crossing",
    changes: { addLoops: 2 }
  },
  {
    id: "double-line",
    name: "Add Second Main Line",
    description: "Convert single line to double line section",
    changes: { addTracks: 1 }
  },
  {
    id: "add-crossovers",
    name: "Install Crossovers",
    description: "Add crossovers for operational flexibility",
    changes: { addCrossovers: true }
  },
  {
    id: "reduce-blocks",
    name: "Add More Signals",
    description: "Reduce block length by adding intermediate signals",
    changes: { reduceBlockLength: 5 }
  }
];

export const InfrastructureSimulator = () => {
  // Current state
  const [currentSignalling, setCurrentSignalling] = useState<string>("absolute");
  const [currentBlockLength, setCurrentBlockLength] = useState<number>(10);
  const [currentTracks, setCurrentTracks] = useState<number>(1);
  const [currentLoops, setCurrentLoops] = useState<number>(0);
  const [hasCrossovers, setHasCrossovers] = useState<boolean>(false);
  
  // Simulation
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenario | null>(null);
  const [customChanges, setCustomChanges] = useState({
    signallingChange: "",
    addLoops: 0,
    addTracks: 0,
    addCrossovers: false,
    reduceBlockLength: 0
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);

  const calculateCapacity = (
    signalling: string,
    blockLength: number,
    tracks: number,
    loops: number,
    crossovers: boolean
  ): number => {
    let base: number;
    switch (signalling) {
      case "automatic": base = 48 + (blockLength <= 2 ? 12 : 0); break;
      case "semi-automatic": base = 36; break;
      default: base = 24 - (blockLength > 10 ? 4 : 0);
    }
    
    const loopBonus = Math.round(base * 0.15 * Math.min(loops, 4));
    const crossoverBonus = crossovers ? Math.round(base * 0.1) : 0;
    
    return Math.round((base + loopBonus + crossoverBonus) * tracks);
  };

  const runSimulation = () => {
    setIsSimulating(true);
    
    setTimeout(() => {
      const changes = selectedScenario?.changes || customChanges;
      
      // Before
      const beforeCapacity = calculateCapacity(
        currentSignalling,
        currentBlockLength,
        currentTracks,
        currentLoops,
        hasCrossovers
      );
      
      // After
      const newSignalling = changes.signallingChange || currentSignalling;
      const newBlockLength = changes.reduceBlockLength || currentBlockLength;
      const newTracks = currentTracks + (changes.addTracks || 0);
      const newLoops = currentLoops + (changes.addLoops || 0);
      const newCrossovers = hasCrossovers || changes.addCrossovers || false;
      
      const afterCapacity = calculateCapacity(
        newSignalling,
        newBlockLength,
        newTracks,
        newLoops,
        newCrossovers
      );
      
      const capacityChange = afterCapacity - beforeCapacity;
      const percentChange = Math.round((capacityChange / beforeCapacity) * 100);
      
      // Generate costs and risks based on changes
      let costEstimate = "₹0";
      let implementationTime = "0 months";
      const risks: string[] = [];
      const benefits: string[] = [];
      
      if (changes.signallingChange === "automatic") {
        costEstimate = "₹50-100 Crore";
        implementationTime = "18-24 months";
        risks.push("Requires complete signalling overhaul");
        risks.push("Staff retraining needed");
        benefits.push("Immediate capacity doubling");
        benefits.push("Safer train separation");
        benefits.push("Smoother braking profiles");
      }
      
      if (changes.addTracks) {
        costEstimate = "₹100-200 Crore/km";
        implementationTime = "24-36 months";
        risks.push("Land acquisition required");
        risks.push("Environmental clearances needed");
        risks.push("Construction disruption to existing traffic");
        benefits.push("Doubles or triples capacity");
        benefits.push("Eliminates crossing delays");
      }
      
      if (changes.addLoops) {
        costEstimate = "₹5-10 Crore per loop";
        implementationTime = "6-12 months";
        risks.push("Loop speed restrictions (30 km/h)");
        risks.push("Driver training for loop usage");
        benefits.push("Enables overtaking");
        benefits.push("Facilitates crossing");
        benefits.push("Quick implementation");
      }
      
      if (changes.addCrossovers) {
        costEstimate = "₹1-3 Crore per crossover";
        implementationTime = "3-6 months";
        risks.push("Speed restrictions at crossover");
        benefits.push("Increased operational flexibility");
        benefits.push("Better failure recovery");
      }
      
      if (changes.reduceBlockLength && !changes.signallingChange) {
        costEstimate = "₹20-40 Crore";
        implementationTime = "12-18 months";
        risks.push("May cause unnecessary braking if too close");
        benefits.push("More trains in section");
        benefits.push("Works with existing Automatic Block");
      }
      
      setResult({
        beforeCapacity,
        afterCapacity,
        capacityChange,
        percentChange,
        costEstimate,
        implementationTime,
        risks,
        benefits
      });
      
      setIsSimulating(false);
    }, 1500);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Current State */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Train className="h-5 w-5 text-primary" />
            Current Infrastructure
          </CardTitle>
          <CardDescription>
            Configure current section parameters
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Current Signalling</Label>
            <Select value={currentSignalling} onValueChange={setCurrentSignalling}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="absolute">Absolute Block (AB)</SelectItem>
                <SelectItem value="semi-automatic">Semi-Automatic Block</SelectItem>
                <SelectItem value="automatic">Automatic Block (AT)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Block Length</Label>
              <span className="text-sm font-mono">{currentBlockLength} km</span>
            </div>
            <Slider
              value={[currentBlockLength]}
              onValueChange={(v) => setCurrentBlockLength(v[0])}
              min={1}
              max={15}
              step={0.5}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Main Lines</Label>
              <span className="text-sm font-mono">{currentTracks}</span>
            </div>
            <Slider
              value={[currentTracks]}
              onValueChange={(v) => setCurrentTracks(v[0])}
              min={1}
              max={3}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label>Loop Lines</Label>
              <span className="text-sm font-mono">{currentLoops}</span>
            </div>
            <Slider
              value={[currentLoops]}
              onValueChange={(v) => setCurrentLoops(v[0])}
              min={0}
              max={6}
              step={1}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Has Crossovers</Label>
            <Switch checked={hasCrossovers} onCheckedChange={setHasCrossovers} />
          </div>

          <div className="pt-4 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Current Capacity</span>
              <span className="text-2xl font-bold text-foreground">
                {calculateCapacity(currentSignalling, currentBlockLength, currentTracks, currentLoops, hasCrossovers)} trains/day
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scenario Selection */}
      <Card className="bg-card/50 backdrop-blur border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            What-If Scenarios
          </CardTitle>
          <CardDescription>
            Select a scenario to simulate its impact
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            {PRESET_SCENARIOS.map((scenario) => (
              <Button
                key={scenario.id}
                variant={selectedScenario?.id === scenario.id ? "default" : "outline"}
                className="justify-start h-auto py-3 px-4"
                onClick={() => setSelectedScenario(scenario)}
              >
                <div className="text-left">
                  <div className="font-medium">{scenario.name}</div>
                  <div className="text-xs text-muted-foreground">{scenario.description}</div>
                </div>
              </Button>
            ))}
          </div>

          <Button 
            onClick={runSimulation} 
            disabled={!selectedScenario || isSimulating}
            className="w-full"
          >
            {isSimulating ? (
              <>Simulating...</>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Simulation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && (
        <Card className="lg:col-span-2 bg-card/50 backdrop-blur border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Simulation Results: {selectedScenario?.name}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3 mb-6">
              {/* Before/After Comparison */}
              <div className="flex items-center justify-center gap-4 p-4 bg-muted/30 rounded-lg">
                <div className="text-center">
                  <div className="text-3xl font-bold text-muted-foreground">{result.beforeCapacity}</div>
                  <div className="text-xs text-muted-foreground">Before</div>
                </div>
                <ArrowRight className="h-6 w-6 text-primary" />
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{result.afterCapacity}</div>
                  <div className="text-xs text-muted-foreground">After</div>
                </div>
              </div>

              {/* Change */}
              <div className="flex items-center justify-center gap-2 p-4 bg-muted/30 rounded-lg">
                {result.capacityChange > 0 ? (
                  <TrendingUp className="h-8 w-8 text-green-500" />
                ) : result.capacityChange < 0 ? (
                  <TrendingDown className="h-8 w-8 text-red-500" />
                ) : (
                  <Minus className="h-8 w-8 text-muted-foreground" />
                )}
                <div>
                  <div className={`text-2xl font-bold ${result.capacityChange > 0 ? 'text-green-500' : result.capacityChange < 0 ? 'text-red-500' : ''}`}>
                    {result.capacityChange > 0 ? '+' : ''}{result.capacityChange} trains
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {result.percentChange > 0 ? '+' : ''}{result.percentChange}% change
                  </div>
                </div>
              </div>

              {/* Cost & Time */}
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Implementation</span>
                </div>
                <div className="font-medium">{result.implementationTime}</div>
                <div className="text-sm text-amber-400">{result.costEstimate}</div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {/* Benefits */}
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <div className="font-medium text-green-400 mb-2">Benefits</div>
                <ul className="space-y-1">
                  {result.benefits.map((b, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Risks */}
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="font-medium text-amber-400 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Considerations
                </div>
                <ul className="space-y-1">
                  {result.risks.map((r, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="text-amber-400">•</span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
