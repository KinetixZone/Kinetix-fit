import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer, Download, Upload, Filter, Clock, Database, FileJson, Cloud, CloudOff,
  Wifi, WifiOff, AlertTriangle
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, WorkoutLog } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './services/geminiService';
import { supabase, supabaseConnectionStatus } from './services/supabaseClient';

// --- UTILS ---
const generateUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const isUUID = (str: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
};

// ID FIJO PARA EL HEAD COACH (UUID VÁLIDO PARA SUPABASE)
const COACH_UUID = '99999999-9999-9999-9999-999999999999';

// --- KINETIX HYBRID ENGINE V16.0 (CLOUD FIRST) ---
const STORAGE_KEY = 'KINETIX_CLOUD_SYNC_V1';
const SESSION_KEY = 'KINETIX_ACTIVE_SESSION_V2';

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
  getPlan: (uid: string): Plan | null => {
    const p = DataEngine.getStore()[`PLAN_${uid}`];
    return p ? JSON.parse(p) : null;
  },
  getLogs: (uid: string): WorkoutLog[] => {
    const l = DataEngine.getStore()[`LOGS_${uid}`];
    return l ? JSON.parse(l) : [];
  },

  // FUNCIÓN CRÍTICA: DESCARGA TODO DE LA NUBE Y ACTUALIZA EL CELULAR
  pullFromCloud: async () => {
    if (!supabaseConnectionStatus.isConfigured) return false;
    console.log("KINETIX: INICIANDO SINCRONIZACIÓN CLOUD...");
    
    try {
      const s = DataEngine.getStore();
      
      // 1. USUARIOS: La verdad absoluta está en la nube
      const { data: users, error: uErr } = await supabase.from('users').select('*');
      
      if (users && !uErr) {
        const dbUsersFormatted = users.map(u => ({
             id: u.id,
             name: u.name,
             email: u.email,
             role: u.role,
             goal: u.goal,
             level: u.level,
             daysPerWeek: u.days_per_week,
             equipment: u.equipment || [],
             streak: u.streak,
             createdAt: u.created_at
        }));
        // Guardamos TODOS los usuarios de la nube en local
        s.USERS = JSON.stringify(dbUsersFormatted);
      }

      // 2. PLANES: Descargar TODOS los planes (para que el Coach los vea todos)
      const { data: plans, error: pErr } = await supabase.from('plans').select('*, workouts(*, workout_exercises(*))');
      
      if (plans && !pErr) {
        plans.forEach((p: any) => {
          const fullPlan: Plan = {
            id: p.id,
            title: p.title,
            userId: p.user_id,
            updatedAt: p.updated_at,
            workouts: p.workouts.map((w: any) => ({
              id: w.id,
              name: w.name,
              day: w.day_number,
              exercises: w.workout_exercises.map((we: any) => ({
                exerciseId: we.exercise_id,
                name: '', // Se llena dinámicamente en render
                targetSets: we.target_sets,
                targetReps: we.target_reps,
                coachCue: we.coach_cue
              }))
            })).sort((a:any, b:any) => a.day - b.day)
          };
          // Guardar plan en memoria local del dispositivo
          s[`PLAN_${p.user_id}`] = JSON.stringify(fullPlan);
        });
      }

      // 3. EJERCICIOS
      const { data: exercises, error: eErr } = await supabase.from('exercises').select('*');
      if (exercises && !eErr && exercises.length > 0) {
        s.EXERCISES = JSON.stringify(exercises);
      }

      // GUARDAR TODO EN LOCALSTORAGE DE GOLPE
      DataEngine.saveStore(s);
      return true;
    } catch (e) {
      console.error("Cloud Pull Error", e);
      return false;
    }
  },

  saveUser: async (user: User) => {
    // 1. Guardar Local
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    s.USERS = JSON.stringify(users);
    DataEngine.saveStore(s);

    if (!isUUID(user.id)) return; // No intentar subir si ID es inválido

    // 2. Guardar Nube (Upsert)
    try {
      await supabase.from('users').upsert({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        goal: user.goal,
        level: user.level,
        days_per_week: user.daysPerWeek,
        equipment: user.equipment,
        streak: user.streak
      });
    } catch (e) { console.error("Error guardando usuario en nube", e); }
  },

  savePlan: async (p: Plan) => {
    // 1. Guardar Local
    const s = DataEngine.getStore();
    s[`PLAN_${p.userId}`] = JSON.stringify(p);
    DataEngine.saveStore(s);
    
    if (!isUUID(p.userId)) return;

    // 2. Guardar Nube
    try {
      const planUUID = isUUID(p.id) ? p.id : undefined;
      
      const { data: planData, error: pErr } = await supabase.from('plans').upsert({
        id: planUUID,
        title: p.title,
        user_id: p.userId,
        updated_at: new Date().toISOString()
      }).select().single();

      if (pErr) throw pErr;

      if (planData) {
        // Borrar workouts viejos para reescribir limpio
        await supabase.from('workouts').delete().eq('plan_id', planData.id);
        
        for (const w of p.workouts) {
          const { data: wData } = await supabase.from('workouts').insert({
            plan_id: planData.id,
            name: w.name,
            day_number: w.day
          }).select().single();
          
          if (wData) {
            const exercisesPayload = w.exercises.map(we => ({
              workout_id: wData.id,
              exercise_id: we.exerciseId,
              target_sets: we.targetSets,
              target_reps: we.targetReps,
              coach_cue: we.coachCue
            }));
            if (exercisesPayload.length > 0) {
              await supabase.from('workout_exercises').insert(exercisesPayload);
            }
          }
        }
      }
    } catch (e) { console.error("Cloud Plan Save Error", e); }
  },

  saveLog: async (l: WorkoutLog) => {
    const s = DataEngine.getStore();
    const logs = DataEngine.getLogs(l.userId);
    s[`LOGS_${l.userId}`] = JSON.stringify([l, ...logs]);
    DataEngine.saveStore(s);

    if (!isUUID(l.userId)) return;

    try {
      const { data: logData } = await supabase.from('workout_logs').insert({
        user_id: l.userId,
        workout_id: isUUID(l.workoutId) ? l.workoutId : null,
        date: l.date
      }).select().single();

      if (logData) {
        const setsPayload: any[] = [];
        l.exercisesData.forEach(ex => {
          ex.sets.forEach(set => {
            setsPayload.push({
              log_id: logData.id,
              exercise_id: ex.exerciseId,
              weight: set.weight,
              reps: set.reps,
              done: set.done
            });
          });
        });
        await supabase.from('set_logs').insert(setsPayload);
      }
    } catch (e) { console.error("Cloud Log Save Error", e); }
  },

  deleteUser: (uid: string) => {
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const filtered = users.filter((u: any) => u.id !== uid);
    s.USERS = JSON.stringify(filtered);
    delete s[`PLAN_${uid}`];
    DataEngine.saveStore(s);
    if (isUUID(uid)) {
      supabase.from('users').delete().eq('id', uid).then(({error}) => { if(error) console.error(error); });
    }
  },

  saveLogo: (url: string) => {
    const s = DataEngine.getStore();
    s.LOGO_URL = url;
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
  const [syncing, setSyncing] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [trainingWorkout, setTrainingWorkout] = useState<Workout | null>(null);
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);

  const [inputModal, setInputModal] = useState<{title: string, placeholder: string, type?: string, callback: (v: string) => void} | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'error' | 'success'} | null>(null);

  const notify = useCallback((msg: string, type: 'error' | 'success' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Compute chart data from logs
  const chartData = useMemo(() => {
    if (!myLogs || myLogs.length === 0) return [];
    
    // Create data points
    const dataPoints = myLogs.map(log => {
      const dateObj = new Date(log.date);
      // Volume = sum of (weight > 0 ? weight : 1) * reps for all done sets
      const vol = log.exercisesData.reduce((acc, ex) => {
        return acc + ex.sets.reduce((sAcc, s) => {
          return sAcc + (s.done ? (Math.max(s.weight, 1) * s.reps) : 0);
        }, 0);
      }, 0);
      return { dateObj, vol };
    });

    // Sort chronologically
    dataPoints.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

    // Format for Recharts
    return dataPoints.map(p => ({
      date: `${p.dateObj.getDate()}/${p.dateObj.getMonth() + 1}`,
      vol: Math.round(p.vol)
    }));
  }, [myLogs]);

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

  // INIT
  useEffect(() => {
    DataEngine.init();
    
    if (supabaseConnectionStatus.isConfigured) {
      supabase.from('users').select('count', { count: 'exact', head: true })
        .then(({ error }) => setDbConnected(!error))
        .catch(() => setDbConnected(false));
    }

    // CARGA INICIAL
    const boot = async () => {
       await DataEngine.pullFromCloud(); // Intentar traer datos frescos al abrir
       setAllUsers(DataEngine.getUsers());
       setExercises(DataEngine.getExercises());
       
       const saved = localStorage.getItem(SESSION_KEY);
       if (saved) {
         const user = JSON.parse(saved);
         setCurrentUser(user);
         setActiveTab(user.role === 'coach' ? 'admin' : 'home');
       }
       setIsReady(true);
    };
    boot();
  }, []);

  useEffect(() => { sync(); }, [sync]);

  // --- LOGIN ATLETA (CLOUD FIRST) ---
  const handleLogin = async () => {
    const input = loginName.trim().toLowerCase();
    if (!input) return;
    setLoading(true);

    // 1. Forzar búsqueda en nube primero
    notify("BUSCANDO EN LA RED KINETIX...");
    await DataEngine.pullFromCloud();

    // 2. Buscar en datos actualizados
    let found = DataEngine.getUsers().find((u: User) => u.name.toLowerCase().includes(input));
    
    // 3. Fallback directo a Supabase por si pullFromCloud falló parcialmente
    if (!found && supabaseConnectionStatus.isConfigured) {
       const { data } = await supabase.from('users').select('*').ilike('name', `%${input}%`).single();
       if (data) {
          found = {
             id: data.id,
             name: data.name,
             email: data.email,
             role: data.role,
             goal: data.goal,
             level: data.level,
             daysPerWeek: data.days_per_week,
             equipment: data.equipment || [],
             streak: data.streak,
             createdAt: data.created_at
          };
          DataEngine.saveUser(found); // Guardar para futuro
          // Intentar traer su plan también
          await DataEngine.pullFromCloud(); 
       }
    }

    setLoading(false);

    if (found) {
      setCurrentUser(found);
      localStorage.setItem(SESSION_KEY, JSON.stringify(found));
      notify(`BIENVENIDO, ${found.name.toUpperCase()}`);
      setActiveTab('home');
    } else {
      notify("ATLETA NO ENCONTRADO EN LA BASE DE DATOS", 'error');
    }
  };

  if (!isReady) return <div className="min-h-screen bg-[#050507] flex items-center justify-center"><RefreshCw className="animate-spin text-red-600" size={40}/></div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100 font-sans selection:bg-red-600/30 overflow-x-hidden">
      <header className="p-6 flex justify-between items-center bg-zinc-950/90 backdrop-blur-3xl sticky top-0 z-[100] border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)]">
             <img src={logo} className="w-7 h-7 object-contain" alt="K" />
          </div>
          <div className="flex flex-col">
            <span className="font-display italic text-2xl uppercase text-white tracking-tighter leading-none neon-red">KINETIX</span>
            <div className="flex items-center gap-2">
               <span className="text-[7px] font-black text-zinc-500 uppercase tracking-[0.4em]">STATION {syncing ? 'SYNCING...' : 'ONLINE'}</span>
               {syncing && <RefreshCw size={8} className="animate-spin text-red-600"/>}
            </div>
          </div>
        </div>
        {currentUser && (
          <button onClick={() => { setCurrentUser(null); localStorage.removeItem(SESSION_KEY); setLoginName(''); setActiveTab('home'); }} className="bg-zinc-900 p-3 rounded-2xl text-zinc-600 hover:text-red-600 border border-white/5 transition-all">
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
                    disabled={loading}
                    className="w-full bg-red-600 py-8 rounded-[3rem] font-display italic text-3xl uppercase text-white shadow-[0_20px_50px_rgba(239,68,68,0.4)] active:scale-95 transition-all flex items-center justify-center gap-4"
                  >
                    {loading ? <RefreshCw className="animate-spin"/> : 'IDENTIFICARSE'}
                  </button>
                  
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex justify-center items-center gap-3">
                       <span className={`w-2 h-2 rounded-full ${dbConnected ? 'bg-green-500 shadow-[0_0_10px_#22c55e]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'}`}></span>
                       <span className="text-[10px] font-black uppercase text-zinc-600 tracking-widest">
                         {supabaseConnectionStatus.isConfigured ? (dbConnected ? 'CLOUD CONNECTED' : 'CLOUD UNREACHABLE') : 'MISSING API KEYS'}
                       </span>
                    </div>
                  </div>
                </div>
             </div>
             <button 
               onClick={() => setInputModal({
                 title: 'ACCESO STAFF',
                 placeholder: 'PIN MAESTRO',
                 type: 'password',
                 callback: async (pin) => {
                   if (pin === 'KINETIX2025') {
                     const coach: User = { 
                       id: COACH_UUID, // UUID FIJO
                       name: 'HEAD COACH', email: 'staff@kinetix.com',
                       role: 'coach', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED,
                       daysPerWeek: 7, equipment: ['Full Box'], streak: 100, createdAt: new Date().toISOString()
                     };
                     
                     notify("CONECTANDO A BASE DE DATOS...");
                     setLoading(true);
                     
                     // 1. ASEGURAR QUE COACH EXISTE EN NUBE
                     await DataEngine.saveUser(coach);
                     
                     // 2. DESCARGAR ABSOLUTAMENTE TODO (Usuarios y Planes creados en PC)
                     await DataEngine.pullFromCloud();
                     
                     setLoading(false);
                     setCurrentUser(coach);
                     localStorage.setItem(SESSION_KEY, JSON.stringify(coach));
                     setActiveTab('admin');
                     notify("SINCRONIZACIÓN STAFF COMPLETA");
                   } else notify("PIN INCORRECTO", 'error');
                 }
               })}
               className="text-[10px] font-black text-zinc-800 uppercase tracking-[0.5em] hover:text-red-600 flex items-center gap-2 transition-colors"
             >
               <Lock size={12}/> STAFF LOGIN
             </button>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-8 duration-500">
            {activeTab === 'home' && (
              <div className="space-y-10">
                <header className="text-left">
                   <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-1">DATA PERFORMANCE</p>
                   <h2 className="text-6xl font-display italic text-white uppercase leading-none tracking-tighter italic">
                     HOLA, <span className="text-red-600">{currentUser.name.split(' ')[0]}</span>
                   </h2>
                   {!isUUID(currentUser.id) && (
                     <p className="text-[9px] text-yellow-500 font-bold mt-2 flex items-center gap-2"><AlertTriangle size={10}/> CUENTA LOCAL - CONTACTA AL COACH</p>
                   )}
                </header>
                <div className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 space-y-8 shadow-2xl relative overflow-hidden">
                   <div className="flex justify-between items-center relative z-10">
                      <div className="text-left">
                        <p className="text-[10px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-2"><Activity size={14}/> VOLUMEN SEMANAL</p>
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
                           <p className="text-[9px] font-black uppercase tracking-widest text-center italic">PENDIENTE DE TU PRIMERA SESIÓN</p>
                        </div>
                      )}
                   </div>
                </div>
                <div className="space-y-6 pb-12 text-left">
                  <div className="flex justify-between items-center px-4">
                     <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest italic">PROTOCOLO ACTIVO</p>
                     <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">{myPlan?.title || 'SIN PROGRAMA'}</p>
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
                              <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.2em]">{w.exercises.length} BLOQUES TÉCNICOS</p>
                           </div>
                        </div>
                        <div className="bg-zinc-950 p-5 rounded-2xl group-hover:bg-red-600 transition-all text-zinc-800 group-hover:text-white shadow-xl"><Play size={24}/></div>
                      </button>
                    ))}
                    {!myPlan && (
                      <div className="py-16 bg-zinc-900/10 border-2 border-dashed border-zinc-800 rounded-[4rem] text-center space-y-4">
                         <ShieldAlert size={40} className="mx-auto text-zinc-800" />
                         <p className="text-[11px] text-zinc-700 font-black uppercase tracking-widest px-10">SOLICITA TU PLAN IA AL HEAD COACH</p>
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
                    <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.4em]">STATION COMMAND CENTER</p>
                    <h2 className="text-7xl font-display italic text-red-600 uppercase tracking-tighter leading-none italic">COACH</h2>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                       setLoading(true);
                       await DataEngine.pullFromCloud();
                       sync();
                       setLoading(false);
                       notify("DATOS SINCRONIZADOS");
                    }} className="bg-zinc-900 p-6 rounded-[2rem] text-zinc-400 border border-zinc-800 hover:text-white shadow-xl transition-all">
                      <RefreshCw className={loading ? 'animate-spin' : ''} size={28}/>
                    </button>
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
                            const u: User = { 
                              ...MOCK_USER, 
                              id: generateUUID(), 
                              name, 
                              streak: 0, 
                              createdAt: new Date().toISOString() 
                            };
                            DataEngine.saveUser(u);
                            sync();
                            notify("ATLETA REGISTRADO EN NUBE");
                          }
                        })}
                        className="bg-red-600 text-white px-5 py-3 rounded-2xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg"
                      ><Plus size={16}/> REGISTRAR</button>
                   </div>
                   <div className="grid gap-4">
                      {allUsers.filter(u => u.role !== 'coach').map(u => (
                        <div key={u.id} className="bg-zinc-900/40 p-8 rounded-[3.5rem] border border-white/5 flex items-center justify-between group shadow-xl">
                           <div className="text-left space-y-2">
                              <h4 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none">{u.name}</h4>
                              <span className="text-[9px] text-zinc-700 font-black uppercase px-3 py-1 bg-zinc-950 rounded-xl border border-white/5">{u.level}</span>
                           </div>
                           <div className="flex gap-2">
                              <button 
                                onClick={async () => {
                                  setLoading(true);
                                  try {
                                    const res = await generateSmartRoutine(u);
                                    setEditingPlan({ 
                                      plan: { 
                                        ...res, 
                                        id: generateUUID(), 
                                        userId: u.id, 
                                        updatedAt: new Date().toISOString() 
                                      }, 
                                      isNew: true 
                                    });
                                  } catch (e: any) { notify(e.message, 'error'); }
                                  finally { setLoading(false); }
                                }}
                                className="p-5 bg-red-600/10 text-red-600 rounded-2xl border border-red-600/20 hover:bg-red-600 hover:text-white transition-all"
                              ><Sparkles size={24}/></button>
                              <button 
                                onClick={() => {
                                  const plan = DataEngine.getPlan(u.id) || { 
                                    id: generateUUID(), 
                                    userId: u.id, 
                                    title: 'KINETIX ELITE PROTOCOL', 
                                    workouts: [], 
                                    updatedAt: new Date().toISOString() 
                                  };
                                  setEditingPlan({ plan, isNew: false });
                                }}
                                className="p-5 bg-zinc-800 text-zinc-500 rounded-2xl hover:bg-white hover:text-black transition-all"
                              ><Edit3 size={24}/></button>
                              <button 
                                onClick={() => { if(window.confirm("¿BORRAR ATLETA?")) { DataEngine.deleteUser(u.id); sync(); notify("REGISTRO ELIMINADO"); } }}
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

      {currentUser && !trainingWorkout && (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/98 backdrop-blur-3xl border-t border-white/5 px-10 py-8 z-[100] flex justify-around shadow-2xl">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={28}/>} label="STATION" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={28}/>} label="STAFF" />}
          <NavItem active={activeTab === 'history'} onClick={() => {}} icon={<History size={28}/>} label="HISTORY" />
        </nav>
      )}

      {inputModal && (
        <div className="fixed inset-0 z-[550] bg-black/99 flex items-center justify-center p-6 animate-in fade-in">
           <div className="w-full bg-zinc-900 border border-white/10 rounded-[4rem] p-12 space-y-12 shadow-[0_0_200px_rgba(239,68,68,0.4)]">
              <div className="text-center space-y-2">
                 <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.8em] italic">{inputModal.title}</p>
                 <h3 className="text-3xl font-display italic text-white uppercase tracking-tighter">KINETIX COMMAND</h3>
              </div>
              <input 
                autoFocus
                type={inputModal.type || 'text'}
                placeholder={inputModal.placeholder}
                className="w-full bg-zinc-950 border border-zinc-800 p-8 rounded-[2.5rem] text-center text-2xl font-bold outline-none focus:border-red-600 uppercase text-white shadow-inner"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    inputModal.callback((e.target as HTMLInputElement).value);
                    setInputModal(null);
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-5">
                 <button onClick={() => setInputModal(null)} className="py-7 bg-zinc-800 rounded-3xl font-black uppercase text-[10px] text-zinc-500">CERRAR</button>
                 <button onClick={() => {
                    const val = (document.querySelector('input') as HTMLInputElement)?.value;
                    inputModal.callback(val);
                    setInputModal(null);
                 }} className="py-7 bg-red-600 rounded-3xl font-black uppercase text-[10px] text-white">CONFIRMAR</button>
              </div>
           </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-12 left-6 right-6 z-[600] animate-in slide-in-from-top">
           <div className={`${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} p-8 rounded-[3rem] flex items-center justify-between shadow-2xl border border-white/10 backdrop-blur-3xl`}>
              <p className="text-[11px] font-black uppercase tracking-widest text-white italic">{toast.msg}</p>
              <button onClick={() => setToast(null)} className="p-3 bg-white/20 rounded-full text-white"><X size={16}/></button>
           </div>
        </div>
      )}

      {trainingWorkout && <TrainingSession logo={logo} workout={trainingWorkout} exercises={exercises} userId={currentUser?.id || ''} notify={notify} onClose={(did, log) => { if(did && log) { DataEngine.saveLog(log); sync(); } setTrainingWorkout(null); }} logs={myLogs} />}
      {editingPlan && <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={(p: Plan) => { DataEngine.savePlan(p); sync(); setEditingPlan(null); notify("PROTOCOLO SINCRONIZADO"); }} onCancel={() => setEditingPlan(null)} loading={loading} />}
    </div>
  );
}

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-4 rounded-3xl transition-all ${active ? 'bg-red-600/15 scale-110 border border-red-600/30' : ''}`}>{icon}</div>
    <span className={`text-[9px] font-black uppercase tracking-[0.6em] ${active ? 'opacity-100' : 'opacity-30'}`}>{label}</span>
  </button>
));

const TrainingSession = memo(({ workout, exercises, userId, notify, onClose, logo, logs }: any) => {
  const [sessionLogs, setSessionLogs] = useState<any>(workout.exercises.map((ex:any) => ({
    exerciseId: ex.exerciseId,
    sets: Array.from({ length: ex.targetSets || 4 }).map(() => ({ weight: 0, reps: 0, done: false }))
  })));
  const updateSet = (exIdx: number, setIdx: number, field: string, val: any) => {
    const nl = [...sessionLogs];
    nl[exIdx].sets[setIdx][field] = val;
    setSessionLogs(nl);
  };
  return (
    <div className="fixed inset-0 z-[300] bg-[#050507] flex flex-col animate-in slide-in-from-bottom overflow-y-auto pb-40 no-scrollbar">
       <header className="p-10 flex justify-between items-center sticky top-0 bg-[#050507]/98 backdrop-blur-2xl z-10 border-b border-zinc-900 shadow-2xl">
          <div className="text-left flex items-center gap-4">
             <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center"><img src={logo} className="w-8 h-8 object-contain" /></div>
             <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none italic">{workout.name}</h3>
          </div>
          <button onClick={() => onClose(false)} className="bg-zinc-900 p-7 rounded-full text-zinc-500 shadow-xl"><X size={36}/></button>
       </header>
       <div className="p-8 space-y-16 mt-8">
          {workout.exercises.map((ex: any, exIdx: number) => {
            const exInfo = exercises.find((e:any) => e.id === ex.exerciseId);
            return (
              <div key={exIdx} className="space-y-10 text-left border-l-4 border-red-600 pl-10">
                <h4 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none italic">{exInfo?.name || ex.name}</h4>
                <div className="grid gap-5">
                   {sessionLogs[exIdx].sets.map((set: any, setIdx: number) => (
                     <div key={setIdx} className={`p-8 rounded-[3.5rem] border transition-all flex items-center justify-between gap-10 ${set.done ? 'bg-green-600/10 border-green-500/30 shadow-xl' : 'bg-zinc-900/40 border-white/5'}`}>
                        <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center font-display italic text-4xl ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-800 border border-white/5'}`}>{setIdx + 1}</div>
                        <div className="flex-1 flex gap-6">
                           <input type="number" placeholder="KG" value={set.weight || ''} onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-7 rounded-3xl text-center text-white text-3xl font-bold shadow-inner" />
                           <input type="number" placeholder="REPS" value={set.reps || ''} onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-7 rounded-3xl text-center text-white text-3xl font-bold shadow-inner" />
                        </div>
                        <button onClick={() => updateSet(exIdx, setIdx, 'done', !set.done)} className={`p-9 rounded-[2rem] transition-all shadow-2xl ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-800 border border-white/5'}`}><Check size={36}/></button>
                     </div>
                   ))}
                </div>
              </div>
            );
          })}
          <button onClick={() => { 
             notify("ENTRENAMIENTO FINALIZADO"); 
             onClose(true, { 
               id: generateUUID(), 
               userId, 
               workoutId: workout.id, 
               date: new Date().toISOString(), 
               exercisesData: sessionLogs 
             }); 
          }} className="w-full py-16 bg-red-600 rounded-[5rem] font-display italic text-4xl uppercase text-white shadow-[0_30px_70px_rgba(239,68,68,0.5)] mt-20 mb-32 italic">FINALIZAR SESIÓN</button>
       </div>
    </div>
  );
});

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel, loading }: any) => {
  const [local, setLocal] = useState<Plan>(() => JSON.parse(JSON.stringify(plan)));
  const [addingExerciseTo, setAddingExerciseTo] = useState<number | null>(null);

  const addExercise = (workoutIdx: number, exercise: Exercise) => {
    const nw = [...local.workouts];
    nw[workoutIdx].exercises.push({
       exerciseId: exercise.id,
       name: exercise.name,
       targetSets: 4,
       targetReps: '10-12',
       coachCue: ''
    });
    setLocal({...local, workouts: nw});
    setAddingExerciseTo(null);
  };

  const removeExercise = (workoutIdx: number, exIdx: number) => {
    const nw = [...local.workouts];
    nw[workoutIdx].exercises.splice(exIdx, 1);
    setLocal({...local, workouts: nw});
  };

  const removeDay = (wIdx: number) => {
    if(!window.confirm("¿ELIMINAR DÍA?")) return;
    const nw = [...local.workouts];
    nw.splice(wIdx, 1);
    // Reordenar días
    nw.forEach((w, i) => w.day = i + 1);
    setLocal({...local, workouts: nw});
  }

  return (
    <div className="fixed inset-0 bg-[#050507] z-[350] p-10 flex flex-col animate-in slide-in-from-right overflow-y-auto pb-48 no-scrollbar">
       <header className="flex justify-between items-center mb-16 sticky top-0 bg-[#050507]/95 backdrop-blur-3xl py-8 z-10 border-b border-white/5">
          <button onClick={onCancel} className="bg-zinc-900 p-7 rounded-full text-zinc-500 shadow-xl"><ChevronLeft size={36}/></button>
          <input value={local.title} onChange={e => setLocal({...local, title: e.target.value})} className="bg-transparent text-3xl font-display italic text-white text-center outline-none uppercase tracking-tighter w-full border-b border-zinc-900 italic" />
          <button onClick={() => onSave(local)} disabled={loading} className="bg-red-600 p-7 rounded-full text-white shadow-xl">
            {loading ? <RefreshCw className="animate-spin" size={36}/> : <Save size={36}/>}
          </button>
       </header>
       <div className="space-y-16">
          {local.workouts.map((w, wIdx) => (
             <div key={wIdx} className="bg-zinc-900/30 p-12 rounded-[5rem] border border-white/5 space-y-12 shadow-2xl relative">
                <button onClick={() => removeDay(wIdx)} className="absolute top-8 right-8 text-zinc-700 hover:text-red-600"><Trash2/></button>
                <input value={w.name} onChange={e => { const nw = [...local.workouts]; nw[wIdx].name = e.target.value; setLocal({...local, workouts: nw}); }} className="bg-transparent border-b border-zinc-800 p-4 text-4xl font-display italic text-white outline-none w-full uppercase italic pr-12" />
                <div className="space-y-10">
                   {w.exercises.map((ex, exIdx) => (
                     <div key={exIdx} className="p-10 bg-zinc-950/80 rounded-[4rem] border border-white/5 space-y-10 shadow-2xl relative group">
                        <button onClick={() => removeExercise(wIdx, exIdx)} className="absolute top-6 right-6 text-zinc-800 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><X/></button>
                        <span className="text-3xl font-black uppercase text-white tracking-tighter italic block pr-10">{allExercises.find((e:any) => e.id === ex.exerciseId)?.name || ex.name}</span>
                        <div className="grid grid-cols-2 gap-8">
                           <div className="space-y-2">
                             <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-2">SETS</span>
                             <input value={ex.targetSets} type="number" onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].targetSets = parseInt(e.target.value) || 0; setLocal({...local, workouts: nw}); }} className="w-full bg-zinc-900 border border-zinc-800 p-7 rounded-[2.5rem] text-white font-bold text-center text-4xl" />
                           </div>
                           <div className="space-y-2">
                             <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest pl-2">REPS</span>
                             <input value={ex.targetReps} onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].targetReps = e.target.value; setLocal({...local, workouts: nw}); }} className="w-full bg-zinc-900 border border-zinc-800 p-7 rounded-[2.5rem] text-white font-bold text-center text-4xl" />
                           </div>
                        </div>
                     </div>
                   ))}
                   <button onClick={() => setAddingExerciseTo(wIdx)} className="w-full py-10 bg-zinc-900 rounded-[3rem] text-xs font-black text-zinc-500 uppercase flex items-center justify-center gap-4 hover:bg-zinc-800 hover:text-white transition-all"><Plus size={20}/> EJERCICIO</button>
                </div>
             </div>
          ))}
          <button onClick={() => setLocal({...local, workouts: [...local.workouts, { 
             id: generateUUID(), 
             name: `DÍA ${local.workouts.length+1}`, 
             day: local.workouts.length+1, 
             exercises: [] 
          }]})} className="w-full py-20 border-2 border-dashed border-zinc-800 rounded-[6rem] text-xs font-black text-zinc-800 uppercase flex items-center justify-center gap-8 shadow-2xl italic"><Plus size={64}/> AÑADIR DÍA</button>
       </div>

       {addingExerciseTo !== null && (
         <div className="fixed inset-0 z-[400] bg-black/95 flex flex-col p-10 animate-in fade-in">
            <header className="flex justify-between items-center mb-10">
               <h3 className="text-3xl font-display italic text-white uppercase">SELECCIONAR</h3>
               <button onClick={() => setAddingExerciseTo(null)} className="p-4 bg-zinc-800 rounded-full"><X/></button>
            </header>
            <div className="grid gap-4 overflow-y-auto pb-20 no-scrollbar">
               {allExercises.map((ex: Exercise) => (
                 <button key={ex.id} onClick={() => addExercise(addingExerciseTo, ex)} className="p-8 bg-zinc-900 rounded-[3rem] text-left hover:bg-zinc-800 hover:border-red-600 border border-transparent transition-all">
                    <h4 className="text-xl font-bold text-white uppercase">{ex.name}</h4>
                    <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">{ex.muscleGroup}</p>
                 </button>
               ))}
            </div>
         </div>
       )}
    </div>
  );
});