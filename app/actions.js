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
  
  // Local mode mock admin
  if (user.id === 'mock-user-1') return true;
  
  // Supabase cloud admin check
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    return user.email.toLowerCase() === adminEmail.toLowerCase();
  }
  
  // If ADMIN_EMAIL is not configured, any logged in user is admin by default
  return true;
}

// Fetch current session user safely
export async function getCurrentUser() {
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
    const cookieStore = await cookies();
    const mockSession = cookieStore.get('mock-user-session');
    
    if (mockSession && mockSession.value === 'mock-user-1') {
      return {
        id: 'mock-user-1',
        email: 'admin@family.com',
        name: 'Family Organizer'
      };
    }
    return null;
  }
}

// Login Action: Signs in or registers new users automatically
export async function loginAction(email, password) {
  if (db.isSupabaseConfigured) {
    try {
      const client = createClient(supabaseUrl, supabaseAnonKey);
      
      // 1. Try to login
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      
      if (error) {
        // 2. If login fails, try to sign them up automatically (convenient for first admin setup)
        const { data: signUpData, error: signUpError } = await client.auth.signUp({ email, password });
        
        if (signUpError) {
          return { success: false, error: error.message }; // Return original sign-in error
        }
        
        // Check if user is logged in directly on signup (if email confirmation is off)
        if (signUpData.session) {
          const cookieStore = await cookies();
          cookieStore.set('supabase-access-token', signUpData.session.access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24 * 7 // 1 week
          });
          return { success: true, user: { id: signUpData.user.id, email: signUpData.user.email, name: signUpData.user.email.split('@')[0] } };
        } else {
          return { success: false, error: 'Registration successful! Please check your email to verify your account.' };
        }
      }
      
      // Set session cookie
      const cookieStore = await cookies();
      cookieStore.set('supabase-access-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });
      
      return { 
        success: true, 
        user: { 
          id: data.user.id, 
          email: data.user.email, 
          name: data.user.email.split('@')[0] 
        } 
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  } else {
    // Local fallback credentials validation
    if (email && password) {
      const cookieStore = await cookies();
      cookieStore.set('mock-user-session', 'mock-user-1', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 * 7
      });
      return { success: true, user: { id: 'mock-user-1', email, name: 'Family Organizer' } };
    }
    return { success: false, error: 'Invalid credentials' };
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
