
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  MessageSquare, Database, Settings, Image as ImageIcon, Cpu, Dumbbell, 
  History, Trophy, Target, ChevronRight, Clock, Weight, LineChart, BarChart3,
  TrendingUp, Check, ShieldAlert, Zap, Bell
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, WorkoutLog, SetLog } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './geminiService';

// --- SISTEMA DE CONFIGURACIÓN Y PERSISTENCIA ---
const CONFIG = {
  get: (key: string) => (process.env as any)[key] || localStorage.getItem(`KX_V4_${key}`) || '',
  set: (key: string, val: string) => localStorage.setItem(`KX_V4_${key}`, val),
  isCloud: () => !!((process.env as any)['SUPABASE_URL'] || localStorage.getItem('KX_V4_SUPABASE_URL')),
  logo: () => localStorage.getItem('KX_V4_LOGO') || ''
};

const supabase = CONFIG.isCloud() ? createClient(CONFIG.get('SUPABASE_URL'), CONFIG.get('SUPABASE_ANON_KEY')) : null;

// --- DATA SERVICE: NUCLEO DE DATOS ---
const DataService = {
  async fetchExercises(): Promise<Exercise[]> {
    if (!supabase) return JSON.parse(localStorage.getItem('KX_EXERCISES') || JSON.stringify(INITIAL_EXERCISES));
    const { data } = await supabase.from('exercises').select('*');
    return data || INITIAL_EXERCISES;
  },
  async saveExercise(ex: Exercise) {
    const current = await this.fetchExercises();
    const updated = [...current.filter(e => e.id !== ex.id), ex];
    localStorage.setItem('KX_EXERCISES', JSON.stringify(updated));
    if (supabase) await supabase.from('exercises').upsert(ex);
    return true;
  },
  async fetchUsers(): Promise<User[]> {
    if (!supabase) return JSON.parse(localStorage.getItem('KX_USERS') || JSON.stringify([MOCK_USER]));
    const { data } = await supabase.from('profiles').select('*').order('name');
    return data?.map(u => ({ ...u, daysPerWeek: u.days_per_week, role: u.role || 'client' })) || [];
  },
  async saveProfile(user: User) {
    const current = await this.fetchUsers();
    const updated = [...current.filter(u => u.id !== user.id), user];
    localStorage.setItem('KX_USERS', JSON.stringify(updated));
    if (supabase) await supabase.from('profiles').upsert({
      id: user.id, name: user.name, goal: user.goal, level: user.level, days_per_week: user.daysPerWeek,
      equipment: user.equipment, role: user.role, streak: user.streak, created_at: user.createdAt
    });
    return true;
  },
  async fetchPlan(userId: string): Promise<Plan | null> {
    if (!supabase) return JSON.parse(localStorage.getItem(`KX_PLAN_${userId}`) || 'null');
    const { data } = await supabase.from('plans').select('*').eq('user_id', userId).maybeSingle();
    return data ? { ...data, userId: data.user_id, coachNotes: data.coach_notes } : null;
  },
  async savePlan(plan: Plan) {
    localStorage.setItem(`KX_PLAN_${plan.userId}`, JSON.stringify(plan));
    if (supabase) await supabase.from('plans').upsert({
      user_id: plan.userId, title: plan.title, workouts: plan.workouts, coach_notes: plan.coachNotes
    });
    return true;
  },
  async fetchLogs(userId: string): Promise<WorkoutLog[]> {
    if (!supabase) return JSON.parse(localStorage.getItem(`KX_LOGS_${userId}`) || '[]');
    const { data } = await supabase.from('logs').select('*').eq('user_id', userId).order('date', { ascending: false });
    return data || [];
  },
  async saveLog(log: WorkoutLog) {
    const current = await this.fetchLogs(log.userId);
    localStorage.setItem(`KX_LOGS_${log.userId}`, JSON.stringify([log, ...current]));
    if (supabase) await supabase.from('logs').insert({
      id: log.id, user_id: log.userId, workout_id: log.workoutId, date: log.date, exercises_data: log.exercisesData
    });
    return true;
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const s = sessionStorage.getItem('kx_session');
    return s ? JSON.parse(s) : null;
  });
  const [activeTab, setActiveTab] = useState('home');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [myPlan, setMyPlan] = useState<Plan | null>(null);
  const [myLogs, setMyLogs] = useState<WorkoutLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [trainingWorkout, setTrainingWorkout] = useState<Workout | null>(null);
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);
  const [loginName, setLoginName] = useState('');
  const [showConfig, setShowConfig] = useState(false);
  const [showExManager, setShowExManager] = useState(false);

  const sync = useCallback(async () => {
    setLoading(true);
    const [exs, users] = await Promise.all([DataService.fetchExercises(), DataService.fetchUsers()]);
    setExercises(exs);
    setAllUsers(users);
    if (currentUser) {
      const [plan, logs] = await Promise.all([DataService.fetchPlan(currentUser.id), DataService.fetchLogs(currentUser.id)]);
      setMyPlan(plan);
      setMyLogs(logs);
    }
    setLoading(false);
  }, [currentUser]);

  useEffect(() => { sync(); }, [sync]);

  const handleLogin = async () => {
    if (!loginName) return;
    setLoading(true);
    const users = await DataService.fetchUsers();
    const found = users.find(u => u.name.toLowerCase().trim() === loginName.toLowerCase().trim());
    if (found) {
      setCurrentUser(found);
      sessionStorage.setItem('kx_session', JSON.stringify(found));
    } else {
      alert("Atleta no registrado. Por favor contacta al Staff.");
    }
    setLoading(false);
  };

  const chartData = useMemo(() => {
    return myLogs.slice(0, 10).reverse().map(log => ({
      date: new Date(log.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      vol: log.exercisesData.reduce((acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + (s.weight * s.reps), 0), 0)
    }));
  }, [myLogs]);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100 font-sans selection:bg-red-600/30 overflow-x-hidden">
      {/* HEADER ELITE */}
      <header className="p-6 flex justify-between items-center bg-zinc-950/90 backdrop-blur-2xl sticky top-0 z-[100] border-b border-white/5">
        <div className="flex items-center gap-3">
          {CONFIG.logo() ? (
            <img src={CONFIG.logo()} alt="Logo" className="h-8 w-auto object-contain" />
          ) : (
            <div className="flex flex-col">
              <span className="font-display italic text-3xl uppercase text-white tracking-tighter leading-none neon-red">KINETIX</span>
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.5em] ml-1">FUNCTIONAL ZONE</span>
            </div>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setShowConfig(true)} className="text-zinc-700 hover:text-white transition-all"><Settings size={18}/></button>
          {currentUser && <button onClick={() => { setCurrentUser(null); sessionStorage.clear(); setActiveTab('home'); }} className="text-zinc-700 hover:text-red-500 transition-all"><LogOut size={18}/></button>}
        </div>
      </header>

      <main className="flex-1 p-6 pb-32 overflow-y-auto no-scrollbar">
        {!currentUser ? (
          <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-16 animate-in fade-in duration-1000">
             <div className="relative">
                <div className="absolute -inset-6 bg-red-600 rounded-full blur-3xl opacity-10 animate-pulse"></div>
                <div className="relative w-36 h-36 bg-zinc-900 rounded-[3.5rem] border border-white/5 flex items-center justify-center text-red-600 shadow-2xl">
                  <Activity size={72} className="float" />
                </div>
             </div>
             
             <div className="w-full space-y-8 px-4 text-center">
                <div className="space-y-2">
                  <h1 className="text-7xl font-display italic text-white uppercase tracking-tighter leading-none">BIENVENIDO</h1>
                  <p className="text-zinc-700 font-black uppercase text-[10px] tracking-[0.6em]">ELITE PERFORMANCE TRACKER</p>
                </div>
                <div className="space-y-4">
                  <input 
                    value={loginName} 
                    onChange={e => setLoginName(e.target.value)}
                    placeholder="INTRODUCE TU NOMBRE"
                    className="w-full bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2.5rem] text-center font-bold text-white outline-none focus:border-red-600 transition-all uppercase text-lg shadow-inner"
                  />
                  <button 
                    onClick={handleLogin}
                    className="w-full bg-red-600 py-7 rounded-[2.5rem] font-display italic text-xl uppercase text-white shadow-[0_0_40px_rgba(220,38,38,0.25)] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={24}/> : <><Play size={20}/> ACCEDER</>}
                  </button>
                </div>
             </div>

             <button 
               onClick={() => {
                 const pin = prompt("PASSWORD STAFF:");
                 if (pin === 'KINETIX2025') {
                   setCurrentUser({ ...MOCK_USER, role: 'coach', name: 'Master Coach' });
                   setActiveTab('admin');
                 } else { alert("ACCESO DENEGADO"); }
               }}
               className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.5em] hover:text-red-600 transition-colors"
             >
               MODO COACH EXCLUSIVO
             </button>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-10">
            {activeTab === 'home' && (
              <div className="space-y-10">
                <header className="flex justify-between items-end">
                   <div className="space-y-1">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em]">RESUMEN DE TEMPORADA</p>
                      <h2 className="text-6xl font-display italic text-white uppercase leading-none tracking-tighter">
                        HOLA, <span className="text-red-600">{currentUser.name.split(' ')[0]}</span>
                      </h2>
                   </div>
                </header>

                {/* GRÁFICA DE VOLUMEN */}
                <div className="bg-zinc-900/40 p-8 rounded-[3rem] border border-white/5 space-y-6 shadow-2xl relative overflow-hidden group">
                   <div className="flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-2"><Zap size={12}/> PERFORMANCE TRACKER</p>
                        <h4 className="text-2xl font-display italic text-white uppercase tracking-tighter">VOLUMEN DE CARGA</h4>
                      </div>
                      <div className="text-right">
                         <p className="text-2xl font-display italic text-white">{myLogs.length}</p>
                         <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest">SESIONES</p>
                      </div>
                   </div>
                   
                   <div className="h-40 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={chartData}>
                            <defs>
                              <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                            <XAxis dataKey="date" stroke="#3f3f46" fontSize={10} axisLine={false} tickLine={false} />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                              itemStyle={{ color: '#ef4444' }}
                            />
                            <Area type="monotone" dataKey="vol" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </div>

                {/* PLAN ACTIVO */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-4">
                     <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">PROTOCOLO VIGENTE</p>
                     <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{myPlan?.title || 'SIN ASIGNAR'}</p>
                  </div>
                  <div className="grid gap-4">
                    {myPlan?.workouts.map(w => (
                      <button 
                        key={w.id} 
                        onClick={() => setTrainingWorkout(w)}
                        className="w-full flex justify-between items-center p-8 bg-zinc-900/40 rounded-[2.5rem] border border-white/5 hover:border-red-600/30 transition-all group active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-6">
                           <div className="w-14 h-14 bg-zinc-950 rounded-2xl flex items-center justify-center font-display italic text-2xl text-zinc-800 group-hover:text-red-600 transition-colors">{w.day}</div>
                           <div className="text-left">
                              <h4 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">{w.name}</h4>
                              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{w.exercises.length} EJERCICIOS</p>
                           </div>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-2xl group-hover:bg-red-600 transition-all text-zinc-700 group-hover:text-white"><Play size={20}/></div>
                      </button>
                    ))}
                    {!myPlan && (
                      <div className="py-20 text-center border-2 border-dashed border-zinc-900 rounded-[3rem]">
                         <Activity className="mx-auto mb-4 text-zinc-800" size={48}/>
                         <p className="text-zinc-600 text-xs font-black uppercase tracking-widest">TU COACH ESTÁ PREPARANDO ALGO ÉPICO</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-10 pb-20">
                <header className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">COMMAND CENTER</p>
                    <h2 className="text-6xl font-display italic text-red-600 uppercase tracking-tighter leading-none">STAFF</h2>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowExManager(true)} className="bg-zinc-900 p-5 rounded-3xl text-zinc-400 border border-zinc-800"><Dumbbell size={24}/></button>
                    <button onClick={sync} className="bg-zinc-900 p-5 rounded-3xl text-zinc-400 border border-zinc-800"><RefreshCw size={24}/></button>
                  </div>
                </header>

                <div className="space-y-6">
                   <div className="flex justify-between items-center px-4">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">TEAM KINETIX ({allUsers.length})</p>
                      <button 
                        onClick={async () => {
                          const name = prompt("Nombre Atleta:");
                          if (name) {
                            setLoading(true);
                            await DataService.saveProfile({ id: `u-${Date.now()}`, name, email: `${name}@kx.com`, goal: Goal.PERFORMANCE, level: UserLevel.BEGINNER, role: 'client', daysPerWeek: 3, equipment: ['Full'], streak: 0, createdAt: new Date().toISOString() });
                            sync();
                          }
                        }}
                        className="bg-cyan-400/10 text-cyan-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase border border-cyan-400/20 flex items-center gap-2"
                      ><Plus size={14}/> NUEVO ATLETA</button>
                   </div>
                   
                   <div className="grid gap-4">
                      {allUsers.filter(u => u.role !== 'coach').map(u => (
                        <div key={u.id} className="bg-zinc-900/40 p-7 rounded-[3rem] border border-white/5 flex items-center justify-between group shadow-xl">
                           <div className="space-y-1">
                              <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{u.name}</h4>
                              <div className="flex gap-2">
                                <span className="text-[8px] text-zinc-600 font-black uppercase px-2 py-1 bg-zinc-950 rounded border border-white/5">{u.goal}</span>
                                <span className="text-[8px] text-zinc-600 font-black uppercase px-2 py-1 bg-zinc-950 rounded border border-white/5">{u.level}</span>
                              </div>
                           </div>
                           <div className="flex gap-3">
                              <button 
                                onClick={async () => {
                                  setLoading(true);
                                  try {
                                    const res = await generateSmartRoutine(u);
                                    setEditingPlan({ plan: { ...res, id: `p-${Date.now()}`, userId: u.id, updatedAt: new Date().toISOString() }, isNew: true });
                                  } catch (e: any) { alert(e.message); }
                                  finally { setLoading(false); }
                                }}
                                className="p-5 bg-red-600/10 text-red-600 rounded-2xl border border-red-600/20 hover:bg-red-600 hover:text-white transition-all"
                              ><Sparkles size={20}/></button>
                              <button 
                                onClick={async () => {
                                  setLoading(true);
                                  const plan = await DataService.fetchPlan(u.id);
                                  setEditingPlan({ plan: plan || { id: `p-${Date.now()}`, userId: u.id, title: 'NEW PROGRAM', workouts: [], updatedAt: new Date().toISOString() }, isNew: !plan });
                                  setLoading(false);
                                }}
                                className="p-5 bg-zinc-800 text-zinc-400 rounded-2xl hover:bg-white hover:text-black transition-all"
                              ><Edit3 size={20}/></button>
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* NAV BOTTOM BAR */}
      {currentUser && !trainingWorkout && (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/95 backdrop-blur-3xl border-t border-white/5 px-10 py-8 z-[100] flex justify-around">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={26}/>} label="BOX" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={26}/>} label="STAFF" />}
          <NavItem active={false} onClick={() => {}} icon={<History size={26}/>} label="HISTORIAL" />
        </nav>
      )}

      {/* MODALES */}
      {trainingWorkout && (
        <TrainingSession 
          workout={trainingWorkout} 
          exercises={exercises} 
          userId={currentUser?.id || ''}
          onClose={(didComplete, finalLog) => {
            if (didComplete && finalLog) {
              DataService.saveLog(finalLog);
              sync();
            }
            setTrainingWorkout(null);
          }} 
        />
      )}
      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} />}
      {showExManager && <ExerciseManager exercises={exercises} onSave={async (ex) => { await DataService.saveExercise(ex); sync(); }} onClose={() => setShowExManager(false)} />}
      {editingPlan && <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={async (p: Plan) => { await DataService.savePlan(p); sync(); setEditingPlan(null); }} onCancel={() => setEditingPlan(null)} loading={loading} />}
    </div>
  );
}

// --- COMPONENTES ATÓMICOS ---

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-4 rounded-3xl transition-all ${active ? 'bg-red-600/10 scale-110 shadow-[0_0_20px_rgba(220,38,38,0.15)] border border-red-600/20' : ''}`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-[0.5em] ${active ? 'opacity-100' : 'opacity-20'}`}>{label}</span>
  </button>
));

