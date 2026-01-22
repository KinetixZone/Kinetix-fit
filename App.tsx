
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
    
    // Cálculo de volumen para análisis
    Object.values(logs).flat().forEach(entry => { 
        if(entry.completed) totalVolume += (parseFloat(entry.weight) || 0) * (parseFloat(entry.reps) || 0); 
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
    // Aquí es donde aseguramos que la data sobreviva
    if (supabaseConnectionStatus.isConfigured) {
        try {
            // A. Guardar el Log General
            const { data: logData, error: logError } = await supabase.from('workout_logs').insert({
                user_id: userId,
                workout_id: workout.id, // Nota: Asume que el ID del workout existe o es UUID válido
                date: new Date().toISOString()
            }).select().single();

            if (!logError && logData) {
                // B. Guardar los Sets individuales (Batch Insert para eficiencia)
                const setsToInsert: any[] = [];
                Object.keys(logs).forEach(exIdx => {
                    const exerciseId = workout.exercises[parseInt(exIdx)]?.exerciseId;
                    // Solo guardamos si tenemos el ID del ejercicio
                    if (!exerciseId) return;

                    logs[parseInt(exIdx)].forEach(entry => {
                        if (entry.completed) {
                            setsToInsert.push({
                                log_id: logData.id,
                                exercise_id: exerciseId, // Debe coincidir con ID en tabla exercises
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
            // Update user streak in cloud
            await supabase.from('users').update({ streak: users[uIdx].streak }).eq('id', userId);

        } catch (e) {
            console.error("Error archivando en nube:", e);
            // No lanzamos error para no interrumpir la experiencia del usuario,
            // la data ya está guardada localmente.
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

    // Force default if config is broken
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
            {/* WhatsApp Placeholder: Add real number here if needed e.g. https://wa.me/521234567890 */}
            <a href="https://wa.me/" target="_blank" rel="noreferrer" className="p-2 bg-white/5 hover:bg-green-500 rounded-xl text-gray-400 hover:text-white transition-all transform hover:scale-110">
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
const ExerciseCard: React.FC<ExerciseCardProps> = ({ 
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
};

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
         setFinishScreen(session);
         setTimeout(() => window.dispatchEvent(new Event('storage-update')), 500);
     }
  };

  const handleClassAttendance = (workout: Workout, attended: boolean) => {
      if (attended) {
          if(confirm("¿Confirmar asistencia a clase?")) {
              DataEngine.archiveWorkout(plan.userId, workout, { 0: [{ setNumber: 1, weight: '0', reps: '1', completed: true, timestamp: Date.now() }] }, Date.now());
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

const ManualPlanBuilder = ({ plan, onSave, onCancel }: { plan: Plan, onSave: (p: Plan) => void, onCancel: () => void }) => {
  const [editedPlan, setEditedPlan] = useState<Plan>(plan);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState<number>(0);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Todos');

  const allExercises = useMemo(() => DataEngine.getExercises(), []);
  const categories = useMemo(() => ['Todos', ...Array.from(new Set(allExercises.map(e => e.muscleGroup)))], [allExercises]);

  const handleAddWorkout = () => {
    const newWorkout: Workout = { id: generateUUID(), name: `DÍA ${editedPlan.workouts.length + 1}`, day: editedPlan.workouts.length + 1, exercises: [] };
    setEditedPlan({...editedPlan, workouts: [...editedPlan.workouts, newWorkout]});
    setSelectedWorkoutIndex(editedPlan.workouts.length);
  };

  const handleAddExercise = (exercise: Exercise) => {
    const newExercise: WorkoutExercise = { exerciseId: exercise.id, name: exercise.name, targetSets: 4, targetReps: '10-12', targetLoad: '', targetRest: 60, coachCue: '' };
    const updatedWorkouts = [...editedPlan.workouts];
    updatedWorkouts[selectedWorkoutIndex].exercises.push(newExercise);
    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
    setShowExerciseSelector(false);
  };

  const toggleClassMode = (idx: number) => {
      const updated = [...editedPlan.workouts];
      updated[idx].isClass = !updated[idx].isClass;
      if (updated[idx].isClass) {
          updated[idx].exercises = []; // Clear exercises if it becomes a class
          updated[idx].classType = 'Hyrox / Funcional';
      }
      setEditedPlan({...editedPlan, workouts: updated});
  };

  const updateExercise = (exerciseIndex: number, field: keyof WorkoutExercise, value: any) => {
    const updatedWorkouts = [...editedPlan.workouts];
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

  return (
    <div className="bg-[#0A0A0C] min-h-screen fixed inset-0 z-50 overflow-y-auto pb-20 flex flex-col">
      <div className="sticky top-0 bg-[#0A0A0C]/95 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between z-40 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onCancel}><X size={24} className="text-gray-400" /></button>
          <input value={editedPlan.title} onChange={(e) => setEditedPlan({...editedPlan, title: e.target.value})} className="bg-transparent text-xl font-bold outline-none placeholder-gray-600 w-full" placeholder="Nombre del Protocolo" />
        </div>
        <button onClick={() => onSave(editedPlan)} className="bg-red-600 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2"><Save size={16} /> <span className="hidden sm:inline">GUARDAR</span></button>
      </div>

      <div className="p-4 max-w-4xl mx-auto w-full flex-1">
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar mb-4">
          {editedPlan.workouts.map((w, idx) => (
            <button key={w.id} onClick={() => setSelectedWorkoutIndex(idx)} className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${selectedWorkoutIndex === idx ? 'bg-white text-black' : 'bg-white/5 text-gray-400'}`}>DÍA {w.day}</button>
          ))}
          <button onClick={handleAddWorkout} className="px-4 py-2 rounded-full bg-red-600/20 text-red-500 border border-red-500/50 flex items-center gap-1 text-sm font-bold"><Plus size={14} /> DÍA</button>
        </div>

        {editedPlan.workouts[selectedWorkoutIndex] ? (
          <div className="space-y-4 animate-fade-in">
             <div className="flex items-center gap-4 mb-4">
                 <input value={editedPlan.workouts[selectedWorkoutIndex].name} onChange={(e) => { const updated = [...editedPlan.workouts]; updated[selectedWorkoutIndex].name = e.target.value; setEditedPlan({...editedPlan, workouts: updated}); }} className="bg-transparent text-2xl font-bold uppercase text-red-500 outline-none w-full" placeholder="NOMBRE DEL DÍA (EJ: PIERNA)" />
                 
                 <button onClick={() => toggleClassMode(selectedWorkoutIndex)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors flex items-center gap-2 ${editedPlan.workouts[selectedWorkoutIndex].isClass ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                     <MapPin size={14} /> {editedPlan.workouts[selectedWorkoutIndex].isClass ? 'Es Clase Presencial' : 'Es Rutina de Gym'}
                 </button>
             </div>

             {editedPlan.workouts[selectedWorkoutIndex].isClass ? (
                 <div className="bg-[#111] border border-blue-500/30 p-6 rounded-2xl text-center">
                     <MapPin size={48} className="mx-auto text-blue-500 mb-4" />
                     <h3 className="text-xl font-bold text-white mb-2">Configuración de Clase</h3>
                     <p className="text-sm text-gray-400 mb-4">El atleta deberá confirmar su asistencia. Si no asiste, se le asignará una rutina automática.</p>
                     <input 
                       value={editedPlan.workouts[selectedWorkoutIndex].classType || ''}
                       onChange={(e) => {
                           const updated = [...editedPlan.workouts];
                           updated[selectedWorkoutIndex].classType = e.target.value;
                           setEditedPlan({...editedPlan, workouts: updated});
                       }}
                       placeholder="Nombre de la Clase (ej: Hyrox, BootCamp)"
                       className="bg-black border border-white/20 rounded-xl p-3 w-full text-center text-white focus:border-blue-500 outline-none"
                     />
                 </div>
             ) : (
                 <>
                     {editedPlan.workouts[selectedWorkoutIndex].exercises.map((ex, idx) => (
                       <div key={idx} className="bg-[#111] border border-white/10 rounded-xl p-4 relative group">
                          <div className="flex justify-between items-start mb-3"><span className="font-bold text-lg">{ex.name}</span><button onClick={() => removeExercise(idx)} className="text-gray-600 hover:text-red-500"><Trash2 size={18} /></button></div>
                          <div className="grid grid-cols-4 gap-3 mb-3">
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold">Series</label><input type="number" inputMode="numeric" value={ex.targetSets} onChange={(e) => updateExercise(idx, 'targetSets', parseInt(e.target.value))} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center font-bold" /></div>
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold">Reps</label><input type="text" value={ex.targetReps} onChange={(e) => updateExercise(idx, 'targetReps', e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center font-bold" /></div>
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold text-yellow-500">Carga (Kg)</label><input type="text" inputMode="decimal" value={ex.targetLoad || ''} onChange={(e) => updateExercise(idx, 'targetLoad', e.target.value)} placeholder="Ej: 80" className="w-full bg-black border border-yellow-500/20 rounded-lg p-2 text-sm text-center font-bold text-yellow-400 placeholder-gray-700" /></div>
                            <div><label className="text-[10px] text-gray-500 uppercase font-bold text-blue-500">Descanso(s)</label><input type="number" inputMode="numeric" value={ex.targetRest || ''} onChange={(e) => updateExercise(idx, 'targetRest', parseInt(e.target.value))} placeholder="60" className="w-full bg-black border border-blue-500/20 rounded-lg p-2 text-sm text-center font-bold text-blue-400 placeholder-gray-700" /></div>
                          </div>
                          <div><label className="text-[10px] text-gray-500 uppercase font-bold">Notas Técnicas</label><input type="text" value={ex.coachCue || ''} onChange={(e) => updateExercise(idx, 'coachCue', e.target.value)} placeholder="Instrucciones específicas..." className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-gray-300" /></div>
                       </div>
                     ))}
                     <button onClick={() => setShowExerciseSelector(true)} className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-gray-500 font-bold hover:border-red-500/50 hover:text-red-500 transition-colors flex items-center justify-center gap-2"><Plus size={20} /> AÑADIR EJERCICIO</button>
                 </>
             )}
          </div>
        ) : <div className="text-center text-gray-500 mt-10">Agrega un día de entrenamiento para comenzar.</div>}
      </div>

      {showExerciseSelector && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col animate-fade-in">
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#0A0A0C]"><button onClick={() => setShowExerciseSelector(false)}><ChevronLeft size={24} /></button><div className="flex-1 bg-white/10 rounded-lg flex items-center px-3 py-2"><Search size={18} className="text-gray-400" /><input autoFocus className="bg-transparent border-none outline-none text-sm ml-2 w-full text-white" placeholder="Buscar ejercicio..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
          <div className="flex gap-2 overflow-x-auto p-2 border-b border-white/5 no-scrollbar bg-[#0A0A0C]">{categories.map(cat => (<button key={cat} onClick={() => setActiveCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-400'}`}>{cat}</button>))}</div>
          <div className="flex-1 overflow-y-auto p-4 grid gap-2 pb-20">
            {filteredExercises.map(ex => (<button key={ex.id} onClick={() => handleAddExercise(ex)} className="bg-[#111] border border-white/5 p-4 rounded-xl text-left hover:border-red-500 transition-colors flex justify-between items-center"><div><div className="font-bold text-sm">{ex.name}</div><div className="text-[10px] text-gray-500 uppercase bg-white/5 inline-block px-1.5 rounded mt-1">{ex.muscleGroup}</div></div><Plus size={18} className="text-gray-600" /></button>))}
          </div>
        </div>
      )}
    </div>
  );
};

// --- WORKOUTS VIEW (UPDATED: Protected Add Button) ---
const WorkoutsView = ({ user }: { user: User }) => {
    const [exercises, setExercises] = useState<Exercise[]>(DataEngine.getExercises());
    const [filter, setFilter] = useState('');
    const [showVideo, setShowVideo] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const filtered = exercises.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()) || e.muscleGroup.toLowerCase().includes(filter.toLowerCase()));

    const handleAddExercise = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const newEx: Exercise = {
            id: generateUUID(),
            name: formData.get('name') as string,
            muscleGroup: formData.get('muscle') as string,
            videoUrl: formData.get('video') as string,
            technique: '', commonErrors: []
        };
        DataEngine.addExercise(newEx);
        setExercises(DataEngine.getExercises());
        setShowAddModal(false);
    };

    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold font-display italic text-white">BIBLIOTECA</h2>
                {/* PROTECTED: Only Coach/Admin can add exercises */}
                {(user.role === 'coach' || user.role === 'admin') && (
                    <button onClick={() => setShowAddModal(true)} className="text-xs font-bold bg-white text-black px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-gray-200">
                        <Plus size={16}/> Nuevo
                    </button>
                )}
             </div>

             <div className="relative">
                <Search className="absolute left-4 top-3.5 text-gray-500" size={18} />
                <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar ejercicio o músculo..." className="w-full bg-[#0F0F11] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-white/20 outline-none" />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                 {filtered.map(ex => (
                     <div key={ex.id} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl flex justify-between items-center group hover:border-white/20 transition-colors">
                         <div><h4 className="font-bold text-white">{ex.name}</h4><span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block">{ex.muscleGroup}</span></div>
                         <button onClick={() => setShowVideo(ex.name)} className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-white/10 transition-colors"><Play size={16} /></button>
                     </div>
                 ))}
             </div>

             {showVideo && (
                <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowVideo(null)}>
                    <div className="bg-[#111] w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#151518]"><h3 className="font-bold text-white flex items-center gap-2"><Youtube size={18} className="text-red-500"/> {showVideo}</h3><button onClick={() => setShowVideo(null)} className="p-1 hover:bg-white/10 rounded-full transition-colors"><X size={20} className="text-gray-400 hover:text-white" /></button></div>
                        <div className="aspect-video bg-black flex items-center justify-center relative group"><div className="absolute inset-0 bg-red-600/5 group-hover:bg-transparent transition-colors pointer-events-none" /><a href={exercises.find(e => e.name === showVideo)?.videoUrl || '#'} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-3 text-white group-hover:scale-110 transition-transform"><div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-600/40"><Play size={32} fill="white" className="ml-1" /></div><span className="text-xs font-bold tracking-widest uppercase">Ver Tutorial</span></a></div>
                    </div>
                </div>
            )}

            {showAddModal && (
                <div className="fixed inset-0 bg-black/80 z-[80] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
                    <div className="bg-[#1A1A1D] w-full max-w-md rounded-2xl p-6 border border-white/10" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-white mb-4">Agregar Ejercicio</h3>
                        <form onSubmit={handleAddExercise} className="space-y-4">
                            <input name="name" required placeholder="Nombre del Ejercicio" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" />
                            <select name="muscle" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none">
                                <option value="Pecho">Pecho</option><option value="Espalda">Espalda</option><option value="Pierna">Pierna</option><option value="Hombro">Hombro</option><option value="Brazo">Brazo</option><option value="Funcional">Funcional</option>
                            </select>
                            <input name="video" placeholder="URL Video (YouTube)" className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white focus:border-red-500 outline-none" />
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

// --- CLIENTS VIEW (LIST OF ATHLETES) ---
const ClientsView = ({ onSelect, user }: { onSelect: (id: string) => void, user: User }) => {
    const [users, setUsers] = useState<User[]>(DataEngine.getUsers().filter(u => u.role === 'client'));
    const [search, setSearch] = useState('');
    const [showInviteModal, setShowInviteModal] = useState(false);

    // Refresh users when modal closes or opens
    useEffect(() => {
        setUsers(DataEngine.getUsers().filter(u => u.role === 'client'));
    }, [showInviteModal]);

    const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6 animate-fade-in pb-20">
             <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold font-display italic text-white">ATLETAS</h2>
                {(user.role === 'coach' || user.role === 'admin') && (
                    <button onClick={() => setShowInviteModal(true)} className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-gray-200 transition-colors">
                        <UserPlus size={16} /> Agregar Atleta
                    </button>
                )}
             </div>
             
             <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
                <input 
                    value={search} 
                    onChange={e => setSearch(e.target.value)} 
                    placeholder="Buscar atleta..." 
                    className="bg-[#0F0F11] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:border-red-500 outline-none w-full md:w-64"
                />
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {filtered.map(client => {
                     const plan = DataEngine.getPlan(client.id);
                     return (
                         <div key={client.id} onClick={() => onSelect(client.id)} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl hover:border-red-500/50 cursor-pointer transition-all group relative overflow-hidden">
                             <div className="flex items-center gap-4 relative z-10">
                                 <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center font-bold text-white shadow-lg border border-white/5 group-hover:scale-110 transition-transform">
                                     {client.name[0]}
                                 </div>
                                 <div>
                                     <h4 className="font-bold text-white group-hover:text-red-500 transition-colors">{client.name}</h4>
                                     <p className="text-xs text-gray-500">{client.email}</p>
                                     <div className="flex gap-2 mt-2">
                                         <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-400 border border-white/5">{client.goal}</span>
                                         {plan && <span className="text-[10px] bg-green-900/20 text-green-500 px-2 py-0.5 rounded border border-green-500/20 flex items-center gap-1"><CheckCircle2 size={10}/> Plan Activo</span>}
                                     </div>
                                 </div>
                             </div>
                         </div>
                     );
                 })}
                 {filtered.length === 0 && (
                     <div className="col-span-full text-center py-10 text-gray-500">
                         No se encontraron atletas.
                     </div>
                 )}
             </div>

             {showInviteModal && (
                 <UserInviteModal 
                    currentUser={user} 
                    onClose={() => setShowInviteModal(false)} 
                    onInviteSuccess={() => setUsers(DataEngine.getUsers().filter(u => u.role === 'client'))}
                 />
             )}
        </div>
    );
};

// ... (ClientDetailView & LoginPage & DashboardView - Sin cambios) ...
const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
  const [client, setClient] = useState<User | undefined>(DataEngine.getUserById(clientId));
  const [plan, setPlan] = useState<Plan | null>(DataEngine.getPlan(clientId));
  const [history, setHistory] = useState<any[]>(DataEngine.getClientHistory(clientId));
  const [isGenerating, setIsGenerating] = useState(false);
  const [showManualBuilder, setShowManualBuilder] = useState(false); // Restore state
  const [activeSubTab, setActiveSubTab] = useState<'plan' | 'history'>('plan');

  if (!client) return <div className="p-8 text-center">Atleta no encontrado.</div>;

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      // INJECTED HISTORY FOR SMART LOAD CALCULATION
      const generatedPlan = await generateSmartRoutine(client, history);
      const newPlan: Plan = {
        id: generateUUID(), title: generatedPlan.title || "Plan IA", userId: client.id, workouts: generatedPlan.workouts || [], updatedAt: new Date().toISOString()
      };
      await DataEngine.savePlan(newPlan);
      setPlan(newPlan);
    } catch (e: any) { alert(e.message); } finally { setIsGenerating(false); }
  };

  const handleDeleteClient = () => { 
      if (confirm("¿Estás seguro de eliminar a este atleta? Esta acción no se puede deshacer.")) { 
          DataEngine.deleteUser(clientId); 
          onBack(); 
      } 
  };
  
  const handleSavePlan = (updatedPlan: Plan) => {
      DataEngine.savePlan(updatedPlan);
      setPlan(updatedPlan);
      setShowManualBuilder(false);
  };

  if (showManualBuilder && plan) {
      return <ManualPlanBuilder plan={plan} onSave={handleSavePlan} onCancel={() => setShowManualBuilder(false)} />;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-32">
       <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-2"><ChevronLeft size={20} /> <span className="font-bold text-sm">Volver a Atletas</span></button>
       
       <div className="bg-[#0F0F11] p-6 rounded-3xl border border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"/>
          <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-start gap-6">
            <div className="flex items-start gap-5">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-black border border-white/10 flex items-center justify-center text-3xl font-bold text-gray-500 shadow-xl">{client.name[0]}</div>
                <div>
                    <h1 className="text-3xl font-bold font-display italic text-white leading-none mb-2">{client.name.toUpperCase()}</h1>
                    <div className="flex flex-wrap gap-3">
                        <div className="relative group">
                            <select
                                value={client.goal}
                                onChange={(e) => {
                                    const val = e.target.value as Goal;
                                    const updated = { ...client, goal: val };
                                    DataEngine.saveUser(updated);
                                    setClient(updated);
                                }}
                                className="appearance-none bg-white/5 border border-white/5 text-xs font-bold text-gray-400 rounded-lg pl-8 pr-6 py-1.5 outline-none focus:border-blue-500 cursor-pointer hover:bg-white/10 transition-colors"
                            >
                                {Object.values(Goal).map(g => <option key={g} value={g} className="bg-[#1A1A1D] text-white">{g}</option>)}
                            </select>
                            <Info size={14} className="text-blue-500 absolute left-2.5 top-1.5 pointer-events-none"/>
                            <Edit3 size={10} className="text-gray-600 absolute right-2 top-2 pointer-events-none group-hover:text-white"/>
                        </div>
                        <span className="flex items-center gap-1.5 text-xs font-bold text-gray-400 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5"><Zap size={14} className="text-yellow-500"/> {client.level}</span>
                    </div>
                </div>
            </div>
            <button onClick={handleDeleteClient} className="text-xs text-red-500 hover:text-red-400 border border-red-900/30 px-3 py-1.5 rounded-lg bg-red-900/10 transition-colors flex items-center gap-1"><Trash2 size={12}/> Eliminar</button>
          </div>
       </div>

       <div className="flex border-b border-white/10 gap-6">
           <button onClick={() => setActiveSubTab('plan')} className={`pb-3 text-sm font-bold transition-colors ${activeSubTab === 'plan' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500'}`}>Protocolo Activo</button>
           <button onClick={() => setActiveSubTab('history')} className={`pb-3 text-sm font-bold transition-colors ${activeSubTab === 'history' ? 'text-red-500 border-b-2 border-red-500' : 'text-gray-500'}`}>Historial ({history.length})</button>
       </div>

       {activeSubTab === 'plan' && (
           plan ? (
             <div className="space-y-4 animate-fade-in">
                <div className="flex justify-between items-center px-2">
                  <h3 className="text-lg font-bold flex items-center gap-2 text-white"><Trophy size={18} className="text-yellow-500"/> Plan Asignado</h3>
                  <div className="flex gap-2">
                      <button onClick={() => setShowManualBuilder(true)} className="text-xs font-bold bg-white/10 text-white border border-white/20 px-4 py-2 rounded-full hover:bg-white/20 transition-all flex items-center gap-2"><Edit3 size={12}/> EDITAR MANUAL</button>
                      {/* Coach Only: Regenerate AI Plan */}
                      <button onClick={handleGenerateAI} disabled={isGenerating} className="text-xs font-bold bg-blue-600/10 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-full hover:bg-blue-600/20 transition-all flex items-center gap-2">{isGenerating ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12} />} REGENERAR IA</button>
                  </div>
                </div>
                <PlanViewer plan={plan} mode="coach" />
             </div>
           ) : (
             <div className="py-16 text-center text-gray-500 flex flex-col items-center">
                <p className="mb-4">Sin plan activo.</p>
                <div className="flex gap-2">
                     <button onClick={() => { const newP = { id: generateUUID(), title: 'Nuevo Plan', userId: client.id, workouts: [], updatedAt: new Date().toISOString() }; setPlan(newP); setShowManualBuilder(true); }} className="text-sm font-bold bg-white text-black px-6 py-3 rounded-xl hover:bg-gray-200 transition-all flex items-center gap-2"><Plus size={16}/> CREAR MANUAL</button>
                     <button onClick={handleGenerateAI} disabled={isGenerating} className="text-sm font-bold bg-blue-600 text-white px-6 py-3 rounded-xl hover:bg-blue-500 transition-all flex items-center gap-2">{isGenerating ? <Loader2 size={16} className="animate-spin"/> : <Sparkles size={16} />} CREAR CON IA</button>
                </div>
             </div>
           )
       )}

       {activeSubTab === 'history' && (
           <div className="space-y-4 animate-fade-in">
               {history.length === 0 ? <div className="text-center py-10 text-gray-500">No hay sesiones.</div> : history.map((s, i) => (
                   <div key={i} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl">
                       <div className="flex justify-between items-center mb-2">
                           <div><div className="font-bold text-white">{s.workoutName}</div><div className="text-xs text-gray-500">{formatDate(s.date)}</div></div>
                           <div className="text-right"><div className="font-bold text-white">{(s.summary.totalVolume/1000).toFixed(1)}k <span className="text-xs text-gray-500">VOL</span></div>{s.summary.prCount > 0 && <div className="text-[10px] text-yellow-500 font-bold">{s.summary.prCount} PRs</div>}</div>
                       </div>
                       
                       {/* Expanded Detail for Coach */}
                       <div className="mt-2 pt-2 border-t border-white/5 grid grid-cols-2 gap-2">
                          <div className="text-xs text-gray-500">Duración: <span className="text-white">{s.summary.durationMinutes}m</span></div>
                          <div className="text-xs text-gray-500">Ejercicios: <span className="text-white">{s.summary.exercisesCompleted}</span></div>
                       </div>
                   </div>
               ))}
           </div>
       )}
    </div>
  );
};

const LoginPage = ({ onLogin }: { onLogin: (u: User) => void }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const u = DataEngine.getUserByNameOrEmail(email);
        if(u) {
            if(u.isActive === false) { setError('Usuario desactivado'); return; }
            onLogin(u);
        }
        else setError('Usuario no encontrado');
    }

    return (
        <div className="min-h-screen bg-[#050507] flex items-center justify-center p-4 relative overflow-hidden">
             {/* Background Decoration */}
             <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
                 <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-red-600/10 rounded-full blur-[100px]" />
                 <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[100px]" />
             </div>

             <div className="w-full max-w-md space-y-8 relative z-10">
                 <div className="text-center flex flex-col items-center">
                     {/* UPDATE: Increased Logo Size here */}
                     <BrandingLogo className="w-48 h-48 mb-6 shadow-2xl" showText={false} />
                     <h1 className="text-4xl font-bold font-display italic text-white tracking-tight">KINETIX ZONE</h1>
                     <p className="text-gray-400 mt-2 text-sm tracking-widest uppercase font-bold">Elite Functional Training</p>
                     
                     <div className="mt-6">
                        <SocialLinks />
                     </div>
                 </div>
                 
                 <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-3xl space-y-6 shadow-2xl">
                     <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Email de Acceso</label>
                         <input autoFocus type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-white focus:border-red-500 outline-none transition-colors placeholder-gray-700" placeholder="atleta@kinetix.com" />
                     </div>
                     {error && <div className="text-red-500 text-sm font-bold bg-red-500/10 p-3 rounded-lg flex items-center gap-2"><AlertTriangle size={16}/> {error}</div>}
                     <button type="submit" className="w-full bg-gradient-to-r from-red-600 to-red-700 text-white font-bold py-4 rounded-xl hover:from-red-500 hover:to-red-600 transition-all shadow-lg shadow-red-900/30 transform active:scale-[0.98]">
                         ENTRAR AL ZONE
                     </button>
                 </form>
                 
                 <div className="text-center space-y-4">
                     <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Head Coach: Jorge Gonzalez</p>
                     
                     <div className="border-t border-white/5 pt-4">
                         <p className="text-xs text-gray-600 mb-2">Accesos Demo:</p>
                         <div className="flex gap-2 justify-center">
                             <button onClick={() => setEmail('atleta@kinetix.com')} className="text-xs bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors">Atleta</button>
                             <button onClick={() => setEmail('coach@kinetix.com')} className="text-xs bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors">Coach</button>
                             <button onClick={() => setEmail('admin@kinetix.com')} className="text-xs bg-white/5 px-3 py-1.5 rounded-lg text-gray-400 hover:text-white transition-colors">Admin</button>
                         </div>
                     </div>
                 </div>
             </div>
        </div>
    );
};

const DashboardView = ({ user, onNavigate }: { user: User, onNavigate: (view: string) => void }) => {
    // --- COACH VIEW ---
    if (user.role === 'coach' || user.role === 'admin') {
        const allUsers = DataEngine.getUsers();
        const clients = allUsers.filter(u => u.role === 'client');
        const activePlans = clients.filter(c => DataEngine.getPlan(c.id)).length;
        const exercises = DataEngine.getExercises();

        return (
            <div className="space-y-6 animate-fade-in pb-20">
                <div className="flex justify-between items-center">
                   <div>
                       <h2 className="text-3xl font-bold font-display italic text-white">PANEL DE CONTROL</h2>
                       <p className="text-gray-500 text-sm">Gestión de alto rendimiento</p>
                   </div>
                   <div className="text-right hidden md:block">
                       <p className="text-xs text-gray-500 font-bold uppercase">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                   </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Atletas Totales" value={clients.length} icon={<Users className="text-blue-500" size={20} />} />
                    <StatCard label="Planes Activos" value={activePlans} icon={<Activity className="text-green-500" size={20} />} />
                    <StatCard label="Ejercicios" value={exercises.length} icon={<Dumbbell className="text-orange-500" size={20} />} />
                    <StatCard label="Alertas" value="0" icon={<ShieldAlert className="text-red-500" size={20} />} />
                </div>

                <div className="bg-[#0F0F11] border border-white/5 p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-lg text-white">Acciones Rápidas</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <button onClick={() => onNavigate('clients')} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-red-500/30 transition-all text-left group">
                             <div className="bg-red-500/10 w-10 h-10 rounded-lg flex items-center justify-center text-red-500 mb-3 group-hover:scale-110 transition-transform">
                                 <UserPlus size={20}/>
                             </div>
                             <h4 className="font-bold text-white">Gestionar Atletas</h4>
                             <p className="text-xs text-gray-500 mt-1">Ver lista, crear planes, asignar rutinas.</p>
                         </button>
                         <button onClick={() => onNavigate('workouts')} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-blue-500/30 transition-all text-left group">
                             <div className="bg-blue-500/10 w-10 h-10 rounded-lg flex items-center justify-center text-blue-500 mb-3 group-hover:scale-110 transition-transform">
                                 <Dumbbell size={20}/>
                             </div>
                             <h4 className="font-bold text-white">Biblioteca</h4>
                             <p className="text-xs text-gray-500 mt-1">Gestionar ejercicios y videos.</p>
                         </button>
                         {user.role === 'admin' && (
                             <button onClick={() => onNavigate('admin')} className="p-4 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-yellow-500/30 transition-all text-left group">
                                 <div className="bg-yellow-500/10 w-10 h-10 rounded-lg flex items-center justify-center text-yellow-500 mb-3 group-hover:scale-110 transition-transform">
                                     <Briefcase size={20}/>
                                 </div>
                                 <h4 className="font-bold text-white">Administración</h4>
                                 <p className="text-xs text-gray-500 mt-1">Configuración del sistema.</p>
                             </button>
                         )}
                    </div>
                </div>
            </div>
        );
    }

    // --- ATHLETE VIEW ---
    const plan = DataEngine.getPlan(user.id);
    const history = DataEngine.getClientHistory(user.id);
    // Stats
    const totalVol = history.reduce((acc, curr) => acc + curr.summary.totalVolume, 0);
    const workoutsDone = history.length;

    return (
        <div className="space-y-8 animate-fade-in pb-32">
            <div className="flex justify-between items-center mb-2">
               <div>
                  <h2 className="text-3xl font-bold font-display italic text-white flex items-center gap-2">
                      HOLA, {user.name.split(' ')[0]} <span className="text-2xl">👋</span>
                  </h2>
                  <p className="text-gray-500 text-sm">Tu evolución comienza hoy.</p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                 <StatCard label="Total Kg" value={(totalVol/1000).toFixed(1) + 'k'} icon={<Dumbbell size={16} className="text-blue-500"/>} />
                 <StatCard label="Sesiones" value={workoutsDone} icon={<Activity size={16} className="text-green-500"/>} />
            </div>
            
            {plan ? (
                <div>
                   <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2"><Flame size={18} className="text-red-500"/> PROTOCOLO ACTIVO</h3>
                   <PlanViewer plan={plan} mode="athlete" />
                </div>
            ) : (
                <div className="text-center py-10 bg-[#0F0F11] rounded-2xl border border-white/5">
                    <p className="text-gray-500 mb-2">No tienes un plan asignado.</p>
                    <p className="text-xs text-gray-600">Contacta a tu coach.</p>
                </div>
            )}
        </div>
    );
};

// ... (ProfileView with AI Analysis button) ...
const ProfileView = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
    const history = DataEngine.getClientHistory(user.id);
    const [analyzing, setAnalyzing] = useState(false);
    
    const chartData = history.slice(0, 10).reverse().map(h => ({
        date: new Date(h.date).toLocaleDateString('es-ES', {day: 'numeric', month: 'short'}),
        vol: h.summary.totalVolume
    }));

    const handleAnalyze = async () => {
        setAnalyzing(true);
        try {
            const advice = await analyzeProgress(user, history);
            alert(advice); // Simplificado por UI, idealmente un modal
        } catch(e) {
            alert("No se pudo analizar el progreso.");
        } finally {
            setAnalyzing(false);
        }
    }

    return (
        <div className="space-y-6 animate-fade-in pb-32">
            <div className="flex items-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-red-900/40">{user.name[0]}</div>
                <div>
                    <h2 className="text-2xl font-bold text-white">{user.name}</h2>
                    <p className="text-gray-400">{user.email}</p>
                    <span className="inline-block mt-2 px-3 py-1 bg-white/5 rounded-lg text-xs font-bold text-red-500 uppercase">{user.role}</span>
                </div>
            </div>
            
            {user.role === 'client' && (
                <>
                    <button onClick={handleAnalyze} disabled={analyzing} className="w-full py-4 bg-gradient-to-r from-blue-900 to-blue-800 border border-blue-500/30 rounded-xl flex items-center justify-center gap-3 shadow-lg mb-2 relative overflow-hidden group">
                        <div className="absolute inset-0 bg-blue-600/20 group-hover:bg-blue-600/30 transition-colors" />
                        {analyzing ? <Loader2 className="animate-spin text-blue-200" /> : <BrainCircuit size={24} className="text-blue-300" />}
                        <span className="font-bold text-blue-100 z-10">ANALIZAR MI PROGRESO CON IA</span>
                        <Sparkles className="absolute right-4 text-blue-300 opacity-50" size={20} />
                    </button>

                    <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-6">
                        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-green-500"/> Progreso de Volumen</h3>
                        <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={chartData}>
                                    <defs>
                                        <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#666'}} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{backgroundColor: '#000', border: '1px solid #333', borderRadius: '8px'}} />
                                    <Area type="monotone" dataKey="vol" stroke="#ef4444" fillOpacity={1} fill="url(#colorVol)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}

            <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-4 space-y-4">
                 <div className="flex justify-between items-center py-2 border-b border-white/5">
                     <span className="text-gray-500">Meta</span>
                     <span className="text-white font-bold">{user.goal}</span>
                 </div>
                 <div className="flex justify-between items-center py-2 border-b border-white/5">
                     <span className="text-gray-500">Nivel</span>
                     <span className="text-white font-bold">{user.level}</span>
                 </div>
                 <div className="flex justify-between items-center py-2">
                     <span className="text-gray-500">Días/Semana</span>
                     <span className="text-white font-bold">{user.daysPerWeek}</span>
                 </div>
            </div>

            <button onClick={onLogout} className="w-full py-4 bg-white/5 text-red-500 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors"><LogOut size={20}/> Cerrar Sesión</button>
        </div>
    );
};

// ... (AdminView and App export remain identical but updated within the file context)
// --- ADMIN VIEW EXPANDED (Updated for User Invite) ---
const AdminView = () => {
  const [config, setConfig] = useState(DataEngine.getConfig());
  const [activeTab, setActiveTab] = useState<'branding' | 'users'>('branding');
  const [users, setUsers] = useState<User[]>(DataEngine.getUsers());
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Mock current user as admin for this view context (though strictly App passes it, AdminView logic assumes admin role)
  // To use the modal properly, we should reconstruct a temporary Admin user object if we don't have it passed down,
  // but better to rely on the fact this view is only accessible by admins.
  const adminUserMock: User = { ...MOCK_USER, role: 'admin', id: ADMIN_UUID };

  const handleSaveConfig = () => {
      DataEngine.saveConfig(config);
      alert("Configuración guardada.");
  }

  const toggleUserStatus = (u: User) => {
      const updated = { ...u, isActive: !u.isActive };
      DataEngine.saveUser(updated);
      setUsers(DataEngine.getUsers());
  }

  const resetPassword = (u: User) => {
      alert(`Enlace de recuperación enviado a ${u.email} (Simulado)`);
  }

  return (
      <div className="space-y-6 animate-fade-in pb-20">
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold font-display italic text-white">COMMAND CENTER</h2>
              <div className="flex gap-2 bg-white/5 p-1 rounded-lg">
                  <button onClick={() => setActiveTab('branding')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'branding' ? 'bg-white text-black' : 'text-gray-400'}`}>MARCA</button>
                  <button onClick={() => setActiveTab('users')} className={`px-4 py-2 rounded-md text-xs font-bold transition-all ${activeTab === 'users' ? 'bg-white text-black' : 'text-gray-400'}`}>USUARIOS</button>
              </div>
          </div>
          
          {activeTab === 'branding' && (
              <div className="bg-[#0F0F11] border border-white/5 p-6 rounded-2xl space-y-4">
                   <h3 className="font-bold text-white mb-4">Personalización de Marca</h3>
                   <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Nombre de la App</label>
                       <input value={config.appName} onChange={e => setConfig({...config, appName: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:border-red-500 outline-none" />
                   </div>
                   <div>
                       <label className="block text-xs font-bold text-gray-500 uppercase mb-2">URL del Logo</label>
                       <input value={config.logoUrl} onChange={e => setConfig({...config, logoUrl: e.target.value})} className="w-full bg-black border border-white/10 rounded-lg p-3 text-white focus:border-red-500 outline-none" placeholder="https://..." />
                   </div>
                   <button onClick={handleSaveConfig} className="bg-red-600 text-white px-6 py-2 rounded-lg font-bold text-sm">Guardar Cambios</button>
              </div>
          )}

          {activeTab === 'users' && (
              <div className="space-y-4">
                  <div className="flex justify-end">
                       <button onClick={() => setShowInviteModal(true)} className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 hover:bg-gray-200 transition-colors"><UserPlus size={16}/> INVITAR USUARIO</button>
                  </div>
                  {users.map(u => (
                      <div key={u.id} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
                          <div className="flex items-center gap-4 w-full">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${u.isActive !== false ? 'bg-green-600' : 'bg-red-600'}`}>{u.name[0]}</div>
                              <div>
                                  <div className="font-bold text-white">{u.name} <span className="text-xs text-gray-500 bg-white/10 px-2 rounded ml-2">{u.role}</span></div>
                                  <div className="text-xs text-gray-500">{u.email}</div>
                              </div>
                          </div>
                          <div className="flex gap-2 w-full md:w-auto">
                              <button onClick={() => resetPassword(u)} className="flex-1 md:flex-none px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold text-gray-300 flex items-center justify-center gap-2" title="Reset Password"><KeyRound size={14}/> RESET</button>
                              <button onClick={() => toggleUserStatus(u)} className={`flex-1 md:flex-none px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 ${u.isActive !== false ? 'bg-red-900/20 text-red-500 hover:bg-red-900/30' : 'bg-green-900/20 text-green-500 hover:bg-green-900/30'}`}>
                                  {u.isActive !== false ? <><UserX size={14}/> DESACTIVAR</> : <><UserCheck size={14}/> ACTIVAR</>}
                              </button>
                          </div>
                      </div>
                  ))}
              </div>
          )}

          {showInviteModal && (
              <UserInviteModal 
                  currentUser={adminUserMock} 
                  onClose={() => setShowInviteModal(false)} 
                  onInviteSuccess={() => setUsers(DataEngine.getUsers())} 
              />
          )}
      </div>
  );
};

