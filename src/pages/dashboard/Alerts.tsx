import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';

const Alerts = () => {
  return (
    <>
      <Helmet>
        <title>Active Alerts | Railway Traffic Management</title>
        <meta name="description" content="Active alerts and notifications for railway operations." />
      </Helmet>
      <DashboardLayout title="Active Alerts">
        <AlertsPanel className="h-full" />
      </DashboardLayout>
    </>
  );
};

export default Alerts;
