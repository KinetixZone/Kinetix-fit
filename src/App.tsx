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
        const newExercise: WorkoutExercise = { exerciseId: exercise.id, name: exercise.name, targetSets: 4, targetReps