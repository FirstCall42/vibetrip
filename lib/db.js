import fs from 'fs';
import path from 'path';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return rawUrl;
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`;
  } catch {
    return rawUrl;
  }
}

// Supabase credentials check
const supabaseUrlRawValue = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKeyValue = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
export const supabaseUrl = normalizeSupabaseUrl(supabaseUrlRawValue);
export const supabaseUrlRaw = supabaseUrlRawValue;
export const supabaseAnonKey = supabaseAnonKeyValue;
export const isSupabaseConfigured = !!(supabaseUrlRawValue && supabaseAnonKeyValue);

// Dynamic Supabase Client helper representing the current user
async function getSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('supabase-access-token')?.value;
    
    // If no session token, use anonymous client
    if (!token) {
      return createClient(supabaseUrl, supabaseAnonKey);
    }
    
    // Create client scoped to the current user's JWT token
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    });
  } catch (err) {
    // Return standard anon client if cookie context is unavailable
    return createClient(supabaseUrl, supabaseAnonKey);
  }
}

// Local File Database configuration
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Ensure the local data directory and file exist
function initializeLocalDb() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  
  if (!fs.existsSync(DB_FILE)) {
    const mockAdminId = randomUUID();
    const initialData = {
      users: [
        {
          id: mockAdminId,
          email: 'admin@family.com',
          name: 'Family Organizer',
          created_at: new Date().toISOString()
        }
      ],
      itineraries: [
        {
          id: "family-trip-2026",
          title: "Extended Family Europe Trip 2026",
          description: "Our big summer trip coordinating our meeting in London and Paris! Several family units meeting up for events, while managing separate travel arrangements.",
          start_date: "2026-06-15",
          end_date: "2026-06-25",
          owner_id: mockAdminId,
          is_public: true,
          created_at: new Date().toISOString()
        }
      ],
      travelers: [
        { id: "trav-1", itinerary_id: "family-trip-2026", name: "The Boston Crew (Sam & Jane)", color_code: "#6366f1" },
        { id: "trav-2", itinerary_id: "family-trip-2026", name: "Uncle Bob", color_code: "#06b6d4" },
        { id: "trav-3", itinerary_id: "family-trip-2026", name: "Aunt Mary & Kids", color_code: "#f43f5e" },
        { id: "trav-4", itinerary_id: "family-trip-2026", name: "The London Cousins", color_code: "#10b981" }
      ],
      events: [
        {
          id: "event-1",
          itinerary_id: "family-trip-2026",
          type: "flight",
          title: "Flight UA924: Boston (BOS) to London (LHR)",
          start_time: "2026-06-15T19:30:00.000Z",
          end_time: "2026-06-16T07:45:00.000Z",
          location_name: "Logan International Airport (BOS)",
          address: "Boston, MA 02128",
          details: { flight_number: "UA 924", confirmation: "BXT49Y", notes: "Terminal E. Overnight flight. Meets Uncle Bob in London." },
          traveler_ids: ["trav-1"]
        },
        {
          id: "event-2",
          itinerary_id: "family-trip-2026",
          type: "flight",
          title: "Flight AA86: Chicago (ORD) to London (LHR)",
          start_time: "2026-06-15T18:15:00.000Z",
          end_time: "2026-06-16T08:00:00.000Z",
          location_name: "O'Hare International Airport (ORD)",
          address: "Chicago, IL 60666",
          details: { flight_number: "AA 86", confirmation: "CH82LK", notes: "Uncle Bob arriving terminal 3. Meeting Boston crew at Arrivals Hall." },
          traveler_ids: ["trav-2"]
        },
        {
          id: "event-3",
          itinerary_id: "family-trip-2026",
          type: "hotel",
          title: "Hotel Check-in: CitizenM London Bankside",
          start_time: "2026-06-16T14:00:00.000Z",
          end_time: "2026-06-19T11:00:00.000Z",
          location_name: "CitizenM London Bankside",
          address: "20 Lavington St, London SE1 0NZ, UK",
          details: { confirmation: "8294921", phone: "+44 20 3519 1111", notes: "Check-in from 2 PM. High-speed Wi-Fi, close to Borough Market." },
          traveler_ids: ["trav-1", "trav-2", "trav-3"]
        },
        {
          id: "event-4",
          itinerary_id: "family-trip-2026",
          type: "activity",
          title: "Extended Family Welcome Dinner",
          start_time: "2026-06-16T19:00:00.000Z",
          end_time: "2026-06-16T22:00:00.000Z",
          location_name: "The Anchor Bankside (Pub & Restaurant)",
          address: "34 Park St, London SE1 9EF, UK",
          details: { reservation_name: "Lund Family Reunion", headcount: 12, notes: "Classic English Pub on the Thames. Table reserved in the terrace room." },
          traveler_ids: ["trav-1", "trav-2", "trav-3", "trav-4"]
        },
        {
          id: "event-5",
          itinerary_id: "family-trip-2026",
          type: "train",
          title: "Eurostar 9024: London (STP) to Paris (GDN)",
          start_time: "2026-06-19T12:24:00.000Z",
          end_time: "2026-06-19T15:47:00.000Z",
          location_name: "St Pancras International Station",
          address: "Euston Rd, London N1C 4QP, UK",
          details: { train_number: "ES 9024", coach: "7", seats: "22, 23, 24, 25", notes: "Arrive 90 minutes before departure for border control. Fast train to Paris." },
          traveler_ids: ["trav-1", "trav-2", "trav-3"]
        }
      ]
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2), 'utf-8');
  }
}

// Read database from local JSON
function readLocalDb() {
  initializeLocalDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read local DB. Resetting...", error);
    return { users: [], itineraries: [], travelers: [], events: [] };
  }
}

// Write database to local JSON
function writeLocalDb(data) {
  initializeLocalDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ----------------------
// LOCAL USERS / PROFILES
// ----------------------

export async function getUserByEmail(email) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client.from('profiles').select('*').eq('email', email).limit(1).single();
    if (error) return null;
    return data;
  } else {
    const db = readLocalDb();
    return db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase()) || null;
  }
}

export async function getUserById(id) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client.from('profiles').select('*').eq('id', id).limit(1).single();
    if (error) return null;
    return data;
  } else {
    const db = readLocalDb();
    return db.users.find(u => u.id === id) || null;
  }
}

export async function createUserLocal({ id, email, name }) {
  const db = readLocalDb();
  const newUser = { id: id || randomUUID(), email, name, created_at: new Date().toISOString() };
  db.users.push(newUser);
  writeLocalDb(db);
  return newUser;
}

export async function upsertProfileSupabase(profile, authToken) {
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${authToken}` } }
  });
  const { data, error } = await client.from('profiles').upsert([profile], { returning: 'representation' }).single();
  if (error) throw error;
  return data;
}

