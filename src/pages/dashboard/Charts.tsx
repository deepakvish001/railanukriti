import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { PerformanceCharts } from '@/components/dashboard/PerformanceCharts';

const Charts = () => {
  return (
    <>
      <Helmet>
        <title>Performance Charts | Railway Traffic Management</title>
        <meta name="description" content="Performance charts and analytics for railway operations." />
      </Helmet>
      <DashboardLayout title="Performance Charts">
        <PerformanceCharts />
      </DashboardLayout>
    </>
  );
};

export default Charts;
