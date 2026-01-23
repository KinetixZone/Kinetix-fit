
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer as TimerIcon, Download, Upload, Filter, Clock, Database, FileJson, Cloud, CloudOff,
  Wifi, WifiOff, AlertTriangle, Smartphone, Signal, Globe, Loader2, BrainCircuit,
  CalendarDays, Trophy, Pencil, Menu, Youtube, Info, UserMinus, UserCog, Circle, CheckCircle,
  MoreVertical, Flame, StopCircle, ClipboardList, Disc, MessageSquare, Send, TrendingUp, Shield, Palette, MapPin,
  Briefcase, BarChart4, AlertOctagon, MessageCircle, Power, UserX, UserCheck, KeyRound, Mail, Minus,
  Instagram, Facebook, Linkedin, Phone, Calendar as CalendarIcon, Copy
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, SetEntry, WorkoutProgress, SystemConfig, ChatMessage, UserRole, RoutineTemplate } from './types';
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
    const date = new Date(isoString);
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute:'2-digit' });
};

const formatDayDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T12:00:00'); // Prevent timezone shift
    return date.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};

// --- SYSTEM CONSTANTS & RESCUE ROUTINE ---
const COACH_UUID = 'e9c12345-6789-4321-8888-999999999999';
const ADMIN_UUID = 'a1b2c3d4-0000-0000-0000-admin0000001';
const STORAGE_KEY = 'KINETIX_DATA_PRO_V12_6_SAFE';
const SESSION_KEY = 'KINETIX_SESSION_PRO_V12_6_SAFE';
const TEMPLATES_KEY = 'KINETIX_TEMPLATES_V1';
const OFFICIAL_LOGO_URL = 'https://raw.githubusercontent.com/KinetixZone/Kinetix-fit/32b6e2ce7e4abcd5b5018cdb889feec444a66e22/TEAM%20JG.jpg';

const RESCUE_WORKOUT: WorkoutExercise[] = [
    { exerciseId: 'res1', name: 'Burpees', targetSets: 4, targetReps: '15', targetRest: 60, coachCue: 'Mantén ritmo constante.' },
    { exerciseId: 'res2', name: 'Sentadillas Air', targetSets: 4, targetReps: '20', targetRest: 60, coachCue: 'Rompe paralelo.' },
    { exerciseId: 'res3', name: 'Push Ups', targetSets: 4, targetReps: 'Max', targetRest: 60, coachCue: 'Pecho al suelo.' },
    { exerciseId: 'res4', name: 'Plancha Abdominal', targetSets: 4, targetReps: '45s', targetRest: 60, coachCue: 'Aprieta abdomen.' },
];

const DEFAULT_CONFIG: SystemConfig = {
    appName: 'KINETIX',
    logoUrl: OFFICIAL_LOGO_URL, 
    themeColor: '#ef4444',
    ai: {
        chatbot: { enabled: false }
    }
};

