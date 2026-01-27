import { calendarRepo } from '../data/calendarRepo';
import { getFutureEventIdsForTemplate } from '../data/calendarHelpers';
import { generateOccurrencesByWeekdays, combineDateTime } from '../utils/schedule';
import { CalendarEvent } from '../types';

const generateUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

interface ReprogramConfig {
  athleteId: string;
  coachId: string;
  templateId: string;
  templateTitle: string;
  startDate: string; // YYYY-MM-DD
  weekdays: number[];
  weeks: number;
  time: string;
  durationMin: number;
}

/**
 * Orquesta la reprogramación:
 * 1. Elimina sesiones futuras de esta plantilla (limpieza).
 * 2. Genera nuevas sesiones con la nueva configuración.
 */
export function reprogramFutureSessions(config: ReprogramConfig) {
  // Paso 1: Obtener IDs de sesiones futuras y eliminarlas
  const idsToDelete = getFutureEventIdsForTemplate(config.athleteId, config.templateId);
  if (idsToDelete.length > 0) {
    calendarRepo.deleteMany(idsToDelete);
  }

  // Paso 2: Generar nuevas fechas
  const occurrences = generateOccurrencesByWeekdays({
    startDate: config.startDate,
    weekdays: config.weekdays,
    weeks: config.weeks
  });

  const now = new Date().toISOString();

  // Paso 3: Crear eventos
  occurrences.forEach(dateISO => {
    const { start, end } = combineDateTime(dateISO, config.time, config.durationMin);
    
    const newEvent: CalendarEvent = {
      id: generateUUID(),
      type: 'workout',
      title: config.templateTitle,
      start,
      end,
      allDay: false,
      coachId: config.coachId,
      athleteIds: [config.athleteId],
      workoutTemplateId: config.templateId,
      createdAt: now,
      updatedAt: now
    };

    calendarRepo.upsert(newEvent);
  });

  return { deleted: idsToDelete.length, created: occurrences.length };
}