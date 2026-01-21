import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, 
  Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, 
  Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  AlertTriangle, MessageSquare, Database, Settings, ShieldAlert, Check
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { User, Plan, Workout, Exercise, Goal, UserLevel } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './geminiService';

// --- CONFIGURACIÓN ROBUSTA ---
const getEnv = (key: string) => {
  // Prioridad 1: process.env (Vercel) | Prioridad 2: localStorage (Bypass manual)
  return (process?.env as any)?.[key] || localStorage.getItem(`KX_CONFIG_${key}`) || '';
};

const CONFIG = {
  supabaseUrl: getEnv('SUPABASE_URL'),
  supabaseKey: getEnv('SUPABASE_ANON_KEY'),
  geminiKey: getEnv('API_KEY')
};

// Determinar si el sistema tiene todo para funcionar en la nube
const isCloudReady = !!(CONFIG.supabaseUrl && CONFIG.supabaseKey);
const isAiReady = !!CONFIG.geminiKey;

const supabase = isCloudReady ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey) : null;

const DataService = {
  getPlans: async (): Promise<Plan[]> => {
    if (!supabase) return JSON.parse(localStorage.getItem('kx_plans') || '[]');
    try {
      const { data } = await supabase.from('plans').select('*');
      return (data || []).map(p => ({ ...p, userId: p.user_id, coachNotes: p.coach_notes || '', updatedAt: p.updated_at }));
    } catch { return JSON.parse(localStorage.getItem('kx_plans') || '[]'); }
  },
  savePlan: async (plan: Plan) => {
    if (!supabase) {
      const plans = await DataService.getPlans();
      const updated = [plan, ...plans.filter((p: Plan) => p.userId !== plan.userId)];
      localStorage.setItem('kx_plans', JSON.stringify(updated));
      return true;
    }
    const { error } = await supabase.from('plans').upsert({
      user_id: plan.userId,
      title: plan.title,
      workouts: plan.workouts,
      coach_notes: plan.coachNotes,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });
    return !error;
  },
  getUsers: async (): Promise<User[]> => {
    if (!supabase) return JSON.parse(localStorage.getItem('kx_users') || JSON.stringify([MOCK_USER]));
    try {
      const { data } = await supabase.from('profiles').select('*');
      return (data || []).map(u => ({ ...u, daysPerWeek: u.days_per_week, role: u.role || 'client' }));
    } catch { return [MOCK_USER as User]; }
  },
  saveUser: async (user: User) => {
    if (!supabase) {
      const users = await DataService.getUsers();
      localStorage.setItem('kx_users', JSON.stringify([...users, user]));
      return true;
    }
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      name: user.name,
      goal: user.goal,
      level: user.level,
      days_per_week: user.daysPerWeek,
      equipment: user.equipment,
      role: user.role
    });
    return !error;
  }
};

// --- COMPONENTES UI ATÓMICOS ---

// Input especial que no pierde el foco
const StableInput = memo(({ value, onChange, placeholder, className }: any) => {
  const [localValue, setLocalValue] = useState(value);
  useEffect(() => { setLocalValue(value); }, [value]);
  
  return (
    <input 
      value={localValue} 
      onChange={(e) => {
        setLocalValue(e.target.value);
        onChange(e.target.value);
      }}
      placeholder={placeholder}
      className={className}
    />
  );
});

