import Link from 'next/link';
import { getItineraryAction, getTravelersAction, getEventsAction, getCurrentUser } from '../../actions';
import ItineraryViewClient from './ItineraryViewClient';

export const dynamic = 'force-dynamic';

export default async function ItineraryPage({ params }) {
  const { id } = await params;

  // Parallel database fetch
  const [itinerary, travelers, events, user] = await Promise.all([
    getItineraryAction(id),
    getTravelersAction(id),
    getEventsAction(id),
    getCurrentUser()
  ]);

  if (!itinerary) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        flexDirection: 'column',
        padding: '24px',
        textAlign: 'center'
      }}>
        <div className="glass" style={{ padding: '40px', maxWidth: '480px' }}>
          <span style={{ fontSize: '3rem', marginBottom: '16px', display: 'block' }}>🔍</span>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px' }}>Itinerary Not Found</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.95rem' }}>
            We couldn't find the itinerary you are looking for. It may have been deleted, or the link is incorrect.
          </p>
          <Link href="/" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Go Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Owner checking: in local mode, anyone authenticated is an owner/editor
  const isOwner = !!user;

  return (
    <ItineraryViewClient 
      itinerary={itinerary}
      travelers={travelers}
      events={events}
      isOwner={isOwner}
    />
  );
}
