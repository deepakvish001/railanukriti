import { Helmet } from 'react-helmet-async';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { ScenarioSimulation } from '@/components/dashboard/ScenarioSimulation';
import { useTrains } from '@/hooks/useRailwayData';

const Simulation = () => {
  const { trains } = useTrains();

  return (
    <>
      <Helmet>
        <title>Scenario Simulation | Railway Traffic Management</title>
        <meta name="description" content="What-if scenario simulation for train operations." />
      </Helmet>
      <DashboardLayout title="Scenario Simulation">
        <ScenarioSimulation trains={trains} />
      </DashboardLayout>
    </>
  );
};

export default Simulation;
