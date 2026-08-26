import React, { useState, useEffect } from 'react';
import { MessageSquare, X, Sparkles, Check, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface OccurrenceCommentBalloonProps {
  onExplore?: () => void;
  className?: string;
  variant?: 'floating' | 'banner' | 'card';
}

const STORAGE_KEY = 'marsil_occurrence_comments_balloon_seen_v1';

export function OccurrenceCommentBalloon({ 
  onExplore, 
  className = '',
  variant = 'banner' 
}: OccurrenceCommentBalloonProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      setIsVisible(true);
      setIsDismissed(false);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
  };

  const handleReopen = () => {
    setIsVisible(true);
    setIsDismissed(false);
  };

  if (isDismissed && !isVisible) {
    return (
      <button
        onClick={handleReopen}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 transition-all shadow-xs"
        title="Ver novidade sobre comentários"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
        <MessageSquare size={12} className="text-blue-600 dark:text-blue-400" />
        <span>Novo: Comentários</span>
      </button>
    );
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: -6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -6 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className={`relative z-20 ${className}`}
        >
          {/* Balloon Container with tail pointer */}
          <div className="relative p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white shadow-xl shadow-blue-500/20 border border-blue-400/30 overflow-hidden">
            {/* Ambient shine */}
            <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
            
            {/* Balloon tail pointer */}
            <div className="absolute -top-2 left-6 w-4 h-4 bg-blue-600 rotate-45 border-l border-t border-blue-400/30 -z-10 hidden sm:block" />

            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 shadow-inner">
                  <MessageSquare size={17} className="text-white animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 bg-white/20 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                      <Sparkles size={10} />
                      Nova Função
                    </span>
                    <h4 className="font-bold text-xs sm:text-sm text-white">
                      Comentários nas Ocorrências
                    </h4>
                  </div>
                  <p className="text-[11px] sm:text-xs text-blue-100 mt-1 leading-relaxed">
                    Agora é possível comentar, alinhar resoluções e enviar atualizações diretamente em qualquer ocorrência registrada no sistema!
                  </p>
                </div>
              </div>

              <button
                onClick={handleDismiss}
                className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                title="Fechar aviso"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-3 pt-2.5 border-t border-white/15 flex items-center justify-between text-[11px]">
              <span className="text-blue-200 text-[10px]">
                💡 Clique em qualquer ocorrência para ver e enviar comentários.
              </span>
              <button
                onClick={handleDismiss}
                className="font-bold text-white hover:text-blue-100 underline decoration-white/40 text-[11px] flex items-center gap-1 transition-colors"
              >
                Entendi
                <ArrowRight size={11} />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
