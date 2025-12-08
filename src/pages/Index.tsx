import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/dashboard/Header';
import { MetricsPanel } from '@/components/dashboard/MetricsPanel';
import { TrackVisualization } from '@/components/dashboard/TrackVisualization';
import { TrainList } from '@/components/dashboard/TrainList';
import { AIRecommendations } from '@/components/dashboard/AIRecommendations';
import { TrainDetails } from '@/components/dashboard/TrainDetails';
import { ScenarioSimulation } from '@/components/dashboard/ScenarioSimulation';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';
import { AuditLog } from '@/components/dashboard/AuditLog';
import { PerformanceCharts } from '@/components/dashboard/PerformanceCharts';
import { useTrains, useTrackSections, useAIRecommendations, useSectionMetrics } from '@/hooks/useRailwayData';
import { Helmet } from 'react-helmet-async';
import { Loader2, FlaskConical, Bell, History, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Index = () => {
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [showSimulation, setShowSimulation] = useState(false);
  
  const { trains, loading: trainsLoading, setTrains } = useTrains();
  const { sections, loading: sectionsLoading } = useTrackSections();
  const { recommendations, loading: recommendationsLoading } = useAIRecommendations();
  const { metrics, loading: metricsLoading, setMetrics } = useSectionMetrics();

  const selectedTrain = selectedTrainId 
    ? trains.find(t => t.id === selectedTrainId) || null 
    : null;

  const isLoading = trainsLoading || sectionsLoading || recommendationsLoading || metricsLoading;

  // Simulate real-time speed updates
  useEffect(() => {
    if (trains.length === 0) return;

    const interval = setInterval(() => {
      setTrains(prev => prev.map(train => {
        if (train.status === 'halted') return train;
        
        const speedChange = (Math.random() - 0.5) * 5;
        const newSpeed = Math.max(0, Math.min(150, train.speed + speedChange));
        
        return {
          ...train,
          speed: Math.round(newSpeed),
        };
      }));

      if (metrics) {
        setMetrics(prev => prev ? {
          ...prev,
          throughput: prev.throughput + (Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0),
          averageDelay: Math.max(0, prev.averageDelay + (Math.random() - 0.5) * 0.3),
        } : null);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [trains.length, metrics, setTrains, setMetrics]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground font-mono">Loading section data...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Section Control AI | Railway Traffic Management</title>
        <meta name="description" content="AI-powered train traffic control system for maximizing section throughput and minimizing delays on Indian Railways." />
      </Helmet>
      
      <div className="min-h-screen bg-background flex flex-col">
        <Header />
        
        <main className="flex-1 p-4 lg:p-6 space-y-4 lg:space-y-6 overflow-auto">
          {/* Metrics Row */}
          {metrics && <MetricsPanel metrics={metrics} />}

          {/* Main Content */}
          <div className="grid grid-cols-12 gap-4 lg:gap-6 min-h-[600px]">
            {/* Left Panel - Train List */}
            <div className="col-span-12 lg:col-span-3 xl:col-span-2">
              <TrainList
                trains={trains}
                selectedTrain={selectedTrainId}
                onTrainSelect={setSelectedTrainId}
              />
            </div>

            {/* Center Panel - Track Visualization & Tabs */}
            <div className="col-span-12 lg:col-span-6 xl:col-span-7 flex flex-col gap-4 lg:gap-6">
              <TrackVisualization
                sections={sections}
                trains={trains}
                selectedTrain={selectedTrainId}
                onTrainSelect={setSelectedTrainId}
              />
              
              {/* Tabbed Content */}
              <Tabs defaultValue="recommendations" className="flex-1 min-h-0 flex flex-col">
                <div className="flex items-center justify-between">
                  <TabsList className="bg-muted h-9">
                    <TabsTrigger value="recommendations" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      AI Recommendations
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Bell className="w-3 h-3 mr-1" />
                      Alerts
                    </TabsTrigger>
                    <TabsTrigger value="simulation" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <FlaskConical className="w-3 h-3 mr-1" />
                      Simulation
                    </TabsTrigger>
                    <TabsTrigger value="audit" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <History className="w-3 h-3 mr-1" />
                      Audit Log
                    </TabsTrigger>
                    <TabsTrigger value="charts" className="text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <BarChart3 className="w-3 h-3 mr-1" />
                      Charts
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <TabsContent value="recommendations" className="flex-1 mt-3 min-h-0">
                  <AIRecommendations recommendations={recommendations} />
                </TabsContent>
                
                <TabsContent value="alerts" className="flex-1 mt-3 min-h-0">
                  <AlertsPanel className="h-full" />
                </TabsContent>
                
                <TabsContent value="simulation" className="flex-1 mt-3 min-h-0">
                  <ScenarioSimulation trains={trains} />
                </TabsContent>
                
                <TabsContent value="audit" className="flex-1 mt-3 min-h-0">
                  <AuditLog />
                </TabsContent>
                
                <TabsContent value="charts" className="flex-1 mt-3 min-h-0">
                  <PerformanceCharts />
                </TabsContent>
              </Tabs>
            </div>

            {/* Right Panel - Train Details */}
            <div className="col-span-12 lg:col-span-3 xl:col-span-3">
              {selectedTrain ? (
                <TrainDetails
                  train={selectedTrain}
                  onClose={() => setSelectedTrainId(null)}
                />
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-card border border-border rounded-lg p-6 h-full flex flex-col items-center justify-center text-center"
                >
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <svg
                      className="w-8 h-8 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                      />
                    </svg>
                  </div>
                  <h3 className="text-sm font-medium text-foreground mb-2">
                    Select a Train
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-[200px]">
                    Click on a train from the list or track visualization to view details and send commands
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </main>

        {/* Footer Status Bar */}
        <footer className="border-t border-border bg-card/50 px-4 lg:px-6 py-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Last sync: Just now</span>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">Network: Connected</span>
              <span className="hidden md:inline">•</span>
              <span className="hidden md:inline">TMS Integration: Active</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
