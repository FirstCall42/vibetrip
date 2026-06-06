'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createItineraryAction, logoutAction } from './actions';

export default function DashboardClient({ initialItineraries, user, isCloud }) {
  const [itineraries, setItineraries] = useState(initialItineraries);
  const [showForm, setShowForm] = useState(false);
  
  // Dynamic helper for today's YYYY-MM-DD
  const getTodayDateString = () => {
    const d = new Date();
    const pad = (n) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  };

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: getTodayDateString(),
    end_date: getTodayDateString()
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    const res = await logoutAction();
    if (res.success) {
      window.location.reload();
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title) {
      setError('Please fill in the Trip Title.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createItineraryAction(formData);
      if (result.success) {
        setItineraries(prev => [result.itinerary, ...prev]);
        setShowForm(false);
        setFormData({ 
          title: '', 
          description: '', 
          start_date: getTodayDateString(), 
          end_date: getTodayDateString() 
        });
      } else {
        setError(result.error || 'Failed to create itinerary.');
      }
    } catch (err) {
      setError(err?.message || 'Failed to create itinerary.');
    } finally {
      setLoading(false);
    }
  };

  // Helper to format date strings nicely
  const formatDateRange = (start, end) => {
    const s = new Date(start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    const e = new Date(end).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    return `${s} – ${e}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Navigation */}
      <header className="nav-header">
        <div className="container flex-between">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ 
              fontSize: '1.6rem', 
              fontWeight: 800, 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-family-title)'
            }}>
              VibeTrip
            </span>
            <span style={{
              fontSize: '0.75rem',
              background: 'var(--border-color)',
              color: 'var(--text-muted)',
              padding: '2px 8px',
              borderRadius: 'var(--radius-full)',
              fontWeight: 500
            }}>
              v1.0
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {user ? (
              <>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Hello, <strong style={{ color: 'var(--text-main)' }}>{user.name}</strong>
                </span>
                <button onClick={handleLogout} className="btn btn-secondary btn-sm">
                  Sign Out
                </button>
              </>
            ) : (
              <Link href="/login" className="btn btn-primary btn-sm">
                Planner Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Hero & Dashboard */}
      <main className="container" style={{ flex: 1, padding: '40px 24px' }}>
        <div style={{ marginBottom: '48px', textAlign: 'center' }} className="animate-fade-in">
          <h1 style={{ 
            fontSize: '3rem', 
            fontWeight: 800, 
            lineHeight: 1.2, 
            marginBottom: '16px',
            background: 'linear-gradient(to right, var(--text-main) 30%, var(--text-muted) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            Coordinate Family Travel Seamlessly
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.15rem', maxWidth: '600px', margin: '0 auto 24px auto' }}>
            Create public timelines for family trips. Link flights, trains, hotel check-ins, and group dinners so everyone stays in sync.
          </p>
          
          {user && !showForm && (
            <button onClick={() => setShowForm(true)} className="btn btn-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create New Itinerary
            </button>
          )}
        </div>

        {/* Create Itinerary Form */}
        {showForm && (
          <div className="glass animate-fade-in" style={{ padding: '32px', maxWidth: '600px', margin: '0 auto 40px auto', position: 'relative' }}>
            <button 
              onClick={() => setShowForm(false)} 
              style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
            <h2 style={{ marginBottom: '24px', fontSize: '1.5rem' }}>Create Trip Itinerary</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Trip Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" 
                  name="title" 
                  className="form-input" 
                  placeholder="e.g., Summer Family Reunion in Rome" 
                  value={formData.title} 
                  onChange={handleInputChange} 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  name="description" 
                  className="form-input" 
                  rows="3" 
                  placeholder="Describe your trip, location, or sharing notes..." 
                  value={formData.description} 
                  onChange={handleInputChange}
                  style={{ resize: 'vertical' }}
                />
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '16px' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Itinerary'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Trips Grid */}
        <h2 style={{ fontSize: '1.6rem', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          {user ? 'Your Managed Itineraries' : 'Sample & Public Itineraries'}
        </h2>

        {itineraries.length === 0 ? (
          <div className="glass" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ marginBottom: '16px' }}>No itineraries created yet.</p>
            {!user && (
              <p style={{ fontSize: '0.9rem' }}>
                Please <Link href="/login" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Sign In</Link> to create and manage itineraries.
              </p>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
            {itineraries.map((itinerary) => {
              const isActive = new Date() <= new Date(itinerary.end_date);
              return (
                <div key={itinerary.id} className="glass glass-hover animate-fade-in" style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      background: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)', 
                      color: isActive ? 'var(--success)' : 'var(--text-muted)',
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-full)',
                      fontWeight: 600
                    }}>
                      {isActive ? 'Upcoming' : 'Past Trip'}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      🔑 Public URL
                    </span>
                  </div>

                  <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>
                    {itinerary.title}
                  </h3>

                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                    📅 {formatDateRange(itinerary.start_date, itinerary.end_date)}
                  </p>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '24px', flex: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {itinerary.description || 'No description provided.'}
                  </p>

                  <div style={{ display: 'flex', gap: '12px' }}>
                    <Link href={`/itinerary/${itinerary.id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                      View Itinerary
                    </Link>
                    {user && (!isCloud || itinerary.owner_id === user.id) && (
                      <Link href={`/itinerary/${itinerary.id}/edit`} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="glass" style={{ borderLeft: 'none', borderRight: 'none', borderBottom: 'none', borderRadius: 0, padding: '24px 0', marginTop: '60px', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <div className="container">
          <p>© {new Date().getFullYear()} VibeTrip. Plan, coordinate, and enjoy travel together.</p>
        </div>
      </footer>
    </div>
  );
}
