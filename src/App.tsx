import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, Sparkles, Activity,
  Dumbbell, History, Check, ShieldAlert, Search,
  User as UserIcon, Timer as TimerIcon, AlertTriangle, Loader2, Zap, BrainCircuit,
  CalendarDays, Trophy, Pencil, Menu, Youtube, Info, UserMinus, UserCog, Circle, CheckCircle,
  MoreVertical, Flame, StopCircle, ClipboardList, Disc, MessageSquare, Send, TrendingUp, Shield, Palette, MapPin,
  Briefcase, BarChart4, AlertOctagon, MessageCircle, Power, UserX, UserCheck, KeyRound, Mail, Minus,
  Instagram, Facebook, Linkedin, Phone, ChevronRight, Layers, ArrowUpCircle, CornerRightDown, Link as LinkIcon,
  Clock, Repeat, Pause, RotateCcw, AlertCircle, Copy, Archive
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, SetEntry, WorkoutProgress, ChatMessage, UserRole, TrainingMethod } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine, analyzeProgress, getTechnicalAdvice } from './services/geminiService';
import { supabaseConnectionStatus } from './services/supabaseClient';
import { AssignRoutineModal } from './components/AssignRoutineModal';
import { ScheduleVerificationPanel } from './components/ScheduleVerificationPanel';

// --- CONFIGURACIÓN DE VERSIÓN ESTABLE 8644345 ---
const STORAGE_KEY = 'KINETIX_DATA_PRO_V12_6_SAFE';
const SESSION_KEY = 'KINETIX_SESSION_PRO_V12_6_SAFE';
const ADMIN_UUID = '00000000-0000-0000-0000-000000000000';
const OFFICIAL_LOGO_URL = 'https://raw.githubusercontent.com/KinetixZone/Kinetix-fit/32b6e2ce7e4abcd5b5018cdb889feec444a66e22/TEAM%20JG.jpg';

const generateUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const RESCUE_WORKOUT: WorkoutExercise[] = [
    { exerciseId: 'res1', name: 'Burpees', targetSets: 4, targetReps: '15', targetRest: 60, coachCue: 'Mantén ritmo constante.', method: 'standard' },
    { exerciseId: 'res2', name: 'Sentadillas Air', targetSets: 4, targetReps: '20', targetRest: 60, coachCue: 'Rompe paralelo.', method: 'standard' },
    { exerciseId: 'res3', name: 'Push Ups', targetSets: 4, targetReps: 'Max', targetRest: 60, coachCue: 'Pecho al suelo.', method: 'standard' },
    { exerciseId: 'res4', name: 'Plancha Abdominal', targetSets: 4, targetReps: '45s', targetRest: 60, coachCue: 'Aprieta abdomen.', method: 'standard' },
];

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

// --- UTILIDAD VIDEO ---
const getYoutubeId = (url: string | undefined) => {
    if (!url) return null;
    let id = '';
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname.includes('youtube.com')) {
            if (urlObj.pathname.startsWith('/shorts/')) {
                id = urlObj.pathname.split('/shorts/')[1];
            } else if (urlObj.searchParams.has('v')) {
                id = urlObj.searchParams.get('v') || '';
            }
        } else if (urlObj.hostname.includes('youtu.be')) {
            id = urlObj.pathname.slice(1);
        }
        if (id.includes('?')) id = id.split('?')[0];
        if (id.includes('&')) id = id.split('&')[0];
    } catch (e) {
        if (url.includes('shorts/')) id = url.split('shorts/')[1].split('?')[0];
        else if (url.includes('youtu.be/')) id = url.split('youtu.be/')[1].split('?')[0];
        else if (url.includes('watch?v=')) id = url.split('watch?v=')[1].split('&')[0];
    }
    return id;
};

const getEmbedUrl = (url: string | undefined) => {
    const id = getYoutubeId(url);
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
};

const getThumbnailUrl = (url: string | undefined) => {
    const id = getYoutubeId(url);
    return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

// --- MOTOR DE DATOS ---
const DataEngine = {
  getStore: () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : {};
    } catch { return {}; }
  },
  saveStore: (data: any) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new Event('storage-update'));
  },
  init: () => {
    const store = DataEngine.getStore();
    if (!store.USERS) {
      const initialUsers = [
          { ...MOCK_USER, isActive: true },
          { id: 'coach-id-1', name: 'Jorge Gonzalez', email: 'coach@kinetix.com', role: 'coach' as UserRole, goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, streak: 15, daysPerWeek: 6, equipment: [], createdAt: new Date().toISOString(), isActive: true },
          { id: ADMIN_UUID, name: 'Admin Kinetix', email: 'admin@kinetix.com', role: 'admin' as UserRole, goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, streak: 0, daysPerWeek: 0, equipment: [], createdAt: new Date().toISOString(), isActive: true }
      ];
      store.USERS = JSON.stringify(initialUsers);
      store.EXERCISES = JSON.stringify(INITIAL_EXERCISES);
      store.CONFIG = JSON.stringify({ appName: 'KINETIX ZONE', logoUrl: OFFICIAL_LOGO_URL, ai: { chatbot: { enabled: true } } });
      DataEngine.saveStore(store);
    }
  },
  getConfig: () => JSON.parse(DataEngine.getStore().CONFIG || '{}'),
  saveConfig: (cfg: any) => { const store = DataEngine.getStore(); store.CONFIG = JSON.stringify(cfg); DataEngine.saveStore(store); },
  getUsers: (): User[] => JSON.parse(DataEngine.getStore().USERS || '[]'),
  getUserById: (id: string) => DataEngine.getUsers().find(u => u.id === id),
  getUserByNameOrEmail: (query: string) => {
    const q = query.toLowerCase().trim();
    return DataEngine.getUsers().find(u => u.email.toLowerCase() === q || u.name.toLowerCase() === q);
  },
  saveUser: (user: User) => {
    const users = DataEngine.getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    const store = DataEngine.getStore();
    store.USERS = JSON.stringify(users);
    DataEngine.saveStore(store);
  },
  deleteUser: (id: string) => {
    const users = DataEngine.getUsers().filter(u => u.id !== id);
    const store = DataEngine.getStore();
    store.USERS = JSON.stringify(users);
    DataEngine.saveStore(store);
  },
  getExercises: (): Exercise[] => JSON.parse(DataEngine.getStore().EXERCISES || '[]'),
  addExercise: (ex: Exercise) => {
    const exs = DataEngine.getExercises();
    exs.push(ex);
    const store = DataEngine.getStore();
    store.EXERCISES = JSON.stringify(exs);
    DataEngine.saveStore(store);
  },
  getPlan: (uid: string): Plan | null => {
    const data = DataEngine.getStore()[`PLAN_${uid}`];
    return data ? JSON.parse(data) : null;
  },
  savePlan: (plan: Plan) => {
    const store = DataEngine.getStore();
    store[`PLAN_${plan.userId}`] = JSON.stringify(plan);
    DataEngine.saveStore(store);
  },
  deletePlan: (uid: string) => {
    const store = DataEngine.getStore();
    delete store[`PLAN_${uid}`];
    DataEngine.saveStore(store);
  },
  saveSetLog: (userId: string, workoutId: string, exIdx: number, entry: SetEntry) => {
    const store = DataEngine.getStore();
    const key = `LOG_${userId}_${workoutId}`;
    const logs = store[key] ? JSON.parse(store[key]) : {};
    if (!logs[exIdx]) logs[exIdx] = [];
    const existing = logs[exIdx].findIndex((s: any) => s.setNumber === entry.setNumber);
    if (existing >= 0) logs[exIdx][existing] = entry; else logs[exIdx].push(entry);
    store[key] = JSON.stringify(logs);
    DataEngine.saveStore(store);
  },
  getWorkoutLog: (userId: string, workoutId: string): WorkoutProgress => {
    const data = DataEngine.getStore()[`LOG_${userId}_${workoutId}`];
    return data ? JSON.parse(data) : {};
  },
  archiveWorkout: async (userId: string, workout: Workout, logs: WorkoutProgress, startTime: number) => {
    const store = DataEngine.getStore();
    const historyKey = `HISTORY_${userId}`;
    const history = store[historyKey] ? JSON.parse(store[historyKey]) : [];
    
    const durationMinutes = Math.floor((Date.now() - startTime) / 60000);
    const totalVolume = Object.values(logs).reduce((acc: number, sets: any) => acc + sets.reduce((sAcc: number, s: any) => sAcc + (parseFloat(s.weight) * parseInt(s.reps)), 0), 0);

    const session = {
      id: generateUUID(),
      workoutId: workout.id,
      workoutName: workout.name,
      date: new Date().toISOString(),
      logs,
      summary: { 
        durationMinutes, 
        totalVolume, 
        exercisesCompleted: Object.keys(logs).length,
        prCount: 0 
      }
    };
    history.unshift(session);
    store[historyKey] = JSON.stringify(history);
    delete store[`LOG_${userId}_${workout.id}`];
    
    // Streak logic
    const users = DataEngine.getUsers();
    const uIdx = users.findIndex(u => u.id === userId);
    if(uIdx >= 0) users[uIdx].streak += 1;
    store.USERS = JSON.stringify(users);
    
    DataEngine.saveStore(store);
    return session;
  },
  getClientHistory: (userId: string) => JSON.parse(DataEngine.getStore()[`HISTORY_${userId}`] || '[]'),
  getTemplates: (): Plan[] => {
      const store = DataEngine.getStore();
      const tplData = store['TEMPLATES_DB'];
      return tplData ? JSON.parse(tplData) : [];
  },
  saveTemplate: (template: Plan) => {
      const store = DataEngine.getStore();
      const templates = store['TEMPLATES_DB'] ? JSON.parse(store['TEMPLATES_DB']) : [];
      const idx = templates.findIndex((t: Plan) => t.id === template.id);
      if (idx >= 0) templates[idx] = template; else templates.push(template);
      store['TEMPLATES_DB'] = JSON.stringify(templates);
      DataEngine.saveStore(store);
  },
  deleteTemplate: (id: string) => {
      const store = DataEngine.getStore();
      let templates = store['TEMPLATES_DB'] ? JSON.parse(store['TEMPLATES_DB']) : [];
      templates = templates.filter((t: Plan) => t.id !== id);
      store['TEMPLATES_DB'] = JSON.stringify(templates);
      DataEngine.saveStore(store);
  }
};

// --- COMPONENTES UI ---

const BrandingLogo = ({ className = "w-10 h-10", textSize = "text-2xl", showText = true }: any) => {
  const cfg = DataEngine.getConfig();
  return (
    <div className="flex items-center gap-3">
      <img src={cfg.logoUrl || OFFICIAL_LOGO_URL} alt="Logo" className={`${className} object-cover rounded-2xl shadow-xl`} />
      {showText && <span className={`font-display font-black italic tracking-tighter ${textSize} text-white`}>{cfg.appName || 'KINETIX'}</span>}
    </div>
  );
};

const SocialLinks = ({ className = "" }: { className?: string }) => (
    <div className={`flex items-center gap-4 ${className}`}>
        <a href="https://instagram.com" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors"><Instagram size={18}/></a>
        <a href="https://facebook.com" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors"><Facebook size={18}/></a>
        <a href="https://whatsapp.com" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-white transition-colors"><Phone size={18}/></a>
    </div>
);

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold text-sm transition-all ${active ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
    {icon} <span>{label}</span>
  </button>
);

const MobileNavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-red-500' : 'text-gray-600'}`}>
    {icon} <span className="text-[10px] font-bold uppercase">{label}</span>
  </button>
);

const StatCard = ({ label, value, icon }: any) => (
  <div className="bg-[#0F0F11] border border-white/5 p-4 rounded-2xl flex flex-col justify-between shadow-xl">
    <div className="flex justify-between items-start mb-2"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{label}</span>{icon}</div>
    <span className="text-2xl font-display font-black italic text-white truncate">{value}</span>
  </div>
);

const ConnectionStatus = () => (
    <div className={`fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-full text-[9px] font-bold border flex items-center gap-2 ${supabaseConnectionStatus.isConfigured ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${supabaseConnectionStatus.isConfigured ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}/> {supabaseConnectionStatus.isConfigured ? 'CLOUD SYNC' : 'LOCAL ENGINE'}
    </div>
);

const TechnicalChatbot = ({ onClose }: { onClose: () => void }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'ai', text: 'Hola Atleta. Soy tu asistente Kinetix. ¿Tienes alguna duda técnica sobre tu rutina?', timestamp: Date.now() }]);
    const [input, setInput] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);
    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsTyping(true);
        try {
            const exercises = DataEngine.getExercises();
            const advice = await getTechnicalAdvice(input, exercises);
            setMessages(prev => [...prev, { role: 'ai', text: advice || 'No pude procesar tu duda.', timestamp: Date.now() }]);
        } catch {
            setMessages(prev => [...prev, { role: 'ai', text: 'Error de conexión con el Coach IA.', timestamp: Date.now() }]);
        } finally { setIsTyping(false); }
    };
    return (
        <div className="fixed inset-0 md:inset-auto md:bottom-24 md:right-8 md:w-96 md:h-[500px] bg-[#0A0A0C] border border-white/10 md:rounded-3xl shadow-2xl z-50 flex flex-col animate-fade-in-up">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-blue-600/10 rounded-t-3xl"><h3 className="font-bold text-blue-400 flex items-center gap-2"><Sparkles size={16}/> SOPORTE KINETIX IA</h3><button onClick={onClose} className="text-gray-400"><X size={20}/></button></div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {messages.map((m, i) => (<div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[80%] p-3 rounded-2xl text-xs font-medium leading-relaxed ${m.role === 'user' ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-300 border border-white/5'}`}>{m.text}</div></div>))}
                {isTyping && <div className="flex justify-start"><div className="bg-white/5 p-3 rounded-2xl flex gap-1"><div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce" /><div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:0.2s]" /><div className="w-1.5 h-1.5 bg-gray-600 rounded-full animate-bounce [animation-delay:0.4s]" /></div></div>}
            </div>
            <div className="p-4 border-t border-white/10 flex gap-2"><input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Escribe tu duda..." className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-white outline-none focus:border-blue-500" /><button onClick={handleSend} className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-900/20"><Send size={18}/></button></div>
        </div>
    );
};

