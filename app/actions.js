'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import * as db from '@/lib/db';

const supabaseUrl = db.supabaseUrl;
const supabaseAnonKey = db.supabaseAnonKey;

// Verify administrator privilege
export async function isUserAdmin(user) {
  if (!user) return false;
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) return false;
  return user.email.toLowerCase() === adminEmail.toLowerCase();
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
  // If Supabase is configured, perform real auth and upsert a profile
  if (db.isSupabaseConfigured) {
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey);
      // Try sign in
      const { data, error } = await client.auth.signInWithPassword({ email, password });

      // If signin failed, attempt signup
      if (error) {
        const { data: signUpData, error: signUpError } = await client.auth.signUp({ email, password });
        if (signUpError) {
          return { success: false, error: signUpError.message || error.message };
        }

        // If signup produced a session, set cookie and upsert profile
        if (signUpData.session) {
          const token = signUpData.session.access_token;
          const userObj = { id: signUpData.user.id, email: signUpData.user.email, name: signUpData.user.email.split('@')[0] };
          try {
            await db.upsertProfileSupabase({ id: userObj.id, email: userObj.email, full_name: userObj.name }, token);
          } catch (e) {
            // ignore profile upsert failures
          }
          const cookieStore = await cookies();
          cookieStore.set('supabase-access-token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7
          });
          return { success: true, user: userObj };
        }

        return { success: false, error: 'Registration requires email confirmation.' };
      }

      // Successful sign in
      const token = data.session.access_token;
      const userObj = { id: data.user.id, email: data.user.email, name: data.user.email.split('@')[0] };
      try {
        await db.upsertProfileSupabase({ id: userObj.id, email: userObj.email, full_name: userObj.name }, token);
      } catch (e) {
        // ignore profile upsert failures
      }
      const cookieStore = await cookies();
      cookieStore.set('supabase-access-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
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
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7
      });
      return { success: true, user: existing };
    }
    const newUser = await db.createUserLocal({ email: email.toLowerCase(), name: email.split('@')[0] });
    const cookieStore = await cookies();
    cookieStore.set('mock-user-session', JSON.stringify(newUser), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
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
  
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) {
    return { success: false, error: "Only admins can create itineraries." };
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
  
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) throw new Error("Only admins can modify itineraries.");
  
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
  
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) throw new Error("Only admins can delete itineraries.");
  
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
  
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) throw new Error("Only admins can manage travelers.");
  
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
  
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) throw new Error("Only admins can manage travelers.");
  
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

export async function createEventAction(eventData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) throw new Error("Only admins can manage events.");
  
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
  
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) throw new Error("Only admins can manage events.");
  
  try {
    const updated = await db.updateEvent(id, updates);
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
  
  const isAdmin = await isUserAdmin(user);
  if (!isAdmin) throw new Error("Only admins can manage events.");
  
  try {
    await db.deleteEvent(id);
    revalidatePath(`/itinerary/${itineraryId}`);
    return { success: true };
  } catch (error) {
    console.error("Action error (deleteEvent):", error);
    return { success: false, error: error.message };
  }
}
