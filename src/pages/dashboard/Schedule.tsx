import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { TrainScheduleGantt } from '@/components/dashboard/TrainScheduleGantt';

const Schedule = () => {
  return (
    <>
      <Helmet>
        <title>Train Schedule | Railway Traffic Management</title>
        <meta name="description" content="Train schedule and Gantt chart visualization." />
      </Helmet>
      <DashboardLayout title="Train Schedule">
        <TrainScheduleGantt />
      </DashboardLayout>
    </>
  );
};

export default Schedule;
