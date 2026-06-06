'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import * as db from '@/lib/db';

const supabaseUrl = db.supabaseUrl;
const supabaseAnonKey = db.supabaseAnonKey;

// Helper to determine if we are in cloud mode
export async function isCloudMode() {
  return db.isSupabaseConfigured;
}

// Verify itinerary ownership
export async function isItineraryOwner(itineraryId, user) {
  if (!user) return false;
  
  // Local mode mock: bypass ownership checks for ease of offline testing
  if (!db.isSupabaseConfigured) return true;
  
  try {
    const itinerary = await db.getItinerary(itineraryId);
    return itinerary && itinerary.owner_id === user.id;
  } catch (error) {
    console.error("Error checking itinerary ownership:", error);
    return false;
  }
}

// Fetch current session user safely
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const mockSessionValue = cookieStore.get('mock-user-session')?.value;
  if (mockSessionValue) {
    try {
      const session = JSON.parse(mockSessionValue);
      if (session && session.email) return session;
    } catch {
      // ignore malformed mock session
    }
  }

  if (db.isSupabaseConfigured) {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get('supabase-access-token')?.value;
      if (!token) return null;
      
      const client = createClient(supabaseUrl, supabaseAnonKey);
      const { data: { user }, error } = await client.auth.getUser(token);
      
      if (error || !user) return null;
      
      return {
        id: user.id,
        email: user.email,
        name: user.email.split('@')[0]
      };
    } catch (e) {
      return null;
    }
  } else {
    // Local fallback auth
    return null;
  }
}

// Login Action: Signs in or registers new users automatically
export async function loginAction(email, password) {
  if (!email || !password) {
    return { success: false, error: 'Email and password are required.' };
  }
  
  // If Supabase is configured, perform real auth
  if (db.isSupabaseConfigured) {
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey);
      // Try sign in
      const { data, error } = await client.auth.signInWithPassword({ email, password });

      // If signin failed, attempt signup (convenient auto-registration)
      if (error) {
        const { data: signUpData, error: signUpError } = await client.auth.signUp({ email, password });
        if (signUpError) {
          return { success: false, error: signUpError.message || error.message };
        }

        // If signup produced a session, set cookie and return
        if (signUpData.session) {
          const token = signUpData.session.access_token;
          const userObj = { id: signUpData.user.id, email: signUpData.user.email, name: signUpData.user.email.split('@')[0] };
          
          const cookieStore = await cookies();
          cookieStore.set('supabase-access-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7
          });
          return { success: true, user: userObj };
        }

        // If signup didn't produce a session (email confirmation required), try to auto-confirm using service role key
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          try {
            const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: serviceRoleKey,
                Authorization: `Bearer ${serviceRoleKey}`
              },
              body: JSON.stringify({ email, password, email_confirm: true })
            });
            if (adminRes.ok) {
              // Try signing in now that the user is confirmed
              const { data: signInData, error: signInError } = await client.auth.signInWithPassword({ email, password });
              if (!signInError && signInData?.session) {
                const token = signInData.session.access_token;
                const userObj = { id: signInData.user.id, email: signInData.user.email, name: signInData.user.email.split('@')[0] };
                
                const cookieStore = await cookies();
                cookieStore.set('supabase-access-token', token, {
                  httpOnly: true,
                  secure: process.env.NODE_ENV === 'production',
                  sameSite: 'lax',
                  maxAge: 60 * 60 * 24 * 7
                });
                return { success: true, user: userObj };
              }
            }
          } catch (e) {
            // fall through to returning the confirmation error
          }
        }

        return { success: false, error: 'Registration requires email confirmation.' };
      }

      // Successful sign in
      const token = data.session.access_token;
      const userObj = { id: data.user.id, email: data.user.email, name: data.user.email.split('@')[0] };
      
      const cookieStore = await cookies();
      cookieStore.set('supabase-access-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });
      return { success: true, user: userObj };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Local/mock flow: create or find a local user profile with UUID
  try {
    const existing = await db.getUserByEmail(email);
    if (existing) {
      const cookieStore = await cookies();
      cookieStore.set('mock-user-session', JSON.stringify(existing), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7
      });
      return { success: true, user: existing };
    }
    const newUser = await db.createUserLocal({ email: email.toLowerCase(), name: email.split('@')[0] });
    const cookieStore = await cookies();
    cookieStore.set('mock-user-session', JSON.stringify(newUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7
    });
    return { success: true, user: newUser };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('supabase-access-token');
  cookieStore.delete('mock-user-session');
  return { success: true };
}

