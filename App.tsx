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
  Instagram, Facebook, Linkedin, Phone
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, SetEntry, WorkoutProgress, SystemConfig, ChatMessage, UserRole } from './types';
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

// --- SYSTEM CONSTANTS & RESCUE ROUTINE ---
const COACH_UUID = 'e9c12345-6789-4321-8888-999999999999';
const ADMIN_UUID = 'a1b2c3d4-0000-0000-0000-admin0000001';
const STORAGE_KEY = 'KINETIX_DATA_PRO_V12_5'; 
const SESSION_KEY = 'KINETIX_SESSION_PRO_V12_5';
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
        chatbot: { enabled: false } // Regla 5: False por defecto
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
      
      // CRITICAL FIX: Ensure Logo fallback if empty string or missing
      let logoUrl = loaded.logoUrl;
      if (!logoUrl || logoUrl.trim() === '') {
          logoUrl = OFFICIAL_LOGO_URL;
      }

      return { 
          ...DEFAULT_CONFIG, 
          ...loaded, 
          logoUrl: logoUrl, // Force valid logo
          ai: { ...DEFAULT_CONFIG.ai, ...loaded.ai } 
      };
  },

  saveConfig: (config: SystemConfig) => {
      const s = DataEngine.getStore();
      s.CONFIG = JSON.stringify(config);
      DataEngine.saveStore(s);
  },

  // --- INITIALIZATION & SYNC ---
  init: async () => {
    const store = DataEngine.getStore();
    let users = store.USERS ? JSON.parse(store.USERS) : [];
    let exercises = store.EXERCISES ? JSON.parse(store.EXERCISES) : [];
    let modified = false;

    // 1. Cargar desde LocalStorage (Instantáneo)
    if (!users.find((u:User) => u.email === 'atleta@kinetix.com')) { users.push({...MOCK_USER, isActive: true}); modified = true; }
    if (!users.find((u:User) => u.email === 'coach@kinetix.com')) {
        users.push({ id: COACH_UUID, name: 'COACH KINETIX', email: 'coach@kinetix.com', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, role: 'coach', daysPerWeek: 6, equipment: [], streak: 999, createdAt: new Date().toISOString(), isActive: true });
        modified = true;
    }
    if (!users.find((u:User) => u.email === 'admin@kinetix.com')) {
        users.push({ id: ADMIN_UUID, name: 'ADMINISTRADOR', email: 'admin@kinetix.com', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, role: 'admin', daysPerWeek: 0, equipment: [], streak: 0, createdAt: new Date().toISOString(), isActive: true });
        modified = true;
    }

    // Fusionar Ejercicios Locales
    const mergedExercises = [...INITIAL_EXERCISES];
    exercises.forEach((se: Exercise) => {
      if (!mergedExercises.find(me => me.id === se.id)) mergedExercises.push(se);
    });
    
    if(modified) {
        store.USERS = JSON.stringify(users);
        store.EXERCISES = JSON.stringify(mergedExercises);
        DataEngine.saveStore(store);
    }

    // 2. STORAGE CLEANUP (Nuevo Feature)
    // Limpieza automática para prevenir localStorage overflow
    const cleanUpLocalStorage = () => {
        try {
            const currentStore = DataEngine.getStore();
            let hasChanges = false;
            // Iterar sobre claves de historial
            Object.keys(currentStore).forEach(key => {
                if (key.startsWith('HISTORY_')) {
                    const history = JSON.parse(currentStore[key]);
                    // MANTENER SOLO LAS ÚLTIMAS 50 SESIONES
                    if (history.length > 50) {
                        const trimmedHistory = history.slice(0, 50);
                        currentStore[key] = JSON.stringify(trimmedHistory);
                        hasChanges = true;
                        console.log(`🧹 KINETIX CLEANUP: Historial purgado para ${key} (Manteniendo 50 recientes)`);
                    }
                }
            });
            if(hasChanges) DataEngine.saveStore(currentStore);
        } catch (e) {
            console.error("Error en Cleanup:", e);
        }
    };
    cleanUpLocalStorage();

    // 3. BACKGROUND SYNC (Optimización de Nube)
    // Intentamos traer datos reales de Supabase sin bloquear la UI
    if (supabaseConnectionStatus.isConfigured) {
        try {
            // Sincronizar Usuarios
            const { data: dbUsers } = await supabase.from('users').select('*');
            if (dbUsers && dbUsers.length > 0) {
                // Mapear DB a estructura local (snake_case a camelCase)
                const mappedUsers = dbUsers.map((u: any) => ({
                    id: u.id, name: u.name, email: u.email, goal: u.goal, level: u.level,
                    role: u.role, daysPerWeek: u.days_per_week, equipment: u.equipment || [],
                    streak: u.streak, createdAt: u.created_at, isActive: true // Asumimos activos si vienen de DB
                }));
                // Fusionar inteligentemente
                const finalUsers = [...users];
                mappedUsers.forEach((mu: User) => {
                    const idx = finalUsers.findIndex(fu => fu.id === mu.id);
                    if (idx >= 0) finalUsers[idx] = mu; else finalUsers.push(mu);
                });
                store.USERS = JSON.stringify(finalUsers);
            }

            // Sincronizar Ejercicios
            const { data: dbExercises } = await supabase.from('exercises').select('*');
            if (dbExercises && dbExercises.length > 0) {
                const mappedEx = dbExercises.map((e: any) => ({
                   id: e.id, name: e.name, muscle_group: e.muscle_group, 
                   video_url: e.video_url, technique: e.technique, commonErrors: e.common_errors || []
                }));
                const finalEx = [...mergedExercises];
                mappedEx.forEach((me: Exercise) => {
                   if (!finalEx.find(fe => fe.id === me.id)) finalEx.push(me);
                });
                store.EXERCISES = JSON.stringify(finalEx);
            }
            DataEngine.saveStore(store);
        } catch (e) {
            console.warn("Modo Offline: No se pudo sincronizar con Supabase", e);
        }
    }
  },
  
  getUsers: (): User[] => {
    const s = DataEngine.getStore();
    return s.USERS ? JSON.parse(s.USERS) : [];
  },
  getUserById: (id: string): User | undefined => DataEngine.getUsers().find(u => u.id === id),
  getUserByNameOrEmail: (query: string): User | undefined => {
    const users = DataEngine.getUsers();
    const q = query.toLowerCase().trim();
    return users.find(u => u.email.toLowerCase() === q || u.name.toLowerCase() === q);
  },
  
  getExercises: (): Exercise[] => {
    const s = DataEngine.getStore();
    return s.EXERCISES ? JSON.parse(s.EXERCISES) : INITIAL_EXERCISES;
  },

  addExercise: async (exercise: Exercise) => {
    const s = DataEngine.getStore();
    const current = s.EXERCISES ? JSON.parse(s.EXERCISES) : [];
    current.push(exercise);
    s.EXERCISES = JSON.stringify(current);
    DataEngine.saveStore(s);

    // Cloud Sync
    if (supabaseConnectionStatus.isConfigured) {
        await supabase.from('exercises').upsert({
            id: exercise.id, name: exercise.name, muscle_group: exercise.muscleGroup,
            video_url: exercise.videoUrl, technique: exercise.technique
        });
    }
  },

  getPlan: (uid: string): Plan | null => {
    const s = DataEngine.getStore();
    const p = s[`PLAN_${uid}`];
    return p ? JSON.parse(p) : null;
  },
  
  savePlan: async (plan: Plan) => {
    // 1. Guardado Local (Inmediato)
    const s = DataEngine.getStore();
    s[`PLAN_${plan.userId}`] = JSON.stringify(plan);
    DataEngine.saveStore(s);

    // 2. Cloud Sync (Fondo)
    if (supabaseConnectionStatus.isConfigured) {
        // Guardamos el plan maestro
        const { data: planData, error } = await supabase.from('plans').upsert({
            id: plan.id, title: plan.title, user_id: plan.userId, updated_at: new Date().toISOString()
        }).select();

        if (!error && planData) {
            // Nota: La sincronización completa de ejercicios del plan es compleja. 
            // Para V12.5 guardamos la estructura relacional básica o JSON si la tabla lo permitiera.
            // Por ahora, priorizamos que el plan EXISTA en la BD.
        }
    }
  },

  saveUser: async (user: User) => {
    // 1. Local
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    s.USERS = JSON.stringify(users);
    DataEngine.saveStore(s);

    // 2. Cloud Sync (Vital para no perder usuarios)
    if (supabaseConnectionStatus.isConfigured) {
        await supabase.from('users').upsert({
            id: user.id, name: user.name, email: user.email, goal: user.goal,
            level: user.level, role: user.role, days_per_week: user.daysPerWeek,
            equipment: user.equipment, streak: user.streak
        });
    }
  },

  deleteUser: async (userId: string) => {
    const s = DataEngine.getStore();
    let users = JSON.parse(s.USERS || '[]');
    users = users.filter((u: User) => u.id !== userId);
    s.USERS = JSON.stringify(users);
    delete s[`PLAN_${userId}`];
    DataEngine.saveStore(s);

    if (supabaseConnectionStatus.isConfigured) {
        await supabase.from('users').delete().eq('id', userId);
    }
  },

  saveSetLog: (userId: string, workoutId: string, exerciseIndex: number, setEntry: SetEntry) => {
    // Solo local para rendimiento (Optimización Sports Science)
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
    // 1. Procesamiento Local
    const s = DataEngine.getStore();
    const historyKey = `HISTORY_${userId}`;
    const currentHistory = s[historyKey] ? JSON.parse(s[historyKey]) : [];
    const endTime = Date.now();
    const durationMinutes = Math.floor((endTime - startTime) / 60000);
    let totalVolume = 0;
    let prCount = 0;
    
    // Cálculo de volumen para análisis - SANITIZADO PARA EVITAR NaN
    Object.values(logs).flat().forEach(entry => { 
        if(entry.completed) {
            const weight = parseFloat(entry.weight) || 0;
            const reps = parseFloat(entry.reps) || 0;
            totalVolume += weight * reps;
        }
    });

    const session = {
      id: generateUUID(), workoutName: workout.name, workoutId: workout.id, date: new Date().toISOString(), logs: logs,
      summary: { exercisesCompleted: Object.keys(logs).length, totalVolume, durationMinutes, prCount }
    };
    
    currentHistory.unshift(session); 
    s[historyKey] = JSON.stringify(currentHistory);
    delete s[`LOG_TEMP_${userId}_${workout.id}`]; 
    
    // Update streak
    const users = JSON.parse(s.USERS || '[]');
    const uIdx = users.findIndex((u:User) => u.id === userId);
    if(uIdx >= 0) { users[uIdx].streak += 1; s.USERS = JSON.stringify(users); }
    DataEngine.saveStore(s);

    // 2. CLOUD ARCHIVING (CRÍTICO: NO PERDER HISTORIAL)
    if (supabaseConnectionStatus.isConfigured) {
        try {
            const { data: logData, error: logError } = await supabase.from('workout_logs').insert({
                user_id: userId,
                workout_id: workout.id, 
                date: new Date().toISOString()
            }).select().single();

            if (!logError && logData) {
                const setsToInsert: any[] = [];
                Object.keys(logs).forEach(exIdx => {
                    const exerciseId = workout.exercises[parseInt(exIdx)]?.exerciseId;
                    if (!exerciseId) return;

                    logs[parseInt(exIdx)].forEach(entry => {
                        if (entry.completed) {
                            setsToInsert.push({
                                log_id: logData.id,
                                exercise_id: exerciseId,
                                weight: parseFloat(entry.weight) || 0,
                                reps: parseInt(entry.reps) || 0,
                                done: true
                            });
                        }
                    });
                });

                if (setsToInsert.length > 0) {
                    await supabase.from('set_logs').insert(setsToInsert);
                }
            }
            await supabase.from('users').update({ streak: users[uIdx].streak }).eq('id', userId);

        } catch (e) {
            console.error("Error archivando en nube:", e);
        }
    }

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
    const [imgError, setImgError] = useState(false);

    useEffect(() => {
        const update = () => {
            setConfig(DataEngine.getConfig());
            setImgError(false);
        };
        window.addEventListener('storage-update', update);
        return () => window.removeEventListener('storage-update', update);
    }, []);

    const displayUrl = (!config.logoUrl || config.logoUrl === '') ? OFFICIAL_LOGO_URL : config.logoUrl;

    return (
        <div className="flex items-center gap-2.5 select-none group">
            {!imgError ? (
                <img 
                    src={displayUrl} 
                    alt="Logo" 
                    className={`${className} object-cover rounded-xl shadow-lg shadow-red-900/20 bg-[#0F0F11] border border-white/5 transition-transform group-hover:scale-105`}
                    onError={() => {
                        console.error("Error loading logo, reverting to default");
                        setImgError(true);
                    }}
                />
            ) : (
                <img 
                    src={OFFICIAL_LOGO_URL} 
                    alt="Logo Backup" 
                    className={`${className} object-cover rounded-xl shadow-lg shadow-red-900/20 bg-[#0F0F11] border border-white/5 transition-transform group-hover:scale-105`}
                />
            )}
            {showText && (
                <span className={`font-display font-black italic tracking-tighter ${textSize} text-white drop-shadow-md`}>
                    {config.appName.toUpperCase()}
                </span>
            )}
        </div>
    );
}

