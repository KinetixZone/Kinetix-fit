
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, SetEntry, WorkoutProgress, ChatMessage, UserRole, TrainingMethod, OverrideSchemaResponse } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES, INITIAL_TEMPLATES } from './constants';
import { getTechnicalAdvice, generateEditionSchema } from './services/geminiService';
import { supabaseConnectionStatus } from './services/supabaseClient';

// --- CONFIGURACIÓN DE VERSIÓN 369EA99 (CLASSIC STABLE + LIBRARY MANAGER + ADVANCED ASSIGNMENT) ---
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

    // 2. FORCE SYNC: Asegurar que ejercicios y plantillas existan (Fix para "lista vacía")
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
    const totalVolume = Object.values(logs).reduce((acc, sets) => acc + sets.reduce((sAcc, s) => sAcc + (parseFloat(s.weight) * parseInt(s.reps)), 0), 0);

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
    const uIdx = users.findIndex(u => u.id === userId);
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

// --- COMPONENTES LÓGICOS PRINCIPALES ---

/**
 * Módulo de Asignación Avanzada (AssignmentWizard)
 * Permite seleccionar atleta y personalizar (hacer overrides) sobre la plantilla
 * sin modificar la plantilla original.
 */
const AssignmentWizard = ({ template, onClose, onConfirm }: { template: Plan, onClose: () => void, onConfirm: (finalPlan: Plan, userId: string) => void }) => {
    // ESTADOS DEL WIZARD: 'select' -> 'mode' -> 'customize' (opcional)
    const [step, setStep] = useState<'select' | 'mode' | 'customize'>('select');
    const [targetClient, setTargetClient] = useState<string>('');
    const [customizedPlan, setCustomizedPlan] = useState<Plan | null>(null);
    const [generatedSchema, setGeneratedSchema] = useState<OverrideSchemaResponse | null>(null);
    const [loadingSchema, setLoadingSchema] = useState(false);
    const clients = useMemo(() => DataEngine.getUsers().filter(u => u.role === 'client'), []);
    
    // Al montar, clonamos la plantilla para no afectar la original (Principio de Inmutabilidad)
    useEffect(() => {
        if (template) {
            const clone = JSON.parse(JSON.stringify(template));
            clone.id = generateUUID(); // Nuevo ID para la asignación
            setCustomizedPlan(clone);
        }
    }, [template]);

    const getClientName = () => clients.find(c => c.id === targetClient)?.name || 'Atleta';
    const getClientObj = () => clients.find(c => c.id === targetClient);

    const handleConfirmDirect = () => {
        if (!targetClient || !customizedPlan) return;
        onConfirm(customizedPlan, targetClient);
    };

    const handleGenerateSchema = async () => {
        const athlete = getClientObj();
        if (!athlete || !customizedPlan) return;
        
        setLoadingSchema(true);
        try {
            const schema = await generateEditionSchema(customizedPlan, athlete);
            console.log("Generado UI Schema Determinista (Fase 1):", schema);
            setGeneratedSchema(schema);
        } catch (e) {
            console.error("Error generando schema", e);
        } finally {
            setLoadingSchema(false);
        }
    };

    // --- LOGICA DE PERSONALIZACIÓN (OVERRIDES) ---
    const updateExerciseOverride = (wIdx: number, eIdx: number, field: string, value: any, subObject?: string) => {
        if (!customizedPlan) return;
        const newPlan = { ...customizedPlan };
        const exercise = newPlan.workouts[wIdx].exercises[eIdx] as any;

        if (subObject) {
            // Ejemplo: tabataConfig.rounds
            if (!exercise[subObject]) exercise[subObject] = {};
            exercise[subObject][field] = value;
        } else {
            // Campo directo: targetLoad, targetReps
            exercise[field] = value;
        }
        setCustomizedPlan(newPlan);
    };

    // Renderizador de inputs según el método (Pattern Matching UI)
    const renderMethodInputs = (exercise: WorkoutExercise, wIdx: number, eIdx: number) => {
        const method = exercise.method || 'standard';

        // Común para casi todos
        const CommonInputs = () => (
            <div className="grid grid-cols-3 gap-2 mb-2">
               <div><label className="text-[9px] text-gray-500 uppercase">Kg</label><input type="text" value={exercise.targetLoad || ''} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'targetLoad', e.target.value)} className="w-full bg-black border border-yellow-500/30 text-yellow-500 text-xs p-1 rounded text-center" placeholder="--"/></div>
               <div><label className="text-[9px] text-gray-500 uppercase">Reps</label><input type="text" value={exercise.targetReps || ''} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'targetReps', e.target.value)} className="w-full bg-black border border-white/20 text-white text-xs p-1 rounded text-center"/></div>
               <div><label className="text-[9px] text-gray-500 uppercase">Rest(s)</label><input type="number" value={exercise.targetRest || ''} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'targetRest', Number(e.target.value))} className="w-full bg-black border border-blue-500/30 text-blue-400 text-xs p-1 rounded text-center"/></div>
            </div>
        );

        switch (method) {
            case 'tabata':
                return (
                    <div className="bg-purple-900/10 p-2 rounded border border-purple-500/20 mb-2 space-y-2">
                        <div className="text-[9px] text-purple-400 font-bold uppercase">Configuración Tabata</div>
                        <div className="grid grid-cols-3 gap-2">
                             <div><label className="text-[9px] text-gray-500">Trabajo (s)</label><input type="number" value={exercise.tabataConfig?.workTimeSec || 20} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'workTimeSec', Number(e.target.value), 'tabataConfig')} className="w-full bg-black text-white text-xs p-1 rounded"/></div>
                             <div><label className="text-[9px] text-gray-500">Descanso (s)</label><input type="number" value={exercise.tabataConfig?.restTimeSec || 10} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'restTimeSec', Number(e.target.value), 'tabataConfig')} className="w-full bg-black text-white text-xs p-1 rounded"/></div>
                             <div><label className="text-[9px] text-gray-500">Rounds</label><input type="number" value={exercise.tabataConfig?.rounds || 8} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'rounds', Number(e.target.value), 'tabataConfig')} className="w-full bg-black text-white text-xs p-1 rounded"/></div>
                        </div>
                    </div>
                );
            case 'emom':
                return (
                     <div className="bg-orange-900/10 p-2 rounded border border-orange-500/20 mb-2 space-y-2">
                        <div className="text-[9px] text-orange-400 font-bold uppercase">Configuración EMOM</div>
                        <div className="grid grid-cols-2 gap-2">
                             <div><label className="text-[9px] text-gray-500">Minutos Totales</label><input type="number" value={exercise.emomConfig?.durationMin || 10} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'durationMin', Number(e.target.value), 'emomConfig')} className="w-full bg-black text-white text-xs p-1 rounded"/></div>
                             <div><label className="text-[9px] text-gray-500">Reps x Min</label><input type="text" value={exercise.targetReps || ''} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'targetReps', e.target.value)} className="w-full bg-black text-white text-xs p-1 rounded"/></div>
                        </div>
                    </div>
                );
            case 'biserie':
                return (
                    <div className="space-y-2">
                        <CommonInputs />
                        {exercise.pair && (
                            <div className="bg-white/5 p-2 rounded border-l-2 border-red-500">
                                <div className="text-[9px] text-gray-400 uppercase mb-1">Pair: {exercise.pair.name}</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" value={exercise.pair.targetLoad || ''} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'targetLoad', e.target.value, 'pair')} className="w-full bg-black border border-yellow-500/30 text-yellow-500 text-xs p-1 rounded text-center" placeholder="Kg Pair"/>
                                    <input type="text" value={exercise.pair.targetReps || ''} onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'targetReps', e.target.value, 'pair')} className="w-full bg-black border border-white/20 text-white text-xs p-1 rounded text-center" placeholder="Reps Pair"/>
                                </div>
                            </div>
                        )}
                    </div>
                );
            default: // Standard, AHAP, Dropset (usan campos base)
                return <CommonInputs />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-[#1A1A1D] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* HEADER */}
                <div className="flex justify-between items-center border-b border-white/10 p-5">
                    <div>
                        <h3 className="text-xl font-bold text-white uppercase italic">Asignar Rutina</h3>
                        <p className="text-xs text-gray-500">Plantilla: <span className="text-red-500">{template.title}</span></p>
                    </div>
                    <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-white"/></button>
                </div>
                
                {/* BODY CONTENT BASED ON STEP */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    
                    {step === 'select' && (
                        <div className="space-y-4 animate-fade-in">
                            <label className="text-xs font-bold text-gray-500 uppercase block">1. Seleccionar Atleta</label>
                            <select className="w-full bg-black border border-white/10 rounded-xl p-4 text-white outline-none focus:border-red-500 text-sm" value={targetClient} onChange={(e) => setTargetClient(e.target.value)}>
                                <option value="">-- Seleccionar --</option>
                                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    )}

                    {step === 'mode' && (
                         <div className="space-y-6 animate-fade-in text-center py-4">
                            <div className="w-16 h-16 bg-blue-600/20 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-500/50"><Settings2 size={32}/></div>
                            <h4 className="text-lg font-bold text-white">¿Deseas personalizar esta rutina para <span className="text-blue-400">{getClientName()}</span>?</h4>
                            <p className="text-sm text-gray-400 px-8">Puedes asignar la plantilla tal cual o ajustar cargas, reps y tiempos específicos para este atleta sin modificar la original.</p>
                            
                            <div className="grid grid-cols-2 gap-4 mt-8">
                                <button onClick={handleConfirmDirect} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:border-white/30 transition-all group">
                                    <Copy size={24} className="text-gray-500 mb-2 group-hover:text-white mx-auto"/>
                                    <div className="font-bold text-white text-sm">Asignar Tal Cual</div>
                                    <div className="text-[10px] text-gray-500 mt-1">Copia exacta de la plantilla</div>
                                </button>
                                <button onClick={() => setStep('customize')} className="p-4 bg-red-600/10 border border-red-600/30 rounded-xl hover:bg-red-600/20 hover:border-red-500 transition-all group relative overflow-hidden">
                                    <div className="absolute top-2 right-2 text-[9px] bg-red-600 text-white px-2 rounded-full font-bold">RECOMENDADO</div>
                                    <Edit3 size={24} className="text-red-500 mb-2 group-hover:text-white mx-auto"/>
                                    <div className="font-bold text-white text-sm">Personalizar</div>
                                    <div className="text-[10px] text-red-400 mt-1">Ajustar cargas y tiempos</div>
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'customize' && customizedPlan && (
                        <div className="space-y-8 animate-fade-in">
                            <div className="flex items-center justify-between mb-4 bg-blue-900/20 p-3 rounded-xl border border-blue-500/20">
                                <div className="flex items-center gap-2">
                                    <Info size={16} className="text-blue-400"/>
                                    <p className="text-xs text-blue-200">Estás editando la copia para <strong>{getClientName()}</strong>.</p>
                                </div>
                                <button 
                                    onClick={handleGenerateSchema} 
                                    disabled={loadingSchema}
                                    className="px-3 py-1 bg-blue-600/20 border border-blue-500/50 rounded-lg text-[10px] font-bold text-blue-300 hover:bg-blue-600/40 flex items-center gap-2 disabled:opacity-50"
                                >
                                    {loadingSchema ? <Loader2 size={12} className="animate-spin"/> : <Sparkles size={12}/>}
                                    IA ANALYZE (Fase 1)
                                </button>
                            </div>
                            
                            {generatedSchema && (
                                <div className="mb-4 bg-green-900/20 border border-green-500/20 p-3 rounded-xl">
                                    <div className="flex items-center gap-2 mb-2 text-green-400 font-bold text-xs"><FileJson size={14}/> Schema Generado (Ready for Phase 2)</div>
                                    <pre className="text-[9px] text-green-300 overflow-x-auto p-2 bg-black/50 rounded max-h-32">
                                        {JSON.stringify(generatedSchema, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {customizedPlan.workouts.map((workout, wIdx) => (
                                <div key={workout.id} className="space-y-3">
                                    <h5 className="text-sm font-bold text-white border-b border-white/10 pb-1">{workout.name}</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {workout.exercises.map((ex, eIdx) => (
                                            <div key={eIdx} className="bg-white/5 p-3 rounded-xl border border-white/5 relative group hover:border-white/20 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-xs font-bold text-gray-300 truncate pr-2">{ex.name}</span>
                                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/10 text-gray-400 uppercase font-bold tracking-wider">{ex.method || 'STD'}</span>
                                                </div>
                                                
                                                {/* DYNAMIC INPUTS BASED ON METHOD */}
                                                {renderMethodInputs(ex, wIdx, eIdx)}

                                                <textarea 
                                                    value={ex.coachCue || ''} 
                                                    onChange={(e) => updateExerciseOverride(wIdx, eIdx, 'coachCue', e.target.value)}
                                                    placeholder="Nota técnica..."
                                                    className="w-full bg-black/50 border border-transparent focus:border-white/20 rounded text-[10px] text-gray-400 p-2 outline-none resize-none h-12"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* FOOTER ACTIONS */}
                <div className="p-5 border-t border-white/10 flex justify-between items-center bg-[#151518] rounded-b-2xl">
                    {step === 'select' && <button onClick={onClose} className="text-gray-500 text-xs font-bold hover:text-white">CANCELAR</button>}
                    {step === 'select' && <button onClick={() => { if(targetClient) setStep('mode'); }} disabled={!targetClient} className="px-6 py-3 bg-white text-black font-bold rounded-xl text-xs hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2">CONTINUAR <ArrowRight size={14}/></button>}
                    
                    {step === 'mode' && <button onClick={() => setStep('select')} className="text-gray-500 text-xs font-bold hover:text-white flex items-center gap-1"><ChevronLeft size={14}/> VOLVER</button>}
                    
                    {step === 'customize' && (
                        <>
                            <button onClick={() => setStep('mode')} className="text-gray-500 text-xs font-bold hover:text-white flex items-center gap-1"><ChevronLeft size={14}/> VOLVER</button>
                            <button onClick={handleConfirmDirect} className="px-6 py-3 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-500 flex items-center gap-2 shadow-lg shadow-red-900/20">CONFIRMAR ASIGNACIÓN <CheckCircle2 size={14}/></button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

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
            method: 'standard', // Por defecto standard
            videoUrl: ex.videoUrl 
        };
        const newWorkouts = [...editedPlan.workouts];
        newWorkouts[currentWorkoutIndex].exercises.push(newEx);
        setEditedPlan({...editedPlan, workouts: newWorkouts});
        setShowExerciseSelector(false);
    };

    const updateExercise = (wIdx: number, eIdx: number, field: keyof WorkoutExercise, value: any) => {
        const newWorkouts = [...editedPlan.workouts];
        (newWorkouts[wIdx].exercises[eIdx] as any)[field] = value;
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
                                <div className="grid grid-cols-4 gap-2 mb-3">
                                    <input type="number" placeholder="Sets" value={ex.targetSets} onChange={e => updateExercise(currentWorkoutIndex, idx, 'targetSets', parseInt(e.target.value))} className="bg-black border border-white/10 rounded p-2 text-xs text-white text-center"/>
                                    <input placeholder="Reps" value={ex.targetReps} onChange={e => updateExercise(currentWorkoutIndex, idx, 'targetReps', e.target.value)} className="bg-black border border-white/10 rounded p-2 text-xs text-white text-center"/>
                                    <input placeholder="Kg" value={ex.targetLoad || ''} onChange={e => updateExercise(currentWorkoutIndex, idx, 'targetLoad', e.target.value)} className="bg-black border border-yellow-500/20 rounded p-2 text-xs text-yellow-500 text-center"/>
                                    <input type="number" placeholder="Rest" value={ex.targetRest || ''} onChange={e => updateExercise(currentWorkoutIndex, idx, 'targetRest', parseInt(e.target.value))} className="bg-black border border-blue-500/20 rounded p-2 text-xs text-blue-400 text-center"/>
                                </div>
                                
                                <div className="mb-3">
                                    <label className="text-[10px] text-gray-500 uppercase font-bold">Modo de Entrenamiento</label>
                                    <select value={ex.method || 'standard'} onChange={(e) => updateExercise(currentWorkoutIndex, idx, 'method', e.target.value as TrainingMethod)} className="w-full bg-black border border-white/10 rounded p-2 text-xs text-blue-400 outline-none mt-1 uppercase font-bold">
                                        <option value="standard">Standard</option>
                                        <option value="biserie">Biserie</option>
                                        <option value="ahap">AHAP (As Heavy As Possible)</option>
                                        <option value="dropset">Drop Set</option>
                                        <option value="tabata">Tabata</option>
                                        <option value="emom">EMOM</option>
                                    </select>
                                </div>

                                <input placeholder="Notas técnicas..." value={ex.coachCue || ''} onChange={e => updateExercise(currentWorkoutIndex, idx, 'coachCue', e.target.value)} className="w-full bg-black border border-white/10 rounded p-2 text-xs text-gray-300 outline-none"/>
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

// --- GESTIÓN DE EJERCICIOS (NUEVO) ---
const ExercisesManager = () => {
    const [exercises, setExercises] = useState<Exercise[]>(DataEngine.getExercises());
    const [search, setSearch] = useState('');
    const [editingEx, setEditingEx] = useState<Exercise | null>(null);

    const refresh = () => setExercises(DataEngine.getExercises());

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        
        const newEx: Exercise = {
            id: editingEx?.id || generateUUID(),
            name: formData.get('name') as string,
            muscleGroup: formData.get('muscleGroup') as string,
            videoUrl: formData.get('videoUrl') as string,
            technique: '',
            commonErrors: []
        };
        DataEngine.saveExercise(newEx);
        setEditingEx(null);
        refresh();
    };

    const handleDelete = (id: string) => {
        if(confirm("¿Eliminar ejercicio de la base de datos?")) {
            DataEngine.deleteExercise(id);
            refresh();
        }
    };

    const filtered = exercises.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

    if (editingEx) {
        return (
            <div className="space-y-6">
                <div className="flex items-center gap-2"><button onClick={() => setEditingEx(null)}><ChevronLeft className="text-gray-400"/></button><h3 className="text-xl font-bold text-white uppercase italic">{editingEx.id ? 'Editar' : 'Nuevo'} Ejercicio</h3></div>
                <form onSubmit={handleSave} className="bg-[#151518] p-6 rounded-2xl border border-white/5 space-y-4">
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold">Nombre</label><input name="name" defaultValue={editingEx.name} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500"/></div>
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold">Grupo Muscular</label><input name="muscleGroup" defaultValue={editingEx.muscleGroup} required className="w-full bg-black border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-red-500"/></div>
                    <div><label className="text-[10px] text-gray-500 uppercase font-bold">Link Video (YouTube/Shorts)</label><input name="videoUrl" defaultValue={editingEx.videoUrl} className="w-full bg-black border border-white/10 rounded-xl p-3 text-blue-400 text-sm outline-none focus:border-red-500"/></div>
                    <div className="flex gap-2 pt-4"><button type="button" onClick={() => setEditingEx(null)} className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl font-bold text-xs uppercase">Cancelar</button><button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-red-500">Guardar</button></div>
                </form>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h3 className="text-xl font-bold text-white uppercase italic">Base de Datos ({exercises.length})</h3>
                 <button onClick={() => setEditingEx({id: '', name: '', muscleGroup: '', videoUrl: '', technique: '', commonErrors: []})} className="bg-white text-black px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-gray-200 flex items-center gap-2"><Plus size={16}/> Nuevo</button>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl flex items-center px-3 py-2"><Search size={16} className="text-gray-500 mr-2"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre..." className="bg-transparent border-none outline-none text-xs text-white w-full"/></div>
            <div className="grid grid-cols-1 gap-2">
                {filtered.map(ex => (
                    <div key={ex.id} className="bg-[#151518] p-3 rounded-xl border border-white/5 flex justify-between items-center group hover:border-white/20">
                        <div><div className="font-bold text-white text-sm">{ex.name}</div><div className="text-[10px] text-gray-500">{ex.muscleGroup}</div></div>
                        <div className="flex gap-2">
                            {ex.videoUrl && <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="p-2 bg-blue-900/20 text-blue-500 rounded-lg"><Youtube size={14}/></a>}
                            <button onClick={() => setEditingEx(ex)} className="p-2 bg-white/5 text-gray-400 rounded-lg hover:text-white"><Edit3 size={14}/></button>
                            <button onClick={() => handleDelete(ex.id)} className="p-2 bg-red-900/10 text-red-500 rounded-lg hover:bg-red-900/30"><Trash2 size={14}/></button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const RoutinesView = ({ onAssign }: { onAssign: (template: Plan) => void }) => {
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

    const handleSave = (tpl: Plan) => {
        DataEngine.saveTemplate(tpl);
        refresh();
        setEditingTemplate(null);
    };

    const deleteTemplate = (id: string) => {
        if(confirm("¿Borrar plantilla?")) {
            DataEngine.deleteTemplate(id);
            refresh();
        }
    };

    if (editingTemplate) return <ManualPlanBuilder plan={editingTemplate} onSave={handleSave} onCancel={() => setEditingTemplate(null)} />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                 <h3 className="text-xl font-bold text-white uppercase italic">Plantillas Disponibles</h3>
                 <button onClick={handleCreate} className="bg-white text-black px-4 py-2 rounded-xl font-bold text-xs uppercase hover:bg-gray-200 flex items-center gap-2"><Plus size={16}/> Crear</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {templates.map(t => (
                    <div key={t.id} className="bg-white/5 border border-white/10 p-4 rounded-xl flex flex-col justify-between group hover:border-white/20 transition-all">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-white">{t.title}</h4>
                                <p className="text-xs text-gray-500 mt-1">{t.workouts.length} sesiones</p>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setEditingTemplate(t)} className="p-2 bg-white/5 rounded-lg text-gray-400 hover:text-white"><Edit3 size={14}/></button>
                                <button onClick={() => deleteTemplate(t.id)} className="p-2 bg-red-900/10 rounded-lg text-red-500 hover:bg-red-900/30"><Trash2 size={14}/></button>
                            </div>
                        </div>
                        <button onClick={() => onAssign(t)} className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-xs font-bold uppercase transition-colors">Asignar</button>
                    </div>
                ))}
                {templates.length === 0 && <p className="text-gray-500 text-sm col-span-2 text-center py-8">No hay plantillas creadas.</p>}
            </div>
        </div>
    );
};

const DashboardView = ({ user, onNavigate }: { user: User, onNavigate: (v: string) => void }) => {
    const clients = DataEngine.getUsers().filter(u => u.role === 'client');
    const plan = DataEngine.getPlan(user.id);
    const activePlans = clients.filter(c => DataEngine.getPlan(c.id)).length;
    const exercises = DataEngine.getExercises();

    if (user.role === 'coach' || user.role === 'admin') {
        return (
            <div className="space-y-8 animate-fade-in pb-20">
                <div className="flex justify-between items-center"><div><h2 className="text-4xl font-display font-black italic text-white uppercase tracking-tighter">COMMAND CENTER</h2><p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Gestión de Alto Rendimiento</p></div></div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4"><StatCard label="Atletas" value={clients.length} icon={<Users className="text-blue-500" size={16} />} /><StatCard label="Protocolos" value={activePlans} icon={<Activity className="text-green-500" size={16} />} /><StatCard label="Librería" value={exercises.length} icon={<Dumbbell className="text-orange-500" size={16} />} /><StatCard label="Status" value="OK" icon={<Shield className="text-red-500" size={16} />} /></div>
                
                <div className="bg-[#0F0F11] border border-white/5 p-6 rounded-[2.5rem] shadow-xl">
                    <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-white uppercase font-display italic">Acciones Rápidas</h3></div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                         <button onClick={() => onNavigate('clients')} className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-red-500/30 transition-all text-left group"><div className="bg-red-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-red-500 mb-4 group-hover:scale-110 transition-transform"><UserPlus size={24}/></div><h4 className="font-bold text-white uppercase text-sm">Gestionar Atletas</h4><p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">Ver lista, crear planes, asignar rutinas.</p></button>
                         <button onClick={() => onNavigate('workouts')} className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all text-left group"><div className="bg-blue-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-blue-500 mb-4 group-hover:scale-110 transition-transform"><Dumbbell size={24}/></div><h4 className="font-bold text-white uppercase text-sm">Biblioteca</h4><p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">Gestionar ejercicios, videos y plantillas.</p></button>
                         {user.role === 'admin' && (<button onClick={() => onNavigate('admin')} className="p-5 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-yellow-500/30 transition-all text-left group"><div className="bg-yellow-500/10 w-12 h-12 rounded-xl flex items-center justify-center text-yellow-500 mb-4 group-hover:scale-110 transition-transform"><Briefcase size={24}/></div><h4 className="font-bold text-white uppercase text-sm">Ajustes Admin</h4><p className="text-[10px] text-gray-500 mt-1 uppercase font-bold">Configuración total del sistema.</p></button>)}
                    </div>
                </div>
            </div>
        );
    }

    // CLIENT DASHBOARD
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-end">
                <div><h2 className="text-3xl font-display font-black italic text-white uppercase">Hola, {user.name.split(' ')[0]}</h2><p className="text-xs text-gray-500 font-bold tracking-widest uppercase mt-1">Bienvenido al Centro de Comando</p></div>
                <div className="text-right hidden md:block"><p className="text-2xl font-bold text-white">{new Date().toLocaleDateString('es-ES', { weekday: 'long' })}</p><p className="text-xs text-gray-500 uppercase">{new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}</p></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Racha Actual" value={`${user.streak} Días`} icon={<Flame size={16} className="text-orange-500"/>} />
                <StatCard label="Nivel" value={user.level} icon={<Trophy size={16} className="text-yellow-500"/>} />
                <StatCard label="Estado" value="ACTIVO" icon={<Activity size={16} className="text-green-500"/>} />
            </div>
            {user.role === 'client' && (
                <div className="bg-gradient-to-r from-red-900/20 to-black border border-red-500/20 rounded-3xl p-8 relative overflow-hidden group cursor-pointer hover:border-red-500/40 transition-all" onClick={() => onNavigate('workouts')}>
                    <div className="relative z-10"><h3 className="text-2xl font-display font-black italic text-white mb-2">TU ENTRENAMIENTO</h3><p className="text-sm text-gray-400 max-w-md">Tu plan personalizado está listo. Supera tus límites.</p><button className="mt-6 bg-white text-black px-6 py-3 rounded-xl font-bold text-xs uppercase hover:bg-gray-200 transition-colors flex items-center gap-2">Comenzar <ArrowRight size={16}/></button></div><Dumbbell className="absolute -bottom-4 -right-4 w-48 h-48 text-red-600/10 rotate-12 group-hover:scale-110 transition-transform"/>
                </div>
            )}
        </div>
    );
};

const ClientsView = ({ onSelect, user }: { onSelect: (id: string) => void, user: User }) => {
    const [search, setSearch] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [refresh, setRefresh] = useState(0);
    const filtered = DataEngine.getUsers().filter(u => u.role === 'client' && u.name.toLowerCase().includes(search.toLowerCase()));

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const formData = new FormData(form);
        const newUser: User = {
            id: generateUUID(),
            name: formData.get('name') as string,
            email: formData.get('email') as string,
            goal: Goal.LOSE_FAT,
            level: UserLevel.BEGINNER,
            role: 'client',
            daysPerWeek: 3,
            equipment: [],
            streak: 0,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        DataEngine.saveUser(newUser);
        setRefresh(prev => prev + 1);
        setShowAdd(false);
    };

    return (
        <div className="space-y-6">
             <div className="flex justify-between items-center">
                 <h3 className="text-xl font-bold text-white uppercase italic">Atletas ({filtered.length})</h3>
                 <div className="flex gap-2">
                     <div className="bg-white/5 border border-white/10 rounded-xl flex items-center px-3 py-2 w-48 md:w-64"><Search size={16} className="text-gray-500 mr-2"/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar atleta..." className="bg-transparent border-none outline-none text-xs text-white w-full"/></div>
                     <button onClick={() => setShowAdd(true)} className="bg-white text-black px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2 hover:bg-gray-200"><UserPlus size={16}/> <span className="hidden md:inline">Nuevo</span></button>
                 </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{filtered.map(client => (<div key={client.id} onClick={() => onSelect(client.id)} className="bg-[#151518] p-4 rounded-xl border border-white/5 hover:border-white/20 cursor-pointer transition-all group"><div className="flex justify-between items-start mb-4"><div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-900/20">{client.name.charAt(0)}</div>{client.isActive ? <div className="px-2 py-1 bg-green-500/10 text-green-500 rounded text-[9px] font-bold uppercase border border-green-500/20">Activo</div> : <div className="px-2 py-1 bg-red-500/10 text-red-500 rounded text-[9px] font-bold uppercase border border-red-500/20">Inactivo</div>}</div><h4 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{client.name}</h4><p className="text-xs text-gray-500">{client.email}</p><div className="mt-4 flex gap-2"><span className="px-2 py-1 bg-white/5 rounded text-[9px] text-gray-400 uppercase font-bold">{client.goal}</span><span className="px-2 py-1 bg-white/5 rounded text-[9px] text-gray-400 uppercase font-bold">{client.level}</span></div></div>))}</div>
            {showAdd && (
                <div className="fixed inset-0 bg-black/80 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
                    <form onSubmit={handleAdd} className="bg-[#1A1A1D] w-full max-w-sm rounded-2xl p-6 border border-white/10 shadow-2xl space-y-4">
                        <h3 className="text-lg font-bold text-white uppercase">Registrar Atleta</h3>
                        <input name="name" required placeholder="Nombre Completo" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-white/30 outline-none" />
                        <input name="email" type="email" required placeholder="Correo Electrónico" className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-white text-sm focus:border-white/30 outline-none" />
                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 py-3 bg-white/5 text-gray-400 rounded-xl font-bold text-xs uppercase">Cancelar</button>
                            <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold text-xs uppercase hover:bg-red-500">Guardar</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
    const [refresh, setRefresh] = useState(0);
    const client = DataEngine.getUserById(clientId);
    const plan = DataEngine.getPlan(clientId);
    const history = DataEngine.getClientHistory(clientId);
    const [showWizard, setShowWizard] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<Plan | null>(null);

    const handleAssign = (finalPlan: Plan, targetId: string) => {
        finalPlan.userId = targetId;
        DataEngine.savePlan(finalPlan);
        setShowWizard(false);
        setRefresh(prev => prev + 1); // Force Update
    };

    if (!client) return <div>Cliente no encontrado</div>;

    return (
        <div className="space-y-6">
            <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-white text-xs font-bold uppercase"><ChevronLeft size={16}/> Volver a lista</button>
            <div className="flex justify-between items-start bg-[#151518] p-6 rounded-2xl border border-white/5">
                <div><h2 className="text-2xl font-bold text-white uppercase italic">{client.name}</h2><p className="text-sm text-gray-500">{client.email}</p><div className="flex gap-2 mt-4"><div className="text-xs bg-white/5 px-3 py-1 rounded-lg border border-white/10"><span className="text-gray-500">OBJETIVO:</span> <span className="font-bold text-white">{client.goal}</span></div><div className="text-xs bg-white/5 px-3 py-1 rounded-lg border border-white/10"><span className="text-gray-500">NIVEL:</span> <span className="font-bold text-white">{client.level}</span></div></div></div>
                <button onClick={() => setShowWizard(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold text-xs uppercase flex items-center gap-2 shadow-lg shadow-blue-900/20"><CalendarDays size={16}/> Asignar Rutina</button>
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
            {showWizard && (
                <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
                    <div className="bg-[#1A1A1D] w-full max-w-4xl max-h-[90vh] rounded-2xl border border-white/10 overflow-hidden flex flex-col">
                         <div className="p-4 border-b border-white/10 flex justify-between items-center"><h3 className="font-bold text-white">Seleccionar Plantilla</h3><button onClick={() => setShowWizard(false)}><X size={20}/></button></div>
                         <div className="flex-1 overflow-y-auto p-4"><RoutinesView onAssign={(tpl) => setSelectedTemplate(tpl)}/></div>
                    </div>
                    {selectedTemplate && <AssignmentWizard template={selectedTemplate} onClose={() => setSelectedTemplate(null)} onConfirm={(p, uid) => { handleAssign(p, clientId); setSelectedTemplate(null); setShowWizard(false); }} />}
                </div>
            )}
        </div>
    );
};

const WorkoutsView = ({ user }: { user: User }) => {
    // COACH VIEW: Gestión de Biblioteca (Plantillas y Ejercicios)
    if (user.role === 'coach' || user.role === 'admin') {
        const [activeTab, setActiveTab] = useState<'templates' | 'exercises'>('templates');
        
        return (
            <div className="space-y-6">
                <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 w-fit">
                    <button onClick={() => setActiveTab('templates')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'templates' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><List size={16}/> Plantillas</button>
                    <button onClick={() => setActiveTab('exercises')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all flex items-center gap-2 ${activeTab === 'exercises' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:text-white'}`}><Database size={16}/> Ejercicios</button>
                </div>
                {activeTab === 'templates' ? <RoutinesView onAssign={() => {}} /> : <ExercisesManager />}
            </div>
        );
    }

    // CLIENT VIEW: Entrenamiento
    const plan = DataEngine.getPlan(user.id);
    const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
    const [timer, setTimer] = useState(0);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [logData, setLogData] = useState<WorkoutProgress>({});

    useEffect(() => {
        let interval: any;
        if (isTimerRunning) interval = setInterval(() => setTimer(t => t + 1), 1000);
        return () => clearInterval(interval);
    }, [isTimerRunning]);

    const formatTime = (sec: number) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    const handleStart = (workout: Workout) => {
        setActiveWorkout(workout);
        setIsTimerRunning(true);
        const existingLogs = DataEngine.getWorkoutLog(user.id, workout.id);
        setLogData(existingLogs);
    };

    const handleFinish = async () => {
        if (!activeWorkout) return;
        setIsTimerRunning(false);
        await DataEngine.archiveWorkout(user.id, activeWorkout, logData, Date.now() - (timer * 1000));
        setActiveWorkout(null);
        setTimer(0);
        alert("¡Entrenamiento completado!");
    };

    const toggleSet = (exIdx: number, setNum: number, weight: string, reps: string) => {
        if (!activeWorkout) return;
        const entry: SetEntry = { setNumber: setNum, weight, reps, completed: true, timestamp: Date.now() };
        const currentSets = logData[exIdx] || [];
        const exists = currentSets.find(s => s.setNumber === setNum);
        let newSets = [...currentSets];
        if (exists) newSets = newSets.filter(s => s.setNumber !== setNum);
        else newSets.push(entry);
        const newLogData = { ...logData, [exIdx]: newSets };
        setLogData(newLogData);
        DataEngine.saveSetLog(user.id, activeWorkout.id, exIdx, entry);
    };

    if (activeWorkout) {
        return (
            <div className="fixed inset-0 bg-[#050507] z-50 flex flex-col">
                <div className="p-4 bg-[#0F0F11] border-b border-white/5 flex justify-between items-center sticky top-0 z-10"><div><h3 className="font-bold text-white text-sm">{activeWorkout.name}</h3><p className="text-xs text-red-500 font-mono">{formatTime(timer)}</p></div><button onClick={handleFinish} className="bg-red-600 text-white px-4 py-2 rounded-lg font-bold text-xs uppercase">Finalizar</button></div>
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {activeWorkout.exercises.map((ex, i) => (
                         <div key={i} className="bg-[#151518] p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-white">{ex.name}</h4>
                                    {ex.method && ex.method !== 'standard' && (
                                        <span className="text-[10px] bg-red-900/30 text-red-500 px-2 py-0.5 rounded border border-red-500/20 uppercase font-bold mt-1 inline-block">
                                            {ex.method}
                                        </span>
                                    )}
                                </div>
                                {ex.videoUrl && <a href={ex.videoUrl} target="_blank" rel="noreferrer" className="text-blue-500"><Youtube size={20}/></a>}
                            </div>
                            {ex.coachCue && <p className="text-xs text-gray-500 mb-4 bg-white/5 p-2 rounded italic">"{ex.coachCue}"</p>}
                            <div className="space-y-2">
                                <div className="grid grid-cols-4 text-[10px] text-gray-500 font-bold uppercase text-center mb-1"><div>Set</div><div>Kg</div><div>Reps</div><div>Check</div></div>
                                {Array.from({ length: ex.targetSets }).map((_, sIdx) => {
                                    const setNum = sIdx + 1;
                                    const isDone = logData[i]?.some(l => l.setNumber === setNum);
                                    return (
                                        <div key={sIdx} className={`grid grid-cols-4 gap-2 items-center ${isDone ? 'opacity-50' : ''}`}><div className="text-center text-xs text-gray-400 bg-black/50 py-2 rounded">{setNum}</div><input className="bg-black border border-white/10 rounded text-center text-xs text-white py-2" placeholder={ex.targetLoad} /><input className="bg-black border border-white/10 rounded text-center text-xs text-white py-2" placeholder={ex.targetReps} /><button onClick={() => toggleSet(i, setNum, ex.targetLoad || '0', ex.targetReps)} className={`flex items-center justify-center py-2 rounded ${isDone ? 'bg-green-500 text-black' : 'bg-white/10 text-gray-400'}`}><Check size={14}/></button></div>
                                    );
                                })}
                            </div>
                         </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-white uppercase italic">Mi Plan Actual</h3>
            {plan ? (
                <div className="space-y-4">
                    {plan.workouts.map(w => (
                        <div key={w.id} className="bg-[#151518] p-5 rounded-xl border border-white/5 flex justify-between items-center group hover:border-red-500/30 transition-all">
                            <div><h4 className="font-bold text-white">{w.name}</h4><p className="text-xs text-gray-500">{w.exercises.length} Ejercicios {w.scheduledDate && `• ${formatDate(w.scheduledDate)}`}</p></div>
                            <button onClick={() => handleStart(w)} className="bg-white text-black px-4 py-2 rounded-lg font-bold text-xs uppercase hover:bg-red-500 hover:text-white transition-colors flex items-center gap-2"><Play size={16}/> Entrenar</button>
                        </div>
                    ))}
                </div>
            ) : <div className="text-center py-10 bg-white/5 rounded-2xl border border-dashed border-white/10"><p className="text-gray-500 text-sm">No tienes un plan asignado. Contacta a tu coach.</p></div>}
        </div>
    );
};

const ProfileView = ({ user, onLogout }: { user: User, onLogout: () => void }) => {
    return (
        <div className="space-y-6 max-w-2xl">
            <h3 className="text-xl font-bold text-white uppercase italic">Mi Perfil</h3>
            <div className="bg-[#151518] p-6 rounded-2xl border border-white/5 space-y-4">
                 <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-2xl font-bold text-white">{user.name.charAt(0)}</div><div><h4 className="text-lg font-bold text-white">{user.name}</h4><p className="text-sm text-gray-500">{user.email}</p></div></div>
                 <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5"><div><label className="text-[10px] text-gray-500 uppercase font-bold">Objetivo</label><p className="text-white text-sm">{user.goal}</p></div><div><label className="text-[10px] text-gray-500 uppercase font-bold">Nivel</label><p className="text-white text-sm">{user.level}</p></div></div>
            </div>
            <button onClick={onLogout} className="w-full py-4 bg-white/5 text-red-500 font-bold rounded-2xl flex items-center justify-center gap-2 hover:bg-red-500/10 transition-colors uppercase tracking-widest text-xs"><LogOut size={20}/> Cerrar Sesión</button>
        </div>
    );
};

const AdminView = () => {
    const users = DataEngine.getUsers();
    const [refresh, setRefresh] = useState(0);
    const toggleStatus = (u: User) => {
        u.isActive = !u.isActive;
        DataEngine.saveUser(u);
        setRefresh(r => r + 1);
    };

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold text-white uppercase italic">Consola de Administración</h3>
            <div className="bg-[#151518] rounded-xl border border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm text-gray-400">
                    <thead className="bg-black/50 text-xs uppercase font-bold text-gray-500"><tr><th className="p-4">Usuario</th><th className="p-4">Rol</th><th className="p-4">Estado</th><th className="p-4">Acciones</th></tr></thead>
                    <tbody>{users.map(u => (<tr key={u.id} className="border-t border-white/5 hover:bg-white/5 transition-colors"><td className="p-4 text-white font-bold">{u.name}<br/><span className="text-gray-600 text-xs font-normal">{u.email}</span></td><td className="p-4"><span className="bg-white/10 px-2 py-1 rounded text-xs uppercase">{u.role}</span></td><td className="p-4">{u.isActive ? <span className="text-green-500 text-xs uppercase font-bold">Activo</span> : <span className="text-red-500 text-xs uppercase font-bold">Inactivo</span>}</td><td className="p-4"><button onClick={() => toggleStatus(u)} className="text-xs font-bold underline hover:text-white">{u.isActive ? 'Desactivar' : 'Activar'}</button></td></tr>))}</tbody>
                </table>
            </div>
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
                     <div><p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold">Jorge Gonzalez | Head Coach</p><p className="text-[8px] text-gray-700 uppercase tracking-widest font-bold">v12.7.2 PRO | RECOVERY</p></div>
                 </div>
             </div>
        </div>
    );
};

const TechnicalChatbot = ({ onClose }: { onClose: () => void }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'ai', text: 'Hola, soy tu coach IA. ¿En qué te ayudo hoy?', timestamp: Date.now() }]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSend = async () => {
        if (!input.trim()) return;
        const userMsg: ChatMessage = { role: 'user', text: input, timestamp: Date.now() };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);
        try {
            const exercises = DataEngine.getExercises();
            const reply = await getTechnicalAdvice(userMsg.text, exercises);
            setMessages(prev => [...prev, { role: 'ai', text: reply || 'No pude procesar eso.', timestamp: Date.now() }]);
        } catch (e) {
            setMessages(prev => [...prev, { role: 'ai', text: 'Error de conexión con el coach.', timestamp: Date.now() }]);
        }
        setLoading(false);
    };

    return (
        <div className="fixed bottom-24 right-4 md:bottom-24 md:right-8 w-80 h-96 bg-[#1A1A1D] rounded-2xl border border-white/10 shadow-2xl flex flex-col z-50 overflow-hidden">
            <div className="p-4 bg-blue-900/20 border-b border-white/10 flex justify-between items-center">
                <div className="flex items-center gap-2"><Sparkles size={16} className="text-blue-400"/><span className="font-bold text-xs text-white">Coach IA</span></div>
                <button onClick={onClose}><X size={16} className="text-gray-400 hover:text-white"/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m, i) => (
                    <div key={i} className={`p-3 rounded-xl text-xs ${m.role === 'user' ? 'bg-white/10 ml-8 text-white' : 'bg-blue-600/20 mr-8 text-blue-100'}`}>
                        {m.text}
                    </div>
                ))}
                {loading && <div className="text-xs text-gray-500 animate-pulse">Pensando...</div>}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} className="flex-1 bg-black border border-white/10 rounded-lg px-3 text-xs text-white" placeholder="Pregunta algo..." />
                <button onClick={handleSend} className="p-2 bg-blue-600 rounded-lg text-white"><Send size={14}/></button>
            </div>
        </div>
    );
};

const App = () => {
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
                    {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'clients' || view === 'client-detail'} onClick={() => setView('clients')} icon={<Users size={20} />} label="Gestión Atletas" />}
                    {(user.role === 'coach' || user.role === 'admin') && <NavButton active={view === 'workouts'} onClick={() => setView('workouts')} icon={<Dumbbell size={20} />} label="Biblioteca" />}
                    {user.role === 'admin' && <NavButton active={view === 'admin'} onClick={() => setView('admin')} icon={<Shield size={20} />} label="Admin Console" />}
                    <NavButton active={view === 'profile'} onClick={() => setView('profile')} icon={<UserIcon size={20} />} label="Mi Perfil" />
                </nav>
                <div className="mt-auto pb-6 border-t border-white/5 pt-6">
                    <p className="text-[10px] text-gray-600 uppercase font-bold text-center mb-4">Redes Sociales</p>
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
};

export default App;
