import React, { useState, useMemo } from 'react';
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  AlertTriangle,
  Info,
  CheckCircle2,
  Volume2,
  VolumeX,
  Search,
  ArrowRight,
  Radio,
  Pin,
  ExternalLink,
  Shield,
  Building2,
  Clock,
  Sparkles,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SystemNotification, UserProfile } from '../types';
import {
  formatNotificationRelativeTime,
  playNotificationSound,
  requestBrowserNotificationPermission
} from '../utils/notificationService';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: SystemNotification[];
  unreadCount: number;
  unreadCriticalCount: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onMarkAsRead: (id: string) => Promise<void>;
  onMarkAllAsRead: () => Promise<void>;
  onDeleteNotification: (id: string) => Promise<void>;
  onNavigateTab: (tabId: string, params?: any) => void;
  onOpenBroadcastModal: () => void;
  currentUserProfile: UserProfile | null;
}

type TabFilter = 'all' | 'unread' | 'critical' | 'broadcasts' | 'ops';

export function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  unreadCount,
  unreadCriticalCount,
  isMuted,
  onToggleMute,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onNavigateTab,
  onOpenBroadcastModal,
  currentUserProfile
}: NotificationCenterProps) {
  const [activeFilter, setActiveFilter] = useState<TabFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission>(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';
  });

  const userKey = currentUserProfile?.uid || currentUserProfile?.email || currentUserProfile?.departmentId || 'anonymous';
  const isAdminOrManager = currentUserProfile?.departmentId === 'admin' || currentUserProfile?.role === 'admin' || currentUserProfile?.role === 'manager';

  const handleRequestDesktopPermission = async () => {
    const res = await requestBrowserNotificationPermission();
    setDesktopPermission(res);
  };

  const filteredList = useMemo(() => {
    let result = notifications;

    // Filter by tab
    if (activeFilter === 'unread') {
      result = result.filter(n => !n.readBy || !n.readBy.includes(userKey));
    } else if (activeFilter === 'critical') {
      result = result.filter(n => n.severity === 'critical' || n.type === 'critical_alert');
    } else if (activeFilter === 'broadcasts') {
      result = result.filter(n => n.type === 'broadcast' || n.isPinned);
    } else if (activeFilter === 'ops') {
      result = result.filter(n => ['occurrence', 'receiving_schedule', 'inventory', 'vehicle_fleet'].includes(n.type));
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.message.toLowerCase().includes(q) ||
        n.createdBy?.name?.toLowerCase().includes(q)
      );
    }

    return result;
  }, [notifications, activeFilter, searchQuery, userKey]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        onClick={onClose} 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40"
      />

      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.98 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.98 }}
        transition={{ duration: 0.2 }}
        className="fixed top-16 right-4 sm:right-6 w-[94vw] sm:w-[460px] max-h-[85vh] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden"
      >
        {/* Header Strip */}
        <div className="p-4 sm:p-5 border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/50 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <Bell size={18} />
                </div>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center shadow-xs">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 dark:text-white text-sm leading-tight flex items-center gap-2">
                  Central de Notificações
                  {unreadCriticalCount > 0 && (
                    <span className="bg-rose-500 text-white text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full animate-pulse">
                      {unreadCriticalCount} {unreadCriticalCount === 1 ? 'Crítico' : 'Críticos'}
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  Alertas operacionais em tempo real
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleMute}
                title={isMuted ? 'Ativar avisos sonoros' : 'Silenciar avisos sonoros'}
                className={`p-2 rounded-xl text-xs transition-colors ${
                  isMuted
                    ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500'
                    : 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 hover:bg-blue-100'
                }`}
              >
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>

              {isAdminOrManager && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBroadcastModal();
                  }}
                  title="Transmitir alerta operacional para a equipe"
                  className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition-colors flex items-center gap-1"
                >
                  <Radio size={15} className="animate-pulse" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 rounded-xl transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Desktop Notification Banner Prompt (if default) */}
          {desktopPermission === 'default' && (
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[11px] text-blue-800 dark:text-blue-300">
                <Sparkles size={14} className="shrink-0 text-blue-500" />
                <span>Deseja receber alertas sonoros na área de trabalho?</span>
              </div>
              <button
                type="button"
                onClick={handleRequestDesktopPermission}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shrink-0 transition-colors"
              >
                Permitir
              </button>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar em notificações..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Tabs Filter Bar */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'all'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Todas ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                activeFilter === 'unread'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Não lidas
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px]">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('critical')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 ${
                activeFilter === 'critical'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
              }`}
            >
              <AlertTriangle size={12} />
              Críticos ({notifications.filter(n => n.severity === 'critical').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('broadcasts')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'broadcasts'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Avisos
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('ops')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                activeFilter === 'ops'
                  ? 'bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 shadow-xs'
                  : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              Operação
            </button>
          </div>
        </div>

        {/* Notifications Scroll List */}
        <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 p-2 space-y-1">
          {filteredList.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 size={24} />
              </div>
              <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-200 mb-1">
                Tudo em dia!
              </h4>
              <p className="text-xs text-neutral-400 max-w-xs mx-auto">
                {activeFilter === 'unread'
                  ? 'Você já visualizou todos os alertas recentes.'
                  : 'Nenhuma notificação encontrada para este filtro.'}
              </p>
            </div>
          ) : (
            filteredList.map((notif) => {
              const isRead = notif.readBy && notif.readBy.includes(userKey);
              const isCritical = notif.severity === 'critical';
              const isWarning = notif.severity === 'warning';
              const isSuccess = notif.severity === 'success';

              let severityIcon = <Info size={16} className="text-blue-500" />;
              let dotColor = 'bg-blue-500';

              if (isCritical) {
                severityIcon = <AlertTriangle size={16} className="text-rose-500 animate-pulse" />;
                dotColor = 'bg-rose-500';
              } else if (isWarning) {
                severityIcon = <AlertTriangle size={16} className="text-amber-500" />;
                dotColor = 'bg-amber-500';
              } else if (isSuccess) {
                severityIcon = <CheckCircle2 size={16} className="text-emerald-500" />;
                dotColor = 'bg-emerald-500';
              }

              return (
                <div
                  key={notif.id || notif.title}
                  className={`p-3 rounded-2xl transition-all relative group ${
                    isRead
                      ? 'bg-transparent hover:bg-neutral-50 dark:hover:bg-neutral-800/60 opacity-80 hover:opacity-100'
                      : isCritical
                      ? 'bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50'
                      : 'bg-blue-50/40 dark:bg-blue-950/20 border border-blue-50 dark:border-blue-900/30 font-medium'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">{severityIcon}</div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {notif.isPinned && (
                            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-1.5 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-sm">
                              <Pin size={9} /> Fixado
                            </span>
                          )}
                          <h4 className={`text-xs font-bold truncate ${isRead ? 'text-neutral-800 dark:text-neutral-200' : 'text-neutral-900 dark:text-white'}`}>
                            {notif.title}
                          </h4>
                        </div>

                        <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0 flex items-center gap-1">
                          <Clock size={10} />
                          {formatNotificationRelativeTime(notif.timestamp || notif.createdAtClient)}
                        </span>
                      </div>

                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed line-clamp-2">
                        {notif.message}
                      </p>

                      {/* Footer tags and Actions */}
                      <div className="mt-2.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {notif.targetDepartment && notif.targetDepartment !== 'all' ? (
                            <span className="text-[10px] font-semibold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <Building2 size={10} />
                              {notif.targetDepartment}
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500">
                              📢 Geral
                            </span>
                          )}

                          {notif.createdBy?.name && (
                            <span className="text-[10px] text-neutral-400">
                              por {notif.createdBy.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          {notif.linkTab && (
                            <button
                              type="button"
                              onClick={() => {
                                if (notif.id && !isRead) onMarkAsRead(notif.id);
                                onClose();
                                onNavigateTab(notif.linkTab!, notif.linkParams);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors"
                            >
                              <span>{notif.actionLabel || 'Acessar'}</span>
                              <ArrowRight size={11} />
                            </button>
                          )}

                          {!isRead && notif.id && (
                            <button
                              type="button"
                              onClick={() => onMarkAsRead(notif.id!)}
                              title="Marcar como lida"
                              className="p-1 text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          )}

                          {isAdminOrManager && notif.id && (
                            <button
                              type="button"
                              onClick={() => onDeleteNotification(notif.id!)}
                              title="Excluir notificação"
                              className="p-1 text-neutral-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Footer Actions */}
        <div className="p-3 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={() => playNotificationSound('info')}
            className="text-[11px] font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 flex items-center gap-1.5"
          >
            <Volume2 size={13} />
            Testar Som
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <CheckCheck size={14} />
              Marcar todas como lidas
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
