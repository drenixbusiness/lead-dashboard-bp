import { fetchLeadsData } from '../utils/fetchLeadsData';
import { fetchBPRosterData } from '../utils/fetchRosterData';
import DashboardContent from '../components/LeadsDashboard/DashboardContent';

export const metadata = {
  title: 'Lead Performance Dashboard',
};

export default async function Home() {
  const [{ data, error }, roster] = await Promise.all([
    fetchLeadsData(),
    fetchBPRosterData(),
  ]);

  return (
    <DashboardContent
      data={data}
      error={error}
      company="BP"
      hrData={roster.hrData}
      rosterData={roster.drivers}
    />
  );
}
