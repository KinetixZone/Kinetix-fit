import React, { useMemo, useState } from 'react';
import { generateOccurrencesByWeekdays, combineDateTime } from '../utils/schedule';
import { calendarRepo } from '../data/calendarRepo';
import { reprogramFutureSessions } from '../features/reprogram';
import { X, RefreshCw, CalendarDays, AlertTriangle } from 'lucide-react';

const generateUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Helper para obtener fecha local YYYY-MM-DD (Hoy)
const getTodayISO = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const DOW = [
  { label: 'D', value: 0 },
  { label: 'L', value: 1 },
  { label: 'M', value: 2 },
  { label: 'X', value: 3 },
  { label: 'J', value: 4 },
  { label: 'V', value: 5 },
  { label: 'S', value: 6 },
];

export function AssignRoutineModal({
  athlete,
  coach,
  template,
  onClose,
  onSuccess,
  initialMode = 'create'
}: {
  athlete: { id: string; name?: string };
  coach: { id: string };
  template: { id: string; title: string };
  onClose?: () => void;
  onSuccess?: () => void;
  initialMode?: 'create' | 'edit';
}) {
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]); // Lun/Mie/Vie por defecto
  const [weeks, setWeeks] = useState<number>(4);
  const [time, setTime] = useState<string>('18:00');
  const [duration, setDuration] = useState<number>(60);
  
  // CAMBIO CLAVE: Usar HOY por defecto, no el próximo lunes.
  const [startDate, setStartDate] = useState<string>(getTodayISO());
  
  // Nuevo estado para reprogramación
  const [replaceFuture, setReplaceFuture] = useState(initialMode === 'edit');

  const toggleDow = (v: number) => {
    setWeekdays(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev, v].sort());
  };

  const occurrences = useMemo(() => {
    return generateOccurrencesByWeekdays({ startDate, weekdays, weeks });
  }, [startDate, weekdays, weeks]);

  const handleAssign = () => {
    if (replaceFuture) {
      // Lógica de Reprogramación (Borrar futuras + Crear nuevas)
      const result = reprogramFutureSessions({
        athleteId: athlete.id,
        coachId: coach.id,
        templateId: template.id,
        templateTitle: template.title,
        startDate,
        weekdays,
        weeks,
        time,
        durationMin: duration
      });
      alert(`Programación actualizada. Se eliminaron ${result.deleted} sesiones futuras y se crearon ${result.created} nuevas.`);
    } else {
      // Lógica clásica (Solo agregar, modo "Crear")
      const now = new Date().toISOString();
      occurrences.forEach(dateISO => {
        const { start, end } = combineDateTime(dateISO, time, duration);
        calendarRepo.upsert({
          id: generateUUID(),
          type: 'workout',
          title: template.title,
          start,
          end,
          allDay: false,
          coachId: coach.id,
          athleteIds: [athlete.id],
          workoutTemplateId: template.id,
          createdAt: now,
          updatedAt: now
        });
      });
      alert(`Se han añadido ${occurrences.length} sesiones correctamente.`);
    }
    
    // Notificar al padre que la operación fue exitosa (Para guardar el Plan en DataEngine)
    if (onSuccess) {
      onSuccess();
    }
    
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center p-4">
      <div className="bg-[#1A1A1D] w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl animate-fade-in-up max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-bold text-white uppercase italic flex items-center gap-2">
                  {initialMode === 'edit' ? <><RefreshCw size={18} className="text-orange-500"/> Reprogramar</> : <><CalendarDays size={18} className="text-red-500"/> Asignar Rutina</>}
                </h3>
                <p className="text-xs text-gray-400">Atleta: <span className="text-white font-bold">{athlete?.name ?? 'atleta'}</span></p>
            </div>
            <button onClick={onClose}><X className="text-gray-500 hover:text-white"/></button>
        </div>

        <div className="space-y-6">
            
            {/* Toggle de Reprogramación (Solo visible si estamos editando o si el usuario quiere activarlo) */}
            <div className="bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                <button 
                  onClick={() => setReplaceFuture(!replaceFuture)}
                  className={`w-10 h-6 rounded-full relative transition-colors ${replaceFuture ? 'bg-orange-500' : 'bg-gray-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${replaceFuture ? 'left-5' : 'left-1'}`} />
                </button>
                <div className="flex-1">
                  <p className={`text-xs font-bold ${replaceFuture ? 'text-orange-400' : 'text-gray-400'}`}>Reemplazar futuras</p>
                  <p className="text-[9px] text-gray-500 leading-tight">Si activas esto, se borrarán las sesiones futuras de esta plantilla antes de crear las nuevas.</p>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase font-bold block">Fecha de Inicio</label>
                <div className="flex gap-2">
                    <input 
                        type="date" 
                        className="flex-1 bg-black border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500 font-bold" 
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                    />
                    <button 
                        onClick={() => setStartDate(getTodayISO())}
                        className="px-4 bg-white/10 rounded-xl text-[10px] font-bold text-white hover:bg-white/20 transition-colors uppercase tracking-widest border border-white/5"
                    >
                        HOY
                    </button>
                </div>
                <p className="text-[9px] text-gray-600">Las sesiones se generarán a partir de este día.</p>
            </div>

            <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Días de entrenamiento</label>
                <div className="flex justify-between gap-1">
                    {DOW.map(d => (
                    <button
                        key={d.value}
                        className={`w-10 h-10 rounded-full text-xs font-bold transition-all ${weekdays.includes(d.value) ? 'bg-red-600 text-white shadow-lg shadow-red-900/30' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                        onClick={() => toggleDow(d.value)}
                    >
                        {d.label}
                    </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Duración del ciclo</label>
                    <div className="flex gap-1 h-[46px]">
                        {[2,4,8].map(w => (
                        <button
                            key={w}
                            className={`flex-1 rounded-xl text-[10px] font-bold transition-all border ${weeks === w ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30'}`}
                            onClick={() => setWeeks(w)}
                        >
                            {w} sem
                        </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Hora de sesión</label>
                    <input type="time" className="w-full h-[46px] bg-black border border-white/10 rounded-xl px-3 text-white text-sm outline-none focus:border-red-500 text-center font-bold" value={time} onChange={e=>setTime(e.target.value)} />
                </div>
            </div>

            <div className={`p-4 rounded-xl border text-center ${replaceFuture ? 'bg-orange-900/10 border-orange-500/20' : 'bg-white/5 border-white/5'}`}>
                <p className="text-[10px] text-gray-500 uppercase font-bold">Resumen de Agenda</p>
                <div className="mt-2 flex flex-col gap-1">
                    <div className="flex justify-between text-xs px-4">
                        <span className="text-gray-400">Inicio:</span>
                        <span className="text-white font-bold">{startDate}</span>
                    </div>
                    <div className="flex justify-between text-xs px-4">
                        <span className="text-gray-400">Total Sesiones:</span>
                        <span className="text-white font-bold">{occurrences.length}</span>
                    </div>
                    <div className="flex justify-between text-xs px-4 border-t border-white/10 pt-1 mt-1">
                        <span className="text-gray-400">Fin estimado:</span>
                        <span className="text-white font-bold">{occurrences[occurrences.length - 1] || startDate}</span>
                    </div>
                </div>
            </div>

            <div className="flex gap-3 pt-2">
                <button className="flex-1 py-3 bg-white/5 rounded-xl font-bold text-sm text-gray-400 hover:text-white transition-colors" onClick={onClose}>Cancelar</button>
                <button 
                  className={`flex-1 py-3 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-95 ${replaceFuture ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/20' : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'}`} 
                  onClick={handleAssign}
                >
                  {replaceFuture ? 'Reprogramar' : 'Confirmar'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}