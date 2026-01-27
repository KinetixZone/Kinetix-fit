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

// --- CONFIGURACIÓN DE VERSIÓN ESTABLE ---
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
      {method === 'biserie' && <div className="absolute top-0 right-0 bg-orange-600/20 text-orange-500 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-orange-500/20 flex items-center gap-1 uppercase tracking-widest"><Layers size={10} /> Bi-Serie</div>}
      {method === 'ahap' && <div className="absolute top-0 right-0 bg-purple-600/20 text-purple-400 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-purple-500/20 flex items-center gap-1 uppercase tracking-widest"><ArrowUpCircle size={10} /> AHAP</div>}
      {method === 'dropset' && <div className="absolute top-0 right-0 bg-red-600/20 text-red-500 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-red-500/20 flex items-center gap-1 uppercase tracking-widest"><CornerRightDown size={10} /> Drop Set</div>}
      {method === 'tabata' && <div className="absolute top-0 right-0 bg-cyan-600/20 text-cyan-400 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-cyan-500/20 flex items-center gap-1 uppercase tracking-widest"><TimerIcon size={10} /> TABATA</div>}
      {method === 'emom' && <div className="absolute top-0 right-0 bg-yellow-600/20 text-yellow-400 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-yellow-500/20 flex items-center gap-1 uppercase tracking-widest"><Clock size={10} /> EMOM</div>}

      {executionState !== 'idle' && (
          <div className="absolute inset-0 bg-[#0F0F11] z-10 flex flex-col items-center justify-center p-6 animate-fade-in">
              <div className="text-[10px] font-bold uppercase text-gray-500 tracking-widest mb-2">{method === 'tabata' ? `ROUND ${currentRound} / ${exercise.tabataConfig.rounds}` : `MINUTO ${currentMinute} / ${exercise.emomConfig.durationMin}`}</div>
              <div className={`text-6xl font-black font-display mb-4 tabular-nums ${currentPhase === 'rest' ? 'text-blue-500' : 'text-white'}`}>{timeLeft}s</div>
              <div className="flex items-center gap-2 mb-8"><span className={`text-xl font-bold uppercase ${currentPhase === 'rest' ? 'text-blue-500' : 'text-white'}`}>{activeExerciseName}</span>{activeExerciseName !== 'DESCANSAR' && <button onClick={() => onShowVideo(activeExerciseName)} className="text-gray-400 hover:text-white"><Play size={20}/></button>}</div>
              <div className="flex gap-4 w-full max-w-xs"><button onClick={togglePause} className="flex-1 bg-white/10 hover:bg-white/20 py-4 rounded-xl flex items-center justify-center text-white transition-colors">{executionState === 'running' ? <Pause size={24}/> : <Play size={24}/>}</button><button onClick={stopExecution} className="flex-1 bg-red-900/20 hover:bg-red-900/40 text-red-500 py-4 rounded-xl flex items-center justify-center transition-colors"><StopCircle size={24}/></button></div>
          </div>
      )}

      <div className="flex justify-between items-start mb-4 mt-2">
        <div className="flex items-start gap-3 w-full">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-bold text-gray-500 text-sm">{index + 1}</div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-white leading-tight">{exercise.name}</h3>
            {/* Visualización Standard / Otros */}
            {!['tabata', 'emom'].includes(method) && (
                <div className="flex flex-wrap gap-2 mt-2 items-center">
                {exercise.targetLoad && (
                    <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20">
                    <ShieldAlert size={10} className="text-yellow-500" />
                    <span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">{method === 'ahap' ? 'CARGA INCREMENTAL' : `META: ${exercise.targetLoad}KG`}</span>
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
            if (method === 'ahap') { setLabel += " (↑)"; setSubLabel = `CARGA: ${(exercise.targetWeights?.[setNum - 1] || exercise.targetLoad || '?')}KG x ${exercise.targetReps}`; }
            else if (method === 'dropset') { setSubLabel = 'Fallo mecánico + Bajada'; }
            else if (method === 'biserie') { setSubLabel = "Completa A + B sin descanso"; }
            else if (method === 'tabata') { setLabel = `TABATA BLOCK ${setNum}`; setSubLabel = `${exercise.tabataConfig?.rounds || 8} Rounds Completos`; }
            else if (method === 'emom') { setLabel = `EMOM BLOCK ${setNum}`; setSubLabel = `Duración Total: ${exercise.emomConfig?.durationMin || 10} min`; }

            return (
              <div key={setNum} className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${isDone ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5 border border-transparent'}`}>
                <div className="flex flex-col"><span className={`text-xs font-bold ${isDone ? 'text-green-400' : 'text-gray-400'}`}>{setLabel}</span><span className={`text-[10px] font-bold ${isDone ? 'text-green-500/60' : 'text-gray-600'}`}>{setSubLabel}</span></div>
                {(method === 'tabata' || method === 'emom') && !isDone ? (<button onClick={method === 'tabata' ? startTabata : startEmom} className="px-4 py-2 bg-white text-black text-[10px] font-bold rounded-lg uppercase tracking-widest hover:bg-gray-200 transition-colors flex items-center gap-2"><Play size={12}/> INICIAR</button>) : (<button onClick={() => handleToggle(setNum, !!isDone)} className={`w-12 h-10 rounded-lg flex items-center justify-center transition-all ${isDone ? 'bg-green-500 text-black shadow-lg shadow-green-500/20 animate-flash' : 'bg-white/10 text-gray-500 hover:bg-white/20'}`}>{isDone ? <Check size={20} strokeWidth={4} /> : <Circle size={20} />}</button>)}
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

  const activeVideoUrl = useMemo(() => {
    if (!showVideo) return null;
    const dbExercise = DataEngine.getExercises().find(e => e.name === showVideo);
    if (dbExercise?.videoUrl) return dbExercise.videoUrl;
    for (const w of plan.workouts) {
        for (const ex of w.exercises) {
            if (ex.pair?.name === showVideo && ex.pair.videoUrl) return ex.pair.videoUrl;
            if (ex.tabataConfig?.exercises) { const tabataEx = ex.tabataConfig.exercises.find((te:any) => te.name === showVideo); if (tabataEx?.videoUrl) return tabataEx.videoUrl; }
            if (ex.emomConfig) { if (ex.emomConfig.simpleConfig?.exercise === showVideo && dbExercise) return dbExercise.videoUrl; }
        }
    }
    return null;
  }, [showVideo, plan]);

  const embedSrc = getEmbedUrl(activeVideoUrl || '');
  const handleSetComplete = useCallback((rest?: number) => { if (rest && rest > 0) { setTimer({ active: true, seconds: rest }); } }, []);
  const handleFinishWorkout = (workout: Workout) => { if(confirm("¿Has terminado tu sesión?")) { const logs = DataEngine.getWorkoutLog(plan.userId, workout.id); DataEngine.archiveWorkout(plan.userId, workout, logs, startTime.current).then(session => { window.scrollTo(0,0); setFinishScreen(session); }); } };
  const handleClassAttendance = (workout: Workout, attended: boolean) => { if (attended) { if(confirm("¿Confirmar asistencia a clase?")) { DataEngine.archiveWorkout(plan.userId, workout, { 0: [{ setNumber: 1, weight: '0', reps: '1', completed: true, timestamp: Date.now() }] }, Date.now()); window.scrollTo(0,0); setFinishScreen({ summary: { exercisesCompleted: 1, totalVolume: 0, durationMinutes: 60, prCount: 0 }}); } } else { setActiveRescue(workout.id); } };
  const toggleWorkout = (id: string) => { setExpandedWorkouts(prev => ({...prev, [id]: !prev[id]})); };

  if (finishScreen) return (<div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-fade-in px-6"><Trophy size={80} className="text-yellow-500 mb-6 drop-shadow-2xl" /><h2 className="text-5xl font-display font-black italic text-white mb-2 leading-none uppercase">SESIÓN COMPLETA</h2><p className="text-green-400 font-bold uppercase tracking-widest text-xs">Protocolo Dominado</p><button onClick={() => setFinishScreen(null)} className="mt-12 bg-white text-black px-12 py-4 rounded-full font-bold hover:bg-gray-200 transition-colors uppercase tracking-widest text-xs">Continuar</button></div>);

  return (
    <div className="space-y-8 pb-32">
      {plan.workouts.map(workout => {
        const isRescue = activeRescue === workout.id;
        const isVisible = expandedWorkouts[workout.id] !== undefined ? expandedWorkouts[workout.id] : true;
        return (
          <div key={workout.id}>
            <div className="flex items-center gap-4 mb-6 cursor-pointer" onClick={() => toggleWorkout(workout.id)}><div className="h-px bg-white/10 flex-1"/><span className="text-xs font-black text-red-500 uppercase tracking-widest whitespace-nowrap flex items-center gap-2">DÍA {workout.day} • {workout.name}<ChevronRight size={14} className={`transform transition-transform ${isVisible ? 'rotate-90' : ''}`} /></span><div className="h-px bg-white/10 flex-1"/></div>
            {isVisible && (<>
                {workout.isClass && !isRescue ? (<div className="bg-gradient-to-br from-[#1A1A1D] to-black border border-red-500/30 rounded-3xl p-8 text-center shadow-xl"><MapPin size={40} className="mx-auto text-red-500 mb-4" /><h3 className="text-2xl font-display font-black italic text-white mb-2 uppercase">{workout.classType || 'CLASE PRESENCIAL'}</h3><p className="text-gray-400 text-sm mb-8 leading-relaxed">Asistencia requerida en Kinetix Zone para coaching directo.</p>{mode === 'athlete' ? (<div className="grid grid-cols-2 gap-3"><button onClick={() => handleClassAttendance(workout, true)} className="bg-green-600 text-black py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95">ASISTÍ</button><button onClick={() => handleClassAttendance(workout, false)} className="bg-white/5 text-gray-400 py-4 rounded-2xl font-bold uppercase tracking-widest text-[10px] transition-all active:scale-95">NO PUDE IR</button></div>) : (<div className="text-[10px] text-gray-500 font-bold uppercase border border-white/10 rounded-lg p-2">VISTA COACH: El atleta confirmará su asistencia</div>)}</div>) : (<>{isRescue && (<div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl mb-6 flex items-start gap-3 animate-fade-in"><ShieldAlert className="text-blue-400 shrink-0 mt-1" size={18} /><div><h4 className="font-bold text-blue-400 text-sm uppercase">Protocolo de Rescate</h4><p className="text-[10px] text-gray-500 uppercase font-bold mt-1">No pares tu progreso. Completa esta rutina metabólica en casa.</p></div></div>)}{(isRescue ? RESCUE_WORKOUT : workout.exercises).map((ex, idx) => (<ExerciseCard key={idx} exercise={ex} index={idx} workoutId={workout.id} userId={plan.userId} onShowVideo={setShowVideo} mode={mode} onSetComplete={handleSetComplete} history={DataEngine.getClientHistory(plan.userId)} />))}{mode === 'athlete' && (<button onClick={() => handleFinishWorkout(workout)} className="w-full bg-green-600 text-black font-bold py-5 rounded-2xl flex items-center justify-center gap-2 mt-4 shadow-xl shadow-green-600/10 uppercase tracking-widest text-sm transition-all active:scale-95"><CheckCircle2 size={24} /> Finalizar Sesión</button>)}</>)}</>)}
          </div>
        );
      })}
      {timer.active && (<div className="fixed bottom-24 right-4 bg-[#1A1A1D] border border-red-500/50 p-4 rounded-2xl shadow-2xl z-50 flex items-center gap-4 animate-fade-in-up"><div className="w-10 h-10 rounded-full border-2 border-red-500 flex items-center justify-center font-bold text-red-500 text-xs">{timer.seconds}s</div><div className="flex-1"><p className="text-[10px] font-bold text-gray-500 uppercase">Descanso</p><p className="text-xs font-bold text-white">¡Prepárate!</p></div><button onClick={() => setTimer({...timer, active: false})} className="text-gray-500 hover:text-white"><X size={16}/></button></div>)}
      {showVideo && (<div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowVideo(null)}><div className="bg-[#111] w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}><div className="p-4 border-b border-white/10 flex justify-between items-center bg-black/50"><h3 className="font-bold text-white text-sm uppercase">{showVideo}</h3><button onClick={() => setShowVideo(null)} className="text-gray-400 hover:text-white"><X size={20}/></button></div><div className="aspect-video bg-black flex items-center justify-center relative">{embedSrc ? (<iframe src={embedSrc} title={showVideo} className="w-full h-full absolute inset-0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />) : (<div className="text-center flex flex-col items-center"><Play size={48} className="text-red-600 mb-4" /><p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Cargando Tutorial Kinetix...</p></div>)}</div></div></div>)}
    </div>
  );
};

const ManualPlanBuilder = ({ plan, onSave, onCancel }: { plan: Plan, onSave: (p: Plan) => void, onCancel: () => void }) => {
    const [editedPlan, setEditedPlan] = useState<Plan>(JSON.parse(JSON.stringify(plan)));
    
    const updateWorkout = (wIndex: number, field: string, value: any) => {
        const newWorkouts = [...editedPlan.workouts];
        (newWorkouts[wIndex] as any)[field] = value;
        setEditedPlan({...editedPlan, workouts: newWorkouts});
    };

    const addWorkout = () => {
        const newW: Workout = {
            id: generateUUID(),
            name: 'Nuevo Día',
            day: editedPlan.workouts.length + 1,
            exercises: []
        };
        setEditedPlan({...editedPlan, workouts: [...editedPlan.workouts, newW]});
    };

    const removeWorkout = (index: number) => {
        const newWorkouts = editedPlan.workouts.filter((_, i) => i !== index);
        setEditedPlan({...editedPlan, workouts: newWorkouts});
    };

    const addExercise = (wIndex: number) => {
        const newEx: WorkoutExercise = {
            exerciseId: 'new',
            name: 'Seleccionar Ejercicio',
            targetSets: 3,
            targetReps: '10',
            method: 'standard'
        };
        const newWorkouts = [...editedPlan.workouts];
        newWorkouts[wIndex].exercises.push(newEx);
        setEditedPlan({...editedPlan, workouts: newWorkouts});
    };

    const updateExercise = (wIndex: number, exIndex: number, field: string, value: any) => {
        const newWorkouts = [...editedPlan.workouts];
        (newWorkouts[wIndex].exercises[exIndex] as any)[field] = value;
        setEditedPlan({...editedPlan, workouts: newWorkouts});
    };
    
    const removeExercise = (wIndex: number, exIndex: number) => {
         const newWorkouts = [...editedPlan.workouts];
         newWorkouts[wIndex].exercises = newWorkouts[wIndex].exercises.filter((_, i) => i !== exIndex);
         setEditedPlan({...editedPlan, workouts: newWorkouts});
    };

    return (
        <div className="fixed inset-0 bg-[#0F0F11] z-50 overflow-y-auto p-6 animate-fade-in">
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex justify-between items-center border-b border-white/10 pb-4">
                    <h2 className="text-2xl font-bold text-white uppercase italic">Editar Rutina</h2>
                    <div className="flex gap-2">
                        <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 font-bold text-xs uppercase hover:text-white">Cancelar</button>
                        <button onClick={() => onSave(editedPlan)} className="px-4 py-2 rounded-xl bg-green-600 text-black font-bold text-xs uppercase hover:bg-green-500 flex items-center gap-2"><Save size={14}/> Guardar</button>
                    </div>
                </div>
                
                <div className="bg-[#1A1A1D] p-4 rounded-2xl border border-white/5">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Nombre del Plan</label>
                    <input value={editedPlan.title} onChange={e => setEditedPlan({...editedPlan, title: e.target.value})} className="w-full bg-transparent border-b border-white/10 py-2 text-xl font-bold text-white outline-none focus:border-red-500" />
                </div>

                <div className="space-y-4">
                    {editedPlan.workouts.map((w, wIdx) => (
                        <div key={w.id} className="bg-[#1A1A1D] p-4 rounded-2xl border border-white/5 relative group">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex-1">
                                    <input value={w.name} onChange={e => updateWorkout(wIdx, 'name', e.target.value)} className="bg-transparent font-bold text-white text-lg outline-none w-full" placeholder="Nombre Sesión" />
                                    <div className="flex gap-2 mt-1">
                                        <label className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase"><input type="number" value={w.day} onChange={e => updateWorkout(wIdx, 'day', parseInt(e.target.value))} className="w-8 bg-black/20 text-center rounded" /> Día</label>
                                    </div>
                                </div>
                                <button onClick={() => removeWorkout(wIdx)} className="text-gray-600 hover:text-red-500"><Trash2 size={16}/></button>
                            </div>

                            <div className="space-y-2">
                                {w.exercises.map((ex, exIdx) => (
                                    <div key={exIdx} className="bg-black/40 p-3 rounded-xl flex gap-3 items-center">
                                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                                            <input value={ex.name} onChange={e => updateExercise(wIdx, exIdx, 'name', e.target.value)} className="col-span-2 bg-transparent text-sm font-bold text-white outline-none border-b border-transparent focus:border-white/20" placeholder="Ejercicio" />
                                            <div className="flex items-center gap-1"><span className="text-[9px] text-gray-500 font-bold">SETS</span><input value={ex.targetSets} onChange={e => updateExercise(wIdx, exIdx, 'targetSets', parseInt(e.target.value))} className="w-full bg-transparent text-sm text-center text-blue-400 font-bold outline-none" /></div>
                                            <div className="flex items-center gap-1"><span className="text-[9px] text-gray-500 font-bold">REPS</span><input value={ex.targetReps} onChange={e => updateExercise(wIdx, exIdx, 'targetReps', e.target.value)} className="w-full bg-transparent text-sm text-center text-white font-bold outline-none" /></div>
                                        </div>
                                        <button onClick={() => removeExercise(wIdx, exIdx)} className="text-gray-700 hover:text-red-500"><X size={14}/></button>
                                    </div>
                                ))}
                                <button onClick={() => addExercise(wIdx)} className="w-full py-2 border border-dashed border-white/10 rounded-xl text-[10px] font-bold text-gray-500 hover:text-white hover:border-white/30 uppercase transition-colors">+ Agregar Ejercicio</button>
                            </div>
                        </div>
                    ))}
                    <button onClick={addWorkout} className="w-full py-4 bg-white/5 rounded-2xl text-xs font-bold text-gray-400 hover:text-white uppercase transition-colors flex items-center justify-center gap-2"><Plus size={16}/> Agregar Día de Entrenamiento</button>
                </div>
            </div>
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

const ClientsView = ({ onSelect }: { onSelect: (id: string) => void }) => {
    const [clients, setClients] = useState(DataEngine.getUsers().filter(u => u.role === 'client'));
    return (
        <div className="space-y-6">
            <h2 className="text-3xl font-display font-black italic uppercase">ATLETAS</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clients.map(c => (
                    <div key={c.id} onClick={() => onSelect(c.id)} className="bg-[#0F0F11] border border-white/5 p-5 rounded-2xl cursor-pointer hover:border-red-500/50 transition-all">
                        <div className="flex items-center gap-4"><div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center font-bold text-white">{c.name[0]}</div><div><h4 className="font-bold text-white uppercase">{c.name}</h4><p className="text-xs text-gray-500">{c.email}</p></div></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

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

    const handleAssignRoutine = () => {
        if (!assigningTemplate || !targetClient) return;
        const newPlan: Plan = { ...assigningTemplate, id: generateUUID(), userId: targetClient, updatedAt: new Date().toISOString() };
        DataEngine.savePlan(newPlan);
        alert(`Rutina asignada a ${clients.find(c => c.id === targetClient)?.name}`);
        setAssigningTemplate(null);
        setTargetClient('');
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
                            <button onClick={handleAssignRoutine} className="flex-1 py-3 bg-red-600 rounded-xl font-bold text-sm text-white hover:bg-red-500 shadow-lg shadow-red-900/20">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
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
    const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); const u = DataEngine.getUserByNameOrEmail(email); if(u) onLogin(u); else alert("Usuario no encontrado"); };
    return (
        <div className="min-h-screen bg-[#050507] flex items-center justify-center p-4 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-full pointer-events-none"><div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[100px]" /><div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]" /></div>
             <div className="w-full max-w-md space-y-8 relative z-10 text-center flex flex-col items-center">
                 <BrandingLogo className="w-48 h-48 mb-6 shadow-2xl" showText={false} />
                 <h1 className="text-5xl font-display font-black italic text-white tracking-tighter uppercase leading-none">KINETIX<br/><span className="text-red-600">ZONE</span></h1>
                 <p className="text-gray-500 mt-2 text-[10px] tracking-widest uppercase font-bold">Elite Performance Platform</p>
                 <div className="mt-4"><SocialLinks /></div>
                 <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] space-y-6 shadow-2xl w-full mt-8">
                    <div className="text-left"><label className="block text-[10px] font-bold text-gray-500 uppercase mb-2 ml-1 tracking-widest">Correo de Acceso</label><input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 text-white focus:border-red-500 outline-none transition-all placeholder-gray-700 text-sm" placeholder="atleta@kinetix.com" /></div>
                    <button type="submit" className="w-full bg-red-600 text-white font-bold py-5 rounded-2xl hover:bg-red-500 transition-all shadow-lg shadow-red-900/30 uppercase tracking-widest text-xs">Ingresar al Sistema</button>
                 </form>
                 <div className="mt-8 space-y-4 w-full border-t border-white/5 pt-4">
                     <p className="text-[10px] text-gray-600 uppercase font-bold mb-3">Accesos Directos (Demo)</p>
                     <div className="flex gap-2 justify-center">
                         <button onClick={() => setEmail('atleta@kinetix.com')} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white border border-white/5 transition-colors">Atleta</button>
                         <button onClick={() => setEmail('coach@kinetix.com')} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white border border-white/5 transition-colors">Coach</button>
                         <button onClick={() => setEmail('admin@kinetix.com')} className="text-[10px] bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white border border-white/5 transition-colors">Admin</button>
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
            {view === 'clients' && <ClientsView onSelect={(id) => { setSelectedClientId(id); setView('client-detail'); }} />}
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