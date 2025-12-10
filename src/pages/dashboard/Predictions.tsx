import { Helmet } from 'react-helmet-async';
import { MinimalDashboardLayout } from '@/components/dashboard/MinimalDashboardLayout';
import { DelayPrediction } from '@/components/dashboard/DelayPrediction';

const Predictions = () => {
  return (
    <>
      <Helmet>
        <title>Delay Prediction | Railway Traffic Management</title>
        <meta name="description" content="AI-powered delay predictions for train traffic." />
      </Helmet>
      <MinimalDashboardLayout title="AI Delay Prediction">
        <DelayPrediction />
      </MinimalDashboardLayout>
    </>
  );
};

export default Predictions;
