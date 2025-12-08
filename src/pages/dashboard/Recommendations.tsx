import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
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
      <DashboardLayout title="AI Recommendations">
        <AIRecommendations recommendations={recommendations} />
      </DashboardLayout>
    </>
  );
};

export default Recommendations;
