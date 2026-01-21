
import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, Trophy, ExternalLink, X, ShieldCheck, 
  Video, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Flame, Plus, Search, LogOut, Timer, UserPlus, 
  Edit3, ChevronLeft, Copy, Settings, Image as ImageIcon,
  Lock, Fingerprint, Megaphone, RefreshCw, Wifi, Sparkles
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { User, Plan, Workout, Exercise, WorkoutLog, Goal, UserLevel } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './geminiService';

// --- CONFIGURACIÓN DE MARCA POR DEFECTO ---
// REEMPLAZA ESTA URL POR TU LINK "RAW" DE GITHUB
const DEFAULT_LOGO = "https://raw.githubusercontent.com/TU_USUARIO/TU_REPO/main/tu-logo.png";
const DEFAULT_PIN = "KINETIX2025";

const DataService = {
  getPlans: async (): Promise<Plan[]> => JSON.parse(localStorage.getItem('kx_plans') || '[]'),
  savePlan: async (plan: Plan) => {
    const plans = await DataService.getPlans();
    const updated = [plan, ...plans.filter((p: Plan) => p.userId !== plan.userId)];
    localStorage.setItem('kx_plans', JSON.stringify(updated));
    return true;
  },
  getLogs: async (): Promise<WorkoutLog[]> => JSON.parse(localStorage.getItem('kx_logs') || '[]'),
  saveLog: async (log: WorkoutLog) => {
    const logs = await DataService.getLogs();
    localStorage.setItem('kx_logs', JSON.stringify([log, ...logs]));
    return true;
  },
  getUsers: async (): Promise<User[]> => {
    const stored = localStorage.getItem('kx_users');
    return stored ? JSON.parse(stored) : [MOCK_USER];
  },
  saveUser: async (user: User) => {
    const users = await DataService.getUsers();
    localStorage.setItem('kx_users', JSON.stringify([...users, user]));
    return true;
  },
  getBrandConfig: () => JSON.parse(localStorage.getItem('kx_brand') || JSON.stringify({ logo: DEFAULT_LOGO, pin: DEFAULT_PIN })),
  saveBrandConfig: (config: { logo: string, pin: string }) => localStorage.setItem('kx_brand', JSON.stringify(config))
};

