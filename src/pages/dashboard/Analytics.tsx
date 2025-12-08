import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AnalyticsDashboard } from '@/components/dashboard/AnalyticsDashboard';

const Analytics = () => {
  return (
    <>
      <Helmet>
        <title>Analytics Dashboard | Railway Traffic Management</title>
        <meta name="description" content="Comprehensive analytics for railway operations." />
      </Helmet>
      <DashboardLayout title="Analytics Dashboard">
        <AnalyticsDashboard />
      </DashboardLayout>
    </>
  );
};

export default Analytics;
