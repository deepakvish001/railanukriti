import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { ConflictDetection } from '@/components/dashboard/ConflictDetection';

const Conflicts = () => {
  return (
    <>
      <Helmet>
        <title>Conflict Detection | Railway Traffic Management</title>
        <meta name="description" content="Real-time conflict detection for train traffic." />
      </Helmet>
      <MinimalDashboardLayout title="Conflict Detection">
        <ConflictDetection />
      </MinimalDashboardLayout>
    </>
  );
};

export default Conflicts;
