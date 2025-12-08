import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { AIRecommendations } from '@/components/dashboard/AIRecommendations';
import { InfrastructureRecommendations } from '@/components/dashboard/InfrastructureRecommendations';
import { useAIRecommendations } from '@/hooks/useRailwayData';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Settings2 } from 'lucide-react';

const Recommendations = () => {
  const { recommendations } = useAIRecommendations();

  return (
    <>
      <Helmet>
        <title>AI Recommendations | RailAnukriti</title>
        <meta name="description" content="AI-powered recommendations for train traffic optimization and infrastructure upgrades." />
      </Helmet>
      <MinimalDashboardLayout title="AI Recommendations">
        <Tabs defaultValue="operations" className="space-y-4">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="operations" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Operational
            </TabsTrigger>
            <TabsTrigger value="infrastructure" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Infrastructure Upgrades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="operations">
            <AIRecommendations recommendations={recommendations} />
          </TabsContent>

          <TabsContent value="infrastructure">
            <InfrastructureRecommendations />
          </TabsContent>
        </Tabs>
      </MinimalDashboardLayout>
    </>
  );
};

export default Recommendations;
