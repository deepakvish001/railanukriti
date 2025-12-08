import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { MetricsPanel } from '@/components/dashboard/MetricsPanel';
import { TrainList } from '@/components/dashboard/TrainList';
import { TrackVisualization } from '@/components/dashboard/TrackVisualization';
import { TrainDetails } from '@/components/dashboard/TrainDetails';
import { useTrains, useTrackSections, useSectionMetrics } from '@/hooks/useRailwayData';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Train as TrainIcon, Clock, AlertTriangle, Activity } from 'lucide-react';

const Dashboard = () => {
  const { trains } = useTrains();
  const { sections } = useTrackSections();
  const { metrics } = useSectionMetrics();
  const [selectedTrainId, setSelectedTrainId] = useState<string | null>(null);
  
  const selectedTrain = trains.find(t => t.id === selectedTrainId) || null;

  const onTimeCount = trains.filter(t => t.status === 'on-time').length;
  const delayedCount = trains.filter(t => t.status === 'delayed').length;
  const haltedCount = trains.filter(t => t.status === 'halted').length;
  const approachingCount = trains.filter(t => t.status === 'approaching').length;

  return (
    <>
      <Helmet>
        <title>Dashboard | Railway Traffic Management</title>
        <meta name="description" content="Real-time railway traffic management dashboard with train monitoring and track visualization." />
      </Helmet>
      <DashboardLayout title="Dashboard Overview">
        <div className="h-full flex flex-col gap-4">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="bg-success/10 border-success/30">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/20">
                  <TrainIcon className="h-4 w-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">On Time</p>
                  <p className="text-xl font-bold text-success">{onTimeCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-warning/10 border-warning/30">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/20">
                  <Clock className="h-4 w-4 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Delayed</p>
                  <p className="text-xl font-bold text-warning">{delayedCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-destructive/10 border-destructive/30">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/20">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Halted</p>
                  <p className="text-xl font-bold text-destructive">{haltedCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-primary/10 border-primary/30">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/20">
                  <Activity className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Approaching</p>
                  <p className="text-xl font-bold text-primary">{approachingCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metrics Panel */}
          <MetricsPanel metrics={metrics} />

          {/* Main Content */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
            {/* Track Visualization */}
            <Card className="lg:col-span-2 flex flex-col min-h-[300px]">
              <CardHeader className="py-3 px-4 border-b border-border/50">
                <CardTitle className="text-sm font-medium">Track Visualization</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0">
                <TrackVisualization 
                  sections={sections} 
                  trains={trains} 
                  selectedTrain={selectedTrainId}
                  onTrainSelect={setSelectedTrainId}
                />
              </CardContent>
            </Card>

            {/* Train List & Details */}
            <div className="flex flex-col gap-4 min-h-[300px]">
              <Card className="flex-1 flex flex-col overflow-hidden">
                <CardHeader className="py-3 px-4 border-b border-border/50">
                  <CardTitle className="text-sm font-medium">Active Trains</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-auto">
                  <TrainList 
                    trains={trains} 
                    selectedTrain={selectedTrainId}
                    onTrainSelect={setSelectedTrainId}
                  />
                </CardContent>
              </Card>

              {selectedTrain && (
                <Card className="flex flex-col">
                  <CardHeader className="py-3 px-4 border-b border-border/50">
                    <CardTitle className="text-sm font-medium">Train Details</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <TrainDetails train={selectedTrain} onClose={() => setSelectedTrainId(null)} />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </>
  );
};

export default Dashboard;