const NeonButton = memo(({ children, onClick, variant = 'primary', className = '', loading = false, icon, disabled = false }: any) => {
  const base = "relative overflow-hidden px-6 py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-3 text-[10px] uppercase tracking-[0.2em] active:scale-95 disabled:opacity-30 group shrink-0 select-none";
  const styles = {
    primary: 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.2)]',
    secondary: 'bg-cyan-400 hover:bg-cyan-300 text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]',
    outline: 'border border-zinc-800 hover:border-zinc-500 text-zinc-400 bg-zinc-900/40 hover:text-white',
    accent: 'bg-zinc-950 border border-red-600/30 text-red-500 hover:border-red-600 hover:bg-red-600/5'
  };
  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${base} ${styles[variant as keyof typeof styles]} ${className}`}>
      {loading ? <RefreshCw className="animate-spin" size={16} /> : <>{icon}{children}</>}
    </button>
  );
});

const GlassCard = memo(({ children, className = '', onClick, alert = false }: any) => (
  <div onClick={onClick} className={`relative bg-zinc-900/40 backdrop-blur-3xl border ${alert ? 'border-red-600/50' : 'border-zinc-800/40'} rounded-[2.5rem] p-6 shadow-2xl transition-all duration-500 ${onClick ? 'cursor-pointer hover:border-zinc-600 active:scale-[0.98]' : ''} ${className}`}>
    {alert && <div className="absolute top-4 right-4 w-2 h-2 bg-red-600 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]"></div>}
    {children}
  </div>
));

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('home');
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [editingPlan, setEditingPlan] = useState<{plan: Plan, isNew: boolean} | null>(null);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [loginName, setLoginName] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'online' | 'syncing'>('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [workoutSummary, setWorkoutSummary] = useState<WorkoutLog | null>(null);
  const [showCoachAuth, setShowCoachAuth] = useState(false);
  const [coachPinInput, setCoachPinInput] = useState('');
  const [brandConfig, setBrandConfig] = useState(DataService.getBrandConfig());

  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const stored = localStorage.getItem('kx_exercises');
    return stored ? JSON.parse(stored) : INITIAL_EXERCISES;
  });
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);

  const syncData = useCallback(async () => {
    setCloudStatus('syncing');
    try {
      const [u, p, l] = await Promise.all([DataService.getUsers(), DataService.getPlans(), DataService.getLogs()]);
      setUsers(u);
      setPlans(p);
      setLogs(l);
      setBrandConfig(DataService.getBrandConfig());
    } catch (e) {
      console.error("Sync Error", e);
    } finally {
      setCloudStatus('online');
    }
  }, []);

  useEffect(() => { syncData(); }, [syncData]);

  const handleLogin = useCallback(async () => {
    if (!loginName) return;
    setCloudStatus('syncing');
    const user = users.find(u => u.name.toLowerCase().trim() === loginName.toLowerCase().trim());
    if (user) {
      setCurrentUser(user);
      setActiveTab('home');
    } else {
      alert("Atleta no encontrado. El Coach debe darte de alta en el sistema.");
    }
    setCloudStatus('online');
  }, [users, loginName]);

  const handleCoachAuth = () => {
    if (coachPinInput === brandConfig.pin) {
      setCurrentUser({...MOCK_USER, role: 'coach', name: 'Master Coach', id: 'coach-id-master'});
      setActiveTab('admin');
      setShowCoachAuth(false);
      setCoachPinInput('');
    } else {
      alert("PIN DE MANDO INCORRECTO.");
    }
  };

  const updateBrand = (newConfig: any) => {
    DataService.saveBrandConfig(newConfig);
    setBrandConfig(newConfig);
    alert("Identidad Kinetix actualizada correctamente.");
  };

  const onAiGenerate = useCallback(async (user: User) => {
    setIsAiGenerating(true);
    try {
      const generated = await generateSmartRoutine(user);
      const enrichedWorkouts = generated.workouts.map((w: any) => ({
        ...w,
        exercises: w.exercises.map((we: any) => ({
          ...we,
          name: exercises.find(e => e.id === we.exerciseId)?.name || 'Nueva Técnica'
        }))
      }));
      setEditingPlan({ 
        plan: { ...generated, workouts: enrichedWorkouts, id: `p-${Date.now()}`, userId: user.id, coachNotes: 'Optimizado por IA. Ajusta cargas según RPE.', updatedAt: new Date().toISOString() }, 
        isNew: true 
      });
    } catch (error) {
      alert("Error en el motor de IA Kinetix. Verifica tu API KEY.");
    } finally { setIsAiGenerating(false); }
  }, [exercises]);

  const currentPlan = useMemo(() => plans.find(p => p.userId === currentUser?.id), [plans, currentUser]);

  const progressData = useMemo(() => {
    const userLogs = logs.filter(l => l.userId === currentUser?.id).reverse();
    return userLogs.map(l => ({
      date: new Date(l.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      volume: l.setsData.reduce((acc, s) => acc + s.sets.reduce((sum, set) => sum + (set.w * set.r), 0), 0)
    })).slice(-10);
  }, [logs, currentUser]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-8 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
        <div className="text-center space-y-12 z-10 animate-in fade-in zoom-in duration-1000">
           <img src={brandConfig.logo} className="w-40 h-40 mx-auto drop-shadow-[0_0_50px_rgba(239,68,68,0.3)] float object-contain" alt="Kinetix Logo" />
           <div className="space-y-4">
              <h1 className="text-7xl font-display italic tracking-tighter uppercase text-white leading-none">KINETIX</h1>
              <p className="text-zinc-500 font-black uppercase tracking-[0.5em] text-[10px]">FUNCTIONAL ZONE</p>
           </div>
           
           {!showCoachAuth ? (
             <div className="space-y-6">
                <GlassCard className="max-w-xs mx-auto p-10 space-y-6 bg-zinc-950/60 border-zinc-800">
                   <input value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="NOMBRE DEL ATLETA" className="w-full bg-zinc-950 border border-zinc-900 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase placeholder:text-zinc-800" />
                   <NeonButton onClick={handleLogin} loading={cloudStatus === 'syncing'} className="w-full py-6">ACCEDER</NeonButton>
                </GlassCard>
                <button onClick={() => setShowCoachAuth(true)} className="text-[9px] font-black text-zinc-800 uppercase tracking-[0.4em] hover:text-red-500 flex items-center gap-2 mx-auto transition-all"><Lock size={12}/> ACCESO COACH</button>
             </div>
           ) : (
             <GlassCard className="max-w-xs mx-auto p-10 space-y-6 bg-zinc-950/60 border-red-600/20 animate-in slide-in-from-bottom-4">
                <p className="text-[8px] font-black text-red-600 uppercase tracking-widest">SISTEMA DE SEGURIDAD</p>
                <input type="password" value={coachPinInput} onChange={e => setCoachPinInput(e.target.value)} placeholder="PIN" className="w-full bg-zinc-950 border border-zinc-900 p-6 rounded-3xl text-center font-bold text-white outline-none focus:border-red-600 uppercase" />
                <NeonButton onClick={handleCoachAuth} className="w-full py-6">DESBLOQUEAR</NeonButton>
                <button onClick={() => setShowCoachAuth(false)} className="text-[9px] text-zinc-700 uppercase font-black tracking-widest">Regresar</button>
             </GlassCard>
           )}
        </div>
      </div>
    );
  }

  if (editingPlan) return <PlanEditor plan={editingPlan.plan} allExercises={exercises} onSave={async (p: any) => { setCloudStatus('syncing'); await DataService.savePlan(p); setPlans(prev => [p, ...prev.filter(x => x.userId !== p.userId)]); setEditingPlan(null); setCloudStatus('online'); }} onCancel={() => setEditingPlan(null)} />;
  if (currentWorkout) return <LiveWorkout workout={currentWorkout} exercises={exercises} lastLogs={logs.filter(l => l.userId === currentUser.id)} onFinish={async (l: any) => { setCloudStatus('syncing'); await DataService.saveLog(l); setLogs([l, ...logs]); setWorkoutSummary(l); setCurrentWorkout(null); setCloudStatus('online'); }} onCancel={() => setCurrentWorkout(null)} />;

  if (workoutSummary) return (
    <div className="fixed inset-0 z-[200] bg-[#050507] flex flex-col items-center justify-center p-8 animate-in fade-in duration-500">
       <Trophy size={80} className="text-red-600 mb-6 drop-shadow-[0_0_30px_rgba(239,68,68,0.5)]" />
       <h2 className="text-6xl font-display italic text-white uppercase tracking-tighter text-center leading-none">MISIÓN<br/><span className="text-red-600">COMPLETADA</span></h2>
       <div className="grid grid-cols-2 gap-4 w-full max-w-xs mt-12">
          <div className="bg-zinc-900/50 p-6 rounded-3xl text-center border border-zinc-800">
             <p className="text-3xl font-display italic text-white">{workoutSummary.setsData.reduce((acc, s) => acc + s.sets.reduce((v, set) => v + (set.w * set.r), 0), 0)}</p>
             <p className="text-[7px] font-black text-zinc-600 uppercase mt-1">KG TOTALES</p>
          </div>
          <div className="bg-zinc-900/50 p-6 rounded-3xl text-center border border-zinc-800">
             <p className="text-3xl font-display italic text-white">{workoutSummary.setsData.reduce((acc, s) => acc + s.sets.length, 0)}</p>
             <p className="text-[7px] font-black text-zinc-600 uppercase mt-1">SERIES COMPLETADAS</p>
          </div>
       </div>
       <NeonButton onClick={() => setWorkoutSummary(null)} className="mt-12 w-full max-w-xs py-6">VOLVER AL PANEL</NeonButton>
    </div>
  );

  return (
    <div className="max-w-md mx-auto min-h-screen bg-[#050507] flex flex-col text-zinc-100 font-sans">
      <header className="p-6 flex justify-between items-center bg-zinc-950/80 backdrop-blur-3xl sticky top-0 z-40 border-b border-zinc-900/40">
        <div className="flex items-center gap-4">
           <img src={brandConfig.logo} className="w-10 h-10 rounded-xl object-contain" alt="Logo" />
           <div className="flex flex-col">
              <span className="font-display italic text-xl uppercase leading-none text-white tracking-tighter">KINETIX</span>
              <div className="flex items-center gap-1.5">
                 <div className={`w-1.5 h-1.5 rounded-full ${cloudStatus === 'syncing' ? 'bg-amber-500 animate-pulse' : 'bg-green-500'}`}></div>
                 <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest">{cloudStatus === 'syncing' ? 'SYNCING' : 'READY'}</span>
              </div>
           </div>
        </div>
        <button onClick={() => setCurrentUser(null)} className="text-zinc-700 bg-zinc-900/40 p-3 rounded-xl border border-zinc-900 hover:text-red-500 transition-all"><LogOut size={16} /></button>
      </header>

      <main className="flex-1 p-8 overflow-y-auto pb-40 no-scrollbar">
        {activeTab === 'home' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                  <h2 className="text-5xl font-display italic tracking-tighter uppercase text-white leading-none">HOLA, <span className="text-red-600 neon-red">{currentUser.name.split(' ')[0]}</span></h2>
                  <div className="flex items-center gap-3 mt-2">
                     <div className="flex items-center gap-1.5 px-3 py-1 bg-red-600/10 border border-red-600/20 rounded-full">
                        <Flame size={12} className="text-red-600" />
                        <span className="text-[8px] font-black text-red-600 uppercase">{currentUser.streak} DÍAS</span>
                     </div>
                     <span className="text-zinc-700 text-[8px] font-black uppercase tracking-widest">{currentUser.level}</span>
                  </div>
               </div>
            </div>

            {currentPlan?.coachNotes && (
              <GlassCard className="bg-red-600/10 border-red-600/30 p-8 flex items-start gap-6">
                 <Megaphone size={28} className="text-red-600 shrink-0 mt-1 animate-bounce" />
                 <div className="space-y-2">
                    <p className="text-[9px] font-black text-red-600 uppercase tracking-[0.3em] italic">DIRECTRIZ DEL COACH</p>
                    <p className="text-lg font-bold text-white italic leading-tight">"{currentPlan.coachNotes}"</p>
                 </div>
              </GlassCard>
            )}

            {currentPlan ? (
              <GlassCard className="bg-gradient-to-br from-zinc-900 to-black p-10 border-red-600/10 hover:border-red-600/30">
                <div className="space-y-8">
                   <div className="space-y-1 text-center">
                      <p className="text-cyan-400 text-[9px] font-black uppercase tracking-[0.4em] italic">SESIÓN DISPONIBLE</p>
                      <h4 className="text-4xl font-display italic uppercase text-white tracking-tighter leading-none">{currentPlan.title}</h4>
                   </div>
                   <NeonButton onClick={() => setCurrentWorkout(currentPlan.workouts[0] || null)} variant="primary" className="w-full py-6" icon={<Play size={18} fill="currentColor"/>}>INICIAR ENTRENAMIENTO</NeonButton>
                </div>
              </GlassCard>
            ) : (
              <div className="py-24 text-center border-2 border-dashed border-zinc-900 rounded-[3rem] opacity-30 flex flex-col items-center gap-4">
                 <Wifi size={20} className="text-zinc-700" />
                 <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-[0.3em]">ESPERANDO PROGRAMACIÓN</p>
              </div>
            )}

            {progressData.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-[9px] font-black text-zinc-600 uppercase tracking-[0.4em] italic">PROGRESO DE CARGA</h3>
                <div className="h-48 w-full bg-zinc-950/40 rounded-[2.5rem] p-4 border border-zinc-900">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={progressData}>
                      <defs>
                        <linearGradient id="colorVol" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#18181b" vertical={false} />
                      <XAxis dataKey="date" stroke="#3f3f46" fontSize={8} />
                      <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }} />
                      <Area type="monotone" dataKey="volume" stroke="#ef4444" fill="url(#colorVol)" strokeWidth={3} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'admin' && currentUser.role === 'coach' && (
          <div className="space-y-10 animate-in slide-in-from-bottom-8 duration-500">
             <div className="flex justify-between items-end">
                <h2 className="text-5xl font-display italic uppercase tracking-tighter text-red-600 leading-none">EQUIPO<br/>KINETIX</h2>
                <button onClick={() => setShowAddUser(true)} className="bg-white/5 p-4 rounded-2xl text-cyan-400 border border-white/10 shadow-xl"><UserPlus size={20}/></button>
             </div>

             <div className="grid gap-4">
                {users.filter(u => u.role === 'client').map(u => (
                  <GlassCard key={u.id} className="p-5 flex items-center justify-between group bg-zinc-950/40 border-zinc-900">
                    <div className="flex items-center gap-4">
                       <div className="w-14 h-14 bg-zinc-950 rounded-2xl flex items-center justify-center text-red-600 font-display italic text-2xl border border-zinc-900">{u.name.charAt(0)}</div>
                       <div>
                          <h4 className="text-lg font-black text-white italic uppercase tracking-tighter leading-none">{u.name}</h4>
                          <span className="text-[7px] text-zinc-700 font-black uppercase mt-1 block tracking-widest">{u.goal}</span>
                       </div>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={() => onAiGenerate(u)} disabled={isAiGenerating} className="p-4 rounded-2xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
                          {isAiGenerating ? <RefreshCw className="animate-spin" size={18}/> : <Sparkles size={18}/>}
                       </button>
                       <button onClick={() => setEditingPlan({ plan: plans.find(p => p.userId === u.id) || { id: `p-${Date.now()}`, userId: u.id, title: 'Protocolo Elite', workouts: [], coachNotes: '', updatedAt: new Date().toISOString() }, isNew: true })} className="bg-zinc-800/40 p-4 rounded-2xl text-zinc-500 border border-zinc-800 hover:text-white transition-all"><Edit3 size={18}/></button>
                    </div>
                  </GlassCard>
                ))}
             </div>

             {/* Panel de Configuración de Marca */}
             <GlassCard className="mt-12 p-8 border-zinc-800">
                <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.3em] mb-6 italic">AJUSTES DE IDENTIDAD</h3>
                <div className="space-y-4">
                   <div className="space-y-2">
                      <label className="text-[8px] font-black text-zinc-700 uppercase ml-2">URL DEL LOGO (GITHUB RAW)</label>
                      <input 
                        value={brandConfig.logo} 
                        onChange={e => setBrandConfig({...brandConfig, logo: e.target.value})}
                        className="w-full bg-zinc-950 border border-zinc-900 p-4 rounded-xl text-[10px] text-white outline-none focus:border-red-600"
                      />
                   </div>
                   <NeonButton onClick={() => updateBrand(brandConfig)} variant="outline" className="w-full py-4 text-[9px]">ACTUALIZAR MARCA</NeonButton>
                </div>
             </GlassCard>
          </div>
        )}

        {activeTab === 'library' && currentUser.role === 'coach' && (
          <div className="space-y-8 animate-in slide-in-from-bottom-8 duration-500">
             <div className="flex justify-between items-end">
                <h2 className="text-5xl font-display italic uppercase tracking-tighter text-white leading-none">BÓVEDA<br/><span className="text-cyan-400">TÉCNICA</span></h2>
                <button onClick={() => setShowAddExercise(true)} className="bg-white/5 p-4 rounded-2xl text-zinc-500 border border-white/10 hover:text-white transition-all"><Plus size={20}/></button>
             </div>
             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-800" size={18} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="BUSCAR EJERCICIO..." className="w-full bg-zinc-900 border border-zinc-800 p-5 pl-12 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white outline-none focus:border-cyan-400 transition-all placeholder:text-zinc-800" />
             </div>
             <div className="grid gap-4">
                {exercises.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).map(e => (
                  <GlassCard key={e.id} className="p-5 flex items-center gap-5 bg-zinc-950/40 border-zinc-900 group">
                    <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center border border-zinc-900 group-hover:border-cyan-400/30 transition-all">
                       <Play size={24} fill="#22d3ee" className="text-cyan-400" />
                    </div>
                    <div className="flex-1">
                       <h4 className="font-black text-lg text-white uppercase italic tracking-tighter leading-none">{e.name}</h4>
                       <span className="text-[8px] text-zinc-600 font-black uppercase mt-2 block tracking-widest italic">{e.muscleGroup}</span>
                    </div>
                    <a href={e.videoUrl} target="_blank" rel="noreferrer" className="text-zinc-800 p-4 hover:text-white transition-colors"><ExternalLink size={18}/></a>
                  </GlassCard>
                ))}
             </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950/90 backdrop-blur-3xl border-t border-zinc-900/50 px-10 py-8 z-50">
        <div className="max-w-md mx-auto flex justify-around items-center">
          <NavItem active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<LayoutDashboard size={24} />} label="Panel" />
          {currentUser.role === 'coach' && (
            <>
              <NavItem active={activeTab === 'library'} onClick={() => setActiveTab('library')} icon={<Video size={24} />} label="Técnica" />
              <NavItem active={activeTab === 'admin'} onClick={() => setActiveTab('admin')} icon={<Users size={24} />} label="Equipo" />
            </>
          )}
        </div>
      </nav>

      {showAddExercise && <ExerciseDialog onSave={(ex: any) => { setExercises(prev => [ex, ...prev]); setShowAddExercise(false); }} onCancel={() => setShowAddExercise(false)} />}
      {showAddUser && <UserDialog onSave={async (user: any) => { setCloudStatus('syncing'); await DataService.saveUser(user); setUsers(prev => [...prev, user]); setShowAddUser(false); setCloudStatus('online'); }} onCancel={() => setShowAddUser(false)} />}
    </div>
  );
}

const LiveWorkout = memo(({ workout, exercises, lastLogs, onFinish, onCancel }: any) => {
  const [idx, setIdx] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [setsLogs, setSetsLogs] = useState<{w: number, r: number}[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const intervalRef = useRef<any>(null);

  const startRest = useCallback(() => {
    setIsResting(true);
    setTimer(90);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => setTimer(t => {
      if (t <= 1) { clearInterval(intervalRef.current); setIsResting(false); return 0; }
      return t - 1;
    }), 1000);
  }, []);

  const ex = workout.exercises[idx];
  const dbEx = exercises.find((e: any) => e.id === ex?.exerciseId);
  const isLast = idx === workout.exercises.length - 1;

  const previousPR = useMemo(() => {
    let max = 0;
    lastLogs.forEach((log: any) => {
      log.setsData.forEach((sd: any) => {
        if (sd.exerciseId === ex.exerciseId) {
          sd.sets.forEach((s: any) => { if (s.w > max) max = s.w; });
        }
      });
    });
    return max;
  }, [ex.exerciseId, lastLogs]);

  const nextExercise = useCallback(() => {
    const currentEntry = { exerciseId: ex.exerciseId, sets: setsLogs };
    const updatedAllLogs = [...allLogs, currentEntry];
    if (isLast) {
      onFinish({ 
        id: `log-${Date.now()}`,
        workoutId: workout.id,
        userId: MOCK_USER.id,
        date: new Date().toISOString(),
        setsData: updatedAllLogs
      });
    } else {
      setAllLogs(updatedAllLogs);
      setSetsLogs([]);
      setIdx(idx + 1);
    }
  }, [ex.exerciseId, setsLogs, allLogs, isLast, onFinish, workout.id]);

  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] p-8 flex flex-col overflow-y-auto no-scrollbar">
       <header className="flex justify-between items-center mb-8 shrink-0">
          <button onClick={onCancel} className="bg-zinc-900 p-4 rounded-2xl text-zinc-700 hover:text-red-600 transition-all"><X size={20}/></button>
          <div className="text-center">
             <p className="text-[8px] font-black text-zinc-700 italic tracking-[0.4em] uppercase">ENTRENAMIENTO EN CURSO</p>
             <h2 className="text-2xl font-display italic text-red-600 leading-none mt-2">{idx+1} / {workout.exercises.length}</h2>
          </div>
          <div className="w-10"></div>
       </header>

       <div className="flex-1 space-y-10">
          <div className="aspect-video bg-black rounded-[2.5rem] border border-zinc-900 overflow-hidden relative shadow-2xl">
             {dbEx && <iframe className="w-full h-full opacity-60 pointer-events-none" src={`https://www.youtube.com/embed/${dbEx.videoUrl.split('/').pop()}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${dbEx.videoUrl.split('/').pop()}`}></iframe>}
             {isResting && (
               <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center animate-in fade-in zoom-in">
                  <p className="text-8xl font-display italic text-white tracking-tighter shadow-red-600/20 shadow-2xl">{timer}s</p>
                  <p className="text-[10px] font-black uppercase text-red-600 mt-4 tracking-[0.3em]">RESTAURACIÓN</p>
                  <button onClick={() => { setIsResting(false); clearInterval(intervalRef.current); }} className="mt-8 text-zinc-700 text-[10px] font-black uppercase border-b border-zinc-900 hover:text-white transition-colors">Saltar</button>
               </div>
             )}
          </div>

          <div className="space-y-6">
             <div className="space-y-2">
                <div className="flex justify-between items-start gap-4">
                   <h3 className="text-4xl font-display italic text-white uppercase tracking-tighter leading-none flex-1">{dbEx?.name}</h3>
                   {previousPR > 0 && (
                     <div className="bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-center shrink-0">
                        <p className="text-[7px] font-black text-amber-500 uppercase leading-none">MAX RECIENTE</p>
                        <p className="text-xs font-display italic text-amber-500 mt-0.5">{previousPR}KG</p>
                     </div>
                   )}
                </div>
                <p className="text-cyan-400 text-[11px] font-bold italic">"{ex?.coachCue || 'Enfoque técnico total.'}"</p>
             </div>
             
             <div className="bg-zinc-950/80 p-8 rounded-[2.5rem] border border-zinc-900 space-y-6 shadow-xl">
                <div className="flex justify-between items-center border-b border-zinc-900 pb-4">
                   <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest italic">BITÁCORA DE SERIES</p>
                   <span className="text-red-600 text-[10px] font-black uppercase">{ex?.targetSets}x{ex?.targetReps} OBJETIVO</span>
                </div>
                <div className="space-y-3">
                   {setsLogs.map((s, i) => (
                     <div key={i} className="flex justify-between items-center bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/50 animate-in slide-in-from-left-2">
                        <span className="text-[9px] font-black text-zinc-700 uppercase italic">SERIE {i+1}</span>
                        <div className="flex items-center gap-4">
                           <span className="text-[12px] font-display italic text-white">{s.w} KG x {s.r} REPS</span>
                        </div>
                     </div>
                   ))}
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <input type="number" id="weight" className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 text-center text-lg font-display italic text-white outline-none focus:border-red-600 transition-all" placeholder="KG" />
                   <input type="number" id="reps" className="bg-zinc-900 p-5 rounded-2xl border border-zinc-800 text-center text-lg font-display italic text-white outline-none focus:border-red-600 transition-all" placeholder="REPS" />
                </div>
                <NeonButton onClick={() => {
                  const wInput = document.getElementById('weight') as HTMLInputElement;
                  const rInput = document.getElementById('reps') as HTMLInputElement;
                  if(wInput.value && rInput.value) {
                    setSetsLogs([...setsLogs, { w: parseFloat(wInput.value), r: parseInt(rInput.value) }]);
                    wInput.value = '';
                    rInput.value = '';
                  }
                }} variant="secondary" className="w-full py-5 text-[9px]" icon={<CheckCircle2 size={16}/>}>REGISTRAR SERIE</NeonButton>
             </div>
          </div>
       </div>

       <footer className="mt-12 flex gap-4 pb-12 shrink-0">
          <NeonButton onClick={startRest} variant="outline" className="flex-1 py-6" icon={<Timer size={16}/>}>REST</NeonButton>
          <NeonButton onClick={nextExercise} variant="primary" className="flex-[2] py-6" icon={isLast ? <Trophy size={18}/> : <ArrowRight size={18}/>}>
             {isLast ? 'CONCLUIR' : 'SIGUIENTE'}
          </NeonButton>
       </footer>
    </div>
  );
});

