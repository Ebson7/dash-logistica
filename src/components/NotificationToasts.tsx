import React from 'react';
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  Bell,
  X,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { SystemNotification } from '../types';

interface NotificationToastsProps {
  toasts: SystemNotification[];
  onDismiss: (id: string) => void;
  onNavigate: (tabId: string, params?: any) => void;
  onMarkAsRead: (id: string) => void;
}

export function NotificationToasts({
  toasts,
  onDismiss,
  onNavigate,
  onMarkAsRead
}: NotificationToastsProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const isCritical = toast.severity === 'critical';
          const isWarning = toast.severity === 'warning';
          const isSuccess = toast.severity === 'success';

          let icon = <Info size={18} className="text-blue-500" />;
          let borderColor = 'border-blue-200 dark:border-blue-800/80';
          let bgColor = 'bg-white/95 dark:bg-neutral-900/95';
          let accentColor = 'bg-blue-600';

          if (isCritical) {
            icon = <AlertTriangle size={18} className="text-rose-500 animate-pulse" />;
            borderColor = 'border-rose-300 dark:border-rose-800 shadow-rose-500/15';
            accentColor = 'bg-rose-600';
          } else if (isWarning) {
            icon = <AlertTriangle size={18} className="text-amber-500" />;
            borderColor = 'border-amber-300 dark:border-amber-800 shadow-amber-500/15';
            accentColor = 'bg-amber-600';
          } else if (isSuccess) {
            icon = <CheckCircle2 size={18} className="text-emerald-500" />;
            borderColor = 'border-emerald-300 dark:border-emerald-800 shadow-emerald-500/15';
            accentColor = 'bg-emerald-600';
          }

          return (
            <motion.div
              key={toast.id || toast.title}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.15 } }}
              className={`pointer-events-auto relative p-4 rounded-2xl border ${borderColor} ${bgColor} backdrop-blur-md shadow-xl overflow-hidden`}
            >
              {/* Top Accent Strip */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${accentColor}`} />

              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{icon}</div>

                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-neutral-900 dark:text-white leading-tight truncate">
                      {toast.title}
                    </h4>
                    {isCritical && (
                      <span className="shrink-0 bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 text-[9px] font-black uppercase px-1.5 py-0.2 rounded-sm animate-pulse">
                        Urgente
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-1 line-clamp-2 leading-relaxed">
                    {toast.message}
                  </p>

                  <div className="mt-2.5 flex items-center gap-2">
                    {toast.linkTab && (
                      <button
                        type="button"
                        onClick={() => {
                          if (toast.id) onMarkAsRead(toast.id);
                          if (toast.id) onDismiss(toast.id);
                          onNavigate(toast.linkTab!, toast.linkParams);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      >
                        {toast.actionLabel || 'Acessar Módulo'}
                        <ArrowRight size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (toast.id) {
                          onMarkAsRead(toast.id);
                          onDismiss(toast.id);
                        }
                      }}
                      className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors ml-auto"
                    >
                      Marcar como lida
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => toast.id && onDismiss(toast.id)}
                  className="absolute top-3 right-3 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
