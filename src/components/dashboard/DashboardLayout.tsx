import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Header } from '@/components/dashboard/Header';
import { MetricsPanel } from '@/components/dashboard/MetricsPanel';
import { SignalBoxVisualization } from '@/components/dashboard/SignalBoxVisualization';
import { TrainList } from '@/components/dashboard/TrainList';
import { TrainDetails } from '@/components/dashboard/TrainDetails';
import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { SidebarProvider } from '@/components/ui/sidebar';
import { MousePointerClick, Loader2 } from 'lucide-react';
import { useTrains, useTrackSections, useSectionMetrics } from '@/hooks/useRailwayData';
import { useState, useEffect } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
}

export const DashboardLayout = ({ children, title }: DashboardLayoutProps) => {
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  
  const { trains, loading: trainsLoading, setTrains } = useTrains();
  const { sections, loading: sectionsLoading } = useTrackSections();
  const { metrics, loading: metricsLoading, setMetrics } = useSectionMetrics();

  const selectedTrain = selectedTrainId 
    ? trains.find(t => t.id === selectedTrainId) || null 
    : null;

  const isLoading = trainsLoading || sectionsLoading || metricsLoading;

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
    <SidebarProvider defaultOpen={true}>
      <div className="min-h-screen bg-background flex w-full">
        <DashboardSidebar />
        
        <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
          <Header />
          
          <main className="flex-1 flex flex-col overflow-hidden bg-gradient-to-br from-background via-background to-muted/10">
            {/* Top Bar with Metrics */}
            <div className="px-3 lg:px-4 py-2 border-b border-border/30 bg-card/30 backdrop-blur-sm shrink-0">
              {metrics && <MetricsPanel metrics={metrics} />}
            </div>

            {/* Main Grid Layout - Horizontal Split */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Panel - Signal Box Visualization */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="w-full lg:w-[55%] xl:w-[60%] border-r border-border/30 flex flex-col"
              >
                <div className="flex-1 p-2 lg:p-3 overflow-hidden">
                  <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden h-full">
                    <SignalBoxVisualization
                      sections={sections}
                      trains={trains}
                      selectedTrain={selectedTrainId}
                      onTrainSelect={setSelectedTrainId}
                    />
                  </div>
                </div>
              </motion.div>

              {/* Right Panel - Train List, Content & Details */}
              <div className="hidden lg:flex flex-1 flex-col overflow-hidden">
                <div className="flex-1 p-2 lg:p-3 overflow-hidden">
                  <div className="grid grid-cols-12 gap-2 lg:gap-3 h-full">
                    {/* Train List */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="col-span-5 xl:col-span-4 h-full"
                    >
                      <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden h-full">
                        <TrainList
                          trains={trains}
                          selectedTrain={selectedTrainId}
                          onTrainSelect={setSelectedTrainId}
                        />
                      </div>
                    </motion.div>

                    {/* Content + Train Details */}
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 }}
                      className="col-span-7 xl:col-span-8 flex flex-col gap-2 lg:gap-3 h-full"
                    >
                      {/* Active Content */}
                      <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden flex-1 flex flex-col">
                        <div className="px-3 py-2 border-b border-border/30 bg-muted/20 shrink-0">
                          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                        </div>
                        <div className="flex-1 p-2 lg:p-3 overflow-auto">
                          {children}
                        </div>
                      </div>

                      {/* Train Details */}
                      <div className="bg-card/50 backdrop-blur-sm rounded-xl border border-border/50 overflow-hidden h-[200px] flex flex-col shrink-0">
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
                              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-2 border border-border/30">
                                <MousePointerClick className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <p className="text-xs text-muted-foreground">
                                Select a train to view details
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile: Quick Stats */}
            <div className="lg:hidden px-3 py-2 border-t border-border/30 bg-card/30 backdrop-blur-sm">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-card/50 rounded-lg border border-border/50 p-2 text-center">
                  <div className="w-2 h-2 rounded-full bg-success mx-auto mb-1" />
                  <p className="text-sm font-bold text-success">{trains.filter(t => t.status === 'on-time').length}</p>
                  <span className="text-[8px] text-muted-foreground">On Time</span>
                </div>
                <div className="bg-card/50 rounded-lg border border-border/50 p-2 text-center">
                  <div className="w-2 h-2 rounded-full bg-warning mx-auto mb-1" />
                  <p className="text-sm font-bold text-warning">{trains.filter(t => t.status === 'delayed').length}</p>
                  <span className="text-[8px] text-muted-foreground">Delayed</span>
                </div>
                <div className="bg-card/50 rounded-lg border border-border/50 p-2 text-center">
                  <div className="w-2 h-2 rounded-full bg-destructive mx-auto mb-1" />
                  <p className="text-sm font-bold text-destructive">{trains.filter(t => t.status === 'halted').length}</p>
                  <span className="text-[8px] text-muted-foreground">Halted</span>
                </div>
                <div className="bg-card/50 rounded-lg border border-border/50 p-2 text-center">
                  <div className="w-2 h-2 rounded-full bg-primary mx-auto mb-1" />
                  <p className="text-sm font-bold text-primary">{trains.filter(t => t.status === 'approaching').length}</p>
                  <span className="text-[8px] text-muted-foreground">Active</span>
                </div>
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
    </SidebarProvider>
  );
};

export default DashboardLayout;
