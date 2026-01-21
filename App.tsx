import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, Trophy, ExternalLink, X, 
  Video, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Flame, Plus, Search, LogOut, Timer, UserPlus, 
  Edit3, ChevronLeft, Settings, Lock, Megaphone, 
  RefreshCw, Wifi, Sparkles, Activity
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { User, Plan, Workout, Exercise, WorkoutLog, Goal, UserLevel } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './geminiService';

// --- CONFIGURACIÓN DE MARCA ---
const DEFAULT_LOGO = "https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/tu-logo.png";
const DEFAULT_PIN = "KINETIX2025";

// --- CLIENTE SUPABASE ---
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const DataService = {
  getPlans: async (): Promise<Plan[]> => {
    if (!supabase) return JSON.parse(localStorage.getItem('kx_plans') || '[]');
    const { data } = await supabase.from('plans').select('*');
    return (data || []).map(p => ({ ...p, userId: p.user_id, coachNotes: p.coach_notes, updatedAt: p.updated_at }));
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
    const { data } = await supabase.from('workout_logs').select('*').order('date', { ascending: false });
    return (data || []).map(d => ({ ...d, userId: d.user_id, workoutId: d.workout_id, setsData: d.sets_data }));
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
      return stored ? JSON.parse(stored) : [MOCK_USER];
    }
    const { data } = await supabase.from('profiles').select('*');
    return (data || []).map(u => ({ ...u, id: u.id, name: u.name, goal: u.goal, level: u.level, daysPerWeek: u.days_per_week, role: u.role, equipment: u.equipment || [], streak: u.streak || 0 }));
  },
  saveUser: async (user: User) => {
    if (!supabase) {
      const users = await DataService.getUsers();
      localStorage.setItem('kx_users', JSON.stringify([...users, user]));
      return true;
    }
    const { error } = await supabase.from('profiles').insert({
      name: user.name,
      goal: user.goal,
      level: user.level,
      days_per_week: user.daysPerWeek,
      equipment: user.equipment,
      role: user.role
    });
    return !error;
  },
  getBrandConfig: () => JSON.parse(localStorage.getItem('kx_brand') || JSON.stringify({ logo: DEFAULT_LOGO, pin: DEFAULT_PIN })),
  saveBrandConfig: (config: { logo: string, pin: string }) => localStorage.setItem('kx_brand', JSON.stringify(config))
};