// --- DATA ENGINE (HYBRID: LOCAL + CLOUD) ---
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
      const loaded = s.CONFIG ? JSON.parse(s.CONFIG) : {};
      let logoUrl = loaded.logoUrl;
      if (!logoUrl || logoUrl.trim() === '') { logoUrl = OFFICIAL_LOGO_URL; }
      return { ...DEFAULT_CONFIG, ...loaded, logoUrl: logoUrl, ai: { ...DEFAULT_CONFIG.ai, ...loaded.ai } };
  },

  saveConfig: (config: SystemConfig) => {
      const s = DataEngine.getStore();
      s.CONFIG = JSON.stringify(config);
      DataEngine.saveStore(s);
  },

  init: async () => {
    const store = DataEngine.getStore();
    let users = store.USERS ? JSON.parse(store.USERS) : [];
    let exercises = store.EXERCISES ? JSON.parse(store.EXERCISES) : [];
    let modified = false;

    if (!users.find((u:User) => u.email === 'atleta@kinetix.com')) { users.push({...MOCK_USER, isActive: true}); modified = true; }
    if (!users.find((u:User) => u.email === 'coach@kinetix.com')) {
        users.push({ id: COACH_UUID, name: 'COACH KINETIX', email: 'coach@kinetix.com', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, role: 'coach', daysPerWeek: 6, equipment: [], streak: 999, createdAt: new Date().toISOString(), isActive: true });
        modified = true;
    }
    if (!users.find((u:User) => u.email === 'admin@kinetix.com')) {
        users.push({ id: ADMIN_UUID, name: 'ADMINISTRADOR', email: 'admin@kinetix.com', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, role: 'admin', daysPerWeek: 0, equipment: [], streak: 0, createdAt: new Date().toISOString(), isActive: true });
        modified = true;
    }

    const mergedExercises = [...INITIAL_EXERCISES];
    exercises.forEach((se: Exercise) => { if (!mergedExercises.find(me => me.id === se.id)) mergedExercises.push(se); });
    
    if(modified) {
        store.USERS = JSON.stringify(users);
        store.EXERCISES = JSON.stringify(mergedExercises);
        DataEngine.saveStore(store);
    }

    // Cleanup History
    const cleanUpLocalStorage = () => {
        try {
            const currentStore = DataEngine.getStore();
            let hasChanges = false;
            Object.keys(currentStore).forEach(key => {
                if (key.startsWith('HISTORY_')) {
                    const history = JSON.parse(currentStore[key]);
                    if (history.length > 50) {
                        currentStore[key] = JSON.stringify(history.slice(0, 50));
                        hasChanges = true;
                    }
                }
            });
            if(hasChanges) DataEngine.saveStore(currentStore);
        } catch (e) { console.error("Error en Cleanup:", e); }
    };
    cleanUpLocalStorage();
  },
  
  getUsers: (): User[] => { const s = DataEngine.getStore(); return s.USERS ? JSON.parse(s.USERS) : []; },
  getUserById: (id: string): User | undefined => DataEngine.getUsers().find(u => u.id === id),
  getUserByNameOrEmail: (query: string): User | undefined => {
    const users = DataEngine.getUsers();
    const q = query.toLowerCase().trim();
    return users.find(u => u.email.toLowerCase() === q || u.name.toLowerCase() === q);
  },
  getExercises: (): Exercise[] => { const s = DataEngine.getStore(); return s.EXERCISES ? JSON.parse(s.EXERCISES) : INITIAL_EXERCISES; },
  getPlan: (uid: string): Plan | null => { const s = DataEngine.getStore(); const p = s[`PLAN_${uid}`]; return p ? JSON.parse(p) : null; },
  savePlan: async (plan: Plan) => { const s = DataEngine.getStore(); s[`PLAN_${plan.userId}`] = JSON.stringify(plan); DataEngine.saveStore(s); },
  saveUser: async (user: User) => {
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    s.USERS = JSON.stringify(users);
    DataEngine.saveStore(s);
  },
  deleteUser: async (userId: string) => {
    const s = DataEngine.getStore();
    let users = JSON.parse(s.USERS || '[]');
    users = users.filter((u: User) => u.id !== userId);
    s.USERS = JSON.stringify(users);
    delete s[`PLAN_${userId}`];
    DataEngine.saveStore(s);
  },
  saveSetLog: (userId: string, workoutId: string, exerciseIndex: number, setEntry: SetEntry) => {
    const s = DataEngine.getStore();
    const key = `LOG_TEMP_${userId}_${workoutId}`;
    const currentLog: WorkoutProgress = s[key] ? JSON.parse(s[key]) : {};
    if (!currentLog[exerciseIndex]) currentLog[exerciseIndex] = [];
    const existingSetIndex = currentLog[exerciseIndex].findIndex(s => s.setNumber === setEntry.setNumber);
    if (existingSetIndex >= 0) currentLog[exerciseIndex][existingSetIndex] = setEntry; else currentLog[exerciseIndex].push(setEntry);
    s[key] = JSON.stringify(currentLog);
    DataEngine.saveStore(s);
  },
  getWorkoutLog: (userId: string, workoutId: string): WorkoutProgress => {
    const s = DataEngine.getStore();
    const key = `LOG_TEMP_${userId}_${workoutId}`;
    return s[key] ? JSON.parse(s[key]) : {};
  },
  archiveWorkout: async (userId: string, workout: Workout, logs: WorkoutProgress, startTime: number) => {
    const s = DataEngine.getStore();
    const historyKey = `HISTORY_${userId}`;
    const currentHistory = s[historyKey] ? JSON.parse(s[historyKey]) : [];
    const endTime = Date.now();
    const durationMinutes = Math.floor((endTime - startTime) / 60000);
    let totalVolume = 0;
    
    Object.values(logs).flat().forEach(entry => { 
        if(entry.completed) {
            const weight = parseFloat(entry.weight);
            const reps = parseFloat(entry.reps);
            const safeWeight = isNaN(weight) ? 0 : weight;
            const safeReps = isNaN(reps) ? 0 : reps;
            totalVolume += safeWeight * safeReps; 
        }
    });

    const session = {
      id: generateUUID(), workoutName: workout.name, workoutId: workout.id, date: new Date().toISOString(), logs: logs,
      summary: { exercisesCompleted: Object.keys(logs).length, totalVolume, durationMinutes, prCount: 0 }
    };
    
    currentHistory.unshift(session); 
    s[historyKey] = JSON.stringify(currentHistory);
    delete s[`LOG_TEMP_${userId}_${workout.id}`]; 
    
    const users = JSON.parse(s.USERS || '[]');
    const uIdx = users.findIndex((u:User) => u.id === userId);
    if(uIdx >= 0) { users[uIdx].streak += 1; s.USERS = JSON.stringify(users); }
    DataEngine.saveStore(s);
    return session;
  },
  getClientHistory: (userId: string) => { const s = DataEngine.getStore(); const historyKey = `HISTORY_${userId}`; return s[historyKey] ? JSON.parse(s[historyKey]) : []; },
  
  getTemplates: (): RoutineTemplate[] => {
    const data = localStorage.getItem(TEMPLATES_KEY);
    return data ? JSON.parse(data) : [];
  },
  saveTemplate: (template: RoutineTemplate) => {
    const current = DataEngine.getTemplates();
    current.push(template);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(current));
    window.dispatchEvent(new Event('storage-update'));
  },
};

// --- COMPONENTS ---

const BrandingLogo = ({ className = "w-8 h-8", textSize = "text-xl", showText = true }: { className?: string, textSize?: string, showText?: boolean }) => {
    const [config, setConfig] = useState(DataEngine.getConfig());
    const [imgError, setImgError] = useState(false);
    useEffect(() => {
        const update = () => { setConfig(DataEngine.getConfig()); setImgError(false); };
        window.addEventListener('storage-update', update);
        return () => window.removeEventListener('storage-update', update);
    }, []);
    const displayUrl = (!config.logoUrl || config.logoUrl === '') ? OFFICIAL_LOGO_URL : config.logoUrl;
    return (
        <div className="flex items-center gap-2.5 select-none group">
            {!imgError ? (
                <img src={displayUrl} alt="Logo" className={`${className} object-cover rounded-xl shadow-lg shadow-red-900/20 bg-[#0F0F11] border border-white/5 transition-transform group-hover:scale-105`} onError={() => setImgError(true)} />
            ) : (
                <img src={OFFICIAL_LOGO_URL} alt="Logo Backup" className={`${className} object-cover rounded-xl shadow-lg shadow-red-900/20 bg-[#0F0F11] border border-white/5 transition-transform group-hover:scale-105`} />
            )}
            {showText && (<span className={`font-display font-black italic tracking-tighter ${textSize} text-white drop-shadow-md`}>{config.appName.toUpperCase()}</span>)}
        </div>
    );
}

