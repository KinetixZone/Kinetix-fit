import React, { useMemo, useState, useEffect } from 'react';
import { generateOccurrencesByWeekdays, combineDateTime } from '../utils/schedule';
import { calendarRepo } from '../data/calendarRepo';
import { reprogramFutureSessions } from '../features/reprogram';
import { X, RefreshCw, CalendarDays, CheckCircle2, Calendar, ArrowRight } from 'lucide-react';

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
  
  // POR DEFECTO: HOY
  const [startDate, setStartDate] = useState<string>(getTodayISO());
  const [replaceFuture, setReplaceFuture] = useState(initialMode === 'edit');

  const toggleDow = (v: number) => {
    setWeekdays(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev, v].sort());
  };

  const occurrences = useMemo(() => {
    return generateOccurrencesByWeekdays({ startDate, weekdays, weeks });
  }, [startDate, weekdays, weeks]);

  const handleAssign = () => {
    if (replaceFuture) {
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
      alert(`Agenda actualizada. Se eliminaron ${result.deleted} sesiones futuras y se crearon ${result.created} nuevas.`);
    } else {
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
      alert(`Listo. Se han programado ${occurrences.length} sesiones para ${athlete.name}.`);
    }
    
    if (onSuccess) onSuccess();
    onClose?.();
  };

  const todayISO = getTodayISO();
  const nextMondayISO = getNextMondayISO();

  // Formatear fechas para UI
  const formatDateNice = (iso: string) => {
      const [y, m, d] = iso.split('-').map(Number);
      const date = new Date(y, m-1, d);
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#1A1A1D] w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl animate-fade-in-up max-h-[95vh] overflow-y-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-start mb-6">
            <div>
                <h3 className="text-xl font-display font-black italic text-white uppercase tracking-tighter flex items-center gap-2">
                  {initialMode === 'edit' ? <><RefreshCw size={20} className="text-orange-500"/> REPROGRAMAR</> : <><CalendarDays size={20} className="text-red-500"/> ASIGNAR RUTINA</>}
                </h3>
                <p className="text-xs text-gray-400 mt-1">Atleta: <span className="text-white font-bold uppercase">{athlete?.name ?? 'atleta'}</span></p>
            </div>
            <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"><X size={16} className="text-gray-400"/></button>
        </div>

        <div className="space-y-6">
            
            {/* 1. SELECCIÓN DE FECHA VISUAL (TOP) */}
            <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-3 block flex items-center gap-2 tracking-widest">
                    <Calendar size={12} /> Selecciona el Inicio
                </label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                    <button
                        onClick={() => setStartDate(todayISO)}
                        className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all relative group ${startDate === todayISO ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/40 ring-2 ring-red-500/50' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'}`}
                    >
                        {startDate === todayISO && <div className="absolute top-2 right-2"><CheckCircle2 size={16} className="text-white"/></div>}
                        <span className="text-xs font-black uppercase tracking-widest">HOY MISMO</span>
                        <span className="text-sm font-bold opacity-80">{formatDateNice(todayISO)}</span>
                    </button>

                    <button
                        onClick={() => setStartDate(nextMondayISO)}
                        className={`p-4 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all relative group ${startDate === nextMondayISO ? 'bg-white text-black border-white shadow-lg' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20'}`}
                    >
                        {startDate === nextMondayISO && <div className="absolute top-2 right-2"><CheckCircle2 size={16} className="text-black"/></div>}
                        <span className="text-xs font-black uppercase tracking-widest">PRÓXIMO LUNES</span>
                        <span className="text-sm font-bold opacity-80">{formatDateNice(nextMondayISO)}</span>
                    </button>
                </div>
                
                {/* Selector Manual (Discreto) */}
                <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${startDate !== todayISO && startDate !== nextMondayISO ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-transparent border-transparent'}`}>
                    <span className="text-[10px] text-gray-500 font-bold uppercase whitespace-nowrap">O elige otra fecha:</span>
                    <input 
                        type="date" 
                        className={`bg-transparent border-b border-white/20 text-white text-xs outline-none w-full font-bold uppercase cursor-pointer ${startDate !== todayISO && startDate !== nextMondayISO ? 'text-yellow-500 border-yellow-500' : ''}`}
                        value={startDate} 
                        onChange={(e) => setStartDate(e.target.value)} 
                    />
                </div>
            </div>

            {/* 2. DÍAS DE LA SEMANA */}
            <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block tracking-widest">Días de Entrenamiento</label>
                <div className="flex justify-between gap-1 bg-black/40 p-2 rounded-2xl border border-white/5">
                    {DOW.map(d => (
                    <button
                        key={d.value}
                        className={`w-9 h-9 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${weekdays.includes(d.value) ? 'bg-red-600 text-white shadow-lg shadow-red-900/30 scale-105' : 'bg-transparent text-gray-500 hover:text-white hover:bg-white/5'}`}
                        onClick={() => toggleDow(d.value)}
                    >
                        {d.label}
                    </button>
                    ))}
                </div>
            </div>

            {/* 3. CONFIGURACIÓN */}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block tracking-widest">Duración (Semanas)</label>
                    <div className="flex gap-1 h-[46px] bg-black/40 rounded-xl p-1 border border-white/5">
                        {[2,4,8].map(w => (
                        <button
                            key={w}
                            className={`flex-1 rounded-lg text-[10px] font-bold transition-all ${weeks === w ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-white'}`}
                            onClick={() => setWeeks(w)}
                        >
                            {w}
                        </button>
                        ))}
                    </div>
                </div>
                <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block tracking-widest">Hora Habitual</label>
                    <input type="time" className="w-full h-[46px] bg-black/40 border border-white/10 rounded-xl px-3 text-white text-sm outline-none focus:border-red-500 text-center font-bold" value={time} onChange={e=>setTime(e.target.value)} />
                </div>
            </div>

            {/* 4. TOGGLE REPROGRAMAR */}
            <div className="bg-white/5 p-3 rounded-xl flex items-center gap-3 border border-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setReplaceFuture(!replaceFuture)}>
                <div className={`w-10 h-6 rounded-full relative transition-colors shrink-0 ${replaceFuture ? 'bg-orange-500' : 'bg-gray-700'}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all shadow-sm ${replaceFuture ? 'left-5' : 'left-1'}`} />
                </div>
                <div className="flex-1">
                  <p className={`text-xs font-bold ${replaceFuture ? 'text-orange-400' : 'text-gray-300'}`}>Modo Reprogramación</p>
                  <p className="text-[9px] text-gray-500 leading-tight">Activa esto para reemplazar sesiones futuras existentes.</p>
                </div>
            </div>

            {/* RESUMEN Y ACCIÓN */}
            <div className="flex gap-3 pt-4 border-t border-white/5 mt-2">
                <button className="flex-1 py-4 bg-transparent rounded-2xl font-bold text-xs text-gray-500 hover:text-white border border-transparent hover:border-white/10 transition-all uppercase tracking-widest" onClick={onClose}>Cancelar</button>
                <button 
                  className={`flex-[2] py-4 rounded-2xl font-bold text-xs text-white shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest ${replaceFuture ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-900/20' : 'bg-red-600 hover:bg-red-500 shadow-red-900/20'}`} 
                  onClick={handleAssign}
                >
                  {replaceFuture ? 'Confirmar Cambios' : 'Confirmar Asignación'} <ArrowRight size={14}/>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}