
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, Sparkles, Activity,
  Dumbbell, Check, ShieldAlert, Search,
  User as UserIcon, Timer as TimerIcon, AlertTriangle, Loader2, BrainCircuit,
  Trophy, Youtube, Circle, MoreVertical, Flame, ClipboardList, MessageSquare, Send, TrendingUp, Shield, MapPin,
  Briefcase, MessageCircle, UserX, UserCheck, Phone, ChevronRight, Layers, ArrowUpCircle, CornerRightDown,
  Clock, Instagram, Facebook, BarChart4
} from 'lucide-react';
import { AreaChart, Area, XAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, SetEntry, WorkoutProgress, ChatMessage, UserRole, TrainingMethod } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine, analyzeProgress, getTechnicalAdvice } from './services/geminiService';
import { supabaseConnectionStatus } from './services/supabaseClient';

// --- CONFIGURACIÓN DE VERSIÓN ESTABLE 8644345 ---
const STORAGE_KEY = 'KINETIX_DATA_PRO_V12_7_FIX';
const SESSION_KEY = 'KINETIX_SESSION_PRO_V12_7_FIX';
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
const getEmbedUrl = (url: string | undefined) => {
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
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1&rel=0` : null;
};

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
    const totalVolume = Object.values(logs).reduce((acc, sets) => acc + sets.reduce((sAcc, s) => sAcc + (parseFloat(s.weight) * parseInt(s.reps)), 0), 0);

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
  getClientHistory: (userId: string) => JSON.parse(DataEngine.getStore()[`HISTORY_${userId}`] || '[]')
};

// --- COMPONENTES UI BÁSICOS ---

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

// --- LOGICA DE ENTRENAMIENTO ---

const ExerciseCard = ({ exercise, index, workoutId, userId, onShowVideo, mode, onSetComplete, history }: any) => {
  const [logs, setLogs] = useState<WorkoutProgress>(() => mode === 'athlete' ? DataEngine.getWorkoutLog(userId, workoutId) : {});
  const method: TrainingMethod = exercise.method || 'standard';

  const handleToggle = (setNum: number, isDone: boolean) => {
    const entry: SetEntry = { setNumber: setNum, weight: exercise.targetLoad || '0', reps: exercise.targetReps, completed: !isDone, timestamp: Date.now() };
    DataEngine.saveSetLog(userId, workoutId, index, entry);
    setLogs(prev => ({...prev, [index]: [...(prev[index] || []).filter(s => s.setNumber !== setNum), entry]}));
    
    if(!isDone) {
        let restTime = (exercise.targetRest || 60);
        if (method === 'biserie') restTime = 0;
        if (restTime > 0) onSetComplete(restTime);
    }
    if (!isDone && navigator.vibrate) navigator.vibrate(50);
  };

  const currentExLogs = logs[index] || [];

  return (
    <div className={`bg-[#0F0F11] border rounded-2xl p-5 mb-4 shadow-sm hover:border-white/10 transition-all relative overflow-hidden ${method === 'biserie' ? 'border-orange-500/30' : method === 'tabata' ? 'border-cyan-500/30' : method === 'emom' ? 'border-yellow-500/30' : 'border-white/5'}`}>
      {method === 'biserie' && <div className="absolute top-0 right-0 bg-orange-600/20 text-orange-500 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-orange-500/20 flex items-center gap-1 uppercase tracking-widest"><Layers size={10} /> Bi-Serie</div>}
      {method === 'tabata' && <div className="absolute top-0 right-0 bg-cyan-600/20 text-cyan-400 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-cyan-500/20 flex items-center gap-1 uppercase tracking-widest"><TimerIcon size={10} /> TABATA</div>}
      {method === 'emom' && <div className="absolute top-0 right-0 bg-yellow-600/20 text-yellow-400 text-[9px] font-bold px-3 py-1 rounded-bl-xl border-l border-b border-yellow-500/20 flex items-center gap-1 uppercase tracking-widest"><Clock size={10} /> EMOM</div>}

      <div className="flex justify-between items-start mb-4 mt-2">
        <div className="flex items-start gap-3 w-full">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center font-bold text-gray-500 text-sm">{index + 1}</div>
          <div className="flex-1">
            <h3 className="font-bold text-lg text-white leading-tight">{exercise.name}</h3>
            {method === 'tabata' && exercise.tabataConfig && (
                <div className="mt-2 text-cyan-400 text-xs font-bold uppercase tracking-wide">{exercise.tabataConfig.sets} SETS • {exercise.tabataConfig.workTimeSec}" ON / {exercise.tabataConfig.restTimeSec}" OFF • {exercise.tabataConfig.rounds} Rounds</div>
            )}
            {method === 'emom' && exercise.emomConfig && (
                <div className="mt-2 text-yellow-400 text-xs font-bold uppercase tracking-wide">EMOM {exercise.emomConfig.durationMin}' • {exercise.emomConfig.type}</div>
            )}
            {!['tabata', 'emom'].includes(method) && (
                <div className="flex flex-wrap gap-2 mt-2 items-center">
                {exercise.targetLoad && <div className="inline-flex items-center gap-1.5 bg-yellow-500/10 px-2 py-0.5 rounded border border-yellow-500/20"><ShieldAlert size={10} className="text-yellow-500" /><span className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">META: {exercise.targetLoad}KG</span></div>}
                <div className="text-[10px] font-bold text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">{exercise.targetSets}X{exercise.targetReps}</div>
                </div>
            )}
            {method === 'biserie' && exercise.pair && (
                <div className="mt-3 bg-white/5 p-3 rounded-xl border border-white/5 flex items-start justify-between gap-3"><div className="flex items-start gap-3"><div className="w-1 h-8 bg-orange-500 rounded-full mt-1"></div><div><div className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">SEGUNDO EJERCICIO (B)</div><h4 className="font-bold text-sm text-white">{exercise.pair.name}</h4><div className="flex gap-2 mt-1"><span className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300 font-bold">{exercise.pair.targetReps} Reps</span>{exercise.pair.targetLoad && <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-1.5 py-0.5 rounded font-bold border border-yellow-500/10">{exercise.pair.targetLoad}kg</span>}</div></div></div><button onClick={() => onShowVideo(exercise.pair.name)} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-orange-500 transition-colors shrink-0"><Play size={14} /></button></div>
            )}
            {(exercise.coachCue || method === 'dropset') && <p className="text-xs text-gray-400 mt-2 italic">{exercise.coachCue}</p>}
          </div>
        </div>
        <button onClick={() => onShowVideo(exercise.name)} className="p-2 bg-white/5 rounded-full text-gray-400 hover:text-red-500 transition-colors shrink-0"><Play size={18} /></button>
      </div>

      {mode === 'athlete' && (
        <div className="space-y-2 mt-4">
          {Array.from({ length: exercise.targetSets }, (_, i) => i + 1).map(setNum => {
            const isDone = currentExLogs.find(l => l.setNumber === setNum)?.completed;
            return (
              <div key={setNum} className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${isDone ? 'bg-green-500/10 border border-green-500/30' : 'bg-white/5 border border-transparent'}`}>
                <div className="flex flex-col">
                  <span className={`text-xs font-bold ${isDone ? 'text-green-400' : 'text-gray-400'}`}>{method === 'tabata' ? `BLOQUE ${setNum}` : `SET ${setNum}`}</span>
                  <span className={`text-[10px] font-bold ${isDone ? 'text-green-500/60' : 'text-gray-600'}`}>{exercise.targetLoad || 'LIBRE'} x {exercise.targetReps}</span>
                </div>
                <button onClick={() => handleToggle(setNum, !!isDone)} className={`w-12 h-10 rounded-lg flex items-center justify-center transition-all ${isDone ? 'bg-green-500 text-black shadow-lg shadow-green-500/20 animate-flash' : 'bg-white/10 text-gray-500 hover:bg-white/20'}`}>{isDone ? <Check size={20} strokeWidth={4} /> : <Circle size={20} />}</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PlanViewer = ({ plan, mode }: { plan: Plan, mode: 'coach' | 'athlete' }) => {
    const [showVideo, setShowVideo] = useState<string | null>(null);
    const embedSrc = getEmbedUrl(DataEngine.getExercises().find(e => e.name === showVideo)?.videoUrl);
    return (
        <div className="space-y-4">
            {plan.workouts.map(w => (
                <div key={w.id} className="mb-6">
                    <h3 className="text-red-500 font-black uppercase tracking-widest text-xs mb-3">DÍA {w.day} • {w.name}</h3>
                    {w.exercises.map((ex, i) => <ExerciseCard key={i} exercise={ex} index={i} workoutId={w.id} userId={plan.userId} onShowVideo={setShowVideo} mode={mode} onSetComplete={() => {}} history={[]} />)}
                </div>
            ))}
            {showVideo && (<div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowVideo(null)}><div className="bg-[#111] w-full max-w-lg rounded-3xl overflow-hidden border border-white/10 shadow-2xl"><div className="aspect-video bg-black flex items-center justify-center">{embedSrc && <iframe src={embedSrc} className="w-full h-full" allowFullScreen />}</div></div></div>)}
        </div>
    )
}

const ManualPlanBuilder = ({ plan, onSave, onCancel }: { plan: Plan, onSave: (p: Plan) => void, onCancel: () => void }) => {
  const [editedPlan, setEditedPlan] = useState<Plan>(plan);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState<number>(0);
  const [showExerciseSelector, setShowExerciseSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleAddWorkout = () => {
    const newWorkout: Workout = { id: generateUUID(), name: `DÍA ${editedPlan.workouts.length + 1}`, day: editedPlan.workouts.length + 1, exercises: [] };
    setEditedPlan({...editedPlan, workouts: [...editedPlan.workouts, newWorkout]});
    setSelectedWorkoutIndex(editedPlan.workouts.length);
  };

  const handleExerciseSelected = (exercise: Exercise) => {
    const updatedWorkouts = [...editedPlan.workouts];
    updatedWorkouts[selectedWorkoutIndex].exercises.push({ exerciseId: exercise.id, name: exercise.name, targetSets: 4, targetReps: '10-12', targetLoad: '', targetRest: 60, coachCue: '', method: 'standard' });
    setEditedPlan({...editedPlan, workouts: updatedWorkouts});
    setShowExerciseSelector(false);
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

  const filteredExercises = DataEngine.getExercises().filter(ex => ex.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
             </div>
             {editedPlan.workouts[selectedWorkoutIndex].exercises.map((ex, idx) => (
               <div key={idx} className="bg-[#111] border border-white/10 rounded-xl p-4 relative group">
                  <div className="flex justify-between items-start mb-3"><span className="font-bold text-lg">{ex.name}</span><button onClick={() => removeExercise(idx)} className="text-gray-600 hover:text-red-500 transition-colors"><Trash2 size={18} /></button></div>
                  <div className="mb-3">
                      <label className="text-[10px] text-gray-500 uppercase font-bold block mb-1">Método</label>
                      <select value={ex.method || 'standard'} onChange={(e) => updateExercise(idx, 'method', e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-white font-bold outline-none focus:border-red-500">
                          <option value="standard">Standard</option><option value="biserie">Bi-serie</option><option value="tabata">TABATA</option><option value="emom">EMOM</option>
                      </select>
                  </div>
                  <div className="grid grid-cols-4 gap-3 mb-3">
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold">Series</label><input type="number" value={ex.targetSets} onChange={(e) => updateExercise(idx, 'targetSets', parseInt(e.target.value))} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center font-bold" /></div>
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold">Reps</label><input type="text" value={ex.targetReps} onChange={(e) => updateExercise(idx, 'targetReps', e.target.value)} className="w-full bg-black border border-white/10 rounded-lg p-2 text-sm text-center font-bold" /></div>
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold text-yellow-500">Carga</label><input type="text" value={ex.targetLoad || ''} onChange={(e) => updateExercise(idx, 'targetLoad', e.target.value)} placeholder="Ej: 80" className="w-full bg-black border border-yellow-500/20 rounded-lg p-2 text-sm text-center font-bold text-yellow-400" /></div>
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold text-blue-500">Descanso</label><input type="number" value={ex.targetRest || ''} onChange={(e) => updateExercise(idx, 'targetRest', parseInt(e.target.value))} className="w-full bg-black border border-blue-500/20 rounded-lg p-2 text-sm text-center font-bold text-blue-400" /></div>
                  </div>
               </div>
             ))}
             <button onClick={() => setShowExerciseSelector(true)} className="w-full py-4 border-2 border-dashed border-white/10 rounded-xl text-gray-500 font-bold hover:border-red-500/50 hover:text-red-500 transition-colors flex items-center justify-center gap-2"><Plus size={20} /> AÑADIR EJERCICIO</button>
          </div>
        ) : <div className="text-center text-gray-500 mt-10">Agrega un día de entrenamiento.</div>}
      </div>
      {showExerciseSelector && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex flex-col animate-fade-in">
          <div className="p-4 border-b border-white/10 flex items-center gap-3 bg-[#0A0A0C]"><button onClick={() => setShowExerciseSelector(false)}><ChevronLeft size={24} /></button><div className="flex-1 bg-white/10 rounded-lg flex items-center px-3 py-2"><Search size={18} className="text-gray-400" /><input autoFocus className="bg-transparent border-none outline-none text-sm ml-2 w-full text-white" placeholder="Buscar ejercicio..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></div></div>
          <div className="flex-1 overflow-y-auto p-4 grid gap-2 pb-20">
            {filteredExercises.map(ex => (<button key={ex.id} onClick={() => handleExerciseSelected(ex)} className="bg-[#111] border border-white/5 p-4 rounded-xl text-left hover:border-red-500 transition-colors flex justify-between items-center"><div><div className="font-bold text-sm">{ex.name}</div><div className="text-[10px] text-gray-500 uppercase bg-white/5 inline-block px-1.5 rounded mt-1">{ex.muscleGroup}</div></div><Plus size={18} className="text-gray-600" /></button>))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- VISTAS DE GESTIÓN (RESTAURADAS) ---

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

const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
  const [client, setClient] = useState<User | undefined>(DataEngine.getUserById(clientId));
  const [plan, setPlan] = useState<Plan | null>(DataEngine.getPlan(clientId));
  const [showManualBuilder, setShowManualBuilder] = useState(false);

  if (!client) return <div className="p-8 text-center text-gray-500">Atleta no encontrado.</div>;

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
          </div>
       </div>
       
       {plan ? (
         <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center px-2 mb-4"><h3 className="text-lg font-bold flex items-center gap-2 text-white uppercase italic font-display">Plan Asignado</h3><button onClick={() => setShowManualBuilder(true)} className="text-[10px] font-bold bg-white/10 text-white border border-white/20 px-4 py-2 rounded-full hover:bg-white/20 flex items-center gap-2 uppercase tracking-widest"><Edit3 size={12}/> Editar</button></div>
            <PlanViewer plan={plan} mode="coach" />
         </div>
       ) : (
         <div className="py-24 text-center text-gray-500 flex flex-col items-center border-2 border-dashed border-white/5 rounded-3xl"><p className="mb-6 font-bold uppercase tracking-widest text-[10px]">Sin plan activo.</p><button onClick={() => { const newP = { id: generateUUID(), title: 'Nuevo Plan', userId: client.id, workouts: [], updatedAt: new Date().toISOString() }; setPlan(newP); setShowManualBuilder(true); }} className="text-[10px] font-bold bg-white text-black px-6 py-3 rounded-xl hover:bg-gray-200 uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95"><Plus size={16}/> CREAR MANUAL</button></div>
       )}
    </div>
  );
};

const WorkoutsView = ({ user }: { user: User }) => {
    const [exercises, setExercises] = useState<Exercise[]>(DataEngine.getExercises());
    const [filter, setFilter] = useState('');
    const filtered = exercises.filter(e => e.name.toLowerCase().includes(filter.toLowerCase()));
    return (
        <div className="space-y-6 animate-fade-in">
             <div className="flex items-center justify-between"><h2 className="text-3xl font-display font-black italic text-white uppercase">BIBLIOTECA</h2></div>
             <div className="relative"><Search className="absolute left-4 top-3.5 text-gray-500" size={18} /><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Buscar ejercicio..." className="w-full bg-[#0F0F11] border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white focus:border-white/20 outline-none" /></div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-32">{filtered.map(ex => (<div key={ex.id} className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl flex justify-between items-center"><div><h4 className="font-bold text-white uppercase text-sm">{ex.name}</h4><span className="text-[10px] text-gray-500 bg-white/5 px-2 py-0.5 rounded mt-1 inline-block uppercase font-bold">{ex.muscleGroup}</span></div></div>))}</div>
        </div>
    );
};

const AdminView = () => {
  return <div className="p-8 text-center text-gray-500">Panel de Administración (Placeholder)</div>;
};

// --- LOGIN Y DASHBOARD ---

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
                        <p className="text-[8px] text-gray-700 uppercase tracking-widest font-bold">v12.7 COMPLETE</p>
                     </div>
                 </div>
             </div>
        </div>
    );
};

const DashboardView = ({ user, onNavigate }: { user: User, onNavigate: (view: string) => void }) => {
    // VISTA COACH
    if (user.role === 'coach' || user.role === 'admin') {
        const clients = DataEngine.getUsers().filter(u => u.role === 'client');
        return (
            <div className="space-y-8 animate-fade-in pb-20">
                <div className="flex justify-between items-center"><div><h2 className="text-4xl font-display font-black italic text-white uppercase tracking-tighter">COMMAND CENTER</h2><p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Gestión de Alto Rendimiento</p></div></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><StatCard label="Atletas" value={clients.length} icon={<Users className="text-blue-500" size={16} />} /><StatCard label="Protocolos" value={DataEngine.getUsers().length} icon={<Activity className="text-green-500" size={16} />} /><StatCard label="Librería" value={DataEngine.getExercises().length} icon={<Dumbbell className="text-orange-500" size={16} />} /><StatCard label="Status" value="OK" icon={<Shield className="text-red-500" size={16} />} /></div>
                <div className="bg-[#0F0F11] border border-white/5 p-6 rounded-[2.5rem] shadow-xl"><div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-white uppercase font-display italic">Acciones Rápidas</h3></div><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <button onClick={() => onNavigate('clients')} className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-red-500/30 transition-all text-left group"><div className="bg-red-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-red-500 mb-4 group-hover:scale-110 transition-transform"><UserPlus size={24}/></div><h4 className="font-bold text-white uppercase text-sm">Gestionar Atletas</h4><p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">Ver lista, crear planes, asignar rutinas.</p></button>
                         <button onClick={() => onNavigate('workouts')} className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all text-left group"><div className="bg-blue-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform"><Dumbbell size={24}/></div><h4 className="font-bold text-white uppercase text-sm">Biblioteca</h4><p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">Gestionar ejercicios y videos tutoriales.</p></button>
                         {user.role === 'admin' && (<button onClick={() => onNavigate('admin')} className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-yellow-500/30 transition-all text-left group"><div className="bg-yellow-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-yellow-500 mb-4 group-hover:scale-110 transition-transform"><Briefcase size={24}/></div><h4 className="font-bold text-white uppercase text-sm">Ajustes Admin</h4><p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">Configuración total del sistema.</p></button>)}
                    </div></div>
            </div>
        );
    }
    // VISTA ATLETA
    const plan = DataEngine.getPlan(user.id);
    return (
        <div className="space-y-10 animate-fade-in pb-32">
            <div className="flex justify-between items-start"><div><h2 className="text-4xl font-display font-black italic text-white uppercase tracking-tighter">HOLA, {user.name.split(' ')[0]} 👋</h2><p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-1">Status: {user.level} • {user.role}</p></div><div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-white shadow-lg">{user.name[0]}</div></div>
            <div className="grid grid-cols-2 gap-4"><StatCard label="Racha" value={user.streak} icon={<Flame size={16} className="text-red-500"/>} /><StatCard label="Nivel" value={user.level} icon={<Sparkles size={16} className="text-yellow-500"/>} /></div>
            {plan ? (<div><h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 uppercase italic font-display"><Flame size={18} className="text-red-500"/> Protocolo Activo</h3><PlanViewer plan={plan} mode="athlete" /></div>) : (<div className="py-24 text-center border-2 border-dashed border-white/5 rounded-[2.5rem] flex flex-col items-center gap-4"><Dumbbell size={48} className="text-gray-800" /><div><p className="text-gray-500 font-bold uppercase tracking-widest text-[10px]">Sin Protocolo Activo</p><p className="text-[9px] text-gray-700 font-bold mt-1 uppercase tracking-tighter">Contacta a tu coach para recibir tu programación</p></div></div>)}
        </div>
    );
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [view, setView] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
     DataEngine.init();
     const session = localStorage.getItem(SESSION_KEY);
     if(session) { const u = DataEngine.getUserById(session); if(u) setUser(u); }
  }, []);

  const login = (u: User) => { localStorage.setItem(SESSION_KEY, u.id); setUser(u); setView('dashboard'); };
  const logout = () => { localStorage.removeItem(SESSION_KEY); setUser(null); };

  if (!user) return <LoginPage onLogin={login} />;

  return (
    <div className="min-h-[100dvh] bg-[#050507] text-gray-200 font-sans selection:bg-red-500/30">
        <aside className="fixed left-0 top-0 h-full w-64 bg-[#0F0F11] border-r border-white/5 p-6 hidden md:flex flex-col z-40">
            <BrandingLogo />
            <nav className="flex-1 space-y-2 mt-10">
                <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />
                {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'clients' || view === 'client-detail'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Atletas" />}
                {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'workouts'} onClick={() => setView('workouts')} icon={<Dumbbell size={20} />} label="Biblioteca" />}
                <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Perfil" />
            </nav>
            <div className="mt-auto pb-6 border-t border-white/5 pt-6">
                <SocialLinks className="justify-center" />
                <button onClick={logout} className="flex items-center gap-3 text-gray-500 hover:text-red-500 transition-colors px-4 mt-8 w-full"><LogOut size={20} /> <span className="font-bold text-sm uppercase tracking-widest">Salir</span></button>
            </div>
        </aside>

        <div className="md:hidden fixed top-0 left-0 right-0 bg-[#050507]/90 backdrop-blur-xl border-b border-white/5 p-4 z-40 flex justify-between items-center"><BrandingLogo textSize="text-lg" /><div className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center font-bold text-xs shadow-lg">{user.name[0]}</div></div>
        
        <main className="md:ml-64 p-4 md:p-8 pt-20 md:pt-8 min-h-screen relative">
            {view === 'dashboard' && <DashboardView user={user} onNavigate={setView} />}
            {view === 'clients' && <ClientsView onSelect={(id) => { setSelectedClientId(id); setView('client-detail'); }} user={user} />}
            {view === 'client-detail' && selectedClientId && <ClientDetailView clientId={selectedClientId} onBack={() => setView('clients')} />}
            {view === 'workouts' && <WorkoutsView user={user} />}
            {view === 'profile' && <div className="p-8 text-center"><h2 className="text-2xl font-bold mb-4">Perfil de {user.name}</h2><button onClick={logout} className="bg-red-600 px-6 py-2 rounded-xl text-white font-bold">Cerrar Sesión</button></div>}
            {view === 'admin' && <AdminView />}
        </main>

        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0F0F11]/95 backdrop-blur-xl border-t border-white/5 px-6 py-2 flex justify-between items-center z-40 pb-safe shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
            <MobileNavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20} />} label="Inicio" />
            {(user.role === 'coach' || user.role === 'admin') && <MobileNavButton active={view === 'clients'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Atletas" />}
            <MobileNavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Perfil" />
        </div>
        
        <ConnectionStatus />
    </div>
  );
}
