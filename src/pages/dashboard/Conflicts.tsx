import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ConflictDetection } from '@/components/dashboard/ConflictDetection';

const Conflicts = () => {
  return (
    <>
      <Helmet>
        <title>Conflict Detection | Railway Traffic Management</title>
        <meta name="description" content="Real-time conflict detection for train traffic." />
      </Helmet>
      <DashboardLayout title="Conflict Detection">
        <ConflictDetection />
      </DashboardLayout>
    </>
  );
};

export default Conflicts;
