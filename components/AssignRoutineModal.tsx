import React, { useMemo, useState } from 'react';
import { generateOccurrencesByWeekdays, combineDateTime, getDefaultStartDate } from '../utils/schedule';
import { calendarRepo } from '../data/calendarRepo';
import { X } from 'lucide-react';

const generateUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

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
  onClose
}: {
  athlete: { id: string; name?: string };
  coach: { id: string };
  template: { id: string; title: string };
  onClose?: () => void;
}) {
  const [weekdays, setWeekdays] = useState<number[]>([1, 3, 5]); // Lun/Mie/Vie por defecto
  const [weeks, setWeeks] = useState<number>(4);
  const [time, setTime] = useState<string>('18:00');
  const [duration, setDuration] = useState<number>(60);
  const [startDate] = useState<string>(getDefaultStartDate());

  const toggleDow = (v: number) => {
    setWeekdays(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev, v].sort());
  };

  const occurrences = useMemo(() => {
    return generateOccurrencesByWeekdays({ startDate, weekdays, weeks });
  }, [startDate, weekdays, weeks]);

  const handleAssign = () => {
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
    // Optimistic UI: ya están persistidos en localStorage
    alert(`Se han programado ${occurrences.length} sesiones correctamente.`);
    onClose?.();
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center p-4">
      <div className="bg-[#1A1A1D] w-full max-w-md rounded-3xl p-6 border border-white/10 shadow-2xl animate-fade-in-up">
        <div className="flex justify-between items-center mb-6">
            <div>
                <h3 className="text-lg font-bold text-white uppercase italic">Programar Rutina</h3>
                <p className="text-xs text-gray-400">Atleta: <span className="text-white font-bold">{athlete?.name ?? 'atleta'}</span></p>
            </div>
            <button onClick={onClose}><X className="text-gray-500 hover:text-white"/></button>
        </div>

        <div className="space-y-6">
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

            <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Duración (Semanas)</label>
                <div className="flex gap-2">
                    {[2,4,8].map(w => (
                    <button
                        key={w}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${weeks === w ? 'bg-white text-black border-white' : 'bg-transparent text-gray-500 border-white/10 hover:border-white/30'}`}
                        onClick={() => setWeeks(w)}
                    >
                        {w} Semanas
                    </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Hora Inicio</label>
                <input type="time" className="w-full bg-black border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500" value={time} onChange={e=>setTime(e.target.value)} />
                </div>
                <div>
                <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Duración (min)</label>
                <input type="number" min={10} max={240} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500" value={duration} onChange={e=>setDuration(parseInt(e.target.value || '60'))} />
                </div>
            </div>

            <div className="bg-white/5 p-4 rounded-xl border border-white/5 text-center">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Vista Previa</p>
                <strong className="text-white text-sm block mt-1">Se programarán {occurrences.length} sesiones</strong>
                <p className="text-[10px] text-gray-400 mt-1">Inicio: {startDate} • Fin: {occurrences[occurrences.length - 1] || startDate}</p>
            </div>

            <div className="flex gap-3 pt-2">
                <button className="flex-1 py-3 bg-white/5 rounded-xl font-bold text-sm text-gray-400 hover:text-white transition-colors" onClick={onClose}>Cancelar</button>
                <button className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-sm text-white hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all active:scale-95" onClick={handleAssign}>Confirmar</button>
            </div>
        </div>
      </div>
    </div>
  );
}