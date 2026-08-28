import React, { useState } from 'react';
import {
  X,
  Send,
  AlertTriangle,
  Info,
  CheckCircle2,
  Radio,
  Building2,
  ArrowRight,
  Pin,
  Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DepartmentId,
  NotificationSeverity,
  UserProfile
} from '../types';
import { broadcastOperationalAlert, playNotificationSound } from '../utils/notificationService';

interface BroadcastAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
  onAlertSent?: () => void;
}

const DEPARTMENT_TARGETS: { id: DepartmentId | 'admin' | 'viewer' | 'all'; name: string }[] = [
  { id: 'all', name: '📢 Toda a Empresa (Todos os Setores)' },
  { id: 'recebimento', name: '📥 Recebimento de Cargas' },
  { id: 'estoque', name: '📦 Estoque & Armazenagem' },
  { id: 'romaneio_tarde', name: '🚚 Romaneio Tarde' },
  { id: 'romaneio_noturno', name: '🌙 Romaneio Noturno' },
  { id: 'veiculos', name: '🚛 Frota & Veículos' },
  { id: 'exp_loja', name: '🏬 Expedição Loja' },
  { id: 'boraceia', name: '🌊 Centro de Transbordo Boracéia' },
  { id: 'admin', name: '🔒 Apenas Administradores' },
];

const MODULE_LINKS = [
  { id: '', name: 'Nenhum (Apenas Comunicado)' },
  { id: 'recebimento', name: '📥 Agenda de Recebimento' },
  { id: 'estoque', name: '📦 Estoque' },
  { id: 'veiculos', name: '🚛 Frota & Veículos' },
  { id: 'projetos', name: '📋 Projetos & Kanban' },
  { id: 'inventario_geral', name: '📊 Inventário Geral' },
  { id: 'cipa', name: '🛡️ CIPA & Segurança' },
  { id: 'audit_logs', name: '🛡️ Trilha de Auditoria' },
];

export function BroadcastAlertModal({
  isOpen,
  onClose,
  currentUserProfile,
  onAlertSent
}: BroadcastAlertModalProps) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<NotificationSeverity>('warning');
  const [targetDepartment, setTargetDepartment] = useState<DepartmentId | 'admin' | 'viewer' | 'all'>('all');
  const [linkTab, setLinkTab] = useState<string>('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleTestSound = () => {
    playNotificationSound(severity);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setStatusMessage({ type: 'error', text: 'Preencha o título e a mensagem do comunicado.' });
      return;
    }

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      await broadcastOperationalAlert({
        title: title.trim(),
        message: message.trim(),
        severity,
        targetDepartment,
        linkTab: linkTab || undefined,
        isPinned,
        actorProfile: currentUserProfile
      });

      setStatusMessage({
        type: 'success',
        text: 'Alerta operacional transmitido em tempo real para todos os operadores conectados!'
      });

      // Play chime
      playNotificationSound(severity);

      setTimeout(() => {
        setTitle('');
        setMessage('');
        setSeverity('warning');
        setTargetDepartment('all');
        setLinkTab('');
        setIsPinned(false);
        setIsSubmitting(false);
        setStatusMessage(null);
        if (onAlertSent) onAlertSent();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ type: 'error', text: 'Erro ao transmitir alerta: ' + err.message });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/70 dark:bg-neutral-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Radio size={20} className="animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-bold text-neutral-900 dark:text-white leading-tight">
                Transmitir Alerta Operacional
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Notificação instantânea em tempo real com som e banner
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl flex items-center gap-3 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <AlertTriangle size={18} className="shrink-0 text-rose-600 dark:text-rose-400" />
              )}
              <span className="font-medium">{statusMessage.text}</span>
            </div>
          )}

          {/* Severity selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Nível de Urgência & Som
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSeverity('info')}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  severity === 'info'
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20 font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Info size={14} className="text-blue-500" /> Informativo
                  </span>
                </div>
                <span className="text-[10px] opacity-80">Avisos de rotina</span>
              </button>

              <button
                type="button"
                onClick={() => setSeverity('warning')}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  severity === 'warning'
                    ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 ring-2 ring-amber-500/20 font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={14} className="text-amber-500" /> Atenção
                  </span>
                </div>
                <span className="text-[10px] opacity-80">Atrasos & gargalos</span>
              </button>

              <button
                type="button"
                onClick={() => setSeverity('critical')}
                className={`p-3 rounded-2xl border text-left flex flex-col gap-1 transition-all ${
                  severity === 'critical'
                    ? 'border-rose-500 bg-rose-50/60 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/20 font-bold'
                    : 'border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle size={14} className="text-rose-500" /> Emergência
                  </span>
                </div>
                <span className="text-[10px] opacity-80">Parada ou risco alto</span>
              </button>
            </div>

            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={handleTestSound}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <Volume2 size={13} />
                Testar Som do Alerta
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              Título do Comunicado *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Pátio de Recebimento Lotado - Aguardar Doca"
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Message */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
              Mensagem Detalhada & Instruções *
            </label>
            <textarea
              required
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Descreva as instruções operacionais para as equipes..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-normal resize-none"
            />
          </div>

          {/* Destination & Target Module */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Destinatários (Público-Alvo)
              </label>
              <div className="relative">
                <select
                  value={targetDepartment}
                  onChange={(e) => setTargetDepartment(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium appearance-none"
                >
                  {DEPARTMENT_TARGETS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <Building2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-1.5">
                Atalho para Módulo (Opcional)
              </label>
              <div className="relative">
                <select
                  value={linkTab}
                  onChange={(e) => setLinkTab(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-blue-500 font-medium appearance-none"
                >
                  {MODULE_LINKS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <ArrowRight size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                <Pin size={13} className="text-amber-500" />
                Fixar no topo como Comunicado Prioritário
              </span>
            </label>
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 font-bold transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm shadow-blue-500/30 flex items-center gap-2 disabled:opacity-50"
            >
              <Send size={15} />
              {isSubmitting ? 'Transmitindo...' : 'Transmitir Alerta Agora'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
