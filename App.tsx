import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer, Download, Upload, Filter, Clock, Database, FileJson, Cloud, CloudOff,
  Wifi, WifiOff, AlertTriangle, Smartphone, Signal, Globe, Loader2, BrainCircuit,
  CalendarDays, Trophy
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { User, Plan, Workout, Exercise, Goal, UserLevel, WorkoutExercise, WorkoutLog } from './types';
import { MOCK_USER, EXERCISES_DB as INITIAL_EXERCISES } from './constants';
import { generateSmartRoutine } from './services/geminiService';
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

const isUUID = (str: string) => {
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
};

// --- SYSTEM CONSTANTS ---
const COACH_UUID = 'e9c12345-6789-4321-8888-999999999999';
const STORAGE_KEY = 'KINETIX_DATA_PRO_V1'; 
const SESSION_KEY = 'KINETIX_SESSION_PRO_V1';

// --- DATA ENGINE (CLOUD FIRST HYBRID) ---
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
      // Disparar evento para actualizar UI
      window.dispatchEvent(new Event('storage-update'));
    } catch (e) { console.error("Storage Limit Reached", e); }
  },
  
  init: () => {
    const store = DataEngine.getStore();
    if (!store.USERS) {
      DataEngine.saveStore({
        USERS: JSON.stringify([MOCK_USER]),
        EXERCISES: JSON.stringify(INITIAL_EXERCISES),
        LOGO_URL: 'https://raw.githubusercontent.com/StackBlitz/stackblitz-images/main/kinetix-wolf-logo.png'
      });
    }
  },
  
  getUsers: (): User[] => {
    const s = DataEngine.getStore();
    return s.USERS ? JSON.parse(s.USERS) : [];
  },
  
  getUserById: (id: string): User | undefined => {
    const users = DataEngine.getUsers();
    return users.find(u => u.id === id);
  },

  getPlan: (uid: string): Plan | null => {
    const s = DataEngine.getStore();
    const p = s[`PLAN_${uid}`];
    return p ? JSON.parse(p) : null;
  },

  savePlan: async (plan: Plan) => {
    const s = DataEngine.getStore();
    s[`PLAN_${plan.userId}`] = JSON.stringify(plan);
    DataEngine.saveStore(s);
    
    // Cloud Sync (Simplified for demo)
    if (supabaseConnectionStatus.isConfigured) {
       // Logic to save plan to Supabase would go here
       console.log("Saving plan to cloud...", plan);
    }
  },

  pullFromCloud: async () => {
    if (!supabaseConnectionStatus.isConfigured) {
      console.warn("⚠️ MODO OFFLINE");
      return false;
    }
    try {
      console.log("🔄 SYNC...");
      const s = DataEngine.getStore();
      
      const { data: users } = await supabase.from('users').select('*');
      if (users) {
        const mappedUsers = users.map(u => ({
             id: u.id,
             name: u.name,
             email: u.email,
             role: u.role,
             goal: u.goal,
             level: u.level,
             daysPerWeek: u.days_per_week,
             equipment: u.equipment || [],
             streak: u.streak,
             createdAt: u.created_at
        }));
        s.USERS = JSON.stringify(mappedUsers);
      }
      
      DataEngine.saveStore(s);
      return true;
    } catch (e) {
      console.error("Sync Failed", e);
      return false;
    }
  },

  saveUser: async (user: User) => {
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    s.USERS = JSON.stringify(users);
    DataEngine.saveStore(s);

    if (supabaseConnectionStatus.isConfigured && isUUID(user.id)) {
      try {
        await supabase.from('users').upsert({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          goal: user.goal,
          level: user.level,
          days_per_week: user.daysPerWeek,
          equipment: user.equipment,
          streak: user.streak
        });
      } catch(e) { console.error("Cloud Error", e); }
    }
  }
};

// --- COMPONENTS ---

