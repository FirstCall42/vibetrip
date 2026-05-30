import { redirect } from 'next/navigation';
import { getItineraryAction, getTravelersAction, getEventsAction, getCurrentUser } from '../../../actions';
import ItineraryEditClient from './ItineraryEditClient';

export const dynamic = 'force-dynamic';

export default async function ItineraryEditPage({ params }) {
  const { id } = await params;

  // Retrieve current session
  const user = await getCurrentUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch itinerary details in parallel
  const [itinerary, travelers, events] = await Promise.all([
    getItineraryAction(id),
    getTravelersAction(id),
    getEventsAction(id)
  ]);

  if (!itinerary) {
    redirect('/');
  }

  return (
    <ItineraryEditClient 
      itinerary={itinerary}
      travelers={travelers}
      events={events}
    />
  );
}
