'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatLocalTime, getGmtOffsetDisplay } from '@/lib/timezoneUtils';

export default function ItineraryViewClient({ itinerary, travelers, events, isOwner }) {
  const [selectedTravelerId, setSelectedTravelerId] = useState('all');
  const [countdownText, setCountdownText] = useState('');

  const filteredEvents = selectedTravelerId === 'all'
    ? events
    : events.filter(e => e.traveler_ids && e.traveler_ids.includes(selectedTravelerId));

  const getRelativeTimeDisplay = (startTimeStr, endTimeStr) => {
    if (!startTimeStr) return null;
    const now = new Date();
    const start = new Date(startTimeStr);
    const end = endTimeStr ? new Date(endTimeStr) : null;

    if (now > start) {
      if (end && now < end) {
        const diffMs = end - now;
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (diffHrs > 0) {
          return { text: `Active now • ends in ${diffHrs}h ${diffMins}m`, status: 'active' };
        }
        return { text: `Active now • ends in ${diffMins}m`, status: 'active' };
      }
      return { text: 'Completed', status: 'completed' };
    }

    const diffMs = start - now;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHrs = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffDays > 0) {
      return { text: `Starts in ${diffDays}d ${diffHrs % 24}h`, status: 'future' };
    } else if (diffHrs > 0) {
      return { text: `Starts in ${diffHrs}h ${diffMins % 60}m`, status: 'future' };
    } else if (diffMins > 0) {
      return { text: `Starts in ${diffMins}m`, status: 'future' };
    }
    return { text: 'Starting now', status: 'active' };
  };

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'active':
        return {
          background: 'rgba(16, 185, 129, 0.12)',
          color: 'var(--success)',
          border: '1px solid rgba(16, 185, 129, 0.2)'
        };
      case 'completed':
        return {
          background: 'rgba(148, 163, 184, 0.08)',
          color: 'var(--text-muted)',
          border: '1px solid rgba(148, 163, 184, 0.15)'
        };
      case 'future':
      default:
        return {
          background: 'rgba(99, 102, 241, 0.08)',
          color: 'var(--primary)',
          border: '1px solid rgba(99, 102, 241, 0.15)'
        };
    }
  };

  const renderTimeAndCountdown = (startTimeStr, endTimeStr, timezone) => {
    if (!startTimeStr) return null;
    const formattedStart = formatEventTime(startTimeStr, timezone);
    const relativeTime = getRelativeTimeDisplay(startTimeStr, endTimeStr);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', textAlign: 'right' }}>
        <span style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text-main)' }}>
          {formattedStart}
        </span>
        {relativeTime && (
          <span style={{
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            ...getStatusBadgeStyle(relativeTime.status)
          }}>
            {relativeTime.status === 'completed' && '✓ '}
            {relativeTime.status === 'active' && '🟢 '}
            {relativeTime.status === 'future' && '⏳ '}
            {relativeTime.text}
          </span>
        )}
      </div>
    );
  };

  // Next event countdown logic
  useEffect(() => {
    const calculateCountdown = () => {
      const now = new Date();
      const upcoming = events.find(e => new Date(e.start_time) > now);

      if (!upcoming) {
        setCountdownText('No upcoming events scheduled.');
        return;
      }

      const diffMs = new Date(upcoming.start_time) - now;
      const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffHrs / 24);

      if (diffDays > 0) {
        setCountdownText(`Next event starts in ${diffDays} day${diffDays > 1 ? 's' : ''} (${upcoming.title}).`);
      } else if (diffHrs > 0) {
        const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        setCountdownText(`Next event starts in ${diffHrs}h ${mins}m (${upcoming.title}).`);
      } else {
        const mins = Math.floor(diffMs / (1000 * 60));
        setCountdownText(`Next event starts in ${mins} minute${mins !== 1 ? 's' : ''}! (${upcoming.title})`);
      }
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 60000); // update every minute
    return () => clearInterval(interval);
  }, [events]);

  const getEventIcon = (type) => {
    switch (type) {
      case 'flight':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
          </svg>
        );
      case 'train':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="4" y="3" width="16" height="16" rx="2"></rect>
            <line x1="4" y1="11" x2="20" y2="11"></line>
            <line x1="8" y1="15" x2="8" y2="15.01"></line>
            <line x1="16" y1="15" x2="16" y2="15.01"></line>
            <line x1="6" y1="19" x2="8" y2="21"></line>
            <line x1="18" y1="19" x2="16" y2="21"></line>
          </svg>
        );
      case 'hotel':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        );
      case 'activity':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        );
      case 'transit':
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="10" width="14" height="7" rx="1"></rect>
            <circle cx="7" cy="17" r="2"></circle>
            <circle cx="17" cy="17" r="2"></circle>
            <path d="M19 10l-2-6H7L5 10"></path>
          </svg>
        );
      default:
        return (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        );
    }
  };

  const formatEventTime = (isoString, timezone = 'America/New_York') => {
    try {
      return formatLocalTime(isoString, timezone);
    } catch (e) {
      // Fallback to UTC format if timezone formatting fails
      const d = new Date(isoString);
      const pad = (n) => n.toString().padStart(2, '0');
      const dayName = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
      const dateStr = `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
      const timeStr = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
      return `${dayName}, ${dateStr} • ${timeStr} UTC`;
    }
  };

  const getTravelerColor = (id) => {
    const t = travelers.find(trav => trav.id === id);
    return t ? t.color_code : 'var(--text-muted)';
  };

  const getTravelerName = (id) => {
    const t = travelers.find(trav => trav.id === id);
    return t ? t.name : 'Unknown';
  };

  const getGoogleMapsLink = (mapsUrl, address, locationName) => {
    // Use direct maps URL if available, otherwise search by address or location name
    if (mapsUrl) return mapsUrl;
    
    const searchQuery = address || locationName;
    if (!searchQuery) return null;
    const encodedQuery = encodeURIComponent(searchQuery);
    return `https://www.google.com/maps/search/${encodedQuery}`;
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header bar */}
      <header className="nav-header">
        <div className="container flex-between">
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ 
              fontSize: '1.4rem', 
              fontWeight: 800, 
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent-cyan) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontFamily: 'var(--font-family-title)'
            }}>
              VibeTrip
            </span>
          </Link>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href="/" className="btn btn-secondary btn-sm">
              ← Dashboard
            </Link>
            {isOwner && (
              <Link href={`/itinerary/${itinerary.id}/edit`} className="btn btn-primary btn-sm">
                Edit Timeline
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Banner */}
      <section style={{ 
        background: 'linear-gradient(180deg, rgba(99, 102, 241, 0.05) 0%, transparent 100%)',
        padding: '60px 0 30px 0',
        borderBottom: '1px solid var(--border-color)',
        textAlign: 'center'
      }}>
        <div className="container">
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '12px' }}>
            {itinerary.title}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: '700px', margin: '0 auto 20px auto' }}>
            {itinerary.description}
          </p>

          {/* Time Countdown Panel */}
          {events.length > 0 && (
            <div className="glass" style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '8px', 
              padding: '8px 16px', 
              fontSize: '0.9rem',
              borderRadius: 'var(--radius-full)',
              color: 'var(--primary)',
              fontWeight: 600,
              backgroundColor: 'rgba(99, 102, 241, 0.08)'
            }}>
              ⏱️ {countdownText}
            </div>
          )}
        </div>
      </section>

      {/* Timeline Controls & Filter */}
      <section className="container" style={{ flex: 1, padding: '40px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
            Filter Timeline by Traveler
          </h3>
          
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button 
              onClick={() => setSelectedTravelerId('all')}
              className="btn"
              style={{
                padding: '6px 16px',
                fontSize: '0.85rem',
                borderRadius: 'var(--radius-full)',
                background: selectedTravelerId === 'all' ? 'var(--primary)' : 'rgba(255,255,255,0.03)',
                color: selectedTravelerId === 'all' ? 'white' : 'var(--text-main)',
                border: '1px solid ' + (selectedTravelerId === 'all' ? 'var(--primary)' : 'var(--border-color)'),
              }}
            >
              All Travelers ({travelers.length})
            </button>

            {travelers.map(t => (
              <button 
                key={t.id}
                onClick={() => setSelectedTravelerId(t.id)}
                className="btn"
                style={{
                  padding: '6px 16px',
                  fontSize: '0.85rem',
                  borderRadius: 'var(--radius-full)',
                  background: selectedTravelerId === t.id ? t.color_code : 'rgba(255,255,255,0.03)',
                  color: selectedTravelerId === t.id ? '#fff' : 'var(--text-main)',
                  border: '1px solid ' + (selectedTravelerId === t.id ? t.color_code : 'var(--border-color)'),
                  boxShadow: selectedTravelerId === t.id ? `0 0 10px ${t.color_code}44` : 'none'
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: selectedTravelerId === t.id ? '#fff' : t.color_code,
                  marginRight: '6px'
                }}></span>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline View */}
        {filteredEvents.length === 0 ? (
          <div className="glass" style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <p>No events scheduled for the selected filters.</p>
          </div>
        ) : (
          <div className="timeline">
            {filteredEvents.map((event, idx) => {
              // Color helper for badges based on event type
              let typeColor = 'var(--primary)';
              if (event.type === 'train') typeColor = 'var(--accent-cyan)';
              if (event.type === 'hotel') typeColor = 'var(--success)';
              if (event.type === 'activity') typeColor = 'var(--warning)';
              if (event.type === 'transit') typeColor = 'var(--accent-cyan)';

              return (
                <div key={event.id} className="timeline-item animate-fade-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                  {/* Circle dot marker */}
                  <span className="timeline-badge" style={{ borderColor: typeColor }}></span>
                  
                  {/* Event Card */}
                  <div className="glass glass-hover" style={{ padding: '24px', marginLeft: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                      <span style={{
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: typeColor,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                      }}>
                        {getEventIcon(event.type)}
                        {event.type}
                      </span>
                      {renderTimeAndCountdown(event.start_time, event.end_time, event.start_timezone || event.timezone || 'America/New_York')}
                    </div>

                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, marginBottom: '6px' }}>
                      {event.title}
                    </h3>

                    {/* Location Row */}
                    {event.location_name && (
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          📍 <span>{event.location_name}</span>
                          {event.address && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>({event.address})</span>}
                        </span>
                        {(event.address || event.location_name || event.maps_url) && (
                          <a 
                            href={getGoogleMapsLink(event.maps_url, event.address, event.location_name)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '0.8rem',
                              color: 'var(--accent-cyan)',
                              textDecoration: 'none',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid rgba(6, 182, 212, 0.3)',
                              transition: 'all 0.2s ease',
                              cursor: 'pointer'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(6, 182, 212, 0.08)';
                              e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.6)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                              e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.3)';
                            }}
                          >
                            🗺️ Maps
                          </a>
                        )}
                      </p>
                    )}

                    {/* Timezone Info */}
                    {(() => {
                      const startOffset = getGmtOffsetDisplay(event.start_time);
                      const endOffset = event.end_time ? getGmtOffsetDisplay(event.end_time) : null;
                      
                      if (!event.end_time || startOffset === endOffset) {
                        return (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🕐 Times are local to event ({startOffset || 'GMT'})
                          </p>
                        );
                      } else {
                        return (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🕐 Starts in local {startOffset} • Ends in local {endOffset}
                          </p>
                        );
                      }
                    })()}

                    {/* Details Block (Specific by Type) */}
                    <div style={{ 
                      background: 'rgba(255,255,255,0.02)', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: 'var(--radius-sm)',
                      padding: '16px',
                      fontSize: '0.9rem',
                      marginBottom: '20px'
                    }}>
                      {event.type === 'flight' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                          <div><strong>Flight No:</strong> {event.details.flight_number || 'N/A'}</div>
                           {event.end_time && (
                            <div>
                              <strong>Arrival:</strong> {formatEventTime(event.end_time, event.end_timezone || event.timezone || 'America/New_York')}{' '}
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                ({getGmtOffsetDisplay(event.end_time) || 'GMT'})
                              </span>
                            </div>
                          )}
                          {event.details.notes && <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong> {event.details.notes}</div>}
                          {event.details.flight_number && (
                            <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed var(--border-color)', paddingTop: '12px', marginTop: '4px' }}>
                              <a 
                                href={`https://www.flightradar24.com/data/flights/${event.details.flight_number.replace(/\s+/g, '').toLowerCase()}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--accent-cyan)', borderColor: 'rgba(6, 182, 212, 0.3)' }}
                              >
                                ✈️ Track Live on Flightradar24
                              </a>
                            </div>
                          )}
                        </div>
                      )}

                      {event.type === 'train' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                          <div><strong>Train:</strong> {event.details.train_number || 'N/A'}</div>
                          <div><strong>Seats:</strong> Coach {event.details.coach || 'N/A'} • Seat {event.details.seats || 'N/A'}</div>
                          {event.details.notes && <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong> {event.details.notes}</div>}
                        </div>
                      )}

                      {event.type === 'hotel' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                          <div><strong>Phone:</strong> {event.details.phone || 'N/A'}</div>
                           {event.end_time && (
                            <div>
                              <strong>Checkout:</strong> {formatEventTime(event.end_time, event.end_timezone || event.timezone || 'America/New_York')}{' '}
                              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                ({getGmtOffsetDisplay(event.end_time) || 'GMT'})
                              </span>
                            </div>
                          )}
                          {event.details.notes && <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong> {event.details.notes}</div>}
                        </div>
                      )}

                      {event.type === 'activity' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                          <div><strong>Reservation:</strong> {event.details.reservation_name || 'N/A'}</div>
                          <div><strong>Headcount:</strong> {event.details.headcount || 'N/A'} guests</div>
                          {event.details.notes && <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong> {event.details.notes}</div>}
                        </div>
                      )}

                      {event.type === 'transit' && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                          <div><strong>Service:</strong> {event.details.company || 'N/A'}</div>
                          <div><strong>Confirmation:</strong> {event.details.confirmation || 'N/A'}</div>
                          {event.details.notes && <div style={{ gridColumn: '1 / -1' }}><strong>Notes:</strong> {event.details.notes}</div>}
                        </div>
                      )}
                    </div>

                    {/* Associated Travelers tag list */}
                    {event.traveler_ids && event.traveler_ids.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Travelers:</span>
                        {event.traveler_ids.map(tid => {
                          const tColor = getTravelerColor(tid);
                          return (
                            <span 
                              key={tid} 
                              style={{
                                fontSize: '0.75rem',
                                color: tColor,
                                border: `1px solid ${tColor}44`,
                                background: `${tColor}10`,
                                padding: '2px 8px',
                                borderRadius: 'var(--radius-full)',
                                fontWeight: 500
                              }}
                            >
                              {getTravelerName(tid)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
