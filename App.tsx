
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  MessageSquare, Database, Settings, Image as ImageIcon, Cpu, Dumbbell, 
  History, Trophy, Target, ChevronRight, Clock, Weight, LineChart, BarChart3,
  TrendingUp, Check, ShieldAlert, Zap, Bell, Search
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { createClient } from '@supabase/supabase-js';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, WorkoutLog, SetLog } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './geminiService';

// --- NÚCLEO DE CONFIGURACIÓN ---
const CONFIG = {
  get: (key: string) => (process.env as any)[key] || localStorage.getItem(`KX_V4_${key}`) || '',
  set: (key: string, val: string) => localStorage.setItem(`KX_V4_${key}`, val),
  isCloud: () => !!((process.env as any)['SUPABASE_URL'] || localStorage.getItem('KX_V4_SUPABASE_URL')),
  logo: () => localStorage.getItem('KX_V4_LOGO') || ''
};

const supabase = CONFIG.isCloud() ? createClient(CONFIG.get('SUPABASE_URL'), CONFIG.get('SUPABASE_ANON_KEY')) : null;

// --- SERVICIO DE DATOS HÍBRIDO ---
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
  async deleteExercise(id: string) {
    const current = await this.fetchExercises();
    localStorage.setItem('KX_EXERCISES', JSON.stringify(current.filter(e => e.id !== id)));
    if (supabase) await supabase.from('exercises').delete().eq('id', id);
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
  async deleteProfile(id: string) {
    const current = await this.fetchUsers();
    localStorage.setItem('KX_USERS', JSON.stringify(current.filter(u => u.id !== id)));
    if (supabase) await supabase.from('profiles').delete().eq('id', id);
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
    const s = sessionStorage.getItem('kx_v4_session');
    return s ? JSON.parse(s) : null;
  });
  const [activeTab, setActiveTab] = useState(() => currentUser?.role === 'coach' ? 'admin' : 'home');
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
    const exs = await DataService.fetchExercises();
    setExercises(exs);
    const users = await DataService.fetchUsers();
    setAllUsers(users);
    if (currentUser && currentUser.role !== 'coach') {
      const plan = await DataService.fetchPlan(currentUser.id);
      setMyPlan(plan);
      const logs = await DataService.fetchLogs(currentUser.id);
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
      sessionStorage.setItem('kx_v4_session', JSON.stringify(found));
      setActiveTab('home');
    } else { alert("Nombre no encontrado. Contacta a tu Coach."); }
    setLoading(false);
  };

  const handleCoachAccess = () => {
    const pin = prompt("CÓDIGO DE ACCESO STAFF:");
    if (pin === 'KINETIX2025') {
      const coach: User = { ...MOCK_USER, role: 'coach', name: 'MASTER COACH', id: 'coach-1' };
      setCurrentUser(coach);
      sessionStorage.setItem('kx_v4_session', JSON.stringify(coach));
      setActiveTab('admin');
    } else if (pin !== null) {
      alert("PIN INCORRECTO. ACCESO DENEGADO.");
    }
  };

  const chartData = useMemo(() => {
    if (myLogs.length === 0) return [];
    return myLogs.slice(0, 10).reverse().map(log => ({
      date: new Date(log.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      vol: log.exercisesData.reduce((acc, ex) => acc + ex.sets.reduce((sAcc, s) => sAcc + (s.weight * s.reps), 0), 0)
    }));
  }, [myLogs]);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100 font-sans selection:bg-red-600/30 overflow-x-hidden">
      {/* HEADER DINÁMICO */}
      <header className="p-6 flex justify-between items-center bg-zinc-950/90 backdrop-blur-3xl sticky top-0 z-[100] border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-3">
          {CONFIG.logo() ? (
            <img src={CONFIG.logo()} alt="Logo" className="h-10 w-auto object-contain hover:scale-105 transition-transform" />
          ) : (
            <div className="flex flex-col">
              <span className="font-display italic text-3xl uppercase text-white tracking-tighter leading-none neon-red">KINETIX</span>
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-[0.5em] ml-1">FUNCTIONAL ZONE</span>
            </div>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={() => setShowConfig(true)} className="text-zinc-700 hover:text-white transition-all"><Settings size={20}/></button>
          {currentUser && (
            <button onClick={() => { setCurrentUser(null); sessionStorage.clear(); setActiveTab('home'); }} className="bg-zinc-900/50 p-3 rounded-2xl text-zinc-500 hover:text-red-500 transition-all border border-white/5"><LogOut size={20}/></button>
          )}
        </div>
      </header>

      <main className="flex-1 p-6 pb-32">
        {!currentUser ? (
          <div className="min-h-[75vh] flex flex-col items-center justify-center space-y-16 animate-in fade-in duration-1000">
             <div className="relative group">
                <div className="absolute -inset-8 bg-red-600 rounded-full blur-[60px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <div className="relative w-40 h-40 bg-zinc-900 rounded-[3.5rem] border border-white/10 flex items-center justify-center text-red-600 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                  <Activity size={80} className="float" />
                </div>
             </div>
             
             <div className="w-full space-y-10 px-4 text-center">
                <div className="space-y-2">
                  <h1 className="text-7xl font-display italic text-white uppercase tracking-tighter leading-none">ELITE</h1>
                  <p className="text-zinc-700 font-black uppercase text-[10px] tracking-[0.6em] ml-2">SISTEMA DE ENTRENAMIENTO</p>
                </div>
                <div className="space-y-4">
                  <input 
                    value={loginName} 
                    onChange={e => setLoginName(e.target.value)}
                    placeholder="IDENTIFÍCATE"
                    className="w-full bg-zinc-900/50 border border-zinc-800 p-7 rounded-[2.5rem] text-center font-bold text-white outline-none focus:border-red-600 transition-all uppercase text-xl placeholder:text-zinc-800"
                  />
                  <button 
                    onClick={handleLogin}
                    className="w-full bg-red-600 py-8 rounded-[2.5rem] font-display italic text-2xl uppercase text-white shadow-[0_20px_40px_rgba(220,38,38,0.2)] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={28}/> : <><Play size={24}/> INICIAR BOX</>}
                  </button>
                </div>
             </div>

             <button 
               onClick={handleCoachAccess}
               className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.5em] hover:text-red-600 transition-colors border-b border-transparent hover:border-red-600/30 pb-2"
             >
               PANEL DE COACH EXCLUSIVO
             </button>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-8 duration-700 space-y-10">
            {activeTab === 'home' && (
              <div className="space-y-10">
                <header>
                   <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em] mb-1">PROTOCOLO ACTIVO</p>
                   <h2 className="text-6xl font-display italic text-white uppercase leading-none tracking-tighter">
                     HOLA, <span className="text-red-600">{currentUser.name.split(' ')[0]}</span>
                   </h2>
                </header>

                {/* GRÁFICA DE ANALÍTICA */}
                <div className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden group">
                   <div className="flex justify-between items-center relative z-10">
                      <div className="space-y-1">
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-2"><Zap size={14}/> VOLUMEN SEMANAL</p>
                        <h4 className="text-2xl font-display italic text-white uppercase tracking-tighter">PERFORMANCE LOG</h4>
                      </div>
                      <div className="bg-zinc-950/80 p-4 rounded-3xl border border-white/5 text-right min-w-[100px]">
                         <p className="text-3xl font-display italic text-white">{myLogs.length}</p>
                         <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest leading-none">SESIONES</p>
                      </div>
                   </div>
                   
                   <div className="h-44 w-full relative z-10">
                      {chartData.length > 0 ? (
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
                                cursor={{ stroke: '#ef4444', strokeWidth: 1 }}
                                contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '16px', fontSize: '12px' }}
                                itemStyle={{ color: '#ef4444' }}
                              />
                              <Area type="monotone" dataKey="vol" stroke="#ef4444" strokeWidth={4} fillOpacity={1} fill="url(#colorVol)" />
                           </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[2.5rem] gap-3">
                           <LineChart size={32} className="text-zinc-800"/>
                           <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest text-center px-10">SIN DATOS SUFICIENTES PARA ANALÍTICA</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* LISTA DE ENTRENAMIENTOS */}
                <div className="space-y-6">
                  <div className="flex justify-between items-center px-4">
                     <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">SESIONES DE ESTA SEMANA</p>
                     <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{myPlan?.title || 'ESPERANDO PLAN'}</p>
                  </div>
                  <div className="grid gap-4">
                    {myPlan?.workouts.map(w => (
                      <button 
                        key={w.id} 
                        onClick={() => setTrainingWorkout(w)}
                        className="w-full flex justify-between items-center p-8 bg-zinc-900/40 rounded-[3rem] border border-white/5 hover:border-red-600/30 transition-all group active:scale-[0.98] shadow-lg"
                      >
                        <div className="flex items-center gap-6">
                           <div className="w-16 h-16 bg-zinc-950 rounded-[1.5rem] flex items-center justify-center font-display italic text-3xl text-zinc-800 group-hover:text-red-600 transition-colors shadow-inner border border-white/5">{w.day}</div>
                           <div className="text-left">
                              <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none mb-1 group-hover:translate-x-1 transition-transform">{w.name}</h4>
                              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">{w.exercises.length} BLOQUES TÉCNICOS</p>
                           </div>
                        </div>
                        <div className="bg-zinc-950 p-5 rounded-2xl group-hover:bg-red-600 transition-all text-zinc-800 group-hover:text-white shadow-xl"><Play size={24}/></div>
                      </button>
                    ))}
                    {!myPlan && (
                      <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3.5rem] space-y-4">
                         <Activity className="mx-auto text-zinc-800 animate-pulse" size={64}/>
                         <div className="space-y-1">
                           <p className="text-zinc-600 text-xs font-black uppercase tracking-widest">PLANIFICACIÓN EN CURSO</p>
                           <p className="text-zinc-800 text-[9px] font-bold uppercase tracking-[0.3em]">TU COACH ESTÁ ANALIZANDO TUS ÚLTIMOS LOGS</p>
                         </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-12 pb-24">
                <header className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">STAFF COMMAND</p>
                    <h2 className="text-7xl font-display italic text-red-600 uppercase tracking-tighter leading-none">BOX</h2>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => setShowExManager(true)} className="bg-zinc-900 p-6 rounded-[2rem] text-zinc-400 border border-zinc-800 hover:text-white hover:border-white/20 transition-all shadow-xl"><Dumbbell size={28}/></button>
                    <button onClick={sync} className="bg-zinc-900 p-6 rounded-[2rem] text-zinc-400 border border-zinc-800 hover:text-cyan-400 hover:border-cyan-400/20 transition-all shadow-xl"><RefreshCw size={28}/></button>
                  </div>
                </header>

                <div className="space-y-8">
                   <div className="flex justify-between items-center px-4">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2"><Users size={12}/> GESTIÓN DE ATLETAS ({allUsers.length - 1})</p>
                      <button 
                        onClick={async () => {
                          const name = prompt("Nombre completo del Atleta:");
                          if (name) {
                            setLoading(true);
                            await DataService.saveProfile({ id: `u-${Date.now()}`, name, email: `${name.replace(' ', '').toLowerCase()}@kinetix.com`, goal: Goal.PERFORMANCE, level: UserLevel.BEGINNER, role: 'client', daysPerWeek: 3, equipment: ['Full Box'], streak: 0, createdAt: new Date().toISOString() });
                            sync();
                          }
                        }}
                        className="bg-red-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-red-600/20 active:scale-95 transition-all flex items-center gap-2"
                      ><Plus size={16}/> REGISTRAR ATLETA</button>
                   </div>
                   
                   <div className="grid gap-4">
                      {allUsers.filter(u => u.role !== 'coach').map(u => (
                        <div key={u.id} className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all shadow-xl relative overflow-hidden">
                           <div className="space-y-2 relative z-10">
                              <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{u.name}</h4>
                              <div className="flex gap-3">
                                <span className="text-[9px] text-zinc-700 font-black uppercase px-3 py-1 bg-zinc-950 rounded-xl border border-white/5">{u.goal}</span>
                                <span className="text-[9px] text-zinc-700 font-black uppercase px-3 py-1 bg-zinc-950 rounded-xl border border-white/5">{u.level}</span>
                              </div>
                           </div>
                           <div className="flex gap-4 relative z-10">
                              <button 
                                onClick={async () => {
                                  setLoading(true);
                                  try {
                                    const res = await generateSmartRoutine(u);
                                    setEditingPlan({ plan: { ...res, id: `p-${Date.now()}`, userId: u.id, updatedAt: new Date().toISOString() }, isNew: true });
                                  } catch (e: any) { alert(e.message); }
                                  finally { setLoading(false); }
                                }}
                                className="p-5 bg-red-600/10 text-red-600 rounded-[1.5rem] border border-red-600/20 hover:bg-red-600 hover:text-white transition-all shadow-xl"
                                title="Generar con IA"
                              ><Sparkles size={24}/></button>
                              <button 
                                onClick={async () => {
                                  setLoading(true);
                                  const plan = await DataService.fetchPlan(u.id);
                                  setEditingPlan({ 
                                    plan: plan ? JSON.parse(JSON.stringify(plan)) : { id: `p-${Date.now()}`, userId: u.id, title: 'PROGRAMA ELITE', workouts: [], updatedAt: new Date().toISOString(), coachNotes: '' }, 
                                    isNew: !plan 
                                  });
                                  setLoading(false);
                                }}
                                className="p-5 bg-zinc-800 text-zinc-500 rounded-[1.5rem] hover:bg-white hover:text-black transition-all shadow-xl"
                                title="Editar Manualmente"
                              ><Edit3 size={24}/></button>
                              <button 
                                onClick={async () => {
                                  if(confirm(`¿ELIMINAR A ${u.name}? No se podrán recuperar los logs.`)) {
                                    await DataService.deleteProfile(u.id);
                                    sync();
                                  }
                                }}
                                className="p-5 text-zinc-800 hover:text-red-600 transition-colors"
                              ><Trash2 size={24}/></button>
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

      {/* NAV ELITE */}
      {currentUser && !trainingWorkout && (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/98 backdrop-blur-3xl border-t border-white/5 px-10 py-8 z-[100] flex justify-around shadow-[0_-20px_50px_rgba(0,0,0,0.8)]">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={28}/>} label="DASHBOARD" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={28}/>} label="STAFF" />}
          <NavItem active={activeTab === 'logs'} onClick={() => {}} icon={<History size={28}/>} label="HISTORY" />
        </nav>
      )}

      {/* COMPONENTES MODALES (SIN PÉRDIDAS) */}
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
      {showExManager && <ExerciseManager exercises={exercises} onSave={async (ex) => { await DataService.saveExercise(ex); sync(); }} onDelete={async (id) => { await DataService.deleteExercise(id); sync(); }} onClose={() => setShowExManager(false)} />}
      {editingPlan && <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={async (p: Plan) => { await DataService.savePlan(p); sync(); setEditingPlan(null); }} onCancel={() => setEditingPlan(null)} loading={loading} />}
    </div>
  );
}

// --- SUBCOMPONENTES ---

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-4 rounded-[1.8rem] transition-all ${active ? 'bg-red-600/10 scale-110 shadow-[0_0_30px_rgba(220,38,38,0.2)] border border-red-600/20' : 'hover:bg-zinc-900'}`}>{icon}</div>
    <span className={`text-[9px] font-black uppercase tracking-[0.5em] ${active ? 'opacity-100' : 'opacity-20'}`}>{label}</span>
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
             <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.5em] mb-1 animate-pulse flex items-center gap-2"><Zap size={12}/> LIVE SESSION</span>
             <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">{workout.name}</h3>
          </div>
          <button onClick={() => onClose(false)} className="bg-zinc-900 p-6 rounded-full text-zinc-500 hover:text-white shadow-xl"><X size={32}/></button>
       </header>

       <div className="p-6 space-y-16">
          {workout.exercises.map((ex: WorkoutExercise, exIdx: number) => {
            const exerciseData = exercises.find((e:any) => e.id === ex.exerciseId);
            return (
              <div key={exIdx} className="space-y-8 animate-in slide-in-from-left duration-500" style={{ animationDelay: `${exIdx * 100}ms` }}>
                <div className="flex justify-between items-start border-l-4 border-red-600 pl-8">
                   <div className="space-y-2">
                      <h4 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">{exerciseData?.name || ex.name}</h4>
                      <div className="flex gap-4">
                        <p className="text-[11px] text-zinc-600 font-black uppercase tracking-widest">{ex.targetSets} SERIES × {ex.targetReps} REPS</p>
                        {exerciseData?.muscleGroup && <span className="text-[9px] text-red-600/50 font-black uppercase tracking-widest bg-red-600/5 px-2 rounded">{exerciseData.muscleGroup}</span>}
                      </div>
                   </div>
                   {ex.coachCue && <div className="text-[10px] italic text-cyan-400 bg-cyan-400/5 px-4 py-2 rounded-2xl border border-cyan-400/20 uppercase font-black tracking-widest max-w-[150px] text-right">"{ex.coachCue}"</div>}
                </div>

                <div className="grid gap-5">
                   {currentLogs[exIdx].sets.map((set: any, setIdx: number) => (
                     <div key={setIdx} className={`p-7 rounded-[2.5rem] border transition-all flex items-center justify-between gap-8 ${set.done ? 'bg-green-600/5 border-green-500/30' : 'bg-zinc-900/40 border-white/5 shadow-inner'}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-display italic text-3xl transition-all ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-700'}`}>{setIdx + 1}</div>
                        
                        <div className="flex-1 flex gap-5">
                           <div className="flex-1 space-y-2">
                              <p className="text-[9px] text-zinc-700 font-black uppercase text-center tracking-widest">KG</p>
                              <input 
                                type="number" 
                                placeholder="0" 
                                value={set.weight || ''}
                                onChange={(e) => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] text-center font-bold text-white outline-none focus:border-red-600 transition-all text-2xl shadow-inner" 
                              />
                           </div>
                           <div className="flex-1 space-y-2">
                              <p className="text-[9px] text-zinc-700 font-black uppercase text-center tracking-widest">REPS</p>
                              <input 
                                type="number" 
                                placeholder={ex.targetReps} 
                                value={set.reps || ''}
                                onChange={(e) => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value))}
                                className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[1.5rem] text-center font-bold text-white outline-none focus:border-red-600 transition-all text-2xl shadow-inner" 
                              />
                           </div>
                        </div>

                        <button 
                          onClick={() => toggleDone(exIdx, setIdx)}
                          className={`p-7 rounded-2xl shadow-2xl transition-all ${set.done ? 'bg-green-600 text-white rotate-[360deg]' : 'bg-zinc-950 text-zinc-800 hover:text-white'}`}
                        >
                           <Check size={28}/>
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
            }}
            className="w-full py-12 bg-red-600 rounded-[3.5rem] font-display italic text-4xl uppercase text-white shadow-[0_20px_60px_rgba(220,38,38,0.4)] mt-12 active:scale-95 transition-all mb-20"
          >
            TERMINAR SESIÓN
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
          <button onClick={onCancel} className="bg-zinc-900 p-6 rounded-full text-zinc-500"><ChevronLeft size={32}/></button>
          <div className="flex flex-col items-center">
             <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.5em] mb-1">PROTOCOLO</p>
             <input value={local.title} onChange={(e) => setLocal({...local, title: e.target.value})} className="bg-transparent text-3xl font-display italic text-white text-center outline-none uppercase tracking-tighter w-full max-w-[200px]" />
          </div>
          <button onClick={() => onSave(local)} disabled={loading} className="bg-red-600 p-6 rounded-full text-white shadow-2xl shadow-red-600/30">
            {loading ? <RefreshCw className="animate-spin" size={32}/> : <Save size={32}/>}
          </button>
       </header>

       <div className="space-y-12">
          {local.workouts.map((w, wIdx) => (
             <div key={wIdx} className="bg-zinc-900/30 p-10 rounded-[4rem] border border-white/5 space-y-10 shadow-2xl animate-in zoom-in duration-300">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-red-600/10 rounded-[1.5rem] flex items-center justify-center text-red-600 font-display italic text-4xl border border-red-600/20">{wIdx + 1}</div>
                  <input value={w.name} onChange={(e) => { const nw = [...local.workouts]; nw[wIdx].name = e.target.value; setLocal({...local, workouts: nw}); }} className="bg-transparent border-b border-zinc-800 p-2 text-3xl font-display italic text-white outline-none w-full uppercase tracking-tighter" />
                  <button onClick={() => { const nw = [...local.workouts]; nw.splice(wIdx, 1); setLocal({...local, workouts: nw}); }} className="text-zinc-800 hover:text-red-500 transition-all"><Trash2 size={24}/></button>
                </div>

                <div className="space-y-6">
                   {w.exercises.map((ex, exIdx) => (
                     <div key={exIdx} className="p-8 bg-zinc-950/80 rounded-[3rem] border border-white/5 space-y-8 group shadow-xl">
                        <div className="flex justify-between items-start">
                           <div className="space-y-1">
                             <span className="text-xs font-black uppercase text-red-600 tracking-[0.2em]">{allExercises.find((e:any) => e.id === ex.exerciseId)?.name || ex.name}</span>
                             <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">CONFIGURACIÓN DE CARGA</p>
                           </div>
                           <button onClick={() => { const nw = [...local.workouts]; nw[wIdx].exercises.splice(exIdx, 1); setLocal({...local, workouts: nw}); }} className="bg-zinc-900 p-3 rounded-2xl text-zinc-700 hover:text-red-500 transition-all"><X size={18}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="space-y-2 text-center">
                              <label className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">SETS</label>
                              <input value={ex.targetSets} type="number" onChange={(e) => {
                                const nw = [...local.workouts];
                                nw[wIdx].exercises[exIdx].targetSets = parseInt(e.target.value) || 0;
                                setLocal({...local, workouts: nw});
                              }} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold text-center outline-none focus:border-red-600 text-2xl" />
                           </div>
                           <div className="space-y-2 text-center">
                              <label className="text-[9px] font-black text-zinc-800 uppercase tracking-widest">REPS</label>
                              <input value={ex.targetReps} onChange={(e) => {
                                const nw = [...local.workouts];
                                nw[wIdx].exercises[exIdx].targetReps = e.target.value;
                                setLocal({...local, workouts: nw});
                              }} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold text-center outline-none focus:border-red-600 text-2xl" />
                           </div>
                        </div>
                        <input value={ex.coachCue || ''} onChange={(e) => {
                          const nw = [...local.workouts];
                          nw[wIdx].exercises[exIdx].coachCue = e.target.value;
                          setLocal({...local, workouts: nw});
                        }} placeholder="INSTRUCCIÓN DEL COACH (CUE)" className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-[1.5rem] text-white text-[10px] italic outline-none focus:border-cyan-400/50 transition-all tracking-widest" />
                     </div>
                   ))}
                   <button onClick={() => setPicker(wIdx)} className="w-full py-10 border-2 border-dashed border-zinc-800 rounded-[3rem] text-xs font-black text-zinc-700 uppercase tracking-[0.4em] hover:border-red-600/40 hover:text-red-600 transition-all">+ AÑADIR A SESIÓN</button>
                </div>
             </div>
          ))}
          <button onClick={() => setLocal({...local, workouts: [...local.workouts, { id: `w-${Date.now()}`, name: `NUEVA SESIÓN`, day: local.workouts.length+1, exercises: [] }]})} className="w-full py-14 border-2 border-dashed border-zinc-800 rounded-[4rem] text-xs font-black text-zinc-800 uppercase flex items-center justify-center gap-4 hover:bg-zinc-900/40 transition-all shadow-lg"><Plus size={40}/> NUEVO DÍA DE TRABAJO</button>
       </div>

       {picker !== null && (
         <div className="fixed inset-0 z-[400] bg-black/99 backdrop-blur-3xl p-8 flex flex-col animate-in slide-in-from-bottom duration-300">
            <header className="flex justify-between items-center mb-12 shrink-0">
              <div className="space-y-1">
                 <p className="text-[10px] text-cyan-400 font-black uppercase tracking-[0.4em]">BOX DATABASE</p>
                 <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter">BIBLIOTECA</h3>
              </div>
              <button onClick={() => setPicker(null)} className="bg-zinc-900 p-6 rounded-full text-white shadow-xl"><X size={32}/></button>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-16">
              {allExercises.map((ex: any) => (
                <div key={ex.id} onClick={() => {
                   const nw = [...local.workouts];
                   nw[picker].exercises.push({ exerciseId: ex.id, name: ex.name, targetSets: 4, targetReps: "12", coachCue: "" });
                   setLocal({...local, workouts: nw});
                   setPicker(null);
                }} className="p-8 bg-zinc-900/50 border border-white/5 rounded-[3rem] flex justify-between items-center group active:scale-[0.98] transition-all hover:border-red-600/30">
                  <div className="space-y-1">
                    <p className="font-black text-white uppercase italic text-2xl tracking-tighter group-hover:text-red-600 transition-colors">{ex.name}</p>
                    <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">{ex.muscleGroup}</p>
                  </div>
                  <div className="bg-zinc-950 p-5 rounded-[1.5rem] text-red-600 border border-white/5 shadow-inner"><Plus size={24} /></div>
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
});

const ExerciseManager = memo(({ exercises, onSave, onDelete, onClose }: any) => {
  const [newEx, setNewEx] = useState<Exercise>({ id: `e-${Date.now()}`, name: '', muscleGroup: '', videoUrl: '', technique: '', commonErrors: [] });

  return (
    <div className="fixed inset-0 z-[250] bg-black/99 backdrop-blur-3xl p-8 flex flex-col animate-in slide-in-from-right duration-500 overflow-y-auto no-scrollbar">
       <header className="flex justify-between items-center mb-12 shrink-0">
          <div className="space-y-1">
             <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em]">KINETIX LIBRARY</p>
             <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">BIBLIOTECA</h3>
          </div>
          <button onClick={onClose} className="bg-zinc-900 p-6 rounded-full text-white shadow-2xl"><X size={32}/></button>
       </header>

       <div className="space-y-12 pb-24">
          <div className="bg-zinc-900/40 p-10 rounded-[4rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden group">
             <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest relative z-10">AÑADIR RECURSO TÉCNICO</p>
             <div className="space-y-5 relative z-10">
                <input value={newEx.name} onChange={e => setNewEx({...newEx, name: e.target.value})} placeholder="NOMBRE" className="w-full bg-zinc-950 border border-zinc-800 p-7 rounded-[2rem] text-xs text-white outline-none focus:border-red-600 uppercase font-black tracking-widest shadow-inner" />
                <input value={newEx.muscleGroup} onChange={e => setNewEx({...newEx, muscleGroup: e.target.value})} placeholder="MÚSCULO PRINCIPAL" className="w-full bg-zinc-950 border border-zinc-800 p-7 rounded-[2rem] text-xs text-white outline-none focus:border-red-600 uppercase font-black tracking-widest shadow-inner" />
                <input value={newEx.videoUrl} onChange={e => setNewEx({...newEx, videoUrl: e.target.value})} placeholder="URL VIDEO TÉCNICA" className="w-full bg-zinc-950 border border-zinc-800 p-7 rounded-[2rem] text-xs text-white outline-none focus:border-red-600 font-mono shadow-inner" />
                <button 
                  onClick={() => { if(newEx.name) { onSave(newEx); setNewEx({ id: `e-${Date.now()}`, name: '', muscleGroup: '', videoUrl: '', technique: '', commonErrors: [] }); } }}
                  className="w-full bg-white text-black py-8 rounded-[2.5rem] font-display italic uppercase text-xl shadow-[0_10px_30px_rgba(255,255,255,0.1)] active:scale-95 transition-all"
                >GUARDAR EN REPOSITORIO</button>
             </div>
          </div>

          <div className="space-y-6">
             <div className="flex justify-between items-center px-4">
                <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">EJERCICIOS REGISTRADOS ({exercises.length})</p>
             </div>
             <div className="grid gap-4">
                {exercises.map((ex: any) => (
                  <div key={ex.id} className="p-8 bg-zinc-900/40 border border-white/5 rounded-[3rem] flex justify-between items-center group shadow-lg hover:border-red-600/20 transition-all">
                     <div className="space-y-1">
                       <p className="text-2xl font-black text-white italic uppercase tracking-tighter group-hover:text-red-600 transition-colors">{ex.name}</p>
                       <p className="text-[10px] text-zinc-700 font-black uppercase tracking-widest bg-zinc-950 px-2 rounded-lg border border-white/5 w-fit">{ex.muscleGroup}</p>
                     </div>
                     <button onClick={() => onDelete(ex.id)} className="bg-zinc-800 p-5 rounded-2xl text-zinc-700 hover:text-red-600 transition-all shadow-xl"><Trash2 size={24}/></button>
                  </div>
                ))}
             </div>
          </div>
       </div>
    </div>
  );
});

const ConfigModal = memo(({ onClose }: any) => (
  <div className="fixed inset-0 z-[300] bg-black/99 backdrop-blur-3xl p-8 flex flex-col animate-in fade-in duration-500">
    <header className="flex justify-between items-center mb-12">
      <div className="space-y-1">
        <p className="text-[10px] text-red-600 font-black uppercase tracking-[0.4em]">SYSTEM CORE</p>
        <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">CONFIG</h3>
      </div>
      <button onClick={onClose} className="bg-zinc-900 p-6 rounded-full text-white"><X size={32}/></button>
    </header>
    <div className="space-y-8">
      <div className="p-10 bg-zinc-900/40 rounded-[4rem] border border-white/5 space-y-8 shadow-2xl">
        <SetupInput label="SUPABASE URL" id="SUPABASE_URL" />
        <SetupInput label="SUPABASE ANON KEY" id="SUPABASE_ANON_KEY" />
        <SetupInput label="LOGO URL (GITHUB/IMGUR)" id="LOGO" isLogo />
      </div>
      <div className="p-6 bg-red-600/10 border border-red-600/20 rounded-3xl flex items-center gap-5">
         <ShieldAlert size={32} className="text-red-600 shrink-0"/>
         <p className="text-[11px] font-black text-red-600 uppercase tracking-widest leading-relaxed">LLAVE IA (GEMINI 3 FLASH) GESTIONADA POR PROCESO SEGURO EN SERVIDOR (API_KEY)</p>
      </div>
      <button onClick={() => window.location.reload()} className="w-full bg-red-600 py-10 rounded-[3rem] font-display italic text-3xl uppercase text-white shadow-2xl active:scale-95 transition-all">APLICAR Y REINICIAR</button>
    </div>
  </div>
));

const SetupInput = memo(({ label, id, isLogo }: any) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-zinc-700 uppercase ml-5 tracking-[0.3em]">{label}</label>
    <input 
      onChange={(e) => isLogo ? CONFIG.set('LOGO', e.target.value) : CONFIG.set(id, e.target.value)}
      defaultValue={isLogo ? CONFIG.get('LOGO') : CONFIG.get(id)}
      className="w-full bg-zinc-950 border border-zinc-800 p-7 rounded-[2rem] text-[11px] text-white outline-none focus:border-red-600 font-mono transition-all shadow-inner"
    />
  </div>
));