const SocialLinks = ({ className = "" }: { className?: string }) => {
    return (
        <div className={`flex gap-3 justify-center ${className}`}>
            <a href="https://www.instagram.com/kinetix.zone/" target="_blank" rel="noreferrer" className="p-2 bg-white/5 hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-110"><Instagram size={18} /></a>
            <a href="https://www.facebook.com/people/Kinetix-Functional-Zone/61577641223744/" target="_blank" rel="noreferrer" className="p-2 bg-white/5 hover:bg-blue-600 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-110"><Facebook size={18} /></a>
            <a href="https://wa.me/525627303189" target="_blank" rel="noreferrer" className="p-2 bg-white/5 hover:bg-green-500 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-110"><MessageCircle size={18} /></a>
        </div>
    );
}

const AccessLockedScreen = ({ onLogout }: { onLogout: () => void }) => (
    <div className="fixed inset-0 bg-black z-[100] flex flex-col items-center justify-center p-8 text-center animate-fade-in">
        <div className="w-24 h-24 bg-red-600/20 rounded-full flex items-center justify-center mb-6 text-red-500 animate-pulse">
            <ShieldAlert size={48} />
        </div>
        <h2 className="text-3xl font-display font-black italic text-white mb-4 uppercase">ACCESO RESTRINGIDO</h2>
        <p className="text-gray-400 max-w-xs mb-8 leading-relaxed">Tu periodo de acceso ha expirado. Por favor, contacta a tu coach para renovar tu membresía y continuar con tu evolución.</p>
        <div className="space-y-4 w-full max-w-xs">
            <a href="https://wa.me/525627303189" target="_blank" rel="noreferrer" className="w-full py-4 bg-white text-black rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors">
                <MessageCircle size={18}/> HABLAR CON COACH
            </a>
            <button onClick={onLogout} className="w-full py-4 bg-white/5 text-gray-400 rounded-xl font-bold hover:bg-white/10 transition-colors">
                CERRAR SESIÓN
            </button>
        </div>
    </div>
);

const RestTimer = ({ initialSeconds = 60, onComplete, onClose }: { initialSeconds?: number, onComplete?: () => void, onClose: () => void }) => {
  const [timeLeft, setTimeLeft] = useState(initialSeconds);
  const [totalTime, setTotalTime] = useState(initialSeconds);
  const [isActive, setIsActive] = useState(true);
  useEffect(() => { setTimeLeft(initialSeconds); setTotalTime(initialSeconds); setIsActive(true); }, [initialSeconds]);
  useEffect(() => {
    let interval: any = null;
    if (isActive && timeLeft > 0) { interval = setInterval(() => { setTimeLeft((seconds) => seconds - 1); }, 1000); } 
    else if (timeLeft === 0) { if (onComplete) onComplete(); clearInterval(interval); }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, onComplete]);
  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; };
  return (
    <div className="fixed bottom-24 right-4 md:right-8 bg-[#1A1A1D] border border-red-500/50 text-white p-4 rounded-2xl shadow-2xl z-50 flex flex-col gap-3 animate-fade-in-up w-[280px]">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0"><svg className="w-12 h-12 transform -rotate-90"><circle cx="24" cy="24" r="20" stroke="#333" strokeWidth="4" fill="transparent" /><circle cx="24" cy="24" r="20" stroke="#EF4444" strokeWidth="4" fill="transparent" strokeDasharray={125} strokeDashoffset={125 - (125 * timeLeft) / (totalTime || 1)} className="transition-all duration-1000 ease-linear" /></svg><div className="absolute top-0 left-0 w-full h-full flex items-center justify-center font-mono font-bold text-sm">{formatTime(timeLeft)}</div></div>
        <div className="flex-1"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Descanso</p><div className="flex gap-2"><button onClick={() => setTimeLeft(prev => Math.max(0, prev + 30))} className="px-2 py-1 bg-white/10 rounded text-xs font-bold hover:bg-white/20">+30s</button><button onClick={() => setIsActive(!isActive)} className="px-2 py-1 bg-white/10 rounded text-xs font-bold hover:bg-white/20">{isActive ? 'Pausa' : 'Seguir'}</button></div></div>
        <button onClick={onClose} className="text-gray-500 hover:text-white self-start"><X size={16}/></button>
      </div>
    </div>
  );
};

