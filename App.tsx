import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { 
  LayoutDashboard, Play, X, 
  Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, 
  Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  AlertTriangle, MessageSquare, Database, Settings, ShieldAlert, Check, Wifi, WifiOff
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { User, Plan, Workout, Exercise, Goal, UserLevel } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './geminiService';

// --- CONFIGURACIÓN DE SISTEMA ---
const CONFIG = {
  get: (key: string) => (process?.env as any)?.[key] || localStorage.getItem(`KX_CONF_${key}`) || '',
  set: (key: string, val: string) => localStorage.setItem(`KX_CONF_${key}`, val),
  isReady: () => !!(CONFIG.get('SUPABASE_URL') && CONFIG.get('SUPABASE_ANON_KEY')),
  isAiReady: () => !!CONFIG.get('API_KEY')
};

const supabase = CONFIG.isReady() 
  ? createClient(CONFIG.get('SUPABASE_URL'), CONFIG.get('SUPABASE_ANON_KEY')) 
  : null;

const DataService = {
  async getPlans(): Promise<Plan[]> {
    if (!supabase) return JSON.parse(localStorage.getItem('kx_plans') || '[]');
    try {
      const { data, error } = await supabase.from('plans').select('*');
      if (error) throw error;
      return (data || []).map(p => ({ 
        ...p, 
        userId: p.user_id, 
        coachNotes: p.coach_notes || '', 
        updatedAt: p.updated_at 
      }));
    } catch (e) {
      console.warn("Supabase Fetch Error, usando local:", e);
      return JSON.parse(localStorage.getItem('kx_plans') || '[]');
    }
  },
  async savePlan(plan: Plan) {
    // Siempre guardamos en local primero por seguridad
    const plans = await this.getPlans();
    const updated = [plan, ...plans.filter((p: Plan) => p.userId !== plan.userId)];
    localStorage.setItem('kx_plans', JSON.stringify(updated));

    if (!supabase) return true;
    try {
      const { error } = await supabase.from('plans').upsert({
        user_id: plan.userId,
        title: plan.title,
        workouts: plan.workouts,
        coach_notes: plan.coachNotes,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      return !error;
    } catch (e) {
      console.error("Supabase Save Error:", e);
      return false;
    }
  },
  async getUsers(): Promise<User[]> {
    if (!supabase) return JSON.parse(localStorage.getItem('kx_users') || JSON.stringify([MOCK_USER]));
    try {
      const { data, error } = await supabase.from('profiles').select('*');
      if (error) throw error;
      return (data || []).map(u => ({ ...u, daysPerWeek: u.days_per_week, role: u.role || 'client' }));
    } catch (e) {
      return JSON.parse(localStorage.getItem('kx_users') || JSON.stringify([MOCK_USER]));
    }
  },
  async saveUser(user: User) {
    const users = await this.getUsers();
    localStorage.setItem('kx_users', JSON.stringify([...users.filter(u => u.id !== user.id), user]));
    
    if (!supabase) return true;
    try {
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
    } catch (e) {
      return false;
    }
  }
};

// --- COMPONENTES OPTIMIZADOS ---

const FastInput = memo(({ value, onChange, placeholder, className, type = "text" }: any) => {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);

  return (
    <input 
      type={type}
      value={local} 
      onChange={(e) => {
        setLocal(e.target.value);
        onChange(e.target.value);
      }}
      placeholder={placeholder}
      className={className}
    />
  );
});

const NeonButton = memo(({ children, onClick, variant = 'primary', className = '', loading = false, icon, disabled = false }: any) => {
  const styles = {
    primary: 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    secondary: 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]',
    outline: 'border border-zinc-800 hover:border-zinc-500 text-zinc-400 bg-zinc-900/40 hover:text-white',
  };
  return (
    <button 
      onClick={onClick} 
      disabled={loading || disabled} 
      className={`relative overflow-hidden px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] active:scale-95 disabled:opacity-30 group shrink-0 ${styles[variant as keyof typeof styles]} ${className}`}
    >
      {loading ? <RefreshCw className="animate-spin" size={16} /> : <>{icon}{children}</>}
    </button>
  );
});

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [coachPin, setCoachPin] = useState('');
  const [showCoachAuth, setShowCoachAuth] = useState(false);
  const [showSetup, setShowSetup] = useState(!CONFIG.isReady());

  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);

  const loadAll = useCallback(async () => {
    const [u, p] = await Promise.all([DataService.getUsers(), DataService.getPlans()]);
    setUsers(u);
    setPlans(p);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  if (showSetup) {
    return (
      <div className="min-h-screen bg-[#050507] flex items-center justify-center p-8">
        <div className="w-full max-w-sm bg-zinc-900/50 backdrop-blur-3xl border border-red-600/20 p-8 rounded-[2.5rem] space-y-8">
          <div className="flex items-center gap-3 text-red-600">
            <ShieldAlert size={28} />
            <h2 className="text-2xl font-display italic uppercase">KINETIX SETUP</h2>
          </div>
          <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest leading-relaxed">
            Configuración de entorno manual para Vercel/Browser. Las llaves se guardarán localmente.
          </p>
          <div className="space-y-4">
            <SetupField label="SUPABASE_URL" id="SUPABASE_URL" />
            <SetupField label="SUPABASE_ANON_KEY" id="SUPABASE_ANON_KEY" />
            <SetupField label="GEMINI_API_KEY" id="API_KEY" />
          </div>
          <NeonButton onClick={() => window.location.reload()} className="w-full py-6">ACTIVAR SISTEMA</NeonButton>
          <button onClick={() => setShowSetup(false)} className="w-full text-[9px] font-black text-zinc-700 uppercase tracking-widest">Entrar en modo Local</button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-8">
        <div className="text-center space-y-12 animate-in zoom-in duration-700">
           <div className="space-y-4">
              <h1 className="text-7xl font-display italic tracking-tighter uppercase text-white leading-none">KINETIX</h1>
              <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px]">FUNCTIONAL ZONE</p>
           </div>
           <div className="space-y-6">
              <div className="bg-zinc-900/40 backdrop-blur-3xl border border-zinc-800/40 rounded-[2.5rem] p-10 space-y-6 max-w-xs mx-auto">
                 <input 
                   value={loginName} 
                   onChange={e => setLoginName(e.target.value)} 
                   placeholder="ATLETA" 
                   className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase" 
                 />
                 <NeonButton onClick={() => {
                   const u = users.find(u => u.name.toLowerCase().trim() === loginName.toLowerCase().trim());
                   if (u) { setCurrentUser(u); setActiveTab('home'); }
                   else alert("Usuario no encontrado.");
                 }} className="w-full py-6">ACCEDER</NeonButton>
              </div>
              <button onClick={() => setShowCoachAuth(true)} className="text-[9px] font-black text-zinc-800 uppercase tracking-widest hover:text-red-500 transition-all">PANEL DE COACH</button>
           </div>
        </div>

        {showCoachAuth && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex items-center justify-center p-8 z-[100]">
            <div className="bg-zinc-900 border border-red-600/30 p-10 rounded-[2.5rem] w-full max-w-xs space-y-6">
              <p className="text-[10px] font-black text-red-600 uppercase text-center">PIN DE SEGURIDAD</p>
              <input type="password" value={coachPin} onChange={e => setCoachPin(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white" />
              <NeonButton onClick={() => {
                if (coachPin === 'KINETIX2025') {
                  setCurrentUser({ ...MOCK_USER, role: 'coach', name: 'Master Coach' });
                  setActiveTab('admin');
                  setShowCoachAuth(false);
                } else alert("PIN incorrecto");
              }} className="w-full">VERIFICAR</NeonButton>
              <button onClick={() => setShowCoachAuth(false)} className="w-full text-zinc-600 text-[9px] uppercase font-bold">Cerrar</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100">
      <header className="p-6 flex justify-between items-center bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-40 border-b border-zinc-900/40">
        <div className="flex flex-col">
           <span className="font-display italic text-xl uppercase text-white tracking-tighter">KINETIX</span>
           <div className="flex items-center gap-2">
             {supabase ? <Wifi className="text-green-500" size={10}/> : <WifiOff className="text-amber-500" size={10}/>}
             <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">{supabase ? 'ONLINE' : 'LOCAL'}</span>
           </div>
        </div>
        <button onClick={() => setCurrentUser(null)} className="text-zinc-700 hover:text-red-500"><LogOut size={20}/></button>
      </header>

      <main className="flex-1 p-8 pb-40">
        {activeTab === 'home' && (
          <div className="space-y-12">
            <h2 className="text-5xl font-display italic tracking-tighter uppercase text-white leading-none">HOLA, <span className="text-red-600 neon-red">{currentUser.name.split(' ')[0]}</span></h2>
            {plans.find(p => p.userId === currentUser.id) ? (
              <div className="bg-zinc-900/50 p-10 rounded-[2.5rem] border border-red-600/10 text-center space-y-8">
                 <div>
                    <p className="text-cyan-400 text-[9px] font-black uppercase tracking-widest">ESTÁS EN EL PLAN</p>
                    <h4 className="text-4xl font-display italic text-white uppercase tracking-tighter">{plans.find(p => p.userId === currentUser.id)?.title}</h4>
                 </div>
                 <NeonButton className="w-full py-6" icon={<Play size={18}/>}>EMPEZAR HOY</NeonButton>
              </div>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30">
                 <p className="text-[9px] text-zinc-600 uppercase font-black">Sin plan asignado aún</p>
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
                  <div key={u.id} className="bg-zinc-900/60 p-6 rounded-[2rem] border border-zinc-800/50 flex items-center justify-between">
                    <div>
                       <h4 className="text-lg font-black text-white italic uppercase">{u.name}</h4>
                       <span className="text-[7px] text-zinc-600 font-black uppercase">{u.goal}</span>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={async () => {
                         if (!CONFIG.isAiReady()) return alert("Configura API_KEY");
                         setIsAiGenerating(true);
                         try {
                           const res = await generateSmartRoutine(u);
                           setEditingPlan({ plan: { ...res, id: `p-${Date.now()}`, userId: u.id, updatedAt: new Date().toISOString() }, isNew: true });
                         } catch (e: any) { alert(e.message); }
                         finally { setIsAiGenerating(false); }
                       }} className="p-4 bg-cyan-400/10 text-cyan-400 rounded-2xl border border-cyan-400/20 active:scale-90">
                          {isAiGenerating ? <RefreshCw className="animate-spin" size={16}/> : <Sparkles size={16}/>}
                       </button>
                       <button onClick={() => {
                          const p = plans.find(p => p.userId === u.id);
                          setEditingPlan({ 
                            plan: p ? JSON.parse(JSON.stringify(p)) : { id: `p-${Date.now()}`, userId: u.id, title: 'NUEVO PLAN', workouts: [], updatedAt: new Date().toISOString() }, 
                            isNew: !p 
                          });
                       }} className="p-4 bg-zinc-800 text-zinc-400 rounded-2xl active:scale-90"><Edit3 size={16}/></button>
                    </div>
                  </div>
                ))}
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-3xl border-t border-zinc-900/50 px-10 py-8 z-50">
        <div className="max-w-md mx-auto flex justify-around">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={24}/>} label="Inicio" />
          {currentUser.role === 'coach' && <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={24}/>} label="Coaching" />}
        </div>
      </nav>

      {editingPlan && (
        <PlanEditor 
          plan={editingPlan.plan} 
          allExercises={INITIAL_EXERCISES} 
          onSave={async (p: Plan) => {
            await DataService.savePlan(p);
            await loadAll();
            setEditingPlan(null);
          }} 
          onCancel={() => setEditingPlan(null)} 
        />
      )}
      
      {showAddUser && (
        <UserDialog 
          onSave={async (u: User) => {
            await DataService.saveUser(u);
            await loadAll();
            setShowAddUser(false);
          }} 
          onCancel={() => setShowAddUser(false)} 
        />
      )}
    </div>
  );
}

// --- COMPONENTES ESPECIALIZADOS ---

const SetupField = ({ label, id }: any) => (
  <div className="space-y-1">
    <label className="text-[8px] font-black text-zinc-600 uppercase ml-2">{label}</label>
    <input 
      onChange={(e) => CONFIG.set(id, e.target.value)}
      defaultValue={CONFIG.get(id)}
      placeholder={`Pega tu ${label}`} 
      className="w-full bg-zinc-950 border border-zinc-800 p-4 rounded-xl text-[10px] text-white outline-none focus:border-red-600 font-mono" 
    />
  </div>
);

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel }: any) => {
  const [local, setLocal] = useState<Plan>(() => JSON.parse(JSON.stringify(plan)));
  const [picker, setPicker] = useState<number | null>(null);

  const updateEx = useCallback((wIdx: number, exIdx: number, field: string, val: any) => {
    setLocal(prev => {
      const copy = { ...prev };
      const ws = [...copy.workouts];
      ws[wIdx].exercises[exIdx] = { ...ws[wIdx].exercises[exIdx], [field]: val };
      copy.workouts = ws;
      return copy;
    });
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050507] z-[150] p-8 flex flex-col animate-in slide-in-from-right duration-500 overflow-y-auto no-scrollbar pb-40">
       <header className="flex justify-between items-center mb-10 sticky top-0 bg-[#050507]/95 backdrop-blur-xl py-4 z-10 border-b border-zinc-900">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-600"><ChevronLeft size={24}/></button>
          <FastInput value={local.title} onChange={(v: string) => setLocal({...local, title: v})} className="bg-transparent text-xl font-display italic text-white text-center outline-none uppercase w-1/2" />
          <button onClick={() => onSave(local)} className="bg-red-600 p-5 rounded-2xl text-white shadow-xl"><Save size={24}/></button>
       </header>

       <div className="space-y-8">
          {local.workouts.map((w, wIdx) => (
             <div key={wIdx} className="bg-zinc-900/50 p-6 rounded-[2.5rem] border border-zinc-800/50 space-y-6">
                <FastInput value={w.name} onChange={(v: string) => { const nw = [...local.workouts]; nw[wIdx].name = v; setLocal({...local, workouts: nw}); }} className="bg-zinc-950 border border-zinc-900 p-4 rounded-xl text-lg font-display italic text-white outline-none w-full uppercase" />
                <div className="space-y-4">
                   {w.exercises.map((ex, exIdx) => (
                     <div key={exIdx} className="p-5 bg-zinc-950 rounded-[2rem] border border-zinc-800/50 space-y-4">
                        <div className="flex justify-between items-start">
                           <div>
                             <span className="text-[10px] font-black uppercase text-red-600">{allExercises.find((e:any) => e.id === ex.exerciseId)?.name || ex.name}</span>
                             <p className="text-[7px] text-zinc-700 font-bold uppercase">{allExercises.find((e:any) => e.id === ex.exerciseId)?.muscleGroup}</p>
                           </div>
                           <button onClick={() => { const nw = [...local.workouts]; nw[wIdx].exercises.splice(exIdx, 1); setLocal({...local, workouts: nw}); }} className="text-zinc-800"><X size={16}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1">
                              <p className="text-[7px] font-black text-zinc-700 uppercase ml-2">SERIES</p>
                              <FastInput type="number" value={ex.targetSets} onChange={(v: string) => updateEx(wIdx, exIdx, 'targetSets', parseInt(v)||0)} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white font-bold text-center" />
                           </div>
                           <div className="space-y-1">
                              <p className="text-[7px] font-black text-zinc-700 uppercase ml-2">REPS</p>
                              <FastInput value={ex.targetReps} onChange={(v: string) => updateEx(wIdx, exIdx, 'targetReps', v)} className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white font-bold text-center" />
                           </div>
                        </div>
                        <FastInput value={ex.coachCue || ''} onChange={(v: string) => updateEx(wIdx, exIdx, 'coachCue', v)} placeholder="Cue del coach..." className="w-full bg-zinc-900 border border-zinc-800 p-4 rounded-xl text-white text-[10px] italic" />
                     </div>
                   ))}
                   <button onClick={() => setPicker(wIdx)} className="w-full py-4 border-2 border-dashed border-zinc-900 rounded-2xl text-[9px] font-black text-zinc-700 uppercase">+ AÑADIR</button>
                </div>
             </div>
          ))}
          <button onClick={() => setLocal({...local, workouts: [...local.workouts, { id: `w-${Date.now()}`, name: `SESIÓN ${local.workouts.length+1}`, day: local.workouts.length+1, exercises: [] }]})} className="w-full py-8 border-2 border-dashed border-zinc-900 rounded-[2.5rem] text-[10px] font-black text-zinc-700 uppercase tracking-widest"><Plus size={24}/> Nueva Sesión</button>
       </div>

       {picker !== null && (
         <div className="fixed inset-0 z-[200] bg-black/98 backdrop-blur-3xl p-8 flex flex-col">
            <header className="flex justify-between items-center mb-8 shrink-0">
              <h3 className="text-2xl font-display italic text-white uppercase tracking-tighter">BIBLIOTECA</h3>
              <button onClick={() => setPicker(null)} className="text-white"><X size={24}/></button>
            </header>
            <div className="flex-1 space-y-3 overflow-y-auto no-scrollbar pb-10">
              {allExercises.map((ex: any) => (
                <div key={ex.id} onClick={() => {
                   const nw = [...local.workouts];
                   nw[picker].exercises.push({ exerciseId: ex.id, name: ex.name, targetSets: 4, targetReps: "12", coachCue: "" });
                   setLocal({...local, workouts: nw});
                   setPicker(null);
                }} className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl flex justify-between items-center active:scale-95">
                  <div><p className="font-black text-white uppercase italic text-lg">{ex.name}</p><p className="text-[8px] font-bold text-zinc-600 uppercase">{ex.muscleGroup}</p></div>
                  <Plus size={20} className="text-red-600" />
                </div>
              ))}
            </div>
         </div>
       )}
    </div>
  );
});

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-2.5 rounded-2xl ${active ? 'bg-red-600/10 scale-110' : ''}`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-[0.3em] ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
  </button>
));

const UserDialog = memo(({ onSave, onCancel }: any) => {
  const [n, setN] = useState('');
  return (
    <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-3xl flex items-center justify-center p-8">
       <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 p-10 rounded-[2.5rem] space-y-10">
          <h2 className="text-4xl font-display italic text-white uppercase text-center leading-none">NUEVO PERFIL</h2>
          <div className="space-y-5">
             <input placeholder="NOMBRE COMPLETO" className="w-full bg-zinc-950 border border-zinc-800 p-6 rounded-3xl text-center font-bold text-white uppercase" onChange={e => setN(e.target.value)} />
             <NeonButton onClick={() => onSave({ id: `u-${Date.now()}`, name: n, goal: Goal.PERFORMANCE, level: UserLevel.BEGINNER, daysPerWeek: 3, equipment: ['Todo'], role: 'client', streak: 0, createdAt: new Date().toISOString() })} className="w-full py-6">CREAR ATLETA</NeonButton>
             <button onClick={onCancel} className="w-full text-zinc-700 font-black text-[9px] uppercase">Cancelar</button>
          </div>
       </div>
    </div>
  );
});