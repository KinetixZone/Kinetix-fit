import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, Sparkles, Activity,
  Dumbbell, History, Check, ShieldAlert, Search,
  User as UserIcon, Timer as TimerIcon, AlertTriangle, Loader2, Zap, BrainCircuit,
  CalendarDays, Trophy, Pencil, Menu, Youtube, Info, UserMinus, UserCog, Circle, CheckCircle,
  MoreVertical, Flame, StopCircle, ClipboardList, Disc, MessageSquare, Send, TrendingUp, Shield, Palette, MapPin,
  Briefcase, BarChart4, AlertOctagon, MessageCircle, Power, UserX, UserCheck, KeyRound, Mail, Minus,
  Instagram, Facebook, Linkedin, Phone, Sliders, Calendar, List, Database, Copy, Settings2, FileJson
} from 'lucide-react';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, SetEntry, WorkoutProgress, UserRole, TrainingMethod } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES, INITIAL_TEMPLATES } from './constants';
import { supabaseConnectionStatus } from './services/supabaseClient';

// --- CONFIGURACIÓN DE VERSIÓN ---
const STORAGE_KEY = 'KINETIX_DATA_V1_CLASSIC';
const SESSION_KEY = 'KINETIX_SESSION_V1';
const OFFICIAL_LOGO_URL = 'https://raw.githubusercontent.com/KinetixZone/Kinetix-fit/32b6e2ce7e4abcd5b5018cdb889feec444a66e22/TEAM%20JG.jpg';

const generateUUID = () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

