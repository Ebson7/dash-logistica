/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, Component, ReactNode } from 'react';
import { 
  onAuthStateChanged, 
  signInAnonymously,
  signOut, 
  User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, query, collection, orderBy, where, limit, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, DepartmentId } from './types';
import { DEPARTMENTS, VEHICLE_TYPES } from './constants';
import { 
  LayoutDashboard, 
  Package, 
  Download, 
  ClipboardList, 
  Truck, 
  LogOut,
  User as UserIcon,
  Loader2,
  Settings as SettingsIcon,
  Search,
  Filter,
  AlertCircle,
  Plus,
  Users,
  Calendar,
  ChevronRight,
  History,
  Lock,
  Monitor,
  Maximize,
  Newspaper,
  ArrowRight,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Error Handling ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let message = "Ocorreu um erro inesperado.";
      try {
        const errData = JSON.parse(this.state.error?.message || '{}');
        if (errData.error?.includes('permission-denied')) {
          message = "Erro de permissão: Você não tem autorização para acessar estes dados.";
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center">
            <AlertCircle className="text-red-500 w-12 h-12 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-neutral-900 mb-2">Ops! Algo deu errado</h2>
            <p className="text-neutral-500 mb-6">{message}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-neutral-900 text-white px-6 py-2 rounded-xl font-bold hover:bg-neutral-800 transition-all"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- Auth Context ---
interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  login: (departmentId: DepartmentId | 'admin', password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // In this password-based system, we'll use localStorage to store the selected department
        const savedDept = localStorage.getItem('selected_dept') as DepartmentId | 'admin';
        if (savedDept) {
          setProfile({
            uid: firebaseUser.uid,
            email: 'shared@logistica.com',
            departmentId: savedDept,
            displayName: savedDept === 'admin' ? 'Administrador' : (DEPARTMENTS[savedDept as DepartmentId]?.name || 'Colaborador'),
          });
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
  }, []);

  const login = async (departmentId: DepartmentId | 'admin', password: string) => {
    // We must sign in anonymously FIRST to have permission to read the settings/auth document
    await signInAnonymously(auth);
    
    try {
      // Get passwords from Firestore
      const authDoc = await getDoc(doc(db, 'settings', 'auth'));
      const passwords = authDoc.exists() ? authDoc.data() : { admin: 'admin123', user: 'user123' };
      
      // Initialize if not exists
      if (!authDoc.exists()) {
        await setDoc(doc(db, 'settings', 'auth'), passwords);
      }

      const correctPassword = departmentId === 'admin' ? passwords.admin : passwords.user;

      if (password === correctPassword) {
        localStorage.setItem('selected_dept', departmentId);
        setProfile({
          uid: auth.currentUser?.uid || 'anonymous',
          email: 'shared@logistica.com',
          departmentId: departmentId,
          displayName: departmentId === 'admin' ? 'Administrador' : (DEPARTMENTS[departmentId as DepartmentId]?.name || 'Colaborador'),
        });
      } else {
        await signOut(auth);
        throw new Error('Senha incorreta');
      }
    } catch (error) {
      await signOut(auth);
      throw error;
    }
  };

  const logout = async () => {
    localStorage.removeItem('selected_dept');
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// --- Components ---

function LoginPage() {
  const { login } = useAuth();
  const [dept, setDept] = useState<DepartmentId | 'admin'>('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(dept, password);
    } catch (err: any) {
      setError(err.message || 'Erro ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 rounded-3xl shadow-xl shadow-neutral-200 w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Truck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Marsil Log News</h1>
          <p className="text-neutral-500">Gestão Logística Inteligente</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Acessar como</label>
            <select 
              value={dept}
              onChange={(e: any) => setDept(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="admin">Administrador</option>
              {Object.values(DEPARTMENTS).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase mb-2">Senha</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium text-center">{error}</p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full bg-neutral-900 text-white py-4 rounded-2xl font-semibold hover:bg-neutral-800 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" /> : 'Entrar no Sistema'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) {
  const { profile, logout } = useAuth();
  
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'recebimento', name: 'Recebimento', icon: Download },
    { id: 'estoque', name: 'Estoque', icon: Package },
    { id: 'romaneio_tarde', name: 'Romaneio Tarde', icon: ClipboardList },
    { id: 'romaneio_noturno', name: 'Romaneio Noturno', icon: ClipboardList },
    { id: 'exp_loja', name: 'Exp. Loja', icon: ClipboardList },
    { id: 'veiculos', name: 'Veículos', icon: Truck },
  ];

  if (profile?.departmentId === 'admin') {
    menuItems.push({ id: 'settings', name: 'Configurações', icon: SettingsIcon });
  }

  const filteredMenu = profile?.departmentId === 'admin' 
    ? menuItems 
    : menuItems.filter(item => item.id === 'dashboard' || item.id === profile?.departmentId);

  return (
    <aside className="w-72 bg-white border-r border-neutral-100 flex flex-col h-screen sticky top-0">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <Truck className="text-white w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">Marsil Log News</span>
        </div>

        <nav className="space-y-2">
          {filteredMenu.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-blue-50 text-blue-600 font-semibold' 
                  : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <item.icon size={20} />
              {item.name}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-auto p-8 border-t border-neutral-50">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-neutral-100 rounded-full flex items-center justify-center">
            <UserIcon size={20} className="text-neutral-500" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-semibold truncate">{profile?.displayName}</p>
            <p className="text-xs text-neutral-400 capitalize">{profile?.departmentId}</p>
          </div>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-medium"
        >
          <LogOut size={20} />
          Sair
        </button>
      </div>
    </aside>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AuthContent activeTab={activeTab} setActiveTab={setActiveTab} />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AuthContent({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user || !profile) return <LoginPage />;

  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 p-10 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <DashboardView />}
            {activeTab === 'recebimento' && <RecebimentoView />}
            {activeTab === 'estoque' && <EstoqueView />}
            {activeTab === 'romaneio_tarde' && <RomaneioTardeView />}
            {activeTab === 'romaneio_noturno' && <RomaneioNoturnoView />}
            {activeTab === 'exp_loja' && <ExpLojaView />}
            {activeTab === 'veiculos' && <VeiculosView />}
            {activeTab === 'settings' && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// --- Shared Components ---

function StatCard({ title, value, icon: Icon, colorClass = "bg-blue-50 text-blue-600" }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-neutral-100 flex items-center gap-5">
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${colorClass}`}>
        <Icon size={28} />
      </div>
      <div>
        <p className="text-neutral-500 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-neutral-900">{value}</p>
      </div>
    </div>
  );
}

function OccurrenceList({ occurrences }: { occurrences: any[] }) {
  return (
    <div className="space-y-4">
      {occurrences.length === 0 ? (
        <p className="text-neutral-400 text-sm italic">Nenhuma ocorrência registrada.</p>
      ) : (
        occurrences.map((occ, idx) => (
          <div key={idx} className="group p-4 bg-white rounded-2xl border border-neutral-100 hover:border-blue-200 transition-all shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                occ.severity === 'high' ? 'bg-red-100 text-red-600' : 
                occ.severity === 'medium' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'
              }`}>
                {occ.severity === 'high' ? 'Crítica' : occ.severity === 'medium' ? 'Média' : 'Baixa'}
              </span>
              <span className="text-[10px] text-neutral-400 flex items-center gap-1">
                <Clock size={10} />
                {new Date(occ.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <h4 className="font-bold text-neutral-900 text-sm mb-1 leading-tight group-hover:text-blue-600 transition-colors">
              {occ.title || 'Sem Título'}
            </h4>
            <p className="text-xs text-neutral-500 line-clamp-2 leading-relaxed">{occ.description}</p>
            {occ.deptName && (
              <div className="mt-3 pt-3 border-t border-neutral-50 flex items-center justify-between">
                <span className="text-[10px] font-medium text-neutral-400">{occ.deptName}</span>
                <ArrowRight size={12} className="text-neutral-300 group-hover:text-blue-400 transition-colors" />
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// --- News Ticker ---

function NewsTicker({ occurrences }: { occurrences: any[] }) {
  if (occurrences.length === 0) return null;

  const tickerText = occurrences
    .map(occ => `[${occ.deptName}] ${occ.description} (${occ.severity.toUpperCase()})`)
    .join(' • ');

  return (
    <div className="bg-neutral-900 text-white py-2 overflow-hidden whitespace-nowrap sticky top-0 z-50 -mx-10 -mt-10 mb-10">
      <motion.div
        animate={{ x: [0, -1000] }}
        transition={{ 
          duration: 30, 
          repeat: Infinity, 
          ease: "linear" 
        }}
        className="inline-block pl-[100%]"
      >
        <span className="text-sm font-mono tracking-wider uppercase">
          {tickerText} • {tickerText}
        </span>
      </motion.div>
    </div>
  );
}

// --- Dashboard View ---

function DashboardView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [isTVMode, setIsTVMode] = useState(false);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const q = query(collection(db, 'logs'), where('date', '==', today));
    const unsubLogs = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => doc.data()));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setSettings(doc.data());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    return () => {
      unsubLogs();
      unsubSettings();
    };
  }, [today]);

  const totalStaffPresent = logs.reduce((sum, log) => sum + (log.staffPresent || 0), 0);
  const totalOccurrences = logs.reduce((sum, log) => sum + (log.occurrences?.length || 0), 0);
  
  const estoqueLog = logs.find(l => l.departmentId === 'estoque');
  const estoqueCapacity = settings?.departments?.estoque?.inventoryCapacity || 0;
  const estoqueOccupied = estoqueLog?.data?.occupiedPositions || 0;
  const estoqueOccupancyPercent = estoqueCapacity > 0 ? Math.round((estoqueOccupied / estoqueCapacity) * 100) : 0;

  const allOccurrences = logs.flatMap(log => 
    (log.occurrences || []).map((occ: any) => ({
      ...occ,
      deptName: DEPARTMENTS[log.departmentId as DepartmentId]?.name || log.departmentId
    }))
  ).sort((a, b) => b.timestamp - a.timestamp);

  const chartData = Object.values(DEPARTMENTS).map(dept => {
    const log = logs.find(l => l.departmentId === dept.id);
    const totalStaff = settings?.departments?.[dept.id]?.totalStaff || dept.totalStaff;
    const presente = log?.staffPresent || 0;
    const percent = totalStaff > 0 ? Math.round((presente / totalStaff) * 100) : 0;
    
    return {
      name: dept.name,
      presente,
      total: totalStaff,
      percent
    };
  });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className={`flex flex-col ${isTVMode ? 'fixed inset-0 z-[100] bg-neutral-50 overflow-auto p-10' : 'space-y-10'}`}>
      <NewsTicker occurrences={allOccurrences} />
      
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-10">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-neutral-900">Dashboard Geral</h2>
              <p className="text-neutral-500 mt-1">Visão em tempo real de todos os departamentos</p>
            </div>
            <button 
              onClick={() => setIsTVMode(!isTVMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all ${
                isTVMode ? 'bg-blue-600 text-white' : 'bg-white text-neutral-600 border border-neutral-200 hover:bg-neutral-50'
              }`}
            >
              {isTVMode ? <Monitor size={20} /> : <Maximize size={20} />}
              {isTVMode ? 'Sair do Modo TV' : 'Modo TV'}
            </button>
          </header>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <StatCard title="Total Colaboradores" value={totalStaffPresent} icon={Users} />
            <StatCard title="Veículos Recebidos" value={logs.find(l => l.departmentId === 'recebimento')?.data?.vehiclesReceived || 0} icon={Truck} colorClass="bg-emerald-50 text-emerald-600" />
            <StatCard title="Pedidos Separados" value={(logs.find(l => l.departmentId === 'romaneio_tarde')?.data?.ordersCount || 0) + (logs.find(l => l.departmentId === 'romaneio_noturno')?.data?.ordersCount || 0) + (logs.find(l => l.departmentId === 'exp_loja')?.data?.ordersCount || 0)} icon={ClipboardList} colorClass="bg-orange-50 text-orange-600" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
              <h3 className="text-lg font-bold mb-6">Comparecimento (%)</h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} unit="%" />
                    <Tooltip 
                      cursor={{fill: '#f9fafb'}}
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                    />
                    <Bar dataKey="percent" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.percent < 70 ? '#ef4444' : entry.percent < 90 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
              <h3 className="text-lg font-bold mb-6">Ocupação Estoque</h3>
              <div className="flex flex-col items-center justify-center h-80">
                <div className="relative w-48 h-48">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth="16"
                      fill="transparent"
                      className="text-neutral-100"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth="16"
                      fill="transparent"
                      strokeDasharray={552.92}
                      strokeDashoffset={552.92 - (552.92 * estoqueOccupancyPercent) / 100}
                      className={`${estoqueOccupancyPercent > 90 ? 'text-red-500' : estoqueOccupancyPercent > 70 ? 'text-orange-500' : 'text-blue-500'} transition-all duration-1000`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold text-neutral-900">{estoqueOccupancyPercent}%</span>
                    <span className="text-xs text-neutral-400 font-bold uppercase">Ocupado</span>
                  </div>
                </div>
                <div className="mt-6 text-center">
                  <p className="text-sm text-neutral-500">
                    <span className="font-bold text-neutral-900">{estoqueOccupied}</span> de <span className="font-bold text-neutral-900">{estoqueCapacity}</span> posições
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="w-full lg:w-80 shrink-0">
          <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden sticky top-8">
            <div className="bg-neutral-900 p-6 text-white">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Newspaper size={20} className="text-blue-400" />
                </div>
                <h3 className="text-lg font-bold">Ocorrências</h3>
              </div>
              <p className="text-neutral-400 text-xs">Últimas notícias da operação</p>
            </div>
            <div className="p-6 bg-neutral-50/50 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar">
              <OccurrenceList occurrences={allOccurrences} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

// --- Generic Department Form ---

function DepartmentView({ departmentId, title, fields }: { departmentId: DepartmentId, title: string, fields: any[] }) {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<any>(null);
  const [staffPresent, setStaffPresent] = useState(0);
  const [staffByRole, setStaffByRole] = useState<Record<string, number>>({});
  const [occurrenceTitle, setOccurrenceTitle] = useState('');
  const [occurrence, setOccurrence] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('low');
  const [extraData, setExtraData] = useState<any>({});
  const [logs, setLogs] = useState<any[]>([]);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setSettings(doc.data());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const q = query(
      collection(db, 'logs'), 
      where('departmentId', '==', departmentId),
      orderBy('date', 'desc'),
      limit(5)
    );
    const unsubLogs = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const todayLog = snapshot.docs.find(d => d.data().date === today);
      if (todayLog) {
        setStaffPresent(todayLog.data().staffPresent);
        setStaffByRole(todayLog.data().staffByRole || {});
        setExtraData(todayLog.data().data || {});
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `logs/${departmentId}`);
    });

    return () => {
      unsubSettings();
      unsubLogs();
    };
  }, [departmentId, today]);

  const roles = settings?.departments?.[departmentId]?.roles || DEPARTMENTS[departmentId].roles;
  const totalStaff = settings?.departments?.[departmentId]?.totalStaff || DEPARTMENTS[departmentId].totalStaff;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const logRef = collection(db, 'logs');
    const existingLog = logs.find(l => l.date === today);

    const logData = {
      date: today,
      departmentId,
      staffPresent,
      staffByRole,
      data: extraData,
      updatedAt: serverTimestamp(),
      updatedBy: profile?.uid
    };

    try {
      if (existingLog) {
        await setDoc(doc(db, 'logs', existingLog.id), logData, { merge: true });
      } else {
        await addDoc(logRef, { ...logData, occurrences: [] });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `logs/${existingLog?.id || 'new'}`);
    }
  };

  const addOccurrence = async () => {
    if (!occurrenceTitle || !occurrence) return;
    const existingLog = logs.find(l => l.date === today);
    const newOcc = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      title: occurrenceTitle,
      description: occurrence,
      severity
    };

    if (existingLog) {
      try {
        const updatedOccurrences = [...(existingLog.occurrences || []), newOcc];
        await setDoc(doc(db, 'logs', existingLog.id), { occurrences: updatedOccurrences }, { merge: true });
        setOccurrenceTitle('');
        setOccurrence('');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `logs/${existingLog.id}/occurrences`);
      }
    } else {
      alert("Por favor, registre a presença primeiro.");
    }
  };

  return (
    <div className="max-w-4xl space-y-8">
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-bold text-neutral-900">{title}</h2>
          <p className="text-neutral-500 mt-1">Gestão diária do departamento</p>
        </div>
        <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2">
          <Calendar size={16} />
          {new Date().toLocaleDateString('pt-BR')}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Users size={20} className="text-blue-600" />
              Dados de Operação
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 mb-2">Total Colaboradores Presentes</label>
                  <input 
                    type="number" 
                    value={staffPresent}
                    onChange={(e) => setStaffPresent(parseInt(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                  <p className="text-xs text-neutral-400 mt-2">Total do departamento: {totalStaff}</p>
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-6">
                <h4 className="text-sm font-bold text-neutral-900 mb-4">Colaboradores por Cargo</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {roles.map((role: string) => (
                    <div key={role}>
                      <label className="block text-xs font-medium text-neutral-500 mb-1">{role}</label>
                      <input 
                        type="number"
                        value={staffByRole[role] || 0}
                        onChange={(e) => setStaffByRole({...staffByRole, [role]: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-neutral-100 pt-6">
                <h4 className="text-sm font-bold text-neutral-900 mb-4">Métricas Específicas</h4>
                <div className="space-y-4">
                  {fields.map(field => (
                    <div key={field.name}>
                      <label className="block text-sm font-semibold text-neutral-700 mb-2">{field.label}</label>
                      {field.type === 'number' ? (
                        <input 
                          type="number" 
                          value={extraData[field.name] || 0}
                          onChange={(e) => setExtraData({...extraData, [field.name]: parseInt(e.target.value)})}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                        />
                      ) : field.type === 'multiselect' ? (
                        <div className="flex flex-wrap gap-2">
                          {field.options.map((opt: string) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                const current = extraData[field.name] || [];
                                const next = current.includes(opt) ? current.filter((i: string) => i !== opt) : [...current, opt];
                                setExtraData({...extraData, [field.name]: next});
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                (extraData[field.name] || []).includes(opt)
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : field.type === 'counter-list' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {field.options.map((opt: string) => (
                            <div key={opt}>
                              <label className="block text-xs font-medium text-neutral-500 mb-1">{opt}</label>
                              <input 
                                type="number"
                                value={(extraData[field.name] || {})[opt] || 0}
                                onChange={(e) => {
                                  const current = extraData[field.name] || {};
                                  const val = parseInt(e.target.value) || 0;
                                  const next = {...current, [opt]: val};
                                  
                                  // Auto-calculate total if it's vehiclesByType
                                  let nextExtraData = {...extraData, [field.name]: next};
                                  if (field.name === 'vehiclesByType') {
                                    const total = Object.values(next).reduce((a: any, b: any) => a + b, 0) as number;
                                    nextExtraData.vehiclesReceived = total;
                                  }
                                  
                                  setExtraData(nextExtraData);
                                }}
                                className="w-full px-3 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100">
                Salvar Dados do Dia
              </button>
            </form>
          </section>

          <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <AlertCircle size={20} className="text-red-600" />
              Registrar Ocorrência
            </h3>
            <div className="space-y-4">
              <input 
                type="text"
                placeholder="Título da ocorrência (ex: Atraso de Veículo)"
                value={occurrenceTitle}
                onChange={(e) => setOccurrenceTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500 outline-none transition-all"
              />
              <textarea 
                placeholder="Descreva os detalhes..."
                value={occurrence}
                onChange={(e) => setOccurrence(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500 outline-none transition-all min-h-[100px]"
              />
              <div className="flex items-center gap-4">
                <select 
                  value={severity}
                  onChange={(e: any) => setSeverity(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 text-sm outline-none"
                >
                  <option value="low">Baixa Gravidade</option>
                  <option value="medium">Média Gravidade</option>
                  <option value="high">Alta Gravidade</option>
                </select>
                <button 
                  onClick={addOccurrence}
                  disabled={!occurrenceTitle || !occurrence}
                  className="flex-1 bg-neutral-900 text-white py-2 rounded-xl font-bold hover:bg-neutral-800 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus size={18} />
                  Adicionar
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <History size={20} className="text-neutral-400" />
              Ocorrências de Hoje
            </h3>
            <OccurrenceList occurrences={logs.find(l => l.date === today)?.occurrences || []} />
          </section>

          <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100">
            <h3 className="text-lg font-bold mb-6">Histórico Recente</h3>
            <div className="space-y-4">
              {logs.filter(l => l.date !== today).map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 hover:bg-neutral-50 rounded-xl transition-all cursor-default">
                  <div>
                    <p className="text-sm font-bold text-neutral-800">{new Date(log.date).toLocaleDateString('pt-BR')}</p>
                    <p className="text-xs text-neutral-400">{log.staffPresent} presentes</p>
                  </div>
                  <ChevronRight size={16} className="text-neutral-300" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function RecebimentoView() {
  return <DepartmentView 
    departmentId="recebimento" 
    title="Recebimento" 
    fields={[
      { name: 'vehiclesReceived', label: 'Total de Veículos Recebidos', type: 'number' },
      { name: 'vehiclesByType', label: 'Quantidade por Tipo de Veículo', type: 'counter-list', options: VEHICLE_TYPES }
    ]} 
  />;
}

function EstoqueView() {
  return <DepartmentView 
    departmentId="estoque" 
    title="Estoque" 
    fields={[
      { name: 'occupiedPositions', label: 'Posições Ocupadas Hoje', type: 'number' }
    ]} 
  />;
}

function RomaneioTardeView() {
  return <DepartmentView 
    departmentId="romaneio_tarde" 
    title="Romaneio Tarde" 
    fields={[
      { name: 'ordersCount', label: 'Total de Pedidos', type: 'number' },
      { name: 'pickersCount', label: 'Separadores Trabalhando', type: 'number' }
    ]} 
  />;
}

function RomaneioNoturnoView() {
  return <DepartmentView 
    departmentId="romaneio_noturno" 
    title="Romaneio Noturno" 
    fields={[
      { name: 'ordersCount', label: 'Total de Pedidos', type: 'number' },
      { name: 'pickersCount', label: 'Separadores Trabalhando', type: 'number' }
    ]} 
  />;
}

function ExpLojaView() {
  return <DepartmentView 
    departmentId="exp_loja" 
    title="Exp. Loja" 
    fields={[
      { name: 'ordersCount', label: 'Total de Pedidos', type: 'number' },
      { name: 'pickersCount', label: 'Separadores Trabalhando', type: 'number' }
    ]} 
  />;
}

function VeiculosView() {
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'global'), (doc) => {
      if (doc.exists()) setSettings(doc.data());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });
  }, []);

  const vehicles = settings?.vehicles || [];

  return <DepartmentView 
    departmentId="veiculos" 
    title="Veículos" 
    fields={[
      { name: 'driversCount', label: 'Motoristas Trabalhando', type: 'number' },
      { 
        name: 'registeredVehicles', 
        label: 'Veículos em Operação Hoje', 
        type: 'multiselect', 
        options: vehicles.map((v: any) => `${v.plate} - ${v.model}`) 
      }
    ]} 
  />;
}

// --- Settings View ---

function SettingsView() {
  const [settings, setSettings] = useState<any>(null);
  const [authSettings, setAuthSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newVehicle, setNewVehicle] = useState({ plate: '', model: '', type: '' });

  useEffect(() => {
    const unsubGlobal = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        const initialSettings = {
          departments: Object.keys(DEPARTMENTS).reduce((acc, key) => ({
            ...acc,
            [key]: {
              roles: DEPARTMENTS[key as DepartmentId].roles,
              totalStaff: DEPARTMENTS[key as DepartmentId].totalStaff
            }
          }), {}),
          vehicles: []
        };
        setDoc(doc(db, 'settings', 'global'), initialSettings);
        setSettings(initialSettings);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const unsubAuth = onSnapshot(doc(db, 'settings', 'auth'), (docSnap) => {
      if (docSnap.exists()) {
        setAuthSettings(docSnap.data());
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/auth');
    });

    setLoading(false);
    return () => {
      unsubGlobal();
      unsubAuth();
    };
  }, []);

  const updatePasswords = async (adminPass: string, userPass: string) => {
    try {
      await setDoc(doc(db, 'settings', 'auth'), { admin: adminPass, user: userPass });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/auth');
    }
  };

  const updateDeptRoles = async (deptId: DepartmentId, rolesStr: string) => {
    const roles = rolesStr.split(',').map(r => r.trim()).filter(r => r);
    const newSettings = {
      ...settings,
      departments: {
        ...settings.departments,
        [deptId]: { ...settings.departments[deptId], roles }
      }
    };
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const updateDeptStaff = async (deptId: DepartmentId, total: number) => {
    const newSettings = {
      ...settings,
      departments: {
        ...settings.departments,
        [deptId]: { ...settings.departments[deptId], totalStaff: total }
      }
    };
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const updateDeptCapacity = async (deptId: DepartmentId, capacity: number) => {
    const newSettings = {
      ...settings,
      departments: {
        ...settings.departments,
        [deptId]: { ...settings.departments[deptId], inventoryCapacity: capacity }
      }
    };
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const addVehicle = async () => {
    if (!newVehicle.plate || !newVehicle.model) return;
    const vehicle = { ...newVehicle, id: Math.random().toString(36).substr(2, 9) };
    const newSettings = {
      ...settings,
      vehicles: [...(settings.vehicles || []), vehicle]
    };
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
      setNewVehicle({ plate: '', model: '', type: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const removeVehicle = async (id: string) => {
    const newSettings = {
      ...settings,
      vehicles: settings.vehicles.filter((v: any) => v.id !== id)
    };
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  if (loading) return <Loader2 className="animate-spin" />;

  return (
    <div className="space-y-10 max-w-5xl">
      <header>
        <h2 className="text-3xl font-bold text-neutral-900">Configurações do Sistema</h2>
        <p className="text-neutral-500 mt-1">Gerencie cargos, equipes e veículos</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Lock size={24} className="text-red-600" />
            Segurança e Senhas
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Senha do Administrador</label>
              <input 
                type="text"
                defaultValue={authSettings?.admin}
                onBlur={(e) => updatePasswords(e.target.value, authSettings?.user)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Senha dos Usuários (Setores)</label>
              <input 
                type="text"
                defaultValue={authSettings?.user}
                onBlur={(e) => updatePasswords(authSettings?.admin, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </section>

        <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Users size={24} className="text-blue-600" />
            Cargos e Equipes
          </h3>
          <div className="space-y-6">
            {Object.values(DEPARTMENTS).map(dept => (
              <div key={dept.id} className="p-4 bg-neutral-50 rounded-2xl space-y-3">
                <p className="font-bold text-neutral-900">{dept.name}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Total Equipe</label>
                    <input 
                      type="number"
                      value={settings.departments[dept.id]?.totalStaff || 0}
                      onChange={(e) => updateDeptStaff(dept.id, parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Cargos (separados por vírgula)</label>
                    <input 
                      type="text"
                      defaultValue={settings.departments[dept.id]?.roles.join(', ')}
                      onBlur={(e) => updateDeptRoles(dept.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {dept.id === 'estoque' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-neutral-400 uppercase mb-1">Capacidade Total (Posições)</label>
                      <input 
                        type="number"
                        value={settings.departments[dept.id]?.inventoryCapacity || 0}
                        onChange={(e) => updateDeptCapacity(dept.id, parseInt(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2">
            <Truck size={24} className="text-emerald-600" />
            Frota de Veículos
          </h3>
          
          <div className="bg-neutral-50 p-4 rounded-2xl space-y-4">
            <p className="text-sm font-bold">Cadastrar Novo Veículo</p>
            <div className="grid grid-cols-2 gap-3">
              <input 
                placeholder="Placa"
                value={newVehicle.plate}
                onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value.toUpperCase()})}
                className="px-3 py-2 rounded-lg border border-neutral-200 outline-none"
              />
              <input 
                placeholder="Modelo"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})}
                className="px-3 py-2 rounded-lg border border-neutral-200 outline-none"
              />
              <select 
                value={newVehicle.type}
                onChange={(e) => setNewVehicle({...newVehicle, type: e.target.value})}
                className="col-span-2 px-3 py-2 rounded-lg border border-neutral-200 outline-none"
              >
                <option value="">Selecione o Tipo</option>
                {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <button 
              onClick={addVehicle}
              className="w-full bg-emerald-600 text-white py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all"
            >
              Adicionar Veículo
            </button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-auto">
            {settings.vehicles?.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-xl">
                <div>
                  <p className="font-bold text-sm">{v.plate}</p>
                  <p className="text-xs text-neutral-500">{v.model} • {v.type}</p>
                </div>
                <button 
                  onClick={() => removeVehicle(v.id)}
                  className="text-red-500 hover:bg-red-50 p-2 rounded-lg"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <OccurrenceHistory />
    </div>
  );
}

function OccurrenceHistory() {
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('date', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setAllLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
    });
    return unsub;
  }, []);

  const filteredOccurrences = allLogs.flatMap(log => 
    (log.occurrences || []).map((occ: any) => ({
      ...occ,
      date: log.date,
      departmentId: log.departmentId,
      deptName: DEPARTMENTS[log.departmentId as DepartmentId]?.name || log.departmentId
    }))
  ).filter(occ => {
    const matchDept = filterDept === 'all' || occ.departmentId === filterDept;
    const matchDate = !filterDate || occ.date === filterDate;
    return matchDept && matchDate;
  }).sort((a, b) => b.timestamp - a.timestamp);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <section className="bg-white p-8 rounded-3xl shadow-sm border border-neutral-100 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <History size={24} className="text-orange-600" />
          Histórico de Ocorrências
        </h3>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
            <Filter size={16} className="text-neutral-400" />
            <select 
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="bg-transparent text-sm outline-none font-medium"
            >
              <option value="all">Todos Departamentos</option>
              {Object.values(DEPARTMENTS).map(dept => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-neutral-50 px-3 py-2 rounded-xl border border-neutral-200">
            <Calendar size={16} className="text-neutral-400" />
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-sm outline-none font-medium"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-auto pr-2">
        {filteredOccurrences.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 rounded-2xl border border-dashed border-neutral-200">
            <p className="text-neutral-400">Nenhuma ocorrência encontrada com os filtros selecionados.</p>
          </div>
        ) : (
          filteredOccurrences.map((occ, idx) => (
            <div key={idx} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                  occ.severity === 'high' ? 'bg-red-500' : 
                  occ.severity === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
                }`} />
                <div>
                  <p className="text-sm font-medium text-neutral-900">{occ.description}</p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <span className="text-xs font-bold text-blue-600 uppercase">{occ.deptName}</span>
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <Calendar size={12} />
                      {new Date(occ.date + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="text-xs text-neutral-400 flex items-center gap-1">
                      <History size={12} />
                      {new Date(occ.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                occ.severity === 'high' ? 'bg-red-100 text-red-700' : 
                occ.severity === 'medium' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {occ.severity === 'high' ? 'Alta' : occ.severity === 'medium' ? 'Média' : 'Baixa'}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