const ConnectionStatus = () => { const [isOnline, setIsOnline] = useState(supabaseConnectionStatus.isConfigured); return (<div className={`fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 backdrop-blur-md border ${isOnline ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>{isOnline ? <Cloud size={10} /> : <CloudOff size={10} />}<span>{isOnline ? 'ONLINE' : 'LOCAL'}</span></div>); };
const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${active ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{icon}<span>{label}</span></button>);
const MobileNavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (<button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${active ? 'text-red-500' : 'text-gray-500'}`}><div className={`p-1 rounded-lg ${active ? 'bg-red-500/10' : ''}`}>{icon}</div><span className="text-[10px] font-bold">{label}</span></button>);
const StatCard = ({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) => (<div className="bg-[#0F0F11] border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-white/10 transition-colors"><div className="flex justify-between items-start mb-2"><span className="text-xs text-gray-500 font-bold uppercase">{label}</span>{icon}</div><span className="text-2xl font-bold font-display truncate">{value}</span></div>);

// --- VIEW COMPONENTS ---

const LoginPage = ({ onLogin }: { onLogin: (user: User) => void }) => {
    const [query, setQuery] = useState('');
    const [error, setError] = useState('');

    const handleLogin = () => {
        const u = DataEngine.getUserByNameOrEmail(query);
        if (u) onLogin(u);
        else setError('Usuario no encontrado');
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
            <div className="w-full max-w-sm space-y-8 animate-fade-in">
                <div className="text-center"><BrandingLogo className="w-16 h-16 mx-auto mb-4" textSize="text-3xl" /></div>
                <div className="bg-[#0F0F11] border border-white/5 p-8 rounded-3xl space-y-6">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Nombre o Email</label>
                        <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} className="w-full bg-black border border-white/10 rounded-xl p-4 text-white focus:border-red-500 outline-none" placeholder="atleta@kinetix.com" />
                    </div>
                    {error && <p className="text-red-500 text-xs font-bold">{error}</p>}
                    <button onClick={handleLogin} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2">ENTRAR <ArrowRight size={18}/></button>
                </div>
            </div>
        </div>
    );
};

const DashboardView = ({ user, onNavigate }: { user: User, onNavigate: (v: string) => void }) => {
    const history = useMemo(() => DataEngine.getClientHistory(user.id), [user.id]);
    const plan = useMemo(() => DataEngine.getPlan(user.id), [user.id]);
    const stats = useMemo(() => {
        const totalVol = history.reduce((acc, h) => acc + (h.summary?.totalVolume || 0), 0);
        return { totalVol, sessions: history.length, streak: user.streak };
    }, [history, user]);

    return (
        <div className="space-y-8 animate-fade-in">
            <header className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-display font-black italic text-white uppercase tracking-tight">HOLA, {user.name.split(' ')[0]}</h1>
                    <p className="text-gray-500 text-sm font-bold uppercase mt-1 flex items-center gap-2"><Activity size={14} className="text-red-500"/> {user.goal} • NIVEL {user.level}</p>
                </div>
                <div className="bg-red-600/10 px-4 py-2 rounded-xl border border-red-500/20 flex items-center gap-2">
                    <Flame size={18} className="text-red-500" />
                    <span className="text-red-500 font-black italic">{user.streak} DÍAS</span>
                </div>
            </header>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Sesiones" value={stats.sessions} icon={<ClipboardList size={18} className="text-gray-500" />} />
                <StatCard label="Volumen (kg)" value={Math.floor(stats.totalVol)} icon={<TrendingUp size={18} className="text-gray-500" />} />
                <StatCard label="Racha" value={stats.streak} icon={<Zap size={18} className="text-gray-500" />} />
                <StatCard label="Meta" value={user.daysPerWeek} icon={<CheckCircle2 size={18} className="text-gray-500" />} />
            </div>

            {plan ? (
                <PlanViewer plan={plan} mode="athlete" />
            ) : (
                <div className="bg-[#0F0F11] border border-dashed border-white/10 p-12 rounded-3xl text-center">
                    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500"><Dumbbell size={32}/></div>
                    <h3 className="font-bold text-white mb-2 uppercase">SIN PLAN ACTIVO</h3>
                    <p className="text-gray-500 text-sm max-w-xs mx-auto mb-6">Tu coach aún no ha asignado un plan para ti. Contactalo para empezar.</p>
                </div>
            )}
        </div>
    );
};

const ClientsView = ({ onSelect, user }: { onSelect: (id: string) => void, user: User }) => {
    const clients = DataEngine.getUsers().filter(u => u.role === 'client');
    const [search, setSearch] = useState('');

    const filtered = clients.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) || 
        c.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <header className="flex justify-between items-center">
                <h1 className="text-2xl font-display font-black italic text-white uppercase">MIS ATLETAS</h1>
                <button className="bg-red-600 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><UserPlus size={18}/> NUEVO</button>
            </header>
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input placeholder="Buscar por nombre o email..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0F0F11] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-red-500 outline-none" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
                {filtered.map(c => (
                    <button key={c.id} onClick={() => onSelect(c.id)} className="bg-[#0F0F11] border border-white/5 p-5 rounded-2xl flex items-center justify-between hover:bg-white/5 transition-colors text-left">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center font-bold text-gray-400">{c.name[0]}</div>
                            <div>
                                <h3 className="font-bold text-white uppercase text-sm">{c.name}</h3>
                                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{c.goal} • {c.level}</p>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-600" />
                    </button>
                ))}
            </div>
        </div>
    );
};

