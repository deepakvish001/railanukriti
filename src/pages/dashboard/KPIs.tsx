import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { KPIDashboard } from '@/components/dashboard/KPIDashboard';

const KPIs = () => {
  return (
    <>
      <Helmet>
        <title>KPI Dashboard | Railway Traffic Management</title>
        <meta name="description" content="Key performance indicators for railway operations." />
      </Helmet>
      <MinimalDashboardLayout title="KPI Dashboard">
        <KPIDashboard />
      </MinimalDashboardLayout>
    </>
  );
};

export default KPIs;
