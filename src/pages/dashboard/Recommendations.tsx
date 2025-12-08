import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { AIRecommendations } from '@/components/dashboard/AIRecommendations';
import { useAIRecommendations } from '@/hooks/useRailwayData';

const Recommendations = () => {
  const { recommendations } = useAIRecommendations();

  return (
    <>
      <Helmet>
        <title>AI Recommendations | Railway Traffic Management</title>
        <meta name="description" content="AI-powered recommendations for train traffic optimization." />
      </Helmet>
      <MinimalDashboardLayout title="AI Recommendations">
        <AIRecommendations recommendations={recommendations} />
      </MinimalDashboardLayout>
    </>
  );
};

export default Recommendations;