const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
    const client = DataEngine.getUserById(clientId);
    const plan = DataEngine.getPlan(clientId);
    const history = DataEngine.getClientHistory(clientId);
    const [isEditing, setIsEditing] = useState(false);
    const [loadingAI, setLoadingAI] = useState(false);

    if (!client) return null;

    const handleGenerateAI = async () => {
        setLoadingAI(true);
        try {
            const result = await generateSmartRoutine(client, history);
            const newPlan: Plan = {
                id: generateUUID(),
                title: result.title || 'Nueva Rutina AI',
                userId: clientId,
                workouts: result.workouts.map((w: any) => ({ ...w, id: generateUUID() })),
                updatedAt: new Date().toISOString()
            };
            DataEngine.savePlan(newPlan);
            window.location.reload(); // Refresh to show new plan
        } catch (e) {
            alert("Error de IA: " + e);
        } finally {
            setLoadingAI(false);
        }
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white mb-4"><ChevronLeft size={18}/> VOLVER</button>
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-display font-black italic text-white uppercase">{client.name}</h1>
                    <p className="text-gray-500 text-sm font-bold">{client.email}</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setIsEditing(true)} className="bg-white/5 p-3 rounded-xl text-gray-400 hover:text-white border border-white/5"><Edit3 size={18}/></button>
                    <button onClick={handleGenerateAI} disabled={loadingAI} className="bg-gradient-to-tr from-purple-600 to-red-600 px-4 py-2 rounded-xl text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-red-900/20 disabled:opacity-50">
                        {loadingAI ? <Loader2 className="animate-spin" size={18}/> : <Sparkles size={18}/>} AI GENERATE
                    </button>
                </div>
            </div>

            {plan ? (
                <PlanViewer plan={plan} mode="coach" />
            ) : (
                <div className="bg-[#0F0F11] border border-dashed border-white/10 p-12 rounded-3xl text-center">
                    <p className="text-gray-500 text-sm mb-6 uppercase font-bold">SIN RUTINA ASIGNADA</p>
                    <button onClick={() => setIsEditing(true)} className="bg-white text-black px-6 py-2 rounded-lg font-bold">CREAR MANUALMENTE</button>
                </div>
            )}

            {isEditing && (
                <ManualPlanBuilder 
                    plan={plan || { id: generateUUID(), title: 'NUEVA RUTINA', userId: clientId, workouts: [], updatedAt: new Date().toISOString() }}
                    onSave={(p: Plan) => { DataEngine.savePlan(p); setIsEditing(false); }}
                    onCancel={() => setIsEditing(false)}
                />
            )}
        </div>
    );
};

