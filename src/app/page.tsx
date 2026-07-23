import { fetchLeadsData } from '../utils/fetchLeadsData';
import { fetchHRData } from '../utils/fetchHRData';
import { fetchBPRosterData } from '../utils/fetchRosterData';
import DashboardContent from '../components/LeadsDashboard/DashboardContent';

export const metadata = {
  title: 'Lead Performance Dashboard',
};

export default async function Home() {
  const [{ data, error }, { data: hrData }, { drivers: rosterData }] = await Promise.all([
    fetchLeadsData(),
    fetchHRData(),
    fetchBPRosterData(),
  ]);
  return (
    <DashboardContent
      data={data}
      error={error}
      company="BP"
      hrData={hrData}
      rosterData={rosterData}
    />
  );
}
