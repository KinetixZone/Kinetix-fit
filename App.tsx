
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer, Download, Upload, Filter, Clock, Database, FileJson, Cloud, CloudOff,
  Wifi, WifiOff, AlertTriangle, Smartphone, Signal, Globe, Loader2, BrainCircuit,
  CalendarDays, Trophy, Pencil, Menu, Youtube, Info, UserMinus, UserCog, Circle, CheckCircle
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
const COACH_UUID = 'e9c12345-6789-4321-8888-999999999999';
const STORAGE_KEY = 'KINETIX_DATA_PRO_V2'; 
const SESSION_KEY = 'KINETIX_SESSION_PRO_V2';

// --- DATA ENGINE (CLOUD FIRST HYBRID) ---
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
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) { console.error("Storage Limit Reached", e); }
  },
  
  init: () => {
    const store = DataEngine.getStore();
    
    // Inicializar Usuarios si no existen
    if (!store.USERS) {
      store.USERS = JSON.stringify([MOCK_USER]);
    }

    // Fusión Inteligente de Ejercicios
    const storedExercises = store.EXERCISES ? JSON.parse(store.EXERCISES) : [];
    const mergedExercises = [...INITIAL_EXERCISES];
    
    // Agregar ejercicios custom que no estén en la base inicial
    storedExercises.forEach((se: Exercise) => {
      if (!mergedExercises.find(me => me.id === se.id)) {
        mergedExercises.push(se);
      }
    });

    store.EXERCISES = JSON.stringify(mergedExercises);
    DataEngine.saveStore(store);
  },
  
  getUsers: (): User[] => {
    const s = DataEngine.getStore();
    return s.USERS ? JSON.parse(s.USERS) : [];
  },
  
  getUserById: (id: string): User | undefined => {
    const users = DataEngine.getUsers();
    return users.find(u => u.id === id);
  },

  // Busca por Nombre O Email (Case insensitive)
  getUserByNameOrEmail: (query: string): User | undefined => {
    const users = DataEngine.getUsers();
    const q = query.toLowerCase().trim();
    return users.find(u => 
      u.email.toLowerCase() === q || 
      u.name.toLowerCase() === q
    );
  },

  getExercises: (): Exercise[] => {
    const s = DataEngine.getStore();
    return s.EXERCISES ? JSON.parse(s.EXERCISES) : INITIAL_EXERCISES;
  },

  addExercise: (exercise: Exercise) => {
    const s = DataEngine.getStore();
    const current = s.EXERCISES ? JSON.parse(s.EXERCISES) : [];
    current.push(exercise);
    s.EXERCISES = JSON.stringify(current);
    DataEngine.saveStore(s);
  },

  getPlan: (uid: string): Plan | null => {
    const s = DataEngine.getStore();
    const p = s[`PLAN_${uid}`];
    return p ? JSON.parse(p) : null;
  },

  savePlan: async (plan: Plan) => {
    const s = DataEngine.getStore();
    s[`PLAN_${plan.userId}`] = JSON.stringify(plan);
    DataEngine.saveStore(s);
  },

  pullFromCloud: async () => {
    if (!supabaseConnectionStatus.isConfigured) return false;
    try {
      const s = DataEngine.getStore();
      const { data: users } = await supabase.from('users').select('*');
      if (users) {
        const mappedUsers = users.map(u => ({
             id: u.id, name: u.name, email: u.email, role: u.role, goal: u.goal,
             level: u.level, daysPerWeek: u.days_per_week, equipment: u.equipment || [],
             streak: u.streak, createdAt: u.created_at
        }));
        s.USERS = JSON.stringify(mappedUsers);
      }
      DataEngine.saveStore(s);
      return true;
    } catch (e) { return false; }
  },

  saveUser: async (user: User) => {
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    s.USERS = JSON.stringify(users);
    DataEngine.saveStore(s);
  },

  updateUser: (updatedUser: User) => {
    const s = DataEngine.getStore();
    let users = JSON.parse(s.USERS || '[]');
    const index = users.findIndex((u: User) => u.id === updatedUser.id);
    if (index !== -1) {
      users[index] = updatedUser;
      s.USERS = JSON.stringify(users);
      DataEngine.saveStore(s);
    }
  },

  deleteUser: (userId: string) => {
    const s = DataEngine.getStore();
    let users = JSON.parse(s.USERS || '[]');
    users = users.filter((u: User) => u.id !== userId);
    s.USERS = JSON.stringify(users);
    // También borrar el plan asociado
    delete s[`PLAN_${userId}`];
    DataEngine.saveStore(s);
  },

  // --- PROGRESS TRACKING ---
  toggleExerciseStatus: (userId: string, workoutId: string, exerciseIndex: number) => {
    const s = DataEngine.getStore();
    const key = `TRACK_${userId}`;
    const tracking = s[key] ? JSON.parse(s[key]) : {};
    
    // Structure: { workoutId: [index1, index2] }
    if (!tracking[workoutId]) tracking[workoutId] = [];
    
    if (tracking[workoutId].includes(exerciseIndex)) {
       tracking[workoutId] = tracking[workoutId].filter((i: number) => i !== exerciseIndex);
    } else {
       tracking[workoutId].push(exerciseIndex);
    }
    
    s[key] = JSON.stringify(tracking);
    DataEngine.saveStore(s);
  },

  getCompletedExercises: (userId: string, workoutId: string): number[] => {
    const s = DataEngine.getStore();
    const key = `TRACK_${userId}`;
    const tracking = s[key] ? JSON.parse(s[key]) : {};
    return tracking[workoutId] || [];
  }
};

// --- COMPONENTS ---