const WorkoutsView = ({ user }: { user: User }) => {
    const exercises = DataEngine.getExercises();
    const [search, setSearch] = useState('');
    const groups = Array.from(new Set(exercises.map(e => e.muscleGroup)));

    return (
        <div className="space-y-8 animate-fade-in">
            <header><h1 className="text-2xl font-display font-black italic text-white uppercase">BIBLIOTECA DE EJERCICIOS</h1></header>
            <div className="relative">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input placeholder="Filtrar ejercicios..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-[#0F0F11] border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white focus:border-red-500 outline-none" />
            </div>
            <div className="space-y-8">
                {groups.map(group => {
                    const filtered = exercises.filter(e => e.muscleGroup === group && e.name.toLowerCase().includes(search.toLowerCase()));
                    if (filtered.length === 0) return null;
                    return (
                        <div key={group}>
                            <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500" /> {group}</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {filtered.map(ex => (
                                    <div key={ex.id} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl hover:border-white/10 transition-colors group">
                                        <p className="text-white font-bold text-xs uppercase mb-2 truncate">{ex.name}</p>
                                        <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="text-[10px] text-gray-500 font-bold flex items-center gap-1 group-hover:text-red-500 transition-colors"><Video size={10}/> VER TÉCNICA</a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

const ProfileView = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
    return (
        <div className="max-w-md mx-auto space-y-8 animate-fade-in">
            <header className="text-center">
                <div className="w-24 h-24 bg-gradient-to-tr from-red-600 to-red-900 rounded-3xl mx-auto mb-4 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-red-900/20">{user.name[0]}</div>
                <h1 className="text-2xl font-display font-black italic text-white uppercase">{user.name}</h1>
                <p className="text-gray-500 text-sm font-bold uppercase">{user.role}</p>
            </header>
            <div className="bg-[#0F0F11] border border-white/5 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-xs font-bold text-gray-500 uppercase">Email</span><span className="text-sm font-bold text-white">{user.email}</span></div>
                <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-xs font-bold text-gray-500 uppercase">Nivel</span><span className="text-sm font-bold text-white">{user.level}</span></div>
                <div className="flex justify-between items-center py-2 border-b border-white/5"><span className="text-xs font-bold text-gray-500 uppercase">Frecuencia</span><span className="text-sm font-bold text-white">{user.daysPerWeek} días/sem</span></div>
            </div>
            <button onClick={onLogout} className="w-full bg-white/5 hover:bg-red-900/10 text-red-500 font-bold py-4 rounded-2xl border border-white/5 transition-all">CERRAR SESIÓN</button>
            <SocialLinks />
        </div>
    );
};

const AdminView = () => {
    const [config, setConfig] = useState(DataEngine.getConfig());
    const handleSave = () => { DataEngine.saveConfig(config); alert("Configuración guardada"); };
    return (
        <div className="max-w-xl mx-auto space-y-8 animate-fade-in">
            <header><h1 className="text-2xl font-display font-black italic text-white uppercase">SISTEMA</h1></header>
            <div className="bg-[#0F0F11] border border-white/5 rounded-3xl p-6 space-y-6">
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Nombre de App</label>
                    <input value={config.appName} onChange={(e) => setConfig({...config, appName: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none" />
                </div>
                <div>
                    <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Logo URL (cuadrado)</label>
                    <input value={config.logoUrl} onChange={(e) => setConfig({...config, logoUrl: e.target.value})} className="w-full bg-black border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none" />
                </div>
                <button onClick={handleSave} className="w-full bg-white text-black font-bold py-4 rounded-xl">GUARDAR CAMBIOS</button>
            </div>
        </div>
    );
};

// --- EXERCISE CARD ---
const ExerciseCard = ({ 
  exercise, index, workoutId, userId, onShowVideo, mode, onSetComplete, history 
}: any) => {
  const [logs, setLogs] = useState<WorkoutProgress>({});

  useEffect(() => {
    if (mode === 'athlete') {
      const savedLogs = DataEngine.getWorkoutLog(userId, workoutId);
      setLogs(savedLogs);
    }
  }, [userId, workoutId, mode]);

  const handleToggleCheck = (setNum: number, isDone: boolean) => {
      const targetLoads = (exercise.targetLoad || '0').split(',');
      const finalWeight = targetLoads[Math.min(setNum - 1, targetLoads.length - 1)].trim();
      const finalReps = exercise.targetReps || '0';

      const entry: SetEntry = {
          setNumber: setNum, 
          weight: finalWeight, 
          reps: finalReps, 
          completed: !isDone, 
          timestamp: Date.now()
      };
      
      DataEngine.saveSetLog(userId, workoutId, index, entry);
      const currentExLogs = logs[index] || [];
      const newExLogs = [...currentExLogs];
      const existingIdx = newExLogs.findIndex(s => s.setNumber === setNum);
      if (existingIdx >= 0) newExLogs[existingIdx] = entry; else newExLogs.push(entry);
      
      setLogs({...logs, [index]: newExLogs});
      if (!isDone) {
          if (navigator.vibrate) navigator.vibrate(50);
          onSetComplete(exercise.targetRest);
      }
  };

  const setsArray = Array.from({ length: exercise.targetSets }, (_, i) => i + 1);
  const exerciseLogs = logs[index] || [];
  const targetLoads = (exercise.targetLoad || '').split(',').filter(Boolean);

  return (
    <div className={`bg-[#0F0F11] border border-white/5 rounded-2xl p-5 mb-4 transition-all relative ${exercise.supersetId ? 'border-l-4 border-l-blue-500' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-bold text-gray-400 text-sm">
             {index + 1}
          </div>
          <div>
            <h3 className="font-bold text-lg text-white leading-tight">{exercise.name}</h3>
            <div className="flex flex-wrap gap-2 mt-2 items-center">
                {targetLoads.length > 1 ? (
                    <div className="flex gap-1">
                        {targetLoads.map((l, i) => (
                            <span key={i} className="text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1.5 py-0.5 rounded">
                                S{i+1}: {l}kg
                            </span>
                        ))}
                    </div>
                ) : (
                    exercise.targetLoad && (
                        <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 px-2 py-1 rounded-md border border-yellow-500/20">
                            <ShieldAlert size={12} className="text-yellow-500" />
                            <span className="text-xs font-bold text-yellow-500">Meta: {exercise.targetLoad}kg</span>
                        </div>
                    )
                )}
            </div>
          </div>
        </div>
        <a href={INITIAL_EXERCISES.find(e => e.id === exercise.exerciseId || e.name === exercise.name)?.videoUrl || '#'} target="_blank" rel="noreferrer" className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400"><Play size={18} /></a>
      </div>

      {mode === 'athlete' && (
        <div className="space-y-2 mt-4 bg-black/20 p-3 rounded-xl border border-white/5">
           {setsArray.map(setNum => {
             const log = exerciseLogs.find(l => l.setNumber === setNum);
             const isDone = log?.completed;
             const setWeight = targetLoads[Math.min(setNum - 1, targetLoads.length - 1)] || '0';
             
             return (
               <div key={setNum} className={`flex items-center justify-between p-2 rounded-lg transition-all ${isDone ? 'bg-green-900/10 border border-green-500/20' : ''}`}>
                 <div className="flex items-center gap-3">
                     <span className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400">{setNum}</span>
                     <span className={`text-sm font-bold ${isDone ? 'text-green-400' : 'text-white'}`}>
                        {setWeight}kg x {exercise.targetReps}
                     </span>
                 </div>
                 <button onClick={() => handleToggleCheck(setNum, !!isDone)} className={`w-12 h-10 rounded-lg flex items-center justify-center transition-all ${isDone ? 'bg-green-500 text-black' : 'bg-white/10 text-gray-500'}`}>
                      {isDone ? <Check size={20} strokeWidth={4} /> : <Circle size={20} />}
                 </button>
               </div>
             );
           })}
        </div>
      )}
    </div>
  );
};

const PlanViewer = ({ plan, mode = 'coach' }: { plan: Plan, mode?: 'coach' | 'athlete' }) => {
  const [expandedWorkouts, setExpandedWorkouts] = useState<Record<string, boolean>>({});
  const [showVideo, setShowVideo] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [currentRestTime, setCurrentRestTime] = useState(60);
  const [finishScreen, setFinishScreen] = useState<any | null>(null);

  const history = useMemo(() => DataEngine.getClientHistory(plan.userId), [plan.userId]);

  const toggleWorkout = (id: string) => setExpandedWorkouts(prev => ({...prev, [id]: !prev[id]}));

  useEffect(() => {
    if (mode === 'athlete') {
        const initialStates: Record<string, boolean> = {};
        const today = new Date().toISOString().split('T')[0];
        plan.workouts.forEach(w => {
            const isCompleted = history.some(h => h.workoutId === w.id && h.date.split('T')[0] === today);
            const isPast = w.date && w.date < today;
            initialStates[w.id] = !(isCompleted || isPast);
        });
        setExpandedWorkouts(initialStates);
    }
  }, [plan.workouts, history, mode]);

  const handleFinishWorkout = async (workout: Workout) => {
     if(confirm("¿Finalizar entrenamiento?")) {
         const logs = DataEngine.getWorkoutLog(plan.userId, workout.id);
         const session = await DataEngine.archiveWorkout(plan.userId, workout, logs, Date.now());
         setFinishScreen(session);
     }
  };

  if (finishScreen) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-fade-in">
        <Trophy size={64} className="text-yellow-500 mb-4" />
        <h2 className="text-4xl font-display font-black italic text-white uppercase">WORKOUT DONE</h2>
        <button onClick={() => setFinishScreen(null)} className="mt-8 bg-white text-black px-8 py-3 rounded-xl font-bold">VOLVER</button>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between py-4 border-b border-white/5">
        <h2 className="text-xl font-bold text-white flex items-center gap-2"><CalendarDays size={20} className="text-red-500" /> {plan.title}</h2>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        {plan.workouts.map((workout) => (
          <div key={workout.id}>
             <div onClick={() => toggleWorkout(workout.id)} className="flex items-center gap-2 mb-4 cursor-pointer group">
                 <div className="h-px bg-white/10 flex-1"/>
                 <span className="text-xs font-bold text-red-500 uppercase tracking-widest flex items-center gap-2">
                     {workout.date ? formatDayDate(workout.date) : `DÍA ${workout.day}`} • {workout.name}
                     <ChevronRight size={14} className={`transform transition-transform ${expandedWorkouts[workout.id] ? 'rotate-90' : ''}`} />
                 </span>
                 <div className="h-px bg-white/10 flex-1"/>
             </div>

             {expandedWorkouts[workout.id] && (
                 <>
                     {workout.exercises.map((ex, idx) => (
                        <ExerciseCard 
                           key={idx} exercise={ex} index={idx} workoutId={workout.id} userId={plan.userId} 
                           onShowVideo={setShowVideo} mode={mode}
                           onSetComplete={(r: number) => { setCurrentRestTime(r || 60); setShowTimer(true); }}
                        />
                     ))}
                     {mode === 'athlete' && (
                        <button onClick={() => handleFinishWorkout(workout)} className="w-full mt-4 bg-green-600 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2">
                            <CheckCircle2 size={20} /> FINALIZAR SESIÓN
                        </button>
                     )}
                 </>
             )}
          </div>
        ))}
      </div>
      {showTimer && <RestTimer initialSeconds={currentRestTime} onClose={() => setShowTimer(false)} />}
    </div>
  );
};

const ManualPlanBuilder = ({ plan, onSave, onCancel }: any) => {
  const [editedPlan, setEditedPlan] = useState<Plan>(plan);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(0);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleAddWorkout = () => {
    const newWorkout: Workout = { id: generateUUID(), name: `DÍA ${editedPlan.workouts.length + 1}`, day: editedPlan.workouts.length + 1, exercises: [] };
    setEditedPlan({...editedPlan, workouts: [...editedPlan.workouts, newWorkout]});
    setSelectedWorkoutIndex(editedPlan.workouts.length);
  };

  const updateExercise = (exerciseIndex: number, field: keyof WorkoutExercise, value: any) => {
    const updatedWorkouts = [...editedPlan.workouts];
    updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex] = { ...updatedWorkouts[selectedWorkoutIndex].exercises[exerciseIndex], [field]: value };
    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
  };

  const applyTemplate = (template: RoutineTemplate) => {
      setEditedPlan({...editedPlan, workouts: [...editedPlan.workouts, ...template.workouts]});
      setShowTemplates(false);
  };

  return (
    <div className="bg-[#0A0A0C] min-h-screen fixed inset-0 z-50 overflow-y-auto pb-20 flex flex-col">
      <div className="sticky top-0 bg-[#0A0A0C] border-b border-white/10 p-4 flex items-center justify-between z-40">
        <div className="flex items-center gap-3">
            <button onClick={onCancel}><X size={24} className="text-gray-400" /></button>
            <input value={editedPlan.title} onChange={(e) => setEditedPlan({...editedPlan, title: e.target.value})} className="bg-transparent text-xl font-bold text-white outline-none" />
        </div>
        <div className="flex gap-2">
            <button onClick={() => setShowTemplates(true)} className="bg-white/5 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2"><Copy size={16}/> TEMPLATES</button>
            <button onClick={() => onSave(editedPlan)} className="bg-red-600 px-6 py-2 rounded-lg font-bold text-sm">GUARDAR</button>
        </div>
      </div>
      
      <div className="p-4 max-w-4xl mx-auto w-full">
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-6">
          {editedPlan.workouts.map((w, idx) => (
            <button key={w.id} onClick={() => setSelectedWorkoutIndex(idx)} className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap ${selectedWorkoutIndex === idx ? 'bg-white text-black' : 'bg-white/5 text-gray-500'}`}>
                {w.date ? w.date.split('-').slice(1).reverse().join('/') : `DÍA ${w.day}`}
            </button>
          ))}
          <button onClick={handleAddWorkout} className="px-4 py-2 rounded-xl bg-red-600/20 text-red-500 border border-red-500/20 flex items-center gap-2 text-sm font-bold"><Plus size={16}/> AÑADIR</button>
        </div>

        {editedPlan.workouts[selectedWorkoutIndex] && (
            <div className="space-y-6 animate-fade-in">
                <div className="grid md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Nombre de Rutina</label>
                        <input value={editedPlan.workouts[selectedWorkoutIndex].name} onChange={(e) => { const updated = [...editedPlan.workouts]; updated[selectedWorkoutIndex].name = e.target.value; setEditedPlan({...editedPlan, workouts: updated}); }} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none" />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Fecha de Programación</label>
                        <input type="date" value={editedPlan.workouts[selectedWorkoutIndex].date || ''} onChange={(e) => { const updated = [...editedPlan.workouts]; updated[selectedWorkoutIndex].date = e.target.value; setEditedPlan({...editedPlan, workouts: updated}); }} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:border-red-500 outline-none" />
                    </div>
                </div>

                {editedPlan.workouts[selectedWorkoutIndex].exercises.map((ex, idx) => (
                    <div key={idx} className="bg-[#111] border border-white/10 rounded-2xl p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <h4 className="font-bold text-white">{ex.name}</h4>
                            <div className="flex gap-2">
                                <input placeholder="ID Superserie" value={ex.supersetId || ''} onChange={(e) => updateExercise(idx, 'supersetId', e.target.value)} className="bg-black border border-white/5 rounded px-2 py-1 text-[10px] w-24 text-blue-400" />
                                <button onClick={() => { const updated = [...editedPlan.workouts]; updated[selectedWorkoutIndex].exercises.splice(idx, 1); setEditedPlan({...editedPlan, workouts: updated}); }} className="text-red-500"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold">Sets</label><input type="number" value={ex.targetSets} onChange={(e) => updateExercise(idx, 'targetSets', parseInt(e.target.value))} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center" /></div>
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold">Reps</label><input value={ex.targetReps} onChange={(e) => updateExercise(idx, 'targetReps', e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center" /></div>
                            <div className="col-span-2"><label className="text-[10px] text-gray-500 uppercase font-bold">Carga (ej: 50,60,70)</label><input value={ex.targetLoad || ''} onChange={(e) => updateExercise(idx, 'targetLoad', e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center" /></div>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>

      {showTemplates && (
          <div className="fixed inset-0 bg-black/90 z-[100] p-6 flex items-center justify-center">
              <div className="bg-[#1A1A1D] w-full max-w-md rounded-2xl p-6 border border-white/10">
                  <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-white">Templates Guardados</h3><button onClick={() => setShowTemplates(false)}><X/></button></div>
                  <div className="space-y-3">
                      {DataEngine.getTemplates().map(t => (
                          <button key={t.id} onClick={() => applyTemplate(t)} className="w-full p-4 bg-white/5 rounded-xl text-left border border-white/5 hover:border-red-500 transition-colors">
                              <div className="font-bold text-white">{t.title}</div>
                              <div className="text-xs text-gray-500">{t.workouts.length} días incluidos</div>
                          </button>
                      ))}
                      <button onClick={() => DataEngine.saveTemplate({ id: generateUUID(), title: editedPlan.title, workouts: editedPlan.workouts, createdBy: 'coach' })} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold mt-4">GUARDAR ACTUAL COMO TEMPLATE</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
     const init = async () => {
         await DataEngine.init();
         const session = localStorage.getItem(SESSION_KEY);
         if(session) { const u = DataEngine.getUserById(session); if(u) setUser(u); }
         setLoading(false);
     };
     init();
  }, []);

  const logout = () => { localStorage.removeItem(SESSION_KEY); setUser(null); };

  const isAccessExpired = useMemo(() => {
      if (!user || user.role !== 'client' || !user.accessUntil) return false;
      const today = new Date().toISOString().split('T')[0];
      return today > user.accessUntil;
  }, [user]);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-red-500" size={32}/></div>;
  if (!user) return <LoginPage onLogin={(u) => { setUser(u); localStorage.setItem(SESSION_KEY, u.id); }} />;
  if (isAccessExpired) return <AccessLockedScreen onLogout={logout} />;

  return (
    <div className="min-h-screen bg-[#050507] text-gray-200">
        <aside className="fixed left-0 top-0 h-full w-64 bg-[#0F0F11] border-r border-white/5 p-6 hidden md:flex flex-col z-40">
            <BrandingLogo />
            <nav className="flex-1 space-y-2 mt-10">
                <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />
                {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'clients' || view === 'client-detail'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Atletas" />}
                <NavButton active={view === 'workouts'} onClick={() => setView('workouts')} icon={<Dumbbell size={20} />} label="Biblioteca" />
                {user.role === 'admin' && <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<Shield size={20} />} label="Admin" />}
                <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Perfil" />
            </nav>
            <button onClick={logout} className="flex items-center gap-3 text-gray-500 hover:text-white transition-colors px-4 mt-auto mb-6"><LogOut size={20} /> <span className="font-bold text-sm">Salir</span></button>
        </aside>
        
        <div className="md:hidden fixed top-0 left-0 right-0 bg-[#050507]/90 backdrop-blur-xl border-b border-white/5 p-4 z-40 flex justify-between items-center"><BrandingLogo textSize="text-lg" /></div>
        
        <main className="md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen relative">
            {view === 'dashboard' && <DashboardView user={user} onNavigate={setView} />}
            {view === 'clients' && <ClientsView onSelect={(id) => { setSelectedClientId(id); setView('client-detail'); }} user={user} />}
            {view === 'client-detail' && selectedClientId && <ClientDetailView clientId={selectedClientId} onBack={() => setView('clients')} />}
            {view === 'workouts' && <WorkoutsView user={user} />}
            {view === 'profile' && <ProfileView user={user} onLogout={logout} />}
            {view === 'admin' && <AdminView />}
        </main>
        
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0F0F11] border-t border-white/5 px-6 py-2 flex justify-between items-center z-40 pb-safe">
            <MobileNavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />
            {(user.role === 'coach' || user.role === 'admin') && <MobileNavButton active={view === 'clients'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Atletas" />}
            <MobileNavButton active={view === 'workouts'} onClick={() => setView('workouts')} icon={<Dumbbell size={20} />} label="Biblio" />
            <MobileNavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Perfil" />
        </div>
        <ConnectionStatus />
    </div>
  );
}

export default App;