// Itinerary Actions
export async function getItinerariesAction() {
  try {
    return await db.getItineraries();
  } catch (error) {
    console.error("Action error (getItineraries):", error);
    return [];
  }
}

export async function getItineraryAction(id) {
  try {
    return await db.getItinerary(id);
  } catch (error) {
    console.error(`Action error (getItinerary: ${id}):`, error);
    return null;
  }
}

export async function createItineraryAction(data) {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: "Unauthorized" };
  }
  
  try {
    const newItinerary = await db.createItinerary({
      title: data.title,
      description: data.description,
      start_date: data.start_date,
      end_date: data.end_date,
      owner_id: user.id,
      is_public: true
    });
    revalidatePath('/');
    return { success: true, itinerary: newItinerary };
  } catch (error) {
    console.error("Action error (createItinerary):", error);
    return { success: false, error: error.message };
  }
}

export async function updateItineraryAction(id, updates) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  const isOwner = await isItineraryOwner(id, user);
  if (!isOwner) throw new Error("Unauthorized: You do not own this itinerary.");
  
  try {
    const updated = await db.updateItinerary(id, updates);
    revalidatePath(`/itinerary/${id}`);
    revalidatePath('/');
    return { success: true, itinerary: updated };
  } catch (error) {
    console.error("Action error (updateItinerary):", error);
    return { success: false, error: error.message };
  }
}

export async function deleteItineraryAction(id) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  const isOwner = await isItineraryOwner(id, user);
  if (!isOwner) throw new Error("Unauthorized: You do not own this itinerary.");
  
  try {
    await db.deleteItinerary(id);
    revalidatePath('/');
    return { success: true };
  } catch (error) {
    console.error("Action error (deleteItinerary):", error);
    return { success: false, error: error.message };
  }
}

// Traveler Actions
export async function getTravelersAction(itineraryId) {
  try {
    return await db.getTravelers(itineraryId);
  } catch (error) {
    console.error("Action error (getTravelers):", error);
    return [];
  }
}

export async function createTravelerAction(itineraryId, name, colorCode) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  const isOwner = await isItineraryOwner(itineraryId, user);
  if (!isOwner) throw new Error("Unauthorized: You do not own this itinerary.");
  
  try {
    const newTraveler = await db.createTraveler({
      itinerary_id: itineraryId,
      name,
      color_code: colorCode || '#6366f1'
    });
    revalidatePath(`/itinerary/${itineraryId}`);
    return { success: true, traveler: newTraveler };
  } catch (error) {
    console.error("Action error (createTraveler):", error);
    return { success: false, error: error.message };
  }
}

export async function deleteTravelerAction(id, itineraryId) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  const isOwner = await isItineraryOwner(itineraryId, user);
  if (!isOwner) throw new Error("Unauthorized: You do not own this itinerary.");
  
  try {
    await db.deleteTraveler(id);
    revalidatePath(`/itinerary/${itineraryId}`);
    return { success: true };
  } catch (error) {
    console.error("Action error (deleteTraveler):", error);
    return { success: false, error: error.message };
  }
}

// Event Actions
export async function getEventsAction(itineraryId) {
  try {
    return await db.getEvents(itineraryId);
  } catch (error) {
    console.error("Action error (getEvents):", error);
    return [];
  }
}

export async function syncItineraryDates(itineraryId) {
  try {
    const events = await db.getEvents(itineraryId);
    if (!events || events.length === 0) {
      return;
    }

    let minDate = null;
    let maxDate = null;

    for (const event of events) {
      if (event.start_time) {
        const startDatePart = event.start_time.split('T')[0];
        if (!minDate || startDatePart < minDate) {
          minDate = startDatePart;
        }
        if (!maxDate || startDatePart > maxDate) {
          maxDate = startDatePart;
        }
      }
      if (event.end_time) {
        const endDatePart = event.end_time.split('T')[0];
        if (!minDate || endDatePart < minDate) {
          minDate = endDatePart;
        }
        if (!maxDate || endDatePart > maxDate) {
          maxDate = endDatePart;
        }
      }
    }

    if (minDate && maxDate) {
      await db.updateItinerary(itineraryId, {
        start_date: minDate,
        end_date: maxDate
      });
    }
  } catch (error) {
    console.error("Error syncing itinerary dates:", error);
  }
}