const NeonButton = memo(({ children, onClick, variant = 'primary', className = '', loading = false, icon, disabled = false }: any) => {
  const base = "relative overflow-hidden px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] active:scale-95 disabled:opacity-30 group shrink-0 select-none";
  const styles = {
    primary: 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    secondary: 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]',
    outline: 'border border-zinc-800 hover:border-zinc-500 text-zinc-400 bg-zinc-900/40 hover:text-white',
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${base} ${styles[variant as keyof typeof styles]} ${className}`}>
      {loading ? <RefreshCw className="animate-spin" size={16} /> : <>{icon}{children}</>}
    </button>
  );
});

const GlassCard = memo(({ children, className = '', onClick }: any) => (
  <div onClick={onClick} className={`bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/40 rounded-[2.5rem] p-6 shadow-2xl transition-all ${onClick ? 'cursor-pointer hover:border-zinc-600 active:scale-[0.98]' : ''} ${className}`}>
    {children}
  </div>
));

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [coachPin, setCoachPin] = useState('');
  const [showCoachAuth, setShowCoachAuth] = useState(false);
  const [showSetup, setShowSetup] = useState(!isCloudReady || !isAiReady);

  const [exercises] = useState<Exercise[]>(INITIAL_EXERCISES);
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const syncData = useCallback(async () => {
    try {
      const [u, p] = await Promise.all([DataService.getUsers(), DataService.getPlans()]);
      setUsers(u);
      setPlans(p);
    } catch { console.error("Sync error"); }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const handleLogin = useCallback(() => {
    const user = users.find(u => u.name.toLowerCase().trim() === loginName.toLowerCase().trim());
    if (user) { setCurrentUser(user); setActiveTab('home'); }
    else { alert("Atleta no registrado."); }
  }, [users, loginName]);

  // Pantalla de Configuración Manual (Solo si faltan las llaves)
  if (showSetup) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center p-8">
        <GlassCard className="w-full max-w-sm space-y-8 border-red-600/20">
          <div className="flex items-center gap-3 text-red-600">
            <ShieldAlert size={28} />
            <h2 className="text-2xl font-display italic uppercase">CONFIGURACIÓN</h2>
          </div>
          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest leading-relaxed">
            Ingresa las llaves si el servidor no las provee. Se guardarán en este dispositivo.
          </p>
          <div className="space-y-4">
            <SetupInput label="SUPABASE_URL" envKey="SUPABASE_URL" />
            <SetupInput label="SUPABASE_ANON_KEY" envKey="SUPABASE_ANON_KEY" />
            <SetupInput label="API_KEY (GEMINI)" envKey="API_KEY" />
          </div>
          <NeonButton onClick={() => window.location.reload()} className="w-full py-6">GUARDAR Y RECARGAR</NeonButton>
          <button onClick={() => setShowSetup(false)} className="w-full text-[9px] font-black text-zinc-700 uppercase tracking-widest">Entrar sin Configuración</button>
        </GlassCard>
      </div>
    );
  }

  // Pantalla de Login
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-12 animate-in zoom-in duration-700">
           <div className="space-y-4">
              <h1 className="text-7xl font-display italic tracking-tighter uppercase text-white leading-none">KINETIX</h1>
              <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px]">FUNCTIONAL ZONE</p>
           </div>
           
           {!showCoachAuth ? (
             <div className="space-y-6">
                <GlassCard className="max-w-xs mx-auto p-10 space-y-6 border-zinc-800">
                   <input value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="NOMBRE DEL ATLETA" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase" />
                   <NeonButton onClick={handleLogin} className="w-full py-6">ENTRAR</NeonButton>
                </GlassCard>
                <div className="flex flex-col gap-4">
                  <button onClick={() => setShowCoachAuth(true)} className="text-[9px] font-black text-zinc-800 uppercase tracking-widest hover:text-red-500 transition-all">ACCESO COACH</button>
                  <button onClick={() => setShowSetup(true)} className="text-[8px] font-black text-zinc-900 uppercase tracking-widest flex items-center justify-center gap-2 opacity-50"><Settings size={12}/> Ajustes de Sistema</button>
                </div>
             </div>
           ) : (
             <GlassCard className="max-w-xs mx-auto p-10 space-y-6 border-red-600/30">
                <p className="text-[10px] font-black text-red-600 uppercase tracking-widest text-center">SEGURIDAD COACH</p>
                <input type="password" value={coachPin} onChange={e => setCoachPin(e.target.value)} placeholder="PIN" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600" />
                <NeonButton onClick={() => {
                  if (coachPin === 'KINETIX2025') {
                    setCurrentUser({ ...(MOCK_USER as User), role: 'coach', name: 'Master Coach' });
                    setActiveTab('admin');
                    setShowCoachAuth(false);
                  } else { alert("PIN Incorrecto"); }
                }} className="w-full py-6">DESBLOQUEAR</NeonButton>
                <button onClick={() => setShowCoachAuth(false)} className="text-[9px] text-zinc-700 uppercase font-black">Volver</button>
             </GlassCard>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100">
      <header className="p-6 flex justify-between items-center bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-40 border-b border-zinc-900/40">
        <div className="flex flex-col">
           <span className="font-display italic text-xl uppercase leading-none text-white tracking-tighter">KINETIX</span>
           <div className="flex items-center gap-1">
             <div className={`w-1.5 h-1.5 rounded-full ${isCloudReady ? 'bg-green-500' : 'bg-amber-500'}`}></div>
             <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">{isCloudReady ? 'CLOUD SYNC' : 'OFFLINE MODE'}</span>
           </div>
        </div>
        <button onClick={() => setCurrentUser(null)} className="text-zinc-700 hover:text-red-500 transition-all"><LogOut size={20} /></button>
      </header>

      <main className="flex-1 p-8 pb-40">
        {activeTab === 'home' && (
          <div className="space-y-12">
            <h2 className="text-5xl font-display italic tracking-tighter uppercase text-white leading-none">HOLA, <span className="text-red-600 neon-red">{currentUser.name.split(' ')[0]}</span></h2>
            {plans.find(p => p.userId === currentUser.id) ? (
              <GlassCard className="p-10 border-red-600/10">
                <div className="text-center space-y-1 mb-8">
                   <p className="text-cyan-400 text-[9px] font-black uppercase tracking-widest">PLAN ASIGNADO</p>
                   <h4 className="text-4xl font-display italic uppercase text-white tracking-tighter">{plans.find(p => p.userId === currentUser.id)?.title}</h4>
                </div>
                <NeonButton className="w-full py-6" icon={<Play size={18}/>}>INICIAR SESIÓN</NeonButton>
              </GlassCard>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30">
                 <p className="text-[9px] text-zinc-600 uppercase font-black">Esperando entrenamiento...</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-10">
             <div className="flex justify-between items-end">
                <h2 className="text-5xl font-display italic uppercase tracking-tighter text-red-600">ATLETAS</h2>
                <button onClick={() => setShowAddUser(true)} className="bg-white/5 p-4 rounded-2xl text-cyan-400 border border-white/10"><UserPlus size={20}/></button>
             </div>
             <div className="grid gap-4">
                {users.filter(u => u.role !== 'coach').map(u => (
                  <GlassCard key={u.id} className="p-5 flex items-center justify-between bg-zinc-950/50">
                    <div className="flex flex-col">
                       <h4 className="text-lg font-black text-white italic uppercase tracking-tighter">{u.name}</h4>
                       <span className="text-[7px] text-zinc-600 font-black uppercase">{u.goal}</span>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={async () => {
                         if (!isAiReady) { alert("Configura la API KEY para usar la IA."); return; }
                         setIsAiGenerating(true);
                         try {
                           const generated = await generateSmartRoutine(u);
                           setEditingPlan({ plan: { ...generated, id: `p-${Date.now()}`, userId: u.id, updatedAt: new Date().toISOString() }, isNew: true });
                         } catch (e: any) { alert(e.message); }
                         finally { setIsAiGenerating(false); }
                       }} className="p-3 rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 active:scale-90 transition-all">
                          {isAiGenerating ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                       </button>
                       <button onClick={() => {
                          const exPlan = plans.find(p => p.userId === u.id);
                          setEditingPlan({ 
                            plan: exPlan ? JSON.parse(JSON.stringify(exPlan)) : { id: `p-${Date.now()}`, userId: u.id, title: 'NUEVO PLAN', workouts: [], updatedAt: new Date().toISOString(), coachNotes: '' }, 
                            isNew: !exPlan 
                          });
                       }} className="bg-zinc-800/40 p-3 rounded-xl text-zinc-500 active:scale-90 transition-all"><Edit3 size={16}/></button>
                    </div>
                  </GlassCard>
                ))}
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-3xl border-t border-zinc-900/50 px-10 py-8 z-50">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={24} />} label="Panel" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={24} />} label="Coaching" />}
        </div>
      </nav>

      {editingPlan && <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={async (p: any) => { await DataService.savePlan(p); syncData(); setEditingPlan(null); }} onCancel={() => setEditingPlan(null)} />}
      {showAddUser && <UserDialog onSave={async (user: any) => { await DataService.saveUser(user); syncData(); setShowAddUser(false); }} onCancel={() => setShowAddUser(false)} />}
    </div>
  );
}

// --- EDITOR DE PLANES (FLUÍDO Y ESTABLE) ---
const PlanEditor = memo(({ plan, allExercises, onSave, onCancel }: any) => {
  const [localPlan, setLocalPlan] = useState<Plan>(() => JSON.parse(JSON.stringify(plan)));
  const [showPicker, setShowPicker] = useState<number | null>(null);

  const updateExField = useCallback((wIdx: number, exIdx: number, field: string, value: string | number) => {
    setLocalPlan(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy.workouts[wIdx].exercises[exIdx][field] = value;
      return copy;
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050507] z-[150] p-8 flex flex-col animate-in slide-in-from-right-full duration-500 overflow-y-auto no-scrollbar pb-40">
       <header className="flex justify-between items-center mb-10 sticky top-0 bg-[#050507]/95 backdrop-blur-xl py-4 z-10 border-b border-zinc-900">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-600"><ChevronLeft size={24}/></button>
          <input 
            value={localPlan.title} 
            onChange={e => setLocalPlan({...localPlan, title: e.target.value})} 
            className="bg-transparent text-xl font-display italic text-white text-center outline-none uppercase w-1/2" 
          />
          <button onClick={() => onSave(localPlan)} className="bg-red-600 p-5 rounded-2xl text-white shadow-xl active:scale-95 transition-all"><Save size={24}/></button>
       </header>

       <div className="space-y-8">
          {localPlan.workouts.map((w, wIdx) => (
             <GlassCard key={wIdx} className="space-y-6 border-zinc-900">
                <input 
                  value={w.name} 
                  onChange={e => {
                    const nw = [...localPlan.workouts];
                    nw[wIdx].name = e.target.value;
                    setLocalPlan({...localPlan, workouts: nw});
                  }} 
                  className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl text-lg font-display italic text-white outline-none w-full uppercase" 
                />
                <div className="space-y-4">
                   {w.exercises.map((ex, exIdx) => {
                     const dbEx = allExercises.find((e:any) => e.id === ex.exerciseId);
                     return (
                       <div key={exIdx} className="p-5 bg-zinc-950 rounded-[2rem] border border-zinc-900 space-y-4">
                          <div className="flex justify-between items-start">
                             <div className="flex flex-col">
                               <span className="text-[10px] font-black uppercase text-red-600">{dbEx?.name || ex.name}</span>
                               <span className="text-[7px] text-zinc-700 font-bold uppercase">{dbEx?.muscleGroup}</span>
                             </div>
                             <button onClick={() => {
                                const nw = JSON.parse(JSON.stringify(localPlan.workouts));
                                nw[wIdx].exercises.splice(exIdx, 1);
                                setLocalPlan({...localPlan, workouts: nw});
                             }} className="text-zinc-800"><X size={16}/></button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                             <div className="space-y-1">
                                <p className="text-[7px] font-black text-zinc-700 uppercase ml-2">SERIES</p>
                                <StableInput 
                                  value={ex.targetSets} 
                                  onChange={(val: any) => updateExField(wIdx, exIdx, 'targetSets', parseInt(val) || 0)} 
                                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white font-bold text-center outline-none focus:border-red-600" 
                                />
                             </div>
                             <div className="space-y-1">
                                <p className="text-[7px] font-black text-zinc-700 uppercase ml-2">REPS</p>
                                <StableInput 
                                  value={ex.targetReps} 
                                  onChange={(val: any) => updateExField(wIdx, exIdx, 'targetReps', val)} 
                                  className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white font-bold text-center outline-none focus:border-red-600" 
                                />
                             </div>
                          </div>
                          <div className="space-y-1">
                             <p className="text-[7px] font-black text-zinc-700 uppercase ml-2">COACH CUE</p>
                             <StableInput 
                               value={ex.coachCue || ''} 
                               onChange={(val: any) => updateExField(wIdx, exIdx, 'coachCue', val)} 
                               placeholder="Instrucción táctica..." 
                               className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white text-[10px] italic outline-none focus:border-cyan-400" 
                             />
                          </div>
                       </div>
                     );
                   })}
                   <button onClick={() => setShowPicker(wIdx)} className="w-full py-4 border-2 border-dashed border-zinc-900 rounded-2xl text-[9px] font-black text-zinc-700 uppercase">+ AÑADIR EJERCICIO</button>
                </div>
             </GlassCard>
          ))}
          <button onClick={() => setLocalPlan({...localPlan, workouts: [...localPlan.workouts, { id: `w-${Date.now()}`, name: `SESIÓN ${localPlan.workouts.length+1}`, day: localPlan.workouts.length+1, exercises: [] }]})} className="w-full py-8 border-2 border-dashed border-zinc-900 rounded-[2.5rem] text-[10px] font-black text-zinc-700 uppercase tracking-widest"><Plus size={24}/> Nueva Sesión</button>
       </div>

       {showPicker !== null && (
         <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl p-8 flex flex-col">
            <header className="flex justify-between items-center mb-8 shrink-0">
              <h3 className="text-2xl font-display italic text-white uppercase tracking-tighter">LIBRERÍA</h3>
              <button onClick={() => setShowPicker(null)} className="text-white"><X size={24}/></button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar pb-10">
              {allExercises.map((ex: any) => (
                <div key={ex.id} onClick={() => {
                   const nw = JSON.parse(JSON.stringify(localPlan.workouts));
                   nw[showPicker].exercises.push({ exerciseId: ex.id, name: ex.name, targetSets: 4, targetReps: "12", coachCue: "" });
                   setLocalPlan({...localPlan, workouts: nw});
                   setShowPicker(null);
                }} className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl flex justify-between items-center active:scale-95 transition-all">
                  <div>
                    <p className="font-black text-white uppercase italic text-lg">{ex.name}</p>
                    <p className="text-[8px] font-bold text-zinc-600 uppercase">{ex.muscleGroup}</p>
                  </div>
                  <Plus size={20} className="text-red-600" />
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
});

// --- SUBCOMPONENTES AUXILIARES ---
const SetupInput = ({ label, envKey }: { label: string, envKey: string }) => {
  const [val, setVal] = useState(localStorage.getItem(`KX_CONFIG_${envKey}`) || '');
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center px-2">
        <label className="text-[8px] font-black text-zinc-600 uppercase">{label}</label>
        {val && <Check size={10} className="text-green-500" />}
      </div>
      <input 
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          localStorage.setItem(`KX_CONFIG_${envKey}`, e.target.value);
        }}
        placeholder={`Pega tu ${label}`} 
        className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-[10px] text-white outline-none focus:border-red-600 font-mono" 
      />
    </div>
  );
};

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-2.5 rounded-2xl ${active ? 'bg-red-600/10 scale-110' : ''}`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
  </button>
));

const UserDialog = memo(({ onSave, onCancel }: any) => {
  const [u, setU] = useState({ name: '' });
  return (
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8 animate-in fade-in">
       <GlassCard className="w-full max-w-sm space-y-10 border-zinc-800">
          <h2 className="text-4xl font-display italic text-white uppercase text-center leading-none">ALTA DE ATLETA</h2>
          <div className="space-y-5">
             <input placeholder="NOMBRE COMPLETO" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase" onChange={e => setU({name: e.target.value})} />
             <NeonButton onClick={() => onSave({ id: `u-${Date.now()}`, name: u.name, goal: Goal.GAIN_MUSCLE, level: UserLevel.BEGINNER, daysPerWeek: 3, equipment: ['Todo'], role: 'client', streak: 0, createdAt: new Date().toISOString() })} className="w-full py-6">CREAR PERFIL</NeonButton>
             <button onClick={onCancel} className="w-full text-zinc-700 font-black text-[9px] uppercase tracking-widest">Cancelar</button>
          </div>
       </GlassCard>
    </div>
  );
});