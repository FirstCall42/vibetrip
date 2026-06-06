import { getItinerariesAction, getCurrentUser, isCloudMode } from './actions';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  const itineraries = await getItinerariesAction();
  const isCloud = await isCloudMode();

  return (
    <DashboardClient 
      initialItineraries={itineraries} 
      user={user} 
      isCloud={isCloud}
    />
  );
}
