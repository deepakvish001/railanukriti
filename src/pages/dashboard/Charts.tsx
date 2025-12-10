import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { PerformanceCharts } from '@/components/dashboard/PerformanceCharts';

const Charts = () => {
  return (
    <>
      <Helmet>
        <title>Performance Charts | Railway Traffic Management</title>
        <meta name="description" content="Performance charts and analytics for railway operations." />
      </Helmet>
      <MinimalDashboardLayout title="Performance Charts">
        <PerformanceCharts />
      </MinimalDashboardLayout>
    </>
  );
};

export default Charts;
