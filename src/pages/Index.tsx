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
import { Loader2, MousePointerClick } from 'lucide-react';
import { SidebarProvider } from '@/components/ui/sidebar';

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

  const getTabTitle = () => {
    const titles: Record<string, string> = {
      recommendations: 'AI Recommendations',
      alerts: 'Active Alerts',
      simulation: 'Scenario Simulation',
      audit: 'Audit Log',
      charts: 'Performance Charts',
      conflicts: 'Conflict Detection',
      schedule: 'Train Schedule',
      export: 'Export Data',
      analytics: 'Analytics Dashboard',
      kpis: 'KPI Dashboard',
      predictions: 'AI Delay Prediction',
    };
    return titles[activeTab] || 'Dashboard';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="relative">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="absolute inset-0 h-10 w-10 animate-ping opacity-20 rounded-full bg-primary" />
          </div>
          <p className="text-muted-foreground font-mono text-sm">Loading section data...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Left Sidebar - Navigation */}
      <DashboardSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Header />
        
        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/10">
          {/* Top Bar with Metrics */}
          <div className="px-3 lg:px-4 py-2 border-b border-border/30 bg-card/30 backdrop-blur-sm shrink-0">
            {metrics && <MetricsPanel metrics={metrics} />}
          </div>

          {/* Main Grid Layout - Full Height */}
          <div className="flex-1 p-2 lg:p-3 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 lg:gap-3 h-full">
              {/* Left Panel - Train List */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="col-span-12 md:col-span-4 lg:col-span-3 xl:col-span-2 h-full min-h-[300px] md:min-h-0"
              >
                <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden h-full">
                  <TrainList
                    trains={trains}
                    selectedTrain={selectedTrainId}
                    onTrainSelect={setSelectedTrainId}
                  />
                </div>
              </motion.div>

              {/* Center Panel - Track Visualization + Active Content */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="col-span-12 md:col-span-8 lg:col-span-6 xl:col-span-7 flex flex-col gap-2 lg:gap-3 h-full min-h-[400px] md:min-h-0"
              >
                {/* Track Visualization */}
                <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden h-[40%] min-h-[150px]">
                  <TrackVisualization
                    sections={sections}
                    trains={trains}
                    selectedTrain={selectedTrainId}
                    onTrainSelect={setSelectedTrainId}
                  />
                </div>
                
                {/* Active Tab Content */}
                <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden flex-1 flex flex-col">
                  <div className="px-3 py-2 border-b border-border/30 bg-muted/20 shrink-0">
                    <h2 className="text-sm font-semibold text-foreground">{getTabTitle()}</h2>
                  </div>
                  <div className="flex-1 p-2 lg:p-3 overflow-auto">
                    {renderActiveContent()}
                  </div>
                </div>
              </motion.div>

              {/* Right Panel - Train Details & Quick Info */}
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="col-span-12 lg:col-span-3 xl:col-span-3 flex flex-col gap-2 lg:gap-3 h-full min-h-[300px] lg:min-h-0"
              >
                {/* Quick Stats Cards */}
                <div className="grid grid-cols-4 lg:grid-cols-2 gap-2 shrink-0">
                  <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 p-2 lg:p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      <span className="text-[9px] lg:text-[10px] uppercase tracking-wide text-muted-foreground font-medium">On Time</span>
                    </div>
                    <p className="text-base lg:text-lg font-bold text-success">{trains.filter(t => t.status === 'on-time').length}</p>
                  </div>
                  <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 p-2 lg:p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      <span className="text-[9px] lg:text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Delayed</span>
                    </div>
                    <p className="text-base lg:text-lg font-bold text-warning">{trains.filter(t => t.status === 'delayed').length}</p>
                  </div>
                  <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 p-2 lg:p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      <span className="text-[9px] lg:text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Halted</span>
                    </div>
                    <p className="text-base lg:text-lg font-bold text-destructive">{trains.filter(t => t.status === 'halted').length}</p>
                  </div>
                  <div className="bg-card/50 backdrop-blur-sm rounded-lg border border-border/50 p-2 lg:p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span className="text-[9px] lg:text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Active</span>
                    </div>
                    <p className="text-base lg:text-lg font-bold text-primary">{trains.filter(t => t.status === 'approaching').length}</p>
                  </div>
                </div>

                {/* Train Details Card */}
                <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden flex-1 flex flex-col">
                  <div className="px-3 py-2 border-b border-border/30 bg-muted/20 flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-semibold text-foreground">Train Details</h3>
                    {selectedTrain && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                        {selectedTrain.number}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 overflow-auto">
                    {selectedTrain ? (
                      <TrainDetails
                        train={selectedTrain}
                        onClose={() => setSelectedTrainId(null)}
                      />
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-3 border border-border/30">
                          <MousePointerClick className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mb-1">
                          Select a Train
                        </h3>
                        <p className="text-xs text-muted-foreground max-w-[160px] leading-relaxed">
                          Click on a train to view details
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </main>
        
        {/* Footer Status Bar */}
        <footer className="border-t border-border/30 bg-card/50 backdrop-blur-sm px-4 lg:px-6 py-2">
          <div className="flex items-center justify-between text-[10px] lg:text-xs text-muted-foreground">
            <div className="flex items-center gap-3 lg:gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Synced
              </span>
              <span className="hidden sm:inline text-border/50">•</span>
              <span className="hidden sm:inline">Network: Connected</span>
              <span className="hidden md:inline text-border/50">•</span>
              <span className="hidden md:inline">TMS Integration: Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
              <span>All systems operational</span>
            </div>
          </div>
        </footer>
      </div>
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