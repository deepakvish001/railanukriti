import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { AlertsPanel } from '@/components/dashboard/AlertsPanel';

const Alerts = () => {
  return (
    <>
      <Helmet>
        <title>Active Alerts | Railway Traffic Management</title>
        <meta name="description" content="Active alerts and notifications for railway operations." />
      </Helmet>
      <MinimalDashboardLayout title="Active Alerts">
        <AlertsPanel className="h-full" />
      </MinimalDashboardLayout>
    </>
  );
};

export default Alerts;