const PlanEditor = memo(({ plan, allExercises, onSave, onCancel }: any) => {
  const [localPlan, setLocalPlan] = useState<Plan>(plan);
  const [showPicker, setShowPicker] = useState<{ workoutIndex: number } | null>(null);

  const cloneWorkout = useCallback((w: Workout) => {
    const newW = { ...w, id: `w-${Date.now()}`, name: `${w.name} (COPIA)` };
    setLocalPlan(prev => ({ ...prev, workouts: [...prev.workouts, newW] }));
  }, []);

  const addExerciseToWorkout = useCallback((wIdx: number, exercise: Exercise) => {
    setLocalPlan(prev => {
      const newWorkouts = [...prev.workouts];
      newWorkouts[wIdx].exercises.push({
        exerciseId: exercise.id,
        name: exercise.name,
        targetSets: 3,
        targetReps: '12',
        coachCue: 'Ejecución estricta'
      });
      return { ...prev, workouts: newWorkouts };
    });
    setShowPicker(null);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#050507] z-[100] p-8 flex flex-col overflow-hidden animate-in slide-in-from-right-full">
       <header className="flex justify-between items-center mb-10 shrink-0">
          <button onClick={onCancel} className="bg-zinc-900/50 p-4 rounded-2xl text-zinc-600 hover:text-white transition-colors"><ChevronLeft size={24}/></button>
          <div className="text-center">
             <input value={localPlan.title} onChange={e => setLocalPlan({...localPlan, title: e.target.value})} className="bg-transparent text-2xl font-display italic text-white text-center outline-none uppercase tracking-tighter" />
             <p className="text-[8px] text-zinc-800 font-black uppercase tracking-[0.4em] italic mt-1">PROGRAMACIÓN TÉCNICA</p>
          </div>
          <button onClick={() => onSave(localPlan)} className="bg-red-600 p-5 rounded-2xl text-white shadow-xl active:scale-90 transition-all"><Save size={24}/></button>
       </header>

       <div className="flex-1 overflow-y-auto space-y-10 pb-40 no-scrollbar">
          <GlassCard className="p-8 border-red-600/10 bg-red-600/5">
             <div className="flex items-center gap-4 mb-4">
                <Megaphone size={20} className="text-red-600" />
                <h3 className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] italic">INDICACIONES DEL COACH</h3>
             </div>
             <textarea 
               value={localPlan.coachNotes} 
               onChange={e => setLocalPlan({...localPlan, coachNotes: e.target.value})}
               placeholder="Escribe las pautas del bloque aquí..." 
               className="w-full bg-zinc-950 border border-zinc-900 p-5 rounded-2xl text-xs font-bold italic text-white outline-none focus:border-red-600 min-h-[100px] placeholder:text-zinc-800 resize-none"
             />
          </GlassCard>

          {localPlan.workouts.map((w, wIdx) => (
            <GlassCard key={wIdx} className="p-8 border-zinc-900 bg-zinc-950/20">
               <div className="flex justify-between mb-8 items-center border-b border-zinc-900 pb-6">
                  <input value={w.name} onChange={e => {
                    const newW = [...localPlan.workouts];
                    newW[wIdx].name = e.target.value;
                    setLocalPlan({...localPlan, workouts: newW});
                  }} className="bg-transparent text-3xl font-display italic text-white outline-none uppercase tracking-tighter w-full" />
                  <div className="flex gap-4">
                     <button onClick={() => cloneWorkout(w)} className="text-zinc-700 hover:text-cyan-400 transition-colors"><Copy size={18}/></button>
                     <button onClick={() => setLocalPlan({...localPlan, workouts: localPlan.workouts.filter((_, idx) => idx !== wIdx)})} className="text-zinc-700 hover:text-red-500 transition-colors"><Trash2 size={18}/></button>
                  </div>
               </div>
               
               <div className="space-y-6">
                  {w.exercises.map((we, eIdx) => (
                    <div key={eIdx} className="p-6 bg-zinc-900/60 rounded-[2.5rem] border border-zinc-900/50 space-y-4">
                       <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black italic uppercase text-cyan-400">{we.name}</span>
                          <button onClick={() => {
                            const newWArr = [...localPlan.workouts];
                            newWArr[wIdx].exercises = newWArr[wIdx].exercises.filter((_, i) => i !== eIdx);
                            setLocalPlan({...localPlan, workouts: newWArr});
                          }} className="text-zinc-800 hover:text-red-500"><X size={16}/></button>
                       </div>
                       <input value={`${we.targetSets}x${we.targetReps}`} onChange={e => {
                         const val = e.target.value;
                         const newWArr = [...localPlan.workouts];
                         const parts = val.split('x');
                         newWArr[wIdx].exercises[eIdx].targetSets = parseInt(parts[0]) || 0;
                         newWArr[wIdx].exercises[eIdx].targetReps = parts[1] || '0';
                         setLocalPlan({...localPlan, workouts: newWArr});
                       }} className="w-full bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs font-display italic text-white outline-none focus:border-cyan-400" />
                    </div>
                  ))}
                  <button onClick={() => setShowPicker({ workoutIndex: wIdx })} className="w-full py-6 border-2 border-dashed border-zinc-900 rounded-[2.5rem] text-zinc-800 font-black text-[10px] uppercase tracking-[0.3em] hover:text-cyan-400 transition-all">
                    + AÑADIR TÉCNICA
                  </button>
               </div>
            </GlassCard>
          ))}
          <button onClick={() => setLocalPlan(prev => ({...prev, workouts: [...prev.workouts, {id: `w-${Date.now()}`, name: `SESIÓN ${prev.workouts.length + 1}`, day: 1, exercises: []}]}))} className="py-12 border-2 border-dashed border-zinc-900 rounded-[3rem] text-zinc-800 font-black flex flex-col items-center justify-center gap-4 hover:text-zinc-600 transition-all">
            <Plus size={24}/> 
            <span className="text-[10px] uppercase tracking-[0.4em]">NUEVA SESIÓN</span>
          </button>
       </div>

       {showPicker !== null && (
         <div className="fixed inset-0 z-[120] bg-black/98 backdrop-blur-3xl p-8 flex flex-col animate-in slide-in-from-bottom-full">
            <header className="flex justify-between items-center mb-10">
               <h3 className="text-3xl font-display italic text-white uppercase tracking-tighter">BÓVEDA KINETIX</h3>
               <button onClick={() => setShowPicker(null)} className="p-4 bg-zinc-900 rounded-2xl text-zinc-600 hover:text-white transition-colors"><X size={20}/></button>
            </header>
            <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-20">
               {allExercises.map(ex => (
                 <div key={ex.id} onClick={() => addExerciseToWorkout(showPicker!.workoutIndex, ex)} className="p-6 bg-zinc-950 border border-zinc-900 rounded-[2rem] flex items-center justify-between group cursor-pointer hover:border-cyan-400/50 transition-all">
                    <h4 className="font-black text-white uppercase italic tracking-tighter text-lg">{ex.name}</h4>
                    <Plus size={24} className="text-zinc-800 group-hover:text-cyan-400"/>
                 </div>
               ))}
            </div>
         </div>
       )}
    </div>
  );
});

