import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';

const Analytics = () => {
  return (
    <>
      <Helmet>
        <title>Analytics Dashboard | Railway Traffic Management</title>
        <meta name="description" content="Comprehensive analytics for railway operations." />
      </Helmet>
      <MinimalDashboardLayout title="Analytics Dashboard">
        <AnalyticsDashboard />
      </MinimalDashboardLayout>
    </>
  );
};

export default Analytics;