// --- MOTOR DE DATOS (CORE) ---
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
    
    // 1. Inicializar Usuarios si no existen
    if (!store.USERS) {
      const initialUsers = [
          { ...MOCK_USER, isActive: true },
          { id: 'coach-1', name: 'Jorge Gonzalez', email: 'coach@kinetix.com', role: 'coach' as UserRole, goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, streak: 99, daysPerWeek: 6, equipment: [], createdAt: new Date().toISOString(), isActive: true },
          { id: 'admin-1', name: 'Admin System', email: 'admin@kinetix.com', role: 'admin' as UserRole, goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED, streak: 0, daysPerWeek: 0, equipment: [], createdAt: new Date().toISOString(), isActive: true }
      ];
      store.USERS = JSON.stringify(initialUsers);
    }

    // 2. FORCE SYNC: Asegurar que ejercicios y plantillas existan
    const currentExercises = store.EXERCISES ? JSON.parse(store.EXERCISES) : [];
    if (currentExercises.length === 0) {
        store.EXERCISES = JSON.stringify(INITIAL_EXERCISES);
    }
    
    const currentTemplates = store.TEMPLATES_DB ? JSON.parse(store.TEMPLATES_DB) : [];
    if (currentTemplates.length === 0) {
        store.TEMPLATES_DB = JSON.stringify(INITIAL_TEMPLATES);
    }

    // 3. Configuración base
    if (!store.CONFIG) {
        store.CONFIG = JSON.stringify({ appName: 'KINETIX ZONE', logoUrl: OFFICIAL_LOGO_URL });
    }

    DataEngine.saveStore(store);
  },
  getConfig: () => JSON.parse(DataEngine.getStore().CONFIG || '{}'),
  getUsers: (): User[] => JSON.parse(DataEngine.getStore().USERS || '[]'),
  getUserById: (id: string) => DataEngine.getUsers().find((u: User) => u.id === id),
  getUserByNameOrEmail: (query: string) => {
    const q = query.toLowerCase().trim();
    return DataEngine.getUsers().find((u: User) => u.email.toLowerCase() === q || u.name.toLowerCase() === q);
  },
  saveUser: (user: User) => {
    const users = DataEngine.getUsers();
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    const store = DataEngine.getStore();
    store.USERS = JSON.stringify(users);
    DataEngine.saveStore(store);
  },
  getExercises: (): Exercise[] => JSON.parse(DataEngine.getStore().EXERCISES || '[]'),
  saveExercise: (exercise: Exercise) => {
      const store = DataEngine.getStore();
      const exercises = store.EXERCISES ? JSON.parse(store.EXERCISES) : [];
      const idx = exercises.findIndex((e: Exercise) => e.id === exercise.id);
      if (idx >= 0) exercises[idx] = exercise; else exercises.push(exercise);
      store.EXERCISES = JSON.stringify(exercises);
      DataEngine.saveStore(store);
  },
  deleteExercise: (id: string) => {
      const store = DataEngine.getStore();
      let exercises = store.EXERCISES ? JSON.parse(store.EXERCISES) : [];
      exercises = exercises.filter((e: Exercise) => e.id !== id);
      store.EXERCISES = JSON.stringify(exercises);
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
    const totalVolume = Object.values(logs).reduce((acc: number, sets: any[]) => acc + sets.reduce((sAcc, s) => sAcc + (parseFloat(s.weight) * parseInt(s.reps)), 0), 0);

    const session = {
      id: generateUUID(),
      workoutId: workout.id,
      workoutName: workout.name,
      date: new Date().toISOString(),
      logs,
      summary: { durationMinutes, totalVolume }
    };
    history.unshift(session);
    store[historyKey] = JSON.stringify(history);
    delete store[`LOG_${userId}_${workout.id}`];
    
    // Streak logic
    const users = DataEngine.getUsers();
    const uIdx = users.findIndex((u: User) => u.id === userId);
    if(uIdx >= 0) users[uIdx].streak += 1;
    store.USERS = JSON.stringify(users);
    
    DataEngine.saveStore(store);
    return session;
  },
  getClientHistory: (userId: string) => JSON.parse(DataEngine.getStore()[`HISTORY_${userId}`] || '[]'),
  getTemplates: (): Plan[] => JSON.parse(DataEngine.getStore().TEMPLATES_DB || '[]'),
  saveTemplate: (template: Plan) => {
      const store = DataEngine.getStore();
      const templates = store.TEMPLATES_DB ? JSON.parse(store.TEMPLATES_DB) : [];
      const idx = templates.findIndex((t: Plan) => t.id === template.id);
      if (idx >= 0) templates[idx] = template; else templates.push(template);
      store.TEMPLATES_DB = JSON.stringify(templates);
      DataEngine.saveStore(store);
  },
  deleteTemplate: (id: string) => {
      const store = DataEngine.getStore();
      let templates = store.TEMPLATES_DB ? JSON.parse(store.TEMPLATES_DB) : [];
      templates = templates.filter((t: Plan) => t.id !== id);
      store.TEMPLATES_DB = JSON.stringify(templates);
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

// --- COMPONENTES LÓGICOS PRINCIPALES ---

// COMPONENTE: INPUTS DINÁMICOS POR MÉTODO
const ExerciseConfigInputs = ({ exercise, onChange }: { exercise: WorkoutExercise, onChange: (field: string, value: any, subObject?: string) => void }) => {
    const method = exercise.method || 'standard';

    // 1. FUERZA (STANDARD)
    if (method === 'standard') {
        return (
            <div className="space-y-2">
                <div className="grid grid-cols-4 gap-2">
                     <div><label className="text-[9px] text-gray-500 uppercase font-bold">Kg</label><input type="text" value={exercise.targetLoad || ''} onChange={(e) => onChange('targetLoad', e.target.value)} className="w-full bg-black border border-yellow-500/30 text-yellow-500 text-xs p-1.5 rounded text-center"/></div>
                     <div><label className="text-[9px] text-gray-500 uppercase font-bold">Reps</label><input type="text" value={exercise.targetReps || ''} onChange={(e) => onChange('targetReps', e.target.value)} className="w-full bg-black border border-white/20 text-white text-xs p-1.5 rounded text-center"/></div>
                     <div><label className="text-[9px] text-gray-500 uppercase font-bold">Sets</label><input type="number" value={exercise.targetSets || ''} onChange={(e) => onChange('targetSets', e.target.value)} className="w-full bg-black border border-white/20 text-white text-xs p-1.5 rounded text-center"/></div>
                     <div><label className="text-[9px] text-gray-500 uppercase font-bold">Rest(s)</label><input type="number" value={exercise.targetRest || ''} onChange={(e) => onChange('targetRest', e.target.value)} className="w-full bg-black border border-blue-500/30 text-blue-400 text-xs p-1.5 rounded text-center"/></div>
                </div>
                <div>
                     <label className="text-[9px] text-gray-500 uppercase font-bold">Tempo (Opcional)</label>
                     <input type="text" value={exercise.tempo || ''} onChange={(e) => onChange('tempo', e.target.value)} className="w-full bg-black border border-white/10 text-gray-300 text-xs p-1.5 rounded" placeholder="Ej: 3-1-1-0"/>
                </div>
            </div>
        );
    }

    // 2. AHAP
    if (method === 'ahap') {
        return (
            <div className="bg-red-900/10 p-2 rounded border border-red-500/20 space-y-2">
                <div className="text-[9px] text-red-400 font-bold uppercase mb-1">Configuración AHAP</div>
                <div className="grid grid-cols-3 gap-2">
                    <div><label className="text-[9px] text-gray-500 uppercase">Kg</label><input type="text" value={exercise.targetLoad || ''} onChange={(e) => onChange('targetLoad', e.target.value)} className="w-full bg-black border border-red-500/30 text-red-400 text-xs p-1.5 rounded text-center"/></div>
                    <div><label className="text-[9px] text-gray-500 uppercase">Reps</label><input type="text" value={exercise.targetReps || ''} onChange={(e) => onChange('targetReps', e.target.value)} className="w-full bg-black border border-white/20 text-white text-xs p-1.5 rounded text-center"/></div>
                    <div><label className="text-[9px] text-gray-500 uppercase">Rest(s)</label><input type="number" value={exercise.targetRest || ''} onChange={(e) => onChange('targetRest', e.target.value)} className="w-full bg-black border border-blue-500/30 text-blue-400 text-xs p-1.5 rounded text-center"/></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                     <div><label className="text-[9px] text-gray-500 uppercase">Rounds (Opcional)</label><input type="number" value={exercise.ahapConfig?.rounds || ''} onChange={(e) => onChange('rounds', e.target.value, 'ahapConfig')} className="w-full bg-black border border-white/10 text-white text-xs p-1.5 rounded"/></div>
                     <div><label className="text-[9px] text-gray-500 uppercase">Reps Objetivo</label><input type="text" value={exercise.ahapConfig?.targetReps || ''} onChange={(e) => onChange('targetReps', e.target.value, 'ahapConfig')} className="w-full bg-black border border-white/10 text-white text-xs p-1.5 rounded" placeholder="Meta"/></div>
                </div>
            </div>
        );
    }

    // 3. BISERIE
    if (method === 'biserie') {
        return (
            <div className="space-y-3">
                <div className="bg-white/5 p-2 rounded border-l-2 border-blue-500">
                    <div className="text-[9px] text-gray-400 uppercase mb-1 font-bold">1. {exercise.name}</div>
                    <div className="grid grid-cols-3 gap-2">
                         <input type="text" value={exercise.targetLoad || ''} onChange={(e) => onChange('targetLoad', e.target.value)} className="w-full bg-black border border-yellow-500/30 text-yellow-500 text-xs p-1 rounded text-center" placeholder="Kg"/>
                         <input type="text" value={exercise.targetReps || ''} onChange={(e) => onChange('targetReps', e.target.value)} className="w-full bg-black border border-white/20 text-white text-xs p-1 rounded text-center" placeholder="Reps"/>
                         <input type="number" value={exercise.targetRest || ''} onChange={(e) => onChange('targetRest', e.target.value)} className="w-full bg-black border border-blue-500/30 text-blue-400 text-xs p-1 rounded text-center" placeholder="Rest"/>
                    </div>
                </div>
                {exercise.pair ? (
                    <div className="bg-white/5 p-2 rounded border-l-2 border-red-500">
                        <div className="text-[9px] text-gray-400 uppercase mb-1 font-bold">2. {exercise.pair.name}</div>
                        <div className="grid grid-cols-3 gap-2">
                            <input type="text" value={exercise.pair.targetLoad || ''} onChange={(e) => onChange('targetLoad', e.target.value, 'pair')} className="w-full bg-black border border-yellow-500/30 text-yellow-500 text-xs p-1 rounded text-center" placeholder="Kg"/>
                            <input type="text" value={exercise.pair.targetReps || ''} onChange={(e) => onChange('targetReps', e.target.value, 'pair')} className="w-full bg-black border border-white/20 text-white text-xs p-1 rounded text-center" placeholder="Reps"/>
                            <input type="number" value={exercise.pair.targetRest || ''} onChange={(e) => onChange('targetRest', e.target.value, 'pair')} className="w-full bg-black border border-blue-500/30 text-blue-400 text-xs p-1 rounded text-center" placeholder="Rest"/>
                        </div>
                    </div>
                ) : (
                    <div className="text-[10px] text-red-500 italic px-2">⚠️ Falta configurar ejercicio par.</div>
                )}
            </div>
        );
    }

    // 4. DROPSET
    if (method === 'dropset') {
        const dropMode = exercise.dropConfig?.mode || 'PERCENT';
        return (
            <div className="bg-purple-900/10 p-2 rounded border border-purple-500/20 space-y-2">
                <div className="text-[9px] text-purple-400 font-bold uppercase mb-1">Configuración Drop Set</div>
                <div className="grid grid-cols-2 gap-2">
                     <div><label className="text-[9px] text-gray-500 uppercase">Carga Inicial</label><input type="text" value={exercise.dropConfig?.initialLoad || exercise.targetLoad || ''} onChange={(e) => onChange('initialLoad', e.target.value, 'dropConfig')} className="w-full bg-black border border-yellow-500/30 text-yellow-500 text-xs p-1.5 rounded text-center"/></div>
                     <div>
                        <label className="text-[9px] text-gray-500 uppercase">Modo Drop</label>
                        <div className="flex bg-black rounded border border-white/10 p-0.5">
                            <button onClick={() => onChange('mode', 'PERCENT', 'dropConfig')} className={`flex-1 text-[9px] rounded py-0.5 ${dropMode === 'PERCENT' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}>%</button>
                            <button onClick={() => onChange('mode', 'KG', 'dropConfig')} className={`flex-1 text-[9px] rounded py-0.5 ${dropMode === 'KG' ? 'bg-purple-600 text-white' : 'text-gray-500'}`}>KG</button>
                        </div>
                     </div>
                </div>
                <div>
                     <label className="text-[9px] text-gray-500 uppercase">Valor del Drop ({dropMode === 'PERCENT' ? '%' : 'Kg'})</label>
                     <input type="number" value={exercise.dropConfig?.value || ''} onChange={(e) => onChange('value', e.target.value, 'dropConfig')} className="w-full bg-black border border-purple-500/30 text-purple-300 text-xs p-1.5 rounded" placeholder={dropMode === 'PERCENT' ? "Ej: 20" : "Ej: 5"}/>
                </div>
                <div className="grid grid-cols-2 gap-2">
                     <div><label className="text-[9px] text-gray-500 uppercase">Reps</label><input type="text" value={exercise.targetReps || ''} onChange={(e) => onChange('targetReps', e.target.value)} className="w-full bg-black border border-white/20 text-white text-xs p-1.5 rounded text-center"/></div>
                     <div><label className="text-[9px] text-gray-500 uppercase">Rest(s)</label><input type="number" value={exercise.targetRest || ''} onChange={(e) => onChange('targetRest', e.target.value)} className="w-full bg-black border border-blue-500/30 text-blue-400 text-xs p-1.5 rounded text-center"/></div>
                </div>
            </div>
        );
    }

    // 5. TABATA
    if (method === 'tabata') {
         return (
            <div className="bg-indigo-900/10 p-2 rounded border border-indigo-500/20 mb-2 space-y-2">
                <div className="text-[9px] text-indigo-400 font-bold uppercase">Protocolo Tabata</div>
                <div className="grid grid-cols-3 gap-2">
                     <div><label className="text-[9px] text-gray-500">Trabajo (s)</label><input type="number" value={exercise.tabataConfig?.workTimeSec || 20} onChange={(e) => onChange('workTimeSec', e.target.value, 'tabataConfig')} className="w-full bg-black text-white text-xs p-1.5 rounded"/></div>
                     <div><label className="text-[9px] text-gray-500">Descanso (s)</label><input type="number" value={exercise.tabataConfig?.restTimeSec || 10} onChange={(e) => onChange('restTimeSec', e.target.value, 'tabataConfig')} className="w-full bg-black text-white text-xs p-1.5 rounded"/></div>
                     <div><label className="text-[9px] text-gray-500">Rounds</label><input type="number" value={exercise.tabataConfig?.rounds || 8} onChange={(e) => onChange('rounds', e.target.value, 'tabataConfig')} className="w-full bg-black text-white text-xs p-1.5 rounded"/></div>
                </div>
                <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-2">
                     <div><label className="text-[9px] text-gray-500">Sets</label><input type="number" value={exercise.tabataConfig?.sets || 1} onChange={(e) => onChange('sets', e.target.value, 'tabataConfig')} className="w-full bg-black text-white text-xs p-1.5 rounded"/></div>
                     <div><label className="text-[9px] text-gray-500">Rest/Set (s)</label><input type="number" value={exercise.tabataConfig?.restBetweenSetsSec || 60} onChange={(e) => onChange('restBetweenSetsSec', e.target.value, 'tabataConfig')} className="w-full bg-black text-white text-xs p-1.5 rounded"/></div>
                </div>
            </div>
        );
    }

    // 6. EMOM
    if (method === 'emom') {
        const emomMode = exercise.emomConfig?.mode || 'REPS';
        return (
             <div className="bg-orange-900/10 p-2 rounded border border-orange-500/20 mb-2 space-y-2">
                <div className="text-[9px] text-orange-400 font-bold uppercase">Protocolo EMOM</div>
                <div className="flex bg-black rounded border border-white/10 p-0.5 mb-2">
                    <button onClick={() => onChange('mode', 'REPS', 'emomConfig')} className={`flex-1 text-[9px] rounded py-0.5 ${emomMode === 'REPS' ? 'bg-orange-600 text-white' : 'text-gray-500'}`}>Reps</button>
                    <button onClick={() => onChange('mode', 'TIME', 'emomConfig')} className={`flex-1 text-[9px] rounded py-0.5 ${emomMode === 'TIME' ? 'bg-orange-600 text-white' : 'text-gray-500'}`}>Tiempo</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                     <div>
                         <label className="text-[9px] text-gray-500">{emomMode === 'REPS' ? 'Reps/Min' : 'Seg/Min'}</label>
                         {emomMode === 'REPS' 
                            ? <input type="text" value={exercise.targetReps || ''} onChange={(e) => onChange('targetReps', e.target.value)} className="w-full bg-black text-white text-xs p-1.5 rounded"/>
                            : <input type="number" value={exercise.emomConfig?.simpleConfig?.durationSec || ''} onChange={(e) => onChange('durationSec', e.target.value, 'emomConfig')} className="w-full bg-black text-white text-xs p-1.5 rounded"/>
                         }
                     </div>
                     <div><label className="text-[9px] text-gray-500">Minutos Totales</label><input type="number" value={exercise.emomConfig?.durationMin || 10} onChange={(e) => onChange('durationMin', e.target.value, 'emomConfig')} className="w-full bg-black text-white text-xs p-1.5 rounded"/></div>
                </div>
            </div>
        );
    }
    return null;
};

// COMPONENTE: ASISTENTE DE ASIGNACIÓN (WIZARD)
const AssignmentWizard = ({ template, onClose, onConfirm }: { template: Plan, onClose: () => void, onConfirm: (finalPlan: Plan) => void }) => {
    const [step, setStep] = useState<'mode' | 'customize'>('mode');
    const [customizedPlan, setCustomizedPlan] = useState<Plan | null>(null);

    // Clonar plantilla al montar para inmutabilidad
    useEffect(() => {
        if (template) {
            setCustomizedPlan(JSON.parse(JSON.stringify(template)));
        }
    }, [template]);

    const handleUpdate = (wIdx: number, eIdx: number, field: string, value: any, subObject?: string) => {
        if (!customizedPlan) return;
        const newPlan = JSON.parse(JSON.stringify(customizedPlan));
        const ex = newPlan.workouts[wIdx].exercises[eIdx];
        
        if (subObject) {
            if (!ex[subObject]) ex[subObject] = {};
            ex[subObject][field] = value;
        } else {
            ex[field] = value;
        }
        setCustomizedPlan(newPlan);
    };

    const handleMethodChange = (wIdx: number, eIdx: number, method: TrainingMethod) => {
        if (!customizedPlan) return;
        const newPlan = JSON.parse(JSON.stringify(customizedPlan));
        newPlan.workouts[wIdx].exercises[eIdx].method = method;
        setCustomizedPlan(newPlan);
    };

    const confirmCustomization = () => {
        if (customizedPlan) onConfirm(customizedPlan);
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-[#1A1A1D] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center border-b border-white/10 p-5">
                    <div>
                        <h3 className="text-xl font-bold text-white uppercase italic">Asignar: {template.title}</h3>
                        <p className="text-xs text-gray-500">Configuración de parámetros de entrenamiento</p>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-white"/></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'mode' && (
                        <div className="space-y-6 text-center py-8">
                            <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50"><Settings2 size={32}/></div>
                            <h4 className="text-lg font-bold text-white">¿Cómo deseas asignar esta rutina?</h4>
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <button onClick={() => onConfirm(template)} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group">
                                    <Copy size={24} className="text-gray-500 mb-2 group-hover:text-white mx-auto"/>
                                    <div className="font-bold text-white text-sm">Asignar Tal Cual</div>
                                    <div className="text-[10px] text-gray-500 mt-1">Valores base de la plantilla</div>
                                </button>
                                <button onClick={() => setStep('customize')} className="p-4 bg-red-600/10 border border-red-600/30 rounded-xl hover:bg-red-600/20 transition-all group">
                                    <Edit3 size={24} className="text-red-500 mb-2 group-hover:text-white mx-auto"/>
                                    <div className="font-bold text-white text-sm">Personalizar Ahora</div>
                                    <div className="text-[10px] text-red-400 mt-1">Ajustar cargas y métodos</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'customize' && customizedPlan && (
                        <div className="space-y-8">
                            {customizedPlan.workouts.map((workout, wIdx) => (
                                <div key={workout.id} className="space-y-3">
                                    <h5 className="text-sm font-bold text-white border-b border-white/10 pb-1">{workout.name}</h5>
                                    <div className="grid grid-cols-1 gap-3">
                                        {workout.exercises.map((ex, eIdx) => (
                                            <div key={eIdx} className="bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/20 transition-colors">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-bold text-gray-300">{ex.name}</span>
                                                    <select 
                                                        value={ex.method || 'standard'} 
                                                        onChange={(e) => handleMethodChange(wIdx, eIdx, e.target.value as TrainingMethod)}
                                                        className="text-[9px] bg-black border border-white/10 rounded px-2 py-1 text-blue-400 uppercase font-bold outline-none"
                                                    >
                                                        <option value="standard">Standard</option>
                                                        <option value="ahap">AHAP</option>
                                                        <option value="biserie">Biserie</option>
                                                        <option value="dropset">Drop Set</option>
                                                        <option value="tabata">Tabata</option>
                                                        <option value="emom">EMOM</option>
                                                    </select>
                                                </div>
                                                <ExerciseConfigInputs exercise={ex} onChange={(f, v, s) => handleUpdate(wIdx, eIdx, f, v, s)} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-5 border-t border-white/10 flex justify-between items-center bg-[#151518] rounded-b-2xl">
                    <button onClick={step === 'mode' ? onClose : () => setStep('mode')} className="text-gray-500 text-xs font-bold hover:text-white flex items-center gap-1"><ChevronLeft size={14}/> {step === 'mode' ? 'CANCELAR' : 'VOLVER'}</button>
                    {step === 'customize' && <button onClick={confirmCustomization} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-500 flex items-center gap-2 shadow-lg shadow-red-900/20">CONFIRMAR CAMBIOS <CheckCircle2 size={14}/></button>}
                </div>
            </div>
        </div>
    );
};

// COMPONENTE: CONSTRUCTOR DE PLANES
const ManualPlanBuilder = ({ plan, onSave, onCancel }: { plan: Plan, onSave: (p: Plan) => void, onCancel: () => void }) => {
    const [editedPlan, setEditedPlan] = useState<Plan>(plan);
    const [showExerciseSelector, setShowExerciseSelector] = useState(false);
    const [currentWorkoutIndex, setCurrentWorkoutIndex] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const exercises = DataEngine.getExercises();

    const addWorkout = () => {
        setEditedPlan(prev => ({
            ...prev,
            workouts: [...prev.workouts, { id: generateUUID(), name: `Día ${prev.workouts.length + 1}`, day: prev.workouts.length + 1, exercises: [] }]
        }));
        setCurrentWorkoutIndex(editedPlan.workouts.length);
    };

    const handleAddExercise = (ex: Exercise) => {
        const newEx: WorkoutExercise = { 
            exerciseId: ex.id, 
            name: ex.name, 
            targetSets: 4, 
            targetReps: '10', 
            targetRest: 60, 
            coachCue: '', 
            method: 'standard', // Default method
            videoUrl: ex.videoUrl 
        };
        const newWorkouts = [...editedPlan.workouts];
        newWorkouts[currentWorkoutIndex].exercises.push(newEx);
        setEditedPlan({...editedPlan, workouts: newWorkouts});
        setShowExerciseSelector(false);
    };

    const updateExercise = (wIdx: number, eIdx: number, field: string, value: any, subObject?: string) => {
        const newWorkouts = [...editedPlan.workouts];
        const exercise = newWorkouts[wIdx].exercises[eIdx] as any;
        
        if (subObject) {
            if (!exercise[subObject]) exercise[subObject] = {};
            exercise[subObject][field] = value;
        } else {
            exercise[field] = value;
        }
        setEditedPlan({...editedPlan, workouts: newWorkouts});
    };

    const removeExercise = (wIdx: number, eIdx: number) => {
        const newWorkouts = [...editedPlan.workouts];
        newWorkouts[wIdx].exercises.splice(eIdx, 1);
        setEditedPlan({...editedPlan, workouts: newWorkouts});
    };

    const filteredExercises = exercises.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <div className="fixed inset-0 bg-[#0A0A0C] z-[60] flex flex-col overflow-y-auto pb-20">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-[#0A0A0C] sticky top-0 z-10">
                <input value={editedPlan.title} onChange={e => setEditedPlan({...editedPlan, title: e.target.value})} className="bg-transparent text-xl font-bold text-white outline-none w-full" placeholder="Nombre de la Rutina" />
                <div className="flex gap-2">
                    <button onClick={onCancel} className="p-2 bg-white/10 rounded-lg text-gray-400 hover:text-white"><X size={20}/></button>
                    <button onClick={() => onSave(editedPlan)} className="p-2 bg-red-600 rounded-lg text-white hover:bg-red-500"><Save size={20}/></button>
                </div>
            </div>

            <div className="p-4 space-y-6">
                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {editedPlan.workouts.map((w, idx) => (
                        <button key={w.id} onClick={() => setCurrentWorkoutIndex(idx)} className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${currentWorkoutIndex === idx ? 'bg-white text-black' : 'bg-white/5 text-gray-500'}`}>{w.name}</button>
                    ))}
                    <button onClick={addWorkout} className="px-3 py-2 rounded-full bg-red-900/20 text-red-500 border border-red-500/20 text-xs font-bold flex items-center gap-1"><Plus size={12}/> DÍA</button>
                </div>

                {editedPlan.workouts[currentWorkoutIndex] && (
                    <div className="space-y-4">
                        <input value={editedPlan.workouts[currentWorkoutIndex].name} onChange={e => {const nw = [...editedPlan.workouts]; nw[currentWorkoutIndex].name = e.target.value; setEditedPlan({...editedPlan, workouts: nw})}} className="bg-transparent text-lg font-bold text-red-500 outline-none w-full border-b border-white/10 pb-1 mb-2" />
                        {editedPlan.workouts[currentWorkoutIndex].exercises.map((ex, idx) => (
                            <div key={idx} className="bg-[#151518] p-4 rounded-xl border border-white/5 relative">
                                <div className="flex justify-between items-start mb-3">
                                    <span className="font-bold text-white">{ex.name}</span>
                                    <button onClick={() => removeExercise(currentWorkoutIndex, idx)} className="text-gray-600 hover:text-red-500"><Trash2 size={16}/></button>
                                </div>

                                <div className="mb-3">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Modo de Entrenamiento</label>
                                    <select value={ex.method || 'standard'} onChange={(e) => updateExercise(currentWorkoutIndex, idx, 'method', e.target.value as TrainingMethod)} className="w-full bg-black border border-white/10 rounded p-2 text-xs text-blue-400 outline-none mt-1 uppercase font-bold">
                                        <option value="standard">Standard</option>
                                        <option value="biserie">Biserie</option>
                                        <option value="ahap">AHAP</option>
                                        <option value="dropset">Drop Set</option>
                                        <option value="tabata">Tabata</option>
                                        <option value="emom">EMOM</option>
                                    </select>
                                </div>
                                
                                <ExerciseConfigInputs 
                                    exercise={ex} 
                                    onChange={(f, v, s) => updateExercise(currentWorkoutIndex, idx, f, v, s)} 
                                />

                                <input placeholder="Notas técnicas..." value={ex.coachCue || ''} onChange={e => updateExercise(currentWorkoutIndex, idx, 'coachCue', e.target.value)} className="w-full bg-black border border-white/10 rounded p-2 text-xs text-gray-300 outline-none mt-2"/>
                            </div>
                        ))}
                        <button onClick={() => setShowExerciseSelector(true)} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-gray-500 font-bold text-xs hover:text-white flex items-center justify-center gap-2"><Plus size={16}/> AÑADIR EJERCICIO</button>
                    </div>
                )}
            </div>

            {showExerciseSelector && (
                <div className="fixed inset-0 bg-[#0A0A0C] z-[70] flex flex-col">
                    <div className="p-4 border-b border-white/10 flex items-center gap-3"><button onClick={() => setShowExerciseSelector(false)}><ChevronLeft size={24}/></button><div className="flex-1 bg-white/10 rounded-lg flex items-center px-3 py-2"><Search size={16} className="text-gray-400"/><input autoFocus className="bg-transparent border-none outline-none text-sm ml-2 w-full text-white" placeholder="Buscar..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/></div></div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {filteredExercises.map(ex => (
                            <button key={ex.id} onClick={() => handleAddExercise(ex)} className="w-full bg-[#151518] p-3 rounded-xl flex justify-between items-center text-left hover:bg-white/5"><div><div className="font-bold text-sm text-white">{ex.name}</div><div className="text-[10px] text-gray-500">{ex.muscleGroup}</div></div><Plus size={16} className="text-gray-500"/></button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

const RoutinesView = ({ onAssign }: { onAssign?: (template: Plan) => void }) => {
    const [templates, setTemplates] = useState<Plan[]>(DataEngine.getTemplates());
    const [editingTemplate, setEditingTemplate] = useState<Plan | null>(null);

    const refresh = () => setTemplates(DataEngine.getTemplates());

    const handleCreate = () => {
        const newTemplate: Plan = {
            id: generateUUID(),
            title: 'Nueva Rutina',
            userId: 'TEMPLATE',
            workouts: [],
            updatedAt: new Date().toISOString()
        };
        setEditingTemplate(newTemplate);
    };

    const handleSave = (plan: Plan) => {
        DataEngine.saveTemplate(plan);
        setEditingTemplate(null);
        refresh();
    };

    const handleDelete = (id: string) => {
        if (window.confirm('¿Eliminar plantilla permanentemente?')) {
            DataEngine.deleteTemplate(id);
            refresh();
        }
    };

    if (editingTemplate) {
        return <ManualPlanBuilder plan={editingTemplate} onSave={handleSave} onCancel={() => setEditingTemplate(null)} />;
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                {!onAssign && <h2 className="text-2xl font-bold text-white uppercase italic">Biblioteca de Rutinas</h2>}
                <button onClick={handleCreate} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-colors shadow-lg shadow-red-900/20"><Plus size={16}/> CREAR NUEVA</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {templates.map(tpl => (
                    <div key={tpl.id} className="bg-[#151518] p-5 rounded-2xl border border-white/5 hover:border-white/20 transition-all group relative flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 bg-gradient-to-br from-gray-800 to-black rounded-xl border border-white/10 flex items-center justify-center text-gray-400"><ClipboardList size={20}/></div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => setEditingTemplate(tpl)} className="p-2 hover:bg-white/10 rounded-lg text-blue-400 transition-colors"><Edit3 size={16}/></button>
                                <button onClick={() => handleDelete(tpl.id)} className="p-2 hover:bg-red-900/20 rounded-lg text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </div>
                        </div>
                        
                        <h3 className="font-bold text-white text-lg mb-1 truncate">{tpl.title}</h3>
                        <p className="text-xs text-gray-500 mb-6 flex-1">
                            {tpl.workouts.length} sesiones • {tpl.workouts.reduce((acc, w) => acc + w.exercises.length, 0)} ejercicios
                        </p>
                        
                        {onAssign ? (
                            <button onClick={() => onAssign(tpl)} className="w-full py-3 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-900/20">SELECCIONAR <ArrowRight size={14}/></button>
                        ) : (
                            <div className="flex items-center gap-2 text-[10px] text-gray-600 pt-4 border-t border-white/5">
                                <CalendarDays size={12}/> {formatDate(tpl.updatedAt)}
                            </div>
                        )}
                    </div>
                ))}
                {templates.length === 0 && (
                    <div className="col-span-full text-center py-20 text-gray-500">
                        <ClipboardList size={48} className="mx-auto mb-4 opacity-20"/>
                        <p>No hay rutinas creadas aún.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const ClientsView = ({ onSelectClient }: { onSelectClient: (id: string) => void }) => {
    const clients = DataEngine.getUsers().filter(u => u.role === 'client');
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-white uppercase italic">Atletas Activos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clients.map(client => (
                    <div key={client.id} onClick={() => onSelectClient(client.id)} className="bg-[#151518] p-5 rounded-2xl border border-white/5 hover:border-blue-500/30 cursor-pointer transition-all group">
                        <div className="flex items-center gap-4 mb-4">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-800 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-900/20">{client.name.substring(0,2).toUpperCase()}</div>
                            <div>
                                <div className="font-bold text-white group-hover:text-blue-400 transition-colors">{client.name}</div>
                                <div className="text-xs text-gray-500">{client.email}</div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <div className="px-2 py-1 rounded bg-white/5 text-[10px] text-gray-400 border border-white/5 uppercase font-bold">{client.goal}</div>
                             <div className="px-2 py-1 rounded bg-white/5 text-[10px] text-gray-400 border border-white/5 uppercase font-bold">{client.level}</div>
                        </div>
                    </div>
                ))}
                {clients.length === 0 && <div className="col-span-3 text-center py-20 text-gray-500">No hay clientes registrados.</div>}
            </div>
        </div>
    );
};

