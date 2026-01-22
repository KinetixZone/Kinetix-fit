
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer as TimerIcon, Download, Upload, Filter, Clock, Database, FileJson, Cloud, CloudOff,
  Wifi, WifiOff, AlertTriangle, Smartphone, Signal, Globe, Loader2, BrainCircuit,
  CalendarDays, Trophy, Pencil, Menu, Youtube, Info, UserMinus, UserCog, Circle, CheckCircle,
  MoreVertical, Flame, StopCircle, ClipboardList
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, SetEntry, WorkoutProgress } from './types';
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

const formatDate = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
};

// --- SYSTEM CONSTANTS ---
const COACH_UUID = 'e9c12345-6789-4321-8888-999999999999';
const STORAGE_KEY = 'KINETIX_DATA_PRO_V3'; 
const SESSION_KEY = 'KINETIX_SESSION_PRO_V3';

// --- DATA ENGINE (ENHANCED V3 - HISTORY SUPPORT) ---
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
    if (!store.USERS) store.USERS = JSON.stringify([MOCK_USER]);
    
    // Merge Exercises
    const storedExercises = store.EXERCISES ? JSON.parse(store.EXERCISES) : [];
    const mergedExercises = [...INITIAL_EXERCISES];
    storedExercises.forEach((se: Exercise) => {
      if (!mergedExercises.find(me => me.id === se.id)) mergedExercises.push(se);
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

  getUserByNameOrEmail: (query: string): User | undefined => {
    const users = DataEngine.getUsers();
    const q = query.toLowerCase().trim();
    return users.find(u => u.email.toLowerCase() === q || u.name.toLowerCase() === q);
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
    delete s[`PLAN_${userId}`];
    DataEngine.saveStore(s);
  },

  // --- PROGRESS & HISTORY ---
  
  // Guardar log temporal (sesión activa)
  saveSetLog: (userId: string, workoutId: string, exerciseIndex: number, setEntry: SetEntry) => {
    const s = DataEngine.getStore();
    const key = `LOG_TEMP_${userId}_${workoutId}`; // Cambiado a LOG_TEMP
    const currentLog: WorkoutProgress = s[key] ? JSON.parse(s[key]) : {};
    
    if (!currentLog[exerciseIndex]) currentLog[exerciseIndex] = [];
    
    const existingSetIndex = currentLog[exerciseIndex].findIndex(s => s.setNumber === setEntry.setNumber);
    if (existingSetIndex >= 0) {
      currentLog[exerciseIndex][existingSetIndex] = setEntry;
    } else {
      currentLog[exerciseIndex].push(setEntry);
    }

    s[key] = JSON.stringify(currentLog);
    DataEngine.saveStore(s);
  },

  getWorkoutLog: (userId: string, workoutId: string): WorkoutProgress => {
    const s = DataEngine.getStore();
    const key = `LOG_TEMP_${userId}_${workoutId}`;
    return s[key] ? JSON.parse(s[key]) : {};
  },

  // Archivar sesión completada
  archiveWorkout: (userId: string, workout: Workout, logs: WorkoutProgress) => {
    const s = DataEngine.getStore();
    const historyKey = `HISTORY_${userId}`;
    const currentHistory = s[historyKey] ? JSON.parse(s[historyKey]) : [];
    
    const session = {
      id: generateUUID(),
      workoutName: workout.name,
      workoutId: workout.id,
      date: new Date().toISOString(),
      logs: logs,
      summary: {
         exercisesCompleted: Object.keys(logs).length,
         totalVolume: Object.values(logs).flat().reduce((acc, curr) => acc + (parseFloat(curr.weight) || 0) * (parseFloat(curr.reps) || 0), 0)
      }
    };
    
    // Guardar en historial
    currentHistory.unshift(session); // Lo más nuevo primero
    s[historyKey] = JSON.stringify(currentHistory);
    
    // Limpiar log temporal para que la próxima vez esté limpio
    delete s[`LOG_TEMP_${userId}_${workout.id}`];
    
    // Actualizar racha si es un día nuevo
    // (Lógica simplificada)
    const users = JSON.parse(s.USERS || '[]');
    const uIdx = users.findIndex((u:User) => u.id === userId);
    if(uIdx >= 0) {
        users[uIdx].streak += 1;
        s.USERS = JSON.stringify(users);
    }

    DataEngine.saveStore(s);
    return session;
  },

  getClientHistory: (userId: string) => {
    const s = DataEngine.getStore();
    const historyKey = `HISTORY_${userId}`;
    return s[historyKey] ? JSON.parse(s[historyKey]) : [];
  },

  // Obtener último peso registrado para un ejercicio
  getLastLogForExercise: (userId: string, exerciseName: string): {weight: string, reps: string} | null => {
    const history = DataEngine.getClientHistory(userId);
    // Buscar en las sesiones pasadas
    for (const session of history) {
        // En cada sesión, revisar los logs. 
        // Nota: Esto asume que podemos mapear exerciseIndex -> exerciseName, lo cual es difícil solo con logs.
        // Mejora: Idealmente guardaríamos el ID del ejercicio en el log, pero por ahora buscaremos en la estructura.
        // Dado que WorkoutProgress usa índices, necesitamos el plan original para mapear, lo cual es complejo aquí.
        // Simplificación: Guardamos el nombre en el log al archivar o simplemente devolvemos null por ahora si no cambiamos la estructura de log.
        // Para esta versión V3, vamos a confiar en que el usuario vea su historial general.
    }
    return null; 
  }
};

// --- COMPONENTS ---

const RestTimer = ({ initialSeconds = 60, onComplete, onClose }: { initialSeconds?: number, onComplete?: () => void, onClose: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [totalTime, setTotalTime] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    setTimeLeft(initialSeconds);
    setTotalTime(initialSeconds);
    setIsActive(true);
  }, [initialSeconds]);

  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) {
      interval = setInterval(() => {
        setTimeLeft((seconds) => seconds - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (onComplete) onComplete();
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);

  const changeTime = (seconds: number) => {
      const newTime = seconds;
      setTimeLeft(newTime);
      setTotalTime(newTime);
      setIsActive(true);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed bottom-24 right-4 md:right-8 bg-[#1A1A1D] border border-red-500/50 text-white p-4 rounded-2xl shadow-2xl z-50 flex flex-col gap-3 animate-fade-in-up w-[280px]">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0">
           <svg className="w-12 h-12 transform -rotate-90">
             <circle cx="24" cy="24" r="20" stroke="#333" strokeWidth="4" fill="transparent" />
             <circle cx="24" cy="24" r="20" stroke="#EF4444" strokeWidth="4" fill="transparent" strokeDasharray={125} strokeDashoffset={125 - (125 * timeLeft) / (totalTime || 1)} className="transition-all duration-1000 ease-linear" />
           </svg>
           <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center font-mono font-bold text-sm">{formatTime(timeLeft)}</div>
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-400 font-bold uppercase mb-1">Descanso Activo</p>
          <div className="flex gap-2">
             <button onClick={() => setTimeLeft(prev => prev + 30)} className="px-2 py-1 bg-white/10 rounded text-xs font-bold hover:bg-white/20">+30s</button>
             <button onClick={() => setIsActive(!isActive)} className="px-2 py-1 bg-white/10 rounded text-xs font-bold hover:bg-white/20">{isActive ? 'Pausa' : 'Seguir'}</button>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white self-start"><X size={16}/></button>
      </div>
      <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-2">
          {[30, 60, 90, 120].map(sec => (
             <button key={sec} onClick={() => changeTime(sec)} className={`text-[10px] font-bold py-1 rounded hover:bg-white/10 ${totalTime === sec ? 'text-red-500 bg-red-500/10' : 'text-gray-500'}`}>
               {sec}s
             </button>
          ))}
      </div>
    </div>
  );
};

const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(supabaseConnectionStatus.isConfigured);
  return (
    <div className={`fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 backdrop-blur-md border ${isOnline ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
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

// --- EXERCISE CARD ---

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  index: number;
  workoutId: string;
  userId: string;
  onShowVideo: (name: string) => void;
  mode: 'coach' | 'athlete';
  onSetComplete: (restSeconds?: number) => void;
  history?: any[]; // Historial pasado
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ 
  exercise, 
  index, 
  workoutId, 
  userId, 
  onShowVideo, 
  mode,
  onSetComplete,
  history
}) => {
  const [logs, setLogs] = useState<WorkoutProgress>({});
  
  // Encontrar el último peso registrado para este ejercicio en el historial
  // (Nota: Esto es una búsqueda simplificada basada en el índice, idealmente usaría IDs persistentes)
  const lastSessionData = useMemo(() => {
      if(!history || history.length === 0) return null;
      // Buscar la sesión más reciente que tenga datos para este índice de ejercicio
      const lastSession = history[0]; // La primera es la más reciente
      if(lastSession.logs && lastSession.logs[index]) {
          const sets = lastSession.logs[index] as SetEntry[];
          // Retornar el peso del mejor set o el último
          if(sets.length > 0) return sets[sets.length-1];
      }
      return null;
  }, [history, index]);

  useEffect(() => {
    if (mode === 'athlete') {
      const savedLogs = DataEngine.getWorkoutLog(userId, workoutId);
      setLogs(savedLogs);
    }
  }, [userId, workoutId, mode]);

  const handleLogSet = (setNum: number, weight: string, reps: string, isCompleted: boolean) => {
    const entry: SetEntry = {
      setNumber: setNum,
      weight,
      reps,
      completed: isCompleted,
      timestamp: Date.now()
    };
    
    DataEngine.saveSetLog(userId, workoutId, index, entry);
    
    const currentExLogs = logs[index] || [];
    const newExLogs = [...currentExLogs];
    const existingIdx = newExLogs.findIndex(s => s.setNumber === setNum);
    if (existingIdx >= 0) newExLogs[existingIdx] = entry; else newExLogs.push(entry);
    
    setLogs({...logs, [index]: newExLogs});

    if (isCompleted) onSetComplete(exercise.targetRest);
  };

  const setsArray = Array.from({ length: exercise.targetSets }, (_, i) => i + 1);
  const exerciseLogs = logs[index] || [];

  return (
    <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-5 mb-4 shadow-md hover:border-white/10 transition-all">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-bold text-gray-400 text-sm border border-white/5">
             {index + 1}
          </div>
          <div>
            <h3 className="font-bold text-lg text-white leading-tight">{exercise.name}</h3>
            
            {/* Coach Target & Safety Info */}
            <div className="flex flex-wrap gap-2 mt-2 items-center">
                {exercise.targetLoad && (
                <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 px-2 py-1 rounded-md border border-yellow-500/20" title="Carga asignada por el Coach">
                    <ShieldAlert size={12} className="text-yellow-500" />
                    <span className="text-xs font-bold text-yellow-500 uppercase tracking-wide">Meta: {exercise.targetLoad}</span>
                </div>
                )}
                {/* Visualización de historial */}
                {lastSessionData && (
                    <div className="inline-flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded-md border border-white/5">
                        <History size={12} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Prev: {lastSessionData.weight}kg</span>
                    </div>
                )}
            </div>

            {exercise.targetRest && (
                <div className="flex items-center gap-1.5 mt-1">
                    <TimerIcon size={12} className="text-blue-500" />
                    <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wide">Descanso: {exercise.targetRest}s</span>
                </div>
            )}
            
            {exercise.coachCue && (
              <div className="flex items-start gap-1.5 mt-2 text-xs text-blue-300">
                <Info size={12} className="mt-0.5 shrink-0" />
                <p className="italic leading-snug">{exercise.coachCue}</p>
              </div>
            )}
          </div>
        </div>
        <button onClick={() => onShowVideo(exercise.name)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-red-500 transition-colors">
          <Play size={18} />
        </button>
      </div>

      {mode === 'athlete' && (
        <div className="space-y-2 mt-4 bg-black/20 p-3 rounded-xl border border-white/5">
           <div className="grid grid-cols-10 gap-2 text-[10px] text-gray-500 uppercase font-bold text-center mb-1">
              <div className="col-span-1">Set</div>
              <div className="col-span-3">Kg</div>
              <div className="col-span-3">Reps</div>
              <div className="col-span-3">Check</div>
           </div>
           {setsArray.map(setNum => {
             const log = exerciseLogs.find(l => l.setNumber === setNum);
             const isDone = log?.completed;
             
             // Safety Check: Si el usuario pone más peso del target
             const isOverloading = exercise.targetLoad && log?.weight && parseFloat(log.weight) > parseFloat(exercise.targetLoad) * 1.1;

             return (
               <div key={setNum} className={`grid grid-cols-10 gap-2 items-center transition-all ${isDone ? 'opacity-50' : 'opacity-100'}`}>
                 <div className="col-span-1 flex justify-center">
                    <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400">{setNum}</span>
                 </div>
                 <div className="col-span-3 relative">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      // Placeholder es la META del coach (seguridad), no el historial
                      placeholder={exercise.targetLoad || "-"}
                      defaultValue={log?.weight || ''}
                      onBlur={(e) => handleLogSet(setNum, e.target.value, log?.reps || exercise.targetReps, !!isDone)}
                      className={`w-full bg-[#1A1A1D] border ${isOverloading ? 'border-red-500 text-red-500' : 'border-white/10 text-yellow-400'} rounded-md py-1.5 px-1 text-center text-xs font-bold focus:border-yellow-500 outline-none placeholder-gray-700`}
                    />
                 </div>
                 <div className="col-span-3">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      placeholder={exercise.targetReps}
                      defaultValue={log?.reps || ''}
                      onBlur={(e) => handleLogSet(setNum, log?.weight || '', e.target.value, !!isDone)}
                      className="w-full bg-[#1A1A1D] border border-white/10 rounded-md py-1.5 px-1 text-center text-xs text-white focus:border-blue-500 outline-none placeholder-gray-700"
                    />
                 </div>
                 <div className="col-span-3 flex justify-center">
                    <button 
                      onClick={() => handleLogSet(setNum, log?.weight || '', log?.reps || exercise.targetReps, !isDone)}
                      className={`w-full py-1.5 rounded-md flex items-center justify-center transition-all border ${isDone ? 'bg-green-500 border-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                    >
                      {isDone ? <Check size={14} strokeWidth={4} /> : <Circle size={14} />}
                    </button>
                 </div>
               </div>
             );
           })}
        </div>
      )}
      
      {mode === 'coach' && (
         <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-white/5 p-2 rounded-lg">
            <span className="font-bold text-white">{exercise.targetSets}</span> Sets 
            <span className="mx-1">•</span> 
            <span className="font-bold text-white">{exercise.targetReps}</span> Reps
            {exercise.targetRest && (
                <>
                <span className="mx-1">•</span>
                <span className="font-bold text-blue-400">{exercise.targetRest}s</span> Rest
                </>
            )}
         </div>
      )}
    </div>
  );
};


// --- PLAN VIEWER WRAPPER ---
const PlanViewer = ({ plan, mode = 'coach' }: { plan: Plan, mode?: 'coach' | 'athlete' }) => {
  const [showVideo, setShowVideo] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [currentRestTime, setCurrentRestTime] = useState(60);
  const [finishScreen, setFinishScreen] = useState<any | null>(null);
  
  // Cargar historial para mostrar referencias
  const history = useMemo(() => {
     if(mode === 'athlete') return DataEngine.getClientHistory(plan.userId);
     return [];
  }, [plan.userId, mode]);

  const handleSetComplete = useCallback((restSeconds?: number) => {
     setCurrentRestTime(restSeconds || 60);
     setShowTimer(true);
  }, []);

  const handleFinishWorkout = (workout: Workout) => {
     if(confirm("¿Has completado tu sesión? Esto guardará tu progreso en el historial.")) {
         const logs = DataEngine.getWorkoutLog(plan.userId, workout.id);
         const session = DataEngine.archiveWorkout(plan.userId, workout, logs);
         setFinishScreen(session);
         // Forzar actualización de UI para limpiar inputs (usando reload suave o state reset)
         // En React puro, idealmente resetearíamos keys, pero por simplicidad de este archivo único:
         setTimeout(() => window.dispatchEvent(new Event('storage-update')), 500);
     }
  };

  if (finishScreen) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in space-y-6">
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.5)] mb-4">
                  <Trophy size={48} className="text-black ml-1" />
              </div>
              <div>
                  <h2 className="text-4xl font-display font-black italic text-white">¡SESIÓN COMPLETADA!</h2>
                  <p className="text-gray-400 mt-2">Buen trabajo, {MOCK_USER.name.split(' ')[0]}.</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8">
                  <div className="bg-[#0F0F11] border border-white/10 p-4 rounded-xl">
                      <div className="text-3xl font-bold text-white">{finishScreen.summary.exercisesCompleted}</div>
                      <div className="text-[10px] uppercase text-gray-500 font-bold">Ejercicios</div>
                  </div>
                  <div className="bg-[#0F0F11] border border-white/10 p-4 rounded-xl">
                      <div className="text-3xl font-bold text-white">{(finishScreen.summary.totalVolume / 1000).toFixed(1)}k</div>
                      <div className="text-[10px] uppercase text-gray-500 font-bold">Volumen (Kg)</div>
                  </div>
              </div>

              <button onClick={() => setFinishScreen(null)} className="mt-8 bg-white text-black px-8 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                  VOLVER AL DASHBOARD
              </button>
          </div>
      )
  }

  return (
    <div className="space-y-6 animate-fade-in relative pb-20">
      <div className="flex items-center justify-between sticky top-0 bg-[#050507]/90 backdrop-blur-xl z-30 py-4 border-b border-white/5">
        <h2 className="text-xl font-bold flex items-center gap-2 text-white">
          <CalendarDays size={20} className="text-red-500" />
          {plan.title}
        </h2>
        {mode === 'athlete' && <span className="text-[10px] font-black tracking-widest text-green-400 px-3 py-1 bg-green-900/20 rounded-full border border-green-500/20 flex items-center gap-1"><Flame size={12}/> ACTIVE MODE</span>}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {plan.workouts.map((workout) => (
          <div key={workout.id}>
             <div className="flex items-center gap-2 mb-4">
                <div className="h-px bg-white/10 flex-1"/>
                <span className="text-xs font-bold text-red-500 uppercase tracking-widest">DÍA {workout.day} • {workout.name}</span>
                <div className="h-px bg-white/10 flex-1"/>
             </div>
             
             {workout.exercises.map((ex, idx) => (
                <ExerciseCard 
                   key={idx} 
                   exercise={ex} 
                   index={idx} 
                   workoutId={workout.id} 
                   userId={plan.userId} 
                   onShowVideo={setShowVideo} 
                   mode={mode}
                   onSetComplete={handleSetComplete}
                   history={history}
                />
             ))}
             
             {mode === 'athlete' && (
                 <button 
                    onClick={() => handleFinishWorkout(workout)}
                    className="w-full mt-4 bg-green-600 hover:bg-green-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 transition-all active:scale-[0.98]"
                 >
                    <CheckCircle2 size={20} /> FINALIZAR ENTRENAMIENTO
                 </button>
             )}
          </div>
        ))}
      </div>

      {/* VIDEO MODAL */}
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
                    Mantén la tensión mecánica. Prioriza la técnica sobre el peso.
                    <br/><br/>
                    <span className="text-yellow-500 font-bold">Kinetix Tip:</span> Si llegas al fallo técnico, detente.
                 </p>
               </div>
            </div>
         </div>
      )}

      {/* REST TIMER */}
      {showTimer && mode === 'athlete' && (
         <RestTimer 
           initialSeconds={currentRestTime} 
           onClose={() => setShowTimer(false)} 
         />
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
      targetRest: 60, // Default rest time
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
                  
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold">Series</label>
                      <input 
                        type="number" 
                        inputMode="numeric"
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
                      <label className="text-[10px] text-gray-500 uppercase font-bold text-yellow-500">Carga (Kg)</label>
                      <input 
                        type="text" 
                        inputMode="decimal"
                        value={ex.targetLoad || ''}
                        onChange={(e) => updateExercise(idx, 'targetLoad', e.target.value)}
                        placeholder="Ej: 80"
                        className="w-full bg-black border border-yellow-500/20 rounded-lg p-2 text-sm text-center font-bold text-yellow-400 placeholder-gray-700"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 uppercase font-bold text-blue-500">Descanso(s)</label>
                      <input 
                        type="number" 
                        inputMode="numeric"
                        value={ex.targetRest || ''}
                        onChange={(e) => updateExercise(idx, 'targetRest', parseInt(e.target.value))}
                        placeholder="60"
                        className="w-full bg-black border border-blue-500/20 rounded-lg p-2 text-sm text-center font-bold text-blue-400 placeholder-gray-700"
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

// --- DASHBOARD VIEW ---
const DashboardView = ({ user, onNavigateToClients }: { user: User, onNavigateToClients: () => void }) => {
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (user.role === 'client') {
      const p = DataEngine.getPlan(user.id);
      setPlan(p);
    }
  }, [user]);

  if (user.role === 'coach') {
    const clients = DataEngine.getUsers().filter(u => u.role === 'client');
    const activePlans = clients.filter(c => DataEngine.getPlan(c.id)).length;
    
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
           <StatCard label="Atletas" value={clients.length} icon={<Users size={20} className="text-blue-500" />} />
           <StatCard label="Planes" value={activePlans} icon={<FileJson size={20} className="text-green-500" />} />
           <StatCard label="Ejercicios" value={DataEngine.getExercises().length} icon={<Dumbbell size={20} className="text-yellow-500" />} />
           <StatCard label="Sistema" value="ONLINE" icon={<Activity size={20} className="text-red-500" />} />
        </div>
        
        <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-4 text-white">Gestión Rápida</h3>
          <div className="flex gap-4">
             <button onClick={onNavigateToClients} className="bg-white/5 hover:bg-white/10 p-4 rounded-xl flex flex-col items-center gap-2 flex-1 transition-colors border border-white/5 group">
                <div className="p-3 rounded-full bg-red-600/10 group-hover:bg-red-600/20 text-red-500 transition-colors">
                  <UserPlus size={24} />
                </div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white">Nuevo Atleta</span>
             </button>
             <button className="bg-white/5 hover:bg-white/10 p-4 rounded-xl flex flex-col items-center gap-2 flex-1 transition-colors border border-white/5 group">
                <div className="p-3 rounded-full bg-blue-600/10 group-hover:bg-blue-600/20 text-blue-500 transition-colors">
                  <Settings size={24} />
                </div>
                <span className="text-sm font-bold text-gray-300 group-hover:text-white">Ajustes</span>
             </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
         <div>
           <h2 className="text-3xl font-bold font-display italic text-white">HOLA, {user.name.split(' ')[0]}</h2>
           <p className="text-gray-500 text-sm font-medium tracking-wide">NO PAIN, NO GAIN.</p>
         </div>
         <div className="text-right bg-white/5 px-4 py-2 rounded-xl border border-white/5">
           <div className="text-2xl font-bold text-red-500">{user.streak} <span className="text-xs text-gray-400 font-normal">DÍAS</span></div>
           <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Racha</p>
         </div>
      </div>

      {plan ? (
        <PlanViewer plan={plan} mode="athlete" />
      ) : (
        <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
           <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <Clock size={40} className="text-gray-600" />
           </div>
           <h3 className="text-2xl font-bold mb-3 text-white">Plan en Construcción</h3>
           <p className="text-gray-400 max-w-md mx-auto leading-relaxed">
             Tu coach está diseñando tu protocolo personalizado. Recibirás una notificación cuando esté listo para entrenar.
           </p>
        </div>
      )}
    </div>
  );
};

// --- CLIENTS VIEW ---
const ClientsView = ({ onSelectClient }: { onSelectClient: (id: string) => void }) => {
  const [clients, setClients] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newClient, setNewClient] = useState<Partial<User>>({
    name: '', email: '', goal: Goal.LOSE_FAT, level: UserLevel.BEGINNER, daysPerWeek: 3, equipment: []
  });

  useEffect(() => {
    setClients(DataEngine.getUsers().filter(u => u.role === 'client'));
  }, []);

  const handleCreateClient = async () => {
     if(!newClient.name || !newClient.email) return;
     const client: User = {
       id: generateUUID(),
       name: newClient.name!,
       email: newClient.email!,
       role: 'client',
       goal: newClient.goal || Goal.LOSE_FAT,
       level: newClient.level || UserLevel.BEGINNER,
       daysPerWeek: newClient.daysPerWeek || 3,
       equipment: newClient.equipment || [],
       streak: 0,
       createdAt: new Date().toISOString()
     };
     await DataEngine.saveUser(client);
     setClients([...clients, client]);
     setShowAddModal(false);
     setNewClient({ name: '', email: '', goal: Goal.LOSE_FAT, level: UserLevel.BEGINNER, daysPerWeek: 3, equipment: [] });
  };

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-red-500"/> Atletas <span className="text-gray-500 text-lg">({clients.length})</span>
          </h2>
          <button onClick={() => setShowAddModal(true)} className="bg-red-600 hover:bg-red-500 px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2 transition-all shadow-lg shadow-red-900/20">
            <UserPlus size={18} /> <span className="hidden sm:inline">Nuevo Atleta</span>
          </button>
       </div>

       <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(client => (
            <div key={client.id} onClick={() => onSelectClient(client.id)} className="bg-[#0F0F11] border border-white/5 p-5 rounded-2xl hover:border-red-500/50 cursor-pointer group transition-all hover:bg-white/5">
               <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center font-bold text-lg text-gray-400 group-hover:text-red-500 group-hover:border-red-500/50 transition-all">
                        {client.name[0]}
                     </div>
                     <div>
                        <h4 className="font-bold text-white group-hover:text-red-400 transition-colors text-lg leading-tight">{client.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{client.email}</p>
                     </div>
                  </div>
                  <div className="p-2 bg-white/5 rounded-full group-hover:bg-red-600 group-hover:text-white transition-all">
                    <ChevronRight size={16} />
                  </div>
               </div>
               <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold bg-blue-900/20 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-md">{client.goal}</span>
                  <span className="text-[10px] font-bold bg-purple-900/20 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-md">{client.level}</span>
               </div>
            </div>
          ))}
          {clients.length === 0 && (
             <div className="col-span-full py-12 text-center text-gray-500 border border-dashed border-white/10 rounded-2xl">
                No hay atletas registrados.
             </div>
          )}
       </div>

       {showAddModal && (
         <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in">
            <div className="bg-[#111] w-full max-w-md rounded-3xl p-8 border border-white/10 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                 <h3 className="font-bold text-xl text-white">Nuevo Atleta</h3>
                 <button onClick={() => setShowAddModal(false)}><X size={20} className="text-gray-500 hover:text-white"/></button>
               </div>
               <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Nombre</label>
                    <input className="w-full bg-black border border-white/10 rounded-xl p-3 outline-none focus:border-red-500 text-white transition-colors" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Ej. Carlos Rodriguez" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Email</label>
                    <input className="w-full bg-black border border-white/10 rounded-xl p-3 outline-none focus:border-red-500 text-white transition-colors" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} placeholder="Ej. carlos@email.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Objetivo</label>
                        <select className="w-full bg-black border border-white/10 rounded-xl p-3 outline-none text-sm text-white" value={newClient.goal} onChange={(e: any) => setNewClient({...newClient, goal: e.target.value})}>
                            {Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                     </div>
                     <div>
                        <label className="text-xs text-gray-500 font-bold uppercase ml-1 mb-1 block">Nivel</label>
                        <select className="w-full bg-black border border-white/10 rounded-xl p-3 outline-none text-sm text-white" value={newClient.level} onChange={(e: any) => setNewClient({...newClient, level: e.target.value})}>
                            {Object.values(UserLevel).map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                     </div>
                  </div>
                  <button onClick={handleCreateClient} className="w-full bg-red-600 hover:bg-red-500 py-4 rounded-xl font-bold mt-4 text-white transition-colors shadow-lg shadow-red-900/20">
                    CREAR PERFIL
                  </button>
               </div>
            </div>
         </div>
       )}
    </div>
  );
};

// --- CLIENT DETAIL VIEW (UPDATED WITH HISTORY TAB) ---
const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
  const [client, setClient] = useState<User | undefined>(DataEngine.getUserById(clientId));
  const [plan, setPlan] = useState<Plan | null>(DataEngine.getPlan(clientId));
  const [history, setHistory] = useState<any[]>(DataEngine.getClientHistory(clientId));
  const [isGenerating, setIsGenerating] = useState(false);
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'plan' | 'history'>('plan');

  if (!client) return <div className="p-8 text-center">Atleta no encontrado.</div>;

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const generatedPlan = await generateSmartRoutine(client);
      const newPlan: Plan = {
        id: generateUUID(),
        title: generatedPlan.title || "Plan IA",
        userId: client.id,
        workouts: generatedPlan.workouts || [],
        updatedAt: new Date().toISOString()
      };
      await DataEngine.savePlan(newPlan);
      setPlan(newPlan);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteClient = () => {
    if (confirm("¿Estás seguro de eliminar a este atleta? Esta acción no se puede deshacer.")) {
      DataEngine.deleteUser(clientId);
      onBack();
    }
  };

  if (showManualBuilder) {
    return <ManualPlanBuilder 
      plan={plan || { id: generateUUID(), title: `Plan ${client.name}`, userId: client.id, workouts: [], updatedAt: new Date().toISOString() }}
      onSave={async (p) => { await DataEngine.savePlan(p); setPlan(p); setShowManualBuilder(false); }}
      onCancel={() => setShowManualBuilder(false)}
    />
  }

  return (
    <div className="space-y-6 animate-fade-in pb-10">
       <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2">
         <ChevronLeft size={20} /> <span className="font-bold text-sm">Volver a Atletas</span>
       </button>
       
       <div className="bg-[#0F0F11] p-6 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"/>
          <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
            <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center text-3xl font-bold text-gray-500 shadow-xl">
                    {client.name[0]}
                </div>
                <div>
                    <h1 className="text-3xl font-bold font-display italic text-white leading-none mb-2">{client.name.toUpperCase()}</h1>
                    <div className="flex flex-wrap gap-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                            <Info size={14} className="text-blue-500"/> {client.goal}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                            <Zap size={14} className="text-yellow-500"/> {client.level}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                            <CalendarDays size={14} className="text-green-500"/> {client.daysPerWeek} Días/Sem
                        </span>
                    </div>
                </div>
            </div>
            
            <div className="flex gap-3 self-end md:self-start">
               <button onClick={() => setShowManualBuilder(true)} className="p-3 bg-white/5 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors border border-white/5" title="Editar Plan">
                   <Edit3 size={20} />
               </button>
               <button onClick={handleDeleteClient} className="p-3 bg-red-500/10 rounded-xl hover:bg-red-500/20 text-red-500 transition-colors border border-red-500/10" title="Eliminar">
                   <Trash2 size={20} />
               </button>
            </div>
          </div>
       </div>

       {/* Sub-tabs */}
       <div className="flex border-b border-white/10 gap-6">
           <button onClick={() => setActiveSubTab('plan')} className={`pb-3 text-sm font-bold transition-colors ${activeSubTab === 'plan' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500'}`}>Protocolo Activo</button>
           <button onClick={() => setActiveSubTab('history')} className={`pb-3 text-sm font-bold transition-colors ${activeSubTab === 'history' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500'}`}>Historial ({history.length})</button>
       </div>

       {activeSubTab === 'plan' && (
           plan ? (
             <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-white"><Trophy size={18} className="text-yellow-500"/> Plan Asignado</h3>
                  <button onClick={handleGenerateAI} disabled={isGenerating} className="text-xs font-bold bg-blue-600/10 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-full hover:bg-blue-600/20 transition-all flex items-center gap-2">
                     {isGenerating ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />} REGENERAR IA
                  </button>
                </div>
                <PlanViewer plan={plan} mode="coach" />
             </div>
           ) : (
             <div className="py-16 border border-dashed border-white/10 rounded-3xl bg-[#0F0F11]/50 flex flex-col items-center justify-center text-center animate-fade-in">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <BrainCircuit size={32} className="text-gray-500" />
                </div>
                <h3 className="text-xl font-bold mb-2 text-white">Sin Protocolo Activo</h3>
                <p className="text-gray-500 mb-8 max-w-sm">Este atleta aún no tiene un plan de entrenamiento asignado.</p>
                
                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md px-4">
                   <button onClick={handleGenerateAI} disabled={isGenerating} className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 transition-all text-white">
                      {isGenerating ? <Loader2 size={20} className="animate-spin"/> : <Sparkles size={20} />}
                      GENERAR CON IA
                   </button>
                   <button onClick={() => setShowManualBuilder(true)} className="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-white">
                      <Pencil size={20} />
                      CREAR MANUAL
                   </button>
                </div>
             </div>
           )
       )}

       {activeSubTab === 'history' && (
           <div className="space-y-4 animate-fade-in">
               {history.length === 0 ? (
                   <div className="text-center py-10 text-gray-500">No hay sesiones registradas aún.</div>
               ) : (
                   history.map((session, idx) => (
                       <div key={idx} className="bg-[#0F0F11] border border-white/5 rounded-2xl p-4">
                           <div className="flex justify-between items-center mb-2 border-b border-white/5 pb-2">
                               <span className="font-bold text-white">{session.workoutName}</span>
                               <span className="text-xs text-gray-500">{formatDate(session.date)}</span>
                           </div>
                           <div className="grid grid-cols-2 gap-4 text-xs mb-2">
                               <div>
                                   <span className="text-gray-500">Ejercicios:</span> <span className="text-white font-bold">{session.summary.exercisesCompleted}</span>
                               </div>
                               <div>
                                   <span className="text-gray-500">Volumen:</span> <span className="text-white font-bold">{(session.summary.totalVolume).toLocaleString()} kg</span>
                               </div>
                           </div>
                           <div className="mt-3 flex justify-end">
                               <button className="text-xs text-red-500 font-bold flex items-center gap-1 hover:underline">
                                   <ClipboardList size={14} /> Ver Detalles Completos
                               </button>
                           </div>
                       </div>
                   ))
               )}
           </div>
       )}
    </div>
  );
};

// --- WORKOUTS VIEW ---
const WorkoutsView = () => {
  const [exercises, setExercises] = useState<Exercise[]>(DataEngine.getExercises());
  const [search, setSearch] = useState('');
  const [showVideo, setShowVideo] = useState<string | null>(null);

  const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()) || e.muscleGroup.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
             <Dumbbell className="text-red-500"/> Biblioteca de Ejercicios
          </h2>
          <div className="bg-[#0F0F11] border border-white/10 rounded-xl flex items-center px-4 py-3 w-full md:w-80 shadow-sm focus-within:border-red-500/50 transition-colors">
             <Search size={18} className="text-gray-500 shrink-0" />
             <input className="bg-transparent border-none outline-none ml-3 text-sm w-full text-white placeholder-gray-600 font-medium" placeholder="Buscar ejercicio o músculo..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
       </div>

       <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(ex => (
             <div key={ex.id} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl flex justify-between items-center hover:border-white/20 transition-colors group">
                <div className="flex items-center gap-4">
                   <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center text-gray-500 font-bold group-hover:text-white transition-colors">
                      {ex.name[0]}
                   </div>
                   <div>
                      <h4 className="font-bold text-sm text-gray-200 group-hover:text-white">{ex.name}</h4>
                      <span className="text-[10px] uppercase text-gray-500 bg-white/5 px-2 py-0.5 rounded inline-block mt-1 border border-white/5">{ex.muscleGroup}</span>
                   </div>
                </div>
                <button onClick={() => setShowVideo(ex.name)} className="p-2.5 bg-white/5 rounded-full hover:bg-red-600 text-gray-400 hover:text-white transition-all shadow-sm">
                   <Play size={16} fill="currentColor" />
                </button>
             </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">No se encontraron ejercicios.</div>
          )}
       </div>

       {showVideo && (
         <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-6 backdrop-blur-md" onClick={() => setShowVideo(null)}>
            <div className="bg-[#111] w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
               <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#151518]">
                  <h3 className="font-bold text-white flex items-center gap-2"><Youtube size={18} className="text-red-500"/> {showVideo}</h3>
                  <button onClick={() => setShowVideo(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20} className="text-gray-400 hover:text-white" /></button>
               </div>
               <div className="aspect-video bg-black flex items-center justify-center relative group">
                  <div className="absolute inset-0 bg-red-600/5 group-hover:bg-transparent transition-colors pointer-events-none" />
                  <a 
                    href={exercises.find(e => e.name === showVideo)?.videoUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex flex-col items-center gap-3 text-white group-hover:scale-110 transition-transform"
                  >
                    <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40">
                       <Play size={32} fill="white" className="ml-1" />
                    </div>
                    <span className="text-xs font-bold tracking-widest uppercase">Ver en YouTube</span>
                  </a>
               </div>
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
