import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer, Download, Upload, Filter, Clock, Database, FileJson, Cloud, CloudOff,
  Wifi, WifiOff, AlertTriangle, Smartphone, Signal, Globe
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

// --- SYSTEM CONSTANTS ---
// UUID Específico y válido para el Staff/Coach. No cambiar.
const COACH_UUID = 'e9c12345-6789-4321-8888-999999999999';
const STORAGE_KEY = 'KINETIX_DATA_PRO_V1'; 
const SESSION_KEY = 'KINETIX_SESSION_PRO_V1';

// --- DATA ENGINE (HYBRID CORE - OFFLINE FIRST) ---
const DataEngine = {
  getStore: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch { return {}; }
  },
  saveStore: (data: any) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { console.error("Storage Limit Reached", e); }
  },
  resetStore: () => {
    localStorage.clear();
    window.location.reload();
  },
  init: () => {
    const store = DataEngine.getStore();
    // Inicializar DB local vacía o con defaults solo si no existe
    if (!store.USERS) {
      DataEngine.saveStore({
        USERS: JSON.stringify([MOCK_USER]),
        EXERCISES: JSON.stringify(INITIAL_EXERCISES),
        LOGO_URL: 'https://raw.githubusercontent.com/StackBlitz/stackblitz-images/main/kinetix-wolf-logo.png'
      });
    }
  },
  
  getUsers: (): User[] => {
    const s = DataEngine.getStore();
    return s.USERS ? JSON.parse(s.USERS) : [];
  },
  getExercises: (): Exercise[] => {
    const s = DataEngine.getStore();
    return s.EXERCISES ? JSON.parse(s.EXERCISES) : [];
  },
  getLogo: (): string => DataEngine.getStore().LOGO_URL || '',
  getPlan: (uid: string): Plan | null => {
    const s = DataEngine.getStore();
    const p = s[`PLAN_${uid}`];
    return p ? JSON.parse(p) : null;
  },
  getLogs: (uid: string): WorkoutLog[] => {
    const s = DataEngine.getStore();
    const l = s[`LOGS_${uid}`];
    return l ? JSON.parse(l) : [];
  },

  // --- SINCRONIZACIÓN MAESTRA ---
  pullFromCloud: async () => {
    if (!supabaseConnectionStatus.isConfigured) return false;
    
    try {
      const s = DataEngine.getStore();
      
      // 1. USUARIOS
      const { data: users, error: uErr } = await supabase.from('users').select('*');
      if (users && !uErr) {
        const mappedUsers = users.map(u => ({
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
        s.USERS = JSON.stringify(mappedUsers);
      }

      // 2. PLANES (Optimized Query)
      const { data: plans, error: pErr } = await supabase.from('plans').select(`
        *, 
        workouts (
          *, 
          workout_exercises (
            *,
            exercise:exercises(name) 
          )
        )
      `);
      
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
                name: we.exercise?.name || 'Ejercicio',
                targetSets: we.target_sets,
                targetReps: we.target_reps,
                coachCue: we.coach_cue
              }))
            })).sort((a:any, b:any) => a.day - b.day)
          };
          s[`PLAN_${p.user_id}`] = JSON.stringify(fullPlan);
        });
      }

      // 3. EJERCICIOS
      const { data: exercises } = await supabase.from('exercises').select('*');
      if (exercises && exercises.length > 0) {
        s.EXERCISES = JSON.stringify(exercises);
      }

      DataEngine.saveStore(s);
      return true;
    } catch (e) {
      console.error("Sync Failed", e);
      return false;
    }
  },

  saveUser: async (user: User) => {
    // Local First
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    s.USERS = JSON.stringify(users);
    DataEngine.saveStore(s);

    if (!isUUID(user.id)) return;

    // Background Cloud Sync
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
    } catch (e) { console.error("Cloud Save User Error", e); }
  },

  savePlan: async (p: Plan) => {
    const s = DataEngine.getStore();
    s[`PLAN_${p.userId}`] = JSON.stringify(p);
    DataEngine.saveStore(s);
    
    if (!isUUID(p.userId)) return;

    try {
      const planUUID = isUUID(p.id) ? p.id : undefined;
      const { data: planData } = await supabase.from('plans').upsert({
        id: planUUID,
        title: p.title,
        user_id: p.userId,
        updated_at: new Date().toISOString()
      }).select().single();

      if (planData) {
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
  const [inputModal, setInputModal] = useState<{title: string, placeholder: string, type?: string, inputMode?: "text"|"numeric", callback: (v: string) => void} | null>(null);
  const [toast, setToast] = useState<{msg: string, type: 'error' | 'success'} | null>(null);

  const notify = useCallback((msg: string, type: 'error' | 'success' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const refreshData = useCallback(() => {
    setAllUsers(DataEngine.getUsers());
    setExercises(DataEngine.getExercises());
    setLogo(DataEngine.getLogo());
    if (currentUser) {
      setMyPlan(DataEngine.getPlan(currentUser.id));
      setMyLogs(DataEngine.getLogs(currentUser.id));
    }
  }, [currentUser]);

  // BOOTSTRAP
  useEffect(() => {
    DataEngine.init();
    
    // Check Connectivity
    const checkConn = async () => {
      if (supabaseConnectionStatus.isConfigured) {
        const { error } = await supabase.from('users').select('count', { count: 'exact', head: true });
        setDbConnected(!error);
      }
    };
    checkConn();

    const bootSequence = async () => {
      refreshData();
      
      const savedSession = localStorage.getItem(SESSION_KEY);
      if (savedSession) {
         try {
           const user = JSON.parse(savedSession);
           setCurrentUser(user);
           setActiveTab(user.role === 'coach' ? 'admin' : 'home');
           // Background Refresh if session exists
           setTimeout(() => {
             setSyncing(true);
             DataEngine.pullFromCloud().then(() => {
                refreshData();
                setSyncing(false);
             });
           }, 1000);
         } catch(e) { localStorage.removeItem(SESSION_KEY); }
      }
      setIsReady(true);
    };

    bootSequence();
  }, [refreshData]);

  // --- COACH LOGIN (OPTIMISTIC UI PATTERN) ---
  const handleCoachLogin = async (pin: string) => {
    if (pin === 'KINETIX2025') {
       // 1. OPTIMISTIC UPDATE: Log in immediately, don't wait for network
       setLoading(true);
       
       const coach: User = { 
         id: COACH_UUID, 
         name: 'HEAD COACH', 
         email: 'staff@kinetix.com',
         role: 'coach', 
         goal: Goal.PERFORMANCE, 
         level: UserLevel.ADVANCED,
         daysPerWeek: 7, 
         equipment: ['Full Box'], 
         streak: 100, 
         createdAt: new Date().toISOString()
       };

       setCurrentUser(coach);
       localStorage.setItem(SESSION_KEY, JSON.stringify(coach));
       setActiveTab('admin');
       notify("BIENVENIDO COACH");
       setLoading(false);

       // 2. BACKGROUND SYNC: Ensure consistency silently
       if (supabaseConnectionStatus.isConfigured) {
         setSyncing(true);
         // Upsert Coach Identity
         await supabase.from('users').upsert({
            id: coach.id, name: coach.name, email: coach.email, role: coach.role
         });
         // Fetch latest data
         await DataEngine.pullFromCloud();
         refreshData();
         setSyncing(false);
       }
    } else {
      notify("PIN INCORRECTO", 'error');
    }
  };

  // --- USER LOGIN ---
  const handleUserLogin = async () => {
    const input = loginName.trim().toLowerCase();
    if (!input) return;
    setLoading(true);
    
    // 1. Local Search First (Instant)
    let found = DataEngine.getUsers().find((u: User) => u.name.toLowerCase().includes(input));

    // 2. Fallback: Network Search
    if (!found && supabaseConnectionStatus.isConfigured) {
       notify("BUSCANDO EN LA NUBE...");
       try {
         const { data } = await supabase.from('users').select('*').ilike('name', `%${input}%`).single();
         if (data) {
            found = {
               id: data.id, name: data.name, email: data.email, role: data.role,
               goal: data.goal, level: data.level, daysPerWeek: data.days_per_week,
               equipment: data.equipment || [], streak: data.streak, createdAt: data.created_at
            };
            DataEngine.saveUser(found);
            // Get Plan
            const { data: plans } = await supabase.from('plans').select('*, workouts(*)').eq('user_id', data.id);
            if (plans) await DataEngine.pullFromCloud(); 
         }
       } catch (e) {}
    }

    setLoading(false);

    if (found) {
      setCurrentUser(found);
      localStorage.setItem(SESSION_KEY, JSON.stringify(found));
      notify(`HOLA, ${found.name.split(' ')[0]}`);
      setActiveTab('home');
      // Sync fresh data now that we are logged in
      setSyncing(true);
      DataEngine.pullFromCloud().then(() => { refreshData(); setSyncing(false); });
    } else {
      notify("USUARIO NO ENCONTRADO", 'error');
    }
  };

  // CHART DATA MEMO
  const chartData = useMemo(() => {
    if (!myLogs || myLogs.length === 0) return [];
    try {
      const points = myLogs.map(log => {
        const d = new Date(log.date);
        let vol = 0;
        log.exercisesData?.forEach(ex => {
          ex.sets?.forEach(s => {
             if (s && s.done) vol += ((s.weight || 0) * (s.reps || 0));
          });
        });
        return { 
          rawDate: d,
          date: `${d.getDate()}/${d.getMonth()+1}`, 
          vol 
        };
      });
      return points.sort((a,b) => a.rawDate.getTime() - b.rawDate.getTime());
    } catch(e) { return []; }
  }, [myLogs]);

  if (!isReady) return <div className="min-h-screen bg-[#050507] flex items-center justify-center"><RefreshCw className="animate-spin text-red-600" size={40}/></div>;

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100 font-sans selection:bg-red-600/30 overflow-x-hidden">
      
      {/* --- HEADER --- */}
      <header className="p-5 flex justify-between items-center bg-zinc-950/90 backdrop-blur-3xl sticky top-0 z-[100] border-b border-white/5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)]">
             <img src={DataEngine.getLogo()} className="w-6 h-6 object-contain" alt="K" />
          </div>
          <div className="flex flex-col">
            <span className="font-display italic text-xl uppercase text-white tracking-tighter leading-none neon-red">KINETIX</span>
            <div className="flex items-center gap-2">
               <span className={`text-[7px] font-black uppercase tracking-[0.4em] ${syncing ? 'text-yellow-500' : 'text-zinc-600'}`}>
                 {syncing ? 'SINC...' : 'ONLINE'}
               </span>
            </div>
          </div>
        </div>
        {currentUser && (
          <button onClick={() => { 
             if(window.confirm("¿Cerrar sesión?")) {
               setCurrentUser(null); 
               localStorage.removeItem(SESSION_KEY); 
               setLoginName(''); 
               setActiveTab('home');
             }
          }} className="bg-zinc-900 p-3 rounded-2xl text-zinc-500 hover:text-white border border-white/5 transition-all">
            <LogOut size={18}/>
          </button>
        )}
      </header>

      <main className="flex-1 p-5 pb-32">
        {!currentUser ? (
          // --- LOGIN SCREEN ---
          <div className="min-h-[75vh] flex flex-col items-center justify-center space-y-12 animate-in fade-in duration-700">
             
             {/* LOGO HERO */}
             <div className="relative group scale-90">
                <div className="absolute -inset-10 bg-red-600 rounded-full blur-[100px] opacity-20 group-hover:opacity-40 transition-all"></div>
                <div className="relative w-44 h-44 bg-zinc-900 rounded-[3rem] border border-white/10 flex items-center justify-center shadow-2xl overflow-hidden group-hover:scale-105 transition-transform duration-500">
                   <img src={DataEngine.getLogo()} className="w-28 h-28 object-contain float" alt="Kinetix Logo" />
                </div>
             </div>

             <div className="w-full space-y-10 px-2 text-center">
                <div className="space-y-1">
                  <h1 className="text-6xl font-display italic text-white uppercase tracking-tighter leading-none italic">ENTRAR</h1>
                  <p className="text-zinc-600 font-black uppercase text-[10px] tracking-[0.4em]">PERFORMANCE ZONE</p>
                </div>
                
                {/* LOGIN FORM */}
                <div className="space-y-4">
                  <input 
                    type="search" 
                    value={loginName} 
                    onChange={e => setLoginName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleUserLogin()}
                    placeholder="ID DE ATLETA"
                    className="w-full bg-zinc-900/50 border border-zinc-800 p-6 rounded-[2.5rem] text-center font-bold text-white text-xl outline-none focus:border-red-600 transition-all uppercase placeholder:text-zinc-700 shadow-inner"
                  />
                  <button 
                    onClick={handleUserLogin}
                    disabled={loading}
                    className="w-full bg-red-600 py-6 rounded-[2.5rem] font-display italic text-2xl uppercase text-white shadow-[0_15px_40px_rgba(239,68,68,0.3)] active:scale-95 transition-all flex items-center justify-center gap-3"
                  >
                    {loading ? <RefreshCw className="animate-spin" size={20}/> : 'ACCEDER'}
                  </button>
                  
                  {/* STATUS */}
                  <div className="flex justify-center pt-2">
                    <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900 border border-white/5">
                       <Globe size={10} className={supabaseConnectionStatus.isConfigured ? 'text-green-500' : 'text-red-500'} />
                       <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">
                         {supabaseConnectionStatus.isConfigured ? 'SERVER CONNECTED' : 'SERVER OFFLINE'}
                       </span>
                    </div>
                  </div>
                </div>
             </div>

             {/* ACTIONS */}
             <div className="flex gap-10 items-center pt-4">
               <button 
                 onClick={() => { if(window.confirm("¿Restaurar App de fábrica?")) DataEngine.resetStore(); }}
                 className="flex flex-col items-center gap-1 text-zinc-700 hover:text-red-500 transition-colors"
               >
                 <Trash2 size={18}/>
                 <span className="text-[8px] font-black uppercase tracking-widest">RESET</span>
               </button>

               <button 
                 onClick={() => setInputModal({
                   title: 'STAFF ACCESS',
                   placeholder: 'PIN DE SEGURIDAD',
                   type: 'password',
                   inputMode: 'text', // FIX: Permitir letras para "KINETIX2025"
                   callback: handleCoachLogin
                 })}
                 className="flex flex-col items-center gap-1 text-zinc-700 hover:text-white transition-colors"
               >
                 <Lock size={18}/>
                 <span className="text-[8px] font-black uppercase tracking-widest">STAFF</span>
               </button>
             </div>
          </div>
        ) : (
          <div className="animate-in slide-in-from-bottom-4 duration-500">
            {/* --- HOME TAB --- */}
            {activeTab === 'home' && (
              <div className="space-y-8">
                <header className="text-left">
                   <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-1">DASHBOARD</p>
                   <h2 className="text-5xl font-display italic text-white uppercase leading-none tracking-tighter italic">
                     HOLA <span className="text-red-600">{currentUser.name.split(' ')[0]}</span>
                   </h2>
                   {!isUUID(currentUser.id) && (
                     <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center gap-3">
                       <AlertTriangle size={14} className="text-yellow-500"/>
                       <p className="text-[8px] text-yellow-500 font-bold uppercase">CUENTA LOCAL - SINCRONIZACIÓN LIMITADA</p>
                     </div>
                   )}
                </header>

                {/* CHART */}
                <div className="bg-zinc-900/40 p-6 rounded-[3rem] border border-white/5 space-y-6 shadow-xl relative overflow-hidden">
                   <div className="flex justify-between items-center relative z-10">
                      <div>
                        <p className="text-[9px] text-cyan-400 font-black uppercase tracking-widest flex items-center gap-2"><Activity size={12}/> VOLUMEN TOTAL</p>
                        <h4 className="text-xl font-display italic text-white uppercase tracking-tighter">PROGRESO</h4>
                      </div>
                      <div className="bg-zinc-950 px-4 py-2 rounded-2xl border border-white/5 text-right">
                         <p className="text-2xl font-display italic text-white leading-none">{myLogs.length}</p>
                         <p className="text-[7px] text-zinc-600 font-black uppercase tracking-widest">SESIONES</p>
                      </div>
                   </div>
                   <div className="h-40 w-full relative z-10 -ml-2">
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
                              <Area type="monotone" dataKey="vol" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorVol)" />
                           </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center border-2 border-dashed border-zinc-800 rounded-[2rem] gap-2 text-zinc-800">
                           <BarChart3 size={24}/>
                           <p className="text-[8px] font-black uppercase tracking-widest text-center italic">SIN DATOS AÚN</p>
                        </div>
                      )}
                   </div>
                </div>

                {/* WORKOUTS LIST */}
                <div className="space-y-4 pb-12 text-left">
                  <div className="flex justify-between items-center px-2">
                     <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest italic">TU PLAN ACTUAL</p>
                     <p className="text-[9px] font-black text-red-600 uppercase tracking-widest text-right max-w-[150px] truncate">{myPlan?.title || 'VACÍO'}</p>
                  </div>
                  <div className="grid gap-3">
                    {myPlan?.workouts.map(w => (
                      <button 
                        key={w.id} 
                        onClick={() => setTrainingWorkout(w)}
                        className="w-full flex justify-between items-center p-6 bg-zinc-900/40 rounded-[2.5rem] border border-white/5 hover:border-red-600/30 transition-all active:scale-95 shadow-md group"
                      >
                        <div className="flex items-center gap-5">
                           <div className="w-14 h-14 bg-zinc-950 rounded-2xl flex items-center justify-center font-display italic text-2xl text-zinc-800 group-hover:text-red-600 border border-white/5 transition-colors">{w.day}</div>
                           <div className="text-left">
                              <h4 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">{w.name}</h4>
                              <p className="text-[9px] text-zinc-600 font-black uppercase tracking-[0.2em]">{w.exercises.length} EJERCICIOS</p>
                           </div>
                        </div>
                        <div className="bg-zinc-950 p-4 rounded-xl group-hover:bg-red-600 transition-all text-zinc-800 group-hover:text-white shadow-lg"><Play size={20}/></div>
                      </button>
                    ))}
                    {!myPlan && (
                      <div className="py-12 bg-zinc-900/10 border-2 border-dashed border-zinc-800 rounded-[3rem] text-center space-y-3">
                         <ShieldAlert size={32} className="mx-auto text-zinc-800" />
                         <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest px-10">SIN PROTOCOLO ASIGNADO</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- ADMIN TAB --- */}
            {activeTab === 'admin' && (
              <div className="space-y-10 pb-24 text-left">
                <header className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.4em]">STATION COMMAND</p>
                    <h2 className="text-6xl font-display italic text-red-600 uppercase tracking-tighter leading-none italic">COACH</h2>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={async () => {
                       setLoading(true);
                       await DataEngine.pullFromCloud();
                       refreshData();
                       setLoading(false);
                       notify("CLOUD SYNC OK");
                    }} className="bg-zinc-900 p-5 rounded-[2rem] text-zinc-400 border border-zinc-800 hover:text-white shadow-lg transition-all active:scale-95">
                      <RefreshCw className={loading ? 'animate-spin' : ''} size={24}/>
                    </button>
                  </div>
                </header>

                <div className="space-y-6">
                   <div className="flex justify-between items-center px-2">
                      <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Users size={12}/> ATLETAS ({allUsers.length - 1})</p>
                      <button 
                        onClick={() => setInputModal({
                          title: 'NUEVO ATLETA',
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
                            refreshData();
                            notify("GUARDADO LOCALMENTE");
                          }
                        })}
                        className="bg-red-600 text-white px-4 py-3 rounded-xl text-[9px] font-black uppercase flex items-center gap-2 shadow-lg active:scale-95"
                      ><Plus size={14}/> REGISTRAR</button>
                   </div>
                   <div className="grid gap-3">
                      {allUsers.filter(u => u.role !== 'coach').map(u => (
                        <div key={u.id} className="bg-zinc-900/40 p-6 rounded-[3rem] border border-white/5 flex flex-col md:flex-row md:items-center justify-between group shadow-lg gap-4">
                           <div className="text-left space-y-1">
                              <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{u.name}</h4>
                              <span className="text-[8px] text-zinc-600 font-black uppercase px-2 py-1 bg-zinc-950 rounded-lg border border-white/5">{u.level}</span>
                              {!isUUID(u.id) && <span className="ml-2 text-[8px] text-red-500 bg-red-900/20 px-2 py-1 rounded">OFFLINE ID</span>}
                           </div>
                           <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 no-scrollbar">
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
                                className="p-4 bg-red-600/10 text-red-600 rounded-2xl border border-red-600/20 hover:bg-red-600 hover:text-white transition-all flex-shrink-0"
                              ><Sparkles size={20}/></button>
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
                                className="p-4 bg-zinc-800 text-zinc-500 rounded-2xl hover:bg-white hover:text-black transition-all flex-shrink-0"
                              ><Edit3 size={20}/></button>
                              <button 
                                onClick={() => { if(window.confirm("¿BORRAR ATLETA?")) { DataEngine.deleteUser(u.id); refreshData(); notify("ELIMINADO"); } }}
                                className="p-4 text-zinc-800 hover:text-red-600 transition-colors flex-shrink-0"
                              ><Trash2 size={20}/></button>
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

      {/* --- BOTTOM NAV --- */}
      {currentUser && !trainingWorkout && (
        <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/98 backdrop-blur-3xl border-t border-white/5 px-6 py-4 z-[100] flex justify-around shadow-2xl safe-area-bottom pb-8">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={24}/>} label="STATION" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={24}/>} label="STAFF" />}
          <NavItem active={activeTab === 'history'} onClick={() => {}} icon={<History size={24}/>} label="HISTORY" />
        </nav>
      )}

      {/* --- INPUT MODAL (FIXED MOBILE) --- */}
      {inputModal && (
        <div className="fixed inset-0 z-[550] bg-black/98 flex items-center justify-center p-6 animate-in fade-in backdrop-blur-sm">
           <div className="w-full bg-zinc-900 border border-white/10 rounded-[3rem] p-8 space-y-8 shadow-[0_0_100px_rgba(239,68,68,0.2)]">
              <div className="text-center space-y-2">
                 <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.6em] italic">{inputModal.title}</p>
                 <h3 className="text-2xl font-display italic text-white uppercase tracking-tighter">COMMAND</h3>
              </div>
              <input 
                autoFocus
                type={inputModal.type || 'text'}
                inputMode={inputModal.inputMode || 'text'}
                placeholder={inputModal.placeholder}
                className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-[2rem] text-center text-xl font-bold outline-none focus:border-red-600 uppercase text-white shadow-inner placeholder:text-zinc-800"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    inputModal.callback((e.target as HTMLInputElement).value);
                    setInputModal(null);
                  }
                }}
              />
              <div className="grid grid-cols-2 gap-4">
                 <button onClick={() => setInputModal(null)} className="py-5 bg-zinc-800 rounded-2xl font-black uppercase text-[10px] text-zinc-500">CANCELAR</button>
                 <button onClick={() => {
                    const val = (document.querySelector('input') as HTMLInputElement)?.value;
                    inputModal.callback(val);
                    setInputModal(null);
                 }} className="py-5 bg-red-600 rounded-2xl font-black uppercase text-[10px] text-white">CONFIRMAR</button>
              </div>
           </div>
        </div>
      )}

      {/* --- TOAST --- */}
      {toast && (
        <div className="fixed top-4 left-4 right-4 z-[600] animate-in slide-in-from-top duration-300">
           <div className={`${toast.type === 'error' ? 'bg-red-600/90' : 'bg-green-600/90'} p-5 rounded-[2rem] flex items-center justify-between shadow-2xl border border-white/10 backdrop-blur-md`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-white italic">{toast.msg}</p>
              <button onClick={() => setToast(null)} className="p-2 bg-black/20 rounded-full text-white hover:bg-black/40"><X size={14}/></button>
           </div>
        </div>
      )}

      {/* --- SUB-COMPONENTS --- */}
      {trainingWorkout && <TrainingSession logo={logo} workout={trainingWorkout} exercises={exercises} userId={currentUser?.id || ''} notify={notify} onClose={(did, log) => { if(did && log) { DataEngine.saveLog(log); refreshData(); } setTrainingWorkout(null); }} logs={myLogs} />}
      {editingPlan && <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={(p: Plan) => { DataEngine.savePlan(p); refreshData(); setEditingPlan(null); notify("PROTOCOLO SINCRONIZADO"); }} onCancel={() => setEditingPlan(null)} loading={loading} />}
    </div>
  );
}

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-700'}`}>
    <div className={`p-3 rounded-2xl transition-all ${active ? 'bg-red-600/15 scale-110 border border-red-600/30' : ''}`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-[0.6em] ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
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
       <header className="p-6 flex justify-between items-center sticky top-0 bg-[#050507]/98 backdrop-blur-2xl z-10 border-b border-zinc-900 shadow-2xl">
          <div className="text-left flex items-center gap-4">
             <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center"><img src={logo} className="w-6 h-6 object-contain" /></div>
             <h3 className="text-2xl font-display italic text-white uppercase tracking-tighter leading-none italic max-w-[200px] truncate">{workout.name}</h3>
          </div>
          <button onClick={() => onClose(false)} className="bg-zinc-900 p-4 rounded-full text-zinc-500 shadow-xl"><X size={24}/></button>
       </header>
       <div className="p-6 space-y-12 mt-4">
          {workout.exercises.map((ex: any, exIdx: number) => {
            const exInfo = exercises.find((e:any) => e.id === ex.exerciseId);
            return (
              <div key={exIdx} className="space-y-6 text-left border-l-2 border-red-600 pl-6">
                <h4 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none italic">{exInfo?.name || ex.name}</h4>
                <div className="grid gap-4">
                   {sessionLogs[exIdx].sets.map((set: any, setIdx: number) => (
                     <div key={setIdx} className={`p-5 rounded-[2rem] border transition-all flex items-center justify-between gap-4 ${set.done ? 'bg-green-600/10 border-green-500/30 shadow-xl' : 'bg-zinc-900/40 border-white/5'}`}>
                        <div className={`w-10 h-10 rounded-[1rem] flex items-center justify-center font-display italic text-xl ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-800 border border-white/5'}`}>{setIdx + 1}</div>
                        <div className="flex-1 flex gap-3">
                           <input type="number" placeholder="KG" value={set.weight || ''} onChange={e => updateSet(exIdx, setIdx, 'weight', parseFloat(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-center text-white text-xl font-bold shadow-inner" />
                           <input type="number" placeholder="REPS" value={set.reps || ''} onChange={e => updateSet(exIdx, setIdx, 'reps', parseInt(e.target.value))} className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-2xl text-center text-white text-xl font-bold shadow-inner" />
                        </div>
                        <button onClick={() => updateSet(exIdx, setIdx, 'done', !set.done)} className={`p-6 rounded-[1.5rem] transition-all shadow-2xl ${set.done ? 'bg-green-600 text-white' : 'bg-zinc-950 text-zinc-800 border border-white/5'}`}><Check size={24}/></button>
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
          }} className="w-full py-12 bg-red-600 rounded-[3rem] font-display italic text-3xl uppercase text-white shadow-[0_20px_60px_rgba(239,68,68,0.4)] mt-12 mb-20 italic">FINALIZAR SESIÓN</button>
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
    nw.forEach((w, i) => w.day = i + 1);
    setLocal({...local, workouts: nw});
  }

  return (
    <div className="fixed inset-0 bg-[#050507] z-[350] p-4 flex flex-col animate-in slide-in-from-right overflow-y-auto pb-48 no-scrollbar">
       <header className="flex justify-between items-center mb-8 sticky top-0 bg-[#050507]/95 backdrop-blur-3xl py-4 z-10 border-b border-white/5">
          <button onClick={onCancel} className="bg-zinc-900 p-5 rounded-full text-zinc-500 shadow-xl"><ChevronLeft size={24}/></button>
          <input value={local.title} onChange={e => setLocal({...local, title: e.target.value})} className="bg-transparent text-xl font-display italic text-white text-center outline-none uppercase tracking-tighter w-full border-b border-zinc-900 italic" />
          <button onClick={() => onSave(local)} disabled={loading} className="bg-red-600 p-5 rounded-full text-white shadow-xl">
            {loading ? <RefreshCw className="animate-spin" size={24}/> : <Save size={24}/>}
          </button>
       </header>
       <div className="space-y-12">
          {local.workouts.map((w, wIdx) => (
             <div key={wIdx} className="bg-zinc-900/30 p-6 rounded-[3rem] border border-white/5 space-y-8 shadow-2xl relative">
                <button onClick={() => removeDay(wIdx)} className="absolute top-6 right-6 text-zinc-700 hover:text-red-600"><Trash2/></button>
                <input value={w.name} onChange={e => { const nw = [...local.workouts]; nw[wIdx].name = e.target.value; setLocal({...local, workouts: nw}); }} className="bg-transparent border-b border-zinc-800 p-2 text-2xl font-display italic text-white outline-none w-full uppercase italic pr-12" />
                <div className="space-y-6">
                   {w.exercises.map((ex, exIdx) => (
                     <div key={exIdx} className="p-6 bg-zinc-950/80 rounded-[2.5rem] border border-white/5 space-y-6 shadow-2xl relative group">
                        <button onClick={() => removeExercise(wIdx, exIdx)} className="absolute top-4 right-4 text-zinc-800 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"><X/></button>
                        <span className="text-xl font-black uppercase text-white tracking-tighter italic block pr-10">{allExercises.find((e:any) => e.id === ex.exerciseId)?.name || ex.name}</span>
                        <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-1">
                             <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest pl-2">SETS</span>
                             <input value={ex.targetSets} type="number" onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].targetSets = parseInt(e.target.value) || 0; setLocal({...local, workouts: nw}); }} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-[2rem] text-white font-bold text-center text-2xl" />
                           </div>
                           <div className="space-y-1">
                             <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest pl-2">REPS</span>
                             <input value={ex.targetReps} onChange={e => { const nw = [...local.workouts]; nw[wIdx].exercises[exIdx].targetReps = e.target.value; setLocal({...local, workouts: nw}); }} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-[2rem] text-white font-bold text-center text-2xl" />
                           </div>
                        </div>
                     </div>
                   ))}
                   <button onClick={() => setAddingExerciseTo(wIdx)} className="w-full py-8 bg-zinc-900 rounded-[2.5rem] text-xs font-black text-zinc-500 uppercase flex items-center justify-center gap-3 hover:bg-zinc-800 hover:text-white transition-all"><Plus size={18}/> EJERCICIO</button>
                </div>
             </div>
          ))}
          <button onClick={() => setLocal({...local, workouts: [...local.workouts, { 
             id: generateUUID(), 
             name: `DÍA ${local.workouts.length+1}`, 
             day: local.workouts.length+1, 
             exercises: [] 
          }]})} className="w-full py-16 border-2 border-dashed border-zinc-800 rounded-[4rem] text-xs font-black text-zinc-800 uppercase flex items-center justify-center gap-4 shadow-2xl italic"><Plus size={48}/> AÑADIR DÍA</button>
       </div>

       {addingExerciseTo !== null && (
         <div className="fixed inset-0 z-[400] bg-black/98 flex flex-col p-4 animate-in fade-in">
            <header className="flex justify-between items-center mb-6">
               <h3 className="text-2xl font-display italic text-white uppercase">SELECCIONAR</h3>
               <button onClick={() => setAddingExerciseTo(null)} className="p-3 bg-zinc-800 rounded-full"><X/></button>
            </header>
            <div className="grid gap-3 overflow-y-auto pb-20 no-scrollbar">
               {allExercises.map((ex: Exercise) => (
                 <button key={ex.id} onClick={() => addExercise(addingExerciseTo, ex)} className="p-5 bg-zinc-900 rounded-[2.5rem] text-left hover:bg-zinc-800 hover:border-red-600 border border-transparent transition-all">
                    <h4 className="text-lg font-bold text-white uppercase">{ex.name}</h4>
                    <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mt-1">{ex.muscleGroup}</p>
                 </button>
               ))}
            </div>
         </div>
       )}
    </div>
  );
});