const ExerciseDialog = memo(({ onSave, onCancel }: any) => {
  const [d, setD] = useState({n: '', m: '', v: ''});
  return (
    <div className="fixed inset-0 z-[130] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-8">
       <GlassCard className="w-full max-w-sm space-y-10 bg-zinc-950 border-zinc-800">
          <h2 className="text-4xl font-display italic text-white uppercase tracking-tighter text-center leading-none">REGISTRAR<br/>TÉCNICA</h2>
          <div className="space-y-5">
             <input placeholder="NOMBRE" className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl outline-none text-white font-bold uppercase" onChange={e => setD({...d, n: e.target.value})} />
             <input placeholder="GRUPO MUSCULAR" className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl outline-none text-white font-bold uppercase" onChange={e => setD({...d, m: e.target.value})} />
             <input placeholder="ID YOUTUBE" className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl outline-none text-white font-mono" onChange={e => setD({...d, v: e.target.value})} />
             <NeonButton onClick={() => onSave({id: `ex-${Date.now()}`, name: d.n, muscleGroup: d.m, videoUrl: `https://youtu.be/${d.v}`})} className="w-full py-6" variant="secondary" icon={<Save size={18}/>}>CONFIRMAR</NeonButton>
             <button onClick={onCancel} className="w-full text-zinc-800 font-black text-[9px] tracking-[0.5em] uppercase hover:text-white transition-colors">Cancelar</button>
          </div>
       </GlassCard>
    </div>
  );
});

