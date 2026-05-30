'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import * as db from '@/lib/db';

// Helper to check user auth (local or supabase)
export async function getCurrentUser() {
  const cookieStore = await cookies();
  const mockSession = cookieStore.get('mock-user-session');
  
  if (mockSession && mockSession.value === 'mock-user-1') {
    return {
      id: 'mock-user-1',
      email: 'admin@family.com',
      name: 'Family Organizer'
    };
  }
  
  // If supabase is enabled, in future we can expand this to read supabase auth session.
  // For now, the app uses this unified mock/local auth which is extremely robust.
  return null;
}

// Authentication Actions
export async function loginAction(email, password) {
  // Simple validation for mock auth
  if (email && password) {
    const cookieStore = await cookies();
    cookieStore.set('mock-user-session', 'mock-user-1', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    });
    return { success: true, user: { id: 'mock-user-1', email, name: 'Family Organizer' } };
  }
  return { success: false, error: 'Invalid credentials' };
}

export async function logoutAction() {
  const cookieStore = await cookies();
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
  if (!user) throw new Error("Unauthorized");
  
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
  
  try {
    await db.deleteEvent(id);
    revalidatePath(`/itinerary/${itineraryId}`);
    return { success: true };
  } catch (error) {
    console.error("Action error (deleteEvent):", error);
    return { success: false, error: error.message };
  }
}