const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(supabaseConnectionStatus.isConfigured);
  return (
    <div className={`fixed bottom-20 md:bottom-4 right-4 z-50 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-2 backdrop-blur-md border ${isOnline ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
      {isOnline ? <Cloud size={10} /> : <CloudOff size={10} />}
      <span>{isOnline ? 'ONLINE' : 'LOCAL'}</span>
    </div>
  );
};

// LOGIN PAGE
const LoginPage = ({ onLogin }: { onLogin: (role: 'coach' | 'client') => void }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 600)); // Fake delay for UX
    const cleanPin = pin.trim();
    if (cleanPin === '2025' || cleanPin === 'KINETIX2025') {
      await DataEngine.pullFromCloud();
      onLogin('coach');
    } else {
      setError(true);
      setPin('');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-sm z-10 animate-fade-in-up">
        <div className="mb-12 text-center">
          <h1 className="font-display text-5xl italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 neon-red mb-2">
            KINETIX
          </h1>
          <p className="text-gray-500 tracking-[0.2em] text-xs font-bold">HIGH PERFORMANCE ZONE</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold ml-1">PIN de Acceso</label>
              <input
                type="tel" inputMode="numeric" pattern="[0-9]*" 
                value={pin} onChange={(e) => { setError(false); setPin(e.target.value); }}
                placeholder="• • • •"
                className={`w-full bg-black/40 border-2 ${error ? 'border-red-500 text-red-500' : 'border-white/10 focus:border-red-500 text-white'} rounded-xl px-4 py-4 text-center text-3xl tracking-[1em] font-display font-bold outline-none transition-all placeholder-gray-700`}
                maxLength={4} autoFocus autoComplete="off"
              />
            </div>
            {error && <div className="text-red-500 text-xs font-bold text-center">PIN INCORRECTO</div>}
            <button type="submit" disabled={isLoading} className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-red-900/20">
              {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><span>ENTRAR</span><ArrowRight size={20} /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'workouts'>('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [triggerUpdate, setTriggerUpdate] = useState(0); // Para forzar re-renders cuando cambia DataEngine

  // Efecto para escuchar cambios en Storage
  useEffect(() => {
    DataEngine.init();
    const session = localStorage.getItem(SESSION_KEY);
    if (session) setCurrentUser(JSON.parse(session));

    const handleStorageUpdate = () => setTriggerUpdate(prev => prev + 1);
    window.addEventListener('storage-update', handleStorageUpdate);
    return () => window.removeEventListener('storage-update', handleStorageUpdate);
  }, []);

  const handleLogin = useCallback((role: 'coach' | 'client') => {
    const coachUser: User = {
      id: COACH_UUID, name: 'COACH KINETIX', email: 'staff@kinetix.com',
      role: 'coach', goal: Goal.PERFORMANCE, level: UserLevel.ADVANCED,
      daysPerWeek: 6, equipment: [], streak: 999, createdAt: new Date().toISOString()
    };
    setCurrentUser(coachUser);
    localStorage.setItem(SESSION_KEY, JSON.stringify(coachUser));
  }, []);

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
    setSelectedClientId(null);
    setActiveTab('dashboard');
  };

  const navigateToClient = (clientId: string) => {
    setSelectedClientId(clientId);
    setActiveTab('clients');
  };

  if (!currentUser) return <LoginPage onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-[#050507] text-white pb-24 md:pb-0 font-sans selection:bg-red-500/30">
      <ConnectionStatus />
      
      {/* HEADER MOBILE */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#050507]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2" onClick={() => setActiveTab('dashboard')}>
           <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-display italic font-bold shadow-lg shadow-red-900/40">K</div>
           <span className="font-display font-bold italic tracking-tighter">KINETIX</span>
        </div>
        <div className="flex items-center gap-3">
           <button onClick={() => DataEngine.pullFromCloud()} className="p-2 bg-white/5 rounded-full active:bg-white/10">
              <RefreshCw size={16} className="text-gray-400" />
           </button>
           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-800 border border-white/20 flex items-center justify-center font-bold text-xs">
             {currentUser.name[0]}
           </div>
        </div>
      </header>

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-white/5 bg-[#050507]">
        <div className="p-8 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <h1 className="font-display text-3xl italic font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-white">KINETIX</h1>
          <p className="text-xs text-gray-500 tracking-[0.3em] font-bold mt-1">ELITE ZONE</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedClientId(null); }} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavButton active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setSelectedClientId(null); }} icon={<Users size={20} />} label="Atletas" />
          <NavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={<Dumbbell size={20} />} label="Biblioteca" />
        </nav>
        <div className="p-4 border-t border-white/5">
          <button onClick={handleLogout} className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors w-full p-3 rounded-xl hover:bg-white/5">
            <LogOut size={20} /> <span className="font-medium">Salir</span>
          </button>
        </div>
      </aside>

      {/* CONTENT */}
      <main className="md:ml-64 p-4 md:p-8 max-w-7xl mx-auto min-h-[calc(100vh-80px)]">
        {activeTab === 'dashboard' && <DashboardView user={currentUser} onNavigateToClients={() => setActiveTab('clients')} />}
        
        {activeTab === 'clients' && !selectedClientId && (
          <ClientsView onSelectClient={navigateToClient} />
        )}
        
        {activeTab === 'clients' && selectedClientId && (
          <ClientDetailView clientId={selectedClientId} onBack={() => setSelectedClientId(null)} />
        )}
        
        {activeTab === 'workouts' && <WorkoutsView />}
      </main>

      {/* MOBILE NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0A0A0C]/95 backdrop-blur-xl border-t border-white/10 flex justify-around p-4 z-50 pb-safe shadow-2xl">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => { setActiveTab('dashboard'); setSelectedClientId(null); }} icon={<LayoutDashboard size={24} />} label="Inicio" />
        <MobileNavButton active={activeTab === 'clients'} onClick={() => { setActiveTab('clients'); setSelectedClientId(null); }} icon={<Users size={24} />} label="Atletas" />
        <MobileNavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={<Dumbbell size={24} />} label="Entreno" />
      </nav>
    </div>
  );
}

// --- VIEW COMPONENTS ---

const DashboardView = ({ user, onNavigateToClients }: { user: User, onNavigateToClients: () => void }) => {
  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="bg-gradient-to-r from-red-900/40 to-black border border-red-500/20 rounded-3xl p-6 relative overflow-hidden group cursor-pointer" onClick={onNavigateToClients}>
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-red-400 font-bold text-sm tracking-wider uppercase">
             <Activity size={16} /> Panel de Control
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold italic mb-2">HOLA, COACH</h2>
          <p className="text-gray-400 max-w-md text-sm">Gestiona tus atletas de alto rendimiento y genera protocolos con IA.</p>
        </div>
        <div className="absolute right-[-20px] top-[-20px] w-40 h-40 bg-red-600/20 rounded-full blur-3xl pointer-events-none" />
        <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 text-white/20 group-hover:text-white transition-colors" size={32} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Atletas" value={DataEngine.getUsers().length - 1} icon={<Users size={18} className="text-blue-400" />} />
        <StatCard label="Planes Activos" value="12" icon={<CalendarDays size={18} className="text-green-400" />} />
        <StatCard label="Generados con IA" value="84" icon={<BrainCircuit size={18} className="text-purple-400" />} />
        <StatCard label="Efectividad" value="98%" icon={<Trophy size={18} className="text-yellow-400" />} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors cursor-pointer active:scale-[0.99]" onClick={onNavigateToClients}>
           <div className="w-12 h-12 bg-red-600/10 rounded-xl flex items-center justify-center mb-4 text-red-500">
             <Users size={24} />
           </div>
           <h3 className="text-lg font-bold mb-1">Gestionar Atletas</h3>
           <p className="text-xs text-gray-500">Ver perfiles, asignar rutinas y monitorear progreso.</p>
        </div>
        <div className="bg-[#0F0F11] border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-colors cursor-pointer active:scale-[0.99]">
           <div className="w-12 h-12 bg-blue-600/10 rounded-xl flex items-center justify-center mb-4 text-blue-500">
             <Sparkles size={24} />
           </div>
           <h3 className="text-lg font-bold mb-1">Kinetix AI (Beta)</h3>
           <p className="text-xs text-gray-500">Generador experimental de protocolos de fuerza.</p>
        </div>
      </div>
    </div>
  );
};

const ClientsView = ({ onSelectClient }: { onSelectClient: (id: string) => void }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '', email: '', goal: Goal.PERFORMANCE, level: UserLevel.INTERMEDIATE, daysPerWeek: 4
  });

  useEffect(() => { setUsers(DataEngine.getUsers().filter(u => u.role === 'client')); }, []);

  const handleCreateUser = async () => {
    if (!newUser.name) return;
    const userToSave: User = {
      id: generateUUID(), name: newUser.name, email: newUser.email || 'no-email',
      goal: newUser.goal as Goal, level: newUser.level as UserLevel, role: 'client',
      daysPerWeek: newUser.daysPerWeek || 4, equipment: [], streak: 0, createdAt: new Date().toISOString()
    };
    await DataEngine.saveUser(userToSave);
    setUsers(DataEngine.getUsers().filter(u => u.role === 'client'));
    setShowAddModal(false);
  };

  return (
    <div className="animate-fade-in pb-20">
      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold">Atletas</h2>
           <p className="text-xs text-gray-500">Selecciona para ver detalles</p>
        </div>
        <button onClick={() => setShowAddModal(true)} className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-red-500 active:scale-95 transition-all">
          <UserPlus size={16} /> <span>NUEVO</span>
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {users.map(client => (
          <div 
            key={client.id} 
            onClick={() => onSelectClient(client.id)}
            className="bg-[#0F0F11] border border-white/5 rounded-2xl p-4 flex items-center gap-4 hover:border-red-500/30 hover:bg-white/5 transition-all cursor-pointer active:scale-[0.98] group relative overflow-hidden"
          >
            <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center font-bold text-sm border border-white/10 group-hover:border-red-500/50 transition-colors z-10 relative">
              {client.name.charAt(0)}
            </div>
            <div className="flex-1 z-10 relative">
              <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors">{client.name}</h3>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">{client.goal}</p>
            </div>
            <ChevronRight className="text-gray-600 group-hover:text-white transition-colors" size={20} />
            <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-sm rounded-2xl p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">Nuevo Atleta</h3>
            <div className="space-y-3">
              <input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none" placeholder="Nombre" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
              <input className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none" placeholder="Email (Opcional)" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              <div className="flex gap-2">
                 <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-xs font-bold text-gray-400">CANCELAR</button>
                 <button onClick={handleCreateUser} className="flex-1 py-3 rounded-xl bg-red-600 text-xs font-bold">GUARDAR</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ClientDetailView = ({ clientId, onBack }: { clientId: string, onBack: () => void }) => {
  const user = useMemo(() => DataEngine.getUserById(clientId), [clientId]);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showVideo, setShowVideo] = useState<string | null>(null);

  const refreshPlan = useCallback(() => setPlan(DataEngine.getPlan(clientId)), [clientId]);

  useEffect(() => { refreshPlan(); }, [refreshPlan]);

  const handleGenerateAI = async () => {
    if (!user) return;
    setIsGenerating(true);
    try {
      const newPlan = await generateSmartRoutine(user);
      const fullPlan: Plan = {
        ...newPlan,
        id: generateUUID(),
        userId: user.id,
        updatedAt: new Date().toISOString()
      };
      await DataEngine.savePlan(fullPlan);
      refreshPlan();
    } catch (e) {
      alert("Error generando rutina. Intenta de nuevo.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!user) return <div>Usuario no encontrado</div>;

  return (
    <div className="animate-fade-in pb-20">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm font-medium">
        <ChevronLeft size={16} /> Volver
      </button>

      <div className="bg-[#0F0F11] border border-white/5 rounded-3xl p-6 mb-6 relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center text-2xl font-bold font-display italic shadow-lg shadow-red-900/50">
              {user.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{user.name}</h1>
              <div className="flex gap-2 mt-1">
                <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] uppercase font-bold text-gray-300">{user.goal}</span>
                <span className="px-2 py-0.5 bg-white/10 rounded text-[10px] uppercase font-bold text-gray-300">{user.level}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleGenerateAI}
            disabled={isGenerating}
            className="bg-white text-black px-5 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-200 transition-all disabled:opacity-50"
          >
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {isGenerating ? 'DISEÑANDO...' : 'NUEVO PROTOCOLO IA'}
          </button>
        </div>
      </div>

      {!plan ? (
        <div className="text-center py-20 bg-[#0F0F11] rounded-3xl border border-white/5 border-dashed">
          <BrainCircuit className="mx-auto text-gray-600 mb-4" size={48} />
          <p className="text-gray-500 font-medium">Sin protocolo activo</p>
          <p className="text-xs text-gray-600 mt-1">Usa el botón de IA para generar uno.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarDays size={18} className="text-red-500" />
            {plan.title}
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            {plan.workouts.map((workout) => (
              <div key={workout.id} className="bg-[#0F0F11] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-colors">
                <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-3">
                  <h3 className="font-bold text-red-400 text-sm">DÍA {workout.day}: {workout.name.toUpperCase()}</h3>
                  <Dumbbell size={16} className="text-gray-600" />
                </div>
                <div className="space-y-3">
                  {workout.exercises.map((ex, idx) => (
                    <div key={idx} onClick={() => setShowVideo(ex.name)} className="flex justify-between items-center text-sm group cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-600 font-mono text-xs w-4">{idx + 1}</span>
                        <div>
                          <p className="font-medium group-hover:text-red-400 transition-colors">{ex.name}</p>
                          <p className="text-[10px] text-gray-500">{ex.targetSets} x {ex.targetReps}</p>
                        </div>
                      </div>
                      {ex.coachCue && <div className="hidden md:block text-[10px] text-gray-500 italic max-w-[150px] text-right">"{ex.coachCue}"</div>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIDEO MODAL SIMULADO */}
      {showVideo && (
         <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-6" onClick={() => setShowVideo(null)}>
            <div className="bg-[#111] w-full max-w-lg rounded-2xl overflow-hidden border border-white/10" onClick={e => e.stopPropagation()}>
               <div className="p-4 border-b border-white/10 flex justify-between items-center">
                  <h3 className="font-bold">{showVideo}</h3>
                  <button onClick={() => setShowVideo(null)}><X size={20} /></button>
               </div>
               <div className="aspect-video bg-black flex items-center justify-center">
                  <a 
                    href={INITIAL_EXERCISES.find(e => e.name === showVideo)?.videoUrl || `https://www.youtube.com/results?search_query=${showVideo}+exercise`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex flex-col items-center gap-2 text-red-500 hover:text-red-400"
                  >
                    <Play size={48} />
                    <span className="text-sm font-bold underline">VER EN YOUTUBE</span>
                  </a>
               </div>
               <div className="p-4 bg-[#0F0F11]">
                 <p className="text-xs text-gray-400">Toca el enlace para ver la técnica correcta del ejercicio.</p>
               </div>
            </div>
         </div>
      )}
    </div>
  );
};

const WorkoutsView = () => (
  <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4 animate-fade-in">
    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
      <Dumbbell className="text-gray-500" size={32} />
    </div>
    <h3 className="text-xl font-bold">Librería Global</h3>
    <p className="text-gray-400 max-w-xs text-sm">
      Aquí podrás ver y editar la base de datos de ejercicios de Kinetix. (Próximamente)
    </p>
  </div>
);

// SUB-COMPONENTS
const NavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${active ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
    {icon} <span className="font-medium">{label}</span>
  </button>
);
const MobileNavButton = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 transition-all ${active ? 'text-red-500' : 'text-gray-500'}`}>
    {icon} <span className="text-[10px] font-bold">{label}</span>
  </button>
);
const StatCard = ({ label, value, icon }: any) => (
  <div className="bg-[#0F0F11] border border-white/5 p-4 rounded-xl flex flex-col gap-2 hover:border-white/10 transition-colors">
    <div className="flex justify-between items-start"><span className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">{label}</span>{icon}</div>
    <span className="text-2xl font-display font-bold">{value}</span>
  </div>
);