// --- SOCIAL MEDIA BAR ---
const SocialLinks = ({ className = "" }: { className?: string }) => {
    return (
        <div className={`flex gap-3 justify-center ${className}`}>
            <a href="https://www.instagram.com/kinetix.zone/" target="_blank" rel="noreferrer" className="p-2 bg-white/5 hover:bg-gradient-to-tr hover:from-purple-600 hover:to-pink-500 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-110">
                <Instagram size={18} />
            </a>
            <a href="https://www.facebook.com/people/Kinetix-Functional-Zone/61577641223744/" target="_blank" rel="noreferrer" className="p-2 bg-white/5 hover:bg-blue-600 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-110">
                <Facebook size={18} />
            </a>
            <a href="https://wa.me/525627303189" target="_blank" rel="noreferrer" className="p-2 bg-white/5 hover:bg-green-500 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-110">
                <MessageCircle size={18} />
            </a>
        </div>
    );
}

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
  const changeTime = (seconds: number) => { setTimeLeft(seconds); setTotalTime(seconds); setIsActive(true); };
  const adjustTime = (amount: number) => { setTimeLeft(prev => Math.max(0, prev + amount)); };
  const formatTime = (seconds: number) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${s < 10 ? '0' : ''}${s}`; };
  return (
    <div className="fixed bottom-24 right-4 md:right-8 bg-[#1A1A1D] border border-red-500/50 text-white p-4 rounded-2xl shadow-2xl z-50 flex flex-col gap-3 animate-fade-in-up w-[280px]">
      <div className="flex items-center gap-4">
        <div className="relative shrink-0"><svg className="w-12 h-12 transform -rotate-90"><circle cx="24" cy="24" r="20" stroke="#333" strokeWidth="4" fill="transparent" /><circle cx="24" cy="24" r="20" stroke="#EF4444" strokeWidth="4" fill="transparent" strokeDasharray={125} strokeDashoffset={125 - (125 * timeLeft) / (totalTime || 1)} className="transition-all duration-1000 ease-linear" /></svg><div className="absolute top-0 left-0 w-full h-full flex items-center justify-center font-mono font-bold text-sm">{formatTime(timeLeft)}</div></div>
        <div className="flex-1"><p className="text-xs text-gray-400 font-bold uppercase mb-1">Descanso</p><div className="flex gap-2"><button onClick={() => adjustTime(30)} className="px-2 py-1 bg-white/10 rounded text-xs font-bold hover:bg-white/20">+30s</button><button onClick={() => setIsActive(!isActive)} className="px-2 py-1 bg-white/10 rounded text-xs font-bold hover:bg-white/20">{isActive ? 'Pausa' : 'Seguir'}</button></div></div>
        <button onClick={onClose} className="text-gray-500 hover:text-white self-start"><X size={16}/></button>
      </div>
      <div className="grid grid-cols-4 gap-2 border-t border-white/5 pt-2">{[30, 60, 90, 120].map(sec => (<button key={sec} onClick={() => changeTime(sec)} className={`text-[10px] font-bold py-1 rounded hover:bg-white/10 ${totalTime === sec ? 'text-red-500 bg-red-500/10' : 'text-gray-500'}`}>{sec}s</button>))}</div>
    </div>
  );
};

const ConnectionStatus = () => { const [isOnline, setIsOnline] = useState(supabaseConnectionStatus.isConfigured); return (<div className={`fixed bottom-4 left-4 z-50 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 backdrop-blur-md border ${isOnline ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>{isOnline ? <Cloud size={10} /> : <CloudOff size={10} />}<span>{isOnline ? 'ONLINE' : 'LOCAL'}</span></div>); };
const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (<button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${active ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>{icon}<span>{label}</span></button>);
const MobileNavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (<button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-colors ${active ? 'text-red-500' : 'text-gray-500'}`}><div className={`p-1 rounded-lg ${active ? 'bg-red-500/10' : ''}`}>{icon}</div><span className="text-[10px] font-bold">{label}</span></button>);
const StatCard = ({ label, value, icon }: { label: string, value: string | number, icon: React.ReactNode }) => (<div className="bg-[#0F0F11] border border-white/5 p-4 rounded-2xl flex flex-col justify-between hover:border-white/10 transition-colors"><div className="flex justify-between items-start mb-2"><span className="text-xs text-gray-500 font-bold uppercase">{label}</span>{icon}</div><span className="text-2xl font-bold font-display truncate">{value}</span></div>);
const PlateCalculator = ({ targetWeight, onClose }: { targetWeight: number, onClose: () => void }) => {
  const barWeight = 20; const plates = [20, 15, 10, 5, 2.5];
  const calculatePlates = () => { let weightPerSide = (targetWeight - barWeight) / 2; if (weightPerSide <= 0) return []; const result: number[] = []; plates.forEach(plate => { while (weightPerSide >= plate) { result.push(plate); weightPerSide -= plate; } }); return result; };
  const calculated = calculatePlates();
  return (
    <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}><div className="bg-[#1A1A1D] border border-white/10 rounded-2xl p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}><h3 className="text-xl font-bold text-white mb-2">Calculadora de Discos</h3><p className="text-gray-400 text-sm mb-6">Para {targetWeight}kg (Barra 20kg)</p><div className="flex items-center justify-center gap-1 mb-8"><div className="h-4 w-10 bg-gray-500 rounded-sm"></div> {calculated.length === 0 ? <span className="text-xs text-gray-600">Solo Barra</span> : calculated.map((plate, idx) => (<div key={idx} className={`h-12 w-3 rounded-sm border border-black/50 ${plate === 20 ? 'bg-blue-600 h-16' : plate === 15 ? 'bg-yellow-500 h-14' : plate === 10 ? 'bg-green-600 h-12' : plate === 5 ? 'bg-white h-10' : 'bg-red-500 h-8'}`} title={`${plate}kg`}></div>))}<div className="h-4 w-4 bg-gray-500 rounded-sm"></div> </div><div className="grid grid-cols-2 gap-2 text-left bg-black/20 p-4 rounded-xl"><span className="text-xs text-gray-500 uppercase font-bold">Por lado:</span><div className="flex flex-wrap gap-1">{calculated.map((p, i) => <span key={i} className="text-xs font-bold text-white bg-white/10 px-1.5 rounded">{p}</span>)}</div></div><button onClick={onClose} className="mt-6 w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl font-bold text-sm transition-colors">Cerrar</button></div></div>
  );
};

// --- USER INVITE MODAL (New Component) ---
const UserInviteModal = ({ currentUser, onClose, onInviteSuccess }: { currentUser: User, onClose: () => void, onInviteSuccess: () => void }) => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<UserRole>('client');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Filter roles based on current user (Rules: Admin -> Coach/Client, Coach -> Client)
    const availableRoles = useMemo(() => {
        if (currentUser.role === 'admin') return ['client', 'coach'];
        return ['client'];
    }, [currentUser.role]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // 1. Validation: Check if exists
        const existing = DataEngine.getUserByNameOrEmail(email);
        if (existing) {
            setError('El correo ya está registrado.');
            setLoading(false);
            return;
        }

        // 2. Create User Object
        const newUser: User = {
            id: generateUUID(),
            name: name.toUpperCase(),
            email: email.toLowerCase(),
            goal: Goal.PERFORMANCE,
            level: UserLevel.ADVANCED,
            role: role,
            daysPerWeek: 3,
            equipment: [],
            streak: 0,
            createdAt: new Date().toISOString(),
            isActive: true, // Created active so they can login immediately in this demo
            coachId: currentUser.role === 'coach' ? currentUser.id : undefined // Auto-assign if Coach
        };

        // 3. Save
        await DataEngine.saveUser(newUser);
        
        // 4. Feedback
        alert(`Usuario dado de alta: ${email}.\nYa puede acceder con este correo.`);
        onInviteSuccess();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[90] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-[#1A1A1D] w-full max-w-md rounded-2xl p-6 border border-white/10 relative" onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={20} /></button>
                
                <h3 className="text-xl font-bold text-white mb-1">Dar de Alta Usuario</h3>
                <p className="text-xs text-gray-500 mb-6">Acceso inmediato mediante correo electrónico.</p>

                <form onSubmit={handleInvite} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nombre Completo</label>
                        <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" placeholder="EJ: JUAN PÉREZ" />
                    </div>
                    
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Correo Electrónico</label>
                        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" placeholder="usuario@email.com" />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Rol Asignado</label>
                        <select 
                            value={role} 
                            onChange={e => setRole(e.target.value as UserRole)}
                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none"
                            disabled={availableRoles.length === 1}
                        >
                            {availableRoles.map(r => (
                                <option key={r} value={r}>{r === 'client' ? 'Atleta' : 'Coach'}</option>
                            ))}
                        </select>
                        {currentUser.role === 'coach' && <p className="text-[10px] text-gray-500 mt-2 italic">* El atleta será asignado automáticamente a ti.</p>}
                    </div>

                    {error && <div className="text-red-500 text-xs font-bold bg-red-500/10 p-3 rounded-lg flex items-center gap-2"><AlertTriangle size={12}/> {error}</div>}

                    <div className="pt-4">
                        <button type="submit" disabled={loading} className="w-full py-3 bg-white text-black rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                            {loading ? <Loader2 className="animate-spin" size={16} /> : <UserPlus size={16} />}
                            DAR DE ALTA
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- STEPPER CONTROL (New Feature) ---
const StepperControl = ({ value, onChange, step, type, placeholder, highlight }: { value: string, onChange: (v: string) => void, step: number, type: 'weight' | 'reps', placeholder?: string, highlight?: boolean }) => {
    const handleAdjust = (delta: number) => {
        const current = parseFloat(value) || parseFloat(placeholder || '0') || 0;
        const next = Math.max(0, current + delta);
        // Si es peso y tiene decimales, mantenerlos. Si es entero, mantener entero.
        const formatted = type === 'weight' && next % 1 !== 0 ? next.toFixed(1) : next.toString();
        onChange(formatted);
    };

    return (
        <div className={`flex items-stretch h-9 bg-[#1A1A1D] rounded-md border transition-all overflow-hidden ${highlight ? 'border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'border-white/10'}`}>
            <button 
                onClick={() => handleAdjust(-step)} 
                className="w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 active:bg-white/20 text-gray-400 border-r border-white/5"
            >
                <Minus size={14} />
            </button>
            <input 
                type="text" 
                inputMode="decimal"
                placeholder={placeholder || "-"}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className={`flex-1 min-w-0 bg-transparent text-center text-xs font-bold outline-none placeholder-gray-700 ${highlight ? 'text-yellow-400' : 'text-white'}`}
            />
            <button 
                onClick={() => handleAdjust(step)} 
                className="w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 active:bg-white/20 text-gray-400 border-l border-white/5"
            >
                <Plus size={14} />
            </button>
        </div>
    );
};

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  index: number;
  workoutId: string;
  userId: string;
  onShowVideo: (name: string) => void;
  mode: 'coach' | 'athlete';
  onSetComplete: (rest?: number) => void;
  history: any[];
}