const UserInviteModal = ({ currentUser, onClose, onInviteSuccess }: { currentUser: User, onClose: () => void, onInviteSuccess: () => void }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>('client');
    const handleInvite = () => {
        if (!name || !email) return;
        const newUser: User = { id: generateUUID(), name, email, role, goal: Goal.PERFORMANCE, level: UserLevel.BEGINNER, daysPerWeek: 4, equipment: [], streak: 0, createdAt: new Date().toISOString(), isActive: true, coachId: currentUser.id };
        DataEngine.saveUser(newUser);
        onInviteSuccess();
        onClose();
    };
    return (
        <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#1A1A1D] w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-6">Agregar Usuario</h3>
                <div className="space-y-4">
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Nombre Completo</label><input value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Juan Perez" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white focus:border-red-500 outline-none" /></div>
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Email</label><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="atleta@correo.com" className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white focus:border-red-500 outline-none" /></div>
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold ml-1">Rol en el Sistema</label><select value={role} onChange={e => setRole(e.target.value as UserRole)} className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white focus:border-red-500 outline-none"><option value="client">Atleta</option><option value="coach">Coach</option><option value="admin">Administrador</option></select></div>
                </div>
                <div className="flex gap-3 pt-8"><button onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-xl font-bold text-sm text-gray-400 hover:text-white transition-colors">Cancelar</button><button onClick={handleInvite} className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-sm text-white hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all">Guardar</button></div>
            </div>
        </div>
    );
};

// --- VISTAS ESPECÍFICAS ---

