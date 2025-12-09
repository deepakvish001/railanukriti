import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AIRecommendations } from '@/components/dashboard/AIRecommendations';
import { DelayPrediction } from '@/components/dashboard/DelayPrediction';
import { ConflictDetection } from '@/components/dashboard/ConflictDetection';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';

const AIPredictions = () => {
  return (
    <>
      <Helmet>
        <title>AI Predictions | RailAnukriti</title>
        <meta name="description" content="AI-powered predictions for train delays, conflicts, and recommendations." />
      </Helmet>
      <MinimalDashboardLayout title="AI Predictions & Alerts">
        <Tabs defaultValue="recommendations" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="recommendations">AI Recommendations</TabsTrigger>
            <TabsTrigger value="delays">Delay Prediction</TabsTrigger>
            <TabsTrigger value="conflicts">Conflict Detection</TabsTrigger>
            <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          </TabsList>
          
          <TabsContent value="recommendations">
            <AIRecommendations />
          </TabsContent>
          
          <TabsContent value="delays">
            <DelayPrediction />
          </TabsContent>
          
          <TabsContent value="conflicts">
            <ConflictDetection />
          </TabsContent>
          
          <TabsContent value="alerts">
            <AlertsPanel />
          </TabsContent>
        </Tabs>
      </MinimalDashboardLayout>
    </>
  );
};

export default AIPredictions;
