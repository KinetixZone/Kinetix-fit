import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, Trophy, X, 
  Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Flame, Plus, LogOut, Timer, UserPlus, 
  Edit3, ChevronLeft, Lock, Megaphone, 
  RefreshCw, Sparkles, Activity, AlertTriangle,
  Database, Cpu, Wifi, MessageSquare
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { User, Plan, Workout, Exercise, WorkoutLog, Goal, UserLevel } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './geminiService';

// --- CONFIGURACIÓN DEL SISTEMA ---
const CONFIG = {
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseKey: process.env.SUPABASE_ANON_KEY || '',
  geminiKey: process.env.API_KEY || ''
};

const isSupabaseOk = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
const isGeminiOk = !!CONFIG.geminiKey;

const supabase = isSupabaseOk ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) : null;

const DataService = {
  getPlans: async (): Promise<Plan[]> => {
    if (!supabase) return JSON.parse(localStorage.getItem('kx_plans') || '[]');
    try {
      const { data } = await supabase.from('plans').select('*');
      return (data || []).map(p => ({ 
        ...p, 
        userId: p.user_id, 
        coachNotes: p.coach_notes || '', 
        updatedAt: p.updated_at 
      }));
    } catch { return JSON.parse(localStorage.getItem('kx_plans') || '[]'); }
  },
  savePlan: async (plan: Plan) => {
    if (!supabase) {
      const plans = await DataService.getPlans();
      const updated = [plan, ...plans.filter((p: Plan) => p.userId !== plan.userId)];
      localStorage.setItem('kx_plans', JSON.stringify(updated));
      return true;
    }
    const { error } = await supabase.from('plans').upsert({
      user_id: plan.userId,
      title: plan.title,
      workouts: plan.workouts,
      coach_notes: plan.coachNotes,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    return !error;
  },
  getLogs: async (): Promise<WorkoutLog[]> => {
    if (!supabase) return JSON.parse(localStorage.getItem('kx_logs') || '[]');
    try {
      const { data } = await supabase.from('workout_logs').select('*').order('date', { ascending: false });
      return (data || []).map(d => ({ ...d, userId: d.user_id, workoutId: d.workout_id, setsData: d.sets_data }));
    } catch { return JSON.parse(localStorage.getItem('kx_logs') || '[]'); }
  },
  saveLog: async (log: WorkoutLog) => {
    if (!supabase) {
      const logs = await DataService.getLogs();
      localStorage.setItem('kx_logs', JSON.stringify([log, ...logs]));
      return true;
    }
    const { error } = await supabase.from('workout_logs').insert({
      user_id: log.userId,
      workout_id: log.workoutId,
      sets_data: log.setsData,
      date: log.date
    });
    return !error;
  },
  getUsers: async (): Promise<User[]> => {
    if (!supabase) {
      const stored = localStorage.getItem('kx_users');
      return stored ? JSON.parse(stored) : [MOCK_USER as User];
    }
    try {
      const { data } = await supabase.from('profiles').select('*');
      return (data || []).map(u => ({ ...u, daysPerWeek: u.days_per_week, role: u.role || 'client' }));
    } catch { return [MOCK_USER as User]; }
  },
  saveUser: async (user: User) => {
    if (!supabase) {
      const users = await DataService.getUsers();
      localStorage.setItem('kx_users', JSON.stringify([...users, user]));
      return true;
    }
    const { error } = await supabase.from('profiles').insert({
      id: user.id,
      name: user.name,
      goal: user.goal,
      level: user.level,
      days_per_week: user.daysPerWeek,
      equipment: user.equipment,
      role: user.role
    });
    return !error;
  }
};

// --- COMPONENTES UI ---
const NeonButton = memo(({ children, onClick, variant = 'primary', className = '', loading = false, icon, disabled = false }: any) => {
  const base = "relative overflow-hidden px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] active:scale-95 disabled:opacity-30 group shrink-0 select-none";
  const styles = {
    primary: 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    secondary: 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]',
    outline: 'border border-zinc-800 hover:border-zinc-500 text-zinc-400 bg-zinc-900/40 hover:text-white',
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${base} ${styles[variant as keyof typeof styles]} ${className}`}>
      {loading ? <RefreshCw className="animate-spin" size={16} /> : <>{icon}{children}</>}
    </button>
  );
});

const GlassCard = memo(({ children, className = '', onClick }: any) => (
  <div onClick={onClick} className={`bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/40 rounded-[2.5rem] p-6 shadow-2xl transition-all ${onClick ? 'cursor-pointer hover:border-zinc-600 active:scale-[0.98]' : ''} ${className}`}>
    {children}
  </div>
));

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'online' | 'syncing'>('online');
  const [coachPin, setCoachPin] = useState('');
  const [showCoachAuth, setShowCoachAuth] = useState(false);
  const [hideDiagnostics, setHideDiagnostics] = useState(false);

  const [exercises] = useState<Exercise[]>(INITIAL_EXERCISES);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  const syncData = useCallback(async () => {
    setCloudStatus('syncing');
    try {
      const [u, p, l] = await Promise.all([DataService.getUsers(), DataService.getPlans(), DataService.getLogs()]);
      setUsers(u);
      setPlans(p);
      setLogs(l);
    } catch { console.error("Error sincronización"); }
    finally { setCloudStatus('online'); }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const handleLogin = useCallback(() => {
    const user = users.find(u => u.name.toLowerCase().trim() === loginName.toLowerCase().trim());
    if (user) { setCurrentUser(user); setActiveTab('home'); }
    else { alert("Atleta no registrado."); }
  }, [users, loginName]);

  const handleCoachLogin = () => {
    if (coachPin === 'KINETIX2025') {
      setCurrentUser({ ...(MOCK_USER as User), role: 'coach', name: 'Master Coach' });
      setActiveTab('admin');
      setShowCoachAuth(false);
    } else { alert("PIN Incorrecto"); }
  };

  const onAiGenerate = useCallback(async (user: User) => {
    if (!isGeminiOk) { setHideDiagnostics(false); return; }
    setIsAiGenerating(true);
    try {
      const generated = await generateSmartRoutine(user);
      const enrichedPlan: Plan = {
        ...generated,
        id: `p-${Date.now()}`,
        userId: user.id,
        updatedAt: new Date().toISOString()
      };
      setEditingPlan({ plan: enrichedPlan, isNew: true });
    } catch (e: any) { alert(e.message); }
    finally { setIsAiGenerating(false); }
  }, []);

  const currentPlan = useMemo(() => plans.find(p => p.userId === currentUser?.id), [plans, currentUser]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-8">
        {(!isSupabaseOk || !isGeminiOk) && !hideDiagnostics && (
          <div className="absolute top-8 left-8 right-8 bg-zinc-900 border border-red-600/30 p-6 rounded-[2rem] space-y-4 z-50 animate-in slide-in-from-top-4">
             <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-600" size={24} />
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">SISTEMA INCOMPLETO</h3>
             </div>
             <div className="grid grid-cols-1 gap-2">
                <StatusItem label="SUPABASE_URL" active={!!CONFIG.supabaseUrl} />
                <StatusItem label="SUPABASE_KEY" active={!!CONFIG.supabaseKey} />
                <StatusItem label="API_KEY (GEMINI)" active={!!CONFIG.geminiKey} />
             </div>
             <div className="flex flex-col gap-3">
                <p className="text-[8px] text-zinc-500 font-bold uppercase text-center leading-relaxed">
                  Para que esto funcione en Vercel, debes añadir las llaves y hacer **REDEPLOY**.
                </p>
                <button onClick={() => setHideDiagnostics(true)} className="w-full py-3 bg-white/5 rounded-xl text-[8px] font-black uppercase text-zinc-400 border border-white/5">Ignorar (Usar modo local)</button>
             </div>
          </div>
        )}
        
        <div className="text-center space-y-12">
           <div className="space-y-4">
              <h1 className="text-7xl font-display italic tracking-tighter uppercase text-white leading-none">KINETIX</h1>
              <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px]">FUNCTIONAL ZONE</p>
           </div>
           
           {!showCoachAuth ? (
             <div className="space-y-6">
                <GlassCard className="max-w-xs mx-auto p-10 space-y-6 border-zinc-800">
                   <input value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="NOMBRE DEL ATLETA" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase" />
                   <NeonButton onClick={handleLogin} className="w-full py-6">ACCEDER AL PANEL</NeonButton>
                </GlassCard>
                <button onClick={() => setShowCoachAuth(true)} className="text-[9px] font-black text-zinc-800 uppercase tracking-widest hover:text-red-500 transition-all">ACCESO COACH</button>
             </div>
           ) : (
             <GlassCard className="max-w-xs mx-auto p-10 space-y-6 border-red-600/30">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest text-center">SEGURIDAD COACH</p>
                <input type="password" value={coachPin} onChange={e => setCoachPin(e.target.value)} placeholder="PIN" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600" />
                <NeonButton onClick={handleCoachLogin} className="w-full py-6">DESBLOQUEAR</NeonButton>
                <button onClick={() => setShowCoachAuth(false)} className="text-[9px] text-zinc-700 uppercase font-black">Cerrar</button>
             </GlassCard>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100">
      <header className="p-6 flex justify-between items-center bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-40 border-b border-zinc-900/40">
        <div className="flex flex-col">
           <span className="font-display italic text-xl uppercase leading-none text-white tracking-tighter">KINETIX</span>
           <div className="flex items-center gap-1">
             <div className={`w-1.5 h-1.5 rounded-full ${isSupabaseOk ? 'bg-green-500' : 'bg-amber-500'}`}></div>
             <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">{isSupabaseOk ? 'CLOUD' : 'LOCAL'} MODE</span>
           </div>
        </div>
        <button onClick={() => setCurrentUser(null)} className="text-zinc-700 hover:text-red-500 transition-all"><LogOut size={20} /></button>
      </header>

      <main className="flex-1 p-8 pb-40">
        {activeTab === 'home' && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <h2 className="text-5xl font-display italic tracking-tighter uppercase text-white leading-none">HOLA, <span className="text-red-600 neon-red">{currentUser.name.split(' ')[0]}</span></h2>

            {currentPlan ? (
              <GlassCard className="bg-gradient-to-br from-zinc-900 to-black p-10 border-red-600/10 group">
                <div className="space-y-8">
                   <div className="space-y-1 text-center">
                      <p className="text-cyan-400 text-[9px] font-black uppercase tracking-[0.4em] italic">PROGRAMACIÓN ACTUAL</p>
                      <h4 className="text-4xl font-display italic uppercase text-white tracking-tighter leading-none group-hover:text-red-500 transition-colors">{currentPlan.title}</h4>
                   </div>
                   <div className="space-y-3">
                    {currentPlan.workouts.map((w, idx) => (
                      <NeonButton key={w.id} onClick={() => alert("Sesión iniciada (Demo)")} variant={idx === 0 ? "primary" : "outline"} className="w-full py-6" icon={<Play size={18} fill="currentColor"/>}>
                        INICIAR: {w.name}
                      </NeonButton>
                    ))}
                    {currentPlan.coachNotes && (
                       <div className="mt-4 p-5 bg-zinc-950/50 rounded-2xl border border-zinc-900">
                          <p className="text-[8px] font-black text-cyan-400 uppercase mb-2 tracking-widest">MENSAJE DEL COACH</p>
                          <p className="text-[11px] text-zinc-400 italic leading-relaxed">{currentPlan.coachNotes}</p>
                       </div>
                    )}
                </div>
                </div>
              </GlassCard>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
                 <Activity size={24} className="text-zinc-700" />
                 <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest text-center px-8">ESPERANDO QUE EL COACH ASIGNE TU RUTINA...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
             <div className="flex justify-between items-end">
                <h2 className="text-5xl font-display italic uppercase tracking-tighter text-red-600 leading-none">TEAM<br/>KINETIX</h2>
                <button onClick={() => setShowAddUser(true)} className="bg-white/5 p-4 rounded-2xl text-cyan-400 border border-white/10 active:scale-95 transition-all"><UserPlus size={20}/></button>
             </div>
             <div className="grid gap-4">
                {users.filter(u => u.role !== 'coach').map(u => (
                  <GlassCard key={u.id} className="p-5 flex items-center justify-between bg-zinc-950/50 border-zinc-900">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center text-red-600 font-display italic text-xl border border-zinc-900">{u.name.charAt(0)}</div>
                       <div>
                        <h4 className="text-lg font-black text-white italic uppercase tracking-tighter leading-none">{u.name}</h4>
                        <span className="text-[7px] text-zinc-600 font-black uppercase tracking-widest">{u.goal}</span>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => onAiGenerate(u)} disabled={isAiGenerating} className="p-3 rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400 hover:text-black transition-all">
                          {isAiGenerating ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                       </button>
                       <button onClick={() => {
                          const existingPlan = plans.find(p => p.userId === u.id);
                          setEditingPlan({ 
                            plan: existingPlan ? JSON.parse(JSON.stringify(existingPlan)) : { id: `p-${Date.now()}`, userId: u.id, title: 'PLAN DE ÉLITE', workouts: [], updatedAt: new Date().toISOString(), coachNotes: '' }, 
                            isNew: !existingPlan 
                          });
                       }} className="bg-zinc-800/40 p-3 rounded-xl text-zinc-500 border border-zinc-800 hover:text-white transition-all"><Edit3 size={16}/></button>
                    </div>
                  </GlassCard>
                ))}
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-3xl border-t border-zinc-900/50 px-10 py-8 z-50">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={24} />} label="Panel" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={24} />} label="Gestión" />}
        </div>
      </nav>

      {showAddUser && <UserDialog onSave={async (user: any) => { await DataService.saveUser(user); syncData(); setShowAddUser(false); }} onCancel={() => setShowAddUser(false)} />}
      
      {editingPlan && (
        <PlanEditor 
          plan={editingPlan.plan} 
          allExercises={exercises} 
          onSave={async (p: any) => { 
            await DataService.savePlan(p); 
            syncData(); 
            setEditingPlan(null); 
          }} 
          onCancel={() => setEditingPlan(null)} 
        />
      )}
    </div>
  );
}

// --- COMPONENTES DE EDICIÓN (SOLUCIÓN SERIES/REPS) ---

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel }: any) => {
  // Inicializamos el estado con una copia profunda para evitar errores de referencia
  const [localPlan, setLocalPlan] = useState<Plan>(() => JSON.parse(JSON.stringify(plan)));
  const [showPicker, setShowPicker] = useState<number | null>(null);

  // Función de actualización inmutable para que React detecte cada cambio
  const updateExercise = useCallback((wIdx: number, exIdx: number, field: string, value: any) => {
    setLocalPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev)); // Clonación completa
      copy.workouts[wIdx].exercises[exIdx][field] = value;
      return copy;
    });
  }, []);

  const updateWorkoutName = useCallback((wIdx: number, name: string) => {
    setLocalPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.workouts[wIdx].name = name;
      return copy;
    });
  }, []);

  const addExercise = useCallback((wIdx: number, exId: string) => {
    const dbEx = allExercises.find((e: any) => e.id === exId);
    setLocalPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.workouts[wIdx].exercises.push({
        exerciseId: exId,
        name: dbEx.name,
        targetSets: 4,
        targetReps: "12",
        coachCue: ""
      });
      return copy;
    });
    setShowPicker(null);
  }, [allExercises]);

  const removeExercise = useCallback((wIdx: number, exIdx: number) => {
    setLocalPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.workouts[wIdx].exercises.splice(exIdx, 1);
      return copy;
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050507] z-[150] p-8 flex flex-col animate-in slide-in-from-right-full duration-500 overflow-y-auto no-scrollbar pb-40">
       <header className="flex justify-between items-center mb-10 shrink-0 sticky top-0 bg-[#050507]/90 backdrop-blur-xl py-4 z-10 border-b border-zinc-900">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-600 hover:text-white"><ChevronLeft size={24}/></button>
          <input 
            value={localPlan.title} 
            onChange={e => setLocalPlan({...localPlan, title: e.target.value})} 
            className="bg-transparent text-xl font-display italic text-white text-center outline-none uppercase tracking-tighter w-1/2" 
          />
          <button onClick={() => onSave(localPlan)} className="bg-red-600 p-5 rounded-2xl text-white shadow-xl active:scale-95 transition-all"><Save size={24}/></button>
       </header>

       <div className="space-y-8">
          {localPlan.workouts.map((w, wIdx) => (
             <GlassCard key={wIdx} className="space-y-6 border-zinc-900">
                <div className="flex justify-between items-center gap-4">
                  <input 
                    value={w.name} 
                    onChange={e => updateWorkoutName(wIdx, e.target.value)}
                    className="bg-zinc-950 border border-zinc-900 p-3 rounded-xl text-lg font-display italic text-white outline-none w-full uppercase" 
                  />
                  <button onClick={() => {
                    setLocalPlan(prev => ({...prev, workouts: prev.workouts.filter((_, i) => i !== wIdx)}));
                  }} className="text-zinc-800 hover:text-red-500"><Trash2 size={18}/></button>
                </div>

                <div className="space-y-4">
                   {w.exercises.map((ex, exIdx) => {
                     const dbEx = allExercises.find((e:any) => e.id === ex.exerciseId);
                     return (
                       <div key={exIdx} className="p-5 bg-zinc-950 rounded-[2rem] border border-zinc-900 space-y-4">
                          <div className="flex justify-between items-start">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-black uppercase text-red-600">{dbEx?.name || ex.name}</span>
                               <span className="text-[7px] text-zinc-700 font-bold uppercase">{dbEx?.muscleGroup || 'Técnica'}</span>
                             </div>
                             <button onClick={() => removeExercise(wIdx, exIdx)} className="text-zinc-800 hover:text-white"><X size={16}/></button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                             <div className="space-y-1">
                                <p className="text-[7px] font-black text-zinc-700 uppercase ml-2">SERIES</p>
                                <input 
                                  type="text" 
                                  value={ex.targetSets} 
                                  onChange={e => updateExercise(wIdx, exIdx, 'targetSets', e.target.value)} 
                                  className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white font-bold text-center outline-none focus:border-red-600" 
                                />
                             </div>
                             <div className="space-y-1">
                                <p className="text-[7px] font-black text-zinc-700 uppercase ml-2">REPS</p>
                                <input 
                                  type="text"
                                  value={ex.targetReps} 
                                  onChange={e => updateExercise(wIdx, exIdx, 'targetReps', e.target.value)} 
                                  className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white font-bold text-center outline-none focus:border-red-600" 
                                />
                             </div>
                          </div>

                          <div className="space-y-1">
                             <p className="text-[7px] font-black text-zinc-700 uppercase ml-2">INSTRUCCIÓN TÉCNICA (COACH CUE)</p>
                             <input 
                               value={ex.coachCue || ''} 
                               onChange={e => updateExercise(wIdx, exIdx, 'coachCue', e.target.value)} 
                               placeholder="Ej: Mantén el core firme..." 
                               className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white text-[10px] italic outline-none focus:border-cyan-400" 
                             />
                          </div>
                       </div>
                     );
                   })}
                   <button onClick={() => setShowPicker(wIdx)} className="w-full py-4 border-2 border-dashed border-zinc-900 rounded-2xl text-[9px] font-black text-zinc-700 uppercase tracking-widest">+ AÑADIR TÉCNICA</button>
                </div>
             </GlassCard>
          ))}
          
          <div className="space-y-6">
             <button onClick={() => setLocalPlan({...localPlan, workouts: [...localPlan.workouts, { id: `w-${Date.now()}`, name: `SESIÓN ${localPlan.workouts.length+1}`, day: localPlan.workouts.length+1, exercises: [] }]})} className="w-full py-8 border-2 border-dashed border-zinc-900 rounded-[2.5rem] text-[10px] font-black text-zinc-700 uppercase tracking-widest flex flex-col items-center gap-2 hover:bg-zinc-900/40"><Plus size={24}/> Nueva Sesión</button>
             
             <GlassCard className="border-cyan-400/20">
                <div className="flex items-center gap-3 mb-4">
                   <MessageSquare className="text-cyan-400" size={18} />
                   <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">ANOTACIONES GLOBALES DEL COACH</h3>
                </div>
                <textarea 
                  value={localPlan.coachNotes || ''} 
                  onChange={e => setLocalPlan({...localPlan, coachNotes: e.target.value})}
                  placeholder="Instrucciones sobre nutrición, descanso o enfoque de la semana..."
                  className="w-full bg-zinc-950 border border-zinc-900 p-6 rounded-[1.5rem] text-white text-xs leading-relaxed outline-none focus:border-cyan-400 h-32 no-scrollbar resize-none"
                ></textarea>
             </GlassCard>
          </div>
       </div>

       {showPicker !== null && (
         <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl p-8 flex flex-col animate-in fade-in">
            <header className="flex justify-between items-center mb-8 shrink-0">
              <h3 className="text-2xl font-display italic text-white uppercase tracking-tighter">BÓVEDA KINETIX</h3>
              <button onClick={() => setShowPicker(null)} className="text-white"><X size={24}/></button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
              {allExercises.map((ex: any) => (
                <div key={ex.id} onClick={() => addExercise(showPicker, ex.id)} className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl flex justify-between items-center group active:scale-95 transition-all">
                  <div>
                    <p className="font-black text-white uppercase italic tracking-tighter text-lg">{ex.name}</p>
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{ex.muscleGroup}</p>
                  </div>
                  <Plus size={20} className="text-zinc-800 group-hover:text-red-600" />
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
});

// --- SUBCOMPONENTES ---

const StatusItem = ({ label, active }: { label: string, active: boolean }) => (
  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-zinc-800">
    <span className="text-[8px] font-black uppercase text-zinc-500">{label}</span>
    {active ? <CheckCircle2 className="text-green-500" size={14}/> : <X className="text-red-500" size={14}/>}
  </div>
);

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-2.5 rounded-2xl ${active ? 'bg-red-600/10 scale-110' : ''}`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
  </button>
));

const UserDialog = memo(({ onSave, onCancel }: any) => {
  const [u, setU] = useState({ name: '' });
  return (
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in">
       <GlassCard className="w-full max-w-sm space-y-10 border-zinc-800">
          <h2 className="text-4xl font-display italic text-white uppercase text-center leading-none">NUEVO ATLETA</h2>
          <div className="space-y-5">
             <input placeholder="NOMBRE COMPLETO" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-2xl text-white font-bold uppercase outline-none focus:border-red-600" onChange={e => setU({name: e.target.value})} />
             <NeonButton onClick={() => onSave({
               id: `u-${Date.now()}`, 
               name: u.name, 
               email: `${u.name.toLowerCase().replace(/\s+/g, '.')}@kinetix.fit`,
               goal: Goal.GAIN_MUSCLE, 
               level: UserLevel.BEGINNER, 
               daysPerWeek: 3, 
               equipment: ['Todo'], 
               role: 'client', 
               streak: 0,
               createdAt: new Date().toISOString()
             })} className="w-full py-6">DAR DE ALTA</NeonButton>
             <button onClick={onCancel} className="w-full text-zinc-700 font-black text-[9px] uppercase tracking-widest">Cerrar</button>
          </div>
       </GlassCard>
    </div>
  );
});