// ... (App function with chatbot logic) ...
function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard'); // dashboard, workouts, clients, admin, profile
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [chatbotOpen, setChatbotOpen] = useState(false); // Manually triggered, default closed (Rule 5)

  useEffect(() => {
     DataEngine.init();
     const session = localStorage.getItem(SESSION_KEY);
     if(session) {
         const u = DataEngine.getUserById(session);
         if(u) setUser(u);
     }
  }, []);

  const login = (u: User) => {
      localStorage.setItem(SESSION_KEY, u.id);
      setUser(u);
      setView('dashboard');
  };

  const logout = () => {
      localStorage.removeItem(SESSION_KEY);
      setUser(null);
  };

  if (!user) return <LoginPage onLogin={login} />;

  return (
    <div className="min-h-screen bg-[#050507] text-gray-200 font-sans selection:bg-red-500/30">
        {/* Desktop Sidebar */}
        <aside className="fixed left-0 top-0 h-full w-64 bg-[#0F0F11] border-r border-white/5 p-6 hidden md:flex flex-col z-40">
            <BrandingLogo />
            
            <nav className="flex-1 space-y-2 mt-10">
                {user.role === 'client' && <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />}
                {user.role === 'coach' && <NavButton active={view === 'clients' || view === 'client-detail'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Atletas" />}
                {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'workouts'} onClick={() => setView('workouts')} icon={<Dumbbell size={20} />} label="Biblioteca" />}
                {user.role === 'admin' && <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<Shield size={20} />} label="Admin" />}
                {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />}
                <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Perfil" />
            </nav>

            <div className="mt-auto pb-6">
                <p className="text-[10px] text-gray-600 uppercase font-bold text-center mb-2">Kinetix Community</p>
                <SocialLinks className="justify-center" />
            </div>

            <button onClick={logout} className="flex items-center gap-3 text-gray-500 hover:text-white transition-colors px-4 mt-4"><LogOut size={20} /> <span className="font-bold text-sm">Salir</span></button>
        </aside>

        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 bg-[#050507]/90 backdrop-blur-xl border-b border-white/5 p-4 z-40 flex justify-between items-center">
             <BrandingLogo textSize="text-lg" />
             <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-bold text-xs">{user.name[0]}</div>
        </div>

        {/* Main Content */}
        <main className="md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen relative">
            {view === 'dashboard' && <DashboardView user={user} onNavigate={setView} />}
            {view === 'clients' && <ClientsView onSelect={(id) => { setSelectedClientId(id); setView('client-detail'); }} user={user} />}
            {view === 'client-detail' && selectedClientId && <ClientDetailView clientId={selectedClientId} onBack={() => setView('clients')} />}
            {view === 'workouts' && <WorkoutsView user={user} />}
            {view === 'profile' && <ProfileView user={user} onLogout={logout} />}
            {view === 'admin' && <AdminView />}
        </main>

        {/* Mobile Navigation */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0F0F11] border-t border-white/5 px-6 py-2 flex justify-between items-center z-40 pb-safe">
            {user.role === 'client' && <MobileNavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />}
            
            {(user.role === 'coach' || user.role === 'admin') && (
               <>
                 <MobileNavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />
                 <MobileNavButton active={view === 'clients' || view === 'client-detail'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Atletas" />
                 <MobileNavButton active={view === 'workouts'} onClick={() => setView('workouts')} icon={<Dumbbell size={20} />} label="Biblio" />
               </>
            )}
            
            <MobileNavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Perfil" />
        </div>
        
        {/* Chatbot for Athletes: Manual Trigger Only (Rule 5) */}
        {user.role === 'client' && (
            <>
                <button onClick={() => setChatbotOpen(!chatbotOpen)} className="fixed bottom-24 right-4 md:bottom-8 md:right-8 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-full shadow-2xl z-50 transition-transform hover:scale-110">
                    <MessageCircle size={24} />
                </button>
                {chatbotOpen && <TechnicalChatbot onClose={() => setChatbotOpen(false)} />}
            </>
        )}

        <ConnectionStatus />
    </div>
  );
}

export default App;