const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(supabaseConnectionStatus.isConfigured);
  return (
    <div className={`fixed bottom-20 md:bottom-4 right-4 z-50 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 backdrop-blur-md border ${isOnline ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
      {isOnline ? <Cloud size={10} /> : <CloudOff size={10} />}
      <span>{isOnline ? 'ONLINE' : 'LOCAL'}</span>
    </div>
  );
};

const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${active ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
  >
    {icon}
    <span>{label}</span>
  </button>
);

const MobileNavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${active ? 'text-red-500' : 'text-gray-500'}`}
  >
    <div className={`p-1 rounded-lg ${active ? 'bg-red-500/10' : ''}`}>{icon}</div>
    <span className="text-[10px] font-bold">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) => (
  <div className="bg-[#0F0F11] border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-white/10 transition-colors">
     <div className="flex justify-between items-start mb-2">
       <span className="text-xs text-gray-500 font-bold uppercase">{label}</span>
       {icon}
     </div>
     <span className="text-2xl font-bold font-display truncate">{value}</span>
  </div>
);

// --- PLAN VIEWER COMPONENT (REUSABLE & INTERACTIVE) ---
const PlanViewer = ({ plan, mode = 'coach' }: { plan: Plan, mode?: 'coach' | 'athlete' }) => {
  const [showVideo, setShowVideo] = useState<string | null>(null);
  // Trigger para forzar re-render al marcar checkbox
  const [updateTick, setUpdateTick] = useState(0); 

  const handleToggle = (workoutId: string, index: number, e: React.MouseEvent) => {
     e.stopPropagation();
     if (mode !== 'athlete') return;
     DataEngine.toggleExerciseStatus(plan.userId, workoutId, index);
     setUpdateTick(prev => prev + 1);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <CalendarDays size={20} className="text-red-500" />
          {plan.title}
        </h2>
        {mode === 'athlete' && <span className="text-xs font-bold text-green-400 px-3 py-1 bg-green-900/20 rounded-full border border-green-500/20 animate-pulse-subtle">MODO ENTRENAMIENTO</span>}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {plan.workouts.map((workout) => {
          const completedIndices = DataEngine.getCompletedExercises(plan.userId, workout.id);
          const progress = Math.round((completedIndices.length / workout.exercises.length) * 100) || 0;

          return (
            <div key={workout.id} className="bg-[#0F0F11] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all shadow-xl shadow-black/20 group relative overflow-hidden">
              {/* Progress Bar for Athlete */}
              {mode === 'athlete' && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-white/5">
                   <div 
                     className="h-full bg-gradient-to-r from-red-600 to-yellow-500 transition-all duration-500" 
                     style={{ width: `${progress}%` }}
                   />
                </div>
              )}

              <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3 pt-2">
                <div>
                   <h3 className="font-bold text-red-400 text-sm tracking-wider">DÍA {workout.day}: {workout.name.toUpperCase()}</h3>
                   {mode === 'athlete' && <span className="text-[10px] text-gray-500 font-medium">{progress}% Completado</span>}
                </div>
                <Dumbbell size={18} className="text-gray-600" />
              </div>

              <div className="space-y-3">
                {workout.exercises.map((ex, idx) => {
                  const isDone = completedIndices.includes(idx);
                  
                  return (
                    <div 
                      key={idx} 
                      onClick={() => setShowVideo(ex.name)} 
                      className={`flex justify-between items-start text-sm cursor-pointer p-3 rounded-xl transition-all border ${isDone ? 'bg-green-500/5 border-green-500/20 opacity-75' : 'bg-transparent border-transparent hover:bg-white/5'}`}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        {/* Checkbox for Athlete */}
                        {mode === 'athlete' ? (
                           <button 
                             onClick={(e) => handleToggle(workout.id, idx, e)}
                             className={`mt-1 min-w-[20px] h-[20px] rounded-full flex items-center justify-center border transition-all ${isDone ? 'bg-green-500 border-green-500 text-black' : 'border-gray-600 text-transparent hover:border-white'}`}
                           >
                              <Check size={12} strokeWidth={4} />
                           </button>
                        ) : (
                           <span className="text-gray-600 font-mono text-xs w-5 mt-1">{idx + 1}</span>
                        )}
                        
                        <div className="flex-1">
                          <p className={`font-bold text-base transition-colors ${isDone ? 'text-green-400 line-through decoration-green-500/50' : 'text-white'}`}>{ex.name}</p>
                          
                          {/* TARGET LOAD HIGHLIGHT */}
                          {ex.targetLoad && (
                             <div className="flex items-center gap-2 mt-1 mb-1">
                                <span className="text-xs font-black text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                                   CARGA: {ex.targetLoad}
                                </span>
                             </div>
                          )}

                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400 mt-1">
                              <span className="bg-white/5 px-2 py-1 rounded font-medium border border-white/5">{ex.targetSets} Sets</span>
                              <span className="text-gray-600">x</span>
                              <span className="bg-white/5 px-2 py-1 rounded font-medium border border-white/5">{ex.targetReps} Reps</span>
                          </div>

                          {ex.coachCue && (
                            <div className="mt-2 text-xs text-blue-300 italic flex items-start gap-1 bg-blue-900/10 p-2 rounded-lg border border-blue-500/10">
                               <Info size={12} className="mt-0.5 shrink-0" />
                               <span>{ex.coachCue}</span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-gray-600 hover:text-white transition-colors pl-2 pt-1">
                         <Play size={16} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

       {showVideo && (
         <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowVideo(null)}>
            <div className="bg-[#111] w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
               <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#151518]">
                  <h3 className="font-bold text-white flex items-center gap-2"><Youtube size={18} className="text-red-500"/> {showVideo}</h3>
                  <button onClick={() => setShowVideo(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20} className="text-gray-400 hover:text-white" /></button>
               </div>
               <div className="aspect-video bg-black flex items-center justify-center relative group">
                  <div className="absolute inset-0 bg-red-600/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                  <a 
                    href={DataEngine.getExercises().find(e => e.name === showVideo)?.videoUrl || `https://www.youtube.com/results?search_query=${showVideo}+exercise`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex flex-col items-center gap-3 text-white group-hover:scale-110 transition-transform"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40">
                       <Play size={32} fill="white" className="ml-1" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase">Ver Tutorial</span>
                  </a>
               </div>
               <div className="p-6 bg-[#0F0F11]">
                 <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Instrucciones de Seguridad</h4>
                 <p className="text-sm text-gray-300 leading-relaxed">
                    Asegúrate de mantener una postura correcta durante todo el movimiento. 
                    Si sientes dolor agudo (no muscular), detente inmediatamente.
                    <br/><br/>
                    <span className="text-yellow-500 font-bold">Tip Pro:</span> Controla la fase excéntrica (bajada) para mayor hipertrofia.
                 </p>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};


// LOGIN PAGE
const LoginPage = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [mode, setMode] = useState<'coach' | 'athlete'>('coach');
  const [pin, setPin] = useState('');
  const [identity, setIdentity] = useState(''); // Puede ser email o nombre
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleCoachSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 800)); 
    if (pin.trim() === '2025' || pin.trim() === 'KINETIX2025') {
      await DataEngine.pullFromCloud();
      const coachUser: User = {
        id: COACH_UUID, name: 'COACH KINETIX', email: 'staff@kinetix.com',
        role: 'coach', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED,
        daysPerWeek: 6, equipment: [], streak: 999, createdAt: new Date().toISOString()
      };
      onLogin(coachUser);
    } else {
      setError(true);
      setPin('');
    }
    setIsLoading(false);
  };

  const handleAthleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 800));
    
    // Buscar atleta localmente por nombre o email
    const user = DataEngine.getUserByNameOrEmail(identity);
    if (user && user.role === 'client') {
      onLogin(user);
    } else {
      setError(true);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md z-10 animate-fade-in-up">
        <div className="mb-8 text-center">
          <h1 className="font-display text-5xl italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 neon-red mb-2">
            KINETIX
          </h1>
          <p className="text-gray-500 tracking-[0.2em] text-xs font-bold">HIGH PERFORMANCE ZONE</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-1 shadow-2xl mb-6 flex">
           <button 
             onClick={() => { setMode('coach'); setError(false); }}
             className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all ${mode === 'coach' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
           >
             COACH
           </button>
           <button 
             onClick={() => { setMode('athlete'); setError(false); }}
             className={`flex-1 py-3 text-sm font-bold rounded-2xl transition-all ${mode === 'athlete' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
           >
             ATLETA
           </button>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          {mode === 'coach' ? (
            <form onSubmit={handleCoachSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold ml-1">PIN Staff</label>
                <input
                  type="tel" inputMode="numeric" pattern="[0-9]*" 
                  value={pin} onChange={(e) => { setError(false); setPin(e.target.value); }}
                  placeholder="• • • •"
                  className={`w-full bg-black/40 border-2 ${error ? 'border-red-500 text-red-500' : 'border-white/10 focus:border-red-500 text-white'} rounded-xl px-4 py-4 text-center text-3xl tracking-[1em] font-display font-bold outline-none transition-all placeholder-gray-700`}
                  maxLength={4} autoFocus autoComplete="off"
                />
              </div>
              {error && <div className="text-red-500 text-xs font-bold text-center animate-pulse">PIN INCORRECTO</div>}
              <button type="submit" disabled={isLoading} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-red-900/20">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><span>ENTRAR</span><ArrowRight size={20} /></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAthleteSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold ml-1">Nombre o Email</label>
                <input
                  type="text"
                  value={identity} onChange={(e) => { setError(false); setIdentity(e.target.value); }}
                  placeholder="Ej: Juan Perez"
                  className={`w-full bg-black/40 border-2 ${error ? 'border-red-500 text-red-500' : 'border-white/10 focus:border-blue-500 text-white'} rounded-xl px-4 py-4 text-lg font-medium outline-none transition-all placeholder-gray-700`}
                />
                <p className="text-[10px] text-gray-500 text-right">Ingresa tu nombre completo tal como te registró tu coach.</p>
              </div>
              {error && <div className="text-red-500 text-xs font-bold text-center animate-pulse">ATLETA NO ENCONTRADO</div>}
              <button type="submit" disabled={isLoading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><span>ACCEDER</span><ArrowRight size={20} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// --- MANUAL PLAN BUILDER ---
const ManualPlanBuilder = ({ plan, onSave, onCancel }: { plan: Plan, onSave: (p: Plan) => void, onCancel: () => void }) => {
  const [editedPlan, setEditedPlan] = useState<Plan>(plan);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState<number>(0);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  // Load exercises from DataEngine (merged DB)
  const allExercises = useMemo(() => DataEngine.getExercises(), []);
  const categories = useMemo(() => ['Todos', ...Array.from(new Set(allExercises.map(e => e.muscleGroup)))], [allExercises]);

  const handleAddWorkout = () => {
    const newWorkout: Workout = {
      id: generateUUID(),
      name: `DÍA ${editedPlan.workouts.length + 1}`,
      day: editedPlan.workouts.length + 1,
      exercises: []
    };
    setEditedPlan({...editedPlan, workouts: [...editedPlan.workouts, newWorkout]});
    setSelectedWorkoutIndex(editedPlan.workouts.length);
  };

  const handleAddExercise = (exercise: Exercise) => {
    const newExercise: WorkoutExercise = {
      exerciseId: exercise.id,
      name: exercise.name,
      targetSets: 4,
      targetReps: '10-12',
      targetLoad: '',
      coachCue: ''
    };
    
    const updatedWorkouts = [...editedPlan.workouts];
    updatedWorkouts[selectedWorkoutIndex].exercises.push(newExercise);
    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
    setShowExerciseSelector(false);
  };

  const updateExercise = (exerciseIndex: number, field: keyof WorkoutExercise, value: any) => {
    const updatedWorkouts = [...editedPlan.workouts];
    updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex] = {
      ...updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex],
      [field]: value
    };
    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
  };

  const removeExercise = (exerciseIndex: number) => {
    const updatedWorkouts = [...editedPlan.workouts];
    updatedWorkouts[selectedWorkoutIndex].exercises.splice(exerciseIndex, 1);
    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
  };

  const filteredExercises = useMemo(() => {
    let filtered = allExercises;
    if (activeCategory !== 'Todos') {
      filtered = filtered.filter(ex => ex.muscleGroup === activeCategory);
    }
    if (searchQuery) {
      filtered = filtered.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return filtered;
  }, [searchQuery, activeCategory, allExercises]);

  return (
    <div className="bg-[#0A0A0C] min-h-screen fixed inset-0 z-50 overflow-y-auto pb-20 flex flex-col">
      <div className="sticky top-0 bg-[#0A0A0C]/95 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel}><X size={24} className="text-gray-400" /></button>
          <input 
            value={editedPlan.title}
            onChange={(e) => setEditedPlan({...editedPlan, title: e.target.value})}
            className="bg-transparent text-xl font-bold outline-none placeholder-gray-600 w-full"
            placeholder="Nombre del Protocolo"
          />
        </div>
        <button onClick={() => onSave(editedPlan)} className="bg-red-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2">
          <Save size={16} /> <span className="hidden sm:inline">GUARDAR</span>
        </button>
      </div>

      <div className="p-4 max-w-4xl mx-auto w-full flex-1">
        {/* Workout Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-4">
          {editedPlan.workouts.map((w, idx) => (
            <button 
              key={w.id}
              onClick={() => setSelectedWorkoutIndex(idx)}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedWorkoutIndex === idx ? 'bg-white text-black' : 'bg-white/5 text-gray-400'}`}
            >
              DÍA {w.day}
            </button>
          ))}
          <button onClick={handleAddWorkout} className="px-4 py-2 rounded-full bg-red-600/20 text-red-500 border border-red-500/50 flex items-center gap-1 text-sm font-bold">
            <Plus size={14} /> DÍA
          </button>
        </div>

        {editedPlan.workouts[selectedWorkoutIndex] ? (
          <div className="space-y-4 animate-fade-in">
             <input 
               value={editedPlan.workouts[selectedWorkoutIndex].name}
               onChange={(e) => {
                 const updated = [...editedPlan.workouts];
                 updated[selectedWorkoutIndex].name = e.target.value;
                 setEditedPlan({...editedPlan, workouts: updated});
               }}
               className="bg-transparent text-2xl font-bold uppercase text-red-500 outline-none w-full mb-4"
               placeholder="NOMBRE DEL DÍA (EJ: PIERNA)"
             />

             {editedPlan.workouts[selectedWorkoutIndex].exercises.map((ex, idx) => (
               <div key={idx} className="bg-[#111] border border-white/10 rounded-xl p-4 relative group">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-bold text-lg">{ex.name}</span>
                    <button onClick={() => removeExercise(idx)} className="text-gray-600 hover:text-red-500"><Trash2 size={18} /></button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold">Series</label>
                      <input 
                        type="number" 
                        value={ex.targetSets}
                        onChange={(e) => updateExercise(idx, 'targetSets', parseInt(e.target.value))}
                        className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold">Reps</label>
                      <input 
                        type="text" 
                        value={ex.targetReps}
                        onChange={(e) => updateExercise(idx, 'targetReps', e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold text-yellow-500">Carga</label>
                      <input 
                        type="text" 
                        value={ex.targetLoad || ''}
                        onChange={(e) => updateExercise(idx, 'targetLoad', e.target.value)}
                        placeholder="Ej: 80kg"
                        className="w-full bg-black border border-yellow-500/20 rounded-lg p-2 text-sm text-center font-bold text-yellow-400 placeholder-gray-700"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Notas Técnicas</label>
                    <input 
                      type="text" 
                      value={ex.coachCue || ''}
                      onChange={(e) => updateExercise(idx, 'coachCue', e.target.value)}
                      placeholder="Instrucciones específicas..."
                      className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-gray-300"
                    />
                  </div>
               </div>
             ))}

             <button 
               onClick={() => setShowExerciseSelector(true)}
               className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-gray-500 font-bold hover:border-red-500/50 hover:text-red-500 transition-colors flex items-center justify-center gap-2"
             >
               <Plus size={20} /> AÑADIR EJERCICIO
             </button>
          </div>
        ) : (
          <div className="text-center text-gray-500 mt-10">Agrega un día de entrenamiento para comenzar.</div>
        )}
      </div>

      {/* Exercise Selector Modal */}
      {showExerciseSelector && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col animate-fade-in">
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#0A0A0C]">
             <button onClick={() => setShowExerciseSelector(false)}><ChevronLeft size={24} /></button>
             <div className="flex-1 bg-white/10 rounded-lg flex items-center px-3 py-2">
               <Search size={18} className="text-gray-400" />
               <input 
                 autoFocus
                 className="bg-transparent border-none outline-none text-sm ml-2 w-full text-white"
                 placeholder="Buscar ejercicio..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
               />
             </div>
          </div>
          
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto p-2 border-b border-white/5 no-scrollbar bg-[#0A0A0C]">
             {categories.map(cat => (
               <button 
                 key={cat}
                 onClick={() => setActiveCategory(cat)}
                 className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400'}`}
               >
                 {cat}
               </button>
             ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 grid gap-2 pb-20">
            {filteredExercises.map(ex => (
              <button 
                key={ex.id}
                onClick={() => handleAddExercise(ex)}
                className="bg-[#111] border border-white/5 p-4 rounded-xl text-left hover:border-red-500 transition-colors flex justify-between items-center"
              >
                <div>
                  <div className="font-bold text-sm">{ex.name}</div>
                  <div className="text-[10px] text-gray-500 uppercase bg-white/5 inline-block px-1.5 rounded mt-1">{ex.muscleGroup}</div>
                </div>
                <Plus size={18} className="text-gray-600" />
              </button>
            ))}
            {filteredExercises.length === 0 && (
              <div className="text-center text-gray-500 mt-10">
                No se encontraron ejercicios en esta categoría.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'workouts' | 'profile'>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [triggerUpdate, setTriggerUpdate] = useState(0); 

  useEffect(() => {
    DataEngine.init();
    const session = localStorage.getItem(SESSION_KEY);
    if (session) setCurrentUser(JSON.parse(session));

    const handleStorageUpdate = () => setTriggerUpdate(prev => prev + 1);
    window.addEventListener('storage-update', handleStorageUpdate);
    return () => window.removeEventListener('storage-update', handleStorageUpdate);
  }, []);

  const handleLogin = useCallback((user: User) => {
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    setActiveTab('dashboard');
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
    setSelectedClientId(null);
    setActiveTab('dashboard');
  };

  const navigateToClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveTab('clients');
  };

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-[#050507] text-white pb-24 md:pb-0 font-sans selection:bg-red-500/30">
      <ConnectionStatus />
      
      {/* HEADER MOBILE */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#050507]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2" onClick={() => setActiveTab('dashboard')}>
           <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-display italic font-bold shadow-lg shadow-red-900/40">K</div>
           <span className="font-display font-bold italic tracking-tighter">KINETIX</span>
        </div>
        <div className="flex items-center gap-3">
           {currentUser.role === 'coach' && (
             <button onClick={() => DataEngine.pullFromCloud()} className="p-2 bg-white/5 rounded-full active:bg-white/10">
                <RefreshCw size={16} className="text-gray-400" />
             </button>
           )}
           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-800 border border-white/20 flex items-center justify-center font-bold text-xs" onClick={() => setActiveTab('profile')}>
             {currentUser.name[0]}
           </div>
        </div>
      </header>

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-white/5 bg-[#050507]">
        <div className="p-8 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <h1 className="font-display text-3xl italic font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-white">KINETIX</h1>
          <p className="text-xs text-gray-500 tracking-[0.3em] font-bold mt-1">ELITE ZONE</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedClientId(null); }} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          {currentUser.role === 'coach' && (
             <>
                <NavButton active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setSelectedClientId(null); }} icon={<Users size={20} />} label="Atletas" />
                <NavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={<Dumbbell size={20} />} label="Biblioteca" />
             </>
          )}
        </nav>
        <div className="p-4 border-t border-white/5">
          <button onClick={handleLogout} className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors w-full p-3 rounded-xl hover:bg-white/5">
            <LogOut size={20} /> <span className="font-medium">Salir</span>
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <main className="md:ml-64 p-4 md:p-8 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
        {activeTab === 'dashboard' && <DashboardView user={currentUser} onNavigateToClients={() => setActiveTab(currentUser.role === 'coach' ? 'clients' : 'dashboard')} />}
        
        {activeTab === 'clients' && currentUser.role === 'coach' && !selectedClientId && (
          <ClientsView onSelectClient={navigateToClient} />
        )}
        
        {activeTab === 'clients' && currentUser.role === 'coach' && selectedClientId && (
          <ClientDetailView clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />
        )}
        
        {activeTab === 'workouts' && currentUser.role === 'coach' && <WorkoutsView />}
        
        {activeTab === 'profile' && (
          <div className="animate-fade-in p-4">
             <h2 className="text-2xl font-bold mb-6">Mi Perfil</h2>
             <div className="bg-[#0F0F11] rounded-2xl p-6 border border-white/5 mb-6">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold">{currentUser.name[0]}</div>
                   <div>
                      <h3 className="font-bold text-lg">{currentUser.name}</h3>
                      <p className="text-gray-400 text-sm">{currentUser.email}</p>
                      <span className="text-[10px] uppercase bg-white/10 px-2 py-1 rounded mt-1 inline-block">{currentUser.role}</span>
                   </div>
                </div>
                {currentUser.role === 'client' && (
                  <div className="mt-4 p-4 bg-blue-600/10 rounded-xl border border-blue-600/20">
                    <p className="text-sm text-blue-300 font-bold flex items-center gap-2">
                       <Info size={16} /> Credenciales
                    </p>
                    <p className="text-xs text-gray-400 mt-1">Usa tu Nombre ({currentUser.name}) o tu Email ({currentUser.email}) para iniciar sesión.</p>
                  </div>
                )}
             </div>
             <button onClick={handleLogout} className="w-full bg-red-600/10 text-red-500 py-4 rounded-xl font-bold border border-red-500/20 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2">
                <LogOut size={20} /> CERRAR SESIÓN
             </button>
          </div>
        )}
      </main>

      {/* MOBILE NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0A0A0C]/95 backdrop-blur-xl border-t border-white/10 flex justify-around p-2 z-50 pb-safe shadow-2xl">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedClientId(null); }} icon={<LayoutDashboard size={20} />} label="Inicio" />
        {currentUser.role === 'coach' && (
           <>
             <MobileNavButton active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setSelectedClientId(null); }} icon={<Users size={20} />} label="Atletas" />
             <MobileNavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={<Dumbbell size={20} />} label="Entreno" />
           </>
        )}
        <MobileNavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<Menu size={20} />} label="Perfil" />
      </nav>
    </div>
  );
}

// --- VIEW COMPONENTS ---

const DashboardView = ({ user, onNavigateToClients }: { user: User, onNavigateToClients: () => void }) => {
  const [athletePlan, setAthletePlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (user.role === 'client') {
       setAthletePlan(DataEngine.getPlan(user.id));
    }
  }, [user]);

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="bg-gradient-to-r from-red-900/40 to-black border border-red-500/20 rounded-3xl p-6 relative overflow-hidden group cursor-pointer" onClick={user.role === 'coach' ? onNavigateToClients : undefined}>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-sm tracking-wider uppercase">
             <Activity size={16} /> Panel de Control
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold italic mb-2">HOLA, {user.name.split(' ')[0]}</h2>
          <p className="text-gray-400 max-w-md text-sm">
            {user.role === 'coach' ? 'Gestiona tus atletas de alto rendimiento.' : 'Tu transformación comienza hoy.'}
          </p>
        </div>
        <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        {user.role === 'coach' && <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white transition-colors" size={32} />}
      </div>

      {user.role === 'coach' ? (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="Atletas" value={DataEngine.getUsers().length - 1} icon={<Users size={18} className="text-blue-400" />} />
            <StatCard label="Planes Activos" value="12" icon={<CalendarDays size={18} className="text-green-400" />} />
            <StatCard label="Ejercicios DB" value={DataEngine.getExercises().length} icon={<Dumbbell size={18} className="text-gray-400" />} />
            <StatCard label="Estado" value="Activo" icon={<CheckCircle2 size={18} className="text-green-400" />} />
         </div>
      ) : (
         <div className="grid grid-cols-2 gap-3">
             <StatCard label="Racha" value={`${user.streak} días`} icon={<Zap size={18} className="text-yellow-400" />} />
             <StatCard label="Nivel" value={user.level} icon={<Trophy size={18} className="text-purple-400" />} />
         </div>
      )}

      {user.role === 'client' && (
         <div className="space-y-4">
            <h3 className="text-xl font-bold border-b border-white/10 pb-2">Tu Protocolo</h3>
            {athletePlan ? (
              <PlanViewer plan={athletePlan} mode="athlete" />
            ) : (
              <div className="p-8 bg-white/5 rounded-3xl border border-white/5 border-dashed text-center">
                 <BrainCircuit className="mx-auto text-gray-600 mb-4" size={48} />
                 <p className="text-gray-400 font-medium">Tu Coach aún no ha asignado un protocolo.</p>
                 <p className="text-xs text-gray-600 mt-2">Mantente atento.</p>
              </div>
            )}
         </div>
      )}
    </div>
  );
};

const ClientsView = ({ onSelectClient }: { onSelectClient: (id: string) => void }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Estado compartido para Crear o Editar
  const [tempUser, setTempUser] = useState<Partial<User>>({
    name: '', email: '', goal: Goal.PERFORMANCE, level: UserLevel.INTERMEDIATE, daysPerWeek: 4
  });

  const refreshUsers = useCallback(() => {
     setUsers(DataEngine.getUsers().filter(u => u.role === 'client'));
  }, []);

  useEffect(() => { refreshUsers(); }, [refreshUsers]);

  const handleCreateUser = async () => {
    if (!tempUser.name) return;
    const userToSave: User = {
      id: generateUUID(), name: tempUser.name, email: tempUser.email || 'no-email',
      goal: tempUser.goal as Goal, level: tempUser.level as UserLevel, role: 'client',
      daysPerWeek: tempUser.daysPerWeek || 4, equipment: [], streak: 0, createdAt: new Date().toISOString()
    };
    await DataEngine.saveUser(userToSave);
    refreshUsers();
    setShowAddModal(false);
    setTempUser({ name: '', email: '', goal: Goal.PERFORMANCE, level: UserLevel.INTERMEDIATE, daysPerWeek: 4 });
  };

  const handleUpdateUser = () => {
     if (!tempUser.id || !tempUser.name) return;
     // Recuperar el usuario original para no perder datos como equipment, streak, etc.
     const originalUser = DataEngine.getUserById(tempUser.id);
     if (!originalUser) return;
     
     const updatedUser: User = {
        ...originalUser,
        name: tempUser.name,
        email: tempUser.email || originalUser.email,
        goal: tempUser.goal as Goal,
        level: tempUser.level as UserLevel,
        daysPerWeek: tempUser.daysPerWeek || originalUser.daysPerWeek
     };
     
     DataEngine.updateUser(updatedUser);
     refreshUsers();
     setShowEditModal(false);
     setTempUser({ name: '', email: '', goal: Goal.PERFORMANCE, level: UserLevel.INTERMEDIATE, daysPerWeek: 4 });
  };

  const handleDeleteUser = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("¿Estás seguro de eliminar a este atleta y su plan?")) {
      DataEngine.deleteUser(id);
      refreshUsers();
    }
  };

  const openEditModal = (e: React.MouseEvent, user: User) => {
    e.stopPropagation();
    setTempUser(user);
    setShowEditModal(true);
  };

  const openCreateModal = () => {
     setTempUser({ name: '', email: '', goal: Goal.PERFORMANCE, level: UserLevel.INTERMEDIATE, daysPerWeek: 4 });
     setShowAddModal(true);
  }

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold">Atletas</h2>
           <p className="text-xs text-gray-500">Gestión de equipo</p>
        </div>
        <button onClick={openCreateModal} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-500 active:scale-95 transition-all">
          <UserPlus size={16} /> <span>NUEVO</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {users.map(client => (
          <div 
            key={client.id} 
            onClick={() => onSelectClient(client.id)}
            className="bg-[#0F0F11] border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-red-500/30 hover:bg-white/5 transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center font-bold text-sm border border-white/10 group-hover:border-red-500/50 transition-colors z-10 relative">
              {client.name.charAt(0)}
            </div>
            <div className="flex-1 z-10 relative">
              <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors">{client.name}</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{client.goal}</p>
            </div>
            <div className="flex items-center gap-1 z-20">
               <button 
                 onClick={(e) => openEditModal(e, client)} 
                 className="p-2 text-gray-600 hover:text-white hover:bg-white/10 rounded-full transition-colors"
               >
                 <Pencil size={16} />
               </button>
               <button 
                 onClick={(e) => handleDeleteUser(e, client.id)} 
                 className="p-2 text-gray-600 hover:text-red-500 hover:bg-white/10 rounded-full transition-colors"
               >
                 <Trash2 size={16} />
               </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL CREAR */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in-up">
            <h3 className="text-lg font-bold mb-2">Nuevo Atleta</h3>
            <div className="space-y-3">
              <input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none" placeholder="Nombre Completo" value={tempUser.name} onChange={e => setTempUser({...tempUser, name: e.target.value})} />
              <input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none" placeholder="Email" value={tempUser.email} onChange={e => setTempUser({...tempUser, email: e.target.value})} />
              <div className="grid grid-cols-2 gap-2">
                 <select className="bg-black/50 border border-white/10 rounded-lg p-3 text-sm outline-none" value={tempUser.goal} onChange={e => setTempUser({...tempUser, goal: e.target.value as Goal})}>
                    {Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}
                 </select>
                 <select className="bg-black/50 border border-white/10 rounded-lg p-3 text-sm outline-none" value={tempUser.level} onChange={e => setTempUser({...tempUser, level: e.target.value as UserLevel})}>
                    {Object.values(UserLevel).map(l => <option key={l} value={l}>{l}</option>)}
                 </select>
              </div>
              <div className="flex gap-2 pt-2">
                 <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-xs font-bold text-gray-400">CANCELAR</button>
                 <button onClick={handleCreateUser} className="flex-1 py-3 rounded-xl bg-red-600 text-xs font-bold">CREAR</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-fade-in-up">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2"><UserCog size={20}/> Editar Atleta</h3>
            <div className="space-y-3">
              <div>
                 <label className="text-[10px] text-gray-500 font-bold uppercase">Nombre</label>
                 <input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none" value={tempUser.name} onChange={e => setTempUser({...tempUser, name: e.target.value})} />
              </div>
              <div>
                 <label className="text-[10px] text-gray-500 font-bold uppercase">Email (Login)</label>
                 <input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none" value={tempUser.email} onChange={e => setTempUser({...tempUser, email: e.target.value})} />
              </div>
              <div>
                 <label className="text-[10px] text-gray-500 font-bold uppercase">Objetivo</label>
                 <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm outline-none" value={tempUser.goal} onChange={e => setTempUser({...tempUser, goal: e.target.value as Goal})}>
                    {Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}
                 </select>
              </div>
              <div>
                 <label className="text-[10px] text-gray-500 font-bold uppercase">Nivel</label>
                 <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm outline-none" value={tempUser.level} onChange={e => setTempUser({...tempUser, level: e.target.value as UserLevel})}>
                    {Object.values(UserLevel).map(l => <option key={l} value={l}>{l}</option>)}
                 </select>
              </div>
              <div className="flex gap-2 pt-2">
                 <button onClick={() => setShowEditModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-xs font-bold text-gray-400">CANCELAR</button>
                 <button onClick={handleUpdateUser} className="flex-1 py-3 rounded-xl bg-blue-600 text-xs font-bold">GUARDAR CAMBIOS</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
  const user = useMemo(() => DataEngine.getUserById(clientId), [clientId]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const refreshPlan = useCallback(() => setPlan(DataEngine.getPlan(clientId)), [clientId]);

  useEffect(() => { refreshPlan(); }, [refreshPlan]);

  const handleGenerateAI = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const newPlan = await generateSmartRoutine(user);
      const fullPlan: Plan = {
        ...newPlan,
        id: generateUUID(),
        userId: user.id,
        updatedAt: new Date().toISOString()
      };
      await DataEngine.savePlan(fullPlan);
      refreshPlan();
    } catch (e) {
      alert("Error generando rutina. Intenta de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleManualSave = (updatedPlan: Plan) => {
    DataEngine.savePlan({...updatedPlan, updatedAt: new Date().toISOString()});
    refreshPlan();
    setIsEditing(false);
  };

  const handleNewManualPlan = () => {
    if (!user) return;
    const newPlan: Plan = {
      id: generateUUID(),
      title: 'Nuevo Protocolo Manual',
      userId: user.id,
      workouts: [],
      updatedAt: new Date().toISOString()
    };
    setPlan(newPlan);
    setIsEditing(true);
  };

  if (!user) return <div>Usuario no encontrado</div>;

  if (isEditing && plan) {
    return <ManualPlanBuilder plan={plan} onSave={handleManualSave} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div className="animate-fade-in pb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm font-medium">
        <ChevronLeft size={16} /> Volver
      </button>

      <div className="bg-[#0F0F11] border border-white/5 rounded-3xl p-6 mb-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-2xl font-bold font-display italic shadow-lg shadow-red-900/50">
              {user.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{user.name}</h1>
              <div className="flex gap-2 mt-1">
                <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] uppercase font-bold text-gray-300">{user.goal}</span>
                <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] uppercase font-bold text-gray-300">{user.level}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={handleGenerateAI}
              disabled={isGenerating}
              className="bg-white/10 border border-white/20 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-white/20 transition-all disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
              <span className="hidden md:inline">GENERAR IA</span>
            </button>
            <button 
              onClick={() => plan ? setIsEditing(true) : handleNewManualPlan()}
              className="bg-red-600 text-white px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500 transition-all shadow-lg shadow-red-900/30"
            >
              {plan ? <Edit3 size={18} /> : <Plus size={18} />}
              {plan ? 'EDITAR' : 'CREAR MANUAL'}
            </button>
          </div>
        </div>
      </div>

      {!plan ? (
        <div className="text-center py-20 bg-[#0F0F11] rounded-3xl border border-white/5 border-dashed">
          <BrainCircuit className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-500 font-medium">Sin protocolo activo</p>
          <div className="flex justify-center gap-4 mt-4">
             <button onClick={handleGenerateAI} className="text-sm text-red-500 font-bold hover:underline">Generar con IA</button>
             <span className="text-gray-700">|</span>
             <button onClick={handleNewManualPlan} className="text-sm text-white font-bold hover:underline">Crear Manualmente</button>
          </div>
        </div>
      ) : (
         <PlanViewer plan={plan} />
      )}
    </div>
  );
};

const WorkoutsView = () => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('Todos');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newExercise, setNewExercise] = useState<Partial<Exercise>>({
    name: '', muscleGroup: 'Pecho', videoUrl: '', technique: ''
  });

  useEffect(() => {
    setExercises(DataEngine.getExercises());
  }, []);

  const handleAddExercise = () => {
     if(!newExercise.name) return;
     const ex: Exercise = {
       id: generateUUID(),
       name: newExercise.name,
       muscleGroup: newExercise.muscleGroup || 'Pecho',
       videoUrl: newExercise.videoUrl || '',
       technique: newExercise.technique || '',
       commonErrors: []
     };
     DataEngine.addExercise(ex);
     setExercises(DataEngine.getExercises());
     setIsAddOpen(false);
     setNewExercise({ name: '', muscleGroup: 'Pecho', videoUrl: '', technique: '' });
  };

  const filtered = exercises.filter(e => 
    (filter === 'Todos' || e.muscleGroup === filter) &&
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  const categories = useMemo(() => {
      const unique = Array.from(new Set(exercises.map(e => e.muscleGroup)));
      return ['Todos', ...unique];
  }, [exercises]);

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-bold">Biblioteca de Ejercicios</h2>
         <button onClick={() => setIsAddOpen(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2">
           <Plus size={16} /> <span className="hidden md:inline">NUEVO EJERCICIO</span>
         </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
         <div className="flex-1 bg-[#0F0F11] border border-white/5 rounded-xl flex items-center px-4 py-3">
            <Search size={18} className="text-gray-500" />
            <input 
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por nombre..."
              className="bg-transparent border-none outline-none text-sm ml-2 w-full placeholder-gray-600"
            />
         </div>
         <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
           {categories.map(cat => (
             <button 
               key={cat} onClick={() => setFilter(cat)}
               className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${filter === cat ? 'bg-white text-black' : 'bg-[#0F0F11] text-gray-400 border border-white/5 hover:border-white/20'}`}
             >
               {cat}
             </button>
           ))}
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
         {filtered.map(ex => (
           <div key={ex.id} className="bg-[#0F0F11] border border-white/5 rounded-xl p-4 hover:border-red-500/30 transition-colors group flex justify-between items-start">
              <div>
                 <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors">{ex.name}</h3>
                 <span className="text-[10px] text-gray-500 uppercase bg-white/5 px-2 py-1 rounded mt-2 inline-block font-bold">{ex.muscleGroup}</span>
              </div>
              {ex.videoUrl && <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-red-500 p-2 bg-white/5 rounded-lg"><Play size={16} /></a>}
           </div>
         ))}
      </div>

      {isAddOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
           <div className="bg-[#111] border border-white/10 w-full max-w-md rounded-2xl p-6 shadow-2xl animate-fade-in-up">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="text-lg font-bold">Nuevo Ejercicio</h3>
                 <button onClick={() => setIsAddOpen(false)}><X size={20} className="text-gray-400" /></button>
              </div>
              <div className="space-y-4">
                 <div>
                    <label className="text-[10px] uppercase text-gray-500 font-bold">Nombre</label>
                    <input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none transition-colors" placeholder="Ej: Press Banca" value={newExercise.name} onChange={e => setNewExercise({...newExercise, name: e.target.value})} />
                 </div>
                 <div>
                    <label className="text-[10px] uppercase text-gray-500 font-bold">Grupo Muscular</label>
                    <select className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm text-gray-300 outline-none" value={newExercise.muscleGroup} onChange={e => setNewExercise({...newExercise, muscleGroup: e.target.value})}>
                        {categories.filter(c => c !== 'Todos').map(c => <option key={c} value={c}>{c}</option>)}
                        <option value="Otro">Otro</option>
                    </select>
                 </div>
                 <div>
                    <label className="text-[10px] uppercase text-gray-500 font-bold">Video URL</label>
                    <input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none transition-colors" placeholder="https://youtube.com..." value={newExercise.videoUrl} onChange={e => setNewExercise({...newExercise, videoUrl: e.target.value})} />
                 </div>
                 <button onClick={handleAddExercise} className="w-full py-3 rounded-xl bg-red-600 text-sm font-bold text-white hover:bg-red-500 transition-colors mt-2">GUARDAR EJERCICIO</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