const VideoThumbnail: React.FC<{ url?: string, name: string, onClick: () => void }> = ({ url, name, onClick }) => {
    const thumb = getThumbnailUrl(url);
    return (
        <div 
            onClick={onClick} 
            className="relative bg-black rounded-lg overflow-hidden group cursor-pointer border border-white/10 hover:border-red-500/50 transition-all shrink-0 w-24 h-16 md:w-32 md:h-20"
        >
            {thumb ? (
                <img src={thumb} alt={name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5"><Play size={20} className="text-gray-500"/></div>
            )}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-black/50 p-1.5 rounded-full backdrop-blur-sm group-hover:scale-110 transition-transform">
                     <Play size={12} fill="white" className="text-white"/>
                </div>
            </div>
        </div>
    );
};

const ExerciseCard = ({ exercise, index, workoutId, userId, onShowVideo, mode, onSetComplete, history }: any) => {
  const [logs, setLogs] = useState<WorkoutProgress>(() => mode === 'athlete' ? DataEngine.getWorkoutLog(userId, workoutId) : {});
  const [executionState, setExecutionState] = useState<'idle' | 'running' | 'paused'>('idle');
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const [currentPhase, setCurrentPhase] = useState<'work' | 'rest'>('work');
  const [currentMinute, setCurrentMinute] = useState(1);
  const timerRef = useRef<number | null>(null);

  // Identificar el método de entrenamiento
  const method: TrainingMethod = exercise.method || 'standard';

  const handleToggle = (setNum: number, isDone: boolean) => {
    const entry: SetEntry = { setNumber: setNum, weight: exercise.targetLoad || '0', reps: exercise.targetReps, completed: !isDone, timestamp: Date.now() };
    DataEngine.saveSetLog(userId, workoutId, index, entry);
    setLogs(prev => ({...prev, [index]: [...(prev[index] || []).filter(s => s.setNumber !== setNum), entry]}));
    
    // Si marcamos como completo en Tabata/EMOM, detenemos el timer
    if (!isDone && (method === 'tabata' || method === 'emom')) {
        setExecutionState('idle');
        if(timerRef.current) window.clearInterval(timerRef.current);
    } else if (!isDone) {
        // Lógica standard de descanso
        let restTime = (exercise.targetRest || 60);
        if (method === 'biserie') restTime = 0;
        if (restTime > 0) onSetComplete(restTime);
    }
    if (!isDone && navigator.vibrate) navigator.vibrate(50);
  };

  const startTabata = () => {
      setExecutionState('running');
      setCurrentRound(1);
      setCurrentPhase('work');
      setTimeLeft(exercise.tabataConfig.workTimeSec);
  };

  const startEmom = () => {
      setExecutionState('running');
      setCurrentMinute(1);
      setTimeLeft(60);
  };

  const togglePause = () => {
      setExecutionState(prev => prev === 'running' ? 'paused' : 'running');
  };

  const stopExecution = () => {
      setExecutionState('idle');
      if(timerRef.current) window.clearInterval(timerRef.current);
  };

  // Timer Logic
  useEffect(() => {
      if (executionState === 'running') {
          timerRef.current = window.setInterval(() => {
              setTimeLeft(prev => {
                  if (prev <= 1) {
                      // Fase terminada
                      if (method === 'tabata') {
                          if (currentPhase === 'work') {
                              setCurrentPhase('rest');
                              return exercise.tabataConfig.restTimeSec;
                          } else {
                              if (currentRound < exercise.tabataConfig.rounds) {
                                  setCurrentRound(r => r + 1);
                                  setCurrentPhase('work');
                                  return exercise.tabataConfig.workTimeSec;
                              } else {
                                  // Tabata Complete
                                  setExecutionState('idle');
                                  return 0;
                              }
                          }
                      } else if (method === 'emom') {
                          if (currentMinute < exercise.emomConfig.durationMin) {
                              setCurrentMinute(m => m + 1);
                              return 60;
                          } else {
                              // EMOM Complete
                              setExecutionState('idle');
                              return 0;
                          }
                      }
                  }
                  return prev - 1;
              });
          }, 1000);
      } else {
          if(timerRef.current) window.clearInterval(timerRef.current);
      }
      return () => { if(timerRef.current) window.clearInterval(timerRef.current); };
  }, [executionState, method, currentPhase, currentRound, currentMinute, exercise]);

  // Determine current active exercise for display
  const activeExerciseName = useMemo(() => {
      if (method === 'tabata') {
          if (currentPhase === 'rest') return "DESCANSAR";
          if (exercise.tabataConfig.structure === 'simple') return exercise.tabataConfig.exercises[0]?.name;
          if (exercise.tabataConfig.structure === 'alternado') return exercise.tabataConfig.exercises[(currentRound - 1) % exercise.tabataConfig.exercises.length]?.name;
          if (exercise.tabataConfig.structure === 'lista') return exercise.tabataConfig.exercises[(currentRound - 1) % exercise.tabataConfig.exercises.length]?.name;
      } else if (method === 'emom') {
          if (exercise.emomConfig.type === 'simple') return exercise.emomConfig.simpleConfig?.exercise;
          if (exercise.emomConfig.type === 'alternado') return currentMinute % 2 !== 0 ? exercise.emomConfig.minuteOdd?.exercise : exercise.emomConfig.minuteEven?.exercise;
          if (exercise.emomConfig.type === 'complejo' && exercise.emomConfig.blocks) {
              const block = exercise.emomConfig.blocks.find((b: any) => b.minutes.includes(currentMinute));
              return block ? block.exercise : "Descanso";
          }
      }
      return exercise.name;
  }, [method, exercise, currentRound, currentPhase, currentMinute]);

  const currentExLogs = logs[index] || [];

  return (
    <div className={`bg-[#0F0F11] border rounded-2xl p-5 mb-4 shadow-sm hover:border-white/10 transition-all relative overflow-hidden ${method === 'biserie' ? 'border-orange-500/30' : method === 'tabata' ? 'border-cyan-500/30' : method === 'emom' ? 'border-yellow-500/30' : 'border-white/5'}`}>
      
      {/* Badges de Método */}
      {method === 'biserie' && <div className="absolute top-0 right-0 bg-orange-600/20 text-orange-500 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-orange-500/20 flex items-center gap-1 uppercase tracking-widest"><Layers size={10} /> Bi-Serie</div>}
      {method === 'ahap' && <div className="absolute top-0 right-0 bg-purple-600/20 text-purple-400 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-purple-500/20 flex items-center gap-1 uppercase tracking-widest"><ArrowUpCircle size={10} /> AHAP</div>}
      {method === 'dropset' && <div className="absolute top-0 right-0 bg-red-600/20 text-red-500 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-red-500/20 flex items-center gap-1 uppercase tracking-widest"><CornerRightDown size={10} /> Drop Set</div>}
      {method === 'tabata' && <div className="absolute top-0 right-0 bg-cyan-600/20 text-cyan-400 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-cyan-500/20 flex items-center gap-1 uppercase tracking-widest"><TimerIcon size={10} /> TABATA</div>}
      {method === 'emom' && <div className="absolute top-0 right-0 bg-yellow-600/20 text-yellow-400 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-yellow-500/20 flex items-center gap-1 uppercase tracking-widest"><Clock size={10} /> EMOM</div>}

      {/* VISTA EJECUCIÓN ACTIVA (TIMER) */}
      {executionState !== 'idle' && (
          <div className="absolute inset-0 bg-[#0F0F11] z-10 flex flex-col items-center justify-center p-6 animate-fade-in">
              <div className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-2">
                  {method === 'tabata' ? `ROUND ${currentRound} / ${exercise.tabataConfig.rounds}` : `MINUTO ${currentMinute} / ${exercise.emomConfig.durationMin}`}
              </div>
              <div className={`text-6xl font-black font-display mb-4 tabular-nums ${currentPhase === 'rest' ? 'text-blue-500' : 'text-white'}`}>{timeLeft}s</div>
              <div className="flex items-center gap-2 mb-8">
                  <span className={`text-xl font-bold uppercase ${currentPhase === 'rest' ? 'text-blue-500' : 'text-white'}`}>{activeExerciseName}</span>
                  {activeExerciseName !== 'DESCANSAR' && <button onClick={() => onShowVideo(activeExerciseName)} className="text-gray-400 hover:text-white"><Play size={20}/></button>}
              </div>
              <div className="flex gap-4 w-full max-w-xs">
                  <button onClick={togglePause} className="flex-1 bg-white/10 hover:bg-white/20 py-4 rounded-xl flex items-center justify-center text-white transition-colors">{executionState === 'running' ? <Pause size={24}/> : <Play size={24}/>}</button>
                  <button onClick={stopExecution} className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-500 py-4 rounded-xl flex items-center justify-center transition-colors"><StopCircle size={24}/></button>
              </div>
          </div>
      )}

      {/* CABECERA STANDARD (Cuando no está en ejecución) */}
      <div className="flex justify-between items-start mb-4 mt-2">
        <div className="flex items-start gap-3 w-full">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-bold text-gray-500 text-sm">{index + 1}</div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-white leading-tight">{exercise.name}</h3>
            
            {/* Visualización Específica TABATA / EMOM */}
            {method === 'tabata' && exercise.tabataConfig && (
                <div className="mt-3 space-y-3">
                    <div className="flex flex-wrap gap-2">
                         <span className="text-[10px] font-bold bg-cyan-500/10 text-cyan-500 px-2 py-1 rounded border border-cyan-500/20 flex items-center gap-1"><Repeat size={10}/> {exercise.tabataConfig.sets} CICLOS</span>
                         <span className="text-[10px] font-bold bg-white/5 text-gray-300 px-2 py-1 rounded border border-white/5">{exercise.tabataConfig.workTimeSec}s ON / {exercise.tabataConfig.restTimeSec}s OFF</span>
                         <span className="text-[10px] font-bold bg-white/5 text-gray-300 px-2 py-1 rounded border border-white/5">{exercise.tabataConfig.rounds} Rounds</span>
                    </div>
                    
                    <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                         <p className="text-[9px] text-gray-500 uppercase font-bold mb-2 tracking-widest">Protocolo: {exercise.tabataConfig.structure}</p>
                         <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                             {exercise.tabataConfig.exercises.map((ex: any, i: number) => (
                                 <VideoThumbnail 
                                    key={i} 
                                    name={ex.name} 
                                    url={ex.videoUrl} 
                                    onClick={() => onShowVideo(ex.name)}
                                 />
                             ))}
                         </div>
                         <div className="flex flex-col gap-1 mt-2">
                            {exercise.tabataConfig.exercises.map((ex: any, i: number) => (
                                <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                                    <span className="text-cyan-500 font-bold">{i+1}.</span>
                                    <span>{ex.name}</span>
                                </div>
                            ))}
                         </div>
                    </div>
                </div>
            )}

            {method === 'emom' && exercise.emomConfig && (
                <div className="mt-3 space-y-3">
                     <div className="flex flex-wrap gap-2">
                         <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-500 px-2 py-1 rounded border border-yellow-500/20 flex items-center gap-1"><Clock size={10}/> {exercise.emomConfig.durationMin} MINUTOS</span>
                         <span className="text-[10px] font-bold bg-white/5 text-gray-300 px-2 py-1 rounded border border-white/5 uppercase">{exercise.emomConfig.type}</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                        {/* Simple */}
                        {exercise.emomConfig.type === 'simple' && exercise.emomConfig.simpleConfig && (
                             <div className="flex items-center gap-3">
                                 <VideoThumbnail 
                                    name={exercise.emomConfig.simpleConfig.exercise} 
                                    url={DataEngine.getExercises().find(e => e.name === exercise.emomConfig.simpleConfig?.exercise)?.videoUrl} 
                                    onClick={() => onShowVideo(exercise.emomConfig.simpleConfig?.exercise)}
                                 />
                                 <div>
                                    <p className="text-sm font-bold text-white">{exercise.emomConfig.simpleConfig.exercise}</p>
                                    <p className="text-xs text-yellow-500 font-bold">{exercise.emomConfig.simpleConfig.reps ? `${exercise.emomConfig.simpleConfig.reps} Reps` : `${exercise.emomConfig.simpleConfig.durationSec}s Trabajo`}</p>
                                 </div>
                             </div>
                        )}

                        {/* Alternado */}
                        {exercise.emomConfig.type === 'alternado' && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="text-[9px] font-bold text-blue-400 mb-1">MIN IMPAR</div>
                                    <VideoThumbnail 
                                        name={exercise.emomConfig.minuteOdd?.exercise || ''}
                                        url={DataEngine.getExercises().find(e => e.name === exercise.emomConfig.minuteOdd?.exercise)?.videoUrl}
                                        onClick={() => onShowVideo(exercise.emomConfig.minuteOdd?.exercise)}
                                    />
                                    <p className="text-xs font-bold text-white mt-1 truncate">{exercise.emomConfig.minuteOdd?.exercise}</p>
                                </div>
                                <div>
                                    <div className="text-[9px] font-bold text-green-400 mb-1">MIN PAR</div>
                                    <VideoThumbnail 
                                        name={exercise.emomConfig.minuteEven?.exercise || ''}
                                        url={DataEngine.getExercises().find(e => e.name === exercise.emomConfig.minuteEven?.exercise)?.videoUrl}
                                        onClick={() => onShowVideo(exercise.emomConfig.minuteEven?.exercise)}
                                    />
                                    <p className="text-xs font-bold text-white mt-1 truncate">{exercise.emomConfig.minuteEven?.exercise}</p>
                                </div>
                            </div>
                        )}
                        
                         {/* Complejo */}
                        {exercise.emomConfig.type === 'complejo' && exercise.emomConfig.blocks && (
                            <div className="space-y-2">
                                {exercise.emomConfig.blocks.map((block: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center border-b border-white/5 pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center cursor-pointer hover:text-yellow-500" onClick={() => onShowVideo(block.exercise)}><Play size={12}/></div>
                                            <div>
                                                <p className="text-[9px] text-gray-500 font-bold">MIN {block.minutes.join(', ')}</p>
                                                <p className="text-xs font-bold text-white">{block.exercise}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold text-yellow-500">{block.reps || block.durationSec + 's'}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Visualización Standard / Otros */}
            {!['tabata', 'emom'].includes(method) && (
                <div className="flex flex-wrap gap-2 mt-2 items-center">
                {exercise.targetLoad && (
                    <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                    <ShieldAlert size={10} className="text-yellow-500" />
                    <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">
                        {method === 'ahap' ? 'CARGA INCREMENTAL' : `META: ${exercise.targetLoad}KG`}
                    </span>
                    </div>
                )}
                <div className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{exercise.targetSets}X{exercise.targetReps}</div>
                </div>
            )}
            
            {/* Si es BISERIE, mostrar el Ejercicio B aquí mismo */}
            {method === 'biserie' && exercise.pair && (
                <div className="mt-3 bg-white/5 p-3 rounded-xl border border-white/5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                        <div className="w-1 h-8 bg-orange-500 rounded-full mt-1"></div>
                        <div>
                            <div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">SEGUNDO EJERCICIO (B)</div>
                            <h4 className="font-bold text-sm text-white">{exercise.pair.name}</h4>
                            <div className="flex gap-2 mt-1">
                                <span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300 font-bold">{exercise.pair.targetReps} Reps</span>
                                {exercise.pair.targetLoad && <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded font-bold border border-yellow-500/10">{exercise.pair.targetLoad}kg</span>}
                            </div>
                        </div>
                    </div>
                    {/* Botón de Video para Ejercicio B */}
                    <button onClick={() => onShowVideo(exercise.pair.name)} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-orange-500 transition-colors shrink-0"><Play size={14} /></button>
                </div>
            )}
            
            {(exercise.coachCue || method === 'dropset') && (
                <p className="text-xs text-gray-400 mt-2 italic">
                    {method === 'dropset' && <span className="text-red-400 font-bold mr-1">Fallo + Bajada. </span>}
                    {exercise.coachCue}
                </p>
            )}
          </div>
        </div>
        <button onClick={() => onShowVideo(exercise.name)} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-red-500 transition-colors shrink-0"><Play size={18} /></button>
      </div>

      {mode === 'athlete' && (
        <div className="space-y-2 mt-4">
          {Array.from({ length: exercise.targetSets }, (_, i) => i + 1).map(setNum => {
            const isDone = currentExLogs.find(l => l.setNumber === setNum)?.completed;
            let setLabel = `SET ${setNum}`;
            let setSubLabel = `OBJ: ${exercise.targetLoad || 'LIBRE'} x ${exercise.targetReps}`;

            if (method === 'ahap') {
                setLabel += " (↑)";
                // Mostrar el peso específico para este set si existe
                const targetWeightForSet = exercise.targetWeights?.[setNum - 1] || exercise.targetLoad || '?';
                setSubLabel = `CARGA: ${targetWeightForSet}KG x ${exercise.targetReps}`;
            } else if (method === 'dropset') {
                 // Lógica para mostrar drops (FIXED vs PER_SERIES)
                 let dropsToDisplay = exercise.drops; // Por defecto FIXED
                 if (exercise.dropsetPatternMode === 'PER_SERIES' && exercise.dropsetSeriesPatterns && exercise.dropsetSeriesPatterns[setNum - 1]) {
                     dropsToDisplay = exercise.dropsetSeriesPatterns[setNum - 1];
                 }
                 setSubLabel = dropsToDisplay && dropsToDisplay.length > 0
                    ? `DROPS: ${dropsToDisplay.map((d:any) => `${d.weight}kg`).join(' → ')}`
                    : 'Fallo mecánico + Bajada';
            } else if (method === 'biserie') {
                 setSubLabel = "Completa A + B sin descanso";
            } else if (method === 'tabata') {
                 setLabel = `TABATA BLOCK ${setNum}`;
                 setSubLabel = `${exercise.tabataConfig?.rounds || 8} Rounds Completos`;
            } else if (method === 'emom') {
                 setLabel = `EMOM BLOCK ${setNum}`;
                 setSubLabel = `Duración Total: ${exercise.emomConfig?.durationMin || 10} min`;
            }

            return (
              <div key={setNum} className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${isDone ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5 border border-transparent'}`}>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${isDone ? 'text-green-400' : 'text-gray-400'}`}>{setLabel}</span>
                  <span className={`text-[10px] font-bold ${isDone ? 'text-green-500/60' : 'text-gray-600'}`}>{setSubLabel}</span>
                </div>
                {(method === 'tabata' || method === 'emom') && !isDone ? (
                    <button onClick={method === 'tabata' ? startTabata : startEmom} className="px-4 py-2 bg-white text-black text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center gap-2"><Play size={12}/> INICIAR</button>
                ) : (
                    <button 
                    onClick={() => handleToggle(setNum, !!isDone)} 
                    className={`w-12 h-10 rounded-lg flex items-center justify-center transition-all ${isDone ? 'bg-green-500 text-black shadow-lg shadow-green-500/20 animate-flash' : 'bg-white/10 text-gray-500 hover:bg-white/20'}`}
                    >
                    {isDone ? <Check size={20} strokeWidth={4} /> : <Circle size={20} />}
                    </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PlanViewer = ({ plan, mode = 'coach' }: { plan: Plan, mode?: 'coach' | 'athlete' }) => {
  const [showVideo, setShowVideo] = useState<string | null>(null);
  const [activeRescue, setActiveRescue] = useState<string | null>(null);
  const [finishScreen, setFinishScreen] = useState<any | null>(null);
  const [timer, setTimer] = useState<{ active: boolean, seconds: number }>({ active: false, seconds: 60 });
  const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
  const startTime = useRef(Date.now());

  // --- SOLUCIÓN DEL PROBLEMA DE VIDEO (BISERIE / TABATA / EMOM) ---
  const activeVideoUrl = useMemo(() => {
    if (!showVideo) return null;
    const dbExercise = DataEngine.getExercises().find(e => e.name === showVideo);
    if (dbExercise?.videoUrl) return dbExercise.videoUrl;
    
    // Búsqueda profunda en workouts para encontrar videos custom
    for (const w of plan.workouts) {
        for (const ex of w.exercises) {
            if (ex.pair?.name === showVideo && ex.pair.videoUrl) return ex.pair.videoUrl;
            if (ex.tabataConfig?.exercises) {
                const tabataEx = ex.tabataConfig.exercises.find((te:any) => te.name === showVideo);
                if (tabataEx?.videoUrl) return tabataEx.videoUrl;
            }
            if (ex.emomConfig) {
                // Resolver videos para EMOM si no están en catálogo global (fallback)
                if (ex.emomConfig.simpleConfig?.exercise === showVideo && dbExercise) return dbExercise.videoUrl;
            }
        }
    }
    return null;
  }, [showVideo, plan]);

  const embedSrc = getEmbedUrl(activeVideoUrl || '');
  // ------------------------------------------------

  const handleSetComplete = useCallback((rest?: number) => {
    if (rest && rest > 0) {
        setTimer({ active: true, seconds: rest });
    }
  }, []);

  const handleFinishWorkout = (workout: Workout) => {
    if(confirm("¿Has terminado tu sesión?")) {
      const logs = DataEngine.getWorkoutLog(plan.userId, workout.id);
      DataEngine.archiveWorkout(plan.userId, workout, logs, startTime.current).then(session => {
          window.scrollTo(0,0);
          setFinishScreen(session);
      });
    }
  };

  const handleClassAttendance = (workout: Workout, attended: boolean) => {
      if (attended) {
          if(confirm("¿Confirmar asistencia a clase?")) {
              DataEngine.archiveWorkout(plan.userId, workout, { 0: [{ setNumber: 1, weight: '0', reps: '1', completed: true, timestamp: Date.now() }] }, Date.now());
              window.scrollTo(0,0);
              setFinishScreen({ summary: { exercisesCompleted: 1, totalVolume: 0, durationMinutes: 60, prCount: 0 }});
          }
      } else {
          setActiveRescue(workout.id);
      }
  };

  const toggleWorkout = (id: string) => { setExpandedWorkouts(prev => ({...prev, [id]: !prev[id]})); };

  if (finishScreen) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-fade-in px-6">
      <Trophy size={80} className="text-yellow-500 mb-6 drop-shadow-2xl" />
      <h2 className="text-5xl font-display font-black italic text-white mb-2 leading-none uppercase">SESIÓN COMPLETA</h2>
      <p className="text-green-400 font-bold uppercase tracking-widest text-xs">Protocolo Dominado</p>
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-10">
        <div className="bg-[#0F0F11] border border-white/10 p-5 rounded-2xl flex flex-col items-center"><div className="text-3xl font-bold text-white mb-1">{finishScreen.summary.totalVolume.toLocaleString()}</div><div className="text-[10px] uppercase text-gray-500 font-bold">Volumen (Kg)</div></div>
        <div className="bg-[#0F0F11] border border-white/10 p-5 rounded-2xl flex flex-col items-center"><div className="text-3xl font-bold text-white mb-1">{finishScreen.summary.durationMinutes}m</div><div className="text-[10px] uppercase text-gray-500 font-bold">Duración</div></div>
      </div>
      <button onClick={() => setFinishScreen(null)} className="mt-12 bg-white text-black px-12 py-4 rounded-full font-bold hover:bg-gray-200 transition-colors uppercase tracking-widest text-xs">Continuar</button>
    </div>
  );

  return (
    <div className="space-y-8 pb-32">
      {plan.workouts.map(workout => {
        const isRescue = activeRescue === workout.id;
        const isVisible = expandedWorkouts[workout.id] !== undefined ? expandedWorkouts[workout.id] : true;
        return (
          <div key={workout.id}>
            <div className="flex items-center gap-4 mb-6 cursor-pointer" onClick={() => toggleWorkout(workout.id)}>
                <div className="h-px bg-white/10 flex-1"/>
                <span className="text-xs font-black text-red-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-2">
                    DÍA {workout.day} • {workout.name}
                    <ChevronRight size={14} className={`transform transition-transform ${isVisible ? 'rotate-90' : ''}`} />
                </span>
                <div className="h-px bg-white/10 flex-1"/>
            </div>
            
            {isVisible && (
              <>
                {workout.isClass && !isRescue ? (
                  <div className="bg-gradient-to-br from-[#1A1A1D] to-black border border-red-500/30 rounded-3xl p-8 text-center shadow-xl">
                    <MapPin size={40} className="mx-auto text-red-500 mb-4" />
                    <h3 className="text-2xl font-display font-black italic text-white mb-2 uppercase">{workout.classType || 'CLASE PRESENCIAL'}</h3>
                    <p className="text-gray-400 text-sm mb-8 leading-relaxed">Asistencia requerida en Kinetix Zone para coaching directo.</p>
                    {mode === 'athlete' ? (
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => handleClassAttendance(workout, true)} className="bg-green-600 text-black py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95">ASISTÍ</button>
                        <button onClick={() => handleClassAttendance(workout, false)} className="bg-white/5 text-gray-400 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95">NO PUDE IR</button>
                      </div>
                    ) : (
                        <div className="text-[10px] text-gray-500 font-bold uppercase border border-white/10 rounded-lg p-2">VISTA COACH: El atleta confirmará su asistencia</div>
                    )}
                  </div>
                ) : (
                  <>
                    {isRescue && (
                      <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl mb-6 flex items-start gap-3 animate-fade-in">
                        <ShieldAlert className="text-blue-400 shrink-0 mt-1" size={18} />
                        <div><h4 className="font-bold text-blue-400 text-sm uppercase">Protocolo de Rescate</h4><p className="text-[10px] text-gray-500 uppercase font-bold mt-1">No pares tu progreso. Completa esta rutina metabólica en casa.</p></div>
                      </div>
                    )}
                    {(isRescue ? RESCUE_WORKOUT : workout.exercises).map((ex, idx) => (
                      <ExerciseCard key={idx} exercise={ex} index={idx} workoutId={workout.id} userId={plan.userId} onShowVideo={setShowVideo} mode={mode} onSetComplete={handleSetComplete} history={DataEngine.getClientHistory(plan.userId)} />
                    ))}
                    {mode === 'athlete' && (
                      <button onClick={() => handleFinishWorkout(workout)} className="w-full bg-green-600 text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-2 mt-4 shadow-xl shadow-green-600/10 uppercase tracking-widest text-sm transition-all active:scale-95"><CheckCircle2 size={24} /> Finalizar Sesión</button>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        );
      })}

      {timer.active && (
        <div className="fixed bottom-24 right-4 bg-[#1A1A1D] border border-red-500/50 p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-4 animate-fade-in-up">
          <div className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center font-bold text-red-500 text-xs">{timer.seconds}s</div>
          <div className="flex-1"><p className="text-[10px] font-bold text-gray-500 uppercase">Descanso</p><p className="text-xs font-bold text-white">¡Prepárate!</p></div>
          <button onClick={() => setTimer({...timer, active: false})} className="text-gray-500 hover:text-white"><X size={16}/></button>
        </div>
      )}

      {showVideo && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowVideo(null)}>
          <div className="bg-[#111] w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/50"><h3 className="font-bold text-white text-sm uppercase">{showVideo}</h3><button onClick={() => setShowVideo(null)} className="text-gray-400 hover:text-white"><X size={20}/></button></div>
            <div className="aspect-video bg-black flex items-center justify-center relative">
               {embedSrc ? (
                 <iframe 
                    src={embedSrc} 
                    title={showVideo}
                    className="w-full h-full absolute inset-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowFullScreen 
                 />
               ) : (
                 <div className="text-center flex flex-col items-center">
                    <Play size={48} className="text-red-600 mb-4" />
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cargando Tutorial Kinetix...</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ManualPlanBuilder = ({ plan, onSave, onCancel }: { plan: Plan, onSave: (p: Plan) => void, onCancel: () => void }) => {
  const [editedPlan, setEditedPlan] = useState<Plan>(plan);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState<number>(0);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');
  const [activeDropSetTab, setActiveDropSetTab] = useState<number>(0); 
  
  // Modos de selector de ejercicio expandidos
  const [exerciseSelectorContext, setExerciseSelectorContext] = useState<{ mode: 'add' } | { mode: 'pair', exerciseIndex: number } | { mode: 'tabata-list', exerciseIndex: number } | { mode: 'emom-simple', exerciseIndex: number } | { mode: 'emom-odd', exerciseIndex: number } | { mode: 'emom-even', exerciseIndex: number } | { mode: 'emom-block', exerciseIndex: number, blockIndex: number }>({ mode: 'add' });
  const [configMethodIdx, setConfigMethodIdx] = useState<number | null>(null);

  const allExercises = useMemo(() => DataEngine.getExercises(), []);
  const categories = useMemo(() => ['Todos', ...Array.from(new Set(allExercises.map(e => e.muscleGroup)))], [allExercises]);

  const handleAddWorkout = () => {
    const newWorkout: Workout = { id: generateUUID(), name: `DÍA ${editedPlan.workouts.length + 1}`, day: editedPlan.workouts.length + 1, exercises: [] };
    setEditedPlan({...editedPlan, workouts: [...editedPlan.workouts, newWorkout]});
    setSelectedWorkoutIndex(editedPlan.workouts.length);
  };

  const openExerciseSelector = (context: any = { mode: 'add' }) => {
      setExerciseSelectorContext(context);
      setShowExerciseSelector(true);
  };

  const handleExerciseSelected = (exercise: Exercise) => {
    const updatedWorkouts = [...editedPlan.workouts];
    const currentWorkout = updatedWorkouts[selectedWorkoutIndex];
    
    if (exerciseSelectorContext.mode === 'add') {
        const newExercise: WorkoutExercise = { exerciseId: exercise.id, name: exercise.name, targetSets: 4, targetReps: '10-12', targetLoad: '', targetRest: 60, coachCue: '', method: 'standard' };
        currentWorkout.exercises.push(newExercise);
    } else if (exerciseSelectorContext.mode === 'pair') {
        const idx = exerciseSelectorContext.exerciseIndex;
        const currentExercise = currentWorkout.exercises[idx];
        currentWorkout.exercises[idx] = {
            ...currentExercise,
            pair: {
                exerciseId: exercise.id,
                name: exercise.name,
                targetReps: currentExercise.targetReps, 
                targetLoad: '',
                videoUrl: exercise.videoUrl 
            }
        };
    } else if (exerciseSelectorContext.mode === 'tabata-list') {
        const idx = exerciseSelectorContext.exerciseIndex;
        const currentExercise = currentWorkout.exercises[idx];
        const currentTabata = currentExercise.tabataConfig || { workTimeSec: 20, restTimeSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 60, structure: 'simple', exercises: [] };
        
        currentWorkout.exercises[idx] = {
            ...currentExercise,
            tabataConfig: {
                ...currentTabata,
                exercises: [...currentTabata.exercises, { id: exercise.id, name: exercise.name, videoUrl: exercise.videoUrl }]
            }
        };
        // Si es estructura 'simple', reemplazamos toda la lista por este único ejercicio
        if (currentTabata.structure === 'simple') {
             currentWorkout.exercises[idx].tabataConfig!.exercises = [{ id: exercise.id, name: exercise.name, videoUrl: exercise.videoUrl }];
        }
        setConfigMethodIdx(idx);

    } else if (exerciseSelectorContext.mode === 'emom-simple') {
        const idx = exerciseSelectorContext.exerciseIndex;
        const currentExercise = currentWorkout.exercises[idx];
        currentWorkout.exercises[idx] = {
            ...currentExercise,
            emomConfig: { ...currentExercise.emomConfig!, simpleConfig: { ...currentExercise.emomConfig?.simpleConfig, exercise: exercise.name } }
        };
        setConfigMethodIdx(idx); // Restaurar vista config
    } else if (exerciseSelectorContext.mode === 'emom-odd') {
        const idx = exerciseSelectorContext.exerciseIndex;
        const currentExercise = currentWorkout.exercises[idx];
        currentWorkout.exercises[idx] = {
            ...currentExercise,
            emomConfig: { ...currentExercise.emomConfig!, minuteOdd: { ...currentExercise.emomConfig?.minuteOdd, exercise: exercise.name } }
        };
        setConfigMethodIdx(idx);
    } else if (exerciseSelectorContext.mode === 'emom-even') {
        const idx = exerciseSelectorContext.exerciseIndex;
        const currentExercise = currentWorkout.exercises[idx];
        currentWorkout.exercises[idx] = {
            ...currentExercise,
            emomConfig: { ...currentExercise.emomConfig!, minuteEven: { ...currentExercise.emomConfig?.minuteEven, exercise: exercise.name } }
        };
        setConfigMethodIdx(idx);
    } else if (exerciseSelectorContext.mode === 'emom-block') {
        const idx = exerciseSelectorContext.exerciseIndex;
        const bIdx = exerciseSelectorContext.blockIndex;
        const currentExercise = currentWorkout.exercises[idx];
        const newBlocks = [...(currentExercise.emomConfig?.blocks || [])];
        if(newBlocks[bIdx]) {
             newBlocks[bIdx] = { ...newBlocks[bIdx], exercise: exercise.name };
             currentWorkout.exercises[idx] = {
                 ...currentExercise,
                 emomConfig: { ...currentExercise.emomConfig!, blocks: newBlocks }
             };
        }
        setConfigMethodIdx(idx);
    }

    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
    setShowExerciseSelector(false);
  };

  const toggleClassMode = (idx: number) => {
      const updated = [...editedPlan.workouts];
      updated[idx].isClass = !updated[idx].isClass;
      if (updated[idx].isClass) { updated[idx].exercises = []; updated[idx].classType = 'Hyrox / Funcional'; }
      setEditedPlan({...editedPlan, workouts: updated});
  };

  const updateExercise = (exerciseIndex: number, field: keyof WorkoutExercise, value: any) => {
    const updatedWorkouts = [...editedPlan.workouts];
    if (field === 'method') {
        // Inicializar config por defecto si cambia el método
        if (value === 'tabata' && !updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex].tabataConfig) {
            updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex].tabataConfig = {
                workTimeSec: 20, restTimeSec: 10, rounds: 8, sets: 1, restBetweenSetsSec: 60, structure: 'simple', 
                exercises: [{id: updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex].exerciseId, name: updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex].name}]
            };
        }
        if (value === 'emom' && !updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex].emomConfig) {
            updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex].emomConfig = {
                durationMin: 10, type: 'simple', simpleConfig: { exercise: updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex].name, reps: '10' }
            };
        }
    }
    updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex] = { ...updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex], [field]: value };
    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
  };

  const removeExercise = (exerciseIndex: number) => {
    const updatedWorkouts = [...editedPlan.workouts];
    updatedWorkouts[selectedWorkoutIndex].exercises.splice(exerciseIndex, 1);
    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
  };

  const filteredExercises = useMemo(() => {
    let filtered = allExercises;
    if (activeCategory !== 'Todos') filtered = filtered.filter(ex => ex.muscleGroup === activeCategory);
    if (searchQuery) filtered = filtered.filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered;
  }, [searchQuery, activeCategory, allExercises]);

  // VALIDACIONES BLOQUEANTES
  const isFormValid = useMemo(() => {
    if (configMethodIdx === null) return true;
    const ex = editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx];
    
    if (ex.method === 'tabata') {
        if (!ex.tabataConfig) return false;
        if (ex.tabataConfig.exercises.length === 0) return false;
        if (ex.tabataConfig.structure === 'alternado' && ex.tabataConfig.exercises.length < 2) return false;
        if (ex.tabataConfig.workTimeSec <= 0 || ex.tabataConfig.restTimeSec < 0) return false;
    }
    if (ex.method === 'emom') {
        if (!ex.emomConfig) return false;
        if (ex.emomConfig.type === 'simple' && !ex.emomConfig.simpleConfig?.exercise) return false;
        if (ex.emomConfig.type === 'alternado' && (!ex.emomConfig.minuteOdd?.exercise || !ex.emomConfig.minuteEven?.exercise)) return false;
        if (ex.emomConfig.type === 'complejo' && (!ex.emomConfig.blocks || ex.emomConfig.blocks.length === 0 || ex.emomConfig.blocks.some(b => !b.exercise || b.minutes.length === 0))) return false;
    }
    return true;
  }, [configMethodIdx, editedPlan, selectedWorkoutIndex]);

  return (
    <div className="bg-[#0A0A0C] min-h-screen fixed inset-0 z-50 overflow-y-auto pb-20 flex flex-col">
      <div className="sticky top-0 bg-[#0A0A0C]/95 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-3"><button onClick={onCancel}><X size={24} className="text-gray-400" /></button><input value={editedPlan.title} onChange={(e) => setEditedPlan({...editedPlan, title: e.target.value})} className="bg-transparent text-xl font-bold outline-none placeholder-gray-600 w-full" placeholder="Nombre del Protocolo" /></div>
        <button onClick={() => onSave(editedPlan)} className="bg-red-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all active:scale-95"><Save size={16} /> <span className="hidden sm:inline">GUARDAR</span></button>
      </div>
      <div className="p-4 max-w-4xl mx-auto w-full flex-1">
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-4">
          {editedPlan.workouts.map((w, idx) => (<button key={w.id} onClick={() => setSelectedWorkoutIndex(idx)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedWorkoutIndex === idx ? 'bg-white text-black' : 'bg-white/5 text-gray-400'}`}>DÍA {w.day}</button>))}
          <button onClick={handleAddWorkout} className="px-4 py-2 rounded-full bg-red-600/20 text-red-500 border border-red-500/50 flex items-center gap-1 text-sm font-bold"><Plus size={14} /> DÍA</button>
        </div>
        {editedPlan.workouts[selectedWorkoutIndex] ? (
          <div className="space-y-4 animate-fade-in">
             <div className="flex items-center gap-4 mb-4">
                 <input value={editedPlan.workouts[selectedWorkoutIndex].name} onChange={(e) => { const updated = [...editedPlan.workouts]; updated[selectedWorkoutIndex].name = e.target.value; setEditedPlan({...editedPlan, workouts: updated}); }} className="bg-transparent text-2xl font-bold uppercase text-red-500 outline-none w-full" placeholder="NOMBRE DEL DÍA" />
                 <button onClick={() => toggleClassMode(selectedWorkoutIndex)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2 ${editedPlan.workouts[selectedWorkoutIndex].isClass ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}><MapPin size={14} /> {editedPlan.workouts[selectedWorkoutIndex].isClass ? 'Es Clase Presencial' : 'Es Rutina Gym'}</button>
             </div>
             {editedPlan.workouts[selectedWorkoutIndex].isClass ? (
                 <div className="bg-[#111] border border-blue-500/30 p-6 rounded-2xl text-center">
                     <MapPin size={48} className="mx-auto text-blue-500 mb-4" /><h3 className="text-xl font-bold text-white mb-2">Configuración de Clase</h3><p className="text-sm text-gray-400 mb-4">El atleta deberá confirmar su asistencia.</p>
                     <input value={editedPlan.workouts[selectedWorkoutIndex].classType || ''} onChange={(e) => { const updated = [...editedPlan.workouts]; updated[selectedWorkoutIndex].classType = e.target.value; setEditedPlan({...editedPlan, workouts: updated}); }} placeholder="Nombre de la Clase (ej: Hyrox, Functional)" className="bg-black border border-white/20 rounded-xl p-3 w-full text-center text-white focus:border-blue-500 outline-none" />
                 </div>
             ) : (
                 <>
                     {editedPlan.workouts[selectedWorkoutIndex].exercises.map((ex, idx) => (
                       <div key={idx} className="bg-[#111] border border-white/10 rounded-xl p-4 relative group">
                          <div className="flex justify-between items-start mb-3"><span className="font-bold text-lg">{ex.name}</span><button onClick={() => removeExercise(idx)} className="text-gray-600 hover:text-red-500 transition-colors"><Trash2 size={18} /></button></div>
                          
                          {/* Selector de Método */}
                          <div className="mb-3">
                              <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Método de Entrenamiento</label>
                              <div className="flex gap-2">
                                <select 
                                    value={ex.method || 'standard'} 
                                    onChange={(e) => updateExercise(idx, 'method', e.target.value)}
                                    className="flex-1 bg-black border border-white/10 rounded-lg p-2 text-sm text-white font-bold outline-none focus:border-red-500"
                                >
                                    <option value="standard">Standard (Series Planas)</option>
                                    <option value="biserie">Bi-serie (Sin descanso)</option>
                                    <option value="ahap">AHAP (Subir peso cada set)</option>
                                    <option value="dropset">Drop Set (Fallo + Bajada)</option>
                                    <option value="tabata">TABATA (Intervalos)</option>
                                    <option value="emom">EMOM (Every Minute)</option>
                                </select>
                                {(ex.method === 'biserie' || ex.method === 'ahap' || ex.method === 'dropset' || ex.method === 'tabata' || ex.method === 'emom') && (
                                    <button onClick={() => setConfigMethodIdx(idx)} className="bg-white/10 px-3 rounded-lg text-white hover:bg-white/20 font-bold text-xs flex items-center gap-1 border border-white/10"><Edit3 size={14}/> Config</button>
                                )}
                              </div>
                              {/* Resumen de configuración activa */}
                              {ex.method === 'biserie' && ex.pair && <div className="mt-2 text-[10px] text-orange-400 font-bold bg-orange-900/10 p-2 rounded border border-orange-500/20">Linked: {ex.pair.name}</div>}
                              {ex.method === 'tabata' && ex.tabataConfig && <div className="mt-2 text-[10px] text-cyan-400 font-bold bg-cyan-900/10 p-2 rounded border border-cyan-500/20">{ex.tabataConfig.rounds} Rounds | {ex.tabataConfig.workTimeSec}/{ex.tabataConfig.restTimeSec}</div>}
                              {ex.method === 'emom' && ex.emomConfig && <div className="mt-2 text-[10px] text-yellow-400 font-bold bg-yellow-900/10 p-2 rounded border border-yellow-500/20">{ex.emomConfig.durationMin}' | {ex.emomConfig.type}</div>}
                          </div>

                          <div className="grid grid-cols-4 gap-3 mb-3">
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold">Series</label><input type="number" value={ex.targetSets} onChange={(e) => updateExercise(idx, 'targetSets', parseInt(e.target.value))} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center font-bold" disabled={ex.method==='tabata'} /></div>
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold">Reps</label><input type="text" value={ex.targetReps} onChange={(e) => updateExercise(idx, 'targetReps', e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center font-bold" /></div>
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold text-yellow-500">Carga (Kg)</label><input type="text" value={ex.targetLoad || ''} onChange={(e) => updateExercise(idx, 'targetLoad', e.target.value)} placeholder="Ej: 80" className="w-full bg-black border border-yellow-500/20 rounded-lg p-2 text-sm text-center font-bold text-yellow-400" /></div>
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold text-blue-500">Descanso(s)</label><input type="number" value={ex.targetRest || ''} onChange={(e) => updateExercise(idx, 'targetRest', parseInt(e.target.value))} className="w-full bg-black border border-blue-500/20 rounded-lg p-2 text-sm text-center font-bold text-blue-400" /></div>
                          </div>
                          <div><label className="text-[10px] text-gray-500 uppercase font-bold">Notas Técnicas</label><input type="text" value={ex.coachCue || ''} onChange={(e) => updateExercise(idx, 'coachCue', e.target.value)} placeholder="Instrucciones específicas..." className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-gray-300 outline-none focus:border-red-500" /></div>
                       </div>
                     ))}
                     <button onClick={() => openExerciseSelector({ mode: 'add' })} className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-gray-500 font-bold hover:border-red-500/50 hover:text-red-500 transition-colors flex items-center justify-center gap-2"><Plus size={20} /> AÑADIR EJERCICIO</button>
                 </>
             )}
          </div>
        ) : <div className="text-center text-gray-500 mt-10">Agrega un día de entrenamiento para comenzar.</div>}
      </div>

      {/* MODAL CONFIGURACIÓN MÉTODO (SAFE MODE) */}
      {configMethodIdx !== null && (
          <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-[#1A1A1D] w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl relative">
                  <h3 className="text-lg font-bold text-white mb-4 uppercase flex justify-between items-center">
                      Configurar {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].method}
                      <button onClick={() => setConfigMethodIdx(null)}><X size={20} className="text-gray-400"/></button>
                  </h3>
                  
                  {/* --- TABATA --- */}
                  {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].method === 'tabata' && editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig && (
                      <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                              <div><label className="text-[9px] uppercase font-bold text-cyan-500">Trabajo (seg)</label><input type="number" className="w-full bg-black border border-white/10 rounded-lg p-2 text-white" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.workTimeSec} onChange={(e) => updateExercise(configMethodIdx, 'tabataConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!, workTimeSec: parseInt(e.target.value)})} /></div>
                              <div><label className="text-[9px] uppercase font-bold text-gray-500">Descanso (seg)</label><input type="number" className="w-full bg-black border border-white/10 rounded-lg p-2 text-white" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.restTimeSec} onChange={(e) => updateExercise(configMethodIdx, 'tabataConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!, restTimeSec: parseInt(e.target.value)})} /></div>
                          </div>
                          {/* Validaciones Visuales Tabata */}
                          {(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.workTimeSec < 15 || editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.workTimeSec > 60) && <div className="text-[10px] text-yellow-500 flex items-center gap-1"><AlertTriangle size={10}/> Intervalo inusual</div>}
                          {(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.restTimeSec > editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.workTimeSec) && <div className="text-[10px] text-yellow-500 flex items-center gap-1"><AlertTriangle size={10}/> Descanso mayor que trabajo</div>}

                          <div className="grid grid-cols-2 gap-4">
                              <div><label className="text-[9px] uppercase font-bold text-gray-500">Rounds</label><input type="number" className="w-full bg-black border border-white/10 rounded-lg p-2 text-white" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.rounds} onChange={(e) => updateExercise(configMethodIdx, 'tabataConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!, rounds: parseInt(e.target.value)})} /></div>
                              <div><label className="text-[9px] uppercase font-bold text-gray-500">Sets (Bloques)</label><input type="number" className="w-full bg-black border border-white/10 rounded-lg p-2 text-white" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.sets} onChange={(e) => { const s = parseInt(e.target.value); updateExercise(configMethodIdx, 'tabataConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!, sets: s}); updateExercise(configMethodIdx, 'targetSets', s); }} /></div>
                          </div>
                           {(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.rounds > 12) && <div className="text-[10px] text-yellow-500 flex items-center gap-1"><AlertTriangle size={10}/> Rondas elevadas</div>}
                          
                          <div><label className="text-[9px] uppercase font-bold text-gray-500">Estructura</label><select className="w-full bg-black border border-white/10 rounded-lg p-2 text-white" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.structure} onChange={(e) => updateExercise(configMethodIdx, 'tabataConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!, structure: e.target.value})}><option value="simple">Simple (1 Ejercicio)</option><option value="alternado">Alternado (A/B/A/B...)</option><option value="lista">Lista (A/B/C...)</option></select></div>
                          
                          <div className="space-y-2 mt-4">
                              <label className="text-[9px] uppercase font-bold text-gray-500">Ejercicios del Tabata</label>
                              {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.exercises.map((ex, i) => (
                                  <div key={i} className="flex justify-between items-center bg-white/5 p-2 rounded">
                                      <span className="text-xs">{ex.name}</span>
                                      {/* En modo simple solo hay 1, se puede cambiar pero no borrar para dejar vacio */}
                                      {(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!.structure !== 'simple' || editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!.exercises.length > 1) && (
                                         <button onClick={() => {
                                             const newExs = [...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!.exercises];
                                             newExs.splice(i, 1);
                                             updateExercise(configMethodIdx, 'tabataConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig!, exercises: newExs});
                                         }}><Trash2 size={14} className="text-red-500"/></button>
                                      )}
                                  </div>
                              ))}
                              
                              {/* Botón de agregar depende de la estructura */}
                              {(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.structure === 'simple' && editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.exercises.length === 0) && (
                                   <button onClick={() => { setConfigMethodIdx(null); openExerciseSelector({ mode: 'tabata-list', exerciseIndex: configMethodIdx }); }} className="w-full py-2 border border-dashed border-white/20 rounded text-xs flex items-center justify-center gap-2"><Plus size={14}/> Seleccionar Ejercicio</button>
                              )}
                              {(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.structure !== 'simple') && (
                                  <button onClick={() => { setConfigMethodIdx(null); openExerciseSelector({ mode: 'tabata-list', exerciseIndex: configMethodIdx }); }} className="w-full py-2 border border-dashed border-white/20 rounded text-xs flex items-center justify-center gap-2"><Plus size={14}/> Agregar Ejercicio a Lista</button>
                              )}

                              {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.structure === 'alternado' && editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].tabataConfig.exercises.length < 2 && (
                                  <div className="text-[10px] text-red-500 flex items-center gap-1 mt-2 bg-red-500/10 p-2 rounded"><AlertCircle size={10}/> Se requieren mínimo 2 ejercicios para Alternado.</div>
                              )}
                          </div>
                      </div>
                  )}

                  {/* --- EMOM --- */}
                  {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].method === 'emom' && editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig && (
                      <div className="space-y-4">
                          <div><label className="text-[9px] uppercase font-bold text-yellow-500">Duración Total (min)</label><input type="number" className="w-full bg-black border border-white/10 rounded-lg p-2 text-white" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.durationMin} onChange={(e) => updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, durationMin: parseInt(e.target.value)})} /></div>
                          <div><label className="text-[9px] uppercase font-bold text-gray-500">Tipo de EMOM</label><select className="w-full bg-black border border-white/10 rounded-lg p-2 text-white" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.type} onChange={(e) => updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, type: e.target.value})}><option value="simple">Simple (Mismo cada min)</option><option value="alternado">Alternado (Impar/Par)</option><option value="complejo">Complejo (Bloques)</option></select></div>
                          
                          {/* Config Simple */}
                          {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.type === 'simple' && (
                              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                  <p className="text-xs font-bold mb-2">Configuración Minuto a Minuto</p>
                                  <button 
                                      onClick={() => { setConfigMethodIdx(null); openExerciseSelector({ mode: 'emom-simple', exerciseIndex: configMethodIdx }); }}
                                      className="w-full bg-black mb-2 p-2 rounded text-xs text-left text-white border border-white/10 flex justify-between items-center hover:bg-white/10"
                                  >
                                      <span>{editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.simpleConfig?.exercise || "Seleccionar Ejercicio"}</span>
                                      <Search size={14} className="text-gray-400"/>
                                  </button>
                                  <div className="flex gap-2">
                                      <input className="w-1/2 bg-black p-2 rounded text-xs text-white border border-white/10" placeholder="Reps (ej: 15)" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.simpleConfig?.reps || ''} onChange={(e) => updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, simpleConfig: {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!.simpleConfig, reps: e.target.value, durationSec: undefined}})} />
                                      <input type="number" className="w-1/2 bg-black p-2 rounded text-xs text-white border border-white/10" placeholder="Segundos (ej: 40)" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.simpleConfig?.durationSec || ''} onChange={(e) => updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, simpleConfig: {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!.simpleConfig, durationSec: parseInt(e.target.value), reps: undefined}})} />
                                  </div>
                                  {(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.simpleConfig?.durationSec && editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.simpleConfig.durationSec > 50) && <div className="text-[9px] text-yellow-500 mt-1 flex items-center gap-1"><AlertTriangle size={10}/> Poco descanso restante</div>}
                              </div>
                          )}

                          {/* Config Alternado */}
                          {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.type === 'alternado' && (
                              <div className="space-y-2">
                                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                      <p className="text-xs font-bold mb-2 text-blue-400">Minutos Impares (1, 3, 5...)</p>
                                      <button 
                                          onClick={() => { setConfigMethodIdx(null); openExerciseSelector({ mode: 'emom-odd', exerciseIndex: configMethodIdx }); }}
                                          className="w-full bg-black mb-2 p-2 rounded text-xs text-left text-white border border-white/10 flex justify-between items-center hover:bg-white/10"
                                      >
                                          <span>{editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.minuteOdd?.exercise || "Seleccionar Ejercicio A"}</span>
                                          <Search size={14} className="text-gray-400"/>
                                      </button>
                                      <div className="flex gap-2">
                                         <input className="w-1/2 bg-black p-2 rounded text-xs text-white" placeholder="Reps" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.minuteOdd?.reps || ''} onChange={(e) => updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, minuteOdd: { ...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.minuteOdd, reps: e.target.value, durationSec: undefined }})} />
                                         <input type="number" className="w-1/2 bg-black p-2 rounded text-xs text-white" placeholder="Segundos" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.minuteOdd?.durationSec || ''} onChange={(e) => updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, minuteOdd: { ...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.minuteOdd, durationSec: parseInt(e.target.value), reps: undefined }})} />
                                      </div>
                                  </div>
                                  <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                                      <p className="text-xs font-bold mb-2 text-green-400">Minutos Pares (2, 4, 6...)</p>
                                      <button 
                                          onClick={() => { setConfigMethodIdx(null); openExerciseSelector({ mode: 'emom-even', exerciseIndex: configMethodIdx }); }}
                                          className="w-full bg-black mb-2 p-2 rounded text-xs text-left text-white border border-white/10 flex justify-between items-center hover:bg-white/10"
                                      >
                                          <span>{editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.minuteEven?.exercise || "Seleccionar Ejercicio B"}</span>
                                          <Search size={14} className="text-gray-400"/>
                                      </button>
                                      <div className="flex gap-2">
                                         <input className="w-1/2 bg-black p-2 rounded text-xs text-white" placeholder="Reps" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.minuteEven?.reps || ''} onChange={(e) => updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, minuteEven: { ...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.minuteEven, reps: e.target.value, durationSec: undefined }})} />
                                         <input type="number" className="w-1/2 bg-black p-2 rounded text-xs text-white" placeholder="Segundos" value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.minuteEven?.durationSec || ''} onChange={(e) => updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, minuteEven: { ...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.minuteEven, durationSec: parseInt(e.target.value), reps: undefined }})} />
                                      </div>
                                  </div>
                              </div>
                          )}

                          {/* Config Complejo (Bloques) */}
                          {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.type === 'complejo' && (
                              <div className="space-y-4">
                                  <div className="flex justify-between items-center"><p className="text-xs text-gray-400">Define bloques de minutos.</p><button onClick={() => {
                                      const newBlocks = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.blocks || [])];
                                      newBlocks.push({ minutes: [], exercise: '', reps: '' });
                                      updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, blocks: newBlocks});
                                  }} className="text-[10px] bg-white/10 px-2 py-1 rounded hover:bg-white/20 flex items-center gap-1"><Plus size={10}/> Bloque</button></div>
                                  {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig.blocks?.map((block: any, bIdx: number) => (
                                      <div key={bIdx} className="bg-white/5 p-3 rounded-xl border border-white/5 relative">
                                          <button onClick={() => {
                                               const newBlocks = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.blocks || [])];
                                               newBlocks.splice(bIdx, 1);
                                               updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, blocks: newBlocks});
                                          }} className="absolute top-2 right-2 text-red-500 hover:text-white"><Trash2 size={14}/></button>
                                          <div className="mb-2">
                                              <label className="text-[9px] uppercase font-bold text-gray-500">Minutos (ej: 1,2,3)</label>
                                              <input className="w-full bg-black p-2 rounded text-xs text-white" value={block.minutes.join(',')} onChange={(e) => {
                                                  const newBlocks = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.blocks || [])];
                                                  newBlocks[bIdx] = { ...newBlocks[bIdx], minutes: e.target.value.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)) };
                                                  updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, blocks: newBlocks});
                                              }} />
                                          </div>
                                          <button 
                                              onClick={() => { setConfigMethodIdx(null); openExerciseSelector({ mode: 'emom-block', exerciseIndex: configMethodIdx, blockIndex: bIdx }); }}
                                              className="w-full bg-black mb-2 p-2 rounded text-xs text-left text-white border border-white/10 flex justify-between items-center hover:bg-white/10"
                                          >
                                              <span>{block.exercise || "Seleccionar Ejercicio"}</span>
                                              <Search size={14} className="text-gray-400"/>
                                          </button>
                                          <div className="flex gap-2">
                                              <input className="w-1/2 bg-black p-2 rounded text-xs text-white" placeholder="Reps" value={block.reps || ''} onChange={(e) => {
                                                  const newBlocks = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.blocks || [])];
                                                  newBlocks[bIdx] = { ...newBlocks[bIdx], reps: e.target.value, durationSec: undefined };
                                                  updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, blocks: newBlocks});
                                              }} />
                                              <input type="number" className="w-1/2 bg-black p-2 rounded text-xs text-white" placeholder="Segundos" value={block.durationSec || ''} onChange={(e) => {
                                                  const newBlocks = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig?.blocks || [])];
                                                  newBlocks[bIdx] = { ...newBlocks[bIdx], durationSec: parseInt(e.target.value), reps: undefined };
                                                  updateExercise(configMethodIdx, 'emomConfig', {...editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].emomConfig!, blocks: newBlocks});
                                              }} />
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          )}
                      </div>
                  )}

                  {/* --- BISERIE / AHAP / DROPSET (ORIGINALES) --- */}
                  {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].method === 'biserie' && (
                      <div className="space-y-4">
                          <p className="text-xs text-gray-400">Selecciona el segundo ejercicio del par. Se ejecutará inmediatamente después del primero.</p>
                          <button 
                            onClick={() => {
                                setConfigMethodIdx(null); 
                                openExerciseSelector({ mode: 'pair', exerciseIndex: configMethodIdx });
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-lg p-4 text-left flex justify-between items-center hover:bg-white/10 transition-colors"
                          >
                              <span className={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].pair?.name ? "text-white font-bold" : "text-gray-500"}>
                                  {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].pair?.name || "Seleccionar Ejercicio B"}
                              </span>
                              <Search size={16} className="text-gray-400"/>
                          </button>

                          {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].pair && (
                              <div className="grid grid-cols-2 gap-3">
                                  <div>
                                      <label className="text-[10px] text-gray-500 uppercase font-bold">Reps (Ej. B)</label>
                                      <input 
                                        className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white" 
                                        placeholder="Reps" 
                                        value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].pair?.targetReps || ''}
                                        onChange={(e) => {
                                            const currentEx = editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx];
                                            updateExercise(configMethodIdx, 'pair', { ...currentEx.pair, targetReps: e.target.value });
                                        }}
                                      />
                                  </div>
                                  <div>
                                      <label className="text-[10px] text-gray-500 uppercase font-bold">Carga (Ej. B)</label>
                                      <input 
                                        className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white" 
                                        placeholder="Kg (Opcional)" 
                                        value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].pair?.targetLoad || ''}
                                        onChange={(e) => {
                                            const currentEx = editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx];
                                            updateExercise(configMethodIdx, 'pair', { ...currentEx.pair, targetLoad: e.target.value });
                                        }}
                                      />
                                  </div>
                              </div>
                          )}
                      </div>
                  )}

                  {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].method === 'ahap' && (
                       <div className="space-y-4">
                           <p className="text-xs text-gray-400">Define los pesos para cada una de las {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].targetSets} series.</p>
                           <div className="grid grid-cols-2 gap-2">
                               {Array.from({length: editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].targetSets}).map((_, i) => (
                                   <div key={i}>
                                       <label className="text-[10px] uppercase font-bold text-gray-500">Serie {i+1}</label>
                                       <input 
                                          className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white text-center"
                                          placeholder="Kg"
                                          value={editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].targetWeights?.[i] || ''}
                                          onChange={(e) => {
                                              const currentWeights = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].targetWeights || [])];
                                              currentWeights[i] = e.target.value;
                                              updateExercise(configMethodIdx, 'targetWeights', currentWeights);
                                          }}
                                       />
                                   </div>
                               ))}
                           </div>
                       </div>
                  )}

                  {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].method === 'dropset' && (
                        <div className="space-y-4">
                            <p className="text-xs text-gray-400 mb-4">Agrega múltiples cargas (drops) dentro de una misma serie. Mínimo 2 drops.</p>
                            <div className="flex bg-black/50 p-1 rounded-lg mb-4 border border-white/10">
                                <button 
                                    onClick={() => updateExercise(configMethodIdx, 'dropsetPatternMode', 'FIXED')}
                                    className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${(!editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetPatternMode || editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetPatternMode === 'FIXED') ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Patrón Fijo
                                </button>
                                <button 
                                    onClick={() => updateExercise(configMethodIdx, 'dropsetPatternMode', 'PER_SERIES')}
                                    className={`flex-1 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetPatternMode === 'PER_SERIES' ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                >
                                    Por Serie
                                </button>
                            </div>
                            {editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetPatternMode === 'PER_SERIES' ? (
                                <div>
                                    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
                                        {Array.from({length: editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].targetSets}).map((_, idx) => (
                                            <button 
                                                key={idx}
                                                onClick={() => setActiveDropSetTab(idx)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all whitespace-nowrap ${activeDropSetTab === idx ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-500 border-white/5'}`}
                                            >
                                                Serie {idx + 1}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                        {((editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetSeriesPatterns?.[activeDropSetTab]) || []).map((drop, dropIdx) => (
                                            <div key={dropIdx} className="flex gap-2 items-end">
                                                <div className="flex-1"><label className="text-[9px] uppercase font-bold text-gray-500">Peso {dropIdx + 1}</label><input className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white text-center" placeholder="Kg" value={drop.weight} onChange={(e) => { const currentPatterns = { ...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetSeriesPatterns || {}) }; if (!currentPatterns[activeDropSetTab]) currentPatterns[activeDropSetTab] = []; currentPatterns[activeDropSetTab][dropIdx] = { ...currentPatterns[activeDropSetTab][dropIdx], weight: e.target.value }; updateExercise(configMethodIdx, 'dropsetSeriesPatterns', currentPatterns); }} /></div>
                                                <div className="flex-1"><label className="text-[9px] uppercase font-bold text-gray-500">Reps</label><input className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white text-center" placeholder="Reps" value={drop.reps} onChange={(e) => { const currentPatterns = { ...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetSeriesPatterns || {}) }; if (!currentPatterns[activeDropSetTab]) currentPatterns[activeDropSetTab] = []; currentPatterns[activeDropSetTab][dropIdx] = { ...currentPatterns[activeDropSetTab][dropIdx], reps: e.target.value }; updateExercise(configMethodIdx, 'dropsetSeriesPatterns', currentPatterns); }} /></div>
                                                <button onClick={() => { const currentPatterns = { ...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetSeriesPatterns || {}) }; currentPatterns[activeDropSetTab].splice(dropIdx, 1); updateExercise(configMethodIdx, 'dropsetSeriesPatterns', currentPatterns); }} className="p-2.5 bg-red-900/20 text-red-500 rounded-lg hover:bg-red-900/40 mb-[1px]"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => { const currentPatterns = { ...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].dropsetSeriesPatterns || {}) }; if (!currentPatterns[activeDropSetTab]) currentPatterns[activeDropSetTab] = []; currentPatterns[activeDropSetTab].push({ weight: '', reps: '' }); updateExercise(configMethodIdx, 'dropsetSeriesPatterns', currentPatterns); }} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:border-white/40 flex items-center justify-center gap-2 mt-2"><Plus size={14}/> Agregar Drop</button>
                                </div>
                            ) : (
                                <>
                                    <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                                        {(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].drops || []).map((drop, idx) => (
                                            <div key={idx} className="flex gap-2 items-end">
                                                <div className="flex-1"><label className="text-[9px] uppercase font-bold text-gray-500">Peso {idx + 1}</label><input className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white text-center" placeholder="Kg" value={drop.weight} onChange={(e) => { const newDrops = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].drops || [])]; newDrops[idx] = { ...newDrops[idx], weight: e.target.value }; updateExercise(configMethodIdx, 'drops', newDrops); }} /></div>
                                                <div className="flex-1"><label className="text-[9px] uppercase font-bold text-gray-500">Reps</label><input className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white text-center" placeholder="Reps" value={drop.reps} onChange={(e) => { const newDrops = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].drops || [])]; newDrops[idx] = { ...newDrops[idx], reps: e.target.value }; updateExercise(configMethodIdx, 'drops', newDrops); }} /></div>
                                                <button onClick={() => { const newDrops = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].drops || [])]; newDrops.splice(idx, 1); updateExercise(configMethodIdx, 'drops', newDrops); }} className="p-2.5 bg-red-900/20 text-red-500 rounded-lg hover:bg-red-900/40 mb-[1px]"><Trash2 size={16}/></button>
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => { const newDrops = [...(editedPlan.workouts[selectedWorkoutIndex].exercises[configMethodIdx].drops || [])]; newDrops.push({ weight: '', reps: '' }); updateExercise(configMethodIdx, 'drops', newDrops); }} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-xs font-bold text-gray-400 hover:text-white hover:border-white/40 flex items-center justify-center gap-2"><Plus size={14}/> Agregar Drop</button>
                                </>
                            )}
                        </div>
                  )}

                  <div className="flex gap-3 mt-6">
                      <button 
                        onClick={() => isFormValid && setConfigMethodIdx(null)} 
                        disabled={!isFormValid}
                        className={`flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all ${isFormValid ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/30' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
                      >
                          {isFormValid ? 'Confirmar Configuración' : 'Faltan datos requeridos'}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {showExerciseSelector && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col animate-fade-in">
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#0A0A0C]"><button onClick={() => setShowExerciseSelector(false)}><ChevronLeft size={24} /></button><div className="flex-1 bg-white/10 rounded-lg flex items-center px-3 py-2"><Search size={18} className="text-gray-400" /><input autoFocus className="bg-transparent border-none outline-none text-sm ml-2 w-full text-white" placeholder="Buscar ejercicio..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
          <div className="flex gap-2 overflow-x-auto p-2 border-b border-white/5 no-scrollbar bg-[#0A0A0C]">{categories.map(cat => (<button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400'}`}>{cat}</button>))}</div>
          <div className="flex-1 overflow-y-auto p-4 grid gap-2 pb-20">
            {filteredExercises.map(ex => (<button key={ex.id} onClick={() => handleExerciseSelected(ex)} className="bg-[#111] border border-white/5 p-4 rounded-xl text-left hover:border-red-500 transition-colors flex justify-between items-center"><div><div className="font-bold text-sm">{ex.name}</div><div className="text-[10px] text-gray-500 uppercase bg-white/5 inline-block px-1.5 rounded mt-1">{ex.muscleGroup}</div></div><Plus size={18} className="text-gray-600" /></button>))}
          </div>
        </div>
      )}
    </div>
  );
}

const RoutinesView = ({ onAssign }: { onAssign: (p: Plan) => void }) => {
    const [templates, setTemplates] = useState<Plan[]>(DataEngine.getTemplates());
    const [showBuilder, setShowBuilder] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<Plan | null>(null);

    const handleSave = (p: Plan) => {
        DataEngine.saveTemplate(p);
        setTemplates(DataEngine.getTemplates());
        setShowBuilder(false);
        setEditingTemplate(null);
    };

    const handleDelete = (id: string) => {
        if(confirm("¿Archivar esta plantilla?")) {
            DataEngine.deleteTemplate(id);
            setTemplates(DataEngine.getTemplates());
        }
    };

    const handleDuplicate = (p: Plan) => {
        const copy = { ...p, id: generateUUID(), title: `${p.title} (Copia)`, updatedAt: new Date().toISOString() };
        DataEngine.saveTemplate(copy);
        setTemplates(DataEngine.getTemplates());
    };

    if (showBuilder && editingTemplate) {
        return <ManualPlanBuilder plan={editingTemplate} onSave={handleSave} onCancel={() => { setShowBuilder(false); setEditingTemplate(null); }} />;
    }

    return (
        <div className="pb-32 animate-fade-in">
             <div className="flex justify-between items-center mb-6">
                 <h3 className="text-xl font-display font-black italic text-white uppercase">Rutinas Maestras</h3>
                 <button onClick={() => {
                     const newTpl: Plan = { id: generateUUID(), title: 'Nueva Rutina', userId: ADMIN_UUID, workouts: [], updatedAt: new Date().toISOString() };
                     setEditingTemplate(newTpl);
                     setShowBuilder(true);
                 }} className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-gray-200"><Plus size={14}/> Nueva Rutina</button>
             </div>
             
             <div className="grid grid-cols-1 gap-4">
                 {templates.length === 0 ? (
                     <div className="text-center py-10 text-gray-500 border-2 border-dashed border-white/5 rounded-2xl">
                         <p className="text-xs font-bold uppercase tracking-widest mb-2">No hay plantillas creadas</p>
                         <p className="text-[10px]">Crea rutinas base para asignarlas rápidamente.</p>
                     </div>
                 ) : templates.map(t => (
                     <div key={t.id} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl hover:border-white/20 transition-all group relative">
                         <div className="flex justify-between items-start mb-2">
                             <div>
                                 <h4 className="font-bold text-white uppercase text-sm">{t.title}</h4>
                                 <p className="text-[10px] text-gray-500 uppercase font-bold mt-1">v1.0 • {t.workouts.length} Días • Actualizado: {formatDate(t.updatedAt)}</p>
                             </div>
                             <div className="flex gap-2">
                                 <button onClick={() => { setEditingTemplate(t); setShowBuilder(true); }} className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"><Edit3 size={14}/></button>
                                 <button onClick={() => handleDuplicate(t)} className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"><Copy size={14}/></button>
                                 <button onClick={() => handleDelete(t.id)} className="p-2 bg-red-900/10 rounded-lg text-red-500 hover:bg-red-900/30 transition-colors"><Archive size={14}/></button>
                             </div>
                         </div>
                         <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar mt-2">
                             {t.workouts.map(w => (
                                 <span key={w.id} className="text-[9px] bg-white/5 px-2 py-1 rounded text-gray-400 whitespace-nowrap border border-white/5">{w.name}</span>
                             ))}
                         </div>
                         <button onClick={() => onAssign(t)} className="w-full mt-3 py-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2">Asignar a Atleta <ArrowRight size={12}/></button>
                     </div>
                 ))}
             </div>
        </div>
    );
};

const WorkoutsView = ({ user }: { user: User }) => {
    const [exercises, setExercises] = useState<Exercise[]>(DataEngine.getExercises());
    const [filter, setFilter] = useState('');
    const [showVideo, setShowVideo] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [activeTab, setActiveTab] = useState<'exercises' | 'routines'>('exercises');
    
    // Asignación de rutinas
    const [assigningTemplate, setAssigningTemplate] = useState<Plan | null>(null);
    const [targetClient, setTargetClient] = useState<string>('');
    const clients = useMemo(() => DataEngine.getUsers().filter(u => u.role === 'client'), []);

    const filtered = exercises.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()) || e.muscleGroup.toLowerCase().includes(filter.toLowerCase()));
    
    const handleAddExercise = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const newEx: Exercise = { id: generateUUID(), name: formData.get('name') as string, muscleGroup: formData.get('muscle') as string, videoUrl: formData.get('video') as string, technique: '', commonErrors: [] };
        DataEngine.addExercise(newEx);
        setExercises(DataEngine.getExercises());
        setShowAddModal(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex items-center justify-between">
                 <h2 className="text-3xl font-display font-black italic text-white uppercase">BIBLIOTECA</h2>
             </div>
             
             {(user.role === 'coach' || user.role === 'admin') && (
                 <div className="flex gap-4 border-b border-white/5">
                     <button onClick={() => setActiveTab('exercises')} className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'exercises' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500'}`}>Ejercicios</button>
                     <button onClick={() => setActiveTab('routines')} className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === 'routines' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500'}`}>Rutinas (Plantillas)</button>
                 </div>
             )}

             {activeTab === 'exercises' && (
                 <>
                     <div className="flex justify-between items-center">
                         <div className="relative w-full"><Search className="absolute left-4 top-3.5 text-gray-500" size={18} /><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar ejercicio o músculo..." className="w-full bg-[#0F0F11] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-white/20 outline-none" /></div>
                         {(user.role === 'coach' || user.role === 'admin') && <button onClick={() => setShowAddModal(true)} className="ml-3 text-xs font-bold bg-white text-black px-4 py-3 rounded-xl flex items-center gap-2 hover:bg-gray-200 shrink-0"><Plus size={16}/> Nuevo</button>}
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-32">{filtered.map(ex => (<div key={ex.id} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl flex justify-between items-center group hover:border-white/20 transition-colors"><div><h4 className="font-bold text-white uppercase text-sm">{ex.name}</h4><span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block uppercase font-bold">{ex.muscleGroup}</span></div><button onClick={() => setShowVideo(ex.name)} className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-red-500 transition-colors"><Play size={16} /></button></div>))}</div>
                 </>
             )}

             {activeTab === 'routines' && (user.role === 'coach' || user.role === 'admin') && (
                 <RoutinesView onAssign={setAssigningTemplate} />
             )}
             
             {showVideo && (<div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowVideo(null)}><div className="bg-[#111] w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}><div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#151518]"><h3 className="font-bold text-white flex items-center gap-2"><Youtube size={18} className="text-red-500"/> {showVideo}</h3><button onClick={() => setShowVideo(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20} className="text-gray-400 hover:text-white" /></button></div><div className="aspect-video bg-black flex items-center justify-center relative group"><a href={exercises.find(e => e.name === showVideo)?.videoUrl || '#'} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-3 text-white group-hover:scale-110 transition-transform"><div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40"><Play size={32} fill="white" className="ml-1" /></div><span className="text-xs font-bold tracking-widest uppercase">Ver Tutorial</span></a></div></div></div>)}
             
             {showAddModal && (
                <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
                    <div className="bg-[#1A1A1D] w-full max-w-md rounded-2xl p-6 border border-white/10" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4">Agregar Ejercicio</h3>
                        <form onSubmit={handleAddExercise} className="space-y-4">
                            <input name="name" required placeholder="Nombre del Ejercicio" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" />
                            <select name="muscle" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none"><option value="Pecho">Pecho</option><option value="Espalda">Espalda</option><option value="Pierna">Pierna</option><option value="Hombro">Hombro</option><option value="Brazo">Brazo</option><option value="Funcional">Funcional</option></select>
                            <input name="video" placeholder="URL Video (YouTube)" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" />
                            <div className="flex gap-3 pt-4"><button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold text-sm text-gray-400 hover:text-white">Cancelar</button><button type="submit" className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-sm text-white hover:bg-red-500">Guardar</button></div>
                        </form>
                    </div>
                </div>
            )}

            {assigningTemplate && (
                <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setAssigningTemplate(null)}>
                    <div className="bg-[#1A1A1D] w-full max-w-md rounded-2xl p-6 border border-white/10 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white mb-4">Asignar Rutina: {assigningTemplate.title}</h3>
                        <label className="text-[10px] text-gray-500 uppercase font-bold mb-2 block">Seleccionar Atleta</label>
                        <select 
                            className="w-full bg-black border border-white/10 rounded-xl p-3 text-sm text-white mb-6 outline-none focus:border-blue-500"
                            value={targetClient}
                            onChange={(e) => setTargetClient(e.target.value)}
                        >
                            <option value="">-- Seleccionar --</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <div className="flex gap-3">
                            <button onClick={() => setAssigningTemplate(null)} className="flex-1 py-3 bg-white/5 rounded-xl font-bold text-sm text-gray-400 hover:text-white">Cancelar</button>
                            {/* Renderización condicional del Modal de Programación:
                                Al seleccionar un atleta, la lógica cambia para renderizar el Modal encima en lugar del botón Confirmar directo
                                si se desea un flujo de dos pasos. Sin embargo, para mantener UX simple, mostraremos el modal
                                DESPUES de que el usuario haya seleccionado el cliente, dentro de este mismo bloque.
                            */}
                        </div>
                    </div>
                    {targetClient && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
                             <AssignRoutineModal 
                                athlete={clients.find(c => c.id === targetClient)!}
                                coach={user}
                                template={assigningTemplate}
                                onClose={() => { setAssigningTemplate(null); setTargetClient(''); }}
                                onSuccess={() => {
                                    // GUARDADO DE SEGURIDAD DEL PLAN EN EL PERFIL DEL ATLETA
                                    const newPlan: Plan = { 
                                        ...assigningTemplate, 
                                        id: generateUUID(), 
                                        userId: targetClient, 
                                        updatedAt: new Date().toISOString() 
                                    };
                                    DataEngine.savePlan(newPlan);
                                }}
                             />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
  const [client, setClient] = useState<User | undefined>(DataEngine.getUserById(clientId));
  const [plan, setPlan] = useState<Plan | null>(DataEngine.getPlan(clientId));
  const [history, setHistory] = useState<any[]>(DataEngine.getClientHistory(clientId));
  const [isGenerating, setIsGenerating] = useState(false);
  const [showManualBuilder, setShowManualBuilder] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'plan' | 'history'>('plan');
  
  // States para modal de asignación (reprogramación)
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalMode, setScheduleModalMode] = useState<'create' | 'edit'>('create');

  if (!client) return <div className="p-8 text-center text-gray-500">Atleta no encontrado.</div>;

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const generatedPlan = await generateSmartRoutine(client, history);
      const newPlan: Plan = { id: generateUUID(), title: generatedPlan.title || "Plan IA", userId: client.id, workouts: generatedPlan.workouts || [], updatedAt: new Date().toISOString() };
      DataEngine.savePlan(newPlan);
      setPlan(newPlan);
    } catch (e: any) { alert(e.message); } finally { setIsGenerating(false); }
  };

  const handleDeleteClient = () => { if (confirm("¿Eliminar este atleta permanentemente?")) { DataEngine.deleteUser(clientId); onBack(); } };
  const handleSavePlan = (updatedPlan: Plan) => { DataEngine.savePlan(updatedPlan); setPlan(updatedPlan); setShowManualBuilder(false); };

  if (showManualBuilder && plan) { return <ManualPlanBuilder plan={plan} onSave={handleSavePlan} onCancel={() => setShowManualBuilder(false)} />; }

  return (
    <div className="space-y-6 animate-fade-in pb-32">
       <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2"><ChevronLeft size={20} /> <span className="font-bold text-xs uppercase">Volver</span></button>
       <div className="bg-[#0F0F11] p-6 rounded-3xl border border-white/5 relative overflow-hidden shadow-2xl">
          <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
            <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center text-3xl font-bold text-gray-500 shadow-xl">{client.name[0]}</div>
                <div><h1 className="text-3xl font-display font-black italic text-white uppercase tracking-tighter">{client.name}</h1><div className="flex flex-wrap gap-3 mt-2"><span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20 uppercase">{client.goal}</span><span className="text-[10px] font-bold text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/5 uppercase">{client.level}</span></div></div>
            </div>
            <button onClick={handleDeleteClient} className="text-[10px] font-bold text-red-500 hover:text-red-400 border border-red-900/30 px-3 py-1.5 rounded-lg bg-red-900/10 transition-colors flex items-center gap-1 uppercase tracking-widest"><Trash2 size={12}/> Eliminar</button>
          </div>
       </div>
       <div className="flex border-b border-white/5 gap-6 mb-8"><button onClick={() => setActiveSubTab('plan')} className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeSubTab === 'plan' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500'}`}>Protocolo Activo</button><button onClick={() => setActiveSubTab('history')} className={`pb-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeSubTab === 'history' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500'}`}>Historial ({history.length})</button></div>
       {activeSubTab === 'plan' && (
           plan ? (
             <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center px-2 mb-4"><h3 className="text-lg font-bold flex items-center gap-2 text-white uppercase italic font-display">Plan Asignado</h3><div className="flex gap-2"><button onClick={() => setShowManualBuilder(true)} className="text-[10px] font-bold bg-white/10 text-white border border-white/20 px-4 py-2 rounded-full hover:bg-white/20 flex items-center gap-2 uppercase tracking-widest"><Edit3 size={12}/> Editar</button><button onClick={handleGenerateAI} disabled={isGenerating} className="text-[10px] font-bold bg-blue-600/10 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-full hover:bg-blue-600/20 flex items-center gap-2 uppercase tracking-widest">{isGenerating ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />} IA</button></div></div>
                
                {/* --- NUEVO: PANEL DE VERIFICACIÓN DE AGENDA --- */}
                <ScheduleVerificationPanel 
                  athleteId={client.id}
                  currentPlan={plan}
                  onEditSchedule={() => {
                    setScheduleModalMode('edit');
                    setShowScheduleModal(true);
                  }}
                />

                <PlanViewer plan={plan} mode="coach" />
             </div>
           ) : (
             <div className="py-24 text-center text-gray-500 flex flex-col items-center border-2 border-dashed border-white/5 rounded-3xl"><p className="mb-6 font-bold uppercase tracking-widest text-[10px]">Sin plan activo para este atleta.</p><div className="flex gap-3"><button onClick={() => { const newP = { id: generateUUID(), title: 'Nuevo Plan', userId: client.id, workouts: [], updatedAt: new Date().toISOString() }; setPlan(newP); setShowManualBuilder(true); }} className="text-[10px] font-bold bg-white text-black px-6 py-3 rounded-xl hover:bg-gray-200 uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"><Plus size={16}/> CREAR MANUAL</button><button onClick={handleGenerateAI} disabled={isGenerating} className="text-[10px] font-bold bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-500 uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95">{isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />} GENERAR IA</button></div></div>
           )
       )}
       {activeSubTab === 'history' && (
           <div className="space-y-4 animate-fade-in pb-32">
               {history.length === 0 ? <div className="text-center py-20 text-gray-500 uppercase font-bold text-[10px] tracking-widest">No hay sesiones registradas.</div> : history.map((s, i) => (
                   <div key={i} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl shadow-lg">
                       <div className="flex justify-between items-center mb-2"><div><div className="font-bold text-white uppercase text-sm">{s.workoutName}</div><div className="text-[10px] text-gray-500 font-bold uppercase">{formatDate(s.date)}</div></div><div className="text-right"><div className="font-bold text-white uppercase text-xs">{(s.summary.totalVolume/1000).toFixed(1)}k <span className="text-[10px] text-gray-500 font-bold">VOL</span></div><div className="text-[10px] text-gray-500 font-bold uppercase">{s.summary.durationMinutes}m</div></div></div>
                       <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-2"><div className="text-[9px] text-gray-500 font-bold uppercase">Ejercicios: <span className="text-white">{s.summary.exercisesCompleted}</span></div><div className="text-[9px] text-gray-500 font-bold uppercase text-right">Racha: <span className="text-white">Active</span></div></div>
                   </div>
               ))}
           </div>
       )}

       {showScheduleModal && plan && (
         <AssignRoutineModal 
            athlete={client}
            coach={{ id: plan.userId }} // Usamos el ID del plan (coach creador) o el current user si estuviera disponible
            template={plan}
            initialMode={scheduleModalMode}
            onClose={() => setShowScheduleModal(false)}
         />
       )}
    </div>
  );
};

const DashboardView = ({ user, onNavigate }: { user: User, onNavigate: (view: string) => void }) => {
    if (user.role === 'client') {
        const plan = DataEngine.getPlan(user.id);
        return (
            <div className="space-y-6">
                <div className="mb-6"><h1 className="text-3xl font-display font-black italic uppercase">Hola, {user.name.split(' ')[0]}</h1><p className="text-gray-400 text-xs mt-1">Sigue tu progreso hoy.</p></div>
                {plan ? <PlanViewer plan={plan} mode="athlete" /> : <div className="text-center py-20 text-gray-500 border-2 border-dashed border-white/5 rounded-3xl">No tienes plan asignado. Contacta a tu coach.</div>}
            </div>
        );
    }
    const clients = DataEngine.getUsers().filter(u => u.role === 'client');
    return (
        <div className="space-y-8 animate-fade-in pb-20">
            <div className="flex justify-between items-center"><div><h2 className="text-4xl font-display font-black italic text-white uppercase tracking-tighter">COMMAND CENTER</h2><p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Gestión de Alto Rendimiento</p></div></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><StatCard label="Atletas" value={clients.length} icon={<Users className="text-blue-500" size={16} />} /><StatCard label="Status" value="OK" icon={<Shield className="text-green-500" size={16} />} /></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button onClick={() => onNavigate('clients')} className="p-6 bg-[#0F0F11] border border-white/5 rounded-2xl hover:border-red-500/30 transition-all text-left"><div className="bg-red-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-red-500 mb-4"><Users size={24}/></div><h3 className="font-bold text-white text-lg">Atletas</h3><p className="text-xs text-gray-500">Gestionar perfiles y rutinas.</p></button>
                <button onClick={() => onNavigate('workouts')} className="p-6 bg-[#0F0F11] border border-white/5 rounded-2xl hover:border-blue-500/30 transition-all text-left"><div className="bg-blue-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-blue-500 mb-4"><Dumbbell size={24}/></div><h3 className="font-bold text-white text-lg">Biblioteca</h3><p className="text-xs text-gray-500">Ejercicios y Plantillas.</p></button>
            </div>
        </div>
    );
};

const ClientsView = ({ onSelect, user }: { onSelect: (id: string) => void, user: User }) => {
    const [users, setUsers] = useState<User[]>(DataEngine.getUsers().filter(u => u.role === 'client'));
    const [search, setSearch] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);
    useEffect(() => { setUsers(DataEngine.getUsers().filter(u => u.role === 'client')); }, [showInviteModal]);
    const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));
    return (
        <div className="space-y-6 animate-fade-in pb-20">
             <div className="flex justify-between items-center"><h2 className="text-3xl font-display font-black italic text-white uppercase">ATLETAS</h2>{(user.role === 'coach' || user.role === 'admin') && (<button onClick={() => setShowInviteModal(true)} className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-gray-200 transition-colors"><UserPlus size={16} /> Alta</button>)}</div>
             <div className="relative"><Search className="absolute left-3 top-2.5 text-gray-500" size={16} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar atleta..." className="bg-[#0F0F11] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-red-500 outline-none w-full md:w-64" /></div>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-32">
                 {filtered.map(client => {
                     const plan = DataEngine.getPlan(client.id);
                     return (
                         <div key={client.id} onClick={() => onSelect(client.id)} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl hover:border-red-500/50 cursor-pointer transition-all group relative overflow-hidden shadow-xl">
                             <div className="flex items-center gap-4 relative z-10">
                                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center font-bold text-white shadow-lg border border-white/5 group-hover:scale-110 transition-transform">{client.name[0]}</div>
                                 <div><h4 className="font-bold text-white group-hover:text-red-500 transition-colors uppercase text-sm">{client.name}</h4><p className="text-xs text-gray-500">{client.email}</p><div className="flex gap-2 mt-2"><span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-gray-400 border border-white/5 uppercase font-bold">{client.goal}</span>{plan && <span className="text-[9px] bg-green-900/20 text-green-500 px-2 py-0.5 rounded border border-green-500/20 flex items-center gap-1 font-bold uppercase"><CheckCircle2 size={10}/> Plan</span>}</div></div>
                             </div>
                         </div>
                     );
                 })}
                 {filtered.length === 0 && (<div className="col-span-full text-center py-10 text-gray-500">No se encontraron atletas.</div>)}
             </div>
             {showInviteModal && (<UserInviteModal currentUser={user} onClose={() => setShowInviteModal(false)} onInviteSuccess={() => setUsers(DataEngine.getUsers().filter(u => u.role === 'client'))} />)}
        </div>
    );
};

const ProfileView = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
    const history = DataEngine.getClientHistory(user.id);
    const [analyzing, setAnalyzing] = useState(false);
    const chartData = history.slice(0, 10).reverse().map(h => ({ date: new Date(h.date).toLocaleDateString('es-ES', {day: 'numeric', month: 'short'}), vol: h.summary.totalVolume }));
    const handleAnalyze = async () => { setAnalyzing(true); try { const advice = await analyzeProgress(user, history); alert(advice); } catch(e) { alert("No se pudo analizar el progreso."); } finally { setAnalyzing(false); } }
    return (
        <div className="space-y-10 animate-fade-in pb-32">
            <div className="flex items-center gap-6"><div className="w-24 h-24 rounded-[2rem] bg-red-600 flex items-center justify-center text-4xl font-black italic font-display text-white shadow-2xl shadow-red-900/40">{user.name[0]}</div><div><h2 className="text-3xl font-display font-black italic text-white uppercase tracking-tighter">{user.name}</h2><p className="text-gray-400 font-bold uppercase text-xs">{user.email}</p><span className="inline-block mt-3 px-3 py-1 bg-red-500/10 rounded-lg text-[9px] font-bold text-red-500 uppercase border border-red-500/20">{user.role}</span></div></div>
            {user.role === 'client' && (
                <div className="space-y-6">
                    <button onClick={handleAnalyze} disabled={analyzing} className="w-full py-5 bg-gradient-to-r from-blue-900 to-blue-800 border border-blue-500/30 rounded-2xl flex items-center justify-center gap-3 shadow-lg relative overflow-hidden group transition-all active:scale-95">{analyzing ? <Loader2 className="animate-spin text-blue-200" /> : <BrainCircuit size={24} className="text-blue-300" />}<span className="font-bold text-blue-100 z-10 uppercase tracking-widest text-xs">Analizar mi Progreso (IA)</span></button>
                    <div className="bg-[#0F0F11] border border-white/5 rounded-[2rem] p-6 shadow-xl"><h3 className="font-bold text-white mb-6 flex items-center gap-2 uppercase text-xs tracking-widest"><TrendingUp size={16} className="text-green-500"/> Proyección de Carga</h3><div className="h-48 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><defs><linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#ef4444" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="#1F1F1F" vertical={false} /><XAxis dataKey="date" tick={{fontSize: 9, fill: '#666', fontWeight: 'bold'}} axisLine={false} tickLine={false} /><Tooltip contentStyle={{backgroundColor: '#0F0F11', border: '1px solid #1F1F1F', borderRadius: '12px'}} /><Area type="monotone" dataKey="vol" stroke="#ef4444" fillOpacity={1} fill="url(#colorVol)" strokeWidth={3} /></AreaChart></ResponsiveContainer></div></div>
                </div>
            )}
            <div className="bg-[#0F0F11] border border-white/5 rounded-[2rem] p-6 space-y-4 shadow-xl"><div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Meta de Atleta</span><span className="text-white font-bold text-xs uppercase">{user.goal}</span></div><div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Nivel Actual</span><span className="text-white font-bold text-xs uppercase">{user.level}</span></div><div className="flex justify-between items-center py-2"><span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Días / Semana</span><span className="text-white font-bold text-xs uppercase">{user.daysPerWeek}</span></div></div>
            <button onClick={onLogout} className="w-full py-5 bg-white/5 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors uppercase tracking-widest text-xs"><LogOut size={20}/> Cerrar Sesión</button>
        </div>
    );
};

const AdminView = () => {
  const [config, setConfig] = useState(DataEngine.getConfig());
  const [activeTab, setActiveTab] = useState<'branding' | 'users'>('branding');
  const [users, setUsers] = useState<User[]>(DataEngine.getUsers());
  const [showInviteModal, setShowInviteModal] = useState(false);
  const adminUserMock: User = { ...MOCK_USER, role: 'admin' as UserRole, id: ADMIN_UUID };
  const handleSaveConfig = () => { DataEngine.saveConfig(config); alert("Configuración guardada."); }
  const toggleUserStatus = (u: User) => { const updated = { ...u, isActive: !u.isActive }; DataEngine.saveUser(updated); setUsers(DataEngine.getUsers()); }
  return (
      <div className="space-y-8 animate-fade-in pb-20">
          <div className="flex justify-between items-center mb-6"><h2 className="text-3xl font-display font-black italic text-white uppercase tracking-tighter">COMMAND CENTER</h2><div className="flex gap-2 bg-white/5 p-1 rounded-xl"><button onClick={() => setActiveTab('branding')} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest ${activeTab === 'branding' ? 'bg-white text-black shadow-lg' : 'text-gray-500'}`}>MARCA</button><button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-lg text-[10px] font-bold transition-all uppercase tracking-widest ${activeTab === 'users' ? 'bg-white text-black shadow-lg' : 'text-gray-500'}`}>USUARIOS</button></div></div>
          {activeTab === 'branding' && (<div className="bg-[#0F0F11] border border-white/5 p-8 rounded-[2.5rem] space-y-6 shadow-xl"><h3 className="font-bold text-white uppercase font-display italic text-lg">Personalización de Marca</h3><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest ml-1">Nombre de la Plataforma</label><input value={config.appName} onChange={e => setConfig({...config, appName: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-500 outline-none transition-all" /></div><div><label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-widest ml-1">URL del Logo Oficial</label><input value={config.logoUrl} onChange={e => setConfig({...config, logoUrl: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-500 outline-none transition-all" placeholder="https://..." /></div><button onClick={handleSaveConfig} className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-red-900/20 active:scale-95 transition-all">Guardar Cambios</button></div>)}
          {activeTab === 'users' && (<div className="space-y-4 pb-32"><div className="flex justify-end"><button onClick={() => setShowInviteModal(true)} className="bg-white text-black px-4 py-2 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-gray-200 transition-colors shadow-xl"><UserPlus size={16}/> Alta de Usuario</button></div>{users.map(u => (<div key={u.id} className="bg-[#0F0F11] border border-white/5 p-5 rounded-2xl flex flex-col md:flex-row justify-between items-center gap-4 shadow-lg"><div className="flex items-center gap-4 w-full"><div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-inner ${u.isActive !== false ? 'bg-green-600' : 'bg-red-600'}`}>{u.name[0]}</div><div className="flex-1"><div><div className="font-bold text-white uppercase text-sm">{u.name} <span className="text-[9px] text-gray-500 bg-white/5 border border-white/5 px-2 py-0.5 rounded ml-2 uppercase">{u.role}</span></div><div className="text-xs text-gray-500">{u.email}</div></div></div></div><div className="flex gap-2 w-full md:w-auto"><button onClick={() => toggleUserStatus(u)} className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${u.isActive !== false ? 'bg-red-900/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white' : 'bg-green-900/10 text-green-500 border border-green-500/20 hover:bg-green-500 hover:text-white'}`}>{u.isActive !== false ? <><UserX size={14}/> Bloquear</> : <><UserCheck size={14}/> Activar</>}</button></div></div>))}</div>)}
          {showInviteModal && (<UserInviteModal currentUser={adminUserMock} onClose={() => setShowInviteModal(false)} onInviteSuccess={() => setUsers(DataEngine.getUsers())} />)}
      </div>
  );
};

const LoginPage = ({ onLogin }: { onLogin: (u: User) => void }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const u = DataEngine.getUserByNameOrEmail(email); if(u) { if(u.isActive === false) { setError('Usuario desactivado'); return; } onLogin(u); } else setError('Usuario no encontrado'); }
    return (
        <div className="min-h-screen bg-[#050507] flex items-center justify-center p-4 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden"><div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[100px]" /><div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]" /></div>
             <div className="w-full max-w-md space-y-8 relative z-10 text-center flex flex-col items-center">
                 <BrandingLogo className="w-48 h-48 mb-6 shadow-2xl" showText={false} />
                 <h1 className="text-5xl font-display font-black italic text-white tracking-tighter uppercase leading-none">KINETIX<br/><span className="text-red-600">ZONE</span></h1>
                 <p className="text-gray-500 mt-2 text-[10px] tracking-widest uppercase font-bold">Elite Performance Platform</p>
                 <div className="mt-4"><SocialLinks /></div>
                 <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] space-y-6 shadow-2xl w-full mt-8">
                    <div className="text-left"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1 tracking-widest">Correo de Acceso</label><input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-white focus:border-red-500 outline-none transition-all placeholder-gray-700 text-sm" placeholder="atleta@kinetix.com" /></div>
                    {error && <div className="text-red-500 text-[10px] font-bold bg-red-500/10 p-3 rounded-xl flex items-center gap-2 uppercase"><AlertTriangle size={14}/> {error}</div>}
                    <button type="submit" className="w-full bg-red-600 text-white font-bold py-5 rounded-2xl hover:bg-red-500 transition-all shadow-lg shadow-red-900/30 uppercase tracking-widest text-xs">Ingresar al Sistema</button>
                 </form>
                 
                 <div className="mt-8 space-y-4 w-full">
                     <div className="border-t border-white/5 pt-4 w-full">
                         <p className="text-[10px] text-gray-600 uppercase font-bold mb-3">Accesos Directos (Demo)</p>
                         <div className="flex gap-2 justify-center">
                             <button onClick={() => setEmail('atleta@kinetix.com')} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white border border-white/5 transition-colors">Atleta</button>
                             <button onClick={() => setEmail('coach@kinetix.com')} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white border border-white/5 transition-colors">Coach</button>
                             <button onClick={() => setEmail('admin@kinetix.com')} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white border border-white/5 transition-colors">Admin</button>
                         </div>
                     </div>
                     <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Jorge Gonzalez | Head Coach</p>
                        <p className="text-[8px] text-gray-700 uppercase tracking-widest font-bold">v12.7.2 PRO | RECOVERY</p>
                     </div>
                 </div>
             </div>
        </div>
    );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [chatbotOpen, setChatbotOpen] = useState(false);

  useEffect(() => {
     DataEngine.init();
     const session = localStorage.getItem(SESSION_KEY);
     if(session) { const u = DataEngine.getUserById(session); if(u) setUser(u); }
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [view]);

  const login = (u: User) => { localStorage.setItem(SESSION_KEY, u.id); setUser(u); setView('dashboard'); };
  const logout = () => { localStorage.removeItem(SESSION_KEY); setUser(null); };

  if (!user) return <LoginPage onLogin={login} />;

  return (
    <div className="min-h-[100dvh] bg-[#050507] text-gray-200 font-sans selection:bg-red-500/30">
        <aside className="fixed left-0 top-0 h-full w-64 bg-[#0F0F11] border-r border-white/5 p-6 hidden md:flex flex-col z-40">
            <BrandingLogo />
            <nav className="flex-1 space-y-2 mt-10">
                {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />}
                {user.role === 'client' && <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />}
                {user.role === 'coach' && <NavButton active={view === 'clients' || view === 'client-detail'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Gestión Atletas" />}
                {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'workouts'} onClick={() => setView('workouts')} icon={<Dumbbell size={20} />} label="Biblioteca" />}
                {user.role === 'admin' && <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<Shield size={20} />} label="Admin Console" />}
                <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Mi Perfil" />
            </nav>
            <div className="mt-auto pb-6 border-t border-white/5 pt-6">
                <button onClick={logout} className="flex items-center gap-3 text-gray-500 hover:text-red-500 transition-colors px-4 mt-8 w-full"><LogOut size={20} /> <span className="font-bold text-sm uppercase tracking-widest">Salir</span></button>
            </div>
        </aside>

        <div className="md:hidden fixed top-0 left-0 right-0 bg-[#050507]/90 backdrop-blur-xl border-b border-white/5 p-4 z-40 flex justify-between items-center"><BrandingLogo textSize="text-lg" /><div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs shadow-lg">{user.name[0]}</div></div>
        
        <main className="md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen relative">
            {view === 'dashboard' && <DashboardView user={user} onNavigate={setView} />}
            {view === 'clients' && <ClientsView onSelect={(id) => { setSelectedClientId(id); setView('client-detail'); }} user={user} />}
            {view === 'client-detail' && selectedClientId && <ClientDetailView clientId={selectedClientId} onBack={() => setView('clients')} />}
            {view === 'workouts' && <WorkoutsView user={user} />}
            {view === 'profile' && <ProfileView user={user} onLogout={logout} />}
            {view === 'admin' && <AdminView />}
        </main>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0F0F11]/95 backdrop-blur-xl border-t border-white/5 px-6 py-2 flex justify-between items-center z-40 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <MobileNavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />
            {(user.role === 'coach' || user.role === 'admin') && <MobileNavButton active={view === 'clients' || view === 'client-detail'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Atletas" />}
            {(user.role === 'coach' || user.role === 'admin') && <MobileNavButton active={view === 'workouts'} onClick={() => setView('workouts')} icon={<Dumbbell size={20} />} label="Lib" />}
            <MobileNavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Perfil" />
        </div>

        {user.role === 'client' && (<><button onClick={() => setChatbotOpen(!chatbotOpen)} className="fixed bottom-24 right-4 md:bottom-8 md:right-8 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-2xl z-50 transition-transform hover:scale-110 active:scale-95"><MessageCircle size={24} /></button>{chatbotOpen && <TechnicalChatbot onClose={() => setChatbotOpen(false)} />}</>)}
        
        <ConnectionStatus />
    </div>
  );
}