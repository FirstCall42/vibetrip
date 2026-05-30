import { getItinerariesAction, getCurrentUser } from './actions';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  const itineraries = await getItinerariesAction();

  return (
    <DashboardClient 
      initialItineraries={itineraries} 
      user={user} 
    />
  );
}
