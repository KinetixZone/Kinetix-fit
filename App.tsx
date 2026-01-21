
import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, WorkoutLog } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './services/geminiService';

// --- KINETIX DATA ENGINE V12.1 ---
const STORAGE_KEY = 'KINETIX_PRO_V12_1';
const SESSION_KEY = 'KINETIX_ACTIVE_SESSION';

const DataManager = {
  get: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch { return {}; }
  },
  set: (key: string, value: any) => {
    const current = DataManager.get();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, [key]: JSON.stringify(value) }));
  },
  init: () => {
    const store = DataManager.get();
    if (!store.USERS) {
      DataManager.set('USERS', [MOCK_USER]);
      DataManager.set('EXERCISES', INITIAL_EXERCISES);
    }
  },
  getUsers: () => JSON.parse(DataManager.get().USERS || '[]'),
  getExercises: () => JSON.parse(DataManager.get().EXERCISES || '[]'),
  getPlan: (userId: string) => {
    const p = DataManager.get()[`PLAN_${userId}`];
    return p ? JSON.parse(p) : null;
  },
  getLogs: (userId: string) => {
    const l = DataManager.get()[`LOGS_${userId}`];
    return l ? JSON.parse(l) : [];
  },
  savePlan: (plan: Plan) => DataManager.set(`PLAN_${plan.userId}`, plan),
  saveLog: (log: WorkoutLog) => {
    const logs = DataManager.getLogs(log.userId);
    DataManager.set(`LOGS_${log.userId}`, [log, ...logs]);
  },
  deleteUser: (id: string) => {
    const users = DataManager.getUsers().filter((u: User) => u.id !== id);
    DataManager.set('USERS', users);
  }
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [myPlan, setMyPlan] = useState<Plan | null>(null);
  const [myLogs, setMyLogs] = useState<WorkoutLog[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [trainingWorkout, setTrainingWorkout] = useState<Workout | null>(null);
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);

  // Modales Internos (Zero-Sandbox-Error)
  const [inputModal, setInputModal] = useState<{title: string, placeholder: string, type?: string, callback: (v: string) => void} | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'error' | 'success'} | null>(null);

  const notify = useCallback((msg: string, type: 'error' | 'success' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    DataManager.init();
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      const user = JSON.parse(saved);
      setCurrentUser(user);
      setActiveTab(user.role === 'coach' ? 'admin' : 'home');
    }
    setIsReady(true);
  }, []);

  const sync = useCallback(() => {
    if (!isReady) return;
    setAllUsers(DataManager.getUsers());
    setExercises(DataManager.getExercises());
    if (currentUser && currentUser.role !== 'coach') {
      setMyPlan(DataManager.getPlan(currentUser.id));
      setMyLogs(DataManager.getLogs(currentUser.id));
    }
  }, [currentUser, isReady]);

  useEffect(() => { sync(); }, [sync]);

  const handleLogin = () => {
    const input = loginName.trim().toLowerCase();
    if (!input) return;
    const found = DataManager.getUsers().find((u: User) => u.name.toLowerCase().includes(input));
    if (found) {
      setCurrentUser(found);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(found));
      notify(`BIENVENIDO, ${found.name.split(' ')[0]}`);
      setActiveTab('home');
    } else {
      notify(`ATLETA "${loginName}" NO ENCONTRADO`, 'error');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    sessionStorage.removeItem(SESSION_KEY);
    setLoginName('');
    setActiveTab('home');
  };

  const chartData = useMemo(() => {
    if (!myLogs.length) return [];
    return myLogs.slice(0, 7).reverse().map(log => ({
      date: new Date(log.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      vol: log.exercisesData.reduce((acc, ex) => acc + (ex.sets?.reduce((sAcc, s) => sAcc + (s.weight * (s.reps || 0)), 0) || 0), 0)
    }));
  }, [myLogs]);

  if (!isReady) return <div className="min-h-screen bg-[#050507] flex items-center justify-center"><RefreshCw className="animate-spin text-red-600" size={40}/></div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100 font-sans selection:bg-red-600/30 overflow-x-hidden">
      {/* HEADER ELITE */}
      <header className="p-6 flex justify-between items-center bg-zinc-950/90 backdrop-blur-3xl sticky top-0 z-[100] border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_15px_rgba(239,68,68,0.5)]">
             <Dumbbell className="text-white" size={22} />
          </div>
          <div className="flex flex-col">
            <span className="font-display italic text-2xl uppercase text-white tracking-tighter leading-none neon-red">KINETIX</span>
            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.4em]">PERFORMANCE ZONE</span>
          </div>
        </div>
        {currentUser && (
          <button onClick={handleLogout} className="bg-zinc-900 p-3 rounded-2xl text-zinc-600 hover:text-red-600 border border-white/5 transition-colors">
            <LogOut size={18}/>
          </button>
        )}
      </header>

      <main className="flex-1 p-6 pb-32">
        {!currentUser ? (
          <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-16 animate-in fade-in duration-700">
             <div className="relative group">
                <div className="absolute -inset-12 bg-red-600 rounded-full blur-[100px] opacity-10 group-hover:opacity-25 transition-all"></div>
                <div className="relative w-44 h-44 bg-zinc-900 rounded-[4rem] border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden">
                   <img src="https://raw.githubusercontent.com/StackBlitz/stackblitz-images/main/kinetix-wolf-logo.png" className="w-28 h-28 object-contain float" alt="Kinetix Wolf" />
                </div>
             </div>
             
             <div className="w-full space-y-12 px-4 text-center">
                <div className="space-y-2">
                  <h1 className="text-7xl font-display italic text-white uppercase tracking-tighter leading-none">ENTRAR</h1>
                  <p className="text-zinc-700 font-black uppercase text-[10px] tracking-[0.5em]">PLATAFORMA PARA ATLETAS</p>
                </div>
                
                <div className="space-y-5">
                  <input 
                    value={loginName} 
                    onChange={e => setLoginName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="TU NOMBRE"
                    className="w-full bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] text-center font-bold text-white outline-none focus:border-red-600 transition-all uppercase text-2xl placeholder:text-zinc-800"
                  />
                  <button 
                    onClick={handleLogin}
                    className="w-full bg-red-600 py-8 rounded-[3rem] font-display italic text-3xl uppercase text-white shadow-xl active:scale-95 transition-all"
                  >
                    CONTINUAR
                  </button>
                </div>
             </div>

             <button 
               onClick={() => setInputModal({
                 title: 'ACCESO COACH',
                 placeholder: 'PIN DE SEGURIDAD',
                 type: 'password',
                 callback: (pin) => {
                   if (pin === 'KINETIX2025') {
                     const coach: User = { 
                       id: 'coach-master', name: 'HEAD COACH', email: 'coach@kinetix.com',
                       role: 'coach', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED,
                       daysPerWeek: 7, equipment: ['FULL'], streak: 100, createdAt: new Date().toISOString()
                     };
                     setCurrentUser(coach);
                     sessionStorage.setItem(SESSION_KEY, JSON.stringify(coach));
                     setActiveTab('admin');
                     notify("MODO COACH ACTIVADO");
                   } else notify("PIN INCORRECTO", 'error');
                 }
               })}
               className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.5em] hover:text-red-600 flex items-center gap-2 transition-colors"
             >
               <Lock size={12}/> ACCESO COACH
             </button>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-8 duration-500">
            {activeTab === 'home' && (
              <div className="space-y-10">
                <header className="text-left">
                   <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">MI RENDIMIENTO</p>
                   <h2 className="text-6xl font-display italic text-white uppercase leading-none tracking-tighter">
                     HOLA, <span className="text-red-600">{currentUser.name.split(' ')[0]}</span>
                   </h2>
                </header>

                {/* KPI CHART */}
                <div className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
                   <div className="flex justify-between items-center relative z-10">
                      <div className="text-left">
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-2"><Zap size={14}/> VOLUMEN SEMANAL</p>
                        <h4 className="text-2xl font-display italic text-white uppercase tracking-tighter italic">CARGA TOTAL</h4>
                      </div>
                      <div className="bg-zinc-950 p-4 rounded-3xl border border-white/5 text-right min-w-[80px]">
                         <p className="text-3xl font-display italic text-white leading-none">{myLogs.length}</p>
                         <p className="text-[7px] text-zinc-600 font-black uppercase tracking-widest mt-1">SESIONES</p>
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
                              <Area type="monotone" dataKey="vol" stroke="#ef4444" strokeWidth={4} fillOpacity={1} fill="url(#colorVol)" />
                           </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[2.5rem] gap-3 text-zinc-800">
                           <BarChart3 size={32}/>
                           <p className="text-[9px] font-black uppercase tracking-widest text-center italic">PENDIENTE DE TU PRIMER ENTRENAMIENTO</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* SESIONES LIST */}
                <div className="space-y-6 pb-12 text-left">
                  <div className="flex justify-between items-center px-4">
                     <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">MIS ENTRENAMIENTOS</p>
                     <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{myPlan?.title || 'ESPERANDO PLAN'}</p>
                  </div>
                  <div className="grid gap-4">
                    {myPlan?.workouts.map(w => (
                      <button 
                        key={w.id} 
                        onClick={() => setTrainingWorkout(w)}
                        className="w-full flex justify-between items-center p-8 bg-zinc-900/40 rounded-[3rem] border border-white/5 hover:border-red-600/30 transition-all active:scale-95 shadow-lg group"
                      >
                        <div className="flex items-center gap-6">
                           <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center font-display italic text-3xl text-zinc-800 group-hover:text-red-600 border border-white/5 transition-colors">{w.day}</div>
                           <div className="text-left">
                              <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">{w.name}</h4>
                              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">{w.exercises.length} EJERCICIOS</p>
                           </div>
                        </div>
                        <div className="bg-zinc-950 p-5 rounded-2xl group-hover:bg-red-600 transition-all text-zinc-800 group-hover:text-white"><Play size={24}/></div>
                      </button>
                    ))}
                    {!myPlan && (
                      <div className="py-16 bg-zinc-900/10 border-2 border-dashed border-zinc-800 rounded-[4rem] text-center space-y-4">
                         <ShieldAlert size={40} className="mx-auto text-zinc-800" />
                         <p className="text-[11px] text-zinc-700 font-black uppercase tracking-widest px-10">PIDE A TU COACH QUE GENERE TU RUTINA INTELIGENTE</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'admin' && (
              <div className="space-y-12 pb-24 text-left">
                <header className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">BOX CONTROL</p>
                    <h2 className="text-7xl font-display italic text-red-600 uppercase tracking-tighter leading-none italic">COACH</h2>
                  </div>
                  <button onClick={sync} className="bg-zinc-900 p-6 rounded-[2rem] text-zinc-400 border border-zinc-800 hover:text-white shadow-xl transition-all">
                    <RefreshCw className={loading ? 'animate-spin' : ''} size={28}/>
                  </button>
                </header>

                <div className="space-y-8">
                   <div className="flex justify-between items-center px-4">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> ATLETAS ({allUsers.length - 1})</p>
                      <button 
                        onClick={() => setInputModal({
                          title: 'REGISTRO ATLETA',
                          placeholder: 'NOMBRE COMPLETO',
                          callback: (name) => {
                            if (!name) return;
                            const u = { ...MOCK_USER, id: `u-${Date.now()}`, name, streak: 0, createdAt: new Date().toISOString() };
                            const users = DataManager.getUsers();
                            DataManager.set('USERS', [...users, u]);
                            sync();
                            notify("ATLETA REGISTRADO");
                          }
                        })}
                        className="bg-red-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg active:scale-95 transition-all"
                      ><Plus size={16}/> REGISTRAR</button>
                   </div>
                   
                   <div className="grid gap-4">
                      {allUsers.filter(u => u.role !== 'coach').map(u => (
                        <div key={u.id} className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 flex items-center justify-between group shadow-xl">
                           <div className="text-left space-y-2">
                              <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{u.name}</h4>
                              <div className="flex gap-2">
                                <span className="text-[9px] text-zinc-700 font-black uppercase px-3 py-1 bg-zinc-950 rounded-xl border border-white/5">{u.level}</span>
                                <span className="text-[9px] text-red-600/40 font-black uppercase px-3 py-1 bg-zinc-950 rounded-xl border border-white/5">{u.goal}</span>
                              </div>
                           </div>
                           <div className="flex gap-2">
                              <button 
                                onClick={async () => {
                                  setLoading(true);
                                  try {
                                    const res = await generateSmartRoutine(u);
                                    setEditingPlan({ plan: { ...res, id: `p-${Date.now()}`, userId: u.id, updatedAt: new Date().toISOString() }, isNew: true });
                                  } catch (e: any) { notify(e.message, 'error'); }
                                  finally { setLoading(false); }
                                }}
                                className="p-5 bg-red-600/10 text-red-600 rounded-2xl border border-red-600/20 hover:bg-red-600 hover:text-white shadow-xl transition-all"
                                title="IA MAGIC"
                              ><Sparkles size={24}/></button>
                              <button 
                                onClick={() => {
                                  const plan = DataManager.getPlan(u.id) || { id: `p-${Date.now()}`, userId: u.id, title: 'PLAN ENTRENAMIENTO', workouts: [], updatedAt: new Date().toISOString() };
                                  setEditingPlan({ plan, isNew: false });
                                }}
                                className="p-5 bg-zinc-800 text-zinc-500 rounded-2xl hover:bg-white hover:text-black shadow-xl transition-all"
                                title="EDITAR"
                              ><Edit3 size={24}/></button>
                              <button 
                                onClick={() => { 
                                  // Reemplazo de window.confirm nativo para ser consistente
                                  setInputModal({
                                    title: `ELIMINAR A ${u.name.toUpperCase()}`,
                                    placeholder: 'ESCRIBE "ELIMINAR" PARA CONFIRMAR',
                                    callback: (val) => {
                                      if (val.toLowerCase() === 'eliminar') {
                                        DataManager.deleteUser(u.id);
                                        sync();
                                        notify("ATLETA ELIMINADO");
                                      }
                                    }
                                  });
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

      {/* FOOTER NAV GLOBAL */}
      {currentUser && !trainingWorkout && (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/98 backdrop-blur-3xl border-t border-white/5 px-10 py-8 z-[100] flex justify-around shadow-2xl">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={28}/>} label="INICIO" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={28}/>} label="COACH" />}
          <NavItem active={activeTab === 'stats'} onClick={() => {}} icon={<History size={28}/>} label="HISTORIAL" />
        </nav>
      )}

      {/* CAPA TÁCTICA: MODAL DE ENTRADA (SOLUCIÓN SANDBOX) */}
      {inputModal && (
        <div className="fixed inset-0 z-[500] bg-black/98 flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="w-full bg-zinc-900 border border-white/10 rounded-[3rem] p-10 space-y-8 shadow-[0_0_100px_rgba(239,68,68,0.25)]">
              <div className="text-center space-y-2">
                 <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.5em]">{inputModal.title}</p>
                 <h3 className="text-3xl font-display italic text-white uppercase italic">REQUERIDO</h3>
              </div>
              <input 
                autoFocus
                id="tactical-input"
                type={inputModal.type || 'text'}
                placeholder={inputModal.placeholder}
                className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center text-xl font-bold outline-none focus:border-red-600 uppercase text-white shadow-inner"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    inputModal.callback((e.target as HTMLInputElement).value);
                    setInputModal(null);
                  }
                  if (e.key === 'Escape') setInputModal(null);
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setInputModal(null)} className="py-5 bg-zinc-800 rounded-3xl font-black uppercase text-[10px] text-zinc-500">CANCELAR</button>
                 <button onClick={() => {
                    const val = (document.getElementById('tactical-input') as HTMLInputElement)?.value;
                    inputModal.callback(val);
                    setInputModal(null);
                 }} className="py-5 bg-red-600 rounded-3xl font-black uppercase text-[10px] text-white shadow-lg active:scale-95 transition-all">CONFIRMAR</button>
              </div>
           </div>
        </div>
      )}

      {/* NOTIFICACIONES TOAST PRO */}
      {toast && (
        <div className="fixed top-10 left-6 right-6 z-[600] animate-in slide-in-from-top duration-300">
           <div className={`${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} p-6 rounded-3xl flex items-center justify-between shadow-2xl border border-white/10`}>
              <div className="flex items-center gap-4">
                 {toast.type === 'error' ? <ShieldAlert className="text-white" size={24}/> : <CheckCircle2 className="text-white" size={24}/>}
                 <p className="text-[11px] font-black uppercase tracking-widest text-white leading-tight">{toast.msg}</p>
              </div>
              <button onClick={() => setToast(null)} className="p-2 bg-white/20 rounded-full text-white"><X size={14}/></button>
           </div>
        </div>
      )}

      {/* MODALES DE ENTRENAMIENTO Y EDITOR */}
      {trainingWorkout && <TrainingSession workout={trainingWorkout} exercises={exercises} userId={currentUser?.id || ''} notify={notify} onClose={(did, log) => { if(did && log) { DataManager.saveLog(log); sync(); } setTrainingWorkout(null); }} />}
      {editingPlan && <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={(p: Plan) => { DataManager.savePlan(p); sync(); setEditingPlan(null); notify("PLAN ACTUALIZADO"); }} onCancel={() => setEditingPlan(null)} loading={loading} />}
    </div>
  );
}

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-4 rounded-3xl transition-all ${active ? 'bg-red-600/10 scale-110 border border-red-600/20 shadow-lg' : ''}`}>{icon}</div>
    <span className={`text-[9px] font-black uppercase tracking-[0.5em] ${active ? 'opacity-100' : 'opacity-30'}`}>{label}</span>
  </button>
));

const TrainingSession = memo(({ workout, exercises, userId, notify, onClose }: any) => {
  const [logs, setLogs] = useState<any>(workout.exercises.map((ex:any) => ({
    exerciseId: ex.exerciseId,
    sets: Array.from({ length: ex.targetSets || 4 }).map(() => ({ weight: 0, reps: 0, done: false }))
  })));

  const updateSet = (exIdx: number, setIdx: number, field: string, val: any) => {
    const nl = [...logs];
    nl[exIdx].sets[setIdx][field] = val;
    setLogs(nl);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-[#050507] flex flex-col animate-in slide-in-from-bottom duration-500 overflow-y-auto pb-40 no-scrollbar">
       <header className="p-8 flex justify-between items-center sticky top-0 bg-[#050507] z-10 border-b border-zinc-900 shadow-2xl">
          <div className="text-left">
             <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.5em] mb-1">SESIÓN ACTIVA</span>
             <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none">{workout.name}</h3>
          </div>
          <button onClick={() => onClose(false)} className="bg-zinc-900 p-6 rounded-full text-zinc-500 hover:text-white transition-colors"><X size={32}/></button>
       </header>
       <div className="p-6 space-y-16">
          {workout.exercises.map((ex: any, exIdx: number) => {
            const exerciseData = exercises.find((e:any) => e.id === ex.exerciseId);
            return (
              <div key={exIdx} className="space-y-8 text-left border-l-4 border-red-600 pl-8 animate-in slide-in-from-left duration-500">
                <div className="space-y-2">
                  <h4 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">{exerciseData?.name || ex.name}</h4>
                  <p className="text-[11px] text-zinc-600 font-black uppercase tracking-widest">{ex.targetSets} SERIES × {ex.targetReps} REPS</p>
                  {ex.coachCue && <p className="text-[10px] text-cyan-400 italic font-medium">Tip: {ex.coachCue}</p>}
                </div>
                <div className="grid gap-4">
                   {logs[exIdx].sets.map((set: any, setIdx: number) => (
                     <div key={setIdx} className={`p-7 rounded-[2.5rem] border transition-all flex items-center justify-between gap-8 ${set.done ? 'bg-green-600/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'bg-zinc-900/40 border-white/5 shadow-inner'}`}>
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-display italic text-3xl ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-800'}`}>{setIdx + 1}</div>
                        <div className="flex-1 flex gap-5">
                           <div className="flex-1 text-center space-y-2">
                              <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">KG</p>
                              <input type="number" value={set.weight || ''} onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center text-white outline-none focus:border-red-600 text-2xl font-bold shadow-inner" />
                           </div>
                           <div className="flex-1 text-center space-y-2">
                              <p className="text-[9px] text-zinc-700 font-black uppercase tracking-widest">REPS</p>
                              <input type="number" value={set.reps || ''} onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-5 rounded-2xl text-center text-white outline-none focus:border-red-600 text-2xl font-bold shadow-inner" />
                           </div>
                        </div>
                        <button onClick={() => updateSet(exIdx, setIdx, 'done', !set.done)} className={`p-7 rounded-2xl transition-all ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-800 active:scale-90 shadow-lg'}`}><Check size={28}/></button>
                     </div>
                   ))}
                </div>
              </div>
            );
          })}
          <button onClick={() => { notify("ENTRENAMIENTO GUARDADO"); onClose(true, { id: `log-${Date.now()}`, userId, workoutId: workout.id, date: new Date().toISOString(), exercisesData: logs }); }} className="w-full py-12 bg-red-600 rounded-[3.5rem] font-display italic text-4xl uppercase text-white shadow-2xl active:scale-95 transition-all mt-12 mb-20">FINALIZAR ENTRENAR</button>
       </div>
    </div>
  );
});

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel, loading }: any) => {
  const [local, setLocal] = useState<Plan>(() => JSON.parse(JSON.stringify(plan)));
  const [picker, setPicker] = useState<number | null>(null);

  return (
    <div className="fixed inset-0 bg-[#050507] z-[250] p-8 flex flex-col animate-in slide-in-from-right duration-500 overflow-y-auto pb-48 no-scrollbar">
       <header className="flex justify-between items-center mb-12 sticky top-0 bg-[#050507]/90 backdrop-blur-xl py-6 z-10 border-b border-white/5 shadow-2xl">
          <button onClick={onCancel} className="bg-zinc-900 p-6 rounded-full text-zinc-500"><ChevronLeft size={32}/></button>
          <div className="text-center flex-1 px-4 text-left">
             <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.5em] mb-1">CONFIGURAR PLAN</p>
             <input value={local.title} onChange={e => setLocal({...local, title: e.target.value})} className="bg-transparent text-2xl font-display italic text-white text-center outline-none uppercase tracking-tighter w-full" />
          </div>
          <button onClick={() => onSave(local)} disabled={loading} className="bg-red-600 p-6 rounded-full text-white shadow-2xl active:scale-95 transition-all">
            {loading ? <RefreshCw className="animate-spin" size={32}/> : <Save size={32}/>}
          </button>
       </header>

       <div className="space-y-12">
          {local.workouts.map((w, wIdx) => (
             <div key={wIdx} className="bg-zinc-900/30 p-10 rounded-[4rem] border border-white/5 space-y-10 shadow-2xl text-left">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-red-600/10 rounded-2xl flex items-center justify-center text-red-600 font-display italic text-4xl border border-red-600/20">{wIdx + 1}</div>
                  <input value={w.name} onChange={e => { const nw = [...local.workouts]; nw[wIdx].name = e.target.value; setLocal({...local, workouts: nw}); }} className="bg-transparent border-b border-zinc-800 p-2 text-3xl font-display italic text-white outline-none w-full uppercase" />
                  <button onClick={() => { if(window.confirm("¿ELIMINAR ESTA SESIÓN?")) { const nw = [...local.workouts]; nw.splice(wIdx, 1); setLocal({...local, workouts: nw}); } }} className="text-zinc-800 hover:text-red-500 transition-colors"><Trash2 size={24}/></button>
                </div>

                <div className="space-y-6">
                   {w.exercises.map((ex, exIdx) => (
                     <div key={exIdx} className="p-8 bg-zinc-950/80 rounded-[3rem] border border-white/5 space-y-6 shadow-inner">
                        <div className="flex justify-between items-start">
                           <span className="text-xs font-black uppercase text-red-600 tracking-widest">{allExercises.find((e:any) => e.id === ex.exerciseId)?.name || ex.name}</span>
                           <button onClick={() => { const nw = [...local.workouts]; nw[wIdx].exercises.splice(exIdx, 1); setLocal({...local, workouts: nw}); }} className="text-zinc-800 hover:text-red-500"><X size={20}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <div className="text-center">
                             <label className="text-[9px] font-black text-zinc-700 uppercase mb-2 block">SERIES</label>
                             <input value={ex.targetSets} type="number" onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].targetSets = parseInt(e.target.value) || 0; setLocal({...local, workouts: nw}); }} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold text-center text-2xl" />
                           </div>
                           <div className="text-center">
                             <label className="text-[9px] font-black text-zinc-700 uppercase mb-2 block">REPS</label>
                             <input value={ex.targetReps} onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].targetReps = e.target.value; setLocal({...local, workouts: nw}); }} className="w-full bg-zinc-900 border border-zinc-800 p-5 rounded-2xl text-white font-bold text-center text-2xl" />
                           </div>
                        </div>
                        <input value={ex.coachCue || ''} onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].coachCue = e.target.value; setLocal({...local, workouts: nw}); }} placeholder="CONSEJOS DEL COACH" className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-2xl text-xs text-white outline-none italic placeholder:text-zinc-800" />
                     </div>
                   ))}
                   <button onClick={() => setPicker(wIdx)} className="w-full py-10 border-2 border-dashed border-zinc-800 rounded-[3rem] text-xs font-black text-zinc-700 uppercase tracking-widest hover:text-red-600 transition-all">+ AÑADIR EJERCICIO</button>
                </div>
             </div>
          ))}
          <button onClick={() => setLocal({...local, workouts: [...local.workouts, { id: `w-${Date.now()}`, name: `NUEVA SESIÓN`, day: local.workouts.length+1, exercises: [] }]})} className="w-full py-14 border-2 border-dashed border-zinc-800 rounded-[4.5rem] text-xs font-black text-zinc-800 uppercase flex items-center justify-center gap-4 hover:bg-zinc-900/40 transition-all shadow-xl"><Plus size={40}/> NUEVO DÍA</button>
       </div>

       {picker !== null && (
         <div className="fixed inset-0 z-[400] bg-black/99 backdrop-blur-3xl p-8 flex flex-col animate-in slide-in-from-bottom duration-300">
            <header className="flex justify-between items-center mb-12">
              <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter">EJERCICIOS</h3>
              <button onClick={() => setPicker(null)} className="bg-zinc-900 p-6 rounded-full text-white"><X size={32}/></button>
            </header>
            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-16">
              {allExercises.map((ex: any) => (
                <div key={ex.id} onClick={() => {
                   const nw = [...local.workouts];
                   nw[picker].exercises.push({ exerciseId: ex.id, name: ex.name, targetSets: 4, targetReps: "12", coachCue: "" });
                   setLocal({...local, workouts: nw});
                   setPicker(null);
                }} className="p-8 bg-zinc-900/50 border border-white/5 rounded-[3rem] flex justify-between items-center group active:scale-[0.98] transition-all text-left shadow-lg">
                  <p className="font-black text-white uppercase italic text-2xl tracking-tighter group-hover:text-red-600 transition-colors">{ex.name}</p>
                  <Plus size={28} className="text-red-600" />
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
});
