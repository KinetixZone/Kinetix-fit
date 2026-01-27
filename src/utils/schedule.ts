// CDMX helpers y generadores de fechas

export function getDefaultStartDate(tz: string = 'America/Mexico_City'): string {
  const now = new Date();
  // Próximo lunes desde hoy (si hoy es lunes, usa hoy)
  const day = now.getDay(); // 0=Dom..6=Sab
  const delta = day === 1 ? 0 : (day === 0 ? 1 : (8 - day)); // si Dom(+1), Lun(0), resto: hasta Lun
  const start = new Date(now);
  start.setHours(0,0,0,0);
  start.setDate(start.getDate() + delta);
  
  // YYYY-MM-DD local simple
  const y = start.getFullYear();
  const m = `${start.getMonth()+1}`.padStart(2,'0');
  const d = `${start.getDate()}`.padStart(2,'0');
  return `${y}-${m}-${d}`;
}

export function generateOccurrencesByWeekdays(params: {
  startDate: string;     // 'YYYY-MM-DD' (local)
  weekdays: number[];    // 0..6 (Dom..Sab)
  weeks: number;         // e.g., 4
}): string[] {
  const { startDate, weekdays, weeks } = params;
  const out: string[] = [];
  // Parseamos asumiendo media noche local para evitar shifts de timezone
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  
  const end = new Date(start);
  end.setDate(end.getDate() + (weeks * 7));
  
  const wanted = new Set(weekdays);
  
  for (let current = new Date(start); current < end; current.setDate(current.getDate()+1)) {
    if (wanted.has(current.getDay())) {
      const cy = current.getFullYear();
      const cm = `${current.getMonth()+1}`.padStart(2,'0');
      const cd = `${current.getDate()}`.padStart(2,'0');
      out.push(`${cy}-${cm}-${cd}`);
    }
  }
  return out;
}

export function combineDateTime(
  dateISO: string,      // 'YYYY-MM-DD' local
  time: string = '18:00',
  durationMin: number = 60
): { start: string; end: string } {
  const [hh, mm] = time.split(':').map(Number);
  const [y, m, d] = dateISO.split('-').map(Number);
  
  const start = new Date(y, m - 1, d);
  start.setHours(hh ?? 18, mm ?? 0, 0, 0);
  
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMin);
  
  return { start: start.toISOString(), end: end.toISOString() };
}