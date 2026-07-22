import { fetchLeadsData } from '../utils/fetchLeadsData';
import { fetchHRData } from '../utils/fetchHRData';
import { fetchDriversData } from '../utils/fetchDriversData';
import DashboardContent from '../components/LeadsDashboard/DashboardContent';

export const metadata = {
  title: 'Lead Performance Dashboard',
};

export default async function Home() {
  const [{ data, error }, { data: hrData }, driversData] = await Promise.all([
    fetchLeadsData(),
    fetchHRData(),
    fetchDriversData(),
  ]);
  return (
    <DashboardContent
      data={data}
      error={error}
      company="BP"
      hrData={hrData}
      driversData={driversData}
    />
  );
}
