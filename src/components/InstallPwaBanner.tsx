import React, { useState } from 'react';
import { Download, X, Smartphone, Sparkles, Share2, PlusSquare, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InstallPwaBannerProps {
  canInstall: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  onInstall: () => Promise<boolean>;
  onDismiss: () => void;
}

export function InstallPwaBanner({
  canInstall,
  isIOS,
  isStandalone,
  onInstall,
  onDismiss
}: InstallPwaBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  // If already running standalone or manually dismissed, do not show
  if (isStandalone || isDismissed) return null;
  if (!canInstall && !isIOS) return null;

  return (
    <>
      <div className="fixed bottom-16 sm:bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-40">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20 }}
          className="bg-neutral-900/95 dark:bg-neutral-900/95 text-white p-4 rounded-2xl border border-neutral-700 shadow-2xl backdrop-blur-md relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500" />

          <button
            type="button"
            onClick={() => {
              setIsDismissed(true);
              onDismiss();
            }}
            className="absolute top-3 right-3 text-neutral-400 hover:text-white p-1 rounded-lg transition-colors"
          >
            <X size={16} />
          </button>

          <div className="flex items-start gap-3.5 pr-6">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-500/30">
              <Smartphone size={20} />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-blue-400">
                  App Marsil Log
                </h4>
                <span className="bg-emerald-500/20 text-emerald-300 text-[9px] font-bold px-1.5 py-0.2 rounded-sm">
                  PWA
                </span>
              </div>
              <p className="text-xs text-neutral-200 font-medium leading-relaxed">
                Instale no seu dispositivo para acesso rápido no galpão, notificações instantâneas e modo offline.
              </p>

              <div className="mt-3 flex items-center gap-2">
                {canInstall ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const success = await onInstall();
                      if (success) setIsDismissed(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    <Download size={14} />
                    Instalar Aplicativo
                  </button>
                ) : isIOS ? (
                  <button
                    type="button"
                    onClick={() => setShowIOSModal(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    <Download size={14} />
                    Como Instalar no iOS
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setIsDismissed(true)}
                  className="px-2.5 py-1.5 text-neutral-400 hover:text-neutral-200 text-xs font-medium transition-colors"
                >
                  Agora não
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* iOS Instructions Modal */}
      <AnimatePresence>
        {showIOSModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl relative text-neutral-900 dark:text-white"
            >
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="absolute top-4 right-4 p-1 rounded-lg text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
              >
                <X size={18} />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <Smartphone size={24} />
              </div>

              <h3 className="text-base font-bold mb-2">Instalar no iPhone / iPad</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                Para ter a experiência completa como aplicativo nativo no Safari iOS:
              </p>

              <ol className="space-y-3 text-xs text-neutral-700 dark:text-neutral-300 mb-6">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    1
                  </span>
                  <span>
                    Toque no botão <strong className="text-blue-600 dark:text-blue-400">Compartilhar</strong> (ícone do quadrado com seta para cima <Share2 size={12} className="inline" />) na barra do Safari.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    2
                  </span>
                  <span>
                    Role a lista para baixo e toque em <strong className="text-neutral-900 dark:text-white">Adicionar à Tela de Início</strong> (<PlusSquare size={12} className="inline" />).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 font-bold flex items-center justify-center shrink-0 text-[11px]">
                    3
                  </span>
                  <span>
                    Confirme tocando em <strong className="text-blue-600 dark:text-blue-400">Adicionar</strong> no canto superior direito.
                  </span>
                </li>
              </ol>

              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
              >
                Entendi
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
