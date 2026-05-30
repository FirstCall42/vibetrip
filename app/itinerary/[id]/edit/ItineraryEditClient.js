'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  updateItineraryAction, 
  deleteItineraryAction,
  createTravelerAction, 
  deleteTravelerAction,
  createEventAction, 
  updateEventAction, 
  deleteEventAction 
} from '../../../actions';

// Date utility to format to UTC datetime-local input
const toDatetimeLocalUTC = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
};

// Date utility to parse datetime-local string directly as UTC
const fromDatetimeLocalToUTC = (localString) => {
  if (!localString) return '';
  // Append Z to treat the browser form input as a UTC time value
  return new Date(localString + ':00.000Z').toISOString();
};

export default function ItineraryEditClient({ itinerary, travelers: initialTravelers, events: initialEvents }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('events'); // 'details' | 'travelers' | 'events'
  
  // Trip details state
  const [tripData, setTripData] = useState({
    title: itinerary.title,
    description: itinerary.description || '',
    start_date: itinerary.start_date,
    end_date: itinerary.end_date
  });
  const [detailsSaving, setDetailsSaving] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState(false);

  // Travelers state
  const [travelers, setTravelers] = useState(initialTravelers);
  const [newTravelerName, setNewTravelerName] = useState('');
  const [newTravelerColor, setNewTravelerColor] = useState('#6366f1');
  const [travelerError, setTravelerError] = useState('');
  const [travelerLoading, setTravelerLoading] = useState(false);

  // Events state
  const [events, setEvents] = useState(initialEvents);
  const [editingEventId, setEditingEventId] = useState(null); // null means adding a new event
  const [eventForm, setEventForm] = useState({
    type: 'flight',
    title: '',
    start_time: '',
    end_time: '',
    location_name: '',
    address: '',
    traveler_ids: [],
    details: {
      flight_number: '',
      confirmation: '',
      train_number: '',
      coach: '',
      seats: '',
      phone: '',
      reservation_name: '',
      headcount: '',
      notes: ''
    }
  });
  const [eventSaving, setEventSaving] = useState(false);
  const [eventError, setEventError] = useState('');

  // ------------------------------------
  // TRIP DETAILS HANDLERS
  // ------------------------------------
  const handleDetailsSubmit = async (e) => {
    e.preventDefault();
    setDetailsSaving(true);
    setDetailsSuccess(false);
    const res = await updateItineraryAction(itinerary.id, tripData);
    setDetailsSaving(false);
    if (res.success) {
      setDetailsSuccess(true);
      setTimeout(() => setDetailsSuccess(false), 3000);
      router.refresh();
    }
  };

  const handleTripDelete = async () => {
    if (confirm("Are you absolutely sure you want to delete this trip? This will delete all travelers and scheduled events, and cannot be undone.")) {
      const res = await deleteItineraryAction(itinerary.id);
      if (res.success) {
        router.push('/');
      }
    }
  };

  // ------------------------------------
  // TRAVELERS HANDLERS
  // ------------------------------------
  const handleAddTraveler = async (e) => {
    e.preventDefault();
    if (!newTravelerName.trim()) return;

    setTravelerLoading(true);
    setTravelerError('');

    const res = await createTravelerAction(itinerary.id, newTravelerName.trim(), newTravelerColor);
    setTravelerLoading(false);

    if (res.success) {
      setTravelers(prev => [...prev, res.traveler]);
      setNewTravelerName('');
      router.refresh();
    } else {
      setTravelerError(res.error || 'Failed to add traveler.');
    }
  };

  const handleDeleteTraveler = async (id) => {
    if (confirm("Delete this traveler? They will be removed from all associated events.")) {
      const res = await deleteTravelerAction(id, itinerary.id);
      if (res.success) {
        setTravelers(prev => prev.filter(t => t.id !== id));
        // Update local events state as well
        setEvents(prev => prev.map(evt => ({
          ...evt,
          traveler_ids: evt.traveler_ids ? evt.traveler_ids.filter(tid => tid !== id) : []
        })));
        router.refresh();
      }
    }
  };

  // ------------------------------------
  // EVENTS HANDLERS
  // ------------------------------------
  const handleEventFormChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith('details.')) {
      const field = name.split('.')[1];
      setEventForm(prev => ({
        ...prev,
        details: { ...prev.details, [field]: value }
      }));
    } else {
      setEventForm(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleEventTravelerToggle = (travelerId) => {
    setEventForm(prev => {
      const exists = prev.traveler_ids.includes(travelerId);
      const newIds = exists 
        ? prev.traveler_ids.filter(id => id !== travelerId)
        : [...prev.traveler_ids, travelerId];
      return { ...prev, traveler_ids: newIds };
    });
  };

  const resetEventForm = () => {
    setEditingEventId(null);
    setEventForm({
      type: 'flight',
      title: '',
      start_time: '',
      end_time: '',
      location_name: '',
      address: '',
      traveler_ids: [],
      details: {
        flight_number: '',
        confirmation: '',
        train_number: '',
        coach: '',
        seats: '',
        phone: '',
        reservation_name: '',
        headcount: '',
        notes: ''
      }
    });
    setEventError('');
  };

  const handleEventSubmit = async (e) => {
    e.preventDefault();
    if (!eventForm.title || !eventForm.start_time) {
      setEventError('Event Title and Start Time are required.');
      return;
    }

    setEventSaving(true);
    setEventError('');

    // Parse times timezone-safely into UTC strings
    const eventPayload = {
      itinerary_id: itinerary.id,
      type: eventForm.type,
      title: eventForm.title,
      start_time: fromDatetimeLocalToUTC(eventForm.start_time),
      end_time: eventForm.end_time ? fromDatetimeLocalToUTC(eventForm.end_time) : null,
      location_name: eventForm.location_name,
      address: eventForm.address,
      traveler_ids: eventForm.traveler_ids,
      details: eventForm.details
    };

    let res;
    if (editingEventId) {
      res = await updateEventAction(editingEventId, itinerary.id, eventPayload);
    } else {
      res = await createEventAction(eventPayload);
    }

    setEventSaving(false);

    if (res.success) {
      // Reload lists
      if (editingEventId) {
        setEvents(prev => prev.map(evt => evt.id === editingEventId ? res.event : evt).sort((a,b) => new Date(a.start_time) - new Date(b.start_time)));
      } else {
        setEvents(prev => [...prev, res.event].sort((a,b) => new Date(a.start_time) - new Date(b.start_time)));
      }
      resetEventForm();
      router.refresh();
    } else {
      setEventError(res.error || 'Failed to save event.');
    }
  };

  const handleEditEventClick = (event) => {
    setEditingEventId(event.id);
    setEventForm({
      type: event.type,
      title: event.title,
      start_time: toDatetimeLocalUTC(event.start_time),
      end_time: event.end_time ? toDatetimeLocalUTC(event.end_time) : '',
      location_name: event.location_name || '',
      address: event.address || '',
      traveler_ids: event.traveler_ids || [],
      details: {
        flight_number: event.details?.flight_number || '',
        confirmation: event.details?.confirmation || '',
        train_number: event.details?.train_number || '',
        coach: event.details?.coach || '',
        seats: event.details?.seats || '',
        phone: event.details?.phone || '',
        reservation_name: event.details?.reservation_name || '',
        headcount: event.details?.headcount || '',
        notes: event.details?.notes || ''
      }
    });
    setEventError('');
  };

  const handleDeleteEventClick = async (eventId) => {
    if (confirm("Delete this event from the itinerary?")) {
      const res = await deleteEventAction(eventId, itinerary.id);
      if (res.success) {
        setEvents(prev => prev.filter(e => e.id !== eventId));
        router.refresh();
      }
    }
  };

  // Swatches for color picker
  const colorSwatches = [
    { label: 'Indigo', value: '#6366f1' },
    { label: 'Cyan', value: '#06b6d4' },
    { label: 'Teal', value: '#0f766e' },
    { label: 'Emerald', value: '#10b981' },
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Orange', value: '#f97316' },
    { label: 'Rose', value: '#f43f5e' },
    { label: 'Purple', value: '#8b5cf6' },
    { label: 'Slate', value: '#64748b' }
  ];

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
            <Link href={`/itinerary/${itinerary.id}`} className="btn btn-secondary btn-sm">
              👁️ View Live Timeline
            </Link>
          </div>
        </div>
      </header>

      {/* Editor Main Content */}
      <main className="container" style={{ flex: 1, padding: '40px 24px' }}>
        <div style={{ marginBottom: '32px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Itinerary Editor</span>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginTop: '4px' }}>
            Configure: {tripData.title}
          </h1>
        </div>

        {/* Tab Selection */}
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid var(--border-color)', 
          marginBottom: '32px',
          gap: '16px'
        }}>
          <button 
            onClick={() => setActiveTab('events')} 
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'events' ? '3px solid var(--primary)' : '3px solid transparent',
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: activeTab === 'events' ? 700 : 500,
              color: activeTab === 'events' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            📋 Manage Events ({events.length})
          </button>
          
          <button 
            onClick={() => setActiveTab('travelers')} 
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'travelers' ? '3px solid var(--primary)' : '3px solid transparent',
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: activeTab === 'travelers' ? 700 : 500,
              color: activeTab === 'travelers' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            👥 Travelers ({travelers.length})
          </button>

          <button 
            onClick={() => setActiveTab('details')} 
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === 'details' ? '3px solid var(--primary)' : '3px solid transparent',
              padding: '12px 16px',
              fontSize: '1rem',
              fontWeight: activeTab === 'details' ? 700 : 500,
              color: activeTab === 'details' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)'
            }}
          >
            ⚙️ Trip Details
          </button>
        </div>

        {/* ==================================== */}
        {/* TAB: TRIP DETAILS                    */}
        {/* ==================================== */}
        {activeTab === 'details' && (
          <div className="glass animate-fade-in" style={{ padding: '32px', maxWidth: '700px' }}>
            <h2 style={{ fontSize: '1.4rem', marginBottom: '24px' }}>Itinerary General Settings</h2>
            
            <form onSubmit={handleDetailsSubmit}>
              <div className="form-group">
                <label className="form-label">Trip Title</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={tripData.title}
                  onChange={(e) => setTripData(prev => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Trip Description</label>
                <textarea 
                  className="form-input" 
                  rows="4" 
                  value={tripData.description}
                  onChange={(e) => setTripData(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Start Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={tripData.start_date}
                    onChange={(e) => setTripData(prev => ({ ...prev, start_date: e.target.value }))}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={tripData.end_date}
                    onChange={(e) => setTripData(prev => ({ ...prev, end_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px' }}>
                <button type="button" onClick={handleTripDelete} className="btn btn-danger">
                  Delete Entire Trip
                </button>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {detailsSuccess && <span style={{ color: 'var(--success)', fontSize: '0.9rem' }}>✓ Saved successfully</span>}
                  <button type="submit" className="btn btn-primary" disabled={detailsSaving}>
                    {detailsSaving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* ==================================== */}
        {/* TAB: TRAVELERS                       */}
        {/* ==================================== */}
        {activeTab === 'travelers' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', alignItems: 'start' }} className="animate-fade-in">
            {/* List of Travelers */}
            <div className="glass" style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '24px' }}>Current Travelers & Groups</h2>
              
              {travelers.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>No travelers defined. Add one below!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {travelers.map(t => (
                    <div 
                      key={t.id} 
                      className="glass" 
                      style={{ 
                        padding: '12px 16px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'between',
                        borderColor: `${t.color_code}44`,
                        background: `${t.color_code}05`
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                        <span style={{ 
                          width: '16px', 
                          height: '16px', 
                          borderRadius: '50%', 
                          background: t.color_code 
                        }}></span>
                        <strong style={{ fontSize: '0.95rem' }}>{t.name}</strong>
                      </div>
                      
                      <button 
                        onClick={() => handleDeleteTraveler(t.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Traveler Form */}
            <div className="glass" style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '24px' }}>Add Traveler / Family Unit</h2>
              
              <form onSubmit={handleAddTraveler}>
                <div className="form-group">
                  <label className="form-label">Name / Group Title</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., Uncle Bob or The Chicago Crew" 
                    value={newTravelerName}
                    onChange={(e) => setNewTravelerName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ marginBottom: '10px' }}>Accent Color Swatch</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                    {colorSwatches.map(swatch => (
                      <button
                        key={swatch.value}
                        type="button"
                        onClick={() => setNewTravelerColor(swatch.value)}
                        style={{
                          background: swatch.value,
                          border: newTravelerColor === swatch.value ? '3px solid var(--text-main)' : '1px solid rgba(0,0,0,0.1)',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          boxShadow: newTravelerColor === swatch.value ? `0 0 8px ${swatch.value}` : 'none',
                          transition: 'all var(--transition-fast)'
                        }}
                        title={swatch.label}
                      />
                    ))}
                  </div>
                </div>

                {travelerError && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '12px' }}>{travelerError}</p>}

                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }} disabled={travelerLoading}>
                  {travelerLoading ? 'Adding...' : 'Add Traveler'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================================== */}
        {/* TAB: EVENTS                          */}
        {/* ==================================== */}
        {activeTab === 'events' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '32px', alignItems: 'start' }} className="animate-fade-in">
            {/* Event List */}
            <div className="glass" style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '24px' }}>Scheduled Events Timeline</h2>
              
              {events.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>No events added to the timeline yet. Use the form to schedule the first flight or dinner!</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {events.map(event => {
                    let badgeColor = 'var(--primary)';
                    if (event.type === 'train') badgeColor = 'var(--accent-cyan)';
                    if (event.type === 'hotel') badgeColor = 'var(--success)';
                    if (event.type === 'activity') badgeColor = 'var(--warning)';

                    return (
                      <div 
                        key={event.id} 
                        className="glass" 
                        style={{ 
                          padding: '16px', 
                          borderLeft: `5px solid ${badgeColor}`,
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          gap: '12px'
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: badgeColor, textTransform: 'uppercase' }}>
                            {event.type}
                          </span>
                          <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '2px 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {event.title}
                          </h4>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            📅 {new Date(event.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })} (UTC)
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => handleEditEventClick(event)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px' }}
                          >
                            Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteEventClick(event.id)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 8px', color: 'var(--danger)', borderColor: 'rgba(239,68,68,0.15)' }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Event Form (Add or Edit) */}
            <div className="glass" style={{ padding: '32px' }}>
              <h2 style={{ fontSize: '1.4rem', marginBottom: '20px' }}>
                {editingEventId ? '✍️ Edit Event Details' : '➕ Add Scheduled Event'}
              </h2>
              
              <form onSubmit={handleEventSubmit}>
                {/* Event Type selector */}
                <div className="form-group">
                  <label className="form-label">Event Category</label>
                  <select 
                    name="type" 
                    className="form-input" 
                    value={eventForm.type} 
                    onChange={(e) => {
                      const newType = e.target.value;
                      setEventForm(prev => ({ ...prev, type: newType }));
                    }}
                    style={{ background: 'var(--bg-main)' }}
                    disabled={!!editingEventId} // Can't change type on edit
                  >
                    <option value="flight">✈️ Flight</option>
                    <option value="train">🚂 Train Ride</option>
                    <option value="hotel">🏨 Hotel Check-in / Lodging</option>
                    <option value="activity">🗓️ Planned Activity (Group Dinner, Tour, Concert)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Event Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input 
                    type="text" 
                    name="title" 
                    className="form-input" 
                    placeholder="e.g. Flight UA92 to LHR or Welcome Dinner" 
                    value={eventForm.title}
                    onChange={handleEventFormChange}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time (UTC) <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <input 
                      type="datetime-local" 
                      name="start_time" 
                      className="form-input" 
                      value={eventForm.start_time}
                      onChange={handleEventFormChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time (UTC)</label>
                    <input 
                      type="datetime-local" 
                      name="end_time" 
                      className="form-input" 
                      value={eventForm.end_time}
                      onChange={handleEventFormChange}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Location / Terminal</label>
                    <input 
                      type="text" 
                      name="location_name" 
                      className="form-input" 
                      placeholder="e.g. Logan Airport Terminal E" 
                      value={eventForm.location_name}
                      onChange={handleEventFormChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Street Address</label>
                    <input 
                      type="text" 
                      name="address" 
                      className="form-input" 
                      placeholder="e.g. London, SE1 9EF, UK" 
                      value={eventForm.address}
                      onChange={handleEventFormChange}
                    />
                  </div>
                </div>

                {/* ------------------------------ */}
                {/* TYPE SPECIFIC DETAILS SECTION  */}
                {/* ------------------------------ */}
                <div style={{ 
                  borderTop: '1px dashed var(--border-color)', 
                  borderBottom: '1px dashed var(--border-color)', 
                  padding: '16px 0', 
                  margin: '16px 0',
                  background: 'rgba(255,255,255,0.01)',
                  borderRadius: 'var(--radius-sm)'
                }}>
                  <h4 style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                    Category Specific Fields
                  </h4>

                  {eventForm.type === 'flight' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Flight Number</label>
                        <input 
                          type="text" 
                          name="details.flight_number" 
                          className="form-input" 
                          placeholder="e.g., UA 924" 
                          value={eventForm.details.flight_number}
                          onChange={handleEventFormChange}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Confirmation Code</label>
                        <input 
                          type="text" 
                          name="details.confirmation" 
                          className="form-input" 
                          placeholder="e.g., BXT49Y" 
                          value={eventForm.details.confirmation}
                          onChange={handleEventFormChange}
                        />
                      </div>
                    </div>
                  )}

                  {eventForm.type === 'train' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Train / Line</label>
                        <input 
                          type="text" 
                          name="details.train_number" 
                          className="form-input" 
                          placeholder="Eurostar 9024" 
                          value={eventForm.details.train_number}
                          onChange={handleEventFormChange}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Coach</label>
                        <input 
                          type="text" 
                          name="details.coach" 
                          className="form-input" 
                          placeholder="7" 
                          value={eventForm.details.coach}
                          onChange={handleEventFormChange}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Seats</label>
                        <input 
                          type="text" 
                          name="details.seats" 
                          className="form-input" 
                          placeholder="22, 23" 
                          value={eventForm.details.seats}
                          onChange={handleEventFormChange}
                        />
                      </div>
                    </div>
                  )}

                  {eventForm.type === 'hotel' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Confirmation Code</label>
                        <input 
                          type="text" 
                          name="details.confirmation" 
                          className="form-input" 
                          placeholder="Reservation ref" 
                          value={eventForm.details.confirmation}
                          onChange={handleEventFormChange}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Phone Number</label>
                        <input 
                          type="text" 
                          name="details.phone" 
                          className="form-input" 
                          placeholder="+44 20 ..." 
                          value={eventForm.details.phone}
                          onChange={handleEventFormChange}
                        />
                      </div>
                    </div>
                  )}

                  {eventForm.type === 'activity' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '12px' }}>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Reservation Holder Name</label>
                        <input 
                          type="text" 
                          name="details.reservation_name" 
                          className="form-input" 
                          placeholder="Lund Family reunion" 
                          value={eventForm.details.reservation_name}
                          onChange={handleEventFormChange}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Headcount</label>
                        <input 
                          type="number" 
                          name="details.headcount" 
                          className="form-input" 
                          placeholder="12" 
                          value={eventForm.details.headcount}
                          onChange={handleEventFormChange}
                        />
                      </div>
                    </div>
                  )}

                  {/* General notes block */}
                  <div className="form-group" style={{ marginTop: '12px', marginBottom: 0 }}>
                    <label className="form-label">Notes & Instructions</label>
                    <textarea 
                      name="details.notes" 
                      className="form-input" 
                      rows="2" 
                      placeholder="Special details, baggage instructions, checkin codes..." 
                      value={eventForm.details.notes}
                      onChange={handleEventFormChange}
                    />
                  </div>
                </div>

                {/* Associate Travelers checklists */}
                {travelers.length > 0 && (
                  <div style={{ marginBottom: '20px' }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '8px' }}>
                      Assign Event to Travelers:
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      {travelers.map(t => {
                        const isChecked = eventForm.traveler_ids.includes(t.id);
                        return (
                          <label 
                            key={t.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 12px',
                              borderRadius: 'var(--radius-sm)',
                              border: `1px solid ${isChecked ? t.color_code : 'var(--border-color)'}`,
                              background: isChecked ? `${t.color_code}10` : 'transparent',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              transition: 'all var(--transition-fast)'
                            }}
                          >
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleEventTravelerToggle(t.id)}
                              style={{ 
                                cursor: 'pointer',
                                accentColor: t.color_code 
                              }}
                            />
                            <span style={{ 
                              display: 'inline-block',
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: t.color_code
                            }} />
                            <span style={{ color: isChecked ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: isChecked ? 600 : 400 }}>
                              {t.name}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {eventError && <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginBottom: '12px' }}>{eventError}</p>}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  {editingEventId && (
                    <button type="button" onClick={resetEventForm} className="btn btn-secondary">
                      Cancel Edit
                    </button>
                  )}
                  <button type="submit" className="btn btn-primary" disabled={eventSaving}>
                    {eventSaving ? 'Saving...' : editingEventId ? 'Update Event' : 'Schedule Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
