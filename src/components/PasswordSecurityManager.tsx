import React, { useState, useEffect } from 'react';
import {
  Lock,
  Key,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  Check,
  X,
  Copy,
  CheckCheck,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  UserPlus,
  Users,
  Search,
  Building2,
  Shield,
  Save,
  CheckCircle2,
  Info
} from 'lucide-react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { DepartmentId, UserProfile, UserRole } from '../types';
import { DEPARTMENTS } from '../constants';
import { validatePassword, generateSecurePassword, PasswordValidationResult } from '../utils/passwordSecurity';
import { logAuditEvent } from '../utils/auditLogger';

interface PasswordSecurityManagerProps {
  currentUserProfile: UserProfile | null;
}

export function PasswordSecurityManager({ currentUserProfile }: PasswordSecurityManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<'admin_pass' | 'dept_pass' | 'user_pass'>('admin_pass');
  
  // Auth settings from Firestore settings/auth
  const [authSettings, setAuthSettings] = useState<{
    admin: string;
    user: string;
    viewer: string;
    passwordsByDept?: Record<string, string>;
    passwordsByUser?: Record<string, string>;
  } | null>(null);

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [saveErrorMsg, setSaveErrorMsg] = useState<string | null>(null);

  // Admin personal password state
  const [adminNewPassword, setAdminNewPassword] = useState('');
  const [adminConfirmPassword, setAdminConfirmPassword] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [copiedAdminPass, setCopiedAdminPass] = useState(false);

  // Department passwords state
  const [deptPasswords, setDeptPasswords] = useState<Record<string, string>>({});
  const [showDeptPass, setShowDeptPass] = useState<Record<string, boolean>>({});
  const [savingDept, setSavingDept] = useState<string | null>(null);

  // Users list state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [userSearch, setUserSearch] = useState('');
  const [userDeptFilter, setUserDeptFilter] = useState('all');

  // User password modal state
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<UserProfile | null>(null);
  const [userNewPassword, setUserNewPassword] = useState('');
  const [showUserNewPass, setShowUserNewPass] = useState(false);
  const [copiedUserPass, setCopiedUserPass] = useState(false);
  const [savingUserPass, setSavingUserPass] = useState(false);

  // Create new user modal state
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [newUserData, setNewUserData] = useState({
    displayName: '',
    email: '',
    departmentId: 'recebimento' as DepartmentId | 'admin',
    role: 'operator' as UserRole,
    badgeNumber: '',
    password: '',
  });
  const [showCreateUserPass, setShowCreateUserPass] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);

  // Subscribe to auth settings
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'auth'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as any;
        setAuthSettings(data);
        if (data.passwordsByDept) {
          setDeptPasswords(data.passwordsByDept);
        }
      } else {
        const initial = {
          admin: 'Marsil@Admin2026!',
          user: 'Marsil@User2026!',
          viewer: 'Marsil@View2026!',
          passwordsByDept: {
            recebimento: 'Marsil@Rec2026!',
            estoque: 'Marsil@Est2026!',
            romaneio_tarde: 'Marsil@RomT2026!',
            romaneio_noturno: 'Marsil@RomN2026!',
            exp_loja: 'Marsil@Exp2026!',
            boraceia: 'Marsil@Bora2026!',
            veiculos: 'Marsil@Veic2026!',
            viewer: 'Marsil@View2026!',
          },
          passwordsByUser: {}
        };
        setDoc(doc(db, 'settings', 'auth'), initial);
        setAuthSettings(initial);
        setDeptPasswords(initial.passwordsByDept);
      }
      setLoadingAuth(false);
    }, (err) => {
      console.error('Error fetching auth settings:', err);
      setLoadingAuth(false);
    });

    return () => unsub();
  }, []);

  // Fetch users list
  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const userList: UserProfile[] = [];
      snapshot.forEach((docSnap) => {
        userList.push({ ...docSnap.data(), uid: docSnap.id } as UserProfile);
      });
      setUsers(userList);
      setLoadingUsers(false);
    }, (err) => {
      console.error('Error fetching users:', err);
      setLoadingUsers(false);
    });

    return () => unsubUsers();
  }, []);

  // Auto clear message after 4 seconds
  useEffect(() => {
    if (saveSuccessMsg) {
      const timer = setTimeout(() => setSaveSuccessMsg(null), 4500);
      return () => clearTimeout(timer);
    }
  }, [saveSuccessMsg]);

  // Handle Admin Password Change
  const handleSaveAdminPassword = async () => {
    setSaveErrorMsg(null);
    const validation = validatePassword(adminNewPassword);
    
    if (!validation.isValid) {
      setSaveErrorMsg('A senha do Administrador não atende a todos os requisitos de segurança obrigatórios.');
      return;
    }

    if (adminConfirmPassword && adminNewPassword !== adminConfirmPassword) {
      setSaveErrorMsg('As senhas digitadas não coincidem.');
      return;
    }

    setIsSaving(true);
    try {
      const authRef = doc(db, 'settings', 'auth');
      await setDoc(authRef, {
        ...authSettings,
        admin: adminNewPassword,
        updatedAt: serverTimestamp(),
        updatedBy: currentUserProfile?.email || 'admin'
      }, { merge: true });

      // If current user is admin in users collection, update their record too
      if (currentUserProfile?.uid) {
        const userRef = doc(db, 'users', currentUserProfile.uid);
        await setDoc(userRef, {
          password: adminNewPassword,
          hasCustomPassword: true,
          passwordUpdatedAt: serverTimestamp()
        }, { merge: true });
      }

      // Record Audit Log
      logAuditEvent({
        action: 'PASSWORD_CHANGE_ADMIN',
        category: 'AUTH_SECURITY',
        severity: 'critical',
        description: `Senha Master do Administrador alterada por ${currentUserProfile?.displayName || currentUserProfile?.email || 'Admin'}.`,
        targetId: 'settings/auth',
        targetType: 'auth_security',
        targetName: 'Senha Master Admin',
        actorProfile: currentUserProfile,
        details: {
          updatedByEmail: currentUserProfile?.email || 'admin',
          timestamp: new Date().toISOString()
        }
      });

      setSaveSuccessMsg('Sua senha de Administrador foi alterada com sucesso!');
      setAdminNewPassword('');
      setAdminConfirmPassword('');
    } catch (err: any) {
      setSaveErrorMsg(`Erro ao salvar senha: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Department Password Update
  const handleSaveDeptPassword = async (deptId: string, newPass: string) => {
    setSaveErrorMsg(null);
    const validation = validatePassword(newPass);

    if (!validation.isValid) {
      setSaveErrorMsg(`A senha do setor ${deptId} deve atender aos 4 critérios de segurança.`);
      return;
    }

    setSavingDept(deptId);
    try {
      const updatedDeptPasswords = {
        ...(authSettings?.passwordsByDept || {}),
        [deptId]: newPass
      };

      const authRef = doc(db, 'settings', 'auth');
      await setDoc(authRef, {
        ...authSettings,
        passwordsByDept: updatedDeptPasswords,
        user: deptId === 'recebimento' ? newPass : (authSettings?.user || newPass),
        viewer: deptId === 'viewer' ? newPass : (authSettings?.viewer || newPass),
        updatedAt: serverTimestamp()
      }, { merge: true });

      const deptName = deptId === 'viewer' ? 'Visualizador' : (DEPARTMENTS[deptId as DepartmentId]?.name || deptId);

      // Record Audit Log
      logAuditEvent({
        action: 'PASSWORD_CHANGE_DEPT',
        category: 'AUTH_SECURITY',
        severity: 'warning',
        description: `Senha do setor "${deptName}" (${deptId}) redefinida por ${currentUserProfile?.displayName || currentUserProfile?.email || 'Admin'}.`,
        targetId: deptId,
        targetType: 'department_password',
        targetName: deptName,
        actorProfile: currentUserProfile,
        details: {
          departmentId: deptId,
          departmentName: deptName
        }
      });

      setSaveSuccessMsg(`Senha do setor "${deptName}" atualizada com sucesso!`);
    } catch (err: any) {
      setSaveErrorMsg(`Erro ao salvar senha do setor: ${err.message}`);
    } finally {
      setSavingDept(null);
    }
  };

  // Handle Individual User Password Save
  const handleSaveUserPassword = async () => {
    if (!selectedUserForPassword) return;
    setSaveErrorMsg(null);
    const validation = validatePassword(userNewPassword);

    if (!validation.isValid) {
      setSaveErrorMsg('A senha do usuário deve ter pelo menos 8 dígitos, letra maiúscula, número e símbolo.');
      return;
    }

    setSavingUserPass(true);
    try {
      // 1. Update user document
      const userRef = doc(db, 'users', selectedUserForPassword.uid);
      await setDoc(userRef, {
        password: userNewPassword,
        hasCustomPassword: true,
        passwordUpdatedAt: serverTimestamp()
      }, { merge: true });

      // 2. Update passwordsByUser map in settings/auth
      const updatedByUser = {
        ...(authSettings?.passwordsByUser || {}),
        [selectedUserForPassword.uid]: userNewPassword,
        ...(selectedUserForPassword.email ? { [selectedUserForPassword.email.toLowerCase()]: userNewPassword } : {})
      };

      const authRef = doc(db, 'settings', 'auth');
      await setDoc(authRef, {
        ...authSettings,
        passwordsByUser: updatedByUser,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Record Audit Log
      logAuditEvent({
        action: 'PASSWORD_CHANGE_USER',
        category: 'AUTH_SECURITY',
        severity: 'warning',
        description: `Senha individual do colaborador "${selectedUserForPassword.displayName || selectedUserForPassword.email}" redefinida.`,
        targetId: selectedUserForPassword.uid,
        targetType: 'user_password',
        targetName: selectedUserForPassword.displayName || selectedUserForPassword.email,
        actorProfile: currentUserProfile,
        details: {
          targetUid: selectedUserForPassword.uid,
          targetEmail: selectedUserForPassword.email,
          targetRole: selectedUserForPassword.role
        }
      });

      setSaveSuccessMsg(`Senha do usuário ${selectedUserForPassword.displayName || selectedUserForPassword.email} definida com sucesso!`);
      setSelectedUserForPassword(null);
      setUserNewPassword('');
    } catch (err: any) {
      setSaveErrorMsg(`Erro ao salvar senha do usuário: ${err.message}`);
    } finally {
      setSavingUserPass(false);
    }
  };

  // Handle Create New User with Password
  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveErrorMsg(null);

    if (!newUserData.displayName.trim() || !newUserData.email.trim()) {
      setSaveErrorMsg('Informe o nome e o e-mail do colaborador.');
      return;
    }

    const validation = validatePassword(newUserData.password);
    if (!validation.isValid) {
      setSaveErrorMsg('A senha criada para o novo usuário não atende aos 4 critérios de segurança.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const generatedUid = 'usr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
      
      // 1. Create document in users
      const userRef = doc(db, 'users', generatedUid);
      const newProfile: Partial<UserProfile> = {
        uid: generatedUid,
        displayName: newUserData.displayName.trim(),
        email: newUserData.email.trim().toLowerCase(),
        departmentId: newUserData.departmentId,
        role: newUserData.role,
        badgeNumber: newUserData.badgeNumber.trim() || undefined,
        status: 'active',
        createdAt: serverTimestamp(),
      };

      await setDoc(userRef, {
        ...newProfile,
        password: newUserData.password,
        hasCustomPassword: true,
        passwordUpdatedAt: serverTimestamp()
      });

      // 2. Save in settings/auth
      const updatedByUser = {
        ...(authSettings?.passwordsByUser || {}),
        [generatedUid]: newUserData.password,
        [newUserData.email.trim().toLowerCase()]: newUserData.password
      };

      const authRef = doc(db, 'settings', 'auth');
      await setDoc(authRef, {
        ...authSettings,
        passwordsByUser: updatedByUser,
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Record Audit Log
      logAuditEvent({
        action: 'USER_CREATE',
        category: 'PERMISSIONS_RBAC',
        severity: 'info',
        description: `Novo colaborador "${newUserData.displayName}" cadastrado com papel "${newUserData.role}" no setor "${newUserData.departmentId}".`,
        targetId: generatedUid,
        targetType: 'user_profile',
        targetName: newUserData.displayName,
        actorProfile: currentUserProfile,
        details: {
          newUserEmail: newUserData.email,
          newUserName: newUserData.displayName,
          departmentId: newUserData.departmentId,
          role: newUserData.role,
          badgeNumber: newUserData.badgeNumber
        }
      });

      setSaveSuccessMsg(`Novo usuário "${newUserData.displayName}" cadastrado com senha com sucesso!`);
      setIsCreateUserModalOpen(false);
      setNewUserData({
        displayName: '',
        email: '',
        departmentId: 'recebimento',
        role: 'operator',
        badgeNumber: '',
        password: '',
      });
    } catch (err: any) {
      setSaveErrorMsg(`Erro ao criar usuário: ${err.message}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const copyToClipboard = (text: string, type: 'admin' | 'user') => {
    navigator.clipboard.writeText(text);
    if (type === 'admin') {
      setCopiedAdminPass(true);
      setTimeout(() => setCopiedAdminPass(false), 2000);
    } else {
      setCopiedUserPass(true);
      setTimeout(() => setCopiedUserPass(false), 2000);
    }
  };

  const adminValidation = validatePassword(adminNewPassword);
  const userValidation = validatePassword(userNewPassword);
  const createValidation = validatePassword(newUserData.password);

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.displayName?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.badgeNumber?.includes(userSearch);

    const matchesDept =
      userDeptFilter === 'all' || u.departmentId === userDeptFilter;

    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Toast Messages */}
      {saveSuccessMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{saveSuccessMsg}</span>
          </div>
          <button onClick={() => setSaveSuccessMsg(null)} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded-lg">
            <X size={16} />
          </button>
        </div>
      )}

      {saveErrorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400 shrink-0" />
            <span className="text-xs sm:text-sm font-bold">{saveErrorMsg}</span>
          </div>
          <button onClick={() => setSaveErrorMsg(null)} className="p-1 hover:bg-rose-100 dark:hover:bg-rose-900 rounded-lg">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Security Rule Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white p-6 rounded-3xl shadow-md border border-blue-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck size={22} className="text-blue-300" />
              <span className="text-xs font-black uppercase tracking-wider text-blue-200">
                Padrão de Segurança Marsil Log
              </span>
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Gestão Centralizada de Senhas & Acessos
            </h3>
            <p className="text-blue-200/90 text-xs sm:text-sm mt-1 max-w-2xl">
              Como Administrador, você pode alterar sua própria senha de acesso e criar/definir senhas seguras para todos os setores e colaboradores do sistema.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 shrink-0 space-y-1.5 text-xs text-blue-100">
            <div className="font-bold text-white flex items-center gap-1.5">
              <Lock size={14} className="text-emerald-400" />
              Requisitos Obrigatórios:
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <span className="flex items-center gap-1">✓ Mínimo 8 dígitos</span>
              <span className="flex items-center gap-1">✓ 1 Letra Maiúscula</span>
              <span className="flex items-center gap-1">✓ 1 Número (0-9)</span>
              <span className="flex items-center gap-1">✓ 1 Símbolo (!@#$...)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200 dark:border-neutral-700">
        <button
          type="button"
          onClick={() => setActiveSubTab('admin_pass')}
          className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'admin_pass'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Shield size={15} className="text-red-500" />
          Minha Senha de Administrador
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('user_pass')}
          className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'user_pass'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Users size={15} className="text-indigo-500" />
          Senhas dos Usuários ({users.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('dept_pass')}
          className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeSubTab === 'dept_pass'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Building2 size={15} className="text-blue-500" />
          Senhas dos Setores Operacionais
        </button>
      </div>

      {/* ========================================================================= */}
      {/* ABA 1: MINHA SENHA DE ADMINISTRADOR */}
      {/* ========================================================================= */}
      {activeSubTab === 'admin_pass' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Card Principal: Alterar Senha Admin */}
          <div className="lg:col-span-2 bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 flex items-center justify-center text-red-600 dark:text-red-400">
                  <Key size={24} />
                </div>
                <div>
                  <h4 className="text-lg font-black text-neutral-900 dark:text-white">
                    Alterar Senha do Administrador
                  </h4>
                  <p className="text-xs text-neutral-500">
                    Defina sua nova credencial de acesso master para gerenciamento de todo o sistema
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const pass = generateSecurePassword(12);
                  setAdminNewPassword(pass);
                  setAdminConfirmPassword(pass);
                }}
                className="px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold text-xs flex items-center gap-1.5 transition-all border border-neutral-200 dark:border-neutral-700"
              >
                <Sparkles size={14} className="text-amber-500" />
                Gerar Senha Segura
              </button>
            </div>

            <div className="space-y-4">
              {/* Senha Atual Configurada */}
              <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <span className="text-[11px] font-bold uppercase text-neutral-400 block mb-0.5">
                    Senha de Administrador Atualmente em Uso
                  </span>
                  <div className="font-mono text-sm font-bold text-neutral-800 dark:text-neutral-200">
                    {showAdminPass ? authSettings?.admin : '••••••••••••'}
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setShowAdminPass(!showAdminPass)}
                    className="p-2 rounded-xl bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 text-xs font-bold flex items-center gap-1"
                  >
                    {showAdminPass ? <EyeOff size={14} /> : <Eye size={14} />}
                    {showAdminPass ? 'Ocultar' : 'Visualizar'}
                  </button>
                  {authSettings?.admin && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(authSettings.admin, 'admin')}
                      className="p-2 rounded-xl bg-white dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 text-xs font-bold flex items-center gap-1"
                    >
                      {copiedAdminPass ? <CheckCheck size={14} className="text-emerald-500" /> : <Copy size={14} />}
                      {copiedAdminPass ? 'Copiado!' : 'Copiar'}
                    </button>
                  )}
                </div>
              </div>

              {/* Input Nova Senha */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1.5">
                  Nova Senha Master
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={adminNewPassword}
                    onChange={(e) => setAdminNewPassword(e.target.value)}
                    placeholder="Ex: Marsil@Admin2026!"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-sm outline-none focus:ring-2 focus:ring-red-500 pr-12"
                  />
                  {adminNewPassword && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(adminNewPassword, 'admin')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                      title="Copiar senha digitada"
                    >
                      {copiedAdminPass ? <CheckCheck size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Input Confirmar Senha */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1.5">
                  Confirmar Nova Senha
                </label>
                <input
                  type="text"
                  value={adminConfirmPassword}
                  onChange={(e) => setAdminConfirmPassword(e.target.value)}
                  placeholder="Repita a nova senha"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-sm outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              {/* Password Strength Meter */}
              {adminNewPassword && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-neutral-500">Força da Senha:</span>
                    <span className={adminValidation.strengthColor.replace('bg-', 'text-')}>
                      {adminValidation.strengthLabel} ({adminValidation.score}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${adminValidation.strengthColor.split(' ')[0]}`}
                      style={{ width: `${adminValidation.score}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="button"
                  disabled={isSaving || !adminValidation.isValid}
                  onClick={handleSaveAdminPassword}
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-sm bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
                  {isSaving ? 'Salvando Nova Senha...' : 'Salvar Minha Senha de Administrador'}
                </button>
              </div>
            </div>
          </div>

          {/* Card Lateral: Checklist de Requisitos em Tempo Real */}
          <div className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-neutral-200 dark:border-neutral-800 flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-600 dark:text-blue-400" />
                <h4 className="font-bold text-sm text-neutral-900 dark:text-white">
                  Validação de Critérios
                </h4>
              </div>
              <p className="text-xs text-neutral-500">
                A nova senha deve atender a todos os 4 requisitos da política de segurança da Marsil Log:
              </p>

              <div className="space-y-3 pt-2">
                <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
                  adminValidation.hasMinLength
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                }`}>
                  <div className="flex items-center gap-2">
                    {adminValidation.hasMinLength ? <Check size={16} className="text-emerald-600 shrink-0" /> : <X size={16} className="text-neutral-400 shrink-0" />}
                    <span>Mínimo de 8 Caracteres</span>
                  </div>
                  <span className="font-mono text-[11px] opacity-75">
                    ({adminNewPassword.length}/8)
                  </span>
                </div>

                <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
                  adminValidation.hasUppercase
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                }`}>
                  <div className="flex items-center gap-2">
                    {adminValidation.hasUppercase ? <Check size={16} className="text-emerald-600 shrink-0" /> : <X size={16} className="text-neutral-400 shrink-0" />}
                    <span>1 Letra Maiúscula (A-Z)</span>
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
                  adminValidation.hasNumber
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                }`}>
                  <div className="flex items-center gap-2">
                    {adminValidation.hasNumber ? <Check size={16} className="text-emerald-600 shrink-0" /> : <X size={16} className="text-neutral-400 shrink-0" />}
                    <span>1 Número (0-9)</span>
                  </div>
                </div>

                <div className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold transition-all ${
                  adminValidation.hasSymbol
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300'
                    : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500'
                }`}>
                  <div className="flex items-center gap-2">
                    {adminValidation.hasSymbol ? <Check size={16} className="text-emerald-600 shrink-0" /> : <X size={16} className="text-neutral-400 shrink-0" />}
                    <span>1 Símbolo Especial (!@#$%...)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
              <span className="font-bold block mb-1">Dica de Segurança:</span>
              Você pode usar o botão "Gerar Senha Segura" para gerar automaticamente uma senha criptograficamente forte que já atende a todos os critérios.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: SENHAS DOS USUÁRIOS (INDIVIDUAIS & NOVO USUÁRIO) */}
      {/* ========================================================================= */}
      {activeSubTab === 'user_pass' && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-neutral-900 p-4 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar colaborador..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs font-medium rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <select
                value={userDeptFilter}
                onChange={(e) => setUserDeptFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs font-bold bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 outline-none"
              >
                <option value="all">Todos os Setores</option>
                <option value="admin">Administração</option>
                <option value="viewer">Visualizador</option>
                {Object.values(DEPARTMENTS).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                const autoPass = generateSecurePassword(10);
                setNewUserData({
                  displayName: '',
                  email: '',
                  departmentId: 'recebimento',
                  role: 'operator',
                  badgeNumber: '',
                  password: autoPass,
                });
                setIsCreateUserModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 flex items-center justify-center gap-1.5 transition-all shrink-0"
            >
              <UserPlus size={15} />
              Cadastrar Novo Usuário com Senha
            </button>
          </div>

          {/* Users List Grid */}
          <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
            {loadingUsers ? (
              <div className="p-12 text-center text-neutral-400 flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-indigo-500" />
                <span className="text-xs font-bold">Carregando usuários registrados...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-neutral-400 dark:text-neutral-500">
                <Users size={32} className="mx-auto mb-2 opacity-50" />
                <p className="font-bold text-sm">Nenhum colaborador encontrado</p>
                <p className="text-xs">Cadastre um novo usuário ou ajuste os termos de busca.</p>
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredUsers.map((u) => {
                  const userSavedPass = (u as any).password || authSettings?.passwordsByUser?.[u.uid] || authSettings?.passwordsByUser?.[u.email?.toLowerCase()];
                  const hasCustom = Boolean(userSavedPass);

                  return (
                    <div
                      key={u.uid}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-neutral-50/60 dark:hover:bg-neutral-800/30 transition-colors"
                    >
                      <div className="flex items-start sm:items-center gap-3.5">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center font-bold text-sm text-indigo-700 dark:text-indigo-300 shrink-0">
                          {u.displayName ? u.displayName.slice(0, 2).toUpperCase() : u.email.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-neutral-900 dark:text-white text-sm">
                              {u.displayName || u.email}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              u.departmentId === 'admin'
                                ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300'
                                : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300'
                            }`}>
                              {u.departmentId === 'admin' ? 'Administrador' : (u.departmentId === 'viewer' ? 'Visualizador' : (DEPARTMENTS[u.departmentId as DepartmentId]?.name || u.departmentId))}
                            </span>
                            {hasCustom ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                                <Key size={10} /> Senha Individual Definida
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200 dark:bg-neutral-800 dark:text-neutral-400">
                                Senha Padrão do Setor
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                            <span>{u.email}</span>
                            {u.badgeNumber && (
                              <>
                                <span>•</span>
                                <span className="font-mono">Matrícula: {u.badgeNumber}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action to change user password */}
                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedUserForPassword(u);
                            const existing = (u as any).password || authSettings?.passwordsByUser?.[u.uid] || authSettings?.passwordsByUser?.[u.email?.toLowerCase()] || generateSecurePassword(10);
                            setUserNewPassword(existing);
                          }}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition-all flex items-center gap-1.5"
                        >
                          <Key size={13} />
                          {hasCustom ? 'Alterar Senha do Usuário' : 'Criar Senha Individual'}
                        </button>
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
      {/* ABA 3: SENHAS DOS SETORES OPERACIONAIS */}
      {/* ========================================================================= */}
      {activeSubTab === 'dept_pass' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
            <Info size={18} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div>
              <span className="font-bold">Acesso por Setor:</span> As senhas abaixo permitem o acesso direto pelos terminais ou colaboradores de cada área operacional que utilizam a autenticação por setor. Todas as senhas devem cumprir a regra de 8 caracteres, maiúscula, número e caractere especial.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Visualizador (Somente Leitura) */}
            <div className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h5 className="font-bold text-neutral-900 dark:text-white text-sm">
                      Visualizador (Auditoria / Diretoria)
                    </h5>
                    <p className="text-[11px] text-neutral-400">Acesso Somente Leitura</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const pass = generateSecurePassword(10);
                    setDeptPasswords((prev) => ({ ...prev, viewer: pass }));
                  }}
                  className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[11px] font-bold flex items-center gap-1"
                  title="Gerar senha segura"
                >
                  <Sparkles size={12} className="text-amber-500" />
                  Gerar
                </button>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <input
                    type={showDeptPass['viewer'] ? 'text' : 'password'}
                    value={deptPasswords['viewer'] || authSettings?.viewer || ''}
                    onChange={(e) => setDeptPasswords((prev) => ({ ...prev, viewer: e.target.value }))}
                    placeholder="Digite a senha do setor"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-xs outline-none focus:ring-2 focus:ring-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDeptPass((prev) => ({ ...prev, viewer: !prev['viewer'] }))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  >
                    {showDeptPass['viewer'] ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>

                {/* Validation pills */}
                {(() => {
                  const val = validatePassword(deptPasswords['viewer'] || authSettings?.viewer || '');
                  return (
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${val.hasMinLength ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>8+ chars</span>
                      <span className={`px-1.5 py-0.5 rounded ${val.hasUppercase ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>Maiúscula</span>
                      <span className={`px-1.5 py-0.5 rounded ${val.hasNumber ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>Número</span>
                      <span className={`px-1.5 py-0.5 rounded ${val.hasSymbol ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>Símbolo</span>
                    </div>
                  );
                })()}

                <button
                  type="button"
                  disabled={savingDept === 'viewer' || !validatePassword(deptPasswords['viewer'] || authSettings?.viewer || '').isValid}
                  onClick={() => handleSaveDeptPassword('viewer', deptPasswords['viewer'] || authSettings?.viewer || '')}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {savingDept === 'viewer' ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar Senha do Visualizador
                </button>
              </div>
            </div>

            {/* Setores Operacionais */}
            {Object.values(DEPARTMENTS).map((dept) => {
              const currentVal = deptPasswords[dept.id] || authSettings?.passwordsByDept?.[dept.id] || authSettings?.user || '';
              const val = validatePassword(currentVal);
              const isSavingThis = savingDept === dept.id;

              return (
                <div
                  key={dept.id}
                  className="p-5 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h5 className="font-bold text-neutral-900 dark:text-white text-sm">
                          {dept.name}
                        </h5>
                        <p className="text-[11px] text-neutral-400">Setor Operacional</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const pass = generateSecurePassword(10);
                        setDeptPasswords((prev) => ({ ...prev, [dept.id]: pass }));
                      }}
                      className="p-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 text-[11px] font-bold flex items-center gap-1"
                      title="Gerar senha segura"
                    >
                      <Sparkles size={12} className="text-amber-500" />
                      Gerar
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="relative">
                      <input
                        type={showDeptPass[dept.id] ? 'text' : 'password'}
                        value={currentVal}
                        onChange={(e) => setDeptPasswords((prev) => ({ ...prev, [dept.id]: e.target.value }))}
                        placeholder={`Senha de ${dept.name}`}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowDeptPass((prev) => ({ ...prev, [dept.id]: !prev[dept.id] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                      >
                        {showDeptPass[dept.id] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    {/* Criteria badges */}
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded ${val.hasMinLength ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>8+ chars</span>
                      <span className={`px-1.5 py-0.5 rounded ${val.hasUppercase ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>Maiúscula</span>
                      <span className={`px-1.5 py-0.5 rounded ${val.hasNumber ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>Número</span>
                      <span className={`px-1.5 py-0.5 rounded ${val.hasSymbol ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>Símbolo</span>
                    </div>

                    <button
                      type="button"
                      disabled={isSavingThis || !val.isValid}
                      onClick={() => handleSaveDeptPassword(dept.id, currentVal)}
                      className="w-full py-2 rounded-xl text-xs font-bold bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingThis ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                      Salvar Senha de {dept.name}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DEFINIR SENHA INDIVIDUAL DO USUÁRIO */}
      {/* ========================================================================= */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-black text-neutral-900 dark:text-white text-base">
                    Definir Senha do Usuário
                  </h3>
                  <p className="text-xs text-neutral-500">
                    {selectedUserForPassword.displayName || selectedUserForPassword.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUserForPassword(null)}
                className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* User summary */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700 space-y-1">
                <div className="text-[11px] font-bold text-neutral-400 uppercase">Colaborador</div>
                <div className="text-sm font-bold text-neutral-900 dark:text-white">
                  {selectedUserForPassword.displayName || selectedUserForPassword.email}
                </div>
                <div className="text-neutral-500 font-mono text-[11px]">{selectedUserForPassword.email}</div>
              </div>

              {/* Password Generator Action */}
              <div className="flex items-center justify-between">
                <label className="font-bold text-neutral-700 dark:text-neutral-200 uppercase tracking-wider block">
                  Nova Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const pass = generateSecurePassword(10);
                    setUserNewPassword(pass);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
                >
                  <Sparkles size={13} />
                  Gerar Senha Segura
                </button>
              </div>

              {/* Password Input */}
              <div className="relative">
                <input
                  type={showUserNewPass ? 'text' : 'password'}
                  value={userNewPassword}
                  onChange={(e) => setUserNewPassword(e.target.value)}
                  placeholder="Ex: Marsil@Colab2026!"
                  className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 pr-20"
                />
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowUserNewPass(!showUserNewPass)}
                    className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                  >
                    {showUserNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                  {userNewPassword && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(userNewPassword, 'user')}
                      className="p-1.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
                      title="Copiar senha"
                    >
                      {copiedUserPass ? <CheckCheck size={15} className="text-emerald-500" /> : <Copy size={15} />}
                    </button>
                  )}
                </div>
              </div>

              {/* Live Criteria Check */}
              <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-700 space-y-2">
                <span className="text-[11px] font-bold text-neutral-400 uppercase block">
                  Regras de Validação:
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className={`flex items-center gap-1.5 ${userValidation.hasMinLength ? 'text-emerald-600 font-bold' : 'text-neutral-400'}`}>
                    {userValidation.hasMinLength ? <Check size={13} /> : <X size={13} />}
                    <span>8+ caracteres</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${userValidation.hasUppercase ? 'text-emerald-600 font-bold' : 'text-neutral-400'}`}>
                    {userValidation.hasUppercase ? <Check size={13} /> : <X size={13} />}
                    <span>1 Maiúscula</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${userValidation.hasNumber ? 'text-emerald-600 font-bold' : 'text-neutral-400'}`}>
                    {userValidation.hasNumber ? <Check size={13} /> : <X size={13} />}
                    <span>1 Número</span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${userValidation.hasSymbol ? 'text-emerald-600 font-bold' : 'text-neutral-400'}`}>
                    {userValidation.hasSymbol ? <Check size={13} /> : <X size={13} />}
                    <span>1 Símbolo (!@#$)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={savingUserPass}
                onClick={() => setSelectedUserForPassword(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingUserPass || !userValidation.isValid}
                onClick={handleSaveUserPassword}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-1.5"
              >
                {savingUserPass && <RefreshCw size={12} className="animate-spin" />}
                {savingUserPass ? 'Salvando...' : 'Salvar Senha do Usuário'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CADASTRAR NOVO USUÁRIO COM SENHA */}
      {/* ========================================================================= */}
      {isCreateUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <UserPlus size={20} />
                </div>
                <div>
                  <h3 className="font-black text-neutral-900 dark:text-white text-base">
                    Cadastrar Novo Usuário
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Crie o perfil com departamento, cargo e credencial de acesso
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateUserModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-700"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={newUserData.displayName}
                  onChange={(e) => setNewUserData({ ...newUserData, displayName: e.target.value })}
                  placeholder="Ex: Carlos Oliveira"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                    E-mail Corporativo
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    placeholder="carlos@marsillog.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                    Matrícula / Crachá
                  </label>
                  <input
                    type="text"
                    value={newUserData.badgeNumber}
                    onChange={(e) => setNewUserData({ ...newUserData, badgeNumber: e.target.value })}
                    placeholder="Ex: 10452"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                    Departamento de Lotação
                  </label>
                  <select
                    value={newUserData.departmentId}
                    onChange={(e) => setNewUserData({ ...newUserData, departmentId: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="admin">Administração</option>
                    <option value="viewer">Visualizador (Diretoria)</option>
                    {Object.values(DEPARTMENTS).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase mb-1">
                    Papel RBAC
                  </label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as any })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="operator">Operador / Conferente</option>
                    <option value="manager">Gestor / Supervisor</option>
                    <option value="admin">Super Administrador</option>
                    <option value="viewer">Visualizador (Somente Leitura)</option>
                  </select>
                </div>
              </div>

              {/* Password section */}
              <div className="pt-2 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300 uppercase">
                    Senha Obrigatória
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const pass = generateSecurePassword(10);
                      setNewUserData({ ...newUserData, password: pass });
                    }}
                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold flex items-center gap-1"
                  >
                    <Sparkles size={13} />
                    Gerar Senha
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showCreateUserPass ? 'text' : 'password'}
                    required
                    value={newUserData.password}
                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                    placeholder="Ex: Marsil@Colab2026!"
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-mono text-sm outline-none focus:ring-2 focus:ring-indigo-500 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCreateUserPass(!showCreateUserPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                  >
                    {showCreateUserPass ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {/* Validation pills */}
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <span className={`px-1.5 py-0.5 rounded ${createValidation.hasMinLength ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500'}`}>8+ chars</span>
                  <span className={`px-1.5 py-0.5 rounded ${createValidation.hasUppercase ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500'}`}>Maiúscula</span>
                  <span className={`px-1.5 py-0.5 rounded ${createValidation.hasNumber ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500'}`}>Número</span>
                  <span className={`px-1.5 py-0.5 rounded ${createValidation.hasSymbol ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500'}`}>Símbolo</span>
                </div>
              </div>

              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-end gap-2 -mx-6 -mb-6 mt-4">
                <button
                  type="button"
                  disabled={isCreatingUser}
                  onClick={() => setIsCreateUserModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isCreatingUser || !createValidation.isValid}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30 disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isCreatingUser && <RefreshCw size={12} className="animate-spin" />}
                  {isCreatingUser ? 'Criando Usuário...' : 'Cadastrar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