// ==========================================
// UNIFIED DATA OPERATIONS (SUPABASE OR FILE)
// ==========================================

export const dbMode = isSupabaseConfigured ? "Supabase Cloud" : "Local JSON File";

export async function getItineraries() {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('itineraries')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  } else {
    const db = readLocalDb();
    return db.itineraries;
  }
}

export async function getItinerary(id) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('itineraries')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return data;
  } else {
    const db = readLocalDb();
    return db.itineraries.find(i => i.id === id) || null;
  }
}

export async function createItinerary(itinerary) {
  const newId = isSupabaseConfigured ? undefined : `itinerary-${Date.now()}`;
  const newItem = {
    ...itinerary,
    id: itinerary.id || newId,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('itineraries')
      .insert([newItem])
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const db = readLocalDb();
    db.itineraries.push(newItem);
    writeLocalDb(db);
    return newItem;
  }
}

export async function updateItinerary(id, updates) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('itineraries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const db = readLocalDb();
    const idx = db.itineraries.findIndex(i => i.id === id);
    if (idx === -1) throw new Error("Itinerary not found");
    db.itineraries[idx] = { ...db.itineraries[idx], ...updates };
    writeLocalDb(db);
    return db.itineraries[idx];
  }
}

export async function deleteItinerary(id) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { error } = await client
      .from('itineraries')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } else {
    const db = readLocalDb();
    db.itineraries = db.itineraries.filter(i => i.id !== id);
    db.travelers = db.travelers.filter(t => t.itinerary_id !== id);
    db.events = db.events.filter(e => e.itinerary_id !== id);
    writeLocalDb(db);
    return true;
  }
}

// ----------------------
// TRAVELERS OPERATIONS
// ----------------------

export async function getTravelers(itineraryId) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('travelers')
      .select('*')
      .eq('itinerary_id', itineraryId);
    if (error) throw error;
    return data;
  } else {
    const db = readLocalDb();
    return db.travelers.filter(t => t.itinerary_id === itineraryId);
  }
}

export async function createTraveler(traveler) {
  const newId = isSupabaseConfigured ? undefined : `trav-${Date.now()}`;
  const newItem = {
    ...traveler,
    id: traveler.id || newId
  };

  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('travelers')
      .insert([newItem])
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const db = readLocalDb();
    db.travelers.push(newItem);
    writeLocalDb(db);
    return newItem;
  }
}

export async function deleteTraveler(id) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { error } = await client
      .from('travelers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } else {
    const db = readLocalDb();
    db.travelers = db.travelers.filter(t => t.id !== id);
    // Remove traveler from any events that reference them
    db.events = db.events.map(event => {
      if (event.traveler_ids) {
        event.traveler_ids = event.traveler_ids.filter(tid => tid !== id);
      }
      return event;
    });
    writeLocalDb(db);
    return true;
  }
}

// ----------------------
// EVENTS OPERATIONS
// ----------------------

export async function getEvents(itineraryId) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('events')
      .select('*')
      .eq('itinerary_id', itineraryId)
      .order('start_time', { ascending: true });
    if (error) throw error;
    return data;
  } else {
    const db = readLocalDb();
    const itineraryEvents = db.events.filter(e => e.itinerary_id === itineraryId);
    // Sort by start_time ascending
    return itineraryEvents.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
  }
}

export async function createEvent(event) {
  const newId = isSupabaseConfigured ? undefined : `event-${Date.now()}`;
  const newItem = {
    ...event,
    id: event.id || newId,
    created_at: new Date().toISOString()
  };

  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('events')
      .insert([newItem])
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const db = readLocalDb();
    db.events.push(newItem);
    writeLocalDb(db);
    return newItem;
  }
}

export async function updateEvent(id, updates) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { data, error } = await client
      .from('events')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const db = readLocalDb();
    const idx = db.events.findIndex(e => e.id === id);
    if (idx === -1) throw new Error("Event not found");
    db.events[idx] = { ...db.events[idx], ...updates };
    writeLocalDb(db);
    return db.events[idx];
  }
}

export async function deleteEvent(id) {
  if (isSupabaseConfigured) {
    const client = await getSupabaseClient();
    const { error } = await client
      .from('events')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  } else {
    const db = readLocalDb();
    db.events = db.events.filter(e => e.id !== id);
    writeLocalDb(db);
    return true;
  }
}
