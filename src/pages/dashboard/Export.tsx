import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { ExportPanel } from '@/components/dashboard/ExportPanel';

const Export = () => {
  return (
    <>
      <Helmet>
        <title>Export Data | Railway Traffic Management</title>
        <meta name="description" content="Export railway operations data." />
      </Helmet>
      <MinimalDashboardLayout title="Export Data">
        <ExportPanel />
      </MinimalDashboardLayout>
    </>
  );
};

export default Export;
