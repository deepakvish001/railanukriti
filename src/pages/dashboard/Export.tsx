import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ExportPanel } from '@/components/dashboard/ExportPanel';

const Export = () => {
  return (
    <>
      <Helmet>
        <title>Export Data | Railway Traffic Management</title>
        <meta name="description" content="Export railway operations data." />
      </Helmet>
      <DashboardLayout title="Export Data">
        <ExportPanel />
      </DashboardLayout>
    </>
  );
};

export default Export;