const UserDialog = memo(({ onSave, onCancel }: any) => {
  const [u, setU] = useState<Partial<User>>({
    name: '', goal: Goal.GAIN_MUSCLE, level: UserLevel.BEGINNER, daysPerWeek: 3, equipment: ['Gym Completo'], streak: 0
  });
  return (
    <div className="fixed inset-0 z-[110] bg-black/98 backdrop-blur-3xl flex items-center justify-center p-8">
       <GlassCard className="w-full max-w-sm space-y-10 bg-zinc-950 border-red-600/20">
          <h2 className="text-4xl font-display italic text-white uppercase tracking-tighter text-center leading-none">ALTA DE<br/>ATLETA</h2>
          <div className="space-y-5">
             <input placeholder="NOMBRE Y APELLIDO" className="w-full bg-zinc-900 border border-zinc-800 p-6 rounded-2xl outline-none text-white font-bold uppercase" onChange={e => setU({...u, name: e.target.value})} />
             <div className="grid grid-cols-2 gap-4">
                <select className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-zinc-500 text-[10px] font-black uppercase appearance-none" onChange={e => setU({...u, goal: e.target.value as Goal})}>
                   {Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl text-zinc-500 text-[10px] font-black uppercase appearance-none" onChange={e => setU({...u, level: e.target.value as UserLevel})}>
                   {Object.values(UserLevel).map(l => <option key={l} value={l}>{l}</option>)}
                </select>
             </div>
             <NeonButton onClick={() => onSave({...u, id: `u-${Date.now()}`, role: 'client', createdAt: new Date().toISOString()})} className="w-full py-6" icon={<UserPlus size={18}/>}>DAR DE ALTA</NeonButton>
             <button onClick={onCancel} className="w-full text-zinc-800 font-black text-[9px] tracking-[0.5em] uppercase hover:text-white transition-colors">Cancelar</button>
          </div>
       </GlassCard>
    </div>
  );
});

const NavItem = memo(({ icon, label, active, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2 transition-all flex-1 py-2 outline-none ${active ? 'text-red-600' : 'text-zinc-800'}`}>
    <div className={`p-2.5 rounded-2xl transition-all ${active ? 'bg-red-600/10 scale-110' : 'hover:bg-white/5'}`}>{icon}</div>
    <span className={`text-[8px] font-black uppercase tracking-[0.3em] transition-opacity ${active ? 'opacity-100' : 'opacity-40'}`}>{label}</span>
  </button>
));
