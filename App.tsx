
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer, Download, Upload, Filter, Clock
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, WorkoutLog } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './services/geminiService';

// --- KINETIX ULTIMATE ENGINE V12.4.1 (RELEASE CANDIDATE) ---
const STORAGE_KEY = 'KINETIX_MASTER_FINAL';
const SESSION_KEY = 'KINETIX_SESSION_ACTIVE';

const DataEngine = {
  getStore: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch { return {}; }
  },
  saveStore: (data: any) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },
  init: () => {
    const store = DataEngine.getStore();
    if (!store.USERS) {
      DataEngine.saveStore({
        USERS: JSON.stringify([MOCK_USER]),
        EXERCISES: JSON.stringify(INITIAL_EXERCISES),
        LOGO_URL: 'https://raw.githubusercontent.com/StackBlitz/stackblitz-images/main/kinetix-wolf-logo.png'
      });
    }
  },
  getUsers: (): User[] => JSON.parse(DataEngine.getStore().USERS || '[]'),
  getExercises: (): Exercise[] => JSON.parse(DataEngine.getStore().EXERCISES || '[]'),
  getLogo: (): string => DataEngine.getStore().LOGO_URL || '',
  saveLogo: (url: string) => {
    const s = DataEngine.getStore();
    s.LOGO_URL = url;
    DataEngine.saveStore(s);
  },
  saveExercises: (exs: Exercise[]) => {
    const s = DataEngine.getStore();
    s.EXERCISES = JSON.stringify(exs);
    DataEngine.saveStore(s);
  },
  getPlan: (uid: string): Plan | null => {
    const p = DataEngine.getStore()[`PLAN_${uid}`];
    return p ? JSON.parse(p) : null;
  },
  savePlan: (p: Plan) => {
    const s = DataEngine.getStore();
    s[`PLAN_${p.userId}`] = JSON.stringify(p);
    DataEngine.saveStore(s);
  },
  getLogs: (uid: string): WorkoutLog[] => {
    const l = DataEngine.getStore()[`LOGS_${uid}`];
    return l ? JSON.parse(l) : [];
  },
  saveLog: (l: WorkoutLog) => {
    const s = DataEngine.getStore();
    const logs = DataEngine.getLogs(l.userId);
    s[`LOGS_${l.userId}`] = JSON.stringify([l, ...logs]);
    DataEngine.saveStore(s);
  },
  exportData: () => {
    const data = DataEngine.getStore();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KINETIX_DB_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  },
  importData: (file: File, callback: () => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        DataEngine.saveStore(json);
        callback();
      } catch { alert("ERROR CRÍTICO: ARCHIVO NO VÁLIDO"); }
    };
    reader.readAsText(file);
  },
  deleteUser: (uid: string) => {
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const filtered = users.filter((u: any) => u.id !== uid);
    s.USERS = JSON.stringify(filtered);
    delete s[`PLAN_${uid}`];
    delete s[`LOGS_${uid}`];
    DataEngine.saveStore(s);
  }
};

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [logo, setLogo] = useState('');
  const [myPlan, setMyPlan] = useState<Plan | null>(null);
  const [myLogs, setMyLogs] = useState<WorkoutLog[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [trainingWorkout, setTrainingWorkout] = useState<Workout | null>(null);
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);

  const [inputModal, setInputModal] = useState<{title: string, placeholder: string, type?: string, callback: (v: string) => void} | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'error' | 'success'} | null>(null);

  const notify = useCallback((msg: string, type: 'error' | 'success' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    DataEngine.init();
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
    setAllUsers(DataEngine.getUsers());
    setExercises(DataEngine.getExercises());
    setLogo(DataEngine.getLogo());
    if (currentUser && currentUser.role !== 'coach') {
      setMyPlan(DataEngine.getPlan(currentUser.id));
      setMyLogs(DataEngine.getLogs(currentUser.id));
    }
  }, [currentUser, isReady]);

  useEffect(() => { sync(); }, [sync]);

  const handleLogin = () => {
    const input = loginName.trim().toLowerCase();
    if (!input) return;
    const found = DataEngine.getUsers().find((u: User) => u.name.toLowerCase().includes(input));
    if (found) {
      setCurrentUser(found);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(found));
      notify(`SESIÓN INICIADA: ${found.name.toUpperCase()}`);
      setActiveTab('home');
    } else notify(`ATLETA NO REGISTRADO`, 'error');
  };

  const chartData = useMemo(() => {
    if (!myLogs.length) return [];
    return myLogs.slice(0, 8).reverse().map(log => ({
      date: new Date(log.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      vol: log.exercisesData.reduce((acc, ex) => acc + (ex.sets?.reduce((sAcc, s) => sAcc + (s.weight * (s.reps || 0)), 0) || 0), 0)
    }));
  }, [myLogs]);

  if (!isReady) return <div className="min-h-screen bg-[#050507] flex items-center justify-center"><RefreshCw className="animate-spin text-red-600" size={40}/></div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100 font-sans selection:bg-red-600/30 overflow-x-hidden">
      {/* HEADER DE PRODUCCIÓN */}
      <header className="p-6 flex justify-between items-center bg-zinc-950/90 backdrop-blur-3xl sticky top-0 z-[100] border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)]">
             <img src={logo} className="w-7 h-7 object-contain" alt="K" />
          </div>
          <div className="flex flex-col">
            <span className="font-display italic text-2xl uppercase text-white tracking-tighter leading-none neon-red">KINETIX</span>
            <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.4em]">STATION RELEASE V12.4</span>
          </div>
        </div>
        {currentUser && (
          <button onClick={() => { setCurrentUser(null); sessionStorage.removeItem(SESSION_KEY); setLoginName(''); setActiveTab('home'); }} className="bg-zinc-900 p-3 rounded-2xl text-zinc-600 hover:text-red-600 border border-white/5 transition-all">
            <LogOut size={18}/>
          </button>
        )}
      </header>

      <main className="flex-1 p-6 pb-32">
        {!currentUser ? (
          <div className="min-h-[80vh] flex flex-col items-center justify-center space-y-16 animate-in fade-in duration-1000">
             <div className="relative group">
                <div className="absolute -inset-20 bg-red-600 rounded-full blur-[140px] opacity-10 group-hover:opacity-30 transition-all"></div>
                <div className="relative w-52 h-52 bg-zinc-900 rounded-[5rem] border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group-hover:scale-110 transition-transform duration-500">
                   <img src={logo} className="w-36 h-36 object-contain float" alt="Kinetix Logo" />
                </div>
             </div>
             
             <div className="w-full space-y-12 px-4 text-center">
                <div className="space-y-2">
                  <h1 className="text-7xl font-display italic text-white uppercase tracking-tighter leading-none italic">ENTRAR</h1>
                  <p className="text-zinc-700 font-black uppercase text-[10px] tracking-[0.5em]">ZONA DE ALTO RENDIMIENTO</p>
                </div>
                
                <div className="space-y-5">
                  <input 
                    value={loginName} 
                    onChange={e => setLoginName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    placeholder="ID DE ATLETA"
                    className="w-full bg-zinc-900/50 border border-zinc-800 p-8 rounded-[3rem] text-center font-bold text-white outline-none focus:border-red-600 transition-all uppercase text-2xl placeholder:text-zinc-800 shadow-inner"
                  />
                  <button 
                    onClick={handleLogin}
                    className="w-full bg-red-600 py-8 rounded-[3rem] font-display italic text-3xl uppercase text-white shadow-[0_20px_50px_rgba(239,68,68,0.4)] active:scale-95 transition-all"
                  >
                    IDENTIFICARSE
                  </button>
                </div>
             </div>

             <button 
               onClick={() => setInputModal({
                 title: 'ACCESO STAFF',
                 placeholder: 'PIN MAESTRO',
                 type: 'password',
                 callback: (pin) => {
                   if (pin === 'KINETIX2025') {
                     const coach: User = { 
                       id: 'staff-master', name: 'HEAD COACH', email: 'staff@kinetix.com',
                       role: 'coach', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED,
                       daysPerWeek: 7, equipment: ['Full Box'], streak: 100, createdAt: new Date().toISOString()
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
               <Lock size={12}/> COACH ACCESS
             </button>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-8 duration-500">
            {activeTab === 'home' && (
              <div className="space-y-10">
                <header className="text-left">
                   <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">DASHBOARD</p>
                   <h2 className="text-6xl font-display italic text-white uppercase leading-none tracking-tighter italic">
                     HOLA, <span className="text-red-600">{currentUser.name.split(' ')[0]}</span>
                   </h2>
                </header>

                <div className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
                   <div className="flex justify-between items-center relative z-10">
                      <div className="text-left">
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-2"><Activity size={14}/> VOLUMEN CARGA</p>
                        <h4 className="text-2xl font-display italic text-white uppercase tracking-tighter italic">RENDIMIENTO</h4>
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
                           <p className="text-[9px] font-black uppercase tracking-widest text-center italic">EMPIEZA TU PRIMER PROTOCOLO</p>
                        </div>
                      )}
                   </div>
                </div>

                <div className="space-y-6 pb-12 text-left">
                  <div className="flex justify-between items-center px-4">
                     <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic">PROTOCOLO ACTUAL</p>
                     <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{myPlan?.title || 'SIN ASIGNAR'}</p>
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
                              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">{w.exercises.length} BLOQUES</p>
                           </div>
                        </div>
                        <div className="bg-zinc-950 p-5 rounded-2xl group-hover:bg-red-600 transition-all text-zinc-800 group-hover:text-white shadow-xl"><Play size={24}/></div>
                      </button>
                    ))}
                    {!myPlan && (
                      <div className="py-16 bg-zinc-900/10 border-2 border-dashed border-zinc-800 rounded-[4rem] text-center space-y-4">
                         <ShieldAlert size={40} className="mx-auto text-zinc-800" />
                         <p className="text-[11px] text-zinc-700 font-black uppercase tracking-widest px-10">SOLICITA TU PLAN IA AL COACH</p>
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
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">STATION COMMAND</p>
                    <h2 className="text-7xl font-display italic text-red-600 uppercase tracking-tighter leading-none italic">COACH</h2>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex flex-col gap-2">
                      <button onClick={DataEngine.exportData} className="bg-zinc-900 p-4 rounded-2xl text-green-500 border border-zinc-800 hover:text-white shadow-xl transition-all"><Download size={22}/></button>
                      <label className="bg-zinc-900 p-4 rounded-2xl text-orange-500 border border-zinc-800 hover:text-white shadow-xl transition-all cursor-pointer">
                        <Upload size={22}/>
                        <input type="file" className="hidden" accept=".json" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if(file) DataEngine.importData(file, () => { sync(); notify("BASE DE DATOS SINCRONIZADA"); });
                        }} />
                      </label>
                    </div>
                    <button onClick={() => setInputModal({
                      title: 'IDENTIDAD VISUAL',
                      placeholder: 'URL DEL LOGO (GITHUB/IMG)',
                      callback: (url) => { if(url) { DataEngine.saveLogo(url); setLogo(url); notify("LOGO ACTUALIZADO"); } }
                    })} className="bg-zinc-900 p-6 rounded-[2rem] text-zinc-500 border border-zinc-800 hover:text-white shadow-xl transition-all"><ImageIcon size={28}/></button>
                    <button onClick={() => setShowLibrary(true)} className="bg-zinc-900 p-6 rounded-[2rem] text-cyan-400 border border-zinc-800 hover:text-white shadow-xl transition-all"><BookOpen size={28}/></button>
                    <button onClick={sync} className="bg-zinc-900 p-6 rounded-[2rem] text-zinc-400 border border-zinc-800 hover:text-white shadow-xl transition-all"><RefreshCw className={loading ? 'animate-spin' : ''} size={28}/></button>
                  </div>
                </header>

                <div className="space-y-8">
                   <div className="flex justify-between items-center px-4">
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2"><Users size={14}/> ATLETAS ({allUsers.length - 1})</p>
                      <button 
                        onClick={() => setInputModal({
                          title: 'REGISTRO DE ATLETA',
                          placeholder: 'NOMBRE COMPLETO',
                          callback: (name) => {
                            if (!name) return;
                            const u: User = { ...MOCK_USER, id: `u-${Date.now()}`, name, streak: 0, createdAt: new Date().toISOString() };
                            const users = DataEngine.getUsers();
                            const s = DataEngine.getStore();
                            s.USERS = JSON.stringify([...users, u]);
                            DataEngine.saveStore(s);
                            sync();
                            notify("NUEVO ATLETA KINETIX");
                          }
                        })}
                        className="bg-red-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:scale-105 active:scale-95 transition-all"
                      ><Plus size={16}/> REGISTRAR</button>
                   </div>
                   
                   <div className="grid gap-4">
                      {allUsers.filter(u => u.role !== 'coach').map(u => (
                        <div key={u.id} className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 flex items-center justify-between group shadow-xl hover:bg-zinc-900/60 transition-all border-l-2 border-l-red-600/30">
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
                              ><Sparkles size={24}/></button>
                              <button 
                                onClick={() => {
                                  const plan = DataEngine.getPlan(u.id) || { id: `p-${Date.now()}`, userId: u.id, title: 'KINETIX ELITE PROTOCOL', workouts: [], updatedAt: new Date().toISOString() };
                                  setEditingPlan({ plan, isNew: false });
                                }}
                                className="p-5 bg-zinc-800 text-zinc-500 rounded-2xl hover:bg-white hover:text-black shadow-xl transition-all"
                              ><Edit3 size={24}/></button>
                              <button 
                                onClick={() => { 
                                  setInputModal({
                                    title: 'BORRAR ATLETA',
                                    placeholder: 'Escribe "CONFIRMAR"',
                                    callback: (v) => {
                                      if (v.toLowerCase() === 'confirmar') {
                                        DataEngine.deleteUser(u.id);
                                        sync();
                                        notify("REGISTRO ELIMINADO");
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

      {/* FOOTER */}
      {currentUser && !trainingWorkout && (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/98 backdrop-blur-3xl border-t border-white/5 px-10 py-8 z-[100] flex justify-around shadow-2xl">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={28}/>} label="STATION" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={28}/>} label="STAFF" />}
          <NavItem active={activeTab === 'stats'} onClick={() => {}} icon={<History size={28}/>} label="HISTORY" />
        </nav>
      )}

      {/* MODAL LIBRERÍA */}
      {showLibrary && (
        <LibraryModal 
          exercises={exercises} 
          onClose={() => setShowLibrary(false)} 
          onAdd={(name) => {
            const newEx: Exercise = { id: `ex-${Date.now()}`, name, muscleGroup: 'Personalizado', videoUrl: '', technique: '', commonErrors: [] };
            DataEngine.saveExercises([...exercises, newEx]);
            sync();
            notify("EJERCICIO CREADO");
          }} 
          onDelete={(id) => {
            DataEngine.saveExercises(exercises.filter(e => e.id !== id));
            sync();
            notify("RECURSO ELIMINADO");
          }}
        />
      )}

      {/* MODAL ENTRADA */}
      {inputModal && (
        <div className="fixed inset-0 z-[550] bg-black/99 flex items-center justify-center p-6 animate-in fade-in">
           <div className="w-full bg-zinc-900 border border-white/10 rounded-[4rem] p-12 space-y-12 shadow-[0_0_200px_rgba(239,68,68,0.4)]">
              <div className="text-center space-y-2">
                 <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.8em] italic">{inputModal.title}</p>
                 <h3 className="text-3xl font-display italic text-white uppercase tracking-tighter">KINETIX COMMAND</h3>
              </div>
              <input 
                autoFocus
                id="elite-input"
                type={inputModal.type || 'text'}
                placeholder={inputModal.placeholder}
                className="w-full bg-zinc-950 border border-zinc-800 p-8 rounded-[2.5rem] text-center text-2xl font-bold outline-none focus:border-red-600 uppercase text-white shadow-inner"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    inputModal.callback((e.target as HTMLInputElement).value);
                    setInputModal(null);
                  }
                  if (e.key === 'Escape') setInputModal(null);
                }}
              />
              <div className="grid grid-cols-2 gap-5">
                 <button onClick={() => setInputModal(null)} className="py-7 bg-zinc-800 rounded-3xl font-black uppercase text-[10px] text-zinc-500">CERRAR</button>
                 <button onClick={() => {
                    const val = (document.getElementById('elite-input') as HTMLInputElement)?.value;
                    inputModal.callback(val);
                    setInputModal(null);
                 }} className="py-7 bg-red-600 rounded-3xl font-black uppercase text-[10px] text-white">CONFIRMAR</button>
              </div>
           </div>
        </div>
      )}

      {/* TOASTS */}
      {toast && (
        <div className="fixed top-12 left-6 right-6 z-[600] animate-in slide-in-from-top">
           <div className={`${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} p-8 rounded-[3rem] flex items-center justify-between shadow-2xl border border-white/10 backdrop-blur-3xl`}>
              <div className="flex items-center gap-6">
                 {toast.type === 'error' ? <ShieldAlert className="text-white" size={32}/> : <CheckCircle2 className="text-white" size={32}/>}
                 <p className="text-[11px] font-black uppercase tracking-widest text-white italic">{toast.msg}</p>
              </div>
              <button onClick={() => setToast(null)} className="p-3 bg-white/20 rounded-full text-white"><X size={16}/></button>
           </div>
        </div>
      )}

      {/* SESIÓN Y EDITOR */}
      {trainingWorkout && <TrainingSession logo={logo} workout={trainingWorkout} exercises={exercises} userId={currentUser?.id || ''} notify={notify} onClose={(did, log) => { if(did && log) { DataEngine.saveLog(log); sync(); } setTrainingWorkout(null); }} logs={myLogs} />}
      {editingPlan && <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={(p: Plan) => { DataEngine.savePlan(p); sync(); setEditingPlan(null); notify("PROTOCOLO SINCRONIZADO"); }} onCancel={() => setEditingPlan(null)} loading={loading} />}
    </div>
  );
}

// COMPONENTES AUXILIARES CONMEMORIZADOS PARA MÁXIMO RENDIMIENTO
const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-4 rounded-3xl transition-all ${active ? 'bg-red-600/15 scale-110 border border-red-600/30' : ''}`}>{icon}</div>
    <span className={`text-[9px] font-black uppercase tracking-[0.6em] ${active ? 'opacity-100' : 'opacity-30'}`}>{label}</span>
  </button>
));

const LibraryModal = memo(({ exercises, onClose, onAdd, onDelete }: any) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const muscleGroups = useMemo(() => ['All', ...new Set(exercises.map((e:any) => e.muscleGroup))], [exercises]);
  const filtered = exercises.filter((ex:any) => 
    (filter === 'All' || ex.muscleGroup === filter) &&
    ex.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="fixed inset-0 z-[450] bg-black/98 flex flex-col p-8 animate-in slide-in-from-right overflow-hidden">
       <header className="flex justify-between items-center mb-10">
          <div className="text-left">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.5em] mb-1 italic">RESOURCE REPOSITORY</p>
            <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none italic">LIBRERÍA</h3>
          </div>
          <button onClick={onClose} className="bg-zinc-900 p-6 rounded-full text-white"><X size={32}/></button>
       </header>
       <div className="space-y-6 mb-10">
          <div className="relative">
             <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-zinc-600" size={20} />
             <input value={search} onChange={e => setSearch(e.target.value)} placeholder="FILTRAR RECURSOS..." className="w-full bg-zinc-900/50 border border-zinc-800 p-7 pl-16 rounded-[2rem] outline-none text-white font-bold" />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
             {muscleGroups.map(m => (
               <button key={m as string} onClick={() => setFilter(m as string)} className={`px-6 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest whitespace-nowrap transition-all border ${filter === m ? 'bg-red-600 text-white border-red-600 shadow-xl' : 'bg-zinc-900 text-zinc-600 border-zinc-800'}`}>{m as string}</button>
             ))}
          </div>
       </div>
       <button onClick={() => {
         const name = prompt("NOMBRE DEL EJERCICIO:");
         if(name) onAdd(name);
       }} className="w-full py-8 bg-cyan-600/10 text-cyan-400 rounded-[2.5rem] border border-cyan-400/20 font-black uppercase text-xs mb-8 flex items-center justify-center gap-4 italic">+ NUEVO RECURSO TÉCNICO</button>
       <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-24">
          {filtered.map((ex: any) => (
            <div key={ex.id} className="p-8 bg-zinc-900/40 rounded-[3rem] border border-white/5 flex items-center justify-between group shadow-lg border-l-2 border-l-zinc-800">
               <div className="text-left">
                  <p className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none mb-2 italic">{ex.name}</p>
                  <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{ex.muscleGroup}</p>
               </div>
               <div className="flex gap-2">
                  {ex.videoUrl && <a href={ex.videoUrl} target="_blank" className="p-4 bg-red-600/10 text-red-600 rounded-2xl border border-red-600/20"><Video size={20}/></a>}
                  <button onClick={() => onDelete(ex.id)} className="p-4 bg-zinc-800 text-zinc-600 rounded-2xl hover:text-red-500 transition-all"><Trash2 size={20}/></button>
               </div>
            </div>
          ))}
       </div>
    </div>
  );
});

const TrainingSession = memo(({ workout, exercises, userId, notify, onClose, logo, logs }: any) => {
  const [sessionLogs, setSessionLogs] = useState<any>(workout.exercises.map((ex:any) => ({
    exerciseId: ex.exerciseId,
    sets: Array.from({ length: ex.targetSets || 4 }).map(() => ({ weight: 0, reps: 0, done: false }))
  })));
  const [timer, setTimer] = useState<number | null>(null);
  const timerRef = useRef<any>(null);
  const startTimer = (seconds: number = 60) => {
    if(timerRef.current) clearInterval(timerRef.current);
    setTimer(seconds);
    timerRef.current = setInterval(() => {
      setTimer(t => {
        if(t !== null && t <= 1) { clearInterval(timerRef.current); return null; }
        return t !== null ? t - 1 : null;
      });
    }, 1000);
  };
  const updateSet = (exIdx: number, setIdx: number, field: string, val: any) => {
    const nl = [...sessionLogs];
    nl[exIdx].sets[setIdx][field] = val;
    setSessionLogs(nl);
    if(field === 'done' && val === true) startTimer();
  };
  const getLastPerformance = (exId: string) => {
    const lastSession = logs.find((l:any) => l.exercisesData.some((ed:any) => ed.exerciseId === exId));
    if(!lastSession) return null;
    const exData = lastSession.exercisesData.find((ed:any) => ed.exerciseId === exId);
    const maxWeight = Math.max(...(exData?.sets.map((s:any) => s.weight) || [0]));
    return { weight: maxWeight, date: new Date(lastSession.date).toLocaleDateString() };
  };
  return (
    <div className="fixed inset-0 z-[300] bg-[#050507] flex flex-col animate-in slide-in-from-bottom overflow-y-auto pb-40 no-scrollbar">
       <header className="p-10 flex justify-between items-center sticky top-0 bg-[#050507]/98 backdrop-blur-2xl z-10 border-b border-zinc-900 shadow-2xl">
          <div className="text-left flex items-center gap-4">
             <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center"><img src={logo} className="w-8 h-8 object-contain" /></div>
             <div>
               <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.5em] mb-1">PROTOCOLO ACTIVO</span>
               <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none italic">{workout.name}</h3>
             </div>
          </div>
          <div className="flex items-center gap-4">
             {timer !== null && (
               <div className="bg-red-600/10 border border-red-600/40 px-6 py-4 rounded-[2rem] flex items-center gap-4 animate-pulse">
                  <Clock size={20} className="text-red-600" />
                  <span className="text-2xl font-display italic text-red-600 leading-none">{timer}s</span>
               </div>
             )}
             <button onClick={() => onClose(false)} className="bg-zinc-900 p-7 rounded-full text-zinc-500 shadow-xl"><X size={36}/></button>
          </div>
       </header>
       <div className="p-8 space-y-16 mt-8">
          {workout.exercises.map((ex: any, exIdx: number) => {
            const exInfo = exercises.find((e:any) => e.id === ex.exerciseId);
            const lastPerf = getLastPerformance(ex.exerciseId);
            return (
              <div key={exIdx} className="space-y-10 text-left border-l-4 border-red-600 pl-10 animate-in slide-in-from-left">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none italic">{exInfo?.name || ex.name}</h4>
                      {lastPerf && <p className="text-[9px] text-cyan-400 font-black uppercase tracking-widest mt-2">PR: {lastPerf.weight}KG ({lastPerf.date})</p>}
                    </div>
                    {exInfo?.videoUrl && <a href={exInfo.videoUrl} target="_blank" className="text-red-600 p-2 bg-red-600/5 rounded-xl border border-red-600/10"><Video size={28}/></a>}
                  </div>
                  {ex.coachCue && <div className="bg-cyan-500/10 p-6 rounded-[2.5rem] border border-cyan-500/20 flex gap-5 items-center">
                    <Sparkles size={20} className="text-cyan-400 shrink-0" />
                    <p className="text-[11px] text-cyan-100 italic leading-relaxed">{ex.coachCue}</p>
                  </div>}
                </div>
                <div className="grid gap-5">
                   {sessionLogs[exIdx].sets.map((set: any, setIdx: number) => (
                     <div key={setIdx} className={`p-8 rounded-[3.5rem] border transition-all flex items-center justify-between gap-10 ${set.done ? 'bg-green-600/10 border-green-500/30 shadow-xl' : 'bg-zinc-900/40 border-white/5'}`}>
                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-display italic text-4xl ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-800 border border-white/5'}`}>{setIdx + 1}</div>
                        <div className="flex-1 flex gap-6">
                           <div className="flex-1 text-center space-y-3">
                              <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em]">KG</p>
                              <input type="number" placeholder="--" value={set.weight || ''} onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-7 rounded-3xl text-center text-white text-3xl font-bold shadow-inner" />
                           </div>
                           <div className="flex-1 text-center space-y-3">
                              <p className="text-[10px] text-zinc-700 font-black uppercase tracking-[0.3em]">REPS</p>
                              <input type="number" placeholder="--" value={set.reps || ''} onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-7 rounded-3xl text-center text-white text-3xl font-bold shadow-inner" />
                           </div>
                        </div>
                        <button onClick={() => updateSet(exIdx, setIdx, 'done', !set.done)} className={`p-9 rounded-[2rem] transition-all shadow-2xl ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-800 border border-white/5'}`}><Check size={36}/></button>
                     </div>
                   ))}
                </div>
              </div>
            );
          })}
          <button onClick={() => { notify("PROTOCOLO FINALIZADO"); onClose(true, { id: `log-${Date.now()}`, userId, workoutId: workout.id, date: new Date().toISOString(), exercisesData: sessionLogs }); }} className="w-full py-16 bg-red-600 rounded-[5rem] font-display italic text-4xl uppercase text-white shadow-[0_30px_70px_rgba(239,68,68,0.5)] mt-20 mb-32 italic">FINALIZAR ENTRENAMIENTO</button>
       </div>
    </div>
  );
});

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel, loading }: any) => {
  const [local, setLocal] = useState<Plan>(() => JSON.parse(JSON.stringify(plan)));
  const [picker, setPicker] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');
  const muscleGroups = useMemo(() => ['All', ...new Set(allExercises.map((e:any) => e.muscleGroup))], [allExercises]);
  const filtered = allExercises.filter((ex:any) => 
    (filter === 'All' || ex.muscleGroup === filter) &&
    ex.name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="fixed inset-0 bg-[#050507] z-[350] p-10 flex flex-col animate-in slide-in-from-right overflow-y-auto pb-48 no-scrollbar">
       <header className="flex justify-between items-center mb-16 sticky top-0 bg-[#050507]/95 backdrop-blur-3xl py-8 z-10 border-b border-white/5">
          <button onClick={onCancel} className="bg-zinc-900 p-7 rounded-full text-zinc-500 shadow-xl"><ChevronLeft size={36}/></button>
          <div className="text-center flex-1 px-8 text-left">
             <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.8em] mb-1 italic">EDITOR DE PLAN</p>
             <input value={local.title} onChange={e => setLocal({...local, title: e.target.value})} className="bg-transparent text-3xl font-display italic text-white text-center outline-none uppercase tracking-tighter w-full border-b border-zinc-900 italic" />
          </div>
          <button onClick={() => onSave(local)} disabled={loading} className="bg-red-600 p-7 rounded-full text-white shadow-xl">
            {loading ? <RefreshCw className="animate-spin" size={36}/> : <Save size={36}/>}
          </button>
       </header>
       <div className="space-y-16">
          {local.workouts.map((w, wIdx) => (
             <div key={wIdx} className="bg-zinc-900/30 p-12 rounded-[5rem] border border-white/5 space-y-12 shadow-2xl border-t-2 border-t-red-600/15">
                <div className="flex items-center gap-8">
                  <div className="w-18 h-18 bg-red-600/10 rounded-[2rem] flex items-center justify-center text-red-600 font-display italic text-5xl border border-red-600/20">{wIdx + 1}</div>
                  <input value={w.name} onChange={e => { const nw = [...local.workouts]; nw[wIdx].name = e.target.value; setLocal({...local, workouts: nw}); }} className="bg-transparent border-b border-zinc-800 p-4 text-4xl font-display italic text-white outline-none w-full uppercase italic" />
                  <button onClick={() => { if(window.confirm("¿BORRAR DÍA?")) { const nw = [...local.workouts]; nw.splice(wIdx, 1); setLocal({...local, workouts: nw}); } }} className="text-zinc-800 hover:text-red-500 transition-colors p-4"><Trash2 size={32}/></button>
                </div>
                <div className="space-y-10">
                   {w.exercises.map((ex, exIdx) => (
                     <div key={exIdx} className="p-10 bg-zinc-950/80 rounded-[4rem] border border-white/5 space-y-10 shadow-2xl relative">
                        <div className="flex justify-between items-start">
                           <div className="text-left space-y-1">
                              <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">BLOQUE {exIdx + 1}</p>
                              <span className="text-3xl font-black uppercase text-white tracking-tighter italic">{allExercises.find((e:any) => e.id === ex.exerciseId)?.name || ex.name}</span>
                           </div>
                           <button onClick={() => { const nw = [...local.workouts]; nw[wIdx].exercises.splice(exIdx, 1); setLocal({...local, workouts: nw}); }} className="text-zinc-800 hover:text-red-600"><X size={28}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                           <div className="text-center space-y-4">
                             <label className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">SERIES</label>
                             <input value={ex.targetSets} type="number" onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].targetSets = parseInt(e.target.value) || 0; setLocal({...local, workouts: nw}); }} className="w-full bg-zinc-900 border border-zinc-800 p-7 rounded-[2.5rem] text-white font-bold text-center text-4xl" />
                           </div>
                           <div className="text-center space-y-4">
                             <label className="text-[10px] font-black text-zinc-700 uppercase tracking-widest">REPS</label>
                             <input value={ex.targetReps} onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].targetReps = e.target.value; setLocal({...local, workouts: nw}); }} className="w-full bg-zinc-900 border border-zinc-800 p-7 rounded-[2.5rem] text-white font-bold text-center text-4xl" />
                           </div>
                        </div>
                        <textarea 
                          value={ex.coachCue || ''} 
                          onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].coachCue = e.target.value; setLocal({...local, workouts: nw}); }} 
                          placeholder="Instrucciones del Coach..." 
                          className="w-full bg-zinc-900/40 border border-zinc-800 p-8 rounded-[3rem] text-[12px] text-zinc-300 outline-none italic resize-none h-28 focus:border-cyan-500/30 shadow-inner" 
                        />
                     </div>
                   ))}
                   <button onClick={() => setPicker(wIdx)} className="w-full py-14 border-2 border-dashed border-zinc-800 rounded-[4rem] text-[10px] font-black text-zinc-700 uppercase tracking-[0.4em] bg-zinc-950/20 shadow-2xl">+ AÑADIR EJERCICIO</button>
                </div>
             </div>
          ))}
          <button onClick={() => setLocal({...local, workouts: [...local.workouts, { id: `w-${Date.now()}`, name: `DÍA ${local.workouts.length+1}`, day: local.workouts.length+1, exercises: [] }]})} className="w-full py-20 border-2 border-dashed border-zinc-800 rounded-[6rem] text-xs font-black text-zinc-800 uppercase flex items-center justify-center gap-8 shadow-2xl italic"><Plus size={64}/> AÑADIR DÍA SEMANAL</button>
       </div>
       {picker !== null && (
         <div className="fixed inset-0 z-[500] bg-black/99 backdrop-blur-3xl p-10 flex flex-col animate-in slide-in-from-bottom">
            <header className="flex justify-between items-center mb-12">
              <div className="text-left">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.6em] mb-1 italic">PICKER</p>
                <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter italic">LIBRERÍA</h3>
              </div>
              <button onClick={() => setPicker(null)} className="bg-zinc-900 p-8 rounded-full text-white shadow-2xl"><X size={40}/></button>
            </header>
            <div className="space-y-6 mb-10">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="BUSCAR..." className="w-full bg-zinc-900/50 border border-zinc-800 p-8 rounded-[2.5rem] text-white" />
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                 {muscleGroups.map(m => (
                   <button key={m as string} onClick={() => setFilter(m as string)} className={`px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${filter === m ? 'bg-red-600 border-red-600 text-white' : 'bg-zinc-900 border-zinc-800 text-zinc-600'}`}>{m as string}</button>
                 ))}
              </div>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto no-scrollbar pb-32">
              {filtered.map((ex: any) => (
                <div key={ex.id} onClick={() => {
                   const nw = [...local.workouts];
                   nw[picker].exercises.push({ exerciseId: ex.id, name: ex.name, targetSets: 4, targetReps: "10-12", coachCue: "" });
                   setLocal({...local, workouts: nw});
                   setPicker(null);
                }} className="p-10 bg-zinc-900/40 border border-white/5 rounded-[4rem] flex justify-between items-center group shadow-2xl hover:bg-zinc-900/60 transition-all">
                  <div className="space-y-1">
                    <p className="font-black text-white uppercase italic text-3xl tracking-tighter group-hover:text-red-600 italic">{ex.name}</p>
                    <p className="text-[9px] text-zinc-600 font-black uppercase tracking-widest">{ex.muscleGroup}</p>
                  </div>
                  <div className="bg-zinc-950 p-7 rounded-3xl group-hover:bg-red-600 transition-all shadow-lg">
                    <Plus size={36} className="text-zinc-800 group-hover:text-white" />
                  </div>
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
});
