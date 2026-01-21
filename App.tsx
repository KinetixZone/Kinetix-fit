import React, { useState, useEffect, useMemo, useCallback, memo, useRef } from 'react';
import { 
  LayoutDashboard, Play, X, Users, Save, Trash2, ArrowRight, CheckCircle2, 
  Plus, LogOut, UserPlus, Edit3, ChevronLeft, RefreshCw, Sparkles, Activity,
  Settings, Dumbbell, History, Zap, Check, ShieldAlert, BarChart3, Search, ChevronRight,
  Lock, User as UserIcon, BookOpen, ExternalLink, Video, Image as ImageIcon,
  Timer, Download, Upload, Filter, Clock, Database, FileJson, Cloud, CloudOff,
  Wifi, WifiOff, AlertTriangle, Smartphone, Signal, Globe, Loader2
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
    } catch (e) { console.error("Storage Limit Reached", e); }
  },
  
  // INICIALIZACIÓN
  init: () => {
    const store = DataEngine.getStore();
    if (!store.USERS) {
      DataEngine.saveStore({
        USERS: JSON.stringify([MOCK_USER]), // Fallback inicial
        EXERCISES: JSON.stringify(INITIAL_EXERCISES),
        LOGO_URL: 'https://raw.githubusercontent.com/StackBlitz/stackblitz-images/main/kinetix-wolf-logo.png'
      });
    }
  },
  
  getUsers: (): User[] => {
    const s = DataEngine.getStore();
    return s.USERS ? JSON.parse(s.USERS) : [];
  },
  getExercises: (): Exercise[] => {
    const s = DataEngine.getStore();
    return s.EXERCISES ? JSON.parse(s.EXERCISES) : [];
  },
  getPlan: (uid: string): Plan | null => {
    const s = DataEngine.getStore();
    const p = s[`PLAN_${uid}`];
    return p ? JSON.parse(p) : null;
  },

  // --- SINCRONIZACIÓN CLOUD (CRÍTICO PARA MULTI-DISPOSITIVO) ---
  pullFromCloud: async () => {
    // Si no hay conexión configurada, retorna false y usa modo local
    if (!supabaseConnectionStatus.isConfigured) {
      console.warn("⚠️ MODO OFFLINE: Supabase no configurado. Los datos no se sincronizarán entre dispositivos.");
      return false;
    }
    
    try {
      console.log("🔄 INICIANDO SINCRONIZACIÓN CON NUBE...");
      const s = DataEngine.getStore();
      
      // 1. USUARIOS (La fuente de la verdad es la nube)
      const { data: users, error: uErr } = await supabase.from('users').select('*');
      if (users && !uErr) {
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
        // Actualizamos local storage con lo que viene de la nube
        s.USERS = JSON.stringify(mappedUsers);
      }

      // 2. PLANES
      const { data: plans, error: pErr } = await supabase.from('plans').select(`
        *, 
        workouts (
          *, 
          workout_exercises (
            *,
            exercise:exercises(name) 
          )
        )
      `);
      
      if (plans && !pErr) {
        plans.forEach((p: any) => {
          const fullPlan: Plan = {
            id: p.id,
            title: p.title,
            userId: p.user_id,
            updatedAt: p.updated_at,
            workouts: p.workouts.map((w: any) => ({
              id: w.id,
              name: w.name,
              day: w.day_number,
              exercises: w.workout_exercises.map((we: any) => ({
                exerciseId: we.exercise_id,
                name: we.exercise?.name || 'Ejercicio',
                targetSets: we.target_sets,
                targetReps: we.target_reps,
                coachCue: we.coach_cue
              }))
            })).sort((a:any, b:any) => a.day - b.day)
          };
          s[`PLAN_${p.user_id}`] = JSON.stringify(fullPlan);
        });
      }

      DataEngine.saveStore(s);
      console.log("✅ SINCRONIZACIÓN COMPLETADA");
      return true;
    } catch (e) {
      console.error("❌ Sync Failed", e);
      return false;
    }
  },

  saveUser: async (user: User) => {
    // 1. Guardar Localmente (Inmediato)
    const s = DataEngine.getStore();
    const users = JSON.parse(s.USERS || '[]');
    const idx = users.findIndex((u: User) => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    s.USERS = JSON.stringify(users);
    DataEngine.saveStore(s);

    // 2. Sincronizar con Nube (Segundo plano)
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
      } catch(e) { console.error("Cloud Save Error", e); }
    }
  }
};

// --- COMPONENTS ---