// --- EXERCISE CARD (UPDATED WITH STEPPERS & HAPTIC FEEDBACK) ---
// Optimization: React.memo to prevent unnecessary re-renders of the list
const ExerciseCard: React.FC<ExerciseCardProps> = memo(({ 
  exercise, index, workoutId, userId, onShowVideo, mode, onSetComplete, history
}) => {
  const [logs, setLogs] = useState<WorkoutProgress>({});
  const [showPlateCalc, setShowPlateCalc] = useState<number | null>(null);

  const lastSessionData = useMemo(() => {
      if(!history || history.length === 0) return null;
      for(const session of history) {
          for(const logKey in session.logs) {
              const sessionLogs = session.logs[logKey];
              if(parseInt(logKey) === index && sessionLogs.length > 0) return sessionLogs[sessionLogs.length-1];
          }
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
    
    if (isCompleted) {
        // Feature: Haptic Feedback
        if (navigator.vibrate) navigator.vibrate(50);
        onSetComplete(exercise.targetRest);
    }
  };

  const setsArray = Array.from({ length: exercise.targetSets }, (_, i) => i + 1);
  const exerciseLogs = logs[index] || [];

  return (
    <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-5 mb-4 shadow-md hover:border-white/10 transition-all relative">
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
                    <span className="text-xs font-bold text-yellow-500 uppercase tracking-wide">Meta: {exercise.targetLoad}kg</span>
                </div>
                )}
                {lastSessionData && (
                    <div className="inline-flex items-center gap-1.5 bg-gray-800 px-2 py-1 rounded-md border border-white/5">
                        <History size={12} className="text-gray-400" />
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Prev: {lastSessionData.weight}kg x {lastSessionData.reps}</span>
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
           <div className="grid grid-cols-12 gap-2 text-[10px] text-gray-500 uppercase font-bold text-center mb-1 min-w-[320px]">
              <div className="col-span-1">#</div>
              <div className="col-span-4">Kg</div>
              <div className="col-span-4">Reps</div>
              {/* RPE removido visualmente para dar espacio a steppers, o reducido */}
              {/*<div className="col-span-2">RPE</div>*/}
              <div className="col-span-3">Done</div>
           </div>
           {setsArray.map(setNum => {
             const log = exerciseLogs.find(l => l.setNumber === setNum);
             const isDone = log?.completed;
             
             // Gold Mode Logic
             const isPR = lastSessionData && log?.weight && parseFloat(log.weight) > parseFloat(lastSessionData.weight);
             // Ego Lifting Check (Alert if weight > 20% of target)
             const targetWeight = exercise.targetLoad ? parseFloat(exercise.targetLoad) : 0;
             const currentWeight = log?.weight ? parseFloat(log.weight) : 0;
             const isEgoLifting = targetWeight > 0 && currentWeight > targetWeight * 1.2;

             return (
               <div key={setNum} className={`grid grid-cols-12 gap-2 items-center transition-all min-w-[320px] ${isDone ? 'opacity-50' : 'opacity-100'}`}>
                 <div className="col-span-1 flex justify-center">
                    <span className="w-5 h-5 rounded-full bg-white/5 flex items-center justify-center text-[10px] font-bold text-gray-400">{setNum}</span>
                 </div>
                 <div className="col-span-4 relative">
                    <StepperControl 
                        type="weight"
                        step={2.5}
                        value={log?.weight || ''}
                        placeholder={exercise.targetLoad || "-"}
                        onChange={(val) => handleLogSet(setNum, val, log?.reps || exercise.targetReps, log?.rpe?.toString() || '', !!isDone)}
                        highlight={!!isPR}
                    />
                    {isEgoLifting && <AlertTriangle size={12} className="text-red-500 absolute -right-2 top-0 animate-pulse" title="Cuidado: Peso excesivo" />}
                    {/* Botón calculadora más discreto */}
                    <button onClick={() => setShowPlateCalc(parseFloat(log?.weight || exercise.targetLoad || '0'))} className="absolute -top-2 right-1/2 translate-x-1/2 opacity-0 hover:opacity-100 p-0.5 bg-black/80 rounded text-[8px] text-gray-400">
                        calc
                    </button>
                 </div>
                 <div className="col-span-4">
                    <StepperControl 
                        type="reps"
                        step={1}
                        value={log?.reps || ''}
                        placeholder={exercise.targetReps}
                        onChange={(val) => handleLogSet(setNum, log?.weight || '', val, log?.rpe?.toString() || '', !!isDone)}
                    />
                 </div>
                 <div className="col-span-3 flex justify-center">
                    <button 
                      onClick={() => handleLogSet(setNum, log?.weight || '', log?.reps || exercise.targetReps, log?.rpe?.toString() || '', !isDone)}
                      className={`w-full h-9 rounded-md flex items-center justify-center transition-all border ${isDone ? 'bg-green-500 border-green-500 text-black shadow-[0_0_10px_rgba(34,197,94,0.4)] animate-flash' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
                    >
                      {isDone ? <Check size={16} strokeWidth={4} /> : <Circle size={16} />}
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
});

// ... (Chatbot & PlanViewer & ManualPlanBuilder & WorkoutsView remain unchanged) ...
const TechnicalChatbot = ({ onClose }: { onClose: () => void }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([{role: 'ai', text: 'Soy tu asistente técnico. ¿Dudas con algún ejercicio?', timestamp: Date.now()}]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const handleSend = async () => {
        if(!input.trim()) return;
        const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        try {
            const advice = await getTechnicalAdvice(userMsg.text, DataEngine.getExercises());
            const aiMsg: ChatMessage = { role: 'ai', text: advice || 'Lo siento, no pude procesar eso.', timestamp: Date.now() };
            setMessages(prev => [...prev, aiMsg]);
        } catch (e) {
            setMessages(prev => [...prev, {role: 'ai', text: 'Error de conexión con Kinetix AI.', timestamp: Date.now()}]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

    return (
        <div className="fixed bottom-24 right-4 md:right-8 bg-[#1A1A1D] border border-white/20 w-[320px] h-[450px] rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-fade-in-up">
            <div className="bg-[#0F0F11] p-4 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2"><Sparkles size={16} className="text-blue-500"/> <span className="font-bold text-white text-sm">Kinetix Assistant</span></div>
                <button onClick={onClose}><X size={16} className="text-gray-400"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20">
                {messages.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-red-600 text-white' : 'bg-[#2A2A2D] text-gray-200'}`}>
                            {m.text}
                        </div>
                    </div>
                ))}
                {loading && <div className="text-xs text-gray-500 animate-pulse">Escribiendo...</div>}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-3 bg-[#0F0F11] border-t border-white/10 flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="Pregunta algo..." className="flex-1 bg-white/5 rounded-full px-3 py-2 text-xs text-white outline-none focus:bg-white/10" />
                <button onClick={handleSend} className="p-2 bg-blue-600 rounded-full text-white hover:bg-blue-500"><Send size={14}/></button>
            </div>
        </div>
    );
}

const PlanViewer = ({ plan, mode = 'coach' }: { plan: Plan, mode?: 'coach' | 'athlete' }) => {
  const [showVideo, setShowVideo] = useState<string | null>(null);
  const [showTimer, setShowTimer] = useState(false);
  const [currentRestTime, setCurrentRestTime] = useState(60);
  const [finishScreen, setFinishScreen] = useState<any | null>(null);
  const [activeRescue, setActiveRescue] = useState<string | null>(null);
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
     if(confirm("¿Has completado tu sesión? Esto la guardará en el historial.")) {
         const logs = DataEngine.getWorkoutLog(plan.userId, workout.id);
         const session = DataEngine.archiveWorkout(plan.userId, workout, logs, startTime.current);
         // FIX: Scroll to top immediately to prevent "black screen" glitch
         window.scrollTo({ top: 0, behavior: 'smooth' });
         setFinishScreen(session);
         setTimeout(() => window.dispatchEvent(new Event('storage-update')), 500);
     }
  };

  const handleClassAttendance = (workout: Workout, attended: boolean) => {
      if (attended) {
          if(confirm("¿Confirmar asistencia a clase?")) {
              DataEngine.archiveWorkout(plan.userId, workout, { 0: [{ setNumber: 1, weight: '0', reps: '1', completed: true, timestamp: Date.now() }] }, Date.now());
              window.scrollTo({ top: 0, behavior: 'smooth' }); // FIX: Scroll to top
              setFinishScreen({ summary: { exercisesCompleted: 1, totalVolume: 0, durationMinutes: 60, prCount: 0 }});
          }
      } else {
          setActiveRescue(workout.id);
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
             
             {workout.isClass && !activeRescue && (
                 <div className="bg-gradient-to-br from-[#1A1A1D] to-[#000] border border-red-500/30 rounded-2xl p-6 text-center relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"/>
                     <div className="relative z-10">
                         <div className="w-16 h-16 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500 animate-pulse-subtle">
                             <MapPin size={32} />
                         </div>
                         <h3 className="text-2xl font-bold font-display italic text-white uppercase">{workout.classType || 'CLASE PRESENCIAL'}</h3>
                         <p className="text-gray-400 text-sm mt-2 mb-6">Asistencia requerida en Kinetix Zone.</p>
                         
                         {mode === 'athlete' ? (
                             <div className="grid grid-cols-2 gap-3">
                                 <button onClick={() => handleClassAttendance(workout, true)} className="py-3 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-black flex items-center justify-center gap-2 transition-all"><CheckCircle2 size={18}/> ASISTÍ</button>
                                 <button onClick={() => handleClassAttendance(workout, false)} className="py-3 bg-white/10 hover:bg-white/20 rounded-xl font-bold text-gray-300 flex items-center justify-center gap-2 transition-all"><X size={18}/> NO PUDE IR</button>
                             </div>
                         ) : (
                             <div className="text-xs text-gray-500 font-bold uppercase border border-white/10 rounded-lg p-2">Vista de Coach: El atleta confirmará su asistencia.</div>
                         )}
                     </div>
                 </div>
             )}

             {activeRescue === workout.id && (
                 <div className="mb-4 bg-blue-900/10 border border-blue-500/30 p-4 rounded-xl flex items-start gap-3">
                     <ShieldAlert className="text-blue-400 shrink-0 mt-1" size={20} />
                     <div>
                         <h4 className="font-bold text-blue-400 text-sm">ACTIVANDO PROTOCOLO DE RESCATE</h4>
                         <p className="text-xs text-gray-400 mt-1">No te preocupes por faltar a clase. Completa esta rutina metabólica en casa para mantener tu progreso.</p>
                     </div>
                 </div>
             )}

             {(!workout.isClass || activeRescue === workout.id) && (
                 (activeRescue === workout.id ? RESCUE_WORKOUT : workout.exercises).map((ex, idx) => (
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
                 ))
             )}
             
             {mode === 'athlete' && (!workout.isClass || activeRescue === workout.id) && (
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

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showChat, setShowChat] = useState(false);
  const [config] = useState(DataEngine.getConfig());

  useEffect(() => {
    const init = async () => {
        await DataEngine.init();
        const users = DataEngine.getUsers();
        // Use the first user or create one if none exists (fallback to mock)
        const currentUser = users.length > 0 ? users[0] : MOCK_USER;
        
        // Ensure the mock user is saved if we are falling back to it
        if (users.length === 0) {
            await DataEngine.saveUser(MOCK_USER);
        }
        
        setUser(currentUser);
        setLoading(false);
    };
    init();
  }, []);

  if (loading) {
    return (
        <div className="min-h-screen bg-[#050507] flex items-center justify-center">
            <Loader2 className="animate-spin text-red-600" size={32} />
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050507] text-gray-200 font-sans pb-24 selection:bg-red-500/30">
        <header className="sticky top-0 z-40 bg-[#050507]/80 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex justify-between items-center">
            <BrandingLogo />
            {user && (
                <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <div className="text-sm font-bold text-white">{user.name}</div>
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider">{user.role}</div>
                    </div>
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center font-bold text-white text-sm shadow-lg shadow-red-900/20 border border-red-500/20">
                        {user.name.charAt(0)}
                    </div>
                </div>
            )}
        </header>

        <main className="max-w-5xl mx-auto p-4 space-y-6">
            {user && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        <StatCard label="Nivel" value={user.level} icon={<TrendingUp size={16} className="text-blue-500"/>} />
                        <StatCard label="Meta" value={user.goal} icon={<Trophy size={16} className="text-yellow-500"/>} />
                        <StatCard label="Racha" value={`${user.streak} 🔥`} icon={<Activity size={16} className="text-orange-500"/>} />
                        <StatCard label="Estado" value="ACTIVO" icon={<CheckCircle2 size={16} className="text-green-500"/>} />
                    </div>

                    {(() => {
                        const plan = DataEngine.getPlan(user.id);
                        if (plan) {
                            return <PlanViewer plan={plan} mode={user.role === 'coach' ? 'coach' : 'athlete'} />;
                        }
                        return (
                             <div className="flex flex-col items-center justify-center py-16 bg-[#0F0F11] rounded-3xl border border-white/5 border-dashed text-center px-4">
                                 <Dumbbell className="text-gray-700 mb-4" size={48} />
                                 <h3 className="text-xl font-bold text-white">Sin Plan Asignado</h3>
                                 <p className="text-gray-500 mt-2 max-w-xs text-sm">No tienes un plan activo para esta semana.</p>
                                 <button 
                                    onClick={async () => {
                                        // Quick Generate Demo Plan
                                        try {
                                            setLoading(true);
                                            // Fallback plan if AI fails or just for demo
                                            const demoPlan: Plan = {
                                                id: generateUUID(),
                                                userId: user.id,
                                                title: "Protocolo de Iniciación",
                                                updatedAt: new Date().toISOString(),
                                                workouts: [
                                                    {
                                                        id: generateUUID(), name: "Full Body A", day: 1, 
                                                        exercises: [
                                                            { exerciseId: 'pec1', name: 'Press horizontal', targetSets: 3, targetReps: '12', targetRest: 60, coachCue: 'Controla la bajada.' },
                                                            { exerciseId: 'cua1', name: 'Sentadilla', targetSets: 3, targetReps: '12', targetRest: 90, coachCue: 'Profundidad.' },
                                                        ]
                                                    }
                                                ]
                                            };
                                            await DataEngine.savePlan(demoPlan);
                                            window.location.reload();
                                        } catch (e) {
                                            setLoading(false);
                                        }
                                    }}
                                    className="mt-6 px-6 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm font-bold transition-colors"
                                 >
                                    Generar Demo
                                 </button>
                             </div>
                        );
                    })()}
                </>
            )}
        </main>

        <ConnectionStatus />
        <SocialLinks className="fixed bottom-6 left-6 hidden lg:flex" />

        <button 
            onClick={() => setShowChat(!showChat)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-red-600 rounded-full flex items-center justify-center text-white shadow-xl shadow-red-900/30 hover:bg-red-500 transition-all hover:scale-105 active:scale-95"
        >
            {showChat ? <X size={24} /> : <MessageSquare size={24} fill="currentColor" />}
        </button>

        {showChat && <TechnicalChatbot onClose={() => setShowChat(false)} />}
    </div>
  );
};

export default App;