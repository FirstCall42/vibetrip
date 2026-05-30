import { getItinerariesAction, getCurrentUser, isUserAdmin } from './actions';
import DashboardClient from './DashboardClient';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getCurrentUser();
  const itineraries = await getItinerariesAction();
  const isAdmin = user ? await isUserAdmin(user) : false;

  return (
    <DashboardClient 
      initialItineraries={itineraries} 
      user={user} 
      isAdmin={isAdmin}
    />
  );
}