// 1. STATUS BADGE
const ConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(supabaseConnectionStatus.isConfigured);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useEffect(() => {
    if(isOnline) setLastSync(new Date().toLocaleTimeString());
  }, [isOnline]);

  return (
    <div className={`fixed bottom-4 right-4 z-50 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 backdrop-blur-md border ${isOnline ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
      {isOnline ? <Cloud size={12} /> : <CloudOff size={12} />}
      <span>{isOnline ? 'SYNC ONLINE' : 'MODO LOCAL'}</span>
    </div>
  );
};

// 2. LOGIN PAGE (OPTIMIZADA PARA MÓVIL)
const LoginPage = ({ onLogin }: { onLogin: (role: 'coach' | 'client') => void }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(false);

    // Pequeño delay artificial para UX
    await new Promise(r => setTimeout(r, 600));

    const cleanPin = pin.trim();

    if (cleanPin === '2025' || cleanPin === 'KINETIX2025') {
      // Intentar sincronizar al entrar para tener datos frescos
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
      {/* Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-red-600/10 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-[100px]" />

      <div className="w-full max-w-sm z-10 animate-fade-in-up">
        <div className="mb-12 text-center">
          <h1 className="font-display text-5xl italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 neon-red mb-2">
            KINETIX
          </h1>
          <p className="text-gray-500 tracking-[0.2em] text-xs font-bold">HIGH PERFORMANCE ZONE</p>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 flex items-center justify-center shadow-lg shadow-red-900/50">
              <Lock className="text-white" size={32} />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold ml-1">
                Security PIN
              </label>
              <input
                type="tel" 
                inputMode="numeric" 
                pattern="[0-9]*" 
                value={pin}
                onChange={(e) => {
                  setError(false);
                  setPin(e.target.value);
                }}
                placeholder="• • • •"
                className={`w-full bg-black/40 border-2 ${error ? 'border-red-500 text-red-500' : 'border-white/10 focus:border-red-500 text-white'} rounded-xl px-4 py-4 text-center text-3xl tracking-[1em] font-display font-bold outline-none transition-all placeholder-gray-700`}
                maxLength={4}
                autoFocus
                autoComplete="off"
              />
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 text-red-500 text-sm font-medium animate-pulse">
                <ShieldAlert size={16} />
                <span>Acceso Denegado</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-4 rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-lg shadow-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>VERIFICANDO...</span>
                </>
              ) : (
                <>
                  <span>ACCEDER STAFF</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-xs text-gray-500">
              ¿Eres atleta? <span className="text-white underline cursor-pointer hover:text-red-400 transition-colors">Ingresa aquí</span>
            </p>
          </div>
        </div>
        
        {!supabaseConnectionStatus.isConfigured && (
           <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
             <AlertTriangle className="text-yellow-500 shrink-0 mt-0.5" size={18} />
             <div className="text-xs text-yellow-200/80">
               <strong className="text-yellow-500 block mb-1">Modo Desarrollo (Offline)</strong>
               La base de datos no está conectada. Los datos que guardes aquí NO se verán en otros dispositivos. Configura Supabase en Vercel.
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP COMPONENT ---

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'clients' | 'workouts' | 'profile'>('dashboard');
  
  // Inicialización Única
  useEffect(() => {
    DataEngine.init();
    
    // Check session
    const session = localStorage.getItem(SESSION_KEY);
    if (session) {
      const user = JSON.parse(session);
      setCurrentUser(user);
    }
  }, []);

  const handleLogin = useCallback((role: 'coach' | 'client') => {
    if (role === 'coach') {
      const coachUser: User = {
        id: COACH_UUID,
        name: 'COACH KINETIX',
        email: 'staff@kinetix.com',
        role: 'coach',
        goal: Goal.PERFORMANCE,
        level: UserLevel.ADVANCED,
        daysPerWeek: 6,
        equipment: [],
        streak: 999,
        createdAt: new Date().toISOString()
      };
      setCurrentUser(coachUser);
      localStorage.setItem(SESSION_KEY, JSON.stringify(coachUser));
      
      // Force sync on login
      DataEngine.pullFromCloud().then(() => {
        // Force re-render of components relying on store
        window.dispatchEvent(new Event('storage'));
      });
    }
  }, []);

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
    setActiveTab('dashboard');
  }, []);

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white pb-20 md:pb-0 font-sans">
      <ConnectionStatus />
      
      {/* MOBILE HEADER */}
      <header className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-[#050507]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-display italic font-bold">K</div>
           <span className="font-display font-bold italic tracking-tighter">KINETIX</span>
        </div>
        <div className="flex items-center gap-3">
          {currentUser.role === 'coach' && (
            <button 
              onClick={() => DataEngine.pullFromCloud().then(() => alert("Sincronización completada"))}
              className="p-2 bg-white/5 rounded-full hover:bg-white/10 active:scale-95"
            >
              <RefreshCw size={18} className="text-gray-400" />
            </button>
          )}
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-600 flex items-center justify-center border border-white/20">
            <span className="text-xs font-bold">{currentUser.name.charAt(0)}</span>
          </div>
        </div>
      </header>

      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-white/5 bg-[#050507]">
        <div className="p-8">
          <h1 className="font-display text-3xl italic font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-white">KINETIX</h1>
          <p className="text-xs text-gray-500 tracking-[0.3em] font-bold mt-1">ELITE ZONE</p>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          <NavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          {currentUser.role === 'coach' && (
            <NavButton active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} icon={<Users size={20} />} label="Atletas" />
          )}
          <NavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={<Dumbbell size={20} />} label="Entrenamientos" />
        </nav>

        <div className="p-4 border-t border-white/5">
          <button onClick={handleLogout} className="flex items-center gap-3 text-gray-400 hover:text-white transition-colors w-full p-3 rounded-xl hover:bg-white/5">
            <LogOut size={20} />
            <span className="font-medium">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="md:ml-64 p-4 md:p-8 max-w-7xl mx-auto">
        {activeTab === 'dashboard' && <DashboardView user={currentUser} />}
        {activeTab === 'clients' && currentUser.role === 'coach' && <ClientsView />}
        {activeTab === 'workouts' && <WorkoutsView user={currentUser} />}
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#050507]/90 backdrop-blur-xl border-t border-white/10 flex justify-around p-4 z-50 pb-safe">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={24} />} />
        {currentUser.role === 'coach' && (
           <MobileNavButton active={activeTab === 'clients'} onClick={() => setActiveTab('clients')} icon={<Users size={24} />} />
        )}
        <MobileNavButton active={activeTab === 'workouts'} onClick={() => setActiveTab('workouts')} icon={<Dumbbell size={24} />} />
        <MobileNavButton active={false} onClick={handleLogout} icon={<LogOut size={24} className="text-red-500" />} />
      </nav>
    </div>
  );
}

// --- SUB-COMPONENTS ---

const NavButton = ({ active, onClick, icon, label }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
      active ? 'bg-red-600 text-white shadow-lg shadow-red-900/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
    }`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

const MobileNavButton = ({ active, onClick, icon }: any) => (
  <button 
    onClick={onClick}
    className={`p-2 rounded-xl transition-all ${active ? 'text-red-500 bg-red-500/10' : 'text-gray-500'}`}
  >
    {icon}
  </button>
);

// --- DASHBOARD VIEW ---
const DashboardView = ({ user }: { user: User }) => {
  return (
    <div className="space-y-8 animate-fade-in">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold mb-1">Bienvenido, {user.name.split(' ')[0]}</h2>
          <p className="text-gray-400 text-sm">Panel de Control {user.role === 'coach' ? 'Staff' : 'Atleta'}</p>
        </div>
        {user.role === 'coach' && (
          <button 
             onClick={() => DataEngine.pullFromCloud()} 
             className="bg-white/5 border border-white/10 hover:bg-white/10 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>
        )}
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Usuarios Activos" value="24" icon={<Users className="text-blue-500" />} />
        <StatCard label="Planes Generados" value="156" icon={<Sparkles className="text-purple-500" />} />
        <StatCard label="Entrenos Hoy" value="12" icon={<Activity className="text-green-500" />} />
        <StatCard label="Efectividad" value="94%" icon={<Zap className="text-yellow-500" />} />
      </div>

      {user.role === 'coach' ? (
        <div className="bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden">
          <div className="relative z-10">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Sparkles className="text-yellow-500" size={20} />
              AI Coach Center
            </h3>
            <p className="text-gray-400 mb-6 max-w-lg text-sm md:text-base">
              Genera protocolos de entrenamiento personalizados utilizando la IA de Google Gemini 3 Flash. 
              Optimizado para hipertrofia y rendimiento.
            </p>
            <button className="bg-white text-black px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-gray-200 transition-colors">
              <Plus size={20} />
              Nuevo Protocolo IA
            </button>
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-gradient-to-br from-red-600/20 to-transparent blur-3xl rounded-full pointer-events-none" />
        </div>
      ) : (
        <div className="bg-red-600 rounded-2xl p-6 relative overflow-hidden">
          <div className="relative z-10 text-white">
            <h3 className="text-xl font-bold mb-2">Tu Próximo Entreno</h3>
            <p className="text-white/80 mb-6">Día 4: Pierna & Potencia</p>
            <button className="bg-black/30 backdrop-blur-md px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black/40 transition-colors">
              <Play size={20} fill="white" />
              Iniciar Sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ label, value, icon }: any) => (
  <div className="bg-[#0A0A0C] border border-white/5 p-4 rounded-xl flex flex-col gap-2 hover:border-white/10 transition-colors">
    <div className="flex justify-between items-start">
      <span className="text-gray-400 text-xs uppercase font-bold">{label}</span>
      {icon}
    </div>
    <span className="text-2xl font-display font-bold">{value}</span>
  </div>
);

// --- CLIENTS VIEW (COACH ONLY) ---
const ClientsView = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState<Partial<User>>({
    name: '', email: '', goal: Goal.PERFORMANCE, level: UserLevel.INTERMEDIATE, daysPerWeek: 4
  });

  useEffect(() => {
    // Carga inicial
    setUsers(DataEngine.getUsers());
  }, []);

  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email) return;
    
    const userToSave: User = {
      id: generateUUID(),
      name: newUser.name,
      email: newUser.email,
      goal: newUser.goal as Goal,
      level: newUser.level as UserLevel,
      role: 'client',
      daysPerWeek: newUser.daysPerWeek || 4,
      equipment: [],
      streak: 0,
      createdAt: new Date().toISOString()
    };

    await DataEngine.saveUser(userToSave);
    setUsers(DataEngine.getUsers());
    setShowAddModal(false);
    setNewUser({ name: '', email: '', goal: Goal.PERFORMANCE, level: UserLevel.INTERMEDIATE });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Atletas Kinetix</h2>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
        >
          <UserPlus size={18} />
          <span className="hidden md:inline">Nuevo Atleta</span>
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {users.filter(u => u.role === 'client').map(client => (
          <div key={client.id} className="bg-[#0A0A0C] border border-white/5 rounded-2xl p-5 hover:border-red-500/30 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-sm font-bold border border-white/10 group-hover:border-red-500/50 transition-colors">
                  {client.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-sm">{client.name}</h3>
                  <p className="text-xs text-gray-500">{client.email}</p>
                </div>
              </div>
              <div className="px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider bg-white/5 text-gray-400">
                {client.level}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
              <div className="flex items-center gap-1">
                <Zap size={12} className="text-yellow-500" />
                <span>{client.goal}</span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarIcon days={client.daysPerWeek} />
                <span>{client.daysPerWeek}d/sem</span>
              </div>
            </div>

            <button className="w-full py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold border border-white/5 transition-colors">
              Ver Programación
            </button>
          </div>
        ))}
      </div>

      {/* MODAL SIMPLIFICADO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#111] border border-white/10 w-full max-w-md rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-4">Nuevo Atleta</h3>
            <div className="space-y-4">
              <input 
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none" 
                placeholder="Nombre Completo"
                value={newUser.name}
                onChange={e => setNewUser({...newUser, name: e.target.value})}
              />
              <input 
                className="w-full bg-black border border-white/10 rounded-lg p-3 text-sm focus:border-red-500 outline-none" 
                placeholder="Email"
                type="email"
                value={newUser.email}
                onChange={e => setNewUser({...newUser, email: e.target.value})}
              />
              <div className="grid grid-cols-2 gap-2">
                 <select 
                   className="bg-black border border-white/10 rounded-lg p-3 text-sm"
                   value={newUser.goal}
                   onChange={e => setNewUser({...newUser, goal: e.target.value as Goal})}
                 >
                   {Object.values(Goal).map(g => <option key={g} value={g}>{g}</option>)}
                 </select>
                 <select 
                   className="bg-black border border-white/10 rounded-lg p-3 text-sm"
                   value={newUser.level}
                   onChange={e => setNewUser({...newUser, level: e.target.value as UserLevel})}
                 >
                   {Object.values(UserLevel).map(l => <option key={l} value={l}>{l}</option>)}
                 </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowAddModal(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-sm font-bold">Cancelar</button>
              <button onClick={handleCreateUser} className="flex-1 py-3 rounded-xl bg-red-600 text-white text-sm font-bold">Crear Atleta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- WORKOUTS VIEW (PLACEHOLDER) ---
const WorkoutsView = ({ user }: { user: User }) => (
  <div className="flex flex-col items-center justify-center h-[50vh] text-center space-y-4">
    <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
      <Dumbbell className="text-gray-500" size={32} />
    </div>
    <h3 className="text-xl font-bold">Librería de Entrenamientos</h3>
    <p className="text-gray-400 max-w-xs">
      Selecciona un atleta para ver o generar sus rutinas personalizadas.
    </p>
  </div>
);

const CalendarIcon = ({ days }: { days: number }) => (
  <div className="flex gap-[1px]">
    {[...Array(7)].map((_, i) => (
      <div key={i} className={`w-0.5 h-2 rounded-full ${i < days ? 'bg-red-500' : 'bg-gray-700'}`} />
    ))}
  </div>
);