const ExercisesView = () => {
    const [exercises, setExercises] = useState(DataEngine.getExercises());
    const [search, setSearch] = useState('');
    
    const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h2 className="text-2xl font-bold text-white uppercase italic">Ejercicios</h2>
                 <div className="bg-[#151518] border border-white/10 rounded-xl px-3 py-2 flex items-center gap-2 w-64">
                    <Search size={16} className="text-gray-500"/>
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="bg-transparent border-none outline-none text-xs text-white w-full"/>
                 </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {filtered.map(ex => (
                    <div key={ex.id} className="bg-[#151518] p-4 rounded-xl border border-white/5 hover:border-white/20 transition-all">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-white text-sm">{ex.name}</h4>
                            <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-red-500"><Youtube size={16}/></a>
                        </div>
                        <div className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">{ex.muscleGroup}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
    const [refresh, setRefresh] = useState(0);
    const client = DataEngine.getUserById(clientId);
    const plan = DataEngine.getPlan(clientId);
    const history = DataEngine.getClientHistory(clientId);
    const [showRoutineSelector, setShowRoutineSelector] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Plan | null>(null);

    const handleAssign = (finalPlan: Plan) => {
        // Asegurar IDs únicos y timestamp al asignar
        const assignedPlan = { 
            ...finalPlan, 
            id: generateUUID(), 
            userId: clientId, 
            updatedAt: new Date().toISOString() 
        };
        DataEngine.savePlan(assignedPlan);
        setShowRoutineSelector(false);
        setSelectedTemplate(null);
        setRefresh(prev => prev + 1);
    };

    if (!client) return <div>Cliente no encontrado</div>;

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white text-xs font-bold uppercase"><ChevronLeft size={16}/> Volver a lista</button>
            <div className="flex justify-between items-start bg-[#151518] p-6 rounded-2xl border border-white/5">
                <div><h2 className="text-2xl font-bold text-white uppercase italic">{client.name}</h2><p className="text-sm text-gray-500">{client.email}</p><div className="flex gap-2 mt-4"><div className="text-xs bg-white/5 px-3 py-1 rounded-lg border border-white/10"><span className="text-gray-500">OBJETIVO:</span> <span className="font-bold text-white">{client.goal}</span></div><div className="text-xs bg-white/5 px-3 py-1 rounded-lg border border-white/10"><span className="text-gray-500">NIVEL:</span> <span className="font-bold text-white">{client.level}</span></div></div></div>
                <button onClick={() => setShowRoutineSelector(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-lg shadow-blue-900/20"><CalendarDays size={16}/> Asignar Rutina</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Plan Actual</h4>
                    {plan ? (<div className="bg-[#151518] p-4 rounded-xl border border-white/5"><h5 className="font-bold text-white mb-2">{plan.title}</h5><p className="text-xs text-gray-500 mb-4">{plan.workouts.length} sesiones programadas</p><div className="space-y-2">{plan.workouts.map((w, i) => (<div key={i} className="text-xs text-gray-400 flex justify-between border-b border-white/5 pb-1"><span>{w.name}</span> {w.scheduledDate && <span className="text-blue-400">{formatDate(w.scheduledDate)}</span>}</div>))}</div></div>) : <p className="text-gray-500 text-xs italic">Sin plan asignado actualmente.</p>}
                </div>
                <div className="space-y-4">
                    <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Historial Reciente</h4>
                    {history.length > 0 ? (<div className="space-y-2">{history.slice(0, 5).map((h: any, i: number) => (<div key={i} className="bg-[#151518] p-3 rounded-lg border border-white/5 flex justify-between items-center"><div><div className="text-xs font-bold text-white">{h.workoutName}</div><div className="text-[10px] text-gray-500">{formatDate(h.date)}</div></div><div className="text-right"><div className="text-[10px] text-gray-400">{h.summary.durationMinutes} min</div><div className="text-[10px] text-gray-400">{h.summary.totalVolume} kg</div></div></div>))}</div>) : <p className="text-gray-500 text-xs italic">No hay historial registrado.</p>}
                </div>
            </div>
            {showRoutineSelector && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-[#1A1A1D] w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                         <div className="p-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-bold text-white">Seleccionar Plantilla</h3><button onClick={() => setShowRoutineSelector(false)}><X size={20}/></button></div>
                         <div className="flex-1 overflow-y-auto p-4">
                            <RoutinesView onAssign={(tpl) => setSelectedTemplate(tpl)}/>
                         </div>
                    </div>
                    {/* MODAL DE ASIGNACIÓN AVANZADA SOBRE EL SELECTOR */}
                    {selectedTemplate && (
                        <AssignmentWizard 
                            template={selectedTemplate} 
                            onClose={() => setSelectedTemplate(null)} 
                            onConfirm={handleAssign} 
                        />
                    )}
                </div>
            )}
        </div>
    );
};

// Main App Component
const App = () => {
    const [view, setView] = useState<'dashboard' | 'clients' | 'routines' | 'exercises'>('dashboard');
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

    useEffect(() => {
        DataEngine.init();
    }, []);

    const renderContent = () => {
        if (view === 'clients') {
            if (selectedClientId) return <ClientDetailView clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />;
            return <ClientsView onSelectClient={setSelectedClientId} />;
        }
        if (view === 'routines') return <RoutinesView />;
        if (view === 'exercises') return <ExercisesView />;
        
        // Dashboard
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div className="flex justify-between items-end">
                    <div>
                        <h1 className="text-4xl font-display font-black italic text-white mb-2">DASHBOARD</h1>
                        <p className="text-gray-500 text-sm">Bienvenido al centro de control de Kinetix Zone.</p>
                    </div>
                    <div className="text-right">
                        <div className="text-2xl font-bold text-white">{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        <div className="text-xs text-gray-500 uppercase font-bold">{new Date().toLocaleDateString(undefined, {weekday: 'long', day: 'numeric', month: 'long'})}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Atletas Activos" value={DataEngine.getUsers().filter(u => u.role === 'client').length} icon={<Users className="text-blue-500"/>} />
                    <StatCard label="Rutinas" value={DataEngine.getTemplates().length} icon={<ClipboardList className="text-red-500"/>} />
                    <StatCard label="Ejercicios" value={DataEngine.getExercises().length} icon={<Dumbbell className="text-yellow-500"/>} />
                    <StatCard label="Clases Hoy" value="0" icon={<CalendarDays className="text-green-500"/>} />
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-[#0A0A0C] text-gray-200 flex font-sans selection:bg-red-500/30">
            {/* Sidebar Desktop */}
            <aside className="w-72 border-r border-white/5 bg-[#0F0F11] flex flex-col hidden md:flex sticky top-0 h-screen z-20">
                <div className="p-8"><BrandingLogo textSize="text-3xl"/></div>
                <nav className="flex-1 px-6 space-y-3">
                    <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest px-2 mb-2">Principal</p>
                    <NavButton active={view === 'dashboard'} onClick={() => {setView('dashboard'); setSelectedClientId(null);}} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
                    <NavButton active={view === 'clients'} onClick={() => {setView('clients'); setSelectedClientId(null);}} icon={<Users size={20}/>} label="Atletas" />
                    <NavButton active={view === 'routines'} onClick={() => setView('routines')} icon={<ClipboardList size={20}/>} label="Rutinas" />
                    <NavButton active={view === 'exercises'} onClick={() => setView('exercises')} icon={<Dumbbell size={20}/>} label="Ejercicios" />
                </nav>
                <div className="p-6">
                    <div className="bg-[#151518] rounded-xl p-4 border border-white/5 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center font-bold text-white shadow-lg shadow-red-900/20">JG</div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-bold text-white truncate">Jorge Gonzalez</div>
                            <div className="text-[10px] text-gray-500 uppercase font-bold">Head Coach</div>
                        </div>
                    </div>
                </div>
            </aside>
            
            {/* Mobile Nav */}
            <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0F0F11] border-t border-white/10 p-2 flex justify-around z-50">
                <MobileNavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Inicio" />
                <MobileNavButton active={view === 'clients'} onClick={() => setView('clients')} icon={<Users size={20}/>} label="Atletas" />
                <MobileNavButton active={view === 'routines'} onClick={() => setView('routines')} icon={<ClipboardList size={20}/>} label="Rutinas" />
            </div>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-12 overflow-x-hidden mb-20 md:mb-0 relative">
                <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/5 to-transparent pointer-events-none"/>
                <div className="relative z-10 max-w-7xl mx-auto">
                    {renderContent()}
                </div>
            </main>
            
            <ConnectionStatus />
        </div>
    );
};

export default App;