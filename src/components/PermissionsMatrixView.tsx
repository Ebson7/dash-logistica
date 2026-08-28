import React, { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Users,
  Lock,
  Search,
  Filter,
  Check,
  X,
  UserCheck,
  Key,
  Edit2,
  RefreshCw,
  HelpCircle,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  Eye,
  EyeOff,
  Copy,
  CheckCheck,
  Plus,
  Trash2,
  Download,
  Settings as SettingsIcon,
  UserX
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, UserRole, AppAction, DepartmentId } from '../types';
import {
  ROLE_DEFINITIONS,
  ACTION_DEFINITIONS,
  MODULE_PERMISSIONS_MATRIX,
  resolveUserRole,
  canUserPerform,
  getUserModuleActions,
  getDepartmentName,
  checkTabAccess
} from '../utils/permissions';
import { DEPARTMENTS } from '../constants';
import { validatePassword, generateSecurePassword } from '../utils/passwordSecurity';

interface PermissionsMatrixViewProps {
  currentUserProfile?: UserProfile | null;
}

export function PermissionsMatrixView({ currentUserProfile }: PermissionsMatrixViewProps) {
  const [activeTab, setActiveTab] = useState<'matrix' | 'users' | 'simulator'>('matrix');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // User Management State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [userSearch, setUserSearch] = useState<string>('');
  const [userDeptFilter, setUserDeptFilter] = useState<string>('all');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  
  // Edit User Modal / State
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('operator');
  const [selectedDept, setSelectedDept] = useState<DepartmentId | 'admin'>('recebimento');
  const [selectedStatus, setSelectedStatus] = useState<'active' | 'blocked' | 'pending'>('active');
  const [userPasswordInput, setUserPasswordInput] = useState<string>('');
  const [showPasswordInput, setShowPasswordInput] = useState<boolean>(false);
  const [copiedPassword, setCopiedPassword] = useState<boolean>(false);
  const [isSavingUser, setIsSavingUser] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Simulator State
  const [simulatedRole, setSimulatedRole] = useState<UserRole>('operator');
  const [simulatedDept, setSimulatedDept] = useState<DepartmentId | 'admin'>('recebimento');
  const [simulatedUserUid, setSimulatedUserUid] = useState<string>('custom');

  const isAdmin = currentUserProfile?.departmentId === 'admin' || currentUserProfile?.email === 'ebsonsilva7@gmail.com' || currentUserProfile?.role === 'admin';

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Subscribe to real-time users collection
  useEffect(() => {
    try {
      const usersRef = collection(db, 'users');
      const unsub = onSnapshot(usersRef, (snapshot) => {
        const userList: UserProfile[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          return {
            uid: docSnap.id,
            email: data.email || '',
            displayName: data.displayName || data.name || data.email?.split('@')[0] || 'Usuário',
            departmentId: data.departmentId || 'viewer',
            role: data.role || (data.departmentId === 'admin' ? 'admin' : data.departmentId === 'viewer' ? 'viewer' : 'operator'),
            status: data.status || 'active',
            phone: data.phone || '',
            badgeNumber: data.badgeNumber || '',
            createdAt: data.createdAt,
            lastLogin: data.lastLogin,
            customPermissions: data.customPermissions || undefined,
          };
        });
        setUsers(userList);
        setLoadingUsers(false);
      }, (error) => {
        console.warn('Erro ao carregar usuários para a matriz:', error);
        setLoadingUsers(false);
      });

      return () => unsub();
    } catch (e) {
      console.error(e);
      setLoadingUsers(false);
    }
  }, []);

  const handleOpenEditUser = (user: UserProfile) => {
    setEditingUser(user);
    setSelectedRole(resolveUserRole(user));
    setSelectedDept(user.departmentId);
    setSelectedStatus(user.status || 'active');
    setUserPasswordInput((user as any).password || '');
    setShowPasswordInput(false);
    setCopiedPassword(false);
  };

  const handleSaveUser = async () => {
    if (!editingUser) return;

    if (userPasswordInput.trim()) {
      const validation = validatePassword(userPasswordInput.trim());
      if (!validation.isValid) {
        showToast('A senha do usuário deve ter no mínimo 8 dígitos, letra maiúscula, número e símbolo.', 'error');
        return;
      }
    }

    setIsSavingUser(true);
    try {
      const userRef = doc(db, 'users', editingUser.uid);
      const updateData: any = {
        role: selectedRole,
        departmentId: selectedDept,
        status: selectedStatus,
        updatedAt: serverTimestamp(),
      };

      if (userPasswordInput.trim()) {
        updateData.password = userPasswordInput.trim();
        updateData.hasCustomPassword = true;
        updateData.passwordUpdatedAt = serverTimestamp();

        // Also update settings/auth passwordsByUser map
        const authRef = doc(db, 'settings', 'auth');
        const authSnap = await getDoc(authRef);
        const currentAuth = authSnap.exists() ? authSnap.data() : {};
        const updatedByUser = {
          ...(currentAuth.passwordsByUser || {}),
          [editingUser.uid]: userPasswordInput.trim(),
          ...(editingUser.email ? { [editingUser.email.toLowerCase()]: userPasswordInput.trim() } : {})
        };
        await setDoc(authRef, {
          ...currentAuth,
          passwordsByUser: updatedByUser,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      await updateDoc(userRef, updateData);
      showToast(`Permissões e credenciais de ${editingUser.displayName || editingUser.email} atualizadas com sucesso!`, 'success');
      setEditingUser(null);
    } catch (error: any) {
      console.error('Erro ao atualizar usuário:', error);
      showToast('Falha ao salvar dados do usuário. Verifique suas credenciais de administrador.', 'error');
    } finally {
      setIsSavingUser(false);
    }
  };

  // Filter modules for Matrix View
  const filteredModules = MODULE_PERMISSIONS_MATRIX.filter((m) => {
    const matchesCategory = categoryFilter === 'all' || m.category === categoryFilter;
    const matchesSearch =
      m.moduleName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.moduleId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Filter users for User Management View
  const filteredUsers = users.filter((u) => {
    const matchesDept = userDeptFilter === 'all' || u.departmentId === userDeptFilter;
    const matchesRole = userRoleFilter === 'all' || resolveUserRole(u) === userRoleFilter;
    const matchesSearch =
      u.displayName.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.badgeNumber && u.badgeNumber.toLowerCase().includes(userSearch.toLowerCase()));
    return matchesDept && matchesRole && matchesSearch;
  });

  // Simulated profile for RBAC Simulator
  const simulatedProfile: UserProfile = React.useMemo(() => {
    if (simulatedUserUid !== 'custom') {
      const found = users.find((u) => u.uid === simulatedUserUid);
      if (found) return found;
    }
    return {
      uid: 'simulated-uid',
      email: 'simulacao@marsillog.com.br',
      displayName: `Simulação (${ROLE_DEFINITIONS[simulatedRole].label})`,
      departmentId: simulatedDept,
      role: simulatedRole,
      status: 'active',
    };
  }, [simulatedUserUid, simulatedRole, simulatedDept, users]);

  return (
    <div id="permissions-matrix-root" className="w-full max-w-7xl mx-auto space-y-6 pb-16 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-3 animate-slideUp text-xs sm:text-sm font-bold ${
            toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-200 dark:border-rose-800 shadow-rose-500/10'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800 shadow-emerald-500/10'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle size={18} className="text-rose-600 dark:text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                  Matriz de Permissões & Controle de Acesso (RBAC)
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  Zero-Trust
                </span>
              </div>
              <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                Governança, privilégios granulares por módulo e gestão centralizada de perfis corporativos.
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl border border-neutral-200 dark:border-neutral-700 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'matrix'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Layers size={14} />
            Matriz Geral
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'users'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Users size={14} />
            Gestão de Usuários ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'simulator'
                ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            <Sparkles size={14} />
            Simulador de Perfis
          </button>
        </div>
      </header>

      {/* Role Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((roleKey) => {
          const roleDef = ROLE_DEFINITIONS[roleKey];
          const count = users.filter((u) => resolveUserRole(u) === roleKey).length;
          return (
            <div
              key={roleKey}
              className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200/80 dark:border-neutral-800 shadow-sm flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${roleDef.badgeColor}`}>
                    {roleDef.label}
                  </span>
                  <span className="text-xs font-bold text-neutral-400 dark:text-neutral-500">
                    {count} {count === 1 ? 'usuário' : 'usuários'}
                  </span>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 mt-1">
                  {roleDef.description}
                </p>
              </div>
              <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">
                <span>Nível de Acesso:</span>
                <span className="font-mono font-bold text-neutral-900 dark:text-white">L{roleDef.level}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: MATRIZ GERAL DE MÓDULOS E AÇÕES */}
      {/* ========================================================================= */}
      {activeTab === 'matrix' && (
        <div className="space-y-4">
          {/* Action Definitions Legend */}
          <div className="bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                <Info size={14} className="text-blue-500" /> Legenda de Ações Granulares do Sistema
              </span>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {(Object.keys(ACTION_DEFINITIONS) as AppAction[]).map((actKey) => {
                const act = ACTION_DEFINITIONS[actKey];
                return (
                  <div
                    key={actKey}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700"
                  >
                    <span className={`px-1.5 py-0.5 rounded-md font-bold text-[10px] uppercase ${act.color}`}>
                      {act.shortLabel}
                    </span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {act.label}:
                    </span>
                    <span className="text-neutral-400 dark:text-neutral-500 text-[11px]">
                      {act.description}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-3.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar módulo ou funcionalidade..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs font-bold text-neutral-400 shrink-0 flex items-center gap-1">
                <Filter size={12} /> Categoria:
              </span>
              {['all', 'Operacional', 'Gestão & Planejamento', 'Corporativo', 'Segurança & TI'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    categoryFilter === cat
                      ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-sm'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                  }`}
                >
                  {cat === 'all' ? 'Todos os Módulos' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-neutral-50/80 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-800 text-xs font-bold text-neutral-600 dark:text-neutral-300">
                    <th className="p-4 min-w-[240px]">Módulo & Escopo</th>
                    <th className="p-4 min-w-[170px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                        Super Admin
                      </div>
                    </th>
                    <th className="p-4 min-w-[170px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span>
                        Gestor / Supervisor
                      </div>
                    </th>
                    <th className="p-4 min-w-[170px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                        Operador / Conferente
                      </div>
                    </th>
                    <th className="p-4 min-w-[170px]">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        Visualizador (Diretoria)
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 text-xs">
                  {filteredModules.map((module) => (
                    <tr key={module.moduleId} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-neutral-900 dark:text-white text-sm">
                          {module.moduleName}
                        </div>
                        <div className="text-neutral-500 dark:text-neutral-400 text-xs mt-0.5 line-clamp-2">
                          {module.description}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700">
                            {module.category}
                          </span>
                          <span className="font-mono text-[10px] text-neutral-400">
                            tab: {module.moduleId}
                          </span>
                        </div>
                      </td>

                      {/* Super Admin Column */}
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-1">
                          {module.defaultByRole.admin.map((act) => (
                            <span
                              key={act}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ACTION_DEFINITIONS[act]?.color}`}
                            >
                              {ACTION_DEFINITIONS[act]?.shortLabel || act}
                            </span>
                          ))}
                        </div>
                      </td>

                      {/* Manager Column */}
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-1">
                          {module.defaultByRole.manager.length > 0 ? (
                            module.defaultByRole.manager.map((act) => (
                              <span
                                key={act}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ACTION_DEFINITIONS[act]?.color}`}
                              >
                                {ACTION_DEFINITIONS[act]?.shortLabel || act}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                              <Lock size={12} /> Bloqueado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Operator Column */}
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-1">
                          {module.defaultByRole.operator.length > 0 ? (
                            module.defaultByRole.operator.map((act) => (
                              <span
                                key={act}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ACTION_DEFINITIONS[act]?.color}`}
                              >
                                {ACTION_DEFINITIONS[act]?.shortLabel || act}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                              <Lock size={12} /> Bloqueado
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Viewer Column */}
                      <td className="p-4 align-top">
                        <div className="flex flex-wrap gap-1">
                          {module.defaultByRole.viewer.length > 0 ? (
                            module.defaultByRole.viewer.map((act) => (
                              <span
                                key={act}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ACTION_DEFINITIONS[act]?.color}`}
                              >
                                {ACTION_DEFINITIONS[act]?.shortLabel || act}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                              <Lock size={12} /> Bloqueado
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GESTÃO DE USUÁRIOS & ATRIBUIÇÃO DE PERFIS */}
      {/* ========================================================================= */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* User Filters Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Buscar usuário por nome, email ou matrícula..."
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={userDeptFilter}
                onChange={(e) => setUserDeptFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none"
              >
                <option value="all">Todos os Departamentos</option>
                <option value="admin">Administração Geral</option>
                <option value="viewer">Visualizador (Somente Leitura)</option>
                {Object.values(DEPARTMENTS).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none"
              >
                <option value="all">Todos os Papéis (Roles)</option>
                {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_DEFINITIONS[r].label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Users List Grid */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            {loadingUsers ? (
              <div className="p-12 text-center text-neutral-400 flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-blue-500" />
                <span className="text-xs font-bold">Carregando usuários registrados...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-neutral-400 dark:text-neutral-500">
                <UserX size={32} className="mx-auto mb-2 opacity-50" />
                <p className="font-bold text-sm">Nenhum usuário encontrado</p>
                <p className="text-xs">Tente ajustar os termos de busca ou filtros selecionados.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredUsers.map((u) => {
                  const resolvedRole = resolveUserRole(u);
                  const roleDef = ROLE_DEFINITIONS[resolvedRole];
                  const isBlocked = u.status === 'blocked';

                  return (
                    <div
                      key={u.uid}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center font-bold text-sm text-neutral-700 dark:text-neutral-300 shrink-0">
                          {u.displayName ? u.displayName.slice(0, 2).toUpperCase() : u.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-neutral-900 dark:text-white text-sm">
                              {u.displayName || u.email}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${roleDef.badgeColor}`}>
                              {roleDef.label}
                            </span>
                            {isBlocked && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                Bloqueado
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            <span>{u.email}</span>
                            <span>•</span>
                            <span className="font-medium text-neutral-700 dark:text-neutral-300">
                              Setor: {getDepartmentName(u.departmentId)}
                            </span>
                            {u.badgeNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono">Matrícula: {u.badgeNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action for Admin */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {isAdmin ? (
                          <button
                            onClick={() => handleOpenEditUser(u)}
                            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors flex items-center gap-1.5 border border-neutral-200 dark:border-neutral-700"
                          >
                            <Edit2 size={13} />
                            Alterar Permissões
                          </button>
                        ) : (
                          <span className="text-xs text-neutral-400 italic">Somente leitura</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SIMULADOR DE PERFIS & PERMISSÕES */}
      {/* ========================================================================= */}
      {activeTab === 'simulator' && (
        <div className="space-y-6">
          {/* Simulator Controls Card */}
          <div className="bg-gradient-to-br from-indigo-900 to-blue-900 text-white p-6 sm:p-8 rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-white/10 backdrop-blur-md rounded-2xl">
                <Sparkles className="w-6 h-6 text-yellow-300" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black">
                  Simulador Interativo de Credenciais e Acesso
                </h3>
                <p className="text-xs sm:text-sm text-indigo-200 font-medium">
                  Selecione um colaborador registrado ou monte um perfil hipotético para auditar imediatamente o comportamento do sistema.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              {/* Select Registered User */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-indigo-200 uppercase">
                  Usuário de Referência
                </label>
                <select
                  value={simulatedUserUid}
                  onChange={(e) => {
                    setSimulatedUserUid(e.target.value);
                    if (e.target.value !== 'custom') {
                      const found = users.find((u) => u.uid === e.target.value);
                      if (found) {
                        setSimulatedRole(resolveUserRole(found));
                        setSimulatedDept(found.departmentId);
                      }
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-yellow-400"
                >
                  <option value="custom" className="text-neutral-900">
                    -- Perfil Customizado / Teste --
                  </option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid} className="text-neutral-900">
                      {u.displayName || u.email} ({ROLE_DEFINITIONS[resolveUserRole(u)].label})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-indigo-200 uppercase">
                  Papel de Acesso (Role)
                </label>
                <select
                  value={simulatedRole}
                  disabled={simulatedUserUid !== 'custom'}
                  onChange={(e) => setSimulatedRole(e.target.value as UserRole)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
                >
                  {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((r) => (
                    <option key={r} value={r} className="text-neutral-900">
                      {ROLE_DEFINITIONS[r].label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Department */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-indigo-200 uppercase">
                  Departamento / Setor
                </label>
                <select
                  value={simulatedDept}
                  disabled={simulatedUserUid !== 'custom'}
                  onChange={(e) => setSimulatedDept(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-xs font-bold outline-none focus:ring-2 focus:ring-yellow-400 disabled:opacity-50"
                >
                  <option value="admin" className="text-neutral-900">Administração Geral</option>
                  <option value="viewer" className="text-neutral-900">Visualizador (Auditoria)</option>
                  {Object.values(DEPARTMENTS).map((d) => (
                    <option key={d.id} value={d.id} className="text-neutral-900">
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Audit Results Grid */}
          <div className="space-y-3">
            <h4 className="text-sm font-black text-neutral-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600" />
              Resultado da Auditoria em Tempo Real: {ROLE_DEFINITIONS[simulatedRole].label} • Setor: {getDepartmentName(simulatedDept)}
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {MODULE_PERMISSIONS_MATRIX.map((module) => {
                const tabCheck = checkTabAccess(module.moduleId, simulatedProfile);
                const isAuthorized = tabCheck.authorized;
                const allowedActions = isAuthorized ? getUserModuleActions(simulatedProfile, module.moduleId) : [];

                return (
                  <div
                    key={module.moduleId}
                    className={`p-4 rounded-2xl border transition-all ${
                      isAuthorized
                        ? 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 shadow-sm'
                        : 'bg-neutral-50/60 dark:bg-neutral-900/40 border-dashed border-neutral-200 dark:border-neutral-800 opacity-75'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-bold text-sm text-neutral-900 dark:text-white">
                        {module.moduleName}
                      </div>
                      {isAuthorized ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1 shrink-0">
                          <Check size={10} /> Liberado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-1 shrink-0">
                          <Lock size={10} /> Bloqueado
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-1 mb-3">
                      {module.description}
                    </p>

                    <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <span className="text-[11px] font-bold text-neutral-400 block mb-1">
                        Ações Autorizadas:
                      </span>
                      {allowedActions.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {allowedActions.map((act) => (
                            <span
                              key={act}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${ACTION_DEFINITIONS[act]?.color}`}
                            >
                              {ACTION_DEFINITIONS[act]?.shortLabel || act}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-500 flex items-center gap-1">
                          Nenhuma ação permitida (Acesso Negado)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDIT USER ROLE & PERMISSIONS */}
      {/* ========================================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                  <UserCheck size={20} />
                </div>
                <div>
                  <h3 className="font-black text-neutral-900 dark:text-white text-base">
                    Editar Permissões do Usuário
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {editingUser.displayName || editingUser.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* User Email & ID Info */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-1">
                <div className="text-[11px] font-bold text-neutral-400 uppercase">E-mail Corporativo</div>
                <div className="text-sm font-bold text-neutral-900 dark:text-white">{editingUser.email}</div>
                <div className="font-mono text-[10px] text-neutral-400">UID: {editingUser.uid}</div>
              </div>

              {/* Role Selection */}
              <div className="space-y-2">
                <label className="font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider block">
                  Papel no Sistema (Role RBAC)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((r) => {
                    const def = ROLE_DEFINITIONS[r];
                    const isSelected = selectedRole === r;
                    return (
                      <div
                        key={r}
                        onClick={() => setSelectedRole(r)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                            : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-neutral-900 dark:text-white text-xs">
                            {def.label}
                          </span>
                          {isSelected && <Check size={14} className="text-indigo-600 shrink-0" />}
                        </div>
                        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 line-clamp-2">
                          {def.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Department Selection */}
              <div className="space-y-1.5">
                <label className="font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider block">
                  Departamento de Lotação
                </label>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="admin">Administração Geral (Acesso Total)</option>
                  <option value="viewer">Visualizador (Auditoria / Diretoria)</option>
                  {Object.values(DEPARTMENTS).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Account Status */}
              <div className="space-y-1.5">
                <label className="font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider block">
                  Status da Conta
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('active')}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                      selectedStatus === 'active'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    Ativa
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStatus('blocked')}
                    className={`flex-1 py-2 px-3 rounded-xl font-bold border transition-all text-center ${
                      selectedStatus === 'blocked'
                        ? 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-neutral-50 text-neutral-600 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400'
                    }`}
                  >
                    Bloqueada
                  </button>
                </div>
              </div>

              {/* Password Setting Section */}
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider block flex items-center gap-1.5">
                    <Key size={14} className="text-indigo-600 dark:text-indigo-400" />
                    Senha de Acesso do Colaborador
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pass = generateSecurePassword(10);
                      setUserPasswordInput(pass);
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1 text-[11px]"
                  >
                    <Sparkles size={12} className="text-amber-500" />
                    Gerar Senha Segura
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showPasswordInput ? 'text' : 'password'}
                    value={userPasswordInput}
                    onChange={(e) => setUserPasswordInput(e.target.value)}
                    placeholder="Deixe em branco para manter a senha atual"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-xs outline-none focus:ring-2 focus:ring-indigo-500 pr-20"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setShowPasswordInput(!showPasswordInput)}
                      className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                    >
                      {showPasswordInput ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    {userPasswordInput && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(userPasswordInput);
                          setCopiedPassword(true);
                          setTimeout(() => setCopiedPassword(false), 2000);
                        }}
                        className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                        title="Copiar senha"
                      >
                        {copiedPassword ? <CheckCheck size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                {userPasswordInput && (
                  (() => {
                    const val = validatePassword(userPasswordInput);
                    return (
                      <div className="space-y-1.5 pt-1">
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          <span className={`px-1.5 py-0.5 rounded ${val.hasMinLength ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500'}`}>8+ caracteres</span>
                          <span className={`px-1.5 py-0.5 rounded ${val.hasUppercase ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500'}`}>1 Maiúscula</span>
                          <span className={`px-1.5 py-0.5 rounded ${val.hasNumber ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500'}`}>1 Número</span>
                          <span className={`px-1.5 py-0.5 rounded ${val.hasSymbol ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500'}`}>1 Símbolo (!@#$)</span>
                        </div>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSavingUser}
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingUser}
                onClick={handleSaveUser}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSavingUser && <RefreshCw size={12} className="animate-spin" />}
                {isSavingUser ? 'Salvando...' : 'Salvar Permissões'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
