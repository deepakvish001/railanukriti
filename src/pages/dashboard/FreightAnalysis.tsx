import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FreightThroughputDashboard } from '@/components/dashboard/FreightThroughputDashboard';
import { DisruptionManager } from '@/components/dashboard/DisruptionManager';
import { RouteVisualization } from '@/components/dashboard/RouteVisualization';
import { RailwayDataImporter } from '@/components/dashboard/RailwayDataImporter';
import { FreightGanttChart } from '@/components/dashboard/FreightGanttChart';
import { StoppageAnalysis } from '@/components/dashboard/StoppageAnalysis';
import { FreightPathComparison } from '@/components/dashboard/FreightPathComparison';
import { RealTimeBlockDiagram } from '@/components/dashboard/RealTimeBlockDiagram';
import { ScenarioSimulation } from '@/components/dashboard/ScenarioSimulation';
import { useTrains } from '@/hooks/useRailwayData';
import { Card } from '@/components/ui/card';

const FreightAnalysis = () => {
  const { trains } = useTrains();
  
  return (
    <>
      <Helmet>
        <title>Kottavalasa → Palasa Digital Twin | RailAnukriti</title>
        <meta name="description" content="Real-time time-distance simulation with live train tracking and KPIs for Kottavalasa to Palasa section." />
      </Helmet>
      <MinimalDashboardLayout title="Freight Analysis">
        <div className="space-y-6">
          {/* Main Headline Section */}
          <Card className="p-6 bg-gradient-to-r from-muted/30 to-muted/10 border-border">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground mb-2">
              Kottavalasa <span className="text-primary">→</span> Palasa Digital Twin
            </h1>
            <p className="text-muted-foreground">
              Real-time time–distance + map with 36 trains (14 Passenger, 22 Freight) and live KPIs.
            </p>
          </Card>
          
          <RouteVisualization />
          <DisruptionManager />
          
          <Tabs defaultValue="time-distance">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="time-distance">Time vs Distance Simulation</TabsTrigger>
              <TabsTrigger value="block-diagram">Block Diagram</TabsTrigger>
              <TabsTrigger value="simulation">Scenario Simulation</TabsTrigger>
              <TabsTrigger value="comparison">Path Comparison</TabsTrigger>
              <TabsTrigger value="stoppage">Stoppage Analysis</TabsTrigger>
              <TabsTrigger value="throughput">Throughput Dashboard</TabsTrigger>
              <TabsTrigger value="import">Data Import</TabsTrigger>
            </TabsList>
            
            <TabsContent value="time-distance" className="mt-4">
              <Card className="p-4 border-border">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Time vs Distance Simulation</h3>
                  <p className="text-sm text-muted-foreground">Live Marey diagram · KTV → PSA</p>
                </div>
                <FreightGanttChart />
              </Card>
            </TabsContent>
            
            <TabsContent value="block-diagram" className="mt-4">
              <RealTimeBlockDiagram />
            </TabsContent>
            
            <TabsContent value="simulation" className="mt-4">
              <ScenarioSimulation trains={trains} />
            </TabsContent>
            
            <TabsContent value="comparison" className="mt-4">
              <FreightPathComparison />
            </TabsContent>
            
            <TabsContent value="stoppage" className="mt-4">
              <StoppageAnalysis />
            </TabsContent>
            
            <TabsContent value="throughput" className="mt-4">
              <FreightThroughputDashboard />
            </TabsContent>
            
            <TabsContent value="import" className="mt-4">
              <RailwayDataImporter />
            </TabsContent>
          </Tabs>
        </div>
      </MinimalDashboardLayout>
    </>
  );
};

export default FreightAnalysis;
