import { CalendarEvent } from '../types';

const STORAGE_KEY_EVENTS = 'KINETIX_CALENDAR_EVENTS_V1';

const getEvents = (): CalendarEvent[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY_EVENTS);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

const saveEvents = (events: CalendarEvent[]) => {
  localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events));
  window.dispatchEvent(new Event('storage-update'));
};

export const calendarRepo = {
  upsert: (event: CalendarEvent) => {
    const events = getEvents();
    const idx = events.findIndex(e => e.id === event.id);
    if (idx >= 0) {
      events[idx] = event;
    } else {
      events.push(event);
    }
    saveEvents(events);
  },
  
  getAll: (): CalendarEvent[] => {
    return getEvents();
  },

  getByAthlete: (athleteId: string): CalendarEvent[] => {
    return getEvents().filter(e => e.athleteIds.includes(athleteId));
  },

  // Nuevo método para soporte de reprogramación
  deleteMany: (ids: string[]) => {
    const events = getEvents();
    const filtered = events.filter(e => !ids.includes(e.id));
    saveEvents(filtered);
  }
};