
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

// --- CONFIGURACIÓN DE SUPABASE ---
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
    return (data || []).map(u => ({ ...u, daysPerWeek: u.days_per_week, role: u.role || 'client' }));
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

// --- COMPONENTES UI ATÓMICOS ---
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
  <div onClick={onClick} className={`bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/40 rounded-[2.5rem] p-6 shadow-2xl transition-all ${onClick ? 'cursor-pointer hover:border-zinc-600' : ''} ${className}`}>
    {children}
  </div>
));

// --- APP PRINCIPAL ---
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
      console.error("Error de sincronización", e);
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
      setCurrentUser({...MOCK_USER, role: 'coach', name: 'Master Coach'});
      setActiveTab('admin');
      setShowCoachAuth(false);
    } else {
      alert("PIN Incorrecto");
    }
  };

  const onAiGenerate = useCallback(async (user: User) => {
    setIsAiGenerating(true);
    try {
      const generated = await generateSmartRoutine(user);
      const enrichedPlan = {
        ...generated,
        id: `p-${Date.now()}`,
        userId: user.id,
        updatedAt: new Date().toISOString()
      };
      setEditingPlan({ plan: enrichedPlan, isNew: true });
    } catch (error) {
      alert("Error con Gemini IA. Revisa tu API_KEY.");
    } finally { setIsAiGenerating(false); }
  }, []);

  const currentPlan = useMemo(() => plans.find(p => p.userId === currentUser?.id), [plans, currentUser]);

  const progressData = useMemo(() => {
    return logs.filter(l => l.userId === currentUser?.id).reverse().map(l => ({
      date: new Date(l.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      volume: l.setsData.reduce((acc, s) => acc + s.sets.reduce((sum, set) => sum + (set.w * set.r), 0), 0)
    })).slice(-7);
  }, [logs, currentUser]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-12 animate-in fade-in duration-1000">
           <div className="space-y-4">
              <h1 className="text-7xl font-display italic tracking-tighter uppercase text-white leading-none">KINETIX</h1>
              <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px]">FUNCTIONAL ZONE</p>
           </div>
           
           {!showCoachAuth ? (
             <div className="space-y-6">
                <GlassCard className="max-w-xs mx-auto p-10 space-y-6">
                   <input value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="NOMBRE DEL ATLETA" className="w-full bg-zinc-950 border border-zinc-900 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase" />
                   <NeonButton onClick={handleLogin} className="w-full">ENTRAR</NeonButton>
                </GlassCard>
                <button onClick={() => setShowCoachAuth(true)} className="text-[9px] font-black text-zinc-800 uppercase tracking-widest hover:text-red-500 transition-all">Acceso Coach</button>
             </div>
           ) : (
             <GlassCard className="max-w-xs mx-auto p-10 space-y-6 border-red-600/20">
                <input type="password" value={coachPin} onChange={e => setCoachPin(e.target.value)} placeholder="PIN" className="w-full bg-zinc-950 border border-zinc-900 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600" />
                <NeonButton onClick={handleCoachLogin} className="w-full">DESBLOQUEAR</NeonButton>
                <button onClick={() => setShowCoachAuth(false)} className="text-[9px] text-zinc-700 uppercase font-black">Volver</button>
             </GlassCard>
           )}
        </div>
      </div>
    );
  }

  if (editingPlan) return <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={async (p: any) => { await DataService.savePlan(p); syncData(); setEditingPlan(null); }} onCancel={() => setEditingPlan(null)} />;
  if (currentWorkout) return <LiveWorkout workout={currentWorkout} exercises={exercises} onFinish={async (l: any) => { await DataService.saveLog(l); syncData(); setWorkoutSummary(l); setCurrentWorkout(null); }} onCancel={() => setCurrentWorkout(null)} />;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100">
      <header className="p-6 flex justify-between items-center bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-40 border-b border-zinc-900/40">
        <div className="flex flex-col">
           <span className="font-display italic text-xl uppercase leading-none text-white tracking-tighter">KINETIX</span>
           <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">{cloudStatus === 'online' ? 'CONNECTED' : 'SYNCING...'}</span>
        </div>
        <button onClick={() => setCurrentUser(null)} className="text-zinc-700 hover:text-red-500"><LogOut size={20} /></button>
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
                      <h4 className="text-4xl font-display italic uppercase text-white tracking-tighter leading-none">{currentPlan.title}</h4>
                   </div>
                   <NeonButton onClick={() => setCurrentWorkout(currentPlan.workouts[0])} variant="primary" className="w-full py-6" icon={<Play size={18} fill="currentColor"/>}>EMPEZAR YA</NeonButton>
                </div>
              </GlassCard>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
                 <Activity size={24} className="text-zinc-700" />
                 <p className="text-[9px] text-zinc-600 uppercase font-bold">ESPERANDO PLAN DEL COACH</p>
              </div>
            )}

            {progressData.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic">PROGRESO DE VOLUMEN</h3>
                <div className="h-48 w-full bg-zinc-950/40 rounded-[2.5rem] p-4 border border-zinc-900">
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
          <div className="space-y-10">
             <div className="flex justify-between items-end">
                <h2 className="text-5xl font-display italic uppercase tracking-tighter text-red-600 leading-none">TEAM<br/>KINETIX</h2>
                <button onClick={() => setShowAddUser(true)} className="bg-white/5 p-4 rounded-2xl text-cyan-400 border border-white/10"><UserPlus size={20}/></button>
             </div>
             <div className="grid gap-4">
                {users.filter(u => u.role !== 'coach').map(u => (
                  <GlassCard key={u.id} className="p-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center text-red-600 font-display italic text-xl border border-zinc-900">{u.name.charAt(0)}</div>
                       <h4 className="text-lg font-black text-white italic uppercase tracking-tighter">{u.name}</h4>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => onAiGenerate(u)} disabled={isAiGenerating} className="p-3 rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                          {isAiGenerating ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                       </button>
                       <button onClick={() => setEditingPlan({ plan: plans.find(p => p.userId === u.id) || { id: `p-${Date.now()}`, userId: u.id, title: 'Protocolo Elite', workouts: [], coachNotes: '', updatedAt: new Date().toISOString() }, isNew: true })} className="bg-zinc-800/40 p-3 rounded-xl text-zinc-500 border border-zinc-800"><Edit3 size={16}/></button>
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

      {showAddUser && <UserDialog onSave={async (user: any) => { await DataService.saveUser(user); syncData(); setShowAddUser(false); }} onCancel={() => setShowAddUser(false)} />}
    </div>
  );
}

// --- SUBCOMPONENTES ---

const LiveWorkout = memo(({ workout, exercises, onFinish, onCancel }: any) => {
  const [idx, setIdx] = useState(0);
  const [setsLogs, setSetsLogs] = useState<{w: number, r: number}[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);

  const ex = workout.exercises[idx];
  const dbEx = exercises.find((e: any) => e.id === ex?.exerciseId);

  const next = () => {
    const entry = { exerciseId: ex.exerciseId, sets: setsLogs };
    const updated = [...allLogs, entry];
    if (idx === workout.exercises.length - 1) {
      onFinish({ userId: MOCK_USER.id, workoutId: workout.id, date: new Date().toISOString(), setsData: updated });
    } else {
      setAllLogs(updated);
      setSetsLogs([]);
      setIdx(idx + 1);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] p-8 flex flex-col">
       <header className="flex justify-between items-center mb-8">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-700"><X size={20}/></button>
          <h2 className="text-xl font-display italic text-red-600">{idx+1} / {workout.exercises.length}</h2>
          <div className="w-10"></div>
       </header>
       <div className="flex-1 space-y-10">
          <div className="aspect-video bg-black rounded-[2rem] border border-zinc-900 overflow-hidden relative">
             {dbEx && <iframe className="w-full h-full opacity-60" src={`https://www.youtube.com/embed/${dbEx.videoUrl.split('/').pop()}?autoplay=1&mute=1&controls=0&loop=1`}></iframe>}
          </div>
          <div className="space-y-6">
             <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">{dbEx?.name}</h3>
             <div className="bg-zinc-950 p-6 rounded-[2rem] border border-zinc-900 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <input type="number" id="w" className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 text-center text-white" placeholder="PESO KG" />
                   <input type="number" id="r" className="bg-zinc-900 p-5 rounded-xl border border-zinc-800 text-center text-white" placeholder="REPS" />
                </div>
                <NeonButton onClick={() => {
                   const w = (document.getElementById('w') as HTMLInputElement).value;
                   const r = (document.getElementById('r') as HTMLInputElement).value;
                   if(w && r) setSetsLogs([...setsLogs, {w: parseFloat(w), r: parseInt(r)}]);
                }} variant="secondary" className="w-full">REGISTRAR SERIE</NeonButton>
                <div className="space-y-2">
                   {setsLogs.map((s, i) => <div key={i} className="text-[10px] font-black uppercase text-zinc-500">SET {i+1}: {s.w}kg x {s.r} reps</div>)}
                </div>
             </div>
          </div>
       </div>
       <NeonButton onClick={next} className="w-full py-6 mt-8">{idx === workout.exercises.length - 1 ? 'FINALIZAR' : 'SIGUIENTE'}</NeonButton>
    </div>
  );
});

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel }: any) => {
  const [localPlan, setLocalPlan] = useState<Plan>(plan);
  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] p-8 flex flex-col overflow-y-auto no-scrollbar">
       <header className="flex justify-between items-center mb-10 shrink-0">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-600"><ChevronLeft size={24}/></button>
          <input value={localPlan.title} onChange={e => setLocalPlan({...localPlan, title: e.target.value})} className="bg-transparent text-2xl font-display italic text-white text-center outline-none uppercase" />
          <button onClick={() => onSave(localPlan)} className="bg-red-600 p-5 rounded-2xl text-white shadow-xl"><Save size={24}/></button>
       </header>
       <div className="space-y-6">
          {localPlan.workouts.map((w, i) => (
             <GlassCard key={i} className="space-y-4">
                <input value={w.name} onChange={e => {
                   const nw = [...localPlan.workouts]; nw[i].name = e.target.value;
                   setLocalPlan({...localPlan, workouts: nw});
                }} className="bg-transparent text-xl font-display italic text-white outline-none w-full" />
                <div className="space-y-2">
                   {w.exercises.map((ex, j) => <div key={j} className="text-[10px] font-black text-zinc-500 uppercase flex justify-between"><span>{ex.name}</span> <span>{ex.targetSets}x{ex.targetReps}</span></div>)}
                </div>
             </GlassCard>
          ))}
       </div>
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
       <GlassCard className="w-full max-w-sm space-y-10">
          <h2 className="text-4xl font-display italic text-white uppercase text-center">NUEVO ATLETA</h2>
          <div className="space-y-5">
             <input placeholder="NOMBRE" className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-white font-bold uppercase" onChange={e => setU({name: e.target.value})} />
             <NeonButton onClick={() => onSave({id: `u-${Date.now()}`, name: u.name, goal: Goal.GAIN_MUSCLE, level: UserLevel.BEGINNER, daysPerWeek: 3, equipment: [], role: 'client'})} className="w-full">CONFIRMAR</NeonButton>
             <button onClick={onCancel} className="w-full text-zinc-800 font-black text-[9px] uppercase">Cerrar</button>
          </div>
       </GlassCard>
    </div>
  );
});
