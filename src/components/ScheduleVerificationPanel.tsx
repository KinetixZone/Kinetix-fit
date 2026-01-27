import React, { useMemo } from 'react';
import { listFutureEventsForAthlete } from '../data/calendarHelpers';
import { CalendarDays, Clock, ArrowRight, Edit3 } from 'lucide-react';
import { Plan } from '../types';

export function ScheduleVerificationPanel({
  athleteId,
  currentPlan,
  onEditSchedule
}: {
  athleteId: string;
  currentPlan: Plan;
  onEditSchedule: () => void;
}) {
  // Cargar eventos futuros (Optimistic UI: lee directo de repo síncrono)
  const futureEvents = useMemo(() => {
    return listFutureEventsForAthlete(athleteId, 6, currentPlan.id);
  }, [athleteId, currentPlan.id]);

  if (futureEvents.length === 0) {
    return (
      <div className="bg-[#0F0F11] border border-dashed border-white/10 p-4 rounded-2xl flex flex-col items-center text-center gap-2">
        <CalendarDays className="text-gray-600" size={24} />
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Sin sesiones programadas</p>
        <button onClick={onEditSchedule} className="text-xs text-blue-400 hover:text-blue-300 font-bold underline decoration-blue-500/30">
          Programar ahora
        </button>
      </div>
    );
  }

  return (
    <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-5 mb-6 shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h4 className="font-bold text-white text-sm uppercase flex items-center gap-2">
            <CalendarDays size={16} className="text-blue-500"/> Agenda Futura
          </h4>
          <p className="text-[10px] text-gray-500 mt-1">Próximas sesiones de este plan</p>
        </div>
        <button 
          onClick={onEditSchedule} 
          className="px-3 py-1.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1"
        >
          <Edit3 size={12}/> Editar
        </button>
      </div>

      <div className="space-y-2">
        {futureEvents.map(event => {
          const date = new Date(event.start);
          const dayName = date.toLocaleDateString('es-MX', { weekday: 'short' });
          const dayNum = date.getDate();
          const month = date.toLocaleDateString('es-MX', { month: 'short' });
          const time = date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });

          return (
            <div key={event.id} className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
              <div className="bg-[#1A1A1D] w-10 h-10 rounded-lg flex flex-col items-center justify-center border border-white/10 shrink-0">
                <span className="text-[8px] font-bold text-gray-500 uppercase leading-none">{month}</span>
                <span className="text-sm font-bold text-white leading-none">{dayNum}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-blue-400 uppercase bg-blue-900/20 px-1.5 rounded">{dayName}</span>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10}/> {time}</span>
                </div>
                <p className="text-xs font-bold text-white truncate mt-0.5">{event.title}</p>
              </div>
              <ArrowRight size={14} className="text-gray-600"/>
            </div>
          );
        })}
      </div>
      <div className="mt-3 text-center">
        <p className="text-[9px] text-gray-600">Mostrando próximas {futureEvents.length} sesiones.</p>
      </div>
    </div>
  );
}