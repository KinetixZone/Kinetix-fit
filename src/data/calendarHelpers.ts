import { calendarRepo } from './calendarRepo';
import { CalendarEvent } from '../types';

/**
 * Lista eventos futuros de tipo 'workout' para un atleta.
 * Ordenados por fecha ascendente.
 * Límite opcional para vista rápida.
 */
export function listFutureEventsForAthlete(
  athleteId: string, 
  limit: number = 12, 
  templateId?: string
): CalendarEvent[] {
  const allEvents = calendarRepo.getByAthlete(athleteId);
  const now = new Date().toISOString();

  let filtered = allEvents.filter(e => 
    e.type === 'workout' && 
    e.start >= now
  );

  if (templateId) {
    filtered = filtered.filter(e => e.workoutTemplateId === templateId);
  }

  // Ordenar por fecha ASC
  filtered.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return filtered.slice(0, limit);
}

/**
 * Identifica eventos futuros de una plantilla específica para eliminarlos.
 * NO elimina eventos pasados (historial intocable).
 * Retorna los IDs a eliminar.
 */
export function getFutureEventIdsForTemplate(
  athleteId: string, 
  templateId: string
): string[] {
  const allEvents = calendarRepo.getByAthlete(athleteId);
  // Usamos el inicio del día actual local para ser seguros, o simplemente ISO actual
  // Para seguridad total del historial, usamos ISO now. Lo que ya pasó (hora), ya pasó.
  const now = new Date().toISOString();

  return allEvents
    .filter(e => 
      e.type === 'workout' && 
      e.workoutTemplateId === templateId &&
      e.start >= now 
    )
    .map(e => e.id);
}