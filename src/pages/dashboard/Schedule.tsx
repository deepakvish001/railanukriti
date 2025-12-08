import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { TrainScheduleGantt } from '@/components/dashboard/TrainScheduleGantt';

const Schedule = () => {
  return (
    <>
      <Helmet>
        <title>Train Schedule | Railway Traffic Management</title>
        <meta name="description" content="Train schedule and Gantt chart visualization." />
      </Helmet>
      <MinimalDashboardLayout title="Train Schedule">
        <TrainScheduleGantt />
      </MinimalDashboardLayout>
    </>
  );
};

export default Schedule;
