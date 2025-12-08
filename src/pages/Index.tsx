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
import { ConflictDetection } from '@/components/dashboard/ConflictDetection';
import { TrainScheduleGantt } from '@/components/dashboard/TrainScheduleGantt';
import { ExportPanel } from '@/components/dashboard/ExportPanel';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';
import { KPIDashboard } from '@/components/dashboard/KPIDashboard';
import { DelayPrediction } from '@/components/dashboard/DelayPrediction';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { useTrains, useTrackSections, useAIRecommendations, useSectionMetrics } from '@/hooks/useRailwayData';
import { Helmet } from 'react-helmet-async';
import { Loader2, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';

const DashboardContent = () => {
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('recommendations');
  
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

  const renderActiveContent = () => {
    switch (activeTab) {
      case 'recommendations':
        return <AIRecommendations recommendations={recommendations} />;
      case 'alerts':
        return <AlertsPanel className="h-full" />;
      case 'simulation':
        return <ScenarioSimulation trains={trains} />;
      case 'audit':
        return <AuditLog />;
      case 'charts':
        return <PerformanceCharts />;
      case 'conflicts':
        return <ConflictDetection />;
      case 'schedule':
        return <TrainScheduleGantt />;
      case 'export':
        return <ExportPanel />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'kpis':
        return <KPIDashboard />;
      case 'predictions':
        return <DelayPrediction />;
      default:
        return <AIRecommendations recommendations={recommendations} />;
    }
  };

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
    <div className="min-h-screen bg-background flex flex-col w-full">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Navigation */}
        <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />
        
        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-6 space-y-4 lg:space-y-6 overflow-auto">
          {/* Sidebar Toggle + Metrics Row */}
          <div className="flex items-start gap-4">
            <SidebarTrigger className="mt-1 shrink-0" />
            <div className="flex-1">
              {metrics && <MetricsPanel metrics={metrics} />}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-12 gap-4 lg:gap-6 min-h-[600px]">
            {/* Left Panel - Train List */}
            <div className="col-span-12 lg:col-span-3 xl:col-span-2">
              <TrainList
                trains={trains}
                selectedTrain={selectedTrainId}
                onTrainSelect={setSelectedTrainId}
              />
            </div>

            {/* Center Panel - Track Visualization & Active Content */}
            <div className="col-span-12 lg:col-span-6 xl:col-span-7 flex flex-col gap-4 lg:gap-6">
              <TrackVisualization
                sections={sections}
                trains={trains}
                selectedTrain={selectedTrainId}
                onTrainSelect={setSelectedTrainId}
              />
              
              {/* Active Tab Content */}
              <div className="flex-1 min-h-[300px] overflow-auto">
                {renderActiveContent()}
              </div>
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
      </div>

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
  );
};

const Index = () => {
  return (
    <>
      <Helmet>
        <title>Section Control AI | Railway Traffic Management</title>
        <meta name="description" content="AI-powered train traffic control system for maximizing section throughput and minimizing delays on Indian Railways." />
      </Helmet>
      
      <SidebarProvider defaultOpen={true}>
        <DashboardContent />
      </SidebarProvider>
    </>
  );
};

export default Index;
