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

const FreightAnalysis = () => {
  return (
    <>
      <Helmet>
        <title>Freight Throughput Analysis | RailAnukriti</title>
        <meta name="description" content="Maximize freight train throughput with real-time analysis of delays, halts, and stoppages." />
      </Helmet>
      <MinimalDashboardLayout title="Freight Throughput Analysis">
        <div className="space-y-6">
          <RouteVisualization />
          <DisruptionManager />
          
          <Tabs defaultValue="gantt">
            <TabsList>
              <TabsTrigger value="gantt">Time-Distance Chart</TabsTrigger>
              <TabsTrigger value="comparison">Path Comparison</TabsTrigger>
              <TabsTrigger value="stoppage">Stoppage Analysis</TabsTrigger>
              <TabsTrigger value="throughput">Throughput Dashboard</TabsTrigger>
              <TabsTrigger value="import">Data Import</TabsTrigger>
            </TabsList>
            
            <TabsContent value="comparison">
              <FreightPathComparison />
            </TabsContent>
            
            <TabsContent value="gantt">
              <FreightGanttChart />
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
