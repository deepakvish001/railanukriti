import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuditLog } from '@/components/dashboard/AuditLog';

const Audit = () => {
  return (
    <>
      <Helmet>
        <title>Audit Log | Railway Traffic Management</title>
        <meta name="description" content="Audit trail for all railway operations." />
      </Helmet>
      <DashboardLayout title="Audit Log">
        <AuditLog />
      </DashboardLayout>
    </>
  );
};

export default Audit;
