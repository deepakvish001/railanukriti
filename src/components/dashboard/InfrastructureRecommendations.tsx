import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Settings2, RefreshCw, TrendingUp, AlertTriangle, Zap, 
  Train, ArrowRight, Clock, DollarSign, Brain, ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UpgradeOption {
  type: string;
  description: string;
  capacityGain: number;
  percentGain: number;
  costEstimate: string;
  implementationTime: string;
  priority: number;
}

interface InfrastructureRecommendation {
  sectionId: number;
  sectionName: string;
  utilizationPercent: number;
  currentCapacity: number;
  severity: "critical" | "high" | "medium";
  upgradeOptions: UpgradeOption[];
  aiInsight: string;
  generatedAt: string;
}

interface AnalysisSummary {
  congestedSections: number;
  criticalSections: number;
  totalCapacityGainPossible: number;
}

export const InfrastructureRecommendations = () => {
  const [recommendations, setRecommendations] = useState<InfrastructureRecommendation[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);

  const runAnalysis = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("infrastructure-recommendations");
      
      if (error) throw error;
      
      if (data.success) {
        setRecommendations(data.recommendations || []);
        setSummary(data.summary);
        setLastAnalysis(new Date().toLocaleTimeString());
        
        if (data.recommendations?.length > 0) {
          toast.success(`Found ${data.recommendations.length} sections needing attention`);
        } else {
          toast.info("All sections are operating within optimal capacity");
        }
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("Failed to analyze infrastructure");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runAnalysis();
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "text-red-500 bg-red-500/20 border-red-500/30";
      case "high": return "text-amber-500 bg-amber-500/20 border-amber-500/30";
      default: return "text-blue-500 bg-blue-500/20 border-blue-500/30";
    }
  };

  const getUpgradeIcon = (type: string) => {
    switch (type) {
      case "signalling_upgrade": return <Zap className="h-4 w-4" />;
      case "add_loops": return <RefreshCw className="h-4 w-4" />;
      case "double_line": return <Train className="h-4 w-4" />;
      case "add_crossovers": return <ArrowRight className="h-4 w-4" />;
      default: return <Settings2 className="h-4 w-4" />;
    }
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Infrastructure Upgrade Recommendations
          </CardTitle>
          <div className="flex items-center gap-2">
            {lastAnalysis && (
              <span className="text-xs text-muted-foreground">
                Last analysis: {lastAnalysis}
              </span>
            )}
            <Button 
              size="sm" 
              variant="outline" 
              onClick={runAnalysis}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Analyze
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted/30 rounded-lg">
              <div className="text-xs text-muted-foreground">Congested Sections</div>
              <div className="text-2xl font-bold text-foreground">{summary.congestedSections}</div>
            </div>
            <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="text-xs text-red-400">Critical</div>
              <div className="text-2xl font-bold text-red-500">{summary.criticalSections}</div>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
              <div className="text-xs text-green-400">Capacity Gain Possible</div>
              <div className="text-2xl font-bold text-green-500">+{summary.totalCapacityGainPossible}</div>
            </div>
          </div>
        )}

        {/* Recommendations List */}
        <AnimatePresence>
          {recommendations.length > 0 ? (
            <div className="space-y-3">
              {recommendations.map((rec, index) => (
                <motion.div
                  key={rec.sectionId}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`border rounded-lg overflow-hidden ${getSeverityColor(rec.severity)}`}
                >
                  {/* Header */}
                  <button
                    onClick={() => setExpandedSection(
                      expandedSection === rec.sectionId ? null : rec.sectionId
                    )}
                    className="w-full p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className={`h-5 w-5 ${
                        rec.severity === 'critical' ? 'text-red-500' :
                        rec.severity === 'high' ? 'text-amber-500' : 'text-blue-500'
                      }`} />
                      <div>
                        <div className="font-medium text-foreground">{rec.sectionName}</div>
                        <div className="text-xs text-muted-foreground">
                          {rec.currentCapacity} trains/day capacity
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Utilization</div>
                        <div className={`font-mono font-bold ${
                          rec.utilizationPercent > 80 ? 'text-red-500' :
                          rec.utilizationPercent > 70 ? 'text-amber-500' : 'text-blue-500'
                        }`}>
                          {rec.utilizationPercent}%
                        </div>
                      </div>
                      <Progress 
                        value={rec.utilizationPercent} 
                        className="w-24 h-2"
                      />
                      {expandedSection === rec.sectionId ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {expandedSection === rec.sectionId && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border/30"
                      >
                        <div className="p-4 space-y-4">
                          {/* AI Insight */}
                          {rec.aiInsight && (
                            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                              <div className="flex items-center gap-2 text-xs text-primary mb-1">
                                <Brain className="h-3 w-3" />
                                AI Analysis
                              </div>
                              <p className="text-sm text-foreground">{rec.aiInsight}</p>
                            </div>
                          )}

                          {/* Upgrade Options */}
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                              Recommended Upgrades
                            </div>
                            {rec.upgradeOptions.map((option, i) => (
                              <div 
                                key={i}
                                className="p-3 bg-muted/30 rounded-lg border border-border/30 flex items-start gap-3"
                              >
                                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                                  {getUpgradeIcon(option.type)}
                                </div>
                                <div className="flex-1">
                                  <div className="font-medium text-sm text-foreground">
                                    {option.description}
                                  </div>
                                  <div className="flex items-center gap-4 mt-2 text-xs">
                                    <span className="flex items-center gap-1 text-green-400">
                                      <TrendingUp className="h-3 w-3" />
                                      +{option.capacityGain} trains ({option.percentGain}%)
                                    </span>
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <DollarSign className="h-3 w-3" />
                                      {option.costEstimate}
                                    </span>
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {option.implementationTime}
                                    </span>
                                  </div>
                                </div>
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${
                                    option.priority === 1 ? 'border-red-500 text-red-500' :
                                    option.priority === 2 ? 'border-amber-500 text-amber-500' :
                                    'border-muted-foreground text-muted-foreground'
                                  }`}
                                >
                                  P{option.priority}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          ) : !isLoading ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <h3 className="font-medium text-foreground mb-1">All Systems Optimal</h3>
              <p className="text-sm text-muted-foreground">
                No sections are currently congested. Infrastructure is performing well.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Analyzing infrastructure...</p>
            </div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
};
