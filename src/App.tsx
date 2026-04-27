/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, createContext, useContext, Component, ReactNode, useRef } from 'react';
import { 
  onAuthStateChanged, 
  signInAnonymously,
  signOut, 
  User 
} from 'firebase/auth';
import { doc, getDoc, getDocs, setDoc, onSnapshot, query, collection, orderBy, where, limit, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, DepartmentId, ReceivingAppointment } from './types';
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
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Menu,
  History,
  Lock,
  Monitor,
  Maximize,
  Newspaper,
  ArrowRight,
  Clock,
  BellRing,
  X,
  ExternalLink,
  Moon,
  Sun,
  FileDown,
  FileText,
  Settings2,
  MessageSquare
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

// --- Dark Mode Context ---
interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
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
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex items-center justify-center p-4 transition-colors duration-300">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-xl shadow-neutral-200 dark:shadow-none w-full max-w-md border border-transparent dark:border-neutral-800"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200 dark:shadow-none">
            <Truck className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">Marsil Log News</h1>
          <p className="text-neutral-500 dark:text-neutral-400">Gestão Logística Inteligente</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-2">Acessar como</label>
            <select 
              value={dept}
              onChange={(e: any) => setDept(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="admin">Administrador</option>
              {Object.values(DEPARTMENTS).map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-2">Senha</label>
            <input 
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite a senha"
              className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
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

function Sidebar({ activeTab, setActiveTab, isOpen, onClose }: { activeTab: string, setActiveTab: (t: any) => void, isOpen?: boolean, onClose?: () => void }) {
  const { profile, logout } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  
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
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      <aside className={`
        ${isCollapsed ? 'w-20' : 'w-72'} 
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        bg-white dark:bg-neutral-900 border-r border-neutral-100 dark:border-neutral-800 flex flex-col h-screen fixed lg:sticky top-0 transition-all duration-300 ease-in-out z-50
      `}>
        <div className={`p-6 flex flex-col h-full overflow-hidden`}>
          <div className="flex items-center justify-between mb-10">
            {!isCollapsed && (
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                  <Truck className="text-white w-6 h-6" />
                </div>
                <span className="text-xl font-bold tracking-tight truncate dark:text-white">Marsil Log News</span>
              </div>
            )}
            {isCollapsed && (
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mx-auto shrink-0">
                <Truck className="text-white w-6 h-6" />
              </div>
            )}
            <button 
              onClick={() => setIsCollapsed(!isCollapsed)}
              className={`hidden lg:block p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400 transition-colors ${isCollapsed ? 'absolute -right-3 top-20 bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-sm z-50' : ''}`}
              title={isCollapsed ? "Expandir" : "Recolher"}
            >
              {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={20} />}
            </button>
            <button 
              onClick={onClose}
              className="lg:hidden p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-400"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-2 flex-1 overflow-y-auto no-scrollbar">
            {filteredMenu.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (onClose) onClose();
                }}
                title={isCollapsed ? item.name : ''}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 rounded-xl transition-all ${
                  activeTab === item.id 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold' 
                    : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-neutral-100'
                }`}
              >
                <item.icon size={20} className="shrink-0" />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </button>
            ))}
          </nav>

        <div className="mt-auto pt-6 border-t border-neutral-50 dark:border-neutral-800 space-y-4">
          <button
            onClick={toggleDarkMode}
            title={isCollapsed ? (isDarkMode ? 'Modo Claro' : 'Modo Escuro') : ''}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-all font-medium`}
          >
            {isDarkMode ? <Sun size={20} className="shrink-0" /> : <Moon size={20} className="shrink-0" />}
            {!isCollapsed && <span>{isDarkMode ? 'Modo Claro' : 'Modo Escuro'}</span>}
          </button>

          <a 
            href="https://romaneiomarsil.lovable.app/"
            target="_blank"
            rel="noopener noreferrer"
            title={isCollapsed ? 'Acessar Romaneio' : ''}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl transition-all hover:bg-blue-100 dark:hover:bg-blue-900/30 group`}
          >
            <ExternalLink size={20} className="shrink-0" />
            {!isCollapsed && (
              <div className="flex flex-col">
                <span className="text-sm font-bold">Acessar Romaneio</span>
                <span className="text-[10px] text-blue-400 dark:text-blue-500 font-medium leading-tight">acessar após ás 13:30 em dias de semana</span>
              </div>
            )}
          </a>

          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div className="w-10 h-10 bg-neutral-100 dark:bg-neutral-800 rounded-full flex items-center justify-center shrink-0">
              <UserIcon size={20} className="text-neutral-500 dark:text-neutral-400" />
            </div>
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-semibold truncate dark:text-white">{profile?.displayName}</p>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 capitalize">{profile?.departmentId}</p>
              </div>
            )}
          </div>
          <button 
            onClick={logout}
            title={isCollapsed ? 'Sair' : ''}
            className={`w-full flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-4'} py-3 text-red-500 hover:bg-red-50 rounded-xl transition-all font-medium`}
          >
            <LogOut size={20} className="shrink-0" />
            {!isCollapsed && <span>Sair</span>}
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AuthContent activeTab={activeTab} setActiveTab={setActiveTab} />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function AuthContent({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (t: any) => void }) {
  const { user, profile, loading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="animate-spin text-blue-600" size={40} />
      </div>
    );
  }

  if (!user || !profile) return <LoginPage />;

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950 transition-colors duration-300">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={isMobileMenuOpen} 
        onClose={() => setIsMobileMenuOpen(false)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white dark:bg-neutral-900 border-b border-neutral-100 dark:border-neutral-800 p-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Truck className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-lg dark:text-white">Marsil Log</span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-lg text-neutral-600 dark:text-neutral-400"
          >
            <Menu size={24} />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-10 overflow-auto">
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

function StatCard({ title, value, icon: Icon, colorClass = "bg-blue-50 text-blue-600", isTVMode }: any) {
  return (
    <div className={`bg-white dark:bg-neutral-900 ${isTVMode ? 'p-8' : 'p-4 md:p-6'} rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 flex justify-between items-center gap-4 min-w-0 transition-all`}>
      <div className="flex flex-col gap-3 min-w-0">
        <div className={`${isTVMode ? 'w-16 h-16 mb-2' : 'w-10 h-10 md:w-12 md:h-12'} rounded-xl flex items-center justify-center shrink-0 ${colorClass} dark:bg-opacity-10`}>
          <Icon className={isTVMode ? 'w-8 h-8' : 'w-5 h-5 md:w-6 md:h-6'} />
        </div>
        <p className={`text-neutral-500 dark:text-neutral-400 ${isTVMode ? 'text-sm' : 'text-[10px] md:text-xs'} font-bold uppercase tracking-wider leading-tight break-words`}>{title}</p>
      </div>
      <div className="text-right shrink-0">
        <p className={`font-black text-neutral-900 dark:text-white ${isTVMode ? 'text-6xl' : 'text-2xl md:text-4xl'}`}>{value}</p>
      </div>
    </div>
  );
}

function OccurrenceCard({ occ }: { occ: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className="group p-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 hover:border-blue-200 dark:hover:border-blue-900 transition-all shadow-sm cursor-pointer"
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
          occ.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
          occ.severity === 'medium' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 
          'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
        }`}>
          {occ.severity === 'high' ? 'Crítica' : occ.severity === 'medium' ? 'Média' : 'Baixa'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
            <Clock size={10} />
            {new Date(occ.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isExpanded ? <ChevronUp size={14} className="text-neutral-300" /> : <ChevronDown size={14} className="text-neutral-300" />}
        </div>
      </div>
      <h4 className="font-bold text-neutral-900 dark:text-neutral-100 text-sm mb-1 leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
        {occ.title || 'Sem Título'}
      </h4>
      <p className={`text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
        {occ.description}
      </p>
      {occ.deptName && (
        <div className="mt-3 pt-3 border-t border-neutral-50 dark:border-neutral-800 flex items-center justify-between">
          <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">{occ.deptName}</span>
          <ArrowRight size={12} className="text-neutral-300 dark:text-neutral-700 group-hover:text-blue-400 transition-colors" />
        </div>
      )}
    </div>
  );
}

function OccurrenceList({ occurrences }: { occurrences: any[] }) {
  return (
    <div className="space-y-4">
      {occurrences.length === 0 ? (
        <p className="text-neutral-400 dark:text-neutral-500 text-sm italic">Nenhuma ocorrência registrada.</p>
      ) : (
        occurrences.map((occ, idx) => (
          <OccurrenceCard key={idx} occ={occ} />
        ))
      )}
    </div>
  );
}

// --- News Ticker ---

function NewsTicker({ occurrences, isTVMode }: { occurrences: any[], isTVMode?: boolean }) {
  const tickerText = occurrences.length > 0
    ? occurrences
        .map(occ => `[${occ.deptName}] ${occ.description} (${occ.severity.toUpperCase()})`)
        .join(' • ')
    : "MARSIL LOG NEWS: OPERAÇÃO NORMAL - SEM OCORRÊNCIAS NO MOMENTO";

  return (
    <div className={`bg-neutral-900 text-yellow-400 overflow-hidden whitespace-nowrap sticky top-0 z-50 shadow-lg border-b border-yellow-400/20 ${
      isTVMode ? 'py-6 w-full' : 'py-3 -mx-4 md:-mx-10 -mt-4 md:-mt-10 mb-6 md:mb-10'
    }`}>
      <motion.div
        animate={{ x: ["0%", "-100%"] }}
        transition={{ 
          duration: 180 + (tickerText.length / 2), 
          repeat: Infinity, 
          ease: "linear" 
        }}
        className="inline-block pl-[100%]"
      >
        <span className={`${isTVMode ? 'text-3xl' : 'text-lg'} font-bold font-mono tracking-wider uppercase`}>
          {tickerText} • {tickerText} • {tickerText}
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
  const [lastOccurrenceId, setLastOccurrenceId] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const today = new Date().toISOString().split('T')[0];

  // Filter States
  const [filterDate, setFilterDate] = useState(today);
  const [filterDept, setFilterDept] = useState<string>('all');
  const [filterSearch, setFilterSearch] = useState('');

  useEffect(() => {
    // Initialize audio
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
  }, []);

  useEffect(() => {
    // We fetch all logs for the selected date to build the dashboard and occurrences
    const q = query(collection(db, 'logs'), where('date', '==', filterDate));
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
  }, [filterDate]);

  const totalStaffPresent = logs.reduce((sum, log) => sum + (log.staffPresent || 0), 0);
  const totalOccurrences = logs.reduce((sum, log) => sum + (log.occurrences?.length || 0), 0);
  const totalFolhas = logs.find(l => l.departmentId === 'romaneio_tarde')?.data?.folhas || 0;
  const totalDrivers = logs.find(l => l.departmentId === 'veiculos')?.data?.driversCount || 0;
  
  const recebimentoLog = logs.find(l => l.departmentId === 'recebimento');
  const vehiclesReceived = recebimentoLog?.data?.vehiclesReceived || 0;
  const totalVehiclesExpected = recebimentoLog?.data?.totalVehicles || 0;
  const vehicleStats = totalVehiclesExpected > 0 ? `${vehiclesReceived}/${totalVehiclesExpected}` : vehiclesReceived;
  
  const totalPaletsPrevistos = Object.entries(recebimentoLog?.data?.vehiclesByType || {}).reduce((acc, [typeName, count]) => {
    const config = settings?.vehicleConfig?.find((c: any) => c.name === typeName);
    return acc + (Number(count) * (config?.palletCapacity || 0));
  }, 0);
  
  const estoqueLog = logs.find(l => l.departmentId === 'estoque');
  const paletsNoChao = estoqueLog?.data?.paletsNoChao || 0;
  const estoqueCapacity = settings?.departments?.estoque?.inventoryCapacity || 0;
  const estoqueAvailable = estoqueLog?.data?.availablePositions ?? estoqueCapacity;
  const estoqueOccupied = Math.max(0, estoqueCapacity - estoqueAvailable);
  const estoqueOccupancyPercent = estoqueCapacity > 0 ? Math.round((estoqueOccupied / estoqueCapacity) * 100) : 0;

  const allOccurrences = logs.flatMap(log => 
    (log.occurrences || []).map((occ: any) => ({
      ...occ,
      departmentId: log.departmentId,
      deptName: DEPARTMENTS[log.departmentId as DepartmentId]?.name || log.departmentId
    }))
  ).sort((a, b) => b.timestamp - a.timestamp);

  const filteredOccurrences = allOccurrences.filter(occ => {
    const matchesDept = filterDept === 'all' || occ.departmentId === filterDept;
    const matchesSearch = !filterSearch || 
      occ.title?.toLowerCase().includes(filterSearch.toLowerCase()) || 
      occ.description?.toLowerCase().includes(filterSearch.toLowerCase());
    return matchesDept && matchesSearch;
  });

  // Notification Logic
  useEffect(() => {
    if (allOccurrences.length > 0) {
      const latest = allOccurrences[0];
      const occurrenceId = `${latest.timestamp}-${latest.deptName}`;
      
      if (lastOccurrenceId && occurrenceId !== lastOccurrenceId) {
        // New occurrence detected!
        setShowNotification(latest);
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.log('Audio play blocked', e));
        }
        
        // Auto hide after 8 seconds
        setTimeout(() => setShowNotification(null), 8000);
      }
      
      setLastOccurrenceId(occurrenceId);
    }
  }, [allOccurrences, lastOccurrenceId]);

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

  const inventoryChartData = [
    { name: 'Capacidade Total', value: estoqueCapacity, fill: '#3b82f6' },
    { name: 'Palets no Chão', value: paletsNoChao, fill: '#f59e0b' },
    { name: 'Palets Disponíveis', value: estoqueAvailable, fill: '#10b981' }
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className={`flex flex-col ${isTVMode ? 'fixed inset-0 z-[100] bg-neutral-50 dark:bg-neutral-950 overflow-auto' : 'space-y-10'}`}>
      <NewsTicker occurrences={allOccurrences} isTVMode={isTVMode} />
      
      <div className={isTVMode ? 'p-12 space-y-12' : ''}>
        <AnimatePresence>
          {showNotification && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] w-full max-w-lg"
            >
              <div className={`bg-white dark:bg-neutral-900 border-l-8 ${
                showNotification.severity === 'high' ? 'border-red-500' : 
                showNotification.severity === 'medium' ? 'border-orange-500' : 'border-blue-500'
              } shadow-2xl rounded-2xl p-6 flex items-start gap-4 mx-4`}>
                <div className={`p-3 rounded-xl ${
                  showNotification.severity === 'high' ? 'bg-red-50 dark:bg-red-900/30' : 
                  showNotification.severity === 'medium' ? 'bg-orange-50 dark:bg-orange-900/30' : 'bg-blue-50 dark:bg-blue-900/30'
                }`}>
                  <BellRing className={
                    showNotification.severity === 'high' ? 'text-red-600 dark:text-red-400' : 
                    showNotification.severity === 'medium' ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'
                  } size={32} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">Nova Ocorrência: {showNotification.deptName}</span>
                    <button onClick={() => setShowNotification(null)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                      <X size={20} />
                    </button>
                  </div>
                  <h4 className="text-xl font-bold text-neutral-900 dark:text-white mb-1">{showNotification.title || 'Sem Título'}</h4>
                  <p className="text-neutral-600 dark:text-neutral-400 line-clamp-2">{showNotification.description}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex flex-col ${isTVMode ? 'gap-12' : 'lg:flex-row gap-8'}`}>
        <div className="flex-1 space-y-10">
          <header className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${isTVMode ? 'mb-4' : ''}`}>
            <div>
              <h2 className={`${isTVMode ? 'text-5xl mb-2' : 'text-2xl md:text-3xl'} font-bold text-neutral-900 dark:text-white`}>Dashboard Geral</h2>
              <p className={`text-neutral-500 dark:text-neutral-400 mt-1 ${isTVMode ? 'text-xl' : 'text-sm md:text-base'}`}>Visão em tempo real de todos os departamentos</p>
            </div>
            {!isTVMode && (
              <button 
                onClick={() => setIsTVMode(!isTVMode)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-all bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <Maximize size={20} />
                Modo TV
              </button>
            )}
            {isTVMode && (
              <button 
                onClick={() => setIsTVMode(false)}
                className="fixed top-12 right-12 z-[110] bg-neutral-900/50 hover:bg-neutral-900 text-white p-4 rounded-full transition-all shadow-2xl backdrop-blur-md"
                title="Sair do Modo TV"
              >
                <X size={32} />
              </button>
            )}
          </header>

          <div className={`grid gap-6 ${isTVMode ? 'grid-cols-3 xl:grid-cols-6' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'}`}>
            <StatCard title="Total Colaboradores" value={totalStaffPresent} icon={Users} isTVMode={isTVMode} />
            <StatCard title={`Veículos Recebidos (${new Date(filterDate).toLocaleDateString('pt-BR')})`} value={vehicleStats} icon={Truck} colorClass="bg-emerald-50 text-emerald-600" isTVMode={isTVMode} />
            <StatCard title="Palets Previstos" value={totalPaletsPrevistos} icon={Package} colorClass="bg-amber-50 text-amber-600" isTVMode={isTVMode} />
            <StatCard title="Pedidos do Dia" value={(logs.find(l => l.departmentId === 'romaneio_tarde')?.data?.ordersCount || 0) + (logs.find(l => l.departmentId === 'romaneio_noturno')?.data?.ordersCount || 0) + (logs.find(l => l.departmentId === 'exp_loja')?.data?.ordersCount || 0)} icon={ClipboardList} colorClass="bg-orange-50 text-orange-600" isTVMode={isTVMode} />
            <StatCard title="Total de Folhas do Dia" value={totalFolhas} icon={Newspaper} colorClass="bg-purple-50 text-purple-600" isTVMode={isTVMode} />
            <StatCard title="Motoristas em Operação" value={totalDrivers} icon={UserIcon} colorClass="bg-blue-50 text-blue-600" isTVMode={isTVMode} />
          </div>

          <div className={`grid gap-4 ${isTVMode ? 'grid-cols-6' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6'}`}>
            {chartData.map((dept, idx) => (
              <div key={idx} className={`bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 shadow-sm flex flex-col items-center text-center transition-all ${isTVMode ? 'p-6 rounded-3xl' : 'p-4 rounded-2xl'}`}>
                <span className={`font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1 ${isTVMode ? 'text-sm' : 'text-[10px]'}`}>{dept.name}</span>
                <div className="flex items-baseline gap-1">
                  <span className={`font-bold text-neutral-900 dark:text-white ${isTVMode ? 'text-3xl' : 'text-xl'}`}>{dept.presente}</span>
                  <span className={`text-neutral-400 dark:text-neutral-500 font-medium ${isTVMode ? 'text-base' : 'text-xs'}`}>/ {dept.total}</span>
                </div>
                <div className={`w-full bg-neutral-100 dark:bg-neutral-800 rounded-full mt-3 overflow-hidden ${isTVMode ? 'h-3' : 'h-1.5'}`}>
                  <div 
                    className={`h-full transition-all duration-500 ${dept.percent < 70 ? 'bg-red-500' : dept.percent < 90 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                    style={{ width: `${dept.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className={`grid gap-8 ${isTVMode ? 'grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}`}>
            <div className={`bg-white dark:bg-neutral-900 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden ${isTVMode ? 'p-10' : 'p-8'}`}>
              <h3 className={`font-bold mb-6 dark:text-white ${isTVMode ? 'text-2xl' : 'text-lg'}`}>Comparecimento (%)</h3>
              <div className={isTVMode ? 'h-[500px]' : 'h-80'}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: isTVMode ? 16 : 12}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: isTVMode ? 16 : 12}} unit="%" />
                    <Tooltip 
                      cursor={{fill: '#f9fafb'}}
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: isTVMode ? '16px' : '12px'}}
                    />
                    <Bar dataKey="percent" fill="#3b82f6" radius={[6, 6, 0, 0]} barSize={isTVMode ? 80 : 40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.percent < 70 ? '#ef4444' : entry.percent < 90 ? '#f59e0b' : '#10b981'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`bg-white dark:bg-neutral-900 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden ${isTVMode ? 'p-10' : 'p-8'}`}>
              <div className="flex justify-between items-start mb-6">
                <h3 className={`font-bold dark:text-white ${isTVMode ? 'text-2xl' : 'text-lg'}`}>Ocupação Estoque</h3>
                <div className={`flex items-center bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800/50 ${isTVMode ? 'px-8 py-4 gap-6' : 'px-4 py-2 gap-3'}`}>
                  <Package className={`text-amber-600 dark:text-amber-400 ${isTVMode ? 'w-10 h-10' : 'w-5 h-5'}`} />
                  <div className="text-right">
                    <p className={`font-bold text-amber-600 dark:text-amber-500 uppercase leading-none ${isTVMode ? 'text-sm mb-1' : 'text-[10px]'}`}>Palets no Chão</p>
                    <p className={`font-black text-amber-700 dark:text-amber-300 leading-none ${isTVMode ? 'text-4xl' : 'text-xl'}`}>{paletsNoChao}</p>
                  </div>
                </div>
              </div>
              <div className={`flex flex-col items-center justify-center ${isTVMode ? 'h-[500px]' : 'h-80'}`}>
                <div className={`relative ${isTVMode ? 'w-80 h-80' : 'w-48 h-48'}`}>
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 192 192">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth={isTVMode ? "12" : "16"}
                      fill="transparent"
                      className="text-neutral-100 dark:text-neutral-800"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth={isTVMode ? "12" : "16"}
                      fill="transparent"
                      strokeDasharray={552.92}
                      strokeDashoffset={552.92 - (552.92 * estoqueOccupancyPercent) / 100}
                      className={`${estoqueOccupancyPercent > 90 ? 'text-red-500' : estoqueOccupancyPercent > 70 ? 'text-orange-500' : 'text-blue-500'} transition-all duration-1000`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`font-bold text-neutral-900 dark:text-white ${isTVMode ? 'text-7xl' : 'text-4xl'}`}>{estoqueOccupancyPercent}%</span>
                    <span className={`text-neutral-400 dark:text-neutral-500 font-bold uppercase ${isTVMode ? 'text-lg mt-2' : 'text-xs'}`}>Ocupado</span>
                  </div>
                </div>
                <div className="mt-8 text-center">
                  <p className={`text-neutral-500 dark:text-neutral-400 ${isTVMode ? 'text-xl' : 'text-sm'}`}>
                    <span className="font-bold text-neutral-900 dark:text-neutral-200">{estoqueOccupied}</span> de <span className="font-bold text-neutral-900 dark:text-neutral-200">{estoqueCapacity}</span> posições
                  </p>
                  <p className={`text-neutral-400 dark:text-neutral-500 mt-2 ${isTVMode ? 'text-lg' : 'text-xs'}`}>
                    ({estoqueAvailable} disponíveis)
                  </p>
                </div>
              </div>
            </div>

            <div className={`bg-white dark:bg-neutral-900 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 overflow-hidden ${isTVMode ? 'p-10' : 'p-8'}`}>
              <h3 className={`font-bold mb-6 dark:text-white ${isTVMode ? 'text-2xl' : 'text-lg'}`}>Métricas de Inventário</h3>
              <div className={isTVMode ? 'h-[500px]' : 'h-80'}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryChartData} layout="vertical" margin={{ left: isTVMode ? 40 : 20, right: 40, top: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: isTVMode ? 16 : 12}} />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: isTVMode ? 16 : 12}} width={isTVMode ? 200 : 130} />
                    <Tooltip 
                      cursor={{fill: '#f9fafb'}}
                      contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', fontSize: isTVMode ? '16px' : '12px'}}
                    />
                    <Bar dataKey="value" name="Quantidade" radius={[0, 6, 6, 0]} barSize={isTVMode ? 60 : 30}>
                      {inventoryChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {isTVMode && (
             <div className="bg-white dark:bg-neutral-900 p-10 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800">
               <div className="flex items-center gap-4 mb-8">
                 <div className="p-3 bg-neutral-900 rounded-xl">
                   <Newspaper size={32} className="text-blue-400" />
                 </div>
                 <h3 className="text-3xl font-bold dark:text-white">Últimas Ocorrências</h3>
               </div>
               <div className="grid grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredOccurrences.slice(0, 6).map((occ, idx) => (
                   <div key={idx} className="p-6 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
                     <div className="flex items-center justify-between mb-4">
                        <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${
                          occ.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
                          occ.severity === 'medium' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400' : 
                          'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                        }`}>
                          {occ.severity === 'high' ? 'Crítica' : occ.severity === 'medium' ? 'Média' : 'Baixa'}
                        </span>
                        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{occ.deptName}</span>
                     </div>
                     <h4 className="text-lg font-bold mb-2 dark:text-white line-clamp-1">{occ.title || 'Sem Título'}</h4>
                     <p className="text-neutral-500 dark:text-neutral-400 line-clamp-3 text-sm">{occ.description}</p>
                   </div>
                 ))}
               </div>
             </div>
          )}
        </div>

        {!isTVMode && (
          <aside className="w-full lg:w-80 shrink-0">
            <div className="bg-white rounded-3xl shadow-sm border border-neutral-100 overflow-hidden sticky top-8">
              <div className="bg-neutral-900 p-6 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Newspaper size={20} className="text-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold">Ocorrências</h3>
                </div>
                
                <div className="space-y-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                    <input 
                      type="text"
                      placeholder="Filtrar por texto..."
                      value={filterSearch}
                      onChange={(e) => setFilterSearch(e.target.value)}
                      className="w-full bg-white/10 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs outline-none focus:bg-white/20 transition-all placeholder:text-neutral-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Calendar size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <input 
                        type="date"
                        value={filterDate}
                        onChange={(e) => setFilterDate(e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-lg py-1.5 pl-7 pr-2 text-[10px] outline-none focus:bg-white/20 transition-all"
                      />
                    </div>
                    <div className="relative">
                      <Filter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-neutral-500" />
                      <select
                        value={filterDept}
                        onChange={(e) => setFilterDept(e.target.value)}
                        className="w-full bg-white/10 border border-white/10 rounded-lg py-1.5 pl-7 pr-2 text-[10px] outline-none focus:bg-white/20 transition-all appearance-none"
                      >
                        <option value="all" className="bg-neutral-900">Todos</option>
                        {Object.values(DEPARTMENTS).map(d => (
                          <option key={d.id} value={d.id} className="bg-neutral-900">{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 bg-neutral-50/50 max-h-[calc(100vh-320px)] overflow-y-auto custom-scrollbar">
                <OccurrenceList occurrences={filteredOccurrences} />
              </div>
            </div>
          </aside>
        )}
      </div>
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
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">{title}</h2>
          <p className="text-neutral-500 dark:text-neutral-400 mt-1 text-sm md:text-base">Gestão diária do departamento</p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2">
          <Calendar size={16} />
          {new Date().toLocaleDateString('pt-BR')}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 space-y-8">
          <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
              <Users size={20} className="text-blue-600 dark:text-blue-400" />
              Dados de Operação
            </h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Total Colaboradores Presentes</label>
                  <input 
                    type="number" 
                    value={staffPresent}
                    onChange={(e) => setStaffPresent(parseInt(e.target.value))}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">Total do departamento: {totalStaff}</p>
                </div>
              </div>

              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">Colaboradores por Cargo</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {roles.map((role: string) => (
                    <div key={role}>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">{role}</label>
                      <input 
                        type="number"
                        value={staffByRole[role] || 0}
                        onChange={(e) => setStaffByRole({...staffByRole, [role]: parseInt(e.target.value)})}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">Métricas Específicas</h4>
                <div className="space-y-4">
                  {fields.map(field => (
                    <div key={field.name}>
                      <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">{field.label}</label>
                      {field.type === 'number' ? (
                        <input 
                          type="number" 
                          value={extraData[field.name] || 0}
                          onChange={(e) => setExtraData({...extraData, [field.name]: parseInt(e.target.value)})}
                          className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
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
                              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">{opt}</label>
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
                                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                              />
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none">
                Salvar Dados do Dia
              </button>
            </form>
          </section>

          <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
              <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
              Registrar Ocorrência
            </h3>
            <div className="space-y-4">
              <input 
                type="text"
                placeholder="Título da ocorrência (ex: Atraso de Veículo)"
                value={occurrenceTitle}
                onChange={(e) => setOccurrenceTitle(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition-all"
              />
              <textarea 
                placeholder="Descreva os detalhes..."
                value={occurrence}
                onChange={(e) => setOccurrence(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-red-500 outline-none transition-all min-h-[100px]"
              />
              <div className="flex items-center gap-4">
                <select 
                  value={severity}
                  onChange={(e: any) => setSeverity(e.target.value)}
                  className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none"
                >
                  <option value="low">Baixa Gravidade</option>
                  <option value="medium">Média Gravidade</option>
                  <option value="high">Alta Gravidade</option>
                </select>
                <button 
                  onClick={addOccurrence}
                  disabled={!occurrenceTitle || !occurrence}
                  className="flex-1 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 py-2 rounded-xl font-bold hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus size={18} />
                  Adicionar
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 dark:text-white">
              <History size={20} className="text-neutral-400 dark:text-neutral-500" />
              Ocorrências de Hoje
            </h3>
            <OccurrenceList occurrences={logs.find(l => l.date === today)?.occurrences || []} />
          </section>

          <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800">
            <h3 className="text-lg font-bold mb-6 dark:text-white">Histórico Recente</h3>
            <div className="space-y-4">
              {logs.filter(l => l.date !== today).map((log, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl transition-all cursor-default">
                  <div>
                    <p className="text-sm font-bold text-neutral-800 dark:text-neutral-200">{new Date(log.date).toLocaleDateString('pt-BR')}</p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">{log.staffPresent} presentes</p>
                  </div>
                  <ChevronRight size={16} className="text-neutral-300 dark:text-neutral-700" />
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ReceivingSchedule() {
  const [appointments, setAppointments] = useState<ReceivingAppointment[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterDate, setFilterDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    staff: '',
    requester: '',
    contact: '',
    supplierOrder: '',
    vehicle: '',
    pallets: 0,
    scheduledTime: '',
    observation: '',
    status: 'Aguardando' as ReceivingAppointment['status'],
    totalValue: 0,
    paymentTerm: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'appointments'));
    return onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReceivingAppointment));
      // Sort in memory to avoid needing composite indexes
      data.sort((a, b) => {
        const dateCompare = b.date.localeCompare(a.date);
        if (dateCompare !== 0) return dateCompare;
        return a.scheduledTime.localeCompare(b.scheduledTime);
      });
      setAppointments(data);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await setDoc(doc(db, 'appointments', editingId), {
          ...formData,
          createdAt: appointments.find(a => a.id === editingId)?.createdAt || serverTimestamp()
        }, { merge: true });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'appointments'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        setFilterDate(formData.date);
      }
      setIsAdding(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'appointments');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString().split('T')[0],
      staff: '',
      requester: '',
      contact: '',
      supplierOrder: '',
      vehicle: '',
      pallets: 0,
      scheduledTime: '',
      observation: '',
      status: 'Aguardando',
      totalValue: 0,
      paymentTerm: ''
    });
  };

  const startEdit = (a: ReceivingAppointment) => {
    setFormData({
      date: a.date,
      staff: a.staff,
      requester: a.requester,
      contact: a.contact,
      supplierOrder: a.supplierOrder,
      vehicle: a.vehicle,
      pallets: a.pallets,
      scheduledTime: a.scheduledTime,
      observation: a.observation,
      status: a.status,
      totalValue: a.totalValue,
      paymentTerm: a.paymentTerm
    });
    setEditingId(a.id);
    setIsAdding(true);
  };

  const updateStatus = async (id: string, status: ReceivingAppointment['status']) => {
    try {
      await setDoc(doc(db, 'appointments', id), { status }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const deleteAppointment = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta agenda?')) return;
    try {
      await setDoc(doc(db, 'appointments', id), { deleted: true }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const exportToCSV = () => {
    const headers = [
      'DATA', 'COLABORADOR', 'SOLICITANTE', 'CONTATO', 'PEDIDO FORNECEDOR', 
      'VEÍCULO', 'PALET', 'AGENDADO', 'OBSERVAÇÃO', 'STATUS', 
      'VALOR TOTAL DA CARGA', 'PRAZO PAGAMENTO BOLETO'
    ];
    
    const rows = appointments.filter(a => a.date === filterDate).map(a => [
      a.date,
      a.staff,
      a.requester,
      a.contact,
      a.supplierOrder,
      a.vehicle,
      a.pallets,
      a.scheduledTime,
      a.observation,
      a.status,
      a.totalValue,
      a.paymentTerm
    ]);

    const csvContent = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\n');

    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `agenda_recebimento_${filterDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredAppointments = appointments.filter(a => !a.deleted && a.date === filterDate);
  
  // Calculate conflicts
  const timeCounts = filteredAppointments.reduce((acc: any, curr) => {
    acc[curr.scheduledTime] = (acc[curr.scheduledTime] || 0) + 1;
    return acc;
  }, {});

  const hasTimeConflict = (time: string) => timeCounts[time] > 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold dark:text-white flex items-center gap-2">
          <Calendar size={24} className="text-blue-600" />
          Agenda de Recebimento
        </h3>
        <div className="flex items-center gap-2">
          <input 
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className="px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none"
          />
          <button 
            onClick={() => {
              resetForm();
              setEditingId(null);
              setIsAdding(true);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all text-sm"
          >
            <Plus size={18} />
            Agendar
          </button>
          <button 
            onClick={exportToCSV}
            className="bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-emerald-700 transition-all text-sm"
          >
            <FileDown size={18} />
            Exportar
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white dark:bg-neutral-900 p-8 rounded-3xl border border-blue-100 dark:border-blue-900/30 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h4 className="font-bold text-neutral-900 dark:text-white">
                {editingId ? 'Editar Agendamento' : 'Novo Agendamento'}
              </h4>
              <button 
                onClick={() => {
                  setIsAdding(false);
                  setEditingId(null);
                }} 
                className="text-neutral-400 hover:text-neutral-600"
              >
                <X size={20} />
              </button>
            </div>

            {hasTimeConflict(formData.scheduledTime) && formData.scheduledTime && (
              <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/50 rounded-2xl flex items-center gap-3 text-amber-700 dark:text-amber-400 text-sm font-bold animate-pulse">
                <AlertCircle size={20} />
                Atenção: Já existe um agendamento para este horário ({formData.scheduledTime}).
              </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Data</label>
                <input required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Agendado (Hora)</label>
                <input required type="time" value={formData.scheduledTime} onChange={e => setFormData({...formData, scheduledTime: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Colaborador</label>
                <input required type="text" value={formData.staff} onChange={e => setFormData({...formData, staff: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Solicitante</label>
                <input required type="text" value={formData.requester} onChange={e => setFormData({...formData, requester: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Contato</label>
                <input required type="text" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Pedido Fornecedor</label>
                <input required type="text" value={formData.supplierOrder} onChange={e => setFormData({...formData, supplierOrder: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Veículo</label>
                <input required type="text" value={formData.vehicle} onChange={e => setFormData({...formData, vehicle: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Palets</label>
                <input required type="number" value={formData.pallets} onChange={e => setFormData({...formData, pallets: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Valor Total Carga</label>
                <input required type="number" step="0.01" value={formData.totalValue} onChange={e => setFormData({...formData, totalValue: parseFloat(e.target.value) || 0})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Prazo Pagamento Boleto</label>
                <input required type="text" value={formData.paymentTerm} onChange={e => setFormData({...formData, paymentTerm: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none" />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-xs font-bold text-neutral-400 uppercase">Observação</label>
                <textarea value={formData.observation} onChange={e => setFormData({...formData, observation: e.target.value})} className="w-full px-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 dark:text-white text-sm outline-none min-h-[80px]" />
              </div>
              <div className="md:col-span-3 flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => {
                    setIsAdding(false);
                    setEditingId(null);
                  }} 
                  className="px-6 py-2 rounded-xl font-bold text-neutral-500 hover:bg-neutral-100 transition-all font-sans"
                >
                  Cancelar
                </button>
                <button type="submit" disabled={loading} className="bg-blue-600 text-white px-8 py-2 rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none flex items-center gap-2 font-sans">
                  {loading && <Loader2 className="animate-spin" size={18} />}
                  {editingId ? 'Salvar Alterações' : 'Salvar Agendamento'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-neutral-50 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-500 uppercase text-[10px] font-bold">
              <tr>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Horário</th>
                <th className="px-6 py-4">Pedido/Fornecedor</th>
                <th className="px-6 py-4">Veículo</th>
                <th className="px-6 py-4">Solicitante</th>
                <th className="px-6 py-4">Palets</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50 dark:divide-neutral-800">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-neutral-400 dark:text-neutral-500 italic">Nenhum agendamento para esta data.</td>
                </tr>
              ) : (
                filteredAppointments.map(a => {
                  const conflict = hasTimeConflict(a.scheduledTime);
                  return (
                    <tr key={a.id} className={`hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors ${conflict ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <select 
                          value={a.status} 
                          onChange={(e: any) => updateStatus(a.id, e.target.value)}
                          className={`text-[10px] font-bold uppercase px-2 py-1 rounded-lg outline-none border-none ${
                            a.status === 'Recebido' ? 'bg-emerald-100 text-emerald-600' : 
                            a.status === 'Descarregando' ? 'bg-blue-100 text-blue-600' : 
                            a.status === 'Cancelado' ? 'bg-red-100 text-red-600' : 
                            'bg-amber-100 text-amber-600'
                          }`}
                        >
                          <option value="Aguardando">Aguardando</option>
                          <option value="Descarregando">Descarregando</option>
                          <option value="Recebido">Recebido</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold dark:text-white">{a.scheduledTime}</span>
                          {conflict && (
                            <div className="p-1.5 bg-amber-100 text-amber-600 rounded-lg tooltip" title="Conflito de Horário">
                              <AlertCircle size={14} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold dark:text-white">{a.supplierOrder}</p>
                        <p className="text-[10px] text-neutral-400">{a.staff}</p>
                      </td>
                      <td className="px-6 py-4 dark:text-neutral-300">{a.vehicle}</td>
                      <td className="px-6 py-4">
                        <p className="font-medium dark:text-neutral-300">{a.requester}</p>
                        <p className="text-[10px] text-neutral-400">{a.contact}</p>
                      </td>
                      <td className="px-6 py-4 font-bold dark:text-white">{a.pallets}</td>
                      <td className="px-6 py-4 font-bold dark:text-white whitespace-nowrap">R$ {a.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          {a.observation && (
                            <div className="relative group">
                              <button 
                                className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                title="Ver Observação"
                              >
                                <MessageSquare size={16} />
                              </button>
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 p-3 bg-neutral-900 text-white text-[10px] rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 border border-neutral-800">
                                <p className="font-bold mb-1 uppercase tracking-wider text-neutral-400 text-[8px]">Observação</p>
                                {a.observation}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-neutral-900"></div>
                              </div>
                            </div>
                          )}
                          <button 
                            onClick={() => startEdit(a)} 
                            className="p-2 text-neutral-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Settings2 size={16} />
                          </button>
                          <button 
                            onClick={() => deleteAppointment(a.id)} 
                            className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                            title="Excluir"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RecebimentoView() {
  const [settings, setSettings] = useState<any>(null);
  const [activeSubTab, setActiveSubTab] = useState<'operation' | 'schedule'>('operation');

  useEffect(() => {
    return onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    });
  }, []);

  const vehicleOptions = settings?.vehicleConfig?.map((t: any) => t.name) || VEHICLE_TYPES;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4 border-b border-neutral-100 dark:border-neutral-800 p-1">
        <button 
          onClick={() => setActiveSubTab('operation')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'operation' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
        >
          Operação do Dia
        </button>
        <button 
          onClick={() => setActiveSubTab('schedule')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${activeSubTab === 'schedule' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100 dark:shadow-none' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'}`}
        >
          Agenda de Recebimento
        </button>
      </div>

      {activeSubTab === 'operation' ? (
        <DepartmentView 
          departmentId="recebimento" 
          title="Recebimento" 
          fields={[
            { name: 'totalVehicles', label: 'Total de Veículos Previstos', type: 'number' },
            { name: 'vehiclesReceived', label: 'Veículos Recebidos até o momento', type: 'number' },
            { name: 'vehiclesByType', label: 'Quantidade por Tipo de Veículo', type: 'counter-list', options: vehicleOptions }
          ]} 
        />
      ) : (
        <ReceivingSchedule />
      )}
    </div>
  );
}

function EstoqueView() {
  return <DepartmentView 
    departmentId="estoque" 
    title="Estoque" 
    fields={[
      { name: 'availablePositions', label: 'Posições Disponíveis Hoje', type: 'number' },
      { name: 'paletsNoChao', label: 'Palets no Chão', type: 'number' }
    ]} 
  />;
}

function RomaneioTardeView() {
  return <DepartmentView 
    departmentId="romaneio_tarde" 
    title="Romaneio Tarde" 
    fields={[
      { name: 'ordersCount', label: 'Total de Pedidos', type: 'number' },
      { name: 'folhas', label: 'Total de Folhas', type: 'number' },
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
  const [newType, setNewType] = useState({ name: '', palletCapacity: 0 });
  
  const today = new Date().toISOString().split('T')[0];
  const [reportRange, setReportRange] = useState({ start: today, end: today });
  const [reportDept, setReportDept] = useState('all');
  const [reportSeverity, setReportSeverity] = useState('all');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

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
          vehicles: [],
          vehicleConfig: [
            { id: '1', name: 'Carreta', palletCapacity: 26 },
            { id: '2', name: 'Truck', palletCapacity: 12 },
            { id: '3', name: 'Toco', palletCapacity: 8 },
            { id: '4', name: 'Van', palletCapacity: 4 },
            { id: '5', name: 'HR', palletCapacity: 3 },
            { id: '6', name: 'Furgão', palletCapacity: 2 },
            { id: '7', name: 'Fiorino', palletCapacity: 1 },
          ]
        };
        setDoc(doc(db, 'settings', 'global'), initialSettings);
        setSettings(initialSettings);
      }
      // We don't set loading false here yet, we wait for auth settings too
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const unsubAuth = onSnapshot(doc(db, 'settings', 'auth'), (docSnap) => {
      if (docSnap.exists()) {
        setAuthSettings(docSnap.data());
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/auth');
      setLoading(false);
    });

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

  const addVehicleType = async () => {
    if (!newType.name) return;
    const type = { ...newType, id: Math.random().toString(36).substr(2, 9) };
    const newSettings = {
      ...settings,
      vehicleConfig: [...(settings.vehicleConfig || []), type]
    };
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
      setNewType({ name: '', palletCapacity: 0 });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const removeVehicleType = async (id: string) => {
    const newSettings = {
      ...settings,
      vehicleConfig: (settings.vehicleConfig || []).filter((t: any) => t.id !== id)
    };
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const removeVehicle = async (id: string) => {
    const newSettings = {
      ...settings,
      vehicles: (settings.vehicles || []).filter((v: any) => v.id !== id)
    };
    try {
      await setDoc(doc(db, 'settings', 'global'), newSettings);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'settings/global');
    }
  };

  const exportOccurrencesReport = async () => {
    setIsGeneratingReport(true);
    try {
      const q = query(
        collection(db, 'logs'),
        where('date', '>=', reportRange.start),
        where('date', '<=', reportRange.end)
      );
      
      const querySnapshot = await getDocs(q);
      let allOccurrences: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const deptOccurrences = data.occurrences || [];
        const deptId = data.departmentId;
        
        if (reportDept === 'all' || deptId === reportDept) {
          deptOccurrences.forEach((occ: any) => {
            if (reportSeverity === 'all' || occ.severity === reportSeverity) {
              allOccurrences.push({
                date: data.date,
                department: DEPARTMENTS[deptId as DepartmentId]?.name || deptId,
                title: occ.title,
                description: occ.description,
                severity: occ.severity,
                time: new Date(occ.timestamp).toLocaleTimeString()
              });
            }
          });
        }
      });

      if (allOccurrences.length === 0) {
        alert("Nenhuma ocorrência encontrada para os filtros selecionados.");
        return;
      }

      // Sort by date and time
      allOccurrences.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

      // Convert to CSV
      const headers = ['Data', 'Departamento', 'Título', 'Descrição', 'Gravidade', 'Hora'];
      const csvRows = [
        headers.join(';'),
        ...allOccurrences.map(row => 
          [
            row.date, 
            row.department, 
            `"${(row.title || '').replace(/"/g, '""')}"`, 
            `"${(row.description || '').replace(/"/g, '""')}"`, 
            row.severity, 
            row.time
          ].join(';')
        )
      ];
      
      const csvContent = "\uFEFF" + csvRows.join('\n'); // Adding BOM for Excel
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `relatorio_ocorrencias_${reportRange.start}_a_${reportRange.end}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Erro ao gerar relatório:", error);
      alert("Erro ao gerar relatório. Tente novamente.");
    } finally {
      setIsGeneratingReport(false);
    }
  };

  if (loading || !settings || !settings.departments) return (
    <div className="flex flex-col items-center justify-center p-20 space-y-4">
      <Loader2 className="animate-spin text-blue-600" size={48} />
      <p className="text-neutral-500 dark:text-neutral-400 font-medium">Carregando configurações...</p>
    </div>
  );

  return (
    <div className="space-y-10 max-w-5xl">
      <header>
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">Configurações do Sistema</h2>
        <p className="text-neutral-500 dark:text-neutral-400 mt-1">Gerencie cargos, equipes e veículos</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
            <Lock size={24} className="text-red-600 dark:text-red-400" />
            Segurança e Senhas
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">Senha do Administrador</label>
              <input 
                type="text"
                defaultValue={authSettings?.admin}
                onBlur={(e) => updatePasswords(e.target.value, authSettings?.user)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">Senha dos Usuários (Setores)</label>
              <input 
                type="text"
                defaultValue={authSettings?.user}
                onBlur={(e) => updatePasswords(authSettings?.admin, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </section>

        <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
            <Users size={24} className="text-blue-600 dark:text-blue-400" />
            Cargos e Equipes
          </h3>
          <div className="space-y-6">
            {Object.values(DEPARTMENTS).map(dept => (
              <div key={dept.id} className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl space-y-3">
                <p className="font-bold text-neutral-900 dark:text-white">{dept.name}</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">Total Equipe</label>
                    <input 
                      type="number"
                      value={settings.departments?.[dept.id]?.totalStaff || 0}
                      onChange={(e) => updateDeptStaff(dept.id, parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">Cargos (separados por vírgula)</label>
                    <input 
                      type="text"
                      defaultValue={settings.departments?.[dept.id]?.roles?.join(', ') || ''}
                      onBlur={(e) => updateDeptRoles(dept.id, e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  {dept.id === 'estoque' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">Capacidade Total (Posições)</label>
                      <input 
                        type="number"
                        value={settings.departments?.[dept.id]?.inventoryCapacity || 0}
                        onChange={(e) => updateDeptCapacity(dept.id, parseInt(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-6">
          <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
            <Truck size={24} className="text-emerald-600 dark:text-emerald-400" />
            Frota de Veículos
          </h3>
          
          <div className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-2xl space-y-4">
            <p className="text-sm font-bold dark:text-white">Cadastrar Novo Veículo</p>
            <div className="grid grid-cols-2 gap-3">
              <input 
                placeholder="Placa"
                value={newVehicle.plate}
                onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value.toUpperCase()})}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
              />
              <input 
                placeholder="Modelo"
                value={newVehicle.model}
                onChange={(e) => setNewVehicle({...newVehicle, model: e.target.value})}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
              />
              <select 
                value={newVehicle.type}
                onChange={(e) => setNewVehicle({...newVehicle, type: e.target.value})}
                className="col-span-2 px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
              >
                <option value="">Selecione o Tipo</option>
                {(settings.vehicleConfig || VEHICLE_TYPES.map(name => ({ name }))).map((t: any) => (
                  <option key={t.id || t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <button 
              onClick={addVehicle}
              className="w-full bg-emerald-600 text-white py-2 rounded-xl font-bold hover:bg-emerald-700 transition-all"
            >
              Adicionar Veículo
            </button>
          </div>

          <div className="space-y-4 pt-6 border-t border-neutral-100 dark:border-neutral-800">
            <h4 className="text-sm font-bold dark:text-white">Tipos de Veículos e Capacidades</h4>
            <div className="grid grid-cols-2 gap-3">
              <input 
                placeholder="Nome do Tipo (ex: Carreta)"
                value={newType.name}
                onChange={(e) => setNewType({...newType, name: e.target.value})}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
              />
              <input 
                type="number"
                placeholder="Palets"
                value={newType.palletCapacity || ''}
                onChange={(e) => setNewType({...newType, palletCapacity: parseInt(e.target.value) || 0})}
                className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
              />
              <button 
                onClick={addVehicleType}
                className="col-span-2 bg-blue-600 text-white py-2 rounded-xl font-bold hover:bg-blue-700 transition-all"
              >
                Adicionar Tipo
              </button>
            </div>

            <div className="space-y-2 max-h-[300px] overflow-auto">
              {settings.vehicleConfig?.map((t: any) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-neutral-100 dark:bg-neutral-800 rounded-xl">
                  <div>
                    <p className="font-bold text-sm dark:text-white">{t.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.palletCapacity} Palets</p>
                  </div>
                  <button 
                    onClick={() => removeVehicleType(t.id)}
                    className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-auto">
            {settings.vehicles?.map((v: any) => (
              <div key={v.id} className="flex items-center justify-between p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl">
                <div>
                  <p className="font-bold text-sm dark:text-white">{v.plate}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">{v.model} • {v.type}</p>
                </div>
                <button 
                  onClick={() => removeVehicle(v.id)}
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-2 rounded-lg"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-6">
        <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
          <FileText size={24} className="text-blue-600 dark:text-blue-400" />
          Relatórios de Ocorrências
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-50 dark:bg-neutral-800 p-6 rounded-2xl">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-2">Período</label>
              <div className="grid grid-cols-2 gap-2">
                <input 
                  type="date"
                  value={reportRange.start}
                  onChange={(e) => setReportRange({...reportRange, start: e.target.value})}
                  className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
                />
                <input 
                  type="date"
                  value={reportRange.end}
                  onChange={(e) => setReportRange({...reportRange, end: e.target.value})}
                  className="px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-2">Departamento</label>
              <select 
                value={reportDept}
                onChange={(e) => setReportDept(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
              >
                <option value="all">Todos os Departamentos</option>
                {Object.values(DEPARTMENTS).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-2">Gravidade</label>
              <select 
                value={reportSeverity}
                onChange={(e) => setReportSeverity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none"
              >
                <option value="all">Todas as Gravidades</option>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Crítica</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col justify-end">
            <button 
              onClick={exportOccurrencesReport}
              disabled={isGeneratingReport}
              className="flex items-center justify-center gap-3 w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {isGeneratingReport ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <FileDown size={20} />
              )}
              Exportar Relatório (CSV)
            </button>
            <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-3 text-center">
              O arquivo será gerado com separador de ponto e vírgula (;), compatível com Excel e Google Sheets.
            </p>
          </div>
        </div>
      </section>

      <OccurrenceHistory />
    </div>
  );
}

function HistoryOccurrenceCard({ occ }: { occ: any }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      onClick={() => setIsExpanded(!isExpanded)}
      className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-neutral-100 dark:border-neutral-700 flex flex-col sm:flex-row sm:items-start justify-between gap-4 cursor-pointer hover:border-blue-200 dark:hover:border-blue-900 transition-all"
    >
      <div className="flex items-start gap-3 flex-1">
        <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
          occ.severity === 'high' ? 'bg-red-500' : 
          occ.severity === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
        }`} />
        <div className="flex-1">
          <p className={`text-sm font-medium text-neutral-900 dark:text-neutral-100 leading-relaxed ${isExpanded ? '' : 'line-clamp-1 sm:line-clamp-2'}`}>
            {occ.description}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
            <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase">{occ.deptName}</span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
              <Calendar size={12} />
              {new Date(occ.date + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500 flex items-center gap-1">
              <History size={12} />
              {new Date(occ.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 shrink-0">
        <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
          occ.severity === 'high' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 
          occ.severity === 'medium' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
        }`}>
          {occ.severity === 'high' ? 'Alta' : occ.severity === 'medium' ? 'Média' : 'Baixa'}
        </div>
        {isExpanded ? <ChevronUp size={14} className="text-neutral-300" /> : <ChevronDown size={14} className="text-neutral-300" />}
      </div>
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
    <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h3 className="text-xl font-bold flex items-center gap-2 dark:text-white">
          <History size={24} className="text-orange-600 dark:text-orange-400" />
          Histórico de Ocorrências
        </h3>
        
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <Filter size={16} className="text-neutral-400 dark:text-neutral-500" />
            <select 
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="bg-transparent text-sm outline-none font-medium dark:text-white"
            >
              <option value="all" className="dark:bg-neutral-800">Todos Departamentos</option>
              {Object.values(DEPARTMENTS).map(dept => (
                <option key={dept.id} value={dept.id} className="dark:bg-neutral-800">{dept.name}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-center gap-2 bg-neutral-50 dark:bg-neutral-800 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700">
            <Calendar size={16} className="text-neutral-400 dark:text-neutral-500" />
            <input 
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-sm outline-none font-medium dark:text-white dark:color-scheme-dark"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-auto pr-2">
        {filteredOccurrences.length === 0 ? (
          <div className="text-center py-12 bg-neutral-50 dark:bg-neutral-800 rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700">
            <p className="text-neutral-400 dark:text-neutral-500">Nenhuma ocorrência encontrada com os filtros selecionados.</p>
          </div>
        ) : (
          filteredOccurrences.map((occ, idx) => (
            <HistoryOccurrenceCard key={idx} occ={occ} />
          ))
        )}
      </div>
    </section>
  );
}

