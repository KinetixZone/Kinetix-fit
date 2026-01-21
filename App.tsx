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
      return (data || []).map(p => ({ ...p, userId: p.user_id, coachNotes: p.coach_notes, updatedAt: p.updated_at }));
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

// --- COMPONENTES UI REUTILIZABLES ---
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

// --- VISTA DE ENTRENAMIENTO EN VIVO ---
const LiveWorkout = memo(({ workout, exercises, onFinish, onCancel }: any) => {
  const [idx, setIdx] = useState(0);
  const [setsLogs, setSetsLogs] = useState<{w: number, r: number}[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [timer, setTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const intervalRef = useRef<any>(null);

  const currentExercise = workout.exercises[idx];
  const dbInfo = exercises.find((e: any) => e.id === currentExercise?.exerciseId);

  const startRest = useCallback(() => {
    setIsResting(true);
    setTimer(60);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setTimer(t => {
        if (t <= 1) {
          clearInterval(intervalRef.current);
          setIsResting(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  const next = () => {
    const entry = { exerciseId: currentExercise.exerciseId, sets: setsLogs };
    const updated = [...allLogs, entry];
    if (idx === workout.exercises.length - 1) {
      onFinish({ 
        id: `log-${Date.now()}`,
        userId: MOCK_USER.id, 
        workoutId: workout.id, 
        date: new Date().toISOString(), 
        setsData: updated,
        rpe: 8 
      });
    } else {
      setAllLogs(updated);
      setSetsLogs([]);
      setIdx(idx + 1);
      setIsResting(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] p-8 flex flex-col animate-in slide-in-from-bottom-full duration-500">
       <header className="flex justify-between items-center mb-8">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-700"><X size={20}/></button>
          <div className="text-center">
            <h2 className="text-xl font-display italic text-red-600 neon-red">{idx+1} / {workout.exercises.length}</h2>
            <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest mt-1">EN PROGRESO</p>
          </div>
          <div className="w-10"></div>
       </header>

       <div className="flex-1 space-y-10 overflow-y-auto no-scrollbar pb-24">
          <div className="aspect-video bg-black rounded-[2.5rem] border border-zinc-900 overflow-hidden relative shadow-2xl">
             {dbInfo && <iframe className="w-full h-full opacity-60" src={`https://www.youtube.com/embed/${dbInfo.videoUrl.split('/').pop()}?autoplay=1&mute=1&controls=0&loop=1`}></iframe>}
             {isResting && (
               <div className="absolute inset-0 bg-black/80 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in">
                  <span className="text-8xl font-display italic text-white neon-red">{timer}s</span>
                  <p className="text-[10px] font-black uppercase text-red-600 mt-4 tracking-[0.4em]">DESCANSANDO</p>
                  <button onClick={() => setIsResting(false)} className="mt-6 text-[8px] font-black text-zinc-600 underline uppercase tracking-widest">Saltar descanso</button>
               </div>
             )}
          </div>

          <div className="space-y-6">
             <div className="space-y-1">
                <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">{dbInfo?.name}</h3>
                <p className="text-cyan-400 text-[10px] font-black italic">"{currentExercise?.coachCue || 'Enfoque técnico máximo'}"</p>
             </div>
             
             <div className="bg-zinc-950 p-6 rounded-[2.5rem] border border-zinc-900 space-y-6">
                <div className="flex justify-between items-center text-[10px] font-black uppercase text-zinc-600 border-b border-zinc-900 pb-4">
                  <span>OBJETIVO: {currentExercise.targetSets}X{currentExercise.targetReps}</span>
                  <span>REGISTRO</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <p className="text-[8px] font-black text-zinc-700 uppercase ml-2">PESO (KG)</p>
                     <input type="number" id="weight" className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center text-white font-display italic text-2xl outline-none focus:border-red-600" placeholder="0" />
                   </div>
                   <div className="space-y-2">
                     <p className="text-[8px] font-black text-zinc-700 uppercase ml-2">REPS</p>
                     <input type="number" id="reps" className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center text-white font-display italic text-2xl outline-none focus:border-red-600" placeholder="0" />
                   </div>
                </div>
                <NeonButton onClick={() => {
                   const w = (document.getElementById('weight') as HTMLInputElement);
                   const r = (document.getElementById('reps') as HTMLInputElement);
                   if(w.value && r.value) {
                     setSetsLogs([...setsLogs, {w: parseFloat(w.value), r: parseInt(r.value)}]);
                     w.value = ''; r.value = '';
                     startRest();
                   }
                }} variant="secondary" className="w-full py-5">REGISTRAR SERIE</NeonButton>
                <div className="space-y-2">
                   {setsLogs.map((s, i) => (
                     <div key={i} className="flex justify-between items-center p-4 bg-zinc-900/40 rounded-2xl border border-zinc-800/30">
                       <span className="text-[10px] font-black text-zinc-600 italic">SERIE {i+1}</span>
                       <span className="text-lg font-display italic text-white">{s.w} KG <span className="text-xs text-zinc-500 not-italic font-bold ml-1">x</span> {s.r}</span>
                     </div>
                   ))}
                </div>
             </div>
          </div>
       </div>
       <div className="absolute bottom-10 left-8 right-8">
        <NeonButton onClick={next} className="w-full py-6 shadow-2xl" icon={<ArrowRight size={18}/>}>
          {idx === workout.exercises.length - 1 ? 'FINALIZAR SESIÓN' : 'SIGUIENTE EJERCICIO'}
        </NeonButton>
       </div>
    </div>
  );
});

// --- APLICACIÓN PRINCIPAL ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'online' | 'syncing'>('online');
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutLog | null>(null);
  const [showCoachAuth, setShowCoachAuth] = useState(false);
  const [coachPin, setCoachPin] = useState('');
  const [showDiagnostics, setShowDiagnostics] = useState(false);

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
    } catch (e) {
      console.error("Error sincronizando:", e);
    } finally {
      setCloudStatus('online');
    }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const handleLogin = useCallback(() => {
    const user = users.find(u => u.name.toLowerCase().trim() === loginName.toLowerCase().trim());
    if (user) {
      setCurrentUser(user);
      setActiveTab('home');
    } else {
      alert("Atleta no registrado. El Coach debe darte de alta.");
    }
  }, [users, loginName]);

  const handleCoachLogin = () => {
    if (coachPin === 'KINETIX2025') {
      setCurrentUser({
        ...(MOCK_USER as User),
        role: 'coach',
        name: 'Master Coach',
        email: 'coach@kinetix.fit'
      });
      setActiveTab('admin');
      setShowCoachAuth(false);
    } else {
      alert("PIN Incorrecto");
    }
  };

  const onAiGenerate = useCallback(async (user: User) => {
    if (!isGeminiOk) {
      setShowDiagnostics(true);
      return;
    }
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
    } catch (error: any) {
      alert(`Error IA: ${error.message}`);
    } finally { setIsAiGenerating(false); }
  }, []);

  const currentPlan = useMemo(() => plans.find(p => p.userId === currentUser?.id), [plans, currentUser]);

  const progressData = useMemo(() => {
    const userLogs = logs.filter(l => l.userId === currentUser?.id).reverse();
    return userLogs.map(l => ({
      date: new Date(l.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      volume: l.setsData.reduce((acc, s) => acc + s.sets.reduce((sum, set) => sum + (set.w * set.r), 0), 0)
    })).slice(-7);
  }, [logs, currentUser]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-8">
        {(!isSupabaseOk || !isGeminiOk || showDiagnostics) && (
          <div className="absolute top-8 left-8 right-8 bg-zinc-900 border border-red-600/30 p-6 rounded-[2rem] space-y-4 animate-in fade-in slide-in-from-top-4 z-50">
             <div className="flex items-center gap-3">
                <AlertTriangle className="text-red-600" size={24} />
                <h3 className="text-[10px] font-black text-white uppercase tracking-widest">SISTEMA INCOMPLETO</h3>
                <button onClick={() => setShowDiagnostics(false)} className="ml-auto text-zinc-700"><X size={16}/></button>
             </div>
             <div className="grid grid-cols-1 gap-2">
                <StatusItem label="SUPABASE_URL" active={!!CONFIG.supabaseUrl} />
                <StatusItem label="SUPABASE_KEY" active={!!CONFIG.supabaseKey} />
                <StatusItem label="API_KEY (GEMINI)" active={!!CONFIG.geminiKey} />
             </div>
             <p className="text-[8px] text-zinc-500 font-bold uppercase leading-relaxed">
               Agrega las variables en Vercel y haz REDEPLOY.
             </p>
          </div>
        )}
        
        <div className="text-center space-y-12 animate-in zoom-in duration-1000">
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
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">SEGURIDAD COACH</p>
                <input type="password" value={coachPin} onChange={e => setCoachPin(e.target.value)} placeholder="PIN" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600" />
                <NeonButton onClick={handleCoachLogin} className="w-full py-6">DESBLOQUEAR</NeonButton>
                <button onClick={() => setShowCoachAuth(false)} className="text-[9px] text-zinc-700 uppercase font-black">Cerrar</button>
             </GlassCard>
           )}
        </div>
      </div>
    );
  }

  if (currentWorkout) return <LiveWorkout workout={currentWorkout} exercises={exercises} onFinish={async (l: any) => { await DataService.saveLog(l); syncData(); setWorkoutSummary(l); setCurrentWorkout(null); }} onCancel={() => setCurrentWorkout(null)} />;

  if (workoutSummary) return (
    <div className="fixed inset-0 z-[200] bg-[#050507] flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
       <Trophy size={80} className="text-red-600 mb-6 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
       <h2 className="text-6xl font-display italic text-white uppercase tracking-tighter text-center leading-none">MISIÓN<br/><span className="text-red-600 neon-red">COMPLETADA</span></h2>
       <div className="mt-8 text-center space-y-2">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">VOLUMEN TOTAL (KG)</p>
          <p className="text-5xl font-display italic text-white">{workoutSummary.setsData.reduce((acc, s) => acc + s.sets.reduce((sum, set) => sum + (set.w * set.r), 0), 0)}</p>
       </div>
       <NeonButton onClick={() => setWorkoutSummary(null)} className="mt-12 w-full max-w-xs py-6">VOLVER AL PANEL</NeonButton>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100">
      <header className="p-6 flex justify-between items-center bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-40 border-b border-zinc-900/40">
        <div className="flex flex-col">
           <span className="font-display italic text-xl uppercase leading-none text-white tracking-tighter">KINETIX</span>
           <div className="flex items-center gap-1">
             <div className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'online' ? (isSupabaseOk ? 'bg-green-500' : 'bg-amber-500') : 'bg-cyan-500 animate-pulse'}`}></div>
             <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">{isSupabaseOk ? (cloudStatus === 'online' ? 'CLOUD READY' : 'SYNCING...') : 'LOCAL STORAGE'}</span>
           </div>
        </div>
        <button onClick={() => setCurrentUser(null)} className="text-zinc-700 hover:text-red-500 transition-all"><LogOut size={20} /></button>
      </header>

      <main className="flex-1 p-8 overflow-y-auto pb-40 no-scrollbar">
        {activeTab === 'home' && (
          <div className="space-y-12 animate-in slide-in-from-top-4 duration-700">
            <div className="space-y-2">
               <h2 className="text-5xl font-display italic tracking-tighter uppercase text-white leading-none">HOLA, <span className="text-red-600 neon-red">{currentUser.name.split(' ')[0]}</span></h2>
               <div className="flex items-center gap-2">
                  <Flame size={14} className="text-red-600" />
                  <span className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em]">{currentUser.streak} DÍAS DE RACHA</span>
               </div>
            </div>

            {currentPlan ? (
              <GlassCard className="bg-gradient-to-br from-zinc-900 to-black p-10 border-red-600/10 group">
                <div className="space-y-8">
                   <div className="space-y-1 text-center">
                      <p className="text-cyan-400 text-[9px] font-black uppercase tracking-[0.4em] italic">SESIÓN RECOMENDADA</p>
                      <h4 className="text-4xl font-display italic uppercase text-white tracking-tighter leading-none group-hover:text-red-500 transition-colors">{currentPlan.title}</h4>
                   </div>
                   <div className="space-y-3">
                    {currentPlan.workouts.map((w, idx) => (
                      <NeonButton key={w.id} onClick={() => setCurrentWorkout(w)} variant={idx === 0 ? "primary" : "outline"} className="w-full py-6" icon={<Play size={18} fill="currentColor"/>}>
                        INICIAR: {w.name}
                      </NeonButton>
                    ))}
                   </div>
                </div>
              </GlassCard>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
                 <Activity size={24} className="text-zinc-700" />
                 <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">ESPERANDO PROGRAMACIÓN</p>
              </div>
            )}

            {progressData.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic">RENDIMIENTO ÚLTIMAS SESIONES</h3>
                <div className="h-48 w-full bg-zinc-950/40 rounded-[2.5rem] p-4 border border-zinc-900 shadow-inner">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                      <XAxis dataKey="date" stroke="#3f3f46" fontSize={8} />
                      <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }} />
                      <Area type="monotone" dataKey="volume" stroke="#ef4444" fill="#ef4444" fillOpacity={0.05} strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
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
                            plan: existingPlan || { id: `p-${Date.now()}`, userId: u.id, title: 'PLAN DE ÉLITE', workouts: [], updatedAt: new Date().toISOString(), coachNotes: '' }, 
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

// --- SUBCOMPONENTES ---

const StatusItem = ({ label, active }: { label: string, active: boolean }) => (
  <div className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-zinc-800">
    <span className="text-[8px] font-black uppercase text-zinc-500">{label}</span>
    {active ? <CheckCircle2 className="text-green-500" size={14}/> : <X className="text-red-500" size={14}/>}
  </div>
);

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel }: any) => {
  const [localPlan, setLocalPlan] = useState<Plan>(plan);
  const [showPicker, setShowPicker] = useState<number | null>(null);

  const updateExercise = (wIdx: number, exIdx: number, field: string, value: any) => {
    const nw = [...localPlan.workouts];
    nw[wIdx].exercises[exIdx] = { ...nw[wIdx].exercises[exIdx], [field]: value };
    setLocalPlan({ ...localPlan, workouts: nw });
  };

  return (
    <div className="fixed inset-0 bg-[#050507] z-[150] p-8 flex flex-col animate-in slide-in-from-right-full duration-500 overflow-y-auto no-scrollbar pb-32">
       <header className="flex justify-between items-center mb-10 shrink-0 sticky top-0 bg-[#050507] py-4 z-10 border-b border-zinc-900">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-600"><ChevronLeft size={24}/></button>
          <input value={localPlan.title} onChange={e => setLocalPlan({...localPlan, title: e.target.value})} className="bg-transparent text-2xl font-display italic text-white text-center outline-none uppercase tracking-tighter" />
          <button onClick={() => onSave(localPlan)} className="bg-red-600 p-5 rounded-2xl text-white shadow-xl hover:scale-110 transition-all"><Save size={24}/></button>
       </header>

       <div className="space-y-8">
          {localPlan.workouts.map((w, wIdx) => (
             <GlassCard key={wIdx} className="space-y-6 border-zinc-900">
                <div className="flex justify-between items-center">
                  <input value={w.name} onChange={e => {
                    const nw = [...localPlan.workouts]; nw[wIdx].name = e.target.value;
                    setLocalPlan({...localPlan, workouts: nw});
                  }} className="bg-transparent text-xl font-display italic text-white outline-none w-full uppercase" />
                  <button onClick={() => {
                    const nw = localPlan.workouts.filter((_, i) => i !== wIdx);
                    setLocalPlan({...localPlan, workouts: nw});
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
                               <span className="text-[8px] font-bold text-zinc-700 uppercase">{dbEx?.muscleGroup}</span>
                             </div>
                             <button onClick={() => {
                               const nw = [...localPlan.workouts];
                               nw[wIdx].exercises = nw[wIdx].exercises.filter((_, i) => i !== exIdx);
                               setLocalPlan({...localPlan, workouts: nw});
                             }} className="text-zinc-800"><X size={16}/></button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                             <div>
                                <p className="text-[7px] font-black text-zinc-700 uppercase ml-2 mb-1">SERIES</p>
                                <input type="number" value={ex.targetSets} onChange={e => updateExercise(wIdx, exIdx, 'targetSets', parseInt(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white font-bold text-center outline-none focus:border-red-600" />
                             </div>
                             <div>
                                <p className="text-[7px] font-black text-zinc-700 uppercase ml-2 mb-1">REPETICIONES</p>
                                <input value={ex.targetReps} onChange={e => updateExercise(wIdx, exIdx, 'targetReps', e.target.value)} className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white font-bold text-center outline-none focus:border-red-600" />
                             </div>
                          </div>

                          <div>
                             <p className="text-[7px] font-black text-zinc-700 uppercase ml-2 mb-1">COACH CUE (INSTRUCCIÓN)</p>
                             <input value={ex.coachCue || ''} onChange={e => updateExercise(wIdx, exIdx, 'coachCue', e.target.value)} placeholder="Ej: Pecho alto, codos cerrados..." className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-xl text-white text-[10px] italic outline-none focus:border-cyan-400 placeholder:text-zinc-800" />
                          </div>
                       </div>
                     );
                   })}
                   <button onClick={() => setShowPicker(wIdx)} className="w-full py-4 border-2 border-dashed border-zinc-900 rounded-2xl text-[9px] font-black text-zinc-700 uppercase tracking-widest hover:border-zinc-700 hover:text-zinc-500 transition-all">+ AÑADIR EJERCICIO</button>
                </div>
             </GlassCard>
          ))}
          
          <div className="space-y-4">
             <button onClick={() => setLocalPlan({...localPlan, workouts: [...localPlan.workouts, { id: `w-${Date.now()}`, name: `SESIÓN ${localPlan.workouts.length+1}`, day: localPlan.workouts.length+1, exercises: [] }]})} className="w-full py-8 border-2 border-dashed border-zinc-900 rounded-[2.5rem] text-[10px] font-black text-zinc-700 uppercase tracking-widest flex flex-col items-center gap-2 hover:bg-zinc-900/20 transition-all"><Plus size={24}/> Nueva Sesión</button>
             
             <GlassCard className="border-cyan-400/20">
                <div className="flex items-center gap-3 mb-4">
                   <MessageSquare className="text-cyan-400" size={18} />
                   <h3 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">NOTAS GENERALES DEL COACH</h3>
                </div>
                <textarea 
                  value={localPlan.coachNotes || ''} 
                  onChange={e => setLocalPlan({...localPlan, coachNotes: e.target.value})}
                  placeholder="Instrucciones globales, nutrición, enfoque de la semana..."
                  className="w-full bg-zinc-950 border border-zinc-900 p-6 rounded-[1.5rem] text-white text-xs leading-relaxed outline-none focus:border-cyan-400 h-32 no-scrollbar"
                ></textarea>
             </GlassCard>
          </div>
       </div>

       {showPicker !== null && (
         <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-3xl p-8 animate-in fade-in flex flex-col">
            <header className="flex justify-between items-center mb-8 shrink-0">
              <h3 className="text-2xl font-display italic text-white uppercase tracking-tighter">BIBLIOTECA KINETIX</h3>
              <button onClick={() => setShowPicker(null)} className="text-white"><X size={24}/></button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar">
              {allExercises.map((ex: any) => (
                <div key={ex.id} onClick={() => {
                  const nw = [...localPlan.workouts];
                  nw[showPicker].exercises.push({ exerciseId: ex.id, name: ex.name, targetSets: 3, targetReps: '12', coachCue: '' });
                  setLocalPlan({...localPlan, workouts: nw});
                  setShowPicker(null);
                }} className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl group hover:border-red-600 transition-all cursor-pointer flex justify-between items-center">
                  <div>
                    <p className="font-black text-white uppercase italic tracking-tighter text-lg">{ex.name}</p>
                    <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{ex.muscleGroup}</p>
                  </div>
                  <Plus size={20} className="text-zinc-800 group-hover:text-red-600 transition-colors" />
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
});

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
             <input placeholder="NOMBRE COMPLETO" className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-white font-bold uppercase outline-none focus:border-red-600" onChange={e => setU({name: e.target.value})} />
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
             <button onClick={onCancel} className="w-full text-zinc-800 font-black text-[9px] uppercase tracking-widest">Cerrar</button>
          </div>
       </GlassCard>
    </div>
  );
});