export async function createEventAction(eventData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  const isOwner = await isItineraryOwner(eventData.itinerary_id, user);
  if (!isOwner) throw new Error("Unauthorized: You do not own this itinerary.");
  
  try {
    const newEvent = await db.createEvent({
      itinerary_id: eventData.itinerary_id,
      type: eventData.type,
      title: eventData.title,
      start_time: eventData.start_time,
      end_time: eventData.end_time || null,
      location_name: eventData.location_name || '',
      address: eventData.address || '',
      details: eventData.details || {},
      traveler_ids: eventData.traveler_ids || []
    });

    await syncItineraryDates(eventData.itinerary_id);

    revalidatePath(`/itinerary/${eventData.itinerary_id}`);
    return { success: true, event: newEvent };
  } catch (error) {
    console.error("Action error (createEvent):", error);
    return { success: false, error: error.message };
  }
}

export async function updateEventAction(id, itineraryId, updates) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  const isOwner = await isItineraryOwner(itineraryId, user);
  if (!isOwner) throw new Error("Unauthorized: You do not own this itinerary.");
  
  try {
    const updated = await db.updateEvent(id, updates);

    await syncItineraryDates(itineraryId);

    revalidatePath(`/itinerary/${itineraryId}`);
    return { success: true, event: updated };
  } catch (error) {
    console.error("Action error (updateEvent):", error);
    return { success: false, error: error.message };
  }
}

export async function deleteEventAction(id, itineraryId) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  const isOwner = await isItineraryOwner(itineraryId, user);
  if (!isOwner) throw new Error("Unauthorized: You do not own this itinerary.");
  
  try {
    await db.deleteEvent(id);

    await syncItineraryDates(itineraryId);

    revalidatePath(`/itinerary/${itineraryId}`);
    return { success: true };
  } catch (error) {
    console.error("Action error (deleteEvent):", error);
    return { success: false, error: error.message };
  }
}

