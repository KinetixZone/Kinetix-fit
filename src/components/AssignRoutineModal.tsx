import React, { useMemo, useState } from 'react';
import { generateOccurrencesByWeekdays, combineDateTime } from '../utils/schedule';
import { calendarRepo } from '../data/calendarRepo';
import { reprogramFutureSessions } from '../features/reprogram';
import { X, RefreshCw, CalendarDays, AlertTriangle, ArrowRight } from 'lucide-react';

const generateUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

// Helper para obtener fecha local YYYY-MM-DD
const getTodayISO = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const getNextMondayISO = () => {
    const d = new Date();
    d.setDate(d.getDate() + ((1 + 7 - d.getDay()) % 7 || 7));
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
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
  
  // INICIO: Usar HOY por defecto, no el próximo lunes.
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
            
            {/* Toggle de Reprogramación (Visible en ambos modos, pero default true en edit) */}
            <div className="bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-white/5">
                <button 
                  onClick={() => setReplaceFuture(!replaceFuture)}
                  className={`w-10 h-6 rounded-full relative transition-colors ${replaceFuture ? 'bg-orange-500' : 'bg-gray-700'}`}
                >
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${replaceFuture ? 'left-5' : 'left-1'}`} />
                </button>
                <div className="flex-1">
                  <p className={`text-xs font-bold ${replaceFuture ? 'text-orange-400' : 'text-gray-400'}`}>Reemplazar futuras</p>
                  <p className="text-[9px] text-gray-500 leading-tight">Si activas esto, se borrarán las sesiones futuras de esta plantilla antes de crear las nuevas. El historial NO se toca.</p>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between items-center">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Fecha de Inicio</label>
                    <div className="flex gap-2">
                        <button onClick={() => setStartDate(getTodayISO())} className="text-[9px] bg-white/10 px-2 py-1 rounded hover:bg-white/20 text-white font-bold transition-colors">HOY</button>
                        <button onClick={() => setStartDate(getNextMondayISO())} className="text-[9px] bg-white/10 px-2 py-1 rounded hover:bg-white/20 text-gray-400 hover:text-white font-bold transition-colors">LUNES</button>
                    </div>
                </div>
                <input 
                    type="date" 
                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500 font-bold" 
                    value={startDate} 
                    onChange={(e) => setStartDate(e.target.value)} 
                />
            </div>

            <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Días de la semana</label>
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
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Duración (Semanas)</label>
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
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Hora</label>
                    <input type="time" className="w-full h-[46px] bg-black border border-white/10 rounded-xl px-3 text-white text-sm outline-none focus:border-red-500 text-center font-bold" value={time} onChange={e=>setTime(e.target.value)} />
                </div>
            </div>

            <div className={`p-4 rounded-xl border text-center ${replaceFuture ? 'bg-orange-900/10 border-orange-500/20' : 'bg-white/5 border-white/5'}`}>
                <p className="text-[10px] text-gray-500 uppercase font-bold">Resumen de Acción</p>
                {replaceFuture ? (
                   <strong className="text-orange-400 text-sm block mt-1 flex items-center justify-center gap-2">
                     <AlertTriangle size={14}/> Reemplazo Seguro
                   </strong>
                ) : (
                   <strong className="text-white text-sm block mt-1">Modo Aditivo (Agregar)</strong>
                )}
                <p className="text-[10px] text-gray-400 mt-1">
                  Se generarán <strong className="text-white">{occurrences.length} sesiones</strong><br/>
                  Del <span className="text-white font-bold">{startDate}</span> al <span className="text-white font-bold">{occurrences[occurrences.length - 1] || startDate}</span>
                </p>
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