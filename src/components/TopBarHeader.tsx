import React from 'react';
import {
  Menu,
  Bell,
  Radio,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Truck,
  Activity,
  Shield,
  User as UserIcon,
  ChevronRight,
  Boxes,
  Kanban,
  FileSpreadsheet,
  Car,
  HardHat,
  Settings as SettingsIcon,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';

interface TopBarHeaderProps {
  activeTab: string;
  onOpenMobileMenu: () => void;
  unreadCount: number;
  unreadCriticalCount: number;
  onOpenNotificationCenter: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenBroadcastModal: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
  profile: UserProfile | null;
}

const TAB_METADATA: Record<string, { label: string; category: string; icon: React.ComponentType<any> }> = {
  dashboard: { label: 'Visão Geral & Indicadores', category: 'Geral', icon: Activity },
  recebimento: { label: 'Agenda de Recebimento', category: 'Operação & Turnos', icon: FileSpreadsheet },
  estoque: { label: 'Estoque & Armazenagem', category: 'Operação & Turnos', icon: Boxes },
  romaneio_tarde: { label: 'Romaneio Tarde', category: 'Operação & Turnos', icon: Truck },
  romaneio_noturno: { label: 'Romaneio Noturno', category: 'Operação & Turnos', icon: Truck },
  veiculos: { label: 'Frota & Veículos', category: 'Operação & Turnos', icon: Car },
  exp_loja: { label: 'Expedição Loja', category: 'Operação & Turnos', icon: Truck },
  boraceia: { label: 'Transbordo Boracéia', category: 'Operação & Turnos', icon: Truck },
  projetos: { label: 'Projetos & Tarefas Kanban', category: 'Gestão & Segurança', icon: Kanban },
  inventario_geral: { label: 'Inventário Geral WMS', category: 'Gestão & Segurança', icon: Boxes },
  cipa: { label: 'CIPA & Segurança do Trabalho', category: 'Gestão & Segurança', icon: HardHat },
  audit_logs: { label: 'Trilha de Auditoria (Logs)', category: 'Gestão & Segurança', icon: Shield },
  settings: { label: 'Configurações do Sistema', category: 'Sistema', icon: SettingsIcon },
};

export function TopBarHeader({
  activeTab,
  onOpenMobileMenu,
  unreadCount,
  unreadCriticalCount,
  onOpenNotificationCenter,
  isMuted,
  onToggleMute,
  onOpenBroadcastModal,
  isDarkMode,
  onToggleDarkMode,
  profile
}: TopBarHeaderProps) {
  const currentMeta = TAB_METADATA[activeTab] || {
    label: activeTab,
    category: 'Módulo',
    icon: Activity
  };
  const IconComponent = currentMeta.icon;
  const isAdminOrManager = profile?.departmentId === 'admin' || profile?.role === 'admin' || profile?.role === 'manager';

  return (
    <header className="sticky top-0 z-30 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-neutral-100 dark:border-neutral-800 transition-colors duration-200">
      <div className="px-4 sm:px-8 py-3 flex items-center justify-between gap-4">
        {/* Left Side: Mobile Menu Button & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
          >
            <Menu size={20} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="hidden sm:flex w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 items-center justify-center shrink-0">
              <IconComponent size={16} />
            </div>
            <div className="min-w-0">
              <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                <span>{currentMeta.category}</span>
                <ChevronRight size={10} />
                <span className="text-neutral-600 dark:text-neutral-300 truncate">Marsil Log</span>
              </div>
              <h2 className="text-sm sm:text-base font-black tracking-tight text-neutral-900 dark:text-white truncate leading-tight">
                {currentMeta.label}
              </h2>
            </div>
          </div>
        </div>

        {/* Right Side: Live Indicator, Broadcast Button, Audio Toggle, Notification Bell, Theme & Profile */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Live Status Indicator */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
              Ao Vivo
            </span>
          </div>

          {/* Broadcast Quick Action (Admin/Manager) */}
          {isAdminOrManager && (
            <button
              type="button"
              onClick={onOpenBroadcastModal}
              title="Transmitir alerta operacional para a equipe"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 text-xs font-bold transition-all shadow-xs"
            >
              <Radio size={14} className="text-amber-600 dark:text-amber-400 animate-pulse" />
              <span>Novo Alerta</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={onToggleMute}
            title={isMuted ? 'Ativar avisos sonoros' : 'Silenciar avisos sonoros'}
            className={`p-2 rounded-xl border transition-all ${
              isMuted
                ? 'border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-500 hover:text-neutral-700'
                : 'border-blue-100 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
            }`}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Notification Bell Button */}
          <button
            type="button"
            onClick={onOpenNotificationCenter}
            title="Abrir Central de Notificações"
            className="relative p-2 rounded-xl border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 transition-all hover:scale-105"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span
                className={`absolute -top-1 -right-1 px-1.5 min-w-[18px] h-[18px] rounded-full text-white text-[10px] font-black flex items-center justify-center shadow-sm ${
                  unreadCriticalCount > 0
                    ? 'bg-rose-600 animate-bounce shadow-rose-500/50'
                    : 'bg-blue-600 shadow-blue-500/50'
                }`}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* Dark Mode Quick Switch */}
          <button
            type="button"
            onClick={onToggleDarkMode}
            title={isDarkMode ? 'Modo Claro' : 'Modo Escuro'}
            className="hidden sm:flex p-2 text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
          >
            {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          {/* User Profile Pill */}
          <div className="hidden md:flex items-center gap-2 pl-2 border-l border-neutral-100 dark:border-neutral-800">
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
              {profile?.displayName?.charAt(0) || <UserIcon size={14} />}
            </div>
            <div className="text-left leading-none">
              <p className="text-xs font-bold text-neutral-900 dark:text-white truncate max-w-[110px]">
                {profile?.displayName}
              </p>
              <p className="text-[10px] text-neutral-400 dark:text-neutral-500 capitalize">
                {profile?.departmentId === 'admin' ? 'Admin' : profile?.departmentId}
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
