import { fetchLeadsData } from '../utils/fetchLeadsData';
import { fetchHRData } from '../utils/fetchHRData';
import DashboardContent from '../components/LeadsDashboard/DashboardContent';
import Header from '../components/header/Header';

export const metadata = {
  title: 'Lead Performance Dashboard',
};

export default async function Home() {
  const [{ data, error }, { data: hrData }] = await Promise.all([
    fetchLeadsData(),
    fetchHRData(),
  ]);
  return <DashboardContent data={data} error={error} company="BP" hrData={hrData} />;
}
