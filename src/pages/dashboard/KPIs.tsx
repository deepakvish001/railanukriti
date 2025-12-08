import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { KPIDashboard } from '@/components/dashboard/KPIDashboard';

const KPIs = () => {
  return (
    <>
      <Helmet>
        <title>KPI Dashboard | Railway Traffic Management</title>
        <meta name="description" content="Key performance indicators for railway operations." />
      </Helmet>
      <DashboardLayout title="KPI Dashboard">
        <KPIDashboard />
      </DashboardLayout>
    </>
  );
};

export default KPIs;
