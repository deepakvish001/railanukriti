import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { DelayPrediction } from '@/components/dashboard/DelayPrediction';

const Predictions = () => {
  return (
    <>
      <Helmet>
        <title>Delay Prediction | Railway Traffic Management</title>
        <meta name="description" content="AI-powered delay predictions for train traffic." />
      </Helmet>
      <DashboardLayout title="AI Delay Prediction">
        <DelayPrediction />
      </DashboardLayout>
    </>
  );
};

export default Predictions;
