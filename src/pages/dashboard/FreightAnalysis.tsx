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

const FreightAnalysis = () => {
  const { trains } = useTrains();
  
  return (
    <>
      <Helmet>
        <title>Freight Analysis | RailAnukriti</title>
        <meta name="description" content="Freight train throughput analysis with block diagram, time-distance chart, and scenario simulation." />
      </Helmet>
      <MinimalDashboardLayout title="Freight Analysis">
        <div className="space-y-6">
          <RouteVisualization />
          <DisruptionManager />
          
          <Tabs defaultValue="time-distance">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="time-distance">Time-Distance Chart</TabsTrigger>
              <TabsTrigger value="block-diagram">Block Diagram</TabsTrigger>
              <TabsTrigger value="simulation">Scenario Simulation</TabsTrigger>
              <TabsTrigger value="comparison">Path Comparison</TabsTrigger>
              <TabsTrigger value="stoppage">Stoppage Analysis</TabsTrigger>
              <TabsTrigger value="throughput">Throughput Dashboard</TabsTrigger>
              <TabsTrigger value="import">Data Import</TabsTrigger>
            </TabsList>
            
            <TabsContent value="time-distance">
              <FreightGanttChart />
            </TabsContent>
            
            <TabsContent value="block-diagram">
              <RealTimeBlockDiagram />
            </TabsContent>
            
            <TabsContent value="simulation">
              <ScenarioSimulation trains={trains} />
            </TabsContent>
            
            <TabsContent value="comparison">
              <FreightPathComparison />
            </TabsContent>
            
            <TabsContent value="stoppage">
              <StoppageAnalysis />
            </TabsContent>
            
            <TabsContent value="throughput">
              <FreightThroughputDashboard />
            </TabsContent>
            
            <TabsContent value="import">
              <RailwayDataImporter />
            </TabsContent>
          </Tabs>
        </div>
      </MinimalDashboardLayout>
    </>
  );
};

export default FreightAnalysis;
