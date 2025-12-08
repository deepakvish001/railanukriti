import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { AuditLog } from '@/components/dashboard/AuditLog';

const Audit = () => {
  return (
    <>
      <Helmet>
        <title>Audit Log | Railway Traffic Management</title>
        <meta name="description" content="Audit trail for all railway operations." />
      </Helmet>
      <MinimalDashboardLayout title="Audit Log">
        <AuditLog />
      </MinimalDashboardLayout>
    </>
  );
};

export default Audit;