const TrainingSession = memo(({ workout, exercises, userId, onClose }: any) => {
  const [currentLogs, setCurrentLogs] = useState<any>(
    workout.exercises.map(ex => ({
      exerciseId: ex.exerciseId,
      sets: Array.from({ length: ex.targetSets }).map(() => ({ weight: 0, reps: 0, done: false }))
    }))
  );

  const updateSet = (exIdx: number, setIdx: number, field: string, value: any) => {
    const newLogs = [...currentLogs];
    newLogs[exIdx].sets[setIdx][field] = value;
    setCurrentLogs(newLogs);
  };

  const toggleDone = (exIdx: number, setIdx: number) => {
    const newLogs = [...currentLogs];
    newLogs[exIdx].sets[setIdx].done = !newLogs[exIdx].sets[setIdx].done;
    setCurrentLogs(newLogs);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#050507] flex flex-col animate-in slide-in-from-bottom duration-500 overflow-y-auto pb-40 no-scrollbar">
       <header className="p-8 flex justify-between items-center sticky top-0 bg-[#050507]/98 backdrop-blur-3xl z-10 border-b border-zinc-900 shadow-2xl">
          <div className="flex flex-col">
             <span className="text-[9px] font-black text-red-600 uppercase tracking-[0.4em] mb-1 animate-pulse">RECORDING LIVE</span>
             <h3 className="text-3xl font-display italic text-white uppercase tracking-tighter leading-none">{workout.name}</h3>
          </div>
          <button onClick={() => onClose(false)} className="bg-zinc-900 p-5 rounded-full text-zinc-500 hover:text-white"><X size={28}/></button>
       </header>

       <div className="p-6 space-y-12">
          {workout.exercises.map((ex: WorkoutExercise, exIdx: number) => {
            const exerciseData = exercises.find((e:any) => e.id === ex.exerciseId);
            return (
              <div key={exIdx} className="space-y-8 animate-in slide-in-from-left duration-500" style={{ animationDelay: `${exIdx * 100}ms` }}>
                <div className="flex justify-between items-start border-l-4 border-red-600 pl-6">
                   <div className="space-y-1">
                      <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{exerciseData?.name || ex.name}</h4>
                      <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">{ex.targetSets} SETS × {ex.targetReps} REPS</p>
                   </div>
                   {ex.coachCue && <div className="text-[9px] italic text-cyan-400 bg-cyan-400/5 px-3 py-1 rounded border border-cyan-400/20 uppercase font-black">"{ex.coachCue}"</div>}
                </div>

                <div className="grid gap-4">
                   {currentLogs[exIdx].sets.map((set: any, setIdx: number) => (
                     <div key={setIdx} className={`p-6 rounded-[2rem] border transition-all flex items-center justify-between gap-6 ${set.done ? 'bg-zinc-900/20 border-green-500/30' : 'bg-zinc-900/40 border-white/5'}`}>
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-display italic text-2xl transition-all ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-600'}`}>{setIdx + 1}</div>
                        
                        <div className="flex-1 flex gap-4">
                           <div className="flex-1 space-y-2">
                              <p className="text-[8px] text-zinc-700 font-black uppercase text-center tracking-widest">KG</p>
                              <input 
                                type="number" 
                                placeholder="0" 
                                value={set.weight || ''}
                                onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center font-bold text-white outline-none focus:border-red-600 transition-all text-xl" 
                              />
                           </div>
                           <div className="flex-1 space-y-2">
                              <p className="text-[8px] text-zinc-700 font-black uppercase text-center tracking-widest">REPS</p>
                              <input 
                                type="number" 
                                placeholder={ex.targetReps} 
                                value={set.reps || ''}
                                onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center font-bold text-white outline-none focus:border-red-600 transition-all text-xl" 
                              />
                           </div>
                        </div>

                        <button 
                          onClick={() => toggleDone(exIdx, setIdx)}
                          className={`p-6 rounded-2xl shadow-2xl transition-all ${set.done ? 'bg-green-600 text-white rotate-[360deg]' : 'bg-zinc-950 text-zinc-800'}`}
                        >
                           <Check size={24}/>
                        </button>
                     </div>
                   ))}
                </div>
              </div>
            );
          })}
          
          <button 
            onClick={() => {
              const log: WorkoutLog = { id: `log-${Date.now()}`, userId, workoutId: workout.id, date: new Date().toISOString(), exercisesData: currentLogs };
              onClose(true, log);
              alert("¡TRABAJO TERMINADO! Datos analizados.");
            }}
            className="w-full py-12 bg-red-600 rounded-[3rem] font-display italic text-3xl uppercase text-white shadow-[0_0_60px_rgba(220,38,38,0.3)] mt-12 active:scale-95 transition-all mb-10"
          >
            GUARDAR SESIÓN
          </button>
       </div>
    </div>
  );
});

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel, loading }: any) => {
  const [local, setLocal] = useState<Plan>(() => JSON.parse(JSON.stringify(plan)));
  const [picker, setPicker] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 bg-[#050507] z-[250] p-8 flex flex-col animate-in slide-in-from-right duration-500 overflow-y-auto no-scrollbar pb-48">
       <header className="flex justify-between items-center mb-12 sticky top-0 bg-[#050507]/98 backdrop-blur-3xl py-6 z-10 border-b border-white/5">
          <button onClick={onCancel} className="bg-zinc-900 p-5 rounded-full text-zinc-500"><ChevronLeft size={28}/></button>
          <div className="flex flex-col items-center">
             <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.4em] mb-1">PROTOCOLO</p>
             <input value={local.title} onChange={(e) => setLocal({...local, title: e.target.value})} className="bg-transparent text-3xl font-display italic text-white text-center outline-none uppercase tracking-tighter" />
          </div>
          <button onClick={() => onSave(local)} disabled={loading} className="bg-red-600 p-5 rounded-full text-white shadow-2xl shadow-red-600/30">
            {loading ? <RefreshCw className="animate-spin" size={28}/> : <Save size={28}/>}
          </button>
       </header>

       <div className="space-y-12">
          {local.workouts.map((w, wIdx) => (
             <div key={wIdx} className="bg-zinc-900/30 p-10 rounded-[4rem] border border-white/5 space-y-10 shadow-2xl">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-600 font-display italic text-3xl border border-red-600/20">{wIdx + 1}</div>
                  <input value={w.name} onChange={(e) => { const nw = [...local.workouts]; nw[wIdx].name = e.target.value; setLocal({...local, workouts: nw}); }} className="bg-transparent border-b border-zinc-800 p-2 text-3xl font-display italic text-white outline-none w-full uppercase tracking-tighter" />
                  <button onClick={() => { const nw = [...local.workouts]; nw.splice(wIdx, 1); setLocal({...local, workouts: nw}); }} className="text-zinc-800 hover:text-red-500 transition-all"><Trash2 size={24}/></button>
                </div>

                <div className="space-y-6">
                   {w.exercises.map((ex, exIdx) => (
                     <div key={exIdx} className="p-8 bg-zinc-950/80 rounded-[3rem] border border-white/5 space-y-8 group shadow-xl">
                        <div className="flex justify-between items-start">
                           <span className="text-xs font-black uppercase text-red-600 tracking-[0.2em]">{allExercises.find((e:any) => e.id === ex.exerciseId)?.name || ex.name}</span>
                           <button onClick={() => { const nw = [...local.workouts]; nw[wIdx].exercises.splice(exIdx, 1); setLocal({...local, workouts: nw}); }} className="bg-zinc-900 p-3 rounded-2xl text-zinc-700 hover:text-red-500 transition-all"><X size={16}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2">
                              <label className="text-[8px] font-black text-zinc-800 uppercase text-center w-full block">SETS</label>
                              <input value={ex.targetSets} type="number" onChange={(e) => {
                                const nw = [...local.workouts];
                                nw[wIdx].exercises[exIdx].targetSets = parseInt(e.target.value) || 0;
                                setLocal({...local, workouts: nw});
                              }} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold text-center outline-none focus:border-red-600 text-xl" />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[8px] font-black text-zinc-800 uppercase text-center w-full block">REPS</label>
                              <input value={ex.targetReps} onChange={(e) => {
                                const nw = [...local.workouts];
                                nw[wIdx].exercises[exIdx].targetReps = e.target.value;
                                setLocal({...local, workouts: nw});
                              }} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold text-center outline-none focus:border-red-600 text-xl" />
                           </div>
                        </div>
                        <input value={ex.coachCue || ''} onChange={(e) => {
                          const nw = [...local.workouts];
                          nw[wIdx].exercises[exIdx].coachCue = e.target.value;
                          setLocal({...local, workouts: nw});
                        }} placeholder="CUE TÉCNICO" className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white text-[10px] italic outline-none focus:border-cyan-400/50 transition-all tracking-widest" />
                     </div>
                   ))}
                   <button onClick={() => setPicker(wIdx)} className="w-full py-10 border-2 border-dashed border-zinc-800 rounded-[3rem] text-xs font-black text-zinc-700 uppercase tracking-[0.4em] hover:border-red-600/40 hover:text-red-600 transition-all">+ AÑADIR EJERCICIO</button>
                </div>
             </div>
          ))}
          <button onClick={() => setLocal({...local, workouts: [...local.workouts, { id: `w-${Date.now()}`, name: `DÍA ${local.workouts.length+1}`, day: local.workouts.length+1, exercises: [] }]})} className="w-full py-12 border-2 border-dashed border-zinc-800 rounded-[3rem] text-xs font-black text-zinc-800 uppercase flex items-center justify-center gap-4 hover:bg-zinc-900/40 transition-all"><Plus size={32}/> NUEVA SESIÓN SEMANAL</button>
       </div>

       {picker !== null && (
         <div className="fixed inset-0 z-[400] bg-black/99 backdrop-blur-3xl p-8 flex flex-col animate-in slide-in-from-bottom duration-300">
            <header className="flex justify-between items-center mb-12">
              <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter">BIBLIOTECA</h3>
              <button onClick={() => setPicker(null)} className="bg-zinc-900 p-5 rounded-full text-white"><X size={28}/></button>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-16">
              {allExercises.map((ex: any) => (
                <div key={ex.id} onClick={() => {
                   const nw = [...local.workouts];
                   nw[picker].exercises.push({ exerciseId: ex.id, name: ex.name, targetSets: 4, targetReps: "12", coachCue: "" });
                   setLocal({...local, workouts: nw});
                   setPicker(null);
                }} className="p-8 bg-zinc-900/50 border border-white/5 rounded-[3rem] flex justify-between items-center group shadow-xl">
                  <div className="space-y-1">
                    <p className="font-black text-white uppercase italic text-2xl tracking-tighter group-hover:text-red-600 transition-colors">{ex.name}</p>
                    <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{ex.muscleGroup}</p>
                  </div>
                  <div className="bg-zinc-950 p-5 rounded-2xl text-red-600"><Plus size={24} /></div>
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
});

const ExerciseManager = memo(({ exercises, onSave, onClose }: any) => {
  const [newEx, setNewEx] = useState<Exercise>({ id: `e-${Date.now()}`, name: '', muscleGroup: '', videoUrl: '', technique: '', commonErrors: [] });

  return (
    <div className="fixed inset-0 z-[250] bg-black/99 backdrop-blur-3xl p-8 flex flex-col animate-in slide-in-from-right duration-500 overflow-y-auto no-scrollbar">
       <header className="flex justify-between items-center mb-12 shrink-0">
          <div className="space-y-1">
             <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em]">KINETIX LIBRARY</p>
             <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">BIBLIOTECA</h3>
          </div>
          <button onClick={onClose} className="bg-zinc-900 p-5 rounded-full text-white"><X size={28}/></button>
       </header>

       <div className="space-y-12 pb-24">
          <div className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl">
             <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">AÑADIR NUEVO RECURSO</p>
             <div className="space-y-5">
                <input value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} placeholder="NOMBRE" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[2rem] text-xs text-white outline-none focus:border-red-600 uppercase font-black tracking-widest" />
                <input value={newEx.muscleGroup} onChange={e => setNewEx({...newEx, muscleGroup: e.target.value})} placeholder="GRUPO MUSCULAR" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[2rem] text-xs text-white outline-none focus:border-red-600 uppercase font-black tracking-widest" />
                <input value={newEx.videoUrl} onChange={e => setNewEx({...newEx, videoUrl: e.target.value})} placeholder="URL TÉCNICA" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[2rem] text-xs text-white outline-none focus:border-red-600 font-mono" />
                <button 
                  onClick={() => { if(newEx.name) { onSave(newEx); setNewEx({ id: `e-${Date.now()}`, name: '', muscleGroup: '', videoUrl: '', technique: '', commonErrors: [] }); } }}
                  className="w-full bg-white text-black py-7 rounded-[2rem] font-display italic uppercase text-lg shadow-xl active:scale-95 transition-all"
                >GUARDAR EN REPOSITORIO</button>
             </div>
          </div>

          <div className="grid gap-4">
             {exercises.map((ex: any) => (
               <div key={ex.id} className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem] flex justify-between items-center group shadow-lg">
                  <div>
                    <p className="text-2xl font-black text-white italic uppercase tracking-tighter group-hover:text-red-600 transition-colors">{ex.name}</p>
                    <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">{ex.muscleGroup}</p>
                  </div>
                  <button className="bg-zinc-800 p-4 rounded-2xl text-zinc-700 hover:text-red-600 transition-all"><Trash2 size={20}/></button>
               </div>
             ))}
          </div>
       </div>
    </div>
  );
});

const ConfigModal = memo(({ onClose }: any) => (
  <div className="fixed inset-0 z-[300] bg-black/99 backdrop-blur-3xl p-8 flex flex-col animate-in fade-in duration-500">
    <header className="flex justify-between items-center mb-12">
      <div className="space-y-1">
        <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em]">SISTEMA</p>
        <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">CONFIG</h3>
      </div>
      <button onClick={onClose} className="bg-zinc-900 p-5 rounded-full text-white"><X size={28}/></button>
    </header>
    <div className="space-y-8">
      <div className="p-8 bg-zinc-900/40 rounded-[3rem] border border-white/5 space-y-6 shadow-2xl">
        <SetupInput label="SUPABASE URL" id="SUPABASE_URL" />
        <SetupInput label="SUPABASE KEY" id="SUPABASE_ANON_KEY" />
        <SetupInput label="LOGO URL (GITHUB)" id="LOGO" isLogo />
      </div>
      <div className="p-4 bg-red-600/10 border border-red-600/20 rounded-2xl flex items-center gap-4">
         <ShieldAlert size={24} className="text-red-600 shrink-0"/>
         <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">LLAVE IA GESTIONADA POR VERCEL (env.API_KEY)</p>
      </div>
      <button onClick={() => window.location.reload()} className="w-full bg-red-600 py-8 rounded-[2.5rem] font-display italic text-2xl uppercase text-white shadow-2xl active:scale-95 transition-all">APLICAR Y REINICIAR</button>
    </div>
  </div>
));

const SetupInput = memo(({ label, id, isLogo }: any) => (
  <div className="space-y-2">
    <label className="text-[9px] font-black text-zinc-700 uppercase ml-4 tracking-[0.2em]">{label}</label>
    <input 
      onChange={(e) => isLogo ? CONFIG.set('LOGO', e.target.value) : CONFIG.set(id, e.target.value)}
      defaultValue={isLogo ? CONFIG.get('LOGO') : CONFIG.get(id)}
      className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-2xl text-[10px] text-white outline-none focus:border-red-600 font-mono transition-all shadow-inner"
    />
  </div>
));
