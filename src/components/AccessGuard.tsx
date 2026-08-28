import React from 'react';
import { ShieldAlert, ArrowLeft, Lock, CheckCircle2, UserCheck, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import { checkTabAccess, getDepartmentName } from '../utils/permissions';

interface AccessGuardProps {
  activeTab: string;
  profile: UserProfile | null | undefined;
  onRedirect: (tabId: string) => void;
  children: React.ReactNode;
}

export function AccessGuard({ activeTab, profile, onRedirect, children }: AccessGuardProps) {
  const accessCheck = checkTabAccess(activeTab, profile);

  if (accessCheck.authorized) {
    return <>{children}</>;
  }

  const userDept = profile?.departmentId;
  const permission = accessCheck.permission;
  const myDepartmentTab = userDept === 'admin' || userDept === 'viewer' ? 'dashboard' : (userDept || 'dashboard');

  return (
    <div className="w-full max-w-4xl mx-auto py-12 px-4 animate-fadeIn">
      <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-xl overflow-hidden">
        {/* Top warning header */}
        <div className="bg-rose-500 text-white p-6 sm:p-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 backdrop-blur-md rounded-2xl">
              <ShieldAlert className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-white/20 uppercase tracking-wide">
                  HTTP 403 Forbidden
                </span>
                <span className="text-xs font-semibold text-rose-100 flex items-center gap-1">
                  <Lock size={12} /> Camada de Segurança Ativa
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black mt-1">
                Acesso Restrito ao Módulo
              </h2>
            </div>
          </div>
        </div>

        {/* Content body */}
        <div className="p-6 sm:p-10 space-y-8">
          <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl p-5 border border-neutral-200 dark:border-neutral-700/60 space-y-3">
            <p className="text-sm sm:text-base text-neutral-700 dark:text-neutral-200 font-medium">
              {accessCheck.reason || 'Você não possui privilégios suficientes para acessar esta área.'}
            </p>
            {permission && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                <strong>Módulo solicitado:</strong> {permission.name} • {permission.description}
              </p>
            )}
          </div>

          {/* Credentials comparison grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                <UserCheck size={16} className="text-blue-500" />
                Sua Credencial Atual
              </div>
              <div className="text-base font-bold text-neutral-900 dark:text-white">
                {getDepartmentName(userDept)}
              </div>
              <div className="text-xs text-neutral-500 mt-1">
                Identificação: {profile?.displayName || profile?.email || 'Usuário Autenticado'}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                <ShieldCheck size={16} className="text-emerald-500" />
                Perfis Autorizados
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {permission?.allowedDepartments.map((allowed) => (
                  <span
                    key={allowed}
                    className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700"
                  >
                    {getDepartmentName(allowed)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-4 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center sm:text-left">
              Precisa de acesso? Solicite alteração de perfil ao Gestor / Administrador de TI.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onRedirect('dashboard')}
                className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft size={16} />
                Dashboard Geral
              </button>

              {userDept && userDept !== 'admin' && userDept !== 'viewer' && userDept !== activeTab && (
                <button
                  type="button"
                  onClick={() => onRedirect(myDepartmentTab)}
                  className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-600/30 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={16} />
                  Ir para Meu Setor ({getDepartmentName(userDept)})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
