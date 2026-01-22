import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer as TimerIcon, Download, Upload, Filter, Clock, Database, FileJson, Cloud, CloudOff,
  Wifi, WifiOff, AlertTriangle, Smartphone, Signal, Globe, Loader2, BrainCircuit,
  CalendarDays, Trophy, Pencil, Menu, Youtube, Info, UserMinus, UserCog, Circle, CheckCircle,
  MoreVertical, Flame, StopCircle, ClipboardList, Disc, MessageSquare, Send, TrendingUp, Shield, Palette
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, SetEntry, WorkoutProgress, SystemConfig } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine, analyzeProgress, getTechnicalAdvice } from './services/geminiService';
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
const ADMIN_UUID = 'a1b2c3d4-0000-0000-0000-admin0000001';
const STORAGE_KEY = 'KINETIX_DATA_PRO_V3'; 
const SESSION_KEY = 'KINETIX_SESSION_PRO_V3';

const DEFAULT_CONFIG: SystemConfig = {
    appName: 'KINETIX',
    logoUrl: '', // String vacío usa la K por defecto
    themeColor: '#ef4444'
};

// --- DATA ENGINE ---
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
  
  getConfig: (): SystemConfig => {
      const s = DataEngine.getStore();
      return s.CONFIG ? JSON.parse(s.CONFIG) : DEFAULT_CONFIG;
  },

  saveConfig: (config: SystemConfig) => {
      const s = DataEngine.getStore();
      s.CONFIG = JSON.stringify(config);
      DataEngine.saveStore(s);
  },

  init: () => {
    const store = DataEngine.getStore();
    let users = store.USERS ? JSON.parse(store.USERS) : [];
    let modified = false;

    // 1. Ensure Client Exists
    if (!users.find((u:User) => u.email === 'atleta@kinetix.com')) {
        users.push(MOCK_USER);
        modified = true;
    }

    // 2. Ensure Coach Exists (Fixing Login Issue)
    if (!users.find((u:User) => u.email === 'coach@kinetix.com')) {
        users.push({
            id: COACH_UUID, name: 'COACH KINETIX', email: 'coach@kinetix.com',
            goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, role: 'coach',
            daysPerWeek: 6, equipment: [], streak: 999, createdAt: new Date().toISOString()
        });
        modified = true;
    }

    // 3. Ensure Admin Exists
    if (!users.find((u:User) => u.email === 'admin@kinetix.com')) {
        users.push({
            id: ADMIN_UUID, name: 'ADMINISTRADOR', email: 'admin@kinetix.com',
            goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, role: 'admin',
            daysPerWeek: 0, equipment: [], streak: 0, createdAt: new Date().toISOString()
        });
        modified = true;
    }

    if(modified) {
        store.USERS = JSON.stringify(users);
        DataEngine.saveStore(store);
    }
    
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
    return true;
  },

  saveUser: async (user: User) => {
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    s.USERS = JSON.stringify(users);
    DataEngine.saveStore(s);
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
  saveSetLog: (userId: string, workoutId: string, exerciseIndex: number, setEntry: SetEntry) => {
    const s = DataEngine.getStore();
    const key = `LOG_TEMP_${userId}_${workoutId}`;
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

  archiveWorkout: (userId: string, workout: Workout, logs: WorkoutProgress, startTime: number) => {
    const s = DataEngine.getStore();
    const historyKey = `HISTORY_${userId}`;
    const currentHistory = s[historyKey] ? JSON.parse(s[historyKey]) : [];
    
    const endTime = Date.now();
    const durationMinutes = Math.floor((endTime - startTime) / 60000);

    // Calcular stats de sesión
    let totalVolume = 0;
    let prCount = 0;

    Object.values(logs).flat().forEach(entry => {
        if(entry.completed) {
            totalVolume += (parseFloat(entry.weight) || 0) * (parseFloat(entry.reps) || 0);
        }
    });

    // Detectar PRs simple
    if (currentHistory.length > 0) {
        const lastVol = currentHistory[0].summary.totalVolume;
        if(totalVolume > lastVol) prCount++;
    }

    const session = {
      id: generateUUID(),
      workoutName: workout.name,
      workoutId: workout.id,
      date: new Date().toISOString(),
      logs: logs,
      summary: {
         exercisesCompleted: Object.keys(logs).length,
         totalVolume,
         durationMinutes,
         prCount
      }
    };
    
    currentHistory.unshift(session); 
    s[historyKey] = JSON.stringify(currentHistory);
    delete s[`LOG_TEMP_${userId}_${workout.id}`];
    
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
};

// --- COMPONENTS ---

const BrandingLogo = ({ className = "w-8 h-8", textSize = "text-xl", showText = true }: { className?: string, textSize?: string, showText?: boolean }) => {
    const [config, setConfig] = useState(DataEngine.getConfig());
    
    useEffect(() => {
        const update = () => setConfig(DataEngine.getConfig());
        window.addEventListener('storage-update', update);
        return () => window.removeEventListener('storage-update', update);
    }, []);

    return (
        <div className="flex items-center gap-2">
            {config.logoUrl ? (
                <img src={config.logoUrl} alt="Logo" className={`${className} object-contain rounded-lg`} />
            ) : (
                <div className={`${className} bg-red-600 rounded-lg flex items-center justify-center font-display italic font-bold shadow-lg shadow-red-900/40 text-white`}>
                    {config.appName.charAt(0)}
                </div>
            )}
            {showText && (
                <span className={`font-display font-bold italic tracking-tighter ${textSize} text-white`}>
                    {config.appName.toUpperCase()}
                </span>
            )}
        </div>
    );
}

// 2. Chatbot Component (Mobile Fix)
const AIChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<{role: 'user'|'ai', text: string}[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if(!input.trim()) return;
        const userMsg = input;
        setMessages(prev => [...prev, {role: 'user', text: userMsg}]);
        setInput('');
        setIsLoading(true);

        try {
            const allExercises = DataEngine.getExercises();
            const response = await getTechnicalAdvice(userMsg, allExercises);
            setMessages(prev => [...prev, {role: 'ai', text: response || 'Sin respuesta.'}]);
        } catch (e) {
            setMessages(prev => [...prev, {role: 'ai', text: 'Error de conexión.'}]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
           <button 
             onClick={() => setIsOpen(true)} 
             className="fixed bottom-24 right-4 md:bottom-8 md:right-8 z-[100] p-4 bg-blue-600 rounded-full shadow-2xl shadow-blue-600/40 text-white hover:scale-110 transition-transform active:scale-95"
           >
               <MessageSquare size={24} />
           </button>

           {isOpen && (
               <div className="fixed inset-0 z-[101] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                   <div className="w-full max-w-md h-[500px] bg-[#111] border border-white/20 rounded-2xl shadow-2xl flex flex-col animate-fade-in-up overflow-hidden relative">
                       <div className="bg-[#1A1A1D] p-4 flex justify-between items-center border-b border-white/10">
                           <h3 className="font-bold text-white flex items-center gap-2"><Sparkles size={16} className="text-blue-500"/> Kinetix AI</h3>
                           <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-full"><X size={20} className="text-gray-400 hover:text-white"/></button>
                       </div>
                       <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/50">
                           {messages.length === 0 && (
                               <div className="text-center mt-10 space-y-2">
                                   <div className="w-12 h-12 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto text-blue-500 mb-2"><BrainCircuit size={24}/></div>
                                   <p className="text-sm font-bold text-white">Asistente Técnico</p>
                                   <p className="text-xs text-gray-500 max-w-[200px] mx-auto">Pregunta sobre técnica, sustituciones o consejos rápidos.</p>
                               </div>
                           )}
                           {messages.map((m, i) => (
                               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                   <div className={`max-w-[85%] p-3 rounded-xl text-sm leading-relaxed ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-[#222] text-gray-200 rounded-tl-none border border-white/5'}`}>
                                       {m.text}
                                   </div>
                               </div>
                           ))}
                           {isLoading && <div className="text-xs text-gray-500 animate-pulse ml-2">Escribiendo...</div>}
                           <div ref={messagesEndRef} />
                       </div>
                       <div className="p-3 border-t border-white/10 bg-[#1A1A1D] flex gap-2">
                           <input 
                             value={input}
                             onChange={e => setInput(e.target.value)}
                             onKeyDown={e => e.key === 'Enter' && handleSend()}
                             placeholder="Escribe tu duda..."
                             className="flex-1 bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
                             autoFocus
                           />
                           <button onClick={handleSend} disabled={isLoading} className="p-3 bg-blue-600/20 rounded-xl hover:bg-blue-600/30 text-blue-500 transition-colors">
                               <Send size={18} />
                           </button>
                       </div>
                   </div>
               </div>
           )}
        </>
    );
};

// ... (RestTimer, ConnectionStatus, NavButton, StatCard, PlateCalculator remain the same)

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

const PlateCalculator = ({ targetWeight, onClose }: { targetWeight: number, onClose: () => void }) => {
  const barWeight = 20; 
  const plates = [20, 15, 10, 5, 2.5];
  
  const calculatePlates = () => {
    let weightPerSide = (targetWeight - barWeight) / 2;
    if (weightPerSide <= 0) return [];
    
    const result: number[] = [];
    plates.forEach(plate => {
      while (weightPerSide >= plate) {
        result.push(plate);
        weightPerSide -= plate;
      }
    });
    return result;
  };

  const calculated = calculatePlates();

  return (
    <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
       <div className="bg-[#1A1A1D] border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
          <h3 className="text-xl font-bold text-white mb-2">Calculadora de Discos</h3>
          <p className="text-gray-400 text-sm mb-6">Para {targetWeight}kg (Barra 20kg)</p>
          
          <div className="flex items-center justify-center gap-1 mb-8">
             <div className="h-4 w-10 bg-gray-500 rounded-sm"></div> 
             {calculated.length === 0 ? <span className="text-xs text-gray-600">Solo Barra</span> : calculated.map((plate, idx) => (
                <div key={idx} className={`h-12 w-3 rounded-sm border border-black/50 ${
                    plate === 20 ? 'bg-blue-600 h-16' : 
                    plate === 15 ? 'bg-yellow-500 h-14' : 
                    plate === 10 ? 'bg-green-600 h-12' : 
                    plate === 5 ? 'bg-white h-10' : 'bg-red-500 h-8'
                }`} title={`${plate}kg`}></div>
             ))}
             <div className="h-4 w-4 bg-gray-500 rounded-sm"></div> 
          </div>

          <div className="grid grid-cols-2 gap-2 text-left bg-black/20 p-4 rounded-xl">
              <span className="text-xs text-gray-500 uppercase font-bold">Por lado:</span>
              <div className="flex flex-wrap gap-1">
                 {calculated.map((p, i) => <span key={i} className="text-xs font-bold text-white bg-white/10 px-1.5 rounded">{p}</span>)}
              </div>
          </div>
          
          <button onClick={onClose} className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-sm transition-colors">Cerrar</button>
       </div>
    </div>
  );
};


// --- EXERCISE CARD (ELITE VERSION) ---
interface ExerciseCardProps {
  exercise: WorkoutExercise;
  index: number;
  workoutId: string;
  userId: string;
  onShowVideo: (name: string) => void;
  mode: 'coach' | 'athlete';
  onSetComplete: (restSeconds?: number) => void;
  history?: any[]; 
}

const ExerciseCard: React.FC<ExerciseCardProps> = ({ 
  exercise, index, workoutId, userId, onShowVideo, mode, onSetComplete, history
}) => {
  const [logs, setLogs] = useState<WorkoutProgress>({});
  const [showPlateCalc, setShowPlateCalc] = useState<number | null>(null);

  const lastSessionData = useMemo(() => {
      if(!history || history.length === 0) return null;
      const lastSession = history[0];
      if(lastSession.logs && lastSession.logs[index]) {
          const sets = lastSession.logs[index] as SetEntry[];
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

  const handleLogSet = (setNum: number, weight: string, reps: string, rpe: string, isCompleted: boolean) => {
    const entry: SetEntry = {
      setNumber: setNum, weight, reps, completed: isCompleted, timestamp: Date.now(),
      rpe: rpe ? parseInt(rpe) : undefined
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
            
            <div className="flex flex-wrap gap-2 mt-2 items-center">
                {exercise.targetLoad && (
                <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 px-2 py-1 rounded-md border border-yellow-500/20" title="Carga asignada por el Coach">
                    <ShieldAlert size={12} className="text-yellow-500" />
                    <span className="text-xs font-bold text-yellow-500 uppercase tracking-wide">Meta: {exercise.targetLoad}</span>
                </div>
                )}
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
        <div className="space-y-2 mt-4 bg-black/20 p-3 rounded-xl border border-white/5 overflow-x-auto no-scrollbar">
           <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 uppercase font-bold text-center mb-1 min-w-[300px]">
              <div className="col-span-1">#</div>
              <div className="col-span-3">Kg</div>
              <div className="col-span-3">Reps</div>
              <div className="col-span-2">RPE</div>
              <div className="col-span-3">Done</div>
           </div>
           {setsArray.map(setNum => {
             const log = exerciseLogs.find(l => l.setNumber === setNum);
             const isDone = log?.completed;
             
             // Gold Mode Logic
             const isPR = lastSessionData && log?.weight && parseFloat(log.weight) > parseFloat(lastSessionData.weight);

             return (
               <div key={setNum} className={`grid grid-cols-12 gap-2 items-center transition-all min-w-[300px] ${isDone ? 'opacity-50' : 'opacity-100'}`}>
                 <div className="col-span-1 flex justify-center">
                    <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400">{setNum}</span>
                 </div>
                 <div className="col-span-3 relative flex items-center gap-1">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      placeholder={exercise.targetLoad || "-"}
                      defaultValue={log?.weight || ''}
                      onBlur={(e) => handleLogSet(setNum, e.target.value, log?.reps || exercise.targetReps, log?.rpe?.toString() || '', !!isDone)}
                      className={`w-full bg-[#1A1A1D] border rounded-md py-1.5 px-1 text-center text-xs font-bold focus:border-yellow-500 outline-none placeholder-gray-700 transition-all ${isPR ? 'border-yellow-500 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'border-white/10 text-white'}`}
                    />
                    <button onClick={() => setShowPlateCalc(parseFloat(log?.weight || exercise.targetLoad || '0'))} className="p-1 bg-white/5 rounded hover:bg-white/10 text-gray-500 hover:text-white">
                        <Disc size={12} />
                    </button>
                 </div>
                 <div className="col-span-3">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      placeholder={exercise.targetReps}
                      defaultValue={log?.reps || ''}
                      onBlur={(e) => handleLogSet(setNum, log?.weight || '', e.target.value, log?.rpe?.toString() || '', !!isDone)}
                      className="w-full bg-[#1A1A1D] border border-white/10 rounded-md py-1.5 px-1 text-center text-xs text-white focus:border-blue-500 outline-none placeholder-gray-700"
                    />
                 </div>
                 <div className="col-span-2">
                    <input 
                      type="number"
                      min="1" max="10" 
                      placeholder="-"
                      defaultValue={log?.rpe || ''}
                      onBlur={(e) => handleLogSet(setNum, log?.weight || '', log?.reps || exercise.targetReps, e.target.value, !!isDone)}
                      className="w-full bg-[#1A1A1D] border border-white/10 rounded-md py-1.5 px-1 text-center text-xs text-blue-300 focus:border-blue-500 outline-none placeholder-gray-700"
                    />
                 </div>
                 <div className="col-span-3 flex justify-center">
                    <button 
                      onClick={() => handleLogSet(setNum, log?.weight || '', log?.reps || exercise.targetReps, log?.rpe?.toString() || '', !isDone)}
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
         </div>
      )}
      
      {showPlateCalc && <PlateCalculator targetWeight={showPlateCalc} onClose={() => setShowPlateCalc(null)} />}
    </div>
  );
};

// --- PLAN VIEWER WRAPPER ---
const PlanViewer = ({ plan, mode = 'coach' }: { plan: Plan, mode?: 'coach' | 'athlete' }) => {
  const [showVideo, setShowVideo] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [currentRestTime, setCurrentRestTime] = useState(60);
  const [finishScreen, setFinishScreen] = useState<any | null>(null);
  const startTime = useRef(Date.now());
  
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
         const session = DataEngine.archiveWorkout(plan.userId, workout, logs, startTime.current);
         setFinishScreen(session);
         setTimeout(() => window.dispatchEvent(new Event('storage-update')), 500);
     }
  };

  if (finishScreen) {
      return (
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in space-y-6 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-t from-green-900/10 to-transparent pointer-events-none" />
              <div className="w-28 h-28 bg-gradient-to-br from-green-500 to-emerald-700 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(34,197,94,0.4)] mb-4 animate-bounce">
                  <Trophy size={56} className="text-white ml-1" />
              </div>
              <div>
                  <h2 className="text-5xl font-display font-black italic text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">WORKOUT<br/>COMPLETE</h2>
                  <p className="text-green-400 mt-2 font-bold tracking-widest uppercase text-sm">Sesión Dominada</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8 relative z-10">
                  <div className="bg-[#0F0F11] border border-white/10 p-5 rounded-2xl flex flex-col items-center">
                      <div className="text-3xl font-bold text-white mb-1">{finishScreen.summary.totalVolume.toLocaleString()}</div>
                      <div className="text-[10px] uppercase text-gray-500 font-bold">Volumen Total (Kg)</div>
                  </div>
                  <div className="bg-[#0F0F11] border border-white/10 p-5 rounded-2xl flex flex-col items-center">
                      <div className="text-3xl font-bold text-white mb-1">{finishScreen.summary.durationMinutes}m</div>
                      <div className="text-[10px] uppercase text-gray-500 font-bold">Duración</div>
                  </div>
                  {finishScreen.summary.prCount > 0 && (
                      <div className="col-span-2 bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex items-center justify-center gap-3">
                          <Trophy size={20} className="text-yellow-500" />
                          <span className="text-yellow-500 font-bold uppercase text-sm">¡{finishScreen.summary.prCount} Récords Personales!</span>
                      </div>
                  )}
              </div>

              <button onClick={() => setFinishScreen(null)} className="mt-8 bg-white text-black px-10 py-4 rounded-full font-bold hover:bg-gray-200 transition-colors shadow-lg">
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
        {mode === 'athlete' && (
            <div className="flex items-center gap-2">
                <AIChatbot />
                <span className="text-[10px] font-black tracking-widest text-green-400 px-3 py-1 bg-green-900/20 rounded-full border border-green-500/20 flex items-center gap-1"><Flame size={12}/> ACTIVE</span>
            </div>
        )}
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
            </div>
         </div>
      )}

      {showTimer && mode === 'athlete' && (
         <RestTimer 
           initialSeconds={currentRestTime} 
           onClose={() => setShowTimer(false)} 
         />
      )}
    </div>
  );
};

// --- LOGIN PAGE ---
const LoginPage = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = DataEngine.getUserByNameOrEmail(email);
    
    if (user) {
      onLogin(user);
    } else {
      setError('Usuario no encontrado. Intenta: coach@kinetix.com o admin@kinetix.com');
    }
  };

  return (
    <div className="min-h-screen bg-[#050507] flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none" />
        
        <div className="w-full max-w-md bg-[#0F0F11]/80 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10 animate-fade-in-up">
            <div className="text-center mb-10">
                <BrandingLogo className="w-16 h-16 mx-auto mb-4" textSize="text-3xl" />
                <p className="text-gray-500 tracking-[0.3em] text-xs font-bold uppercase">Elite Performance System</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Email de Acceso</label>
                    <div className="relative">
                        <UserIcon className="absolute left-4 top-3.5 text-gray-500" size={18} />
                        <input 
                            type="text" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="tu@email.com"
                            className="w-full bg-black/50 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-red-500 outline-none transition-all placeholder-gray-700 font-medium"
                        />
                    </div>
                </div>

                {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-xs font-bold flex items-center gap-2"><AlertTriangle size={14}/> {error}</div>}

                <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-900/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-4">
                    INGRESAR AL SISTEMA <ArrowRight size={18} />
                </button>
            </form>
            
            <div className="mt-8 text-center">
                 <p className="text-xs text-gray-600">Accesos Directos (Demo):</p>
                 <div className="flex justify-center gap-2 mt-2 flex-wrap">
                     <button onClick={() => setEmail('atleta@kinetix.com')} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400">Atleta</button>
                     <button onClick={() => setEmail('coach@kinetix.com')} className="text-[10px] bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-gray-400">Coach</button>
                     <button onClick={() => setEmail('admin@kinetix.com')} className="text-[10px] bg-red-900/20 border border-red-500/20 hover:bg-red-900/30 px-2 py-1 rounded text-red-500">Admin</button>
                 </div>
            </div>
        </div>
    </div>
  );
};

// --- ADMIN VIEW (New Command Center) ---
const AdminView = () => {
    const [config, setConfig] = useState(DataEngine.getConfig());
    const [users, setUsers] = useState(DataEngine.getUsers());

    const handleSaveConfig = () => {
        DataEngine.saveConfig(config);
        alert('Configuración guardada. La marca se actualizará en toda la app.');
    };

    return (
        <div className="space-y-6 animate-fade-in pb-24">
            <h2 className="text-3xl font-bold font-display italic text-white flex items-center gap-2">
                <Shield className="text-red-500" /> COMMAND CENTER
            </h2>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Branding Section */}
                <div className="bg-[#0F0F11] border border-white/5 p-6 rounded-2xl">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Palette size={18}/> Identidad de Marca</h3>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase block mb-1">Nombre de la App</label>
                            <input 
                                value={config.appName}
                                onChange={e => setConfig({...config, appName: e.target.value})}
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 font-bold uppercase block mb-1">URL del Logo (Imagen)</label>
                            <input 
                                value={config.logoUrl}
                                onChange={e => setConfig({...config, logoUrl: e.target.value})}
                                placeholder="https://..."
                                className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white text-sm"
                            />
                            <p className="text-[10px] text-gray-600 mt-1">Deja vacío para usar el logo por defecto.</p>
                        </div>
                        
                        <div className="pt-2">
                            <p className="text-xs text-gray-500 font-bold uppercase mb-2">Previsualización:</p>
                            <div className="bg-black p-4 rounded-xl border border-white/5 flex justify-center">
                                <div className="flex items-center gap-2">
                                    {config.logoUrl ? (
                                        <img src={config.logoUrl} className="w-10 h-10 object-contain rounded" />
                                    ) : (
                                        <div className="w-10 h-10 bg-red-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-red-900/40">
                                            {config.appName.charAt(0)}
                                        </div>
                                    )}
                                    <span className="font-display font-bold italic text-xl">{config.appName.toUpperCase()}</span>
                                </div>
                            </div>
                        </div>

                        <button onClick={handleSaveConfig} className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-gray-200 mt-2">
                            GUARDAR CAMBIOS
                        </button>
                    </div>
                </div>

                {/* System Stats / Users */}
                <div className="bg-[#0F0F11] border border-white/5 p-6 rounded-2xl">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2"><Users size={18}/> Usuarios del Sistema</h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {users.map(u => (
                            <div key={u.id} className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/5">
                                <div>
                                    <div className="font-bold text-sm">{u.name}</div>
                                    <div className="text-xs text-gray-500">{u.email}</div>
                                </div>
                                <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${
                                    u.role === 'admin' ? 'bg-red-900/30 text-red-500' : 
                                    u.role === 'coach' ? 'bg-blue-900/30 text-blue-500' : 
                                    'bg-green-900/30 text-green-500'
                                }`}>{u.role}</span>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 p-4 bg-yellow-900/10 border border-yellow-500/20 rounded-xl">
                        <p className="text-xs text-yellow-500 font-bold flex items-center gap-2">
                            <ShieldAlert size={14}/> Nota de Seguridad
                        </p>
                        <p className="text-[10px] text-gray-400 mt-1">
                            Como Administrador, tienes acceso total. Los cambios de marca afectan a todos los usuarios inmediatamente.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ... (ClientsView, ClientDetailView, WorkoutsView, ProfileView remain the same)
// Re-inserting ClientsView for context completeness in XML
const ClientsView = ({ onSelectClient }: { onSelectClient: (id: string) => void }) => {
  const [clients, setClients] = useState<User[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    setClients(DataEngine.getUsers().filter(u => u.role === 'client'));
  }, []);

  const handleAddClient = (e: React.FormEvent) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const formData = new FormData(form);
      
      const newUser: User = {
          id: generateUUID(),
          name: formData.get('name') as string,
          email: formData.get('email') as string,
          goal: formData.get('goal') as Goal,
          level: formData.get('level') as UserLevel,
          role: 'client',
          daysPerWeek: parseInt(formData.get('days') as string),
          equipment: ['Gym Completo'], 
          streak: 0,
          createdAt: new Date().toISOString()
      };
      
      DataEngine.saveUser(newUser);
      setClients(DataEngine.getUsers().filter(u => u.role === 'client'));
      setShowAddModal(false);
  };

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
              <h2 className="text-3xl font-bold font-display italic text-white">ATLETAS</h2>
              <p className="text-gray-500 text-sm">Gestión de rendimiento y planes</p>
          </div>
          <button onClick={() => setShowAddModal(true)} className="bg-white text-black font-bold py-3 px-6 rounded-xl hover:bg-gray-200 transition-colors flex items-center gap-2 shadow-lg">
              <UserPlus size={18} /> NUEVO ATLETA
          </button>
       </div>

       <div className="relative">
          <Search className="absolute left-4 top-3.5 text-gray-500" size={18} />
          <input 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre..."
            className="w-full bg-[#0F0F11] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-white/20 outline-none"
          />
       </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClients.map(client => (
              <div key={client.id} onClick={() => onSelectClient(client.id)} className="group bg-[#0F0F11] border border-white/5 p-5 rounded-2xl hover:border-red-500/50 cursor-pointer transition-all hover:translate-y-[-2px] relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight size={18} className="text-red-500 -rotate-45" />
                  </div>
                  <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center font-bold text-gray-400 group-hover:bg-red-600 group-hover:text-white transition-colors">
                          {client.name[0]}
                      </div>
                      <div>
                          <h3 className="font-bold text-white group-hover:text-red-400 transition-colors">{client.name}</h3>
                          <p className="text-xs text-gray-500">{client.email}</p>
                      </div>
                  </div>
                  <div className="flex gap-2 text-[10px] uppercase font-bold tracking-wider">
                      <span className="bg-white/5 px-2 py-1 rounded border border-white/5 text-gray-400">{client.goal}</span>
                      <span className="bg-white/5 px-2 py-1 rounded border border-white/5 text-gray-400">{client.level}</span>
                  </div>
              </div>
          ))}
       </div>

       {showAddModal && (
           <div className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
               <div className="bg-[#1A1A1D] w-full max-w-lg rounded-2xl p-6 border border-white/10 animate-fade-in-up" onClick={e => e.stopPropagation()}>
                   <h3 className="text-xl font-bold text-white mb-6">Registrar Atleta</h3>
                   <form onSubmit={handleAddClient} className="space-y-4">
                       <input name="name" required placeholder="Nombre Completo" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" />
                       <input name="email" type="email" required placeholder="Email" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" />
                       <div className="grid grid-cols-2 gap-4">
                           <select name="goal" className="bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-gray-300 outline-none">
                               {Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}
                           </select>
                           <select name="level" className="bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-gray-300 outline-none">
                               {Object.values(UserLevel).map(l => <option key={l} value={l}>{l}</option>)}
                           </select>
                       </div>
                       <input name="days" type="number" min="1" max="7" defaultValue="4" placeholder="Días/Semana" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" />
                       
                       <div className="flex gap-3 pt-4">
                           <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold text-sm text-gray-400 hover:text-white">Cancelar</button>
                           <button type="submit" className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-sm text-white hover:bg-red-500">Guardar</button>
                       </div>
                   </form>
               </div>
           </div>
       )}
    </div>
  );
};

const WorkoutsView = () => {
    const [exercises, setExercises] = useState<Exercise[]>(DataEngine.getExercises());
    const [filter, setFilter] = useState('');
    const [showVideo, setShowVideo] = useState<string | null>(null);

    const filtered = exercises.filter(e => 
        e.name.toLowerCase().includes(filter.toLowerCase()) || 
        e.muscleGroup.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold font-display italic text-white">BIBLIOTECA</h2>
                    <p className="text-gray-500 text-sm">Base de datos de ejercicios</p>
                </div>
             </div>

             <div className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-500" size={18} />
                <input 
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Buscar ejercicio o músculo..."
                    className="w-full bg-[#0F0F11] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-white/20 outline-none"
                />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {filtered.map(ex => (
                     <div key={ex.id} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl flex justify-between items-center group hover:border-white/20 transition-colors">
                         <div>
                             <h4 className="font-bold text-white">{ex.name}</h4>
                             <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block">{ex.muscleGroup}</span>
                         </div>
                         <button onClick={() => setShowVideo(ex.name)} className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white/10 transition-colors">
                             <Play size={16} />
                         </button>
                     </div>
                 ))}
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
                                href={exercises.find(e => e.name === showVideo)?.videoUrl || '#'} 
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
                    </div>
                </div>
            )}
        </div>
    );
};

const ProfileView = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
    const history = DataEngine.getClientHistory(user.id);
    const [aiInsight, setAiInsight] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    const chartData = useMemo(() => {
        return history.slice().reverse().map(h => ({
            date: new Date(h.date).toLocaleDateString('es-ES', {day: '2-digit', month: 'short'}),
            volume: h.summary.totalVolume,
        }));
    }, [history]);

    const handleAnalyze = async () => {
        setAnalyzing(true);
        try {
            const insight = await analyzeProgress(user, history);
            setAiInsight(insight);
        } catch (e) {
            alert("No se pudo conectar con el Coach IA.");
        } finally {
            setAnalyzing(false);
        }
    };

    return (
        <div className="animate-fade-in p-4 space-y-6">
             <h2 className="text-2xl font-bold mb-6">Mi Perfil</h2>
             
             <div className="bg-[#0F0F11] rounded-2xl p-6 border border-white/5">
                <div className="flex items-center gap-4 mb-4">
                   <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center text-xl font-bold">{user.name[0]}</div>
                   <div>
                      <h3 className="font-bold text-lg">{user.name}</h3>
                      <p className="text-gray-400 text-sm">{user.email}</p>
                      <span className="text-[10px] uppercase bg-white/10 px-2 py-1 rounded mt-1 inline-block">{user.role}</span>
                   </div>
                </div>
             </div>

             {history.length > 0 && (
                 <div className="bg-[#0F0F11] rounded-2xl p-6 border border-white/5">
                     <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                         <TrendingUp className="text-green-500" /> Progreso de Volumen
                     </h3>
                     <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="date" stroke="#666" fontSize={12} tickLine={false} />
                                <YAxis stroke="#666" fontSize={12} tickLine={false} />
                                <Tooltip 
                                    contentStyle={{backgroundColor: '#111', border: '1px solid #333', borderRadius: '8px'}}
                                    itemStyle={{color: '#fff'}}
                                />
                                <Area type="monotone" dataKey="volume" stroke="#ef4444" fillOpacity={1} fill="url(#colorVol)" />
                            </AreaChart>
                        </ResponsiveContainer>
                     </div>
                     
                     <button 
                        onClick={handleAnalyze} 
                        disabled={analyzing}
                        className="w-full mt-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
                     >
                        {analyzing ? <Loader2 className="animate-spin"/> : <Sparkles size={18} />}
                        ANALIZAR MI PROGRESO CON IA
                     </button>

                     {aiInsight && (
                         <div className="mt-4 p-4 bg-blue-900/10 border border-blue-500/20 rounded-xl animate-fade-in text-sm text-gray-300 leading-relaxed whitespace-pre-line">
                             <div className="flex items-center gap-2 mb-2 font-bold text-blue-400">
                                 <BrainCircuit size={16} /> Coach Insights
                             </div>
                             {aiInsight}
                         </div>
                     )}
                 </div>
             )}

             <button onClick={onLogout} className="w-full bg-red-600/10 text-red-500 py-4 rounded-xl font-bold border border-red-500/20 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2">
                <LogOut size={20} /> CERRAR SESIÓN
             </button>
        </div>
    );
};

const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
  const [client, setClient] = useState<User | undefined>(DataEngine.getUserById(clientId));
  const [plan, setPlan] = useState<Plan | null>(DataEngine.getPlan(clientId));
  const [history, setHistory] = useState<any[]>(DataEngine.getClientHistory(clientId));
  const [isGenerating, setIsGenerating] = useState(false);
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
                    </div>
                </div>
            </div>
            <button onClick={handleDeleteClient} className="text-xs text-red-500 hover:text-red-400 border border-red-900/30 px-3 py-1.5 rounded-lg bg-red-900/10 transition-colors flex items-center gap-1">
                <Trash2 size={12}/> Eliminar
            </button>
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
             <div className="py-16 text-center text-gray-500 flex flex-col items-center">
                <p className="mb-4">Sin plan activo.</p>
                <button onClick={handleGenerateAI} disabled={isGenerating} className="text-sm font-bold bg-white text-black px-6 py-3 rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2">
                     {isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />} GENERAR PRIMER PLAN
                </button>
             </div>
           )
       )}

       {activeSubTab === 'history' && (
           <div className="space-y-4 animate-fade-in">
               {history.length === 0 ? <div className="text-center py-10 text-gray-500">No hay sesiones.</div> : history.map((s, i) => (
                   <div key={i} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl flex justify-between items-center">
                       <div>
                           <div className="font-bold text-white">{s.workoutName}</div>
                           <div className="text-xs text-gray-500">{formatDate(s.date)}</div>
                       </div>
                       <div className="text-right">
                           <div className="font-bold text-white">{(s.summary.totalVolume/1000).toFixed(1)}k <span className="text-xs text-gray-500">VOL</span></div>
                           {s.summary.prCount > 0 && <div className="text-[10px] text-yellow-500 font-bold">{s.summary.prCount} PRs</div>}
                       </div>
                   </div>
               ))}
           </div>
       )}
    </div>
  );
};

const DashboardView = ({ user, onNavigateToClients }: { user: User, onNavigateToClients: () => void }) => {
  if (user.role === 'coach' || user.role === 'admin') {
      const users = DataEngine.getUsers();
      const clients = users.filter(u => u.role === 'client');
      const activePlans = clients.filter(c => DataEngine.getPlan(c.id)).length;
      
      return (
          <div className="space-y-6 animate-fade-in">
              <div className="flex justify-between items-center">
                 <div>
                     <h2 className="text-3xl font-bold font-display italic text-white">DASHBOARD</h2>
                     <p className="text-gray-500 text-sm">Resumen de operaciones</p>
                 </div>
                 <div className="text-right hidden md:block">
                     <p className="text-xs text-gray-500 font-bold uppercase">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                 </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatCard label="Atletas Totales" value={clients.length} icon={<Users className="text-blue-500" size={20} />} />
                  <StatCard label="Planes Activos" value={activePlans} icon={<Activity className="text-green-500" size={20} />} />
                  <StatCard label="Ejercicios" value={DataEngine.getExercises().length} icon={<Dumbbell className="text-orange-500" size={20} />} />
                  <StatCard label="Alertas" value="0" icon={<ShieldAlert className="text-red-500" size={20} />} />
              </div>

              <div className="bg-[#0F0F11] border border-white/5 p-6 rounded-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="font-bold text-lg text-white">Acciones Rápidas</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                       <button onClick={onNavigateToClients} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-red-500/30 transition-all text-left group">
                           <div className="bg-red-500/10 w-10 h-10 rounded-lg flex items-center justify-center text-red-500 mb-3 group-hover:scale-110 transition-transform">
                               <UserPlus size={20}/>
                           </div>
                           <h4 className="font-bold text-white">Gestionar Atletas</h4>
                           <p className="text-xs text-gray-500 mt-1">Ver lista, crear planes, asignar rutinas.</p>
                       </button>
                       <button className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-blue-500/30 transition-all text-left group">
                           <div className="bg-blue-500/10 w-10 h-10 rounded-lg flex items-center justify-center text-blue-500 mb-3 group-hover:scale-110 transition-transform">
                               <Zap size={20}/>
                           </div>
                           <h4 className="font-bold text-white">Rutina Rápida</h4>
                           <p className="text-xs text-gray-500 mt-1">Generar rutina express con IA.</p>
                       </button>
                  </div>
              </div>
          </div>
      );
  }

  // Athlete Dashboard
  const plan = DataEngine.getPlan(user.id);

  return (
      <div className="space-y-6 animate-fade-in">
           <div className="flex justify-between items-center mb-2">
               <div>
                  <h2 className="text-3xl font-bold font-display italic text-white flex items-center gap-2">
                      HOLA, {user.name.split(' ')[0]} <span className="text-2xl">👋</span>
                  </h2>
                  <p className="text-gray-500 text-sm">Tu evolución comienza hoy.</p>
               </div>
           </div>

           {!plan ? (
               <div className="bg-[#0F0F11] border border-white/5 rounded-3xl p-8 text-center flex flex-col items-center justify-center min-h-[400px]">
                   <div className="w-20 h-20 bg-gray-800 rounded-full flex items-center justify-center mb-6 animate-pulse">
                       <Dumbbell size={32} className="text-gray-500"/>
                   </div>
                   <h3 className="text-xl font-bold text-white mb-2">Sin Plan Asignado</h3>
                   <p className="text-gray-400 max-w-md mx-auto mb-6">Tu coach aún no ha cargado tu protocolo de entrenamiento. Relájate, la fuerza llega con paciencia.</p>
                   <button className="px-6 py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-sm text-gray-300 transition-colors">
                       Contactar Coach
                   </button>
               </div>
           ) : (
               <div className="bg-[#0F0F11] border border-white/5 rounded-3xl overflow-hidden relative">
                  <div className="p-6 border-b border-white/5 flex justify-between items-center bg-[#151518]">
                      <div>
                           <h3 className="text-lg font-bold text-white flex items-center gap-2">
                              <Trophy size={16} className="text-yellow-500"/> {plan.title}
                           </h3>
                           <p className="text-xs text-gray-500 mt-1">Plan Actual • Semana 1</p>
                      </div>
                      <div className="text-right">
                           <div className="text-2xl font-bold font-display text-white">{user.streak} <span className="text-sm font-sans font-normal text-gray-500">días</span></div>
                           <div className="text-[10px] uppercase font-bold text-green-500 flex items-center justify-end gap-1"><Flame size={10}/> Racha</div>
                      </div>
                  </div>
                  
                  <div className="p-4 md:p-6">
                       <PlanViewer plan={plan} mode="athlete" />
                  </div>
               </div>
           )}
      </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'workouts' | 'profile' | 'admin'>('dashboard');
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
        <div onClick={() => setActiveTab('dashboard')}>
           <BrandingLogo className="w-8 h-8" textSize="text-xl" />
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
          <BrandingLogo className="w-8 h-8 mb-2" textSize="text-2xl" />
          <p className="text-xs text-gray-500 tracking-[0.3em] font-bold mt-2">ELITE ZONE</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedClientId(null); }} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          
          {(currentUser.role === 'coach' || currentUser.role === 'admin') && (
             <>
                <NavButton active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setSelectedClientId(null); }} icon={<Users size={20} />} label="Atletas" />
                <NavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={<Dumbbell size={20} />} label="Biblioteca" />
             </>
          )}

          {currentUser.role === 'admin' && (
              <div className="pt-4 mt-4 border-t border-white/5">
                  <p className="px-4 text-[10px] text-gray-500 font-bold uppercase mb-2">Administración</p>
                  <NavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Shield size={20} />} label="Command Center" />
              </div>
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
        
        {(activeTab === 'clients' && (currentUser.role === 'coach' || currentUser.role === 'admin')) && !selectedClientId && (
          <ClientsView onSelectClient={navigateToClient} />
        )}
        
        {(activeTab === 'clients' && (currentUser.role === 'coach' || currentUser.role === 'admin')) && selectedClientId && (
          <ClientDetailView clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />
        )}
        
        {(activeTab === 'workouts' && (currentUser.role === 'coach' || currentUser.role === 'admin')) && <WorkoutsView />}
        
        {activeTab === 'admin' && currentUser.role === 'admin' && <AdminView />}

        {activeTab === 'profile' && <ProfileView user={currentUser} onLogout={handleLogout} />}
      </main>

      {/* MOBILE NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0A0A0C]/95 backdrop-blur-xl border-t border-white/10 flex justify-around p-2 z-50 pb-safe shadow-2xl">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedClientId(null); }} icon={<LayoutDashboard size={20} />} label="Inicio" />
        
        {(currentUser.role === 'coach' || currentUser.role === 'admin') && (
           <>
             <MobileNavButton active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setSelectedClientId(null); }} icon={<Users size={20} />} label="Atletas" />
             <MobileNavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={<Dumbbell size={20} />} label="Entreno" />
           </>
        )}
        
        {currentUser.role === 'admin' && (
             <MobileNavButton active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Shield size={20} />} label="Admin" />
        )}

        <MobileNavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon={<Menu size={20} />} label="Perfil" />
      </nav>
    </div>
  );
}