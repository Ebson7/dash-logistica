import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi, RefreshCw, CheckCircle2, CloudOff, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OfflineStatusBannerProps {
  isOnline: boolean;
  wasOffline: boolean;
}

export function OfflineStatusBanner({ isOnline, wasOffline }: OfflineStatusBannerProps) {
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          key="offline-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 inset-x-0 z-50 bg-amber-600 dark:bg-amber-700 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between"
        >
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <div className="p-1 rounded-md bg-amber-700/60 dark:bg-amber-800/80 shrink-0">
              <WifiOff size={16} className="animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold">Modo Offline Ativo:</span>{' '}
              <span className="opacity-95">
                Você está sem conexão com a internet. O sistema continuará funcionando com cache local e os dados serão sincronizados assim que a conexão retornar.
              </span>
            </div>
            <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-amber-800 text-[10px] font-bold uppercase tracking-wider shrink-0">
              Offline
            </span>
          </div>
        </motion.div>
      )}

      {showReconnected && isOnline && (
        <motion.div
          key="online-banner"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-0 inset-x-0 z-50 bg-emerald-600 dark:bg-emerald-700 text-white px-4 py-2 text-xs font-semibold shadow-md flex items-center justify-between"
        >
          <div className="flex items-center gap-2 max-w-4xl mx-auto w-full">
            <div className="p-1 rounded-md bg-emerald-700/60 dark:bg-emerald-800/80 shrink-0">
              <Wifi size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold">Conexão restabelecida:</span>{' '}
              <span className="opacity-95">
                Você está online novamente. Sincronizando dados em tempo real com o servidor.
              </span>
            </div>
            <CheckCircle2 size={16} className="shrink-0 text-emerald-200" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
