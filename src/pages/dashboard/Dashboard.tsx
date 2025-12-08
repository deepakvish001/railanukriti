import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { MetricsPanel } from '@/components/dashboard/MetricsPanel';
import { TrainList } from '@/components/dashboard/TrainList';
import { SignalBoxVisualization } from '@/components/dashboard/SignalBoxVisualization';
import { TrainDetails } from '@/components/dashboard/TrainDetails';
import { useTrains, useTrackSections, useSectionMetrics } from '@/hooks/useRailwayData';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Train as TrainIcon, Clock, AlertTriangle, Activity, MousePointerClick } from 'lucide-react';

const Dashboard = () => {
  const { trains, loading: trainsLoading, setTrains } = useTrains();
  const { sections, loading: sectionsLoading } = useTrackSections();
  const { metrics, loading: metricsLoading, setMetrics } = useSectionMetrics();
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  
  const selectedTrain = trains.find(t => t.id === selectedTrainId) || null;
  const isLoading = trainsLoading || sectionsLoading || metricsLoading;

  const onTimeCount = trains.filter(t => t.status === 'on-time').length;
  const delayedCount = trains.filter(t => t.status === 'delayed').length;
  const haltedCount = trains.filter(t => t.status === 'halted').length;
  const approachingCount = trains.filter(t => t.status === 'approaching').length;

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

  return (
    <>
      <Helmet>
        <title>Dashboard | Railway Traffic Management</title>
        <meta name="description" content="Real-time railway traffic management dashboard with train monitoring and track visualization." />
      </Helmet>
      <DashboardLayout title="Dashboard Overview" isLoading={isLoading}>
        <div className="flex flex-col gap-6">
          {/* Section 1: Quick Stats */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Train Status Overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-success/10 border-success/30 hover:bg-success/15 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-success/20">
                    <TrainIcon className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">On Time</p>
                    <p className="text-2xl font-bold text-success">{onTimeCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-warning/10 border-warning/30 hover:bg-warning/15 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-warning/20">
                    <Clock className="h-5 w-5 text-warning" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Delayed</p>
                    <p className="text-2xl font-bold text-warning">{delayedCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-destructive/10 border-destructive/30 hover:bg-destructive/15 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-destructive/20">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Halted</p>
                    <p className="text-2xl font-bold text-destructive">{haltedCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-primary/10 border-primary/30 hover:bg-primary/15 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/20">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Approaching</p>
                    <p className="text-2xl font-bold text-primary">{approachingCount}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* Section 2: Metrics Panel */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Section Metrics</h2>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-4">
                {metrics && <MetricsPanel metrics={metrics} />}
              </CardContent>
            </Card>
          </section>

          {/* Section 3: Signal Box Visualization */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Signal Box & Track Visualization</h2>
            <Card className="bg-card/50 border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="h-[500px]">
                  <SignalBoxVisualization
                    sections={sections}
                    trains={trains}
                    selectedTrain={selectedTrainId}
                    onTrainSelect={setSelectedTrainId}
                  />
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Section 4: Train List & Details */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground mb-3">Train Management</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Train List */}
              <Card className="bg-card/50 border-border/50 h-[420px] flex flex-col">
                <CardHeader className="py-3 px-4 border-b border-border/30 shrink-0">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <TrainIcon className="h-4 w-4 text-primary" />
                    Active Trains
                    <span className="ml-auto text-xs text-muted-foreground font-normal">
                      {trains.length} trains
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-auto">
                  <TrainList 
                    trains={trains} 
                    selectedTrain={selectedTrainId}
                    onTrainSelect={setSelectedTrainId}
                  />
                </CardContent>
              </Card>

              {/* Train Details */}
              <Card className="bg-card/50 border-border/50 h-[420px] flex flex-col">
                <CardHeader className="py-3 px-4 border-b border-border/30 shrink-0">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Train Details
                    {selectedTrain && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                        {selectedTrain.number}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 flex-1 overflow-auto">
                  {selectedTrain ? (
                    <TrainDetails
                      train={selectedTrain}
                      onClose={() => setSelectedTrainId(null)}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-4 border border-border/30">
                        <MousePointerClick className="w-6 h-6 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">No Train Selected</p>
                      <p className="text-xs text-muted-foreground/70">
                        Click on a train from the list to view details
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </DashboardLayout>
    </>
  );
};

export default Dashboard;