export async function setSessionCookieAction(token) {
  const cookieStore = await cookies();
  cookieStore.set('supabase-access-token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  });
  return { success: true };
}

export async function lookupFlightAction(flightNumber, dateStr) {
  if (!flightNumber) {
    return { success: false, error: "Flight number is required." };
  }
  
  const cleanNum = flightNumber.replace(/\s+/g, '').toUpperCase();
  const date = dateStr || new Date().toISOString().split('T')[0];
  
  const apiKey = process.env.FLIGHT_API_KEY;
  if (apiKey) {
    try {
      // Note: Aviationstack free plan uses http protocol
      const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${cleanNum}`;
      const res = await fetch(url);
      if (res.ok) {
        const result = await res.json();
        if (result && Array.isArray(result.data) && result.data.length > 0) {
          const flight = result.data.find(f => f.flight_date === date) || result.data[0];
          return {
            success: true,
            flightNumber: cleanNum,
            carrier: flight.airline?.name || "Airline",
            departureAirport: `${flight.departure?.airport || 'Departure'} (${flight.departure?.iata || '???'})`,
            departureIata: flight.departure?.iata || '',
            arrivalAirport: `${flight.arrival?.airport || 'Arrival'} (${flight.arrival?.iata || '???'})`,
            arrivalIata: flight.arrival?.iata || '',
            departureTime: flight.departure?.scheduled || `${date}T12:00:00.000Z`,
            arrivalTime: flight.arrival?.scheduled || `${date}T18:00:00.000Z`,
            departureTerminal: flight.departure?.terminal || '',
            arrivalTerminal: flight.arrival?.terminal || ''
          };
        }
      }
    } catch (err) {
      console.warn("Aviationstack API request failed, falling back to mock details:", err);
    }
  }

  const carrierCode = cleanNum.slice(0, 2);
  const numberPart = cleanNum.slice(2);
  
  let carrier = "Airline";
  let departureAirport = "Boston Logan Intl (BOS)";
  let departureIata = "BOS";
  let arrivalAirport = "London Heathrow (LHR)";
  let arrivalIata = "LHR";
  let durationHours = 7;
  let depHour = 18;
  let depMin = 30;
  let depTerminal = "E";
  let arrTerminal = "2";

  if (carrierCode === "UA") {
    carrier = "United Airlines";
    if (numberPart === "924") {
      departureAirport = "Boston Logan Intl (BOS)";
      departureIata = "BOS";
      arrivalAirport = "London Heathrow (LHR)";
      arrivalIata = "LHR";
      durationHours = 6.5;
      depHour = 19;
      depMin = 30;
    } else {
      departureAirport = "San Francisco Intl (SFO)";
      departureIata = "SFO";
      arrivalAirport = "Tokyo Narita (NRT)";
      arrivalIata = "NRT";
      durationHours = 11;
      depHour = 11;
      depMin = 45;
      depTerminal = "I";
      arrTerminal = "1";
    }
  } else if (carrierCode === "AA") {
    carrier = "American Airlines";
    if (numberPart === "86") {
      departureAirport = "Chicago O'Hare (ORD)";
      departureIata = "ORD";
      arrivalAirport = "London Heathrow (LHR)";
      arrivalIata = "LHR";
      durationHours = 7.75;
      depHour = 18;
      depMin = 15;
      depTerminal = "3";
    } else {
      departureAirport = "New York JFK (JFK)";
      departureIata = "JFK";
      arrivalAirport = "Paris Charles de Gaulle (CDG)";
      arrivalIata = "CDG";
      durationHours = 7.5;
      depHour = 17;
      depMin = 30;
      depTerminal = "8";
      arrTerminal = "2B";
    }
  } else if (carrierCode === "BA") {
    carrier = "British Airways";
    departureAirport = "London Heathrow (LHR)";
    departureIata = "LHR";
    arrivalAirport = "Rome Fiumicino (FCO)";
    arrivalIata = "FCO";
    durationHours = 2.5;
    depHour = 8;
    depMin = 10;
    depTerminal = "5";
    arrTerminal = "3";
  } else if (carrierCode === "LH") {
    carrier = "Lufthansa";
    departureAirport = "Frankfurt Airport (FRA)";
    departureIata = "FRA";
    arrivalAirport = "Boston Logan Intl (BOS)";
    arrivalIata = "BOS";
    durationHours = 8;
    depHour = 13;
    depMin = 0;
    depTerminal = "1";
    arrTerminal = "E";
  } else if (carrierCode === "DL") {
    carrier = "Delta Air Lines";
    departureAirport = "Atlanta Hartsfield-Jackson (ATL)";
    departureIata = "ATL";
    arrivalAirport = "Amsterdam Schiphol (AMS)";
    arrivalIata = "AMS";
    durationHours = 8.5;
    depHour = 17;
    depMin = 45;
    depTerminal = "I";
    arrTerminal = "3";
  } else {
    const num = parseInt(numberPart, 10) || 100;
    if (num % 2 === 0) {
      carrier = "Global Airways";
      departureAirport = "Paris Charles de Gaulle (CDG)";
      departureIata = "CDG";
      arrivalAirport = "Rome Fiumicino (FCO)";
      arrivalIata = "FCO";
      durationHours = 2;
      depHour = 14;
      depMin = 15;
      depTerminal = "2E";
      arrTerminal = "1";
    } else {
      carrier = "Star Express";
      departureAirport = "New York JFK (JFK)";
      departureIata = "JFK";
      arrivalAirport = "London Heathrow (LHR)";
      arrivalIata = "LHR";
      durationHours = 7.25;
      depHour = 20;
      depMin = 0;
      depTerminal = "4";
      arrTerminal = "4";
    }
  }

  const depTime = new Date(`${date}T${String(depHour).padStart(2, '0')}:${String(depMin).padStart(2, '0')}:00.000Z`);
  const arrTime = new Date(depTime.getTime() + durationHours * 60 * 60 * 1000);

  return {
    success: true,
    flightNumber: cleanNum,
    carrier,
    departureAirport,
    departureIata,
    arrivalAirport,
    arrivalIata,
    departureTime: depTime.toISOString(),
    arrivalTime: arrTime.toISOString(),
    departureTerminal: depTerminal,
    arrivalTerminal: arrTerminal
  };
}
