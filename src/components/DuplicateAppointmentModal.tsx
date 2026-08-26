import React, { useState, useMemo } from 'react';
import { ReceivingAppointment } from '../types';
import { 
  Copy, 
  Calendar, 
  Clock, 
  Package, 
  Building2, 
  Truck, 
  DollarSign, 
  Plus, 
  Trash2, 
  X, 
  Check, 
  Sparkles, 
  Layers, 
  ArrowRight,
  RotateCw,
  Edit3,
  CalendarDays
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DuplicateAppointmentModalProps {
  isOpen: boolean;
  appointment: ReceivingAppointment | null;
  onClose: () => void;
  onConfirmDuplicate: (duplicates: Array<Omit<ReceivingAppointment, 'id' | 'createdAt'>>) => Promise<void>;
  onOpenInForm: (appointmentData: Partial<ReceivingAppointment>) => void;
}

export function DuplicateAppointmentModal({
  isOpen,
  appointment,
  onClose,
  onConfirmDuplicate,
  onOpenInForm
}: DuplicateAppointmentModalProps) {
  if (!isOpen || !appointment) return null;

  // Calculate default next date (+7 days from original, or tomorrow if original is in the past)
  const calculateDefaultDate = () => {
    const baseDate = appointment.date ? new Date(appointment.date + 'T00:00:00') : new Date();
    const nextWeek = new Date(baseDate);
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  };

  const [mode, setMode] = useState<'single' | 'multiple'>('single');
  const [singleDate, setSingleDate] = useState<string>(calculateDefaultDate());
  const [singleTime, setSingleTime] = useState<string>(appointment.scheduledTime || '08:00');
  const [orderNumber, setOrderNumber] = useState<string>(appointment.orderNumber || '');
  const [orderSuffixOption, setOrderSuffixOption] = useState<'same' | 'suffix' | 'custom'>('same');
  const [pallets, setPallets] = useState<number | string>(appointment.pallets ?? '');
  const [totalValue, setTotalValue] = useState<number | string>(appointment.totalValue ?? '');
  const [observation, setObservation] = useState<string>(appointment.observation || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Multiple dates state
  const [multipleDates, setMultipleDates] = useState<string[]>([calculateDefaultDate()]);
  const [newDateInput, setNewDateInput] = useState<string>('');

  // Helpers for quick date shifts
  const applyQuickDateShift = (daysToAdd: number) => {
    const base = appointment.date ? new Date(appointment.date + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + daysToAdd);
    const formatted = base.toISOString().split('T')[0];
    setSingleDate(formatted);
  };

  const applyQuickMonthShift = (monthsToAdd: number) => {
    const base = appointment.date ? new Date(appointment.date + 'T00:00:00') : new Date();
    base.setMonth(base.getMonth() + monthsToAdd);
    const formatted = base.toISOString().split('T')[0];
    setSingleDate(formatted);
  };

  // Generate weekly dates in month
  const generateWeeklyDates = (weeksCount: number) => {
    const base = appointment.date ? new Date(appointment.date + 'T00:00:00') : new Date();
    const dates: string[] = [];
    for (let i = 1; i <= weeksCount; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + (i * 7));
      dates.push(d.toISOString().split('T')[0]);
    }
    setMultipleDates(dates);
  };

  // Add custom date to multiple list
  const handleAddMultipleDate = () => {
    if (!newDateInput) return;
    if (!multipleDates.includes(newDateInput)) {
      setMultipleDates([...multipleDates, newDateInput].sort());
    }
    setNewDateInput('');
  };

  const handleRemoveMultipleDate = (dateToRemove: string) => {
    setMultipleDates(multipleDates.filter(d => d !== dateToRemove));
  };

  // Format date helper with weekday
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      return d.toLocaleDateString('pt-BR', { 
        weekday: 'short', 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      const targets = mode === 'single' ? [singleDate] : multipleDates;
      if (targets.length === 0) {
        alert('Selecione pelo menos uma data para duplicar.');
        setIsSubmitting(false);
        return;
      }

      const duplicatePayloads: Array<Omit<ReceivingAppointment, 'id' | 'createdAt'>> = targets.map((targetDate, idx) => {
        let finalOrderNumber = orderNumber;
        if (orderSuffixOption === 'suffix') {
          finalOrderNumber = orderNumber ? `${orderNumber}-${idx + 2}` : '';
        }

        return {
          date: targetDate,
          creationDate: new Date().toISOString().split('T')[0],
          staff: appointment.staff || '',
          requester: appointment.requester || '',
          contact: appointment.contact || '',
          orderNumber: finalOrderNumber,
          supplier: appointment.supplier || '',
          vehicle: appointment.vehicle || 'Carreta',
          pallets: pallets === '' ? 0 : Number(pallets),
          scheduledTime: singleTime || appointment.scheduledTime || '08:00',
          observation: observation,
          collaborator: appointment.collaborator || 'Michael',
          receivingLocation: appointment.receivingLocation || 'Marsil',
          receivingType: appointment.receivingType || 'Recebimento',
          status: 'Agendado' as const,
          totalValue: totalValue === '' ? 0 : Number(totalValue),
          paymentTerm: appointment.paymentTerm || '30 dias'
        };
      });

      await onConfirmDuplicate(duplicatePayloads);
      onClose();
    } catch (err) {
      console.error('Error duplicating appointments:', err);
      alert('Erro ao duplicar agendamento. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenFormAndClose = () => {
    onOpenInForm({
      date: singleDate,
      creationDate: new Date().toISOString().split('T')[0],
      staff: appointment.staff || '',
      requester: appointment.requester || '',
      contact: appointment.contact || '',
      orderNumber: orderNumber,
      supplier: appointment.supplier || '',
      vehicle: appointment.vehicle || 'Carreta',
      pallets: pallets === '' ? 0 : Number(pallets),
      scheduledTime: singleTime,
      observation: observation,
      collaborator: appointment.collaborator || 'Michael',
      receivingLocation: appointment.receivingLocation,
      receivingType: appointment.receivingType,
      status: 'Agendado',
      totalValue: totalValue === '' ? 0 : Number(totalValue),
      paymentTerm: appointment.paymentTerm
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden my-6 flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-inner">
              <Copy size={20} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-white">Duplicar Agendamento</h3>
                <span className="bg-white/25 text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full tracking-wider">
                  Agilidade Operacional
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                Duplique e altere a data para entregas recorrentes no mês
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Card Resumo do Agendamento Original */}
          <div className="bg-neutral-50 dark:bg-neutral-800/80 rounded-2xl p-4 border border-neutral-200/80 dark:border-neutral-700 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-200/70 dark:border-neutral-700/70 pb-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-600 dark:text-emerald-400" />
                Agendamento Base Selecionado
              </span>
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                Data Original: <strong className="text-neutral-900 dark:text-white">{appointment.date ? appointment.date.split('-').reverse().join('/') : '-'}</strong> às {appointment.scheduledTime || '--:--'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 block">FORNECEDOR</span>
                <span className="font-black text-neutral-900 dark:text-white truncate block" title={appointment.supplier}>
                  {appointment.supplier || 'Não informado'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 block">PEDIDO</span>
                <span className="font-black text-blue-600 dark:text-blue-400 truncate block">
                  {appointment.orderNumber || '-'}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 block">VEÍCULO / PALETES</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {appointment.vehicle || 'Carreta'} • {appointment.pallets || 0} paletes
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 block">LOCAL / TIPO</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">
                  {appointment.receivingLocation || 'Marsil'} ({appointment.receivingType || 'Recebimento'})
                </span>
              </div>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex p-1 bg-neutral-100 dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                mode === 'single'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-neutral-200/60 dark:border-neutral-700'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <Calendar size={14} />
              Duplicar para Nova Data
            </button>
            <button
              type="button"
              onClick={() => setMode('multiple')}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 ${
                mode === 'multiple'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm border border-neutral-200/60 dark:border-neutral-700'
                  : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
              }`}
            >
              <Layers size={14} />
              Múltiplas Datas no Mês (Recorrente)
            </button>
          </div>

          {/* MODE 1: SINGLE DATE */}
          {mode === 'single' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-extrabold uppercase text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-emerald-600" />
                    Nova Data da Entrega *
                  </span>
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    {formatDateDisplay(singleDate)}
                  </span>
                </label>
                <input
                  type="date"
                  required
                  value={singleDate}
                  onChange={e => setSingleDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-emerald-500/50 dark:border-emerald-600/50 bg-emerald-50/20 dark:bg-emerald-950/20 text-neutral-900 dark:text-white text-sm font-bold outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Quick Shift Buttons */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block">
                  Atalhos Rápidos de Data:
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <button
                    type="button"
                    onClick={() => applyQuickDateShift(1)}
                    className="px-2.5 py-1.5 bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-bold transition-all border border-neutral-200 dark:border-neutral-700 text-center"
                  >
                    +1 Dia
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateShift(7)}
                    className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl text-xs font-black transition-all border border-emerald-200 dark:border-emerald-800 text-center"
                  >
                    +7 Dias (Próx. Semana)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateShift(14)}
                    className="px-2.5 py-1.5 bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-bold transition-all border border-neutral-200 dark:border-neutral-700 text-center"
                  >
                    +14 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateShift(21)}
                    className="px-2.5 py-1.5 bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-bold transition-all border border-neutral-200 dark:border-neutral-700 text-center"
                  >
                    +21 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickDateShift(28)}
                    className="px-2.5 py-1.5 bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 rounded-xl text-xs font-bold transition-all border border-neutral-200 dark:border-neutral-700 text-center"
                  >
                    +28 Dias
                  </button>
                  <button
                    type="button"
                    onClick={() => applyQuickMonthShift(1)}
                    className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 rounded-xl text-xs font-black transition-all border border-purple-200 dark:border-purple-800 text-center"
                  >
                    +1 Mês
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MODE 2: MULTIPLE DATES RECURRENCE */}
          {mode === 'multiple' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-extrabold uppercase text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <CalendarDays size={14} className="text-emerald-600" />
                    Gerar Recorrência Semanal no Mês
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => generateWeeklyDates(2)}
                    className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCw size={13} />
                    Próximas 2 Semanas
                  </button>
                  <button
                    type="button"
                    onClick={() => generateWeeklyDates(3)}
                    className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCw size={13} />
                    Próximas 3 Semanas
                  </button>
                  <button
                    type="button"
                    onClick={() => generateWeeklyDates(4)}
                    className="py-2 px-3 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5"
                  >
                    <RotateCw size={13} />
                    Mês Completo (4 Semanas)
                  </button>
                </div>
              </div>

              {/* Add custom date */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-500 dark:text-neutral-400">
                  Ou adicione datas específicas à lista:
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={newDateInput}
                    onChange={e => setNewDateInput(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddMultipleDate}
                    disabled={!newDateInput}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all"
                  >
                    <Plus size={14} />
                    Adicionar Data
                  </button>
                </div>
              </div>

              {/* Selected Dates List */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block">
                  Datas Selecionadas ({multipleDates.length} novas cópias):
                </span>
                {multipleDates.length === 0 ? (
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-xs text-amber-800 dark:text-amber-300 text-center font-medium">
                    Nenhuma data selecionada. Adicione datas acima para duplicar.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto custom-scrollbar p-1">
                    {multipleDates.map(dateStr => (
                      <div
                        key={dateStr}
                        className="flex items-center justify-between px-3 py-2 bg-white dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-black text-neutral-900 dark:text-white">
                            {dateStr.split('-').reverse().join('/')}
                          </span>
                          <span className="text-[10px] text-neutral-400 capitalize">
                            ({formatDateDisplay(dateStr).split(',')[0]})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMultipleDate(dateStr)}
                          className="p-1 text-neutral-400 hover:text-red-600 transition-colors"
                          title="Remover data"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detalhes Ajustáveis do Agendamento Duplicado */}
          <div className="border-t border-neutral-200/80 dark:border-neutral-800 pt-4 space-y-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-600 dark:text-neutral-300 block">
              Ajustes Opcionais nas Cópias:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Horário */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                  <Clock size={12} className="text-emerald-600" />
                  Horário
                </label>
                <input
                  type="time"
                  value={singleTime}
                  onChange={e => setSingleTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Pedido */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                  <Package size={12} className="text-blue-600" />
                  Número do Pedido
                </label>
                <input
                  type="text"
                  placeholder="Nº Pedido"
                  value={orderNumber}
                  onChange={e => setOrderNumber(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Paletes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 flex items-center gap-1">
                  <Truck size={12} className="text-purple-600" />
                  Qtd. Paletes
                </label>
                <input
                  type="number"
                  placeholder="Paletes"
                  value={pallets}
                  onChange={e => setPallets(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-bold text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400">
                Observações Adicionais
              </label>
              <input
                type="text"
                placeholder="Ex: Entrega semanal programada..."
                value={observation}
                onChange={e => setObservation(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs font-medium text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-5 bg-neutral-50 dark:bg-neutral-900/90 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenFormAndClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition-all flex items-center justify-center gap-1.5"
            title="Abre o formulário principal com todos os dados copiados para fazer alterações avançadas"
          >
            <Edit3 size={14} />
            Editar Cópia no Formulário
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isSubmitting || (mode === 'multiple' && multipleDates.length === 0)}
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Check size={16} />
              {isSubmitting
                ? 'Duplicando...'
                : mode === 'single'
                ? `Duplicar para ${singleDate ? singleDate.split('-').reverse().join('/') : 'Data'}`
                : `Duplicar para ${multipleDates.length} ${multipleDates.length === 1 ? 'Data' : 'Datas'}`}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