// --- COMPONENTES UI ---
const NeonButton = memo(({ children, onClick, variant = 'primary', className = '', loading = false, icon, disabled = false }: any) => {
  const base = "relative overflow-hidden px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] active:scale-95 disabled:opacity-30 group shrink-0 select-none";
  const styles = {
    primary: 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    secondary: 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]',
    outline: 'border border-zinc-800 hover:border-zinc-500 text-zinc-400 bg-zinc-900/40 hover:text-white',
    accent: 'bg-zinc-950 border border-red-600/30 text-red-500 hover:border-red-600 hover:bg-red-600/5'
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${base} ${styles[variant as keyof typeof styles]} ${className}`}>
      {loading ? <RefreshCw className="animate-spin" size={16} /> : <>{icon}{children}</>}
    </button>
  );
});

const GlassCard = memo(({ children, className = '', onClick, alert = false }: any) => (
  <div onClick={onClick} className={`relative bg-zinc-900/40 backdrop-blur-3xl border ${alert ? 'border-red-600/50' : 'border-zinc-800/40'} rounded-[2.5rem] p-6 shadow-2xl transition-all duration-500 ${onClick ? 'cursor-pointer hover:border-zinc-600 active:scale-[0.98]' : ''} ${className}`}>
    {alert && <div className="absolute top-4 right-4 w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]"></div>}
    {children}
  </div>
));

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'online' | 'syncing'>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutLog | null>(null);
  const [showCoachAuth, setShowCoachAuth] = useState(false);
  const [coachPinInput, setCoachPinInput] = useState('');
  const [brandConfig, setBrandConfig] = useState(DataService.getBrandConfig());

  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const stored = localStorage.getItem('kx_exercises');
    return stored ? JSON.parse(stored) : INITIAL_EXERCISES;
  });
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
      console.error("Sync Error", e);
    } finally {
      setCloudStatus('online');
    }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const handleLogin = useCallback(async () => {
    if (!loginName) return;
    setCloudStatus('syncing');
    const user = users.find(u => u.name.toLowerCase().trim() === loginName.toLowerCase().trim());
    if (user) {
      setCurrentUser(user);
      setActiveTab('home');
    } else {
      alert("Atleta no encontrado. Contacta con tu Coach.");
    }
    setCloudStatus('online');
  }, [users, loginName]);

  const handleCoachAuth = () => {
    if (coachPinInput === brandConfig.pin) {
      setCurrentUser({...MOCK_USER, role: 'coach', name: 'Master Coach', id: 'coach-id-master'});
      setActiveTab('admin');
      setShowCoachAuth(false);
      setCoachPinInput('');
    } else {
      alert("PIN INCORRECTO.");
    }
  };

  const onAiGenerate = useCallback(async (user: User) => {
    setIsAiGenerating(true);
    try {
      const generated = await generateSmartRoutine(user);
      const enrichedWorkouts = generated.workouts.map((w: any) => ({
        ...w,
        exercises: w.exercises.map((we: any) => ({
          ...we,
          name: exercises.find(e => e.id === we.exerciseId)?.name || 'Técnica'
        }))
      }));
      setEditingPlan({ 
        plan: { 
          ...generated, 
          workouts: enrichedWorkouts, 
          id: `p-${Date.now()}`, 
          userId: user.id, 
          coachNotes: 'Protocolo de IA.', 
          updatedAt: new Date().toISOString() 
        }, 
        isNew: true 
      });
    } catch (error) {
      alert("Error en IA. Verifica tus llaves en Vercel.");
    } finally { setIsAiGenerating(false); }
  }, [exercises]);

  const currentPlan = useMemo(() => plans.find(p => p.userId === currentUser?.id), [plans, currentUser]);

  const progressData = useMemo(() => {
    const userLogs = logs.filter(l => l.userId === currentUser?.id).reverse();
    return userLogs.map(l => ({
      date: new Date(l.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      volume: l.setsData.reduce((acc, s) => acc + s.sets.reduce((sum, set) => sum + (set.w * set.r), 0), 0)
    })).slice(-10);
  }, [logs, currentUser]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="text-center space-y-12 z-10 animate-in fade-in zoom-in duration-1000">
           <img src={brandConfig.logo} className="w-40 h-40 mx-auto drop-shadow-[0_0_50px_rgba(239,68,68,0.3)] float object-contain" alt="Kinetix Logo" />
           <div className="space-y-4">
              <h1 className="text-7xl font-display italic tracking-tighter uppercase text-white leading-none">KINETIX</h1>
              <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px]">FUNCTIONAL ZONE</p>
           </div>
           
           {!showCoachAuth ? (
             <div className="space-y-6">
                <GlassCard className="max-w-xs mx-auto p-10 space-y-6 bg-zinc-950/60 border-zinc-800">
                   <input value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="NOMBRE DEL ATLETA" className="w-full bg-zinc-950 border border-zinc-900 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase placeholder:text-zinc-800" />
                   <NeonButton onClick={handleLogin} loading={cloudStatus === 'syncing'} className="w-full py-6">ACCEDER</NeonButton>
                </GlassCard>
                <button onClick={() => setShowCoachAuth(true)} className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.4em] hover:text-red-500 flex items-center gap-2 mx-auto"><Lock size={12}/> ACCESO COACH</button>
             </div>
           ) : (
             <GlassCard className="max-w-xs mx-auto p-10 space-y-6 bg-zinc-950/60 border-red-600/20">
                <p className="text-[8px] font-black text-red-600 uppercase tracking-widest">SEGURIDAD</p>
                <input type="password" value={coachPinInput} onChange={e => setCoachPinInput(e.target.value)} placeholder="PIN" className="w-full bg-zinc-950 border border-zinc-900 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase" />
                <NeonButton onClick={handleCoachAuth} className="w-full py-6">DESBLOQUEAR</NeonButton>
                <button onClick={() => setShowCoachAuth(false)} className="text-[9px] text-zinc-700 uppercase font-black tracking-widest">Volver</button>
             </GlassCard>
           )}
        </div>
      </div>
    );
  }

  if (editingPlan) return <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={async (p: any) => { setCloudStatus('syncing'); await DataService.savePlan(p); syncData(); setEditingPlan(null); }} onCancel={() => setEditingPlan(null)} />;
  if (currentWorkout) return <LiveWorkout workout={currentWorkout} exercises={exercises} lastLogs={logs.filter(l => l.userId === currentUser.id)} onFinish={async (l: any) => { setCloudStatus('syncing'); await DataService.saveLog(l); syncData(); setWorkoutSummary(l); setCurrentWorkout(null); }} onCancel={() => setCurrentWorkout(null)} />;

  if (workoutSummary) return (
    <div className="fixed inset-0 z-[200] bg-[#050507] flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
       <Trophy size={80} className="text-red-600 mb-6 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
       <h2 className="text-6xl font-display italic text-white uppercase tracking-tighter text-center leading-none">MISIÓN<br/><span className="text-red-600">COMPLETADA</span></h2>
       <div className="mt-8 text-center space-y-4">
          <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs">VOLUMEN TOTAL</p>
          <p className="text-4xl font-display italic text-white">{workoutSummary.setsData.reduce((acc, s) => acc + s.sets.reduce((sum, set) => sum + (set.w * set.r), 0), 0)} KG</p>
       </div>
       <NeonButton onClick={() => setWorkoutSummary(null)} className="mt-12 w-full max-w-xs py-6">VOLVER AL PANEL</NeonButton>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100 font-sans">
      <header className="p-6 flex justify-between items-center bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-40 border-b border-zinc-900/40">
        <div className="flex items-center gap-4">
           <img src={brandConfig.logo} className="w-10 h-10 rounded-xl object-contain" alt="Logo" />
           <div className="flex flex-col">
              <span className="font-display italic text-xl uppercase leading-none text-white tracking-tighter">KINETIX</span>
              <div className="flex items-center gap-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'syncing' ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
                 <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">{supabase ? 'CLOUD READY' : 'LOCAL MODE'}</span>
              </div>
           </div>
        </div>
        <button onClick={() => setCurrentUser(null)} className="text-zinc-700 bg-zinc-900/40 p-3 rounded-xl hover:text-red-500 transition-all"><LogOut size={16} /></button>
      </header>

      <main className="flex-1 p-8 overflow-y-auto pb-40 no-scrollbar">
        {activeTab === 'home' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="space-y-2">
               <h2 className="text-5xl font-display italic tracking-tighter uppercase text-white leading-none">HOLA, <span className="text-red-600 neon-red">{currentUser.name.split(' ')[0]}</span></h2>
               <div className="flex items-center gap-2">
                  <Flame size={14} className="text-red-600" />
                  <span className="text-[9px] font-black uppercase text-zinc-500 tracking-[0.2em]">{currentUser.streak} DÍAS DE RACHA</span>
               </div>
            </div>

            {currentPlan?.coachNotes && (
              <GlassCard className="bg-red-600/10 border-red-600/20 p-6 flex items-start gap-4">
                 <Megaphone size={20} className="text-red-600 mt-1" />
                 <p className="text-sm font-bold italic text-white">"{currentPlan.coachNotes}"</p>
              </GlassCard>
            )}

            {currentPlan ? (
              <GlassCard className="bg-gradient-to-br from-zinc-900 to-black p-10 border-red-600/10 hover:border-red-600/30 group">
                <div className="space-y-8">
                   <div className="space-y-1 text-center">
                      <p className="text-cyan-400 text-[9px] font-black uppercase tracking-[0.4em] italic">PROTOCOLO DISPONIBLE</p>
                      <h4 className="text-4xl font-display italic uppercase text-white tracking-tighter leading-none group-hover:text-red-500 transition-colors">{currentPlan.title}</h4>
                   </div>
                   <NeonButton onClick={() => setCurrentWorkout(currentPlan.workouts[0] || null)} variant="primary" className="w-full py-6" icon={<Play size={18} fill="currentColor"/>}>START SESSION</NeonButton>
                </div>
              </GlassCard>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
                 <Activity size={24} className="text-zinc-700" />
                 <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em]">ESPERANDO PROGRAMACIÓN</p>
              </div>
            )}

            {progressData.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic">GRÁFICA DE RENDIMIENTO</h3>
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

        {activeTab === 'admin' && currentUser.role === 'coach' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
             <div className="flex justify-between items-end">
                <h2 className="text-5xl font-display italic uppercase tracking-tighter text-red-600 leading-none">TEAM<br/>KINETIX</h2>
                <button onClick={() => setShowAddUser(true)} className="bg-white/5 p-4 rounded-2xl text-cyan-400 border border-white/10"><UserPlus size={20}/></button>
             </div>
             <div className="grid gap-4">
                {users.filter(u => u.role === 'client').map(u => (
                  <GlassCard key={u.id} className="p-5 flex items-center justify-between bg-zinc-950/40 border-zinc-900 group">
                    <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center text-red-600 font-display italic text-xl border border-zinc-900 group-hover:border-red-600 transition-all">{u.name.charAt(0)}</div>
                       <div>
                          <h4 className="text-lg font-black text-white italic uppercase tracking-tighter">{u.name}</h4>
                          <span className="text-[7px] text-zinc-600 font-black uppercase tracking-widest">{u.goal}</span>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => onAiGenerate(u)} disabled={isAiGenerating} className="p-3 rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400 hover:text-black transition-all">
                          {isAiGenerating ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                       </button>
                       <button onClick={() => setEditingPlan({ plan: plans.find(p => p.userId === u.id) || { id: `p-${Date.now()}`, userId: u.id, title: 'Protocolo Elite', workouts: [], coachNotes: '', updatedAt: new Date().toISOString() }, isNew: true })} className="bg-zinc-800/40 p-3 rounded-xl text-zinc-500 border border-zinc-800 hover:text-white transition-all"><Edit3 size={16}/></button>
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
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={24} />} label="Equipo" />}
        </div>
      </nav>

      {showAddUser && <UserDialog onSave={async (user: any) => { setCloudStatus('syncing'); await DataService.saveUser(user); syncData(); setShowAddUser(false); }} onCancel={() => setShowAddUser(false)} />}
    </div>
  );
}

// --- SUBCOMPONENTES ---

const LiveWorkout = memo(({ workout, exercises, lastLogs, onFinish, onCancel }: any) => {
  const [idx, setIdx] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [setsLogs, setSetsLogs] = useState<{w: number, r: number}[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const intervalRef = useRef<any>(null);

  const startRest = useCallback(() => {
    setIsResting(true);
    setTimer(90);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setTimer(t => {
      if (t <= 1) { clearInterval(intervalRef.current); setIsResting(false); return 0; }
      return t - 1;
    }), 1000);
  }, []);

  const ex = workout.exercises[idx];
  const dbEx = exercises.find((e: any) => e.id === ex?.exerciseId);
  const isLast = idx === workout.exercises.length - 1;

  const handleFinish = () => {
    const currentEntry = { exerciseId: ex.exerciseId, sets: setsLogs };
    const updatedAllLogs = [...allLogs, currentEntry];
    onFinish({ 
      id: `log-${Date.now()}`,
      workoutId: workout.id,
      userId: MOCK_USER.id,
      date: new Date().toISOString(),
      setsData: updatedAllLogs
    });
  };

  const nextExercise = () => {
    const currentEntry = { exerciseId: ex.exerciseId, sets: setsLogs };
    setAllLogs([...allLogs, currentEntry]);
    setSetsLogs([]);
    setIdx(idx + 1);
  };

  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] p-8 flex flex-col animate-in slide-in-from-bottom-full duration-500">
       <header className="flex justify-between items-center mb-8">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-700"><X size={20}/></button>
          <div className="text-center">
             <p className="text-[8px] font-black text-zinc-700 tracking-[0.4em] uppercase italic">EN PROGRESO</p>
             <h2 className="text-xl font-display italic text-red-600 mt-1">{idx+1} / {workout.exercises.length}</h2>
          </div>
          <div className="w-10"></div>
       </header>

       <div className="flex-1 space-y-10 overflow-y-auto no-scrollbar">
          <div className="aspect-video bg-black rounded-[2rem] border border-zinc-900 overflow-hidden relative">
             {dbEx && <iframe className="w-full h-full opacity-60" src={`https://www.youtube.com/embed/${dbEx.videoUrl.split('/').pop()}?autoplay=1&mute=1&controls=0&loop=1`}></iframe>}
             {isResting && (
               <div className="absolute inset-0 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in">
                  <p className="text-8xl font-display italic text-white">{timer}s</p>
                  <p className="text-[10px] font-black uppercase text-red-600 mt-4 tracking-widest">DESCANSANDO</p>
                  <button onClick={() => { setIsResting(false); clearInterval(intervalRef.current); }} className="mt-8 text-zinc-700 text-xs font-bold uppercase underline">Saltar</button>
               </div>
             )}
          </div>

          <div className="space-y-6">
             <div className="space-y-1">
                <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">{dbEx?.name}</h3>
                <p className="text-cyan-400 text-xs font-bold italic">"{ex?.coachCue || 'Máxima calidad técnica.'}"</p>
             </div>
             
             <div className="bg-zinc-950/80 p-6 rounded-[2.5rem] border border-zinc-900 space-y-6">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                   <p className="text-[9px] font-black text-zinc-600 uppercase italic">HISTORIAL SERIES</p>
                   <span className="text-red-600 text-[10px] font-black uppercase">{ex?.targetSets}x{ex?.targetReps} OBJ</span>
                </div>
                <div className="space-y-2">
                   {setsLogs.map((s, i) => (
                     <div key={i} className="flex justify-between items-center bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
                        <span className="text-[10px] font-black text-zinc-700 italic">SET {i+1}</span>
                        <span className="text-sm font-display italic text-white">{s.w} KG x {s.r} REPS</span>
                     </div>
                   ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <input type="number" id="weight" className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 text-center text-lg font-display italic text-white outline-none focus:border-red-600" placeholder="KG" />
                   <input type="number" id="reps" className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 text-center text-lg font-display italic text-white outline-none focus:border-red-600" placeholder="REPS" />
                </div>
                <NeonButton onClick={() => {
                  const w = document.getElementById('weight') as HTMLInputElement;
                  const r = document.getElementById('reps') as HTMLInputElement;
                  if(w.value && r.value) {
                    setSetsLogs([...setsLogs, { w: parseFloat(w.value), r: parseInt(r.value) }]);
                    w.value = ''; r.value = '';
                  }
                }} variant="secondary" className="w-full py-5" icon={<CheckCircle2 size={16}/>}>REGISTRAR</NeonButton>
             </div>
          </div>
       </div>

       <footer className="mt-8 flex gap-4 pb-12">
          <NeonButton onClick={startRest} variant="outline" className="flex-1 py-6" icon={<Timer size={16}/>}>REST</NeonButton>
          <NeonButton onClick={isLast ? handleFinish : nextExercise} variant="primary" className="flex-[2] py-6" icon={<ArrowRight size={18}/>}>
             {isLast ? 'FINALIZAR' : 'SIGUIENTE'}
          </NeonButton>
       </footer>
    </div>
  );
});

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel }: any) => {
  const [localPlan, setLocalPlan] = useState<Plan>(plan);
  const [showPicker, setShowPicker] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] p-8 flex flex-col animate-in slide-in-from-right-full duration-500">
       <header className="flex justify-between items-center mb-10 shrink-0">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-600"><ChevronLeft size={24}/></button>
          <input value={localPlan.title} onChange={e => setLocalPlan({...localPlan, title: e.target.value})} className="bg-transparent text-2xl font-display italic text-white text-center outline-none uppercase tracking-tighter" />
          <button onClick={() => onSave(localPlan)} className="bg-red-600 p-5 rounded-2xl text-white shadow-xl"><Save size={24}/></button>
       </header>

       <div className="flex-1 overflow-y-auto space-y-8 pb-40 no-scrollbar">
          <textarea 
            value={localPlan.coachNotes} 
            onChange={e => setLocalPlan({...localPlan, coachNotes: e.target.value})}
            placeholder="Pautas del Coach..." 
            className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-sm font-bold italic text-white outline-none min-h-[100px]"
          />

          {localPlan.workouts.map((w, wIdx) => (
            <GlassCard key={wIdx} className="p-6 border-zinc-900">
               <div className="flex justify-between mb-6">
                  <input value={w.name} onChange={e => {
                    const newW = [...localPlan.workouts]; newW[wIdx].name = e.target.value;
                    setLocalPlan({...localPlan, workouts: newW});
                  }} className="bg-transparent text-2xl font-display italic text-white outline-none uppercase tracking-tighter" />
                  <button onClick={() => setLocalPlan({...localPlan, workouts: localPlan.workouts.filter((_, idx) => idx !== wIdx)})} className="text-zinc-800 hover:text-red-500"><Trash2 size={18}/></button>
               </div>
               
               <div className="space-y-4">
                  {w.exercises.map((we, eIdx) => (
                    <div key={eIdx} className="flex justify-between items-center p-4 bg-zinc-900 rounded-xl border border-zinc-800">
                       <span className="text-xs font-black uppercase text-zinc-400 italic">{we.name}</span>
                       <button onClick={() => {
                         const newW = [...localPlan.workouts];
                         newW[wIdx].exercises = newW[wIdx].exercises.filter((_, i) => i !== eIdx);
                         setLocalPlan({...localPlan, workouts: newW});
                       }} className="text-zinc-800"><X size={16}/></button>
                    </div>
                  ))}
                  <button onClick={() => setShowPicker(wIdx)} className="w-full py-4 border-2 border-dashed border-zinc-900 rounded-xl text-zinc-800 font-black text-[10px] uppercase tracking-widest">+ TÉCNICA</button>
               </div>
            </GlassCard>
          ))}
          <button onClick={() => setLocalPlan({...localPlan, workouts: [...localPlan.workouts, {id: `w-${Date.now()}`, name: `SESIÓN ${localPlan.workouts.length+1}`, day: 1, exercises: []}]})} className="w-full py-8 border-2 border-dashed border-zinc-900 rounded-2xl text-zinc-800 font-black flex flex-col items-center gap-2">
            <Plus size={24}/> <span className="text-[10px] uppercase">NUEVA SESIÓN</span>
          </button>
       </div>

       {showPicker !== null && (
         <div className="fixed inset-0 z-[120] bg-black/95 backdrop-blur-3xl p-8 flex flex-col animate-in fade-in">
            <div className="flex justify-between mb-8">
               <h3 className="text-2xl font-display italic text-white uppercase tracking-tighter">BÓVEDA KINETIX</h3>
               <button onClick={() => setShowPicker(null)} className="text-white"><X/></button>
            </div>
            <div className="space-y-3 overflow-y-auto pb-20">
               {allExercises.map(ex => (
                 <div key={ex.id} onClick={() => {
                   const newW = [...localPlan.workouts];
                   newW[showPicker].exercises.push({ exerciseId: ex.id, name: ex.name, targetSets: 3, targetReps: '12', coachCue: '' });
                   setLocalPlan({...localPlan, workouts: newW});
                   setShowPicker(null);
                 }} className="p-5 bg-zinc-900 border border-zinc-800 rounded-xl font-black text-white uppercase italic tracking-tighter cursor-pointer hover:border-red-600">
                    {ex.name}
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
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8">
       <GlassCard className="w-full max-w-sm space-y-10 bg-zinc-950">
          <h2 className="text-4xl font-display italic text-white uppercase tracking-tighter text-center">NUEVO ATLETA</h2>
          <div className="space-y-5">
             <input placeholder="NOMBRE" className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-white font-bold uppercase outline-none focus:border-red-600" onChange={e => setU({name: e.target.value})} />
             <NeonButton onClick={() => onSave({id: `u-${Date.now()}`, name: u.name, goal: Goal.GAIN_MUSCLE, level: UserLevel.BEGINNER, daysPerWeek: 3, equipment: [], role: 'client'})} className="w-full py-6">CONFIRMAR</NeonButton>
             <button onClick={onCancel} className="w-full text-zinc-800 font-black text-[9px] uppercase">Cerrar</button>
          </div>
       </GlassCard>
    </div>
  );
});
