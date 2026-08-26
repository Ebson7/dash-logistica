import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  setDoc, 
  addDoc, 
  doc, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { ReceivingAppointment } from '../types';
import { VEHICLE_TYPES, RECEIVING_LOCATIONS, RECEIVING_TYPES } from '../constants';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { 
  Table, 
  Plus, 
  Search, 
  Filter, 
  FileDown, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Edit2, 
  Trash2, 
  Copy, 
  X, 
  Calendar, 
  Clock, 
  DollarSign, 
  Package, 
  Truck, 
  Building2, 
  User, 
  Check, 
  ChevronDown, 
  ArrowUpDown, 
  SlidersHorizontal,
  FileSpreadsheet,
  Maximize2,
  Minimize2,
  Eye,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DuplicateAppointmentModal } from './DuplicateAppointmentModal';

interface AgendaPlanilhaViewProps {
  isViewer?: boolean;
  customTitle?: string;
  customDescription?: string;
}

export function AgendaPlanilhaView({ 
  isViewer = false,
  customTitle,
  customDescription 
}: AgendaPlanilhaViewProps) {
  const [appointments, setAppointments] = useState<ReceivingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [duplicateSuccessMessage, setDuplicateSuccessMessage] = useState<string | null>(null);
  const [duplicateTarget, setDuplicateTarget] = useState<ReceivingAppointment | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [isQuickRowOpen, setIsQuickRowOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ row: number; colName: string; value: string } | null>(null);
  const [inlineEditing, setInlineEditing] = useState<{ id: string; field: keyof ReceivingAppointment } | null>(null);
  const [inlineValue, setInlineValue] = useState<string>('');
  
  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'all' | 'custom' | 'month'>('today');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterLocation, setFilterLocation] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterVehicle, setFilterVehicle] = useState<string>('all');

  // Sorting
  const [sortField, setSortField] = useState<keyof ReceivingAppointment>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Form State
  const initialFormState = {
    date: new Date().toLocaleDateString('en-CA'),
    creationDate: new Date().toLocaleDateString('en-CA'),
    staff: '',
    requester: '',
    contact: '',
    orderNumber: '',
    supplier: '',
    vehicle: 'Carreta',
    pallets: '' as any,
    scheduledTime: '08:00',
    observation: '',
    collaborator: 'Michael',
    receivingLocation: 'Marsil' as ReceivingAppointment['receivingLocation'],
    receivingType: 'Recebimento' as ReceivingAppointment['receivingType'],
    status: 'Agendado' as ReceivingAppointment['status'],
    totalValue: '' as any,
    paymentTerm: '30 dias'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [formLoading, setFormLoading] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Firestore Sync
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'appointments'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ReceivingAppointment));
      setAppointments(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'appointments');
    });

    return () => unsubscribe();
  }, []);

  // Filtered and Sorted Appointments
  const filteredAppointments = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);

    return appointments
      .filter(a => {
        if (a.deleted) return false;

        // Date Filter Mode
        if (dateFilterMode === 'today' && a.date !== today) return false;
        if (dateFilterMode === 'custom' && filterDate && a.date !== filterDate) return false;
        if (dateFilterMode === 'month' && (!a.date || !a.date.startsWith(currentMonth))) return false;

        // Select Filters
        if (filterStatus !== 'all' && a.status !== filterStatus) return false;
        if (filterLocation !== 'all' && a.receivingLocation !== filterLocation) return false;
        if (filterType !== 'all' && a.receivingType !== filterType) return false;
        if (filterVehicle !== 'all' && a.vehicle !== filterVehicle) return false;

        // Global text search across all relevant fields
        if (searchTerm.trim() !== '') {
          const term = searchTerm.toLowerCase();
          const matchesOrder = (a.orderNumber || '').toLowerCase().includes(term);
          const matchesSupplier = (a.supplier || '').toLowerCase().includes(term);
          const matchesRequester = (a.requester || '').toLowerCase().includes(term);
          const matchesCollaborator = (a.collaborator || '').toLowerCase().includes(term);
          const matchesObs = (a.observation || '').toLowerCase().includes(term);
          const matchesContact = (a.contact || '').toLowerCase().includes(term);
          const matchesEmail = (a.staff || '').toLowerCase().includes(term);
          const matchesLocation = (a.receivingLocation || '').toLowerCase().includes(term);
          return matchesOrder || matchesSupplier || matchesRequester || matchesCollaborator || matchesObs || matchesContact || matchesEmail || matchesLocation;
        }

        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortOrder === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
  }, [appointments, dateFilterMode, filterDate, filterStatus, filterLocation, filterType, filterVehicle, searchTerm, sortField, sortOrder]);

  // Statistics calculation for spreadsheet summary
  const summaryStats = useMemo(() => {
    const totalRows = filteredAppointments.length;
    const totalPallets = filteredAppointments.reduce((acc, curr) => acc + (curr.pallets || 0), 0);
    const totalValue = filteredAppointments.reduce((acc, curr) => acc + (curr.totalValue || 0), 0);
    const scheduledCount = filteredAppointments.filter(a => a.status === 'Agendado').length;
    const receivedCount = filteredAppointments.filter(a => a.status === 'Recebido').length;
    const unloadingCount = filteredAppointments.filter(a => a.status === 'Descarregando').length;
    const waitingCount = filteredAppointments.filter(a => a.status === 'Aguardando').length;
    const cancelledCount = filteredAppointments.filter(a => a.status === 'Cancelado').length;
    const receivedValue = filteredAppointments.filter(a => a.status === 'Recebido').reduce((acc, curr) => acc + (curr.totalValue || 0), 0);

    return {
      totalRows,
      totalPallets,
      totalValue,
      scheduledCount,
      receivedCount,
      unloadingCount,
      waitingCount,
      cancelledCount,
      receivedValue,
      avgPallets: totalRows > 0 ? (totalPallets / totalRows).toFixed(1) : 0
    };
  }, [filteredAppointments]);

  // Handle Form Submit
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier || !formData.date) {
      alert("Por favor, preencha os campos obrigatórios (Data e Fornecedor).");
      return;
    }

    setFormLoading(true);
    try {
      const payload = {
        ...formData,
        pallets: formData.pallets === '' ? 0 : Number(formData.pallets),
        totalValue: formData.totalValue === '' ? 0 : Number(formData.totalValue),
        createdAt: editingId ? (appointments.find(a => a.id === editingId)?.createdAt || serverTimestamp()) : serverTimestamp()
      };

      if (editingId) {
        await setDoc(doc(db, 'appointments', editingId), payload, { merge: true });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'appointments'), payload);
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      resetForm();
    } catch (error) {
      console.error("Save appointment error:", error);
      alert("Erro ao salvar dados na planilha: " + (error instanceof Error ? error.message : "Erro desconhecido"));
      handleFirestoreError(error, editingId ? OperationType.UPDATE : OperationType.CREATE, 'appointments');
    } finally {
      setFormLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingId(null);
  };

  const handleEdit = (appointment: ReceivingAppointment) => {
    setFormData({
      date: appointment.date || '',
      creationDate: appointment.creationDate || appointment.date || '',
      staff: appointment.staff || '',
      requester: appointment.requester || '',
      contact: appointment.contact || '',
      orderNumber: appointment.orderNumber || '',
      supplier: appointment.supplier || '',
      vehicle: appointment.vehicle || 'Carreta',
      pallets: appointment.pallets ?? ('' as any),
      scheduledTime: appointment.scheduledTime || '08:00',
      observation: appointment.observation || '',
      collaborator: appointment.collaborator || 'Michael',
      receivingLocation: appointment.receivingLocation || 'Marsil',
      receivingType: appointment.receivingType || 'Recebimento',
      status: appointment.status || 'Agendado',
      totalValue: appointment.totalValue ?? ('' as any),
      paymentTerm: appointment.paymentTerm || '30 dias'
    });
    setEditingId(appointment.id);
    setIsFormOpen(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleDuplicate = (appointment: ReceivingAppointment) => {
    setDuplicateTarget(appointment);
  };

  const handleConfirmDuplicate = async (duplicates: Array<Omit<ReceivingAppointment, 'id' | 'createdAt'>>) => {
    try {
      for (const item of duplicates) {
        await addDoc(collection(db, 'appointments'), {
          ...item,
          createdAt: serverTimestamp()
        });
      }
      const msg = duplicates.length === 1 
        ? `Agendamento duplicado com sucesso para ${duplicates[0].date.split('-').reverse().join('/')}!`
        : `${duplicates.length} agendamentos duplicados com sucesso para o mês!`;
      setDuplicateSuccessMessage(msg);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setDuplicateSuccessMessage(null);
      }, 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'appointments');
    }
  };

  const handleOpenInForm = (appointmentData: Partial<ReceivingAppointment>) => {
    setFormData({
      date: appointmentData.date || new Date().toISOString().split('T')[0],
      creationDate: appointmentData.creationDate || new Date().toISOString().split('T')[0],
      staff: appointmentData.staff || '',
      requester: appointmentData.requester || '',
      contact: appointmentData.contact || '',
      orderNumber: appointmentData.orderNumber || '',
      supplier: appointmentData.supplier || '',
      vehicle: appointmentData.vehicle || 'Carreta',
      pallets: appointmentData.pallets ?? ('' as any),
      scheduledTime: appointmentData.scheduledTime || '08:00',
      observation: appointmentData.observation || '',
      collaborator: appointmentData.collaborator || 'Michael',
      receivingLocation: appointmentData.receivingLocation || 'Marsil',
      receivingType: appointmentData.receivingType || 'Recebimento',
      status: 'Agendado',
      totalValue: appointmentData.totalValue ?? ('' as any),
      paymentTerm: appointmentData.paymentTerm || '30 dias'
    });
    setEditingId(null);
    setIsFormOpen(true);
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
    setDuplicateSuccessMessage('Dados copiados para o formulário! Ajuste a data ou campos e salve.');
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setDuplicateSuccessMessage(null);
    }, 4000);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente remover esta linha da planilha?')) return;
    try {
      await setDoc(doc(db, 'appointments', id), { deleted: true }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const handleQuickStatusChange = async (id: string, newStatus: ReceivingAppointment['status']) => {
    try {
      await setDoc(doc(db, 'appointments', id), { status: newStatus }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const handleSaveInline = async (id: string, field: keyof ReceivingAppointment) => {
    try {
      let finalVal: any = inlineValue;
      if (field === 'pallets') {
        finalVal = inlineValue === '' ? 0 : Number(inlineValue.replace(/\D/g, ''));
      } else if (field === 'totalValue') {
        finalVal = inlineValue === '' ? 0 : Number(inlineValue.replace(/[^\d.]/g, ''));
      }

      await setDoc(doc(db, 'appointments', id), { [field]: finalVal }, { merge: true });
      setInlineEditing(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'appointments');
    }
  };

  const handleSort = (field: keyof ReceivingAppointment) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const exportSpreadsheetCSV = () => {
    const headers = [
      'LINHA',
      'STATUS',
      'DATA AGENDADA',
      'HORARIO',
      'PEDIDO',
      'FORNECEDOR',
      'LOCAL',
      'TIPO RECEBIMENTO',
      'VEICULO',
      'PALETES',
      'VALOR TOTAL (R$)',
      'PRAZO BOLETO',
      'SOLICITANTE',
      'CONTATO',
      'EMAIL',
      'RESPONSAVEL',
      'OBSERVACOES'
    ];

    const rows = filteredAppointments.map((a, idx) => [
      idx + 1,
      a.status,
      a.date,
      a.scheduledTime,
      `"${(a.orderNumber || '').replace(/"/g, '""')}"`,
      `"${(a.supplier || '').replace(/"/g, '""')}"`,
      a.receivingLocation,
      a.receivingType,
      a.vehicle,
      a.pallets || 0,
      (a.totalValue || 0).toFixed(2),
      `"${(a.paymentTerm || '').replace(/"/g, '""')}"`,
      `"${(a.requester || '').replace(/"/g, '""')}"`,
      `"${(a.contact || '').replace(/"/g, '""')}"`,
      `"${(a.staff || '').replace(/"/g, '""')}"`,
      `"${(a.collaborator || '').replace(/"/g, '""')}"`,
      `"${(a.observation || '').replace(/"/g, '""')}"`
    ]);

    const csvString = [
      headers.join(';'),
      ...rows.map(r => r.join(';'))
    ].join('\r\n');

    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `planilha_agendamentos_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: ReceivingAppointment['status']) => {
    switch (status) {
      case 'Agendado':
        return 'bg-neutral-100 text-neutral-700 border-neutral-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700';
      case 'Aguardando':
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40';
      case 'Descarregando':
        return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40';
      case 'Recebido':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40';
      case 'Cancelado':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900/40';
      default:
        return 'bg-neutral-100 text-neutral-700';
    }
  };

  const getLocationBadge = (loc: string) => {
    switch (loc) {
      case 'Marsil':
        return 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/40';
      case 'OP. Logístico':
        return 'bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900/40';
      case 'Boracéia':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40';
      default:
        return 'bg-neutral-50 text-neutral-600 border-neutral-100 dark:bg-neutral-800 dark:text-neutral-300';
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans pb-16">
      {/* Toast notification */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-20 right-8 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl font-bold shadow-2xl flex items-center gap-2.5 border border-emerald-400/30 max-w-md"
          >
            <CheckCircle size={20} className="text-white shrink-0" />
            <span className="text-xs sm:text-sm font-bold">
              {duplicateSuccessMessage || 'Dados gravados na planilha com sucesso!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spreadsheet Header / Application Toolbar */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">
                  {customTitle || 'Planilha de Agendamento'}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                  isViewer
                    ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800'
                    : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                }`}>
                  {isViewer ? 'Modo Consulta (Somente Leitura)' : 'Modo Planilha Dinâmica'}
                </span>
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {customDescription || (isViewer 
                  ? 'Consulta e exportação da grade de agendamentos de recebimento.' 
                  : 'Preencha o formulário abaixo para lançar dados instantaneamente na grade ou edite as células diretamente.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {!isViewer && (
              <button
                onClick={() => {
                  if (isFormOpen && editingId) {
                    resetForm();
                  } else {
                    setIsFormOpen(!isFormOpen);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm ${
                  isFormOpen 
                    ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:opacity-90' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {isFormOpen ? <X size={15} /> : <Plus size={15} />}
                {isFormOpen ? (editingId ? 'Cancelar Edição' : 'Recolher Formulário') : '+ Novo Lançamento'}
              </button>
            )}

            <button
              onClick={exportSpreadsheetCSV}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-1.5 transition-all"
              title="Baixar em formato CSV compatível com Excel e Google Planilhas"
            >
              <FileDown size={15} className="text-emerald-600 dark:text-emerald-400" />
              Exportar Planilha
            </button>
          </div>
        </div>

        {/* Formula & Metrics Quick Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-300 uppercase tracking-wider block">Total de Linhas</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-neutral-900 dark:text-white">{summaryStats.totalRows}</span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">registros</span>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider block">Soma de Paletes</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-purple-700 dark:text-purple-300">{summaryStats.totalPallets}</span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">paletes</span>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider block">Valor em Aberto</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm sm:text-base font-black text-blue-700 dark:text-blue-300 truncate">
                R$ {summaryStats.totalValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">Valor Recebido</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm sm:text-base font-black text-emerald-700 dark:text-emerald-300 truncate">
                R$ {summaryStats.receivedValue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-wider block">Em Espera / Descarga</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-300">
                {summaryStats.waitingCount + summaryStats.unloadingCount}
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">veículos</span>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800 p-3 rounded-xl border border-neutral-200 dark:border-neutral-700 shadow-sm">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">Recebidos Hoje</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black text-emerald-700 dark:text-emerald-300">
                {summaryStats.receivedCount}
              </span>
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400">cargas</span>
            </div>
          </div>
        </div>

        {/* Selected Cell Formula Indicator Bar */}
        <div className="flex items-center gap-3 bg-neutral-100/90 dark:bg-neutral-800 px-3 py-2 rounded-xl text-xs border border-neutral-200 dark:border-neutral-700 shadow-inner">
          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-neutral-900 px-2.5 py-0.5 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm">
            {selectedCell ? `${selectedCell.colName}${selectedCell.row}` : 'A1'}
          </span>
          <div className="h-4 w-px bg-neutral-300 dark:bg-neutral-600" />
          <span className="text-neutral-500 dark:text-neutral-400 font-mono font-bold select-none">fx:</span>
          <span className="text-neutral-800 dark:text-neutral-100 font-mono truncate flex-1 font-medium">
            {selectedCell ? selectedCell.value : 'Clique em qualquer célula da planilha para inspecionar os detalhes'}
          </span>
        </div>
      </div>

      {/* FORMULÁRIO DE ENTRADA INTUITIVO (SIMULAÇÃO DE ENTRADA DE PLANILHA) */}
      <AnimatePresence>
        {isFormOpen && !isViewer && (
          <motion.div
            ref={formRef}
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="bg-white dark:bg-neutral-900 rounded-2xl border-2 border-emerald-500/30 dark:border-emerald-600/30 shadow-lg p-6 space-y-5 relative">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                  <h3 className="font-bold text-sm text-neutral-900 dark:text-white uppercase tracking-wide flex items-center gap-2">
                    {editingId ? 'Editar Linha Selecionada da Planilha' : 'Formulário de Inserção na Planilha'}
                  </h3>
                  {editingId && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 rounded text-[10px] font-bold">
                      ID: {editingId.slice(0, 6)}...
                    </span>
                  )}
                </div>
                <button
                  onClick={resetForm}
                  className="text-xs text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                >
                  Limpar Formulário
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Bloco 1: Data & Hora */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <Calendar size={13} className="text-emerald-600" />
                      Data Agendada *
                    </label>
                    <input
                      required
                      type="date"
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <Clock size={13} className="text-emerald-600" />
                      Horário *
                    </label>
                    <input
                      required
                      type="time"
                      value={formData.scheduledTime}
                      onChange={e => setFormData({ ...formData, scheduledTime: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Bloco 2: Pedido & Fornecedor */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Package size={13} />
                      Pedido (Nº/Código) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 5412 / 8930"
                      value={formData.orderNumber}
                      onChange={e => setFormData({ ...formData, orderNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border-2 border-blue-200 dark:border-blue-900/50 bg-blue-50/30 dark:bg-blue-950/20 text-neutral-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-700 dark:text-neutral-300 flex items-center gap-1">
                      <Building2 size={13} className="text-emerald-600" />
                      Fornecedor (Razão / Nome) *
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Nome do Fornecedor"
                      value={formData.supplier}
                      onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Bloco 3: Local & Tipo */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      Local de Recebimento
                    </label>
                    <select
                      value={formData.receivingLocation}
                      onChange={e => setFormData({ ...formData, receivingLocation: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {RECEIVING_LOCATIONS.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      Tipo de Recebimento
                    </label>
                    <select
                      value={formData.receivingType}
                      onChange={e => setFormData({ ...formData, receivingType: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {RECEIVING_TYPES.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Bloco 4: Veículo & Paletes */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <Truck size={13} />
                      Tipo de Veículo
                    </label>
                    <select
                      value={formData.vehicle}
                      onChange={e => setFormData({ ...formData, vehicle: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {VEHICLE_TYPES.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      Quantidade Paletes
                    </label>
                    <input
                      type="text"
                      placeholder="Qtd Paletes"
                      value={formData.pallets === 0 || formData.pallets === '' ? '' : formData.pallets}
                      onChange={e => {
                        const val = e.target.value.replace(/\D/g, '');
                        setFormData({ ...formData, pallets: val === '' ? '' : parseInt(val) });
                      }}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Bloco 5: Valor & Prazo */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <DollarSign size={13} className="text-emerald-600" />
                      Valor Carga (R$)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-xs font-bold">R$</span>
                      <input
                        type="text"
                        placeholder="0,00"
                        value={formData.totalValue === '' ? '' : new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(formData.totalValue)}
                        onChange={e => {
                          const rawValue = e.target.value.replace(/\D/g, '');
                          if (rawValue === '') {
                            setFormData({ ...formData, totalValue: '' as any });
                          } else {
                            const newValue = parseFloat(rawValue) / 100;
                            setFormData({ ...formData, totalValue: newValue });
                          }
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      Prazo Pagamento
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 30 dias / À vista"
                      value={formData.paymentTerm}
                      onChange={e => setFormData({ ...formData, paymentTerm: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  {/* Bloco 6: Solicitante & Responsável */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                      <User size={13} />
                      Solicitante
                    </label>
                    <input
                      type="text"
                      placeholder="Nome do solicitante"
                      value={formData.requester}
                      onChange={e => setFormData({ ...formData, requester: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      Responsável / Colaborador
                    </label>
                    <select
                      value={formData.collaborator}
                      onChange={e => setFormData({ ...formData, collaborator: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="Michael">Michael</option>
                      <option value="Naldo">Naldo</option>
                      <option value="Allan">Allan</option>
                    </select>
                  </div>

                  {/* Bloco 7: Status & Observação */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      Status da Carga
                    </label>
                    <select
                      value={formData.status}
                      onChange={e => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="Agendado">Agendado</option>
                      <option value="Aguardando">Aguardando</option>
                      <option value="Descarregando">Descarregando</option>
                      <option value="Recebido">Recebido</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      Contato / E-mail
                    </label>
                    <input
                      type="text"
                      placeholder="Tel ou email de contato"
                      value={formData.contact}
                      onChange={e => setFormData({ ...formData, contact: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400">
                      Observações / Detalhes Adicionais
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Carga frágil, doca 3, prioridade alta..."
                      value={formData.observation}
                      onChange={e => setFormData({ ...formData, observation: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <div>
                    {editingId && (
                      <button
                        type="button"
                        onClick={() => {
                          const currentAppt = appointments.find(a => a.id === editingId);
                          if (currentAppt) {
                            handleDuplicate(currentAppt);
                          } else {
                            // Synthesize appointment from formData
                            handleDuplicate({
                              id: 'temp',
                              date: formData.date,
                              creationDate: formData.creationDate,
                              staff: formData.staff,
                              requester: formData.requester,
                              contact: formData.contact,
                              orderNumber: formData.orderNumber,
                              supplier: formData.supplier,
                              vehicle: formData.vehicle,
                              pallets: Number(formData.pallets) || 0,
                              scheduledTime: formData.scheduledTime,
                              observation: formData.observation,
                              collaborator: formData.collaborator,
                              receivingLocation: formData.receivingLocation,
                              receivingType: formData.receivingType,
                              status: formData.status,
                              totalValue: Number(formData.totalValue) || 0,
                              paymentTerm: formData.paymentTerm,
                              createdAt: Date.now()
                            });
                          }
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 flex items-center gap-1.5 transition-all"
                        title="Duplicar este agendamento para outra data ou múltiplas datas do mês"
                      >
                        <Copy size={14} className="text-emerald-600" />
                        Duplicar este Agendamento
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={resetForm}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Limpar
                    </button>
                    <button
                      type="submit"
                      disabled={formLoading}
                      className="px-6 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                      <Check size={16} />
                      {editingId ? 'Atualizar Linha na Planilha' : 'Inserir Dados na Planilha'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FILTER & SEARCH CONTROL BAR */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Universal Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Pesquisar em toda a planilha (Pedido, Fornecedor, Solicitante, Obs...)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white dark:focus:bg-neutral-800 transition-all"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Date Mode Selector Tabs */}
          <div className="flex items-center bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl shrink-0 text-xs">
            <button
              onClick={() => setDateFilterMode('today')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                dateFilterMode === 'today' 
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setDateFilterMode('month')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                dateFilterMode === 'month' 
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Este Mês
            </button>
            <button
              onClick={() => setDateFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                dateFilterMode === 'all' 
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Todas as Datas
            </button>
            <button
              onClick={() => setDateFilterMode('custom')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
                dateFilterMode === 'custom' 
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-sm' 
                  : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
              }`}
            >
              Data Específica
            </button>
          </div>

          {dateFilterMode === 'custom' && (
            <input
              type="date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none"
            />
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex items-center flex-wrap gap-2 pt-1">
          <span className="text-[11px] font-bold uppercase text-neutral-400 flex items-center gap-1 mr-1">
            <Filter size={12} />
            Filtros:
          </span>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs outline-none font-medium"
          >
            <option value="all">Todos os Status</option>
            <option value="Agendado">Agendado</option>
            <option value="Aguardando">Aguardando</option>
            <option value="Descarregando">Descarregando</option>
            <option value="Recebido">Recebido</option>
            <option value="Cancelado">Cancelado</option>
          </select>

          <select
            value={filterLocation}
            onChange={e => setFilterLocation(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs outline-none font-medium"
          >
            <option value="all">Todas as Unidades</option>
            {RECEIVING_LOCATIONS.map(loc => (
              <option key={loc} value={loc}>{loc}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs outline-none font-medium"
          >
            <option value="all">Todos os Tipos</option>
            {RECEIVING_TYPES.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <select
            value={filterVehicle}
            onChange={e => setFilterVehicle(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs outline-none font-medium"
          >
            <option value="all">Todos os Veículos</option>
            {VEHICLE_TYPES.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>

          {(filterStatus !== 'all' || filterLocation !== 'all' || filterType !== 'all' || filterVehicle !== 'all' || searchTerm !== '') && (
            <button
              onClick={() => {
                setFilterStatus('all');
                setFilterLocation('all');
                setFilterType('all');
                setFilterVehicle('all');
                setSearchTerm('');
              }}
              className="px-2.5 py-1 text-xs font-bold text-red-600 dark:text-red-400 hover:underline flex items-center gap-1"
            >
              <X size={12} />
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* SPREADSHEET GRID CONTAINER */}
      <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden flex flex-col">
        {/* Table top excel sheet header */}
        <div className="bg-neutral-100/80 dark:bg-neutral-800/90 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700/80 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">
              Guia Ativa: <span className="text-emerald-600 dark:text-emerald-400 font-bold">Agendamentos_Geral</span>
            </span>
            <span>•</span>
            <span>{filteredAppointments.length} linhas exibidas</span>
          </div>
          <span className="text-[11px] text-neutral-400">
            Dica: Clique no cabeçalho para ordenar ou no status para alterar diretamente.
          </span>
        </div>

        <div className="overflow-x-auto overflow-y-auto max-h-[700px] select-text">
          <table className="w-full text-xs text-left border-collapse min-w-[1300px]">
            {/* Spreadsheet Column Headers (A, B, C... + Name) */}
            <thead className="sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 font-bold border-b-2 border-neutral-300 dark:border-neutral-700 shadow-sm">
              <tr>
                {/* Row Number Column */}
                <th className="w-12 px-3 py-3 text-center border-r border-neutral-200 dark:border-neutral-700 bg-neutral-200/80 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-mono text-[10px]">
                  #
                </th>
                
                {/* Status Column (A) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[140px] cursor-pointer hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-colors" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-between">
                    <span>A • Status</span>
                    <ArrowUpDown size={12} className="text-neutral-400" />
                  </div>
                </th>

                {/* Data Agendada (B) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[115px] cursor-pointer hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-colors" onClick={() => handleSort('date')}>
                  <div className="flex items-center justify-between">
                    <span>B • Data Agenda</span>
                    <ArrowUpDown size={12} className="text-neutral-400" />
                  </div>
                </th>

                {/* Horário (C) */}
                <th className="px-3 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[85px] cursor-pointer hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-colors" onClick={() => handleSort('scheduledTime')}>
                  <div className="flex items-center justify-between">
                    <span>C • Hora</span>
                    <ArrowUpDown size={12} className="text-neutral-400" />
                  </div>
                </th>

                {/* Pedido (D) - DESTAQUE */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[110px] cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50 bg-blue-50 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 transition-colors" onClick={() => handleSort('orderNumber')}>
                  <div className="flex items-center justify-between">
                    <span>D • Pedido</span>
                    <ArrowUpDown size={12} className="text-blue-600 dark:text-blue-400" />
                  </div>
                </th>

                {/* Fornecedor (E) - DESTAQUE */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[200px] cursor-pointer hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-colors" onClick={() => handleSort('supplier')}>
                  <div className="flex items-center justify-between">
                    <span>E • Fornecedor</span>
                    <ArrowUpDown size={12} className="text-neutral-400" />
                  </div>
                </th>

                {/* Local (F) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[115px] cursor-pointer hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-colors" onClick={() => handleSort('receivingLocation')}>
                  <div className="flex items-center justify-between">
                    <span>F • Local</span>
                    <ArrowUpDown size={12} className="text-neutral-400" />
                  </div>
                </th>

                {/* Tipo (G) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[115px] cursor-pointer hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-colors" onClick={() => handleSort('receivingType')}>
                  <div className="flex items-center justify-between">
                    <span>G • Tipo</span>
                    <ArrowUpDown size={12} className="text-neutral-400" />
                  </div>
                </th>

                {/* Veículo (H) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[110px] cursor-pointer hover:bg-neutral-200/70 dark:hover:bg-neutral-700/60 transition-colors" onClick={() => handleSort('vehicle')}>
                  <div className="flex items-center justify-between">
                    <span>H • Veículo</span>
                    <ArrowUpDown size={12} className="text-neutral-400" />
                  </div>
                </th>

                {/* Paletes (I) */}
                <th className="px-3 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[85px] text-right cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20 transition-colors" onClick={() => handleSort('pallets')}>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-purple-800 dark:text-purple-300">I • Paletes</span>
                    <ArrowUpDown size={12} className="text-purple-600 dark:text-purple-400" />
                  </div>
                </th>

                {/* Valor Total (J) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[125px] text-right cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20 transition-colors" onClick={() => handleSort('totalValue')}>
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-emerald-800 dark:text-emerald-300">J • Valor Carga</span>
                    <ArrowUpDown size={12} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                </th>

                {/* Prazo Pagto (K) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[110px]">
                  <span>K • Prazo Boleto</span>
                </th>

                {/* Solicitante (L) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[130px]" onClick={() => handleSort('requester')}>
                  <div className="flex items-center justify-between">
                    <span>L • Solicitante</span>
                    <ArrowUpDown size={12} className="text-neutral-400" />
                  </div>
                </th>

                {/* Responsável (M) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[120px]">
                  <span>M • Responsável</span>
                </th>

                {/* Observações (N) */}
                <th className="px-4 py-3 border-r border-neutral-200 dark:border-neutral-700 min-w-[180px]">
                  <span>N • Observações</span>
                </th>

                {/* Ações (O) */}
                <th className="px-4 py-3 min-w-[110px] text-center bg-neutral-200/80 dark:bg-neutral-800">
                  <span>{isViewer ? 'Visualização' : 'Ações'}</span>
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {filteredAppointments.length === 0 ? (
                <tr>
                  <td colSpan={16} className="px-6 py-16 text-center text-neutral-500 dark:text-neutral-400 italic">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileSpreadsheet size={36} className="text-neutral-400 dark:text-neutral-600" />
                      <p className="font-bold text-neutral-700 dark:text-neutral-200">Nenhum registro encontrado para os filtros selecionados.</p>
                      {!isViewer && (
                        <p className="text-xs">Utilize o botão "+ Novo Lançamento" acima para adicionar agendamentos à planilha.</p>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAppointments.map((appointment, index) => {
                  const rowNum = index + 1;
                  const isSelected = selectedCell?.row === rowNum;

                  return (
                    <tr
                      key={appointment.id}
                      className={`transition-colors duration-150 group hover:bg-emerald-50/40 dark:hover:bg-neutral-800/80 ${
                        isSelected ? 'bg-emerald-50/60 dark:bg-emerald-950/30' : index % 2 === 1 ? 'bg-neutral-50/60 dark:bg-neutral-900/60' : 'bg-white dark:bg-neutral-900'
                      }`}
                    >
                      {/* Row Index */}
                      <td 
                        className="px-2 py-2.5 text-center border-r border-neutral-200 dark:border-neutral-800 font-mono text-[10px] text-neutral-500 dark:text-neutral-300 font-bold bg-neutral-100/70 dark:bg-neutral-800/60 select-none"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'ROW', value: `Linha ${rowNum}: ${appointment.supplier || 'Sem fornecedor'}` })}
                      >
                        {rowNum}
                      </td>

                      {/* Status Dropdown */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'A', value: `Status: ${appointment.status}` })}
                      >
                        <select
                          disabled={isViewer}
                          value={appointment.status}
                          onChange={(e) => handleQuickStatusChange(appointment.id, e.target.value as any)}
                          className={`w-full text-[11px] font-black uppercase rounded-lg px-2 py-1 border transition-all cursor-pointer outline-none ${getStatusBadge(appointment.status)}`}
                        >
                          <option value="Agendado">Agendado</option>
                          <option value="Aguardando">Aguardando</option>
                          <option value="Descarregando">Descarregando</option>
                          <option value="Recebido">Recebido</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </td>

                      {/* Data Agendada */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 font-medium text-neutral-800 dark:text-neutral-200 whitespace-nowrap"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'B', value: `Data Agendada: ${appointment.date}` })}
                      >
                        {appointment.date ? appointment.date.split('-').reverse().join('/') : '-'}
                      </td>

                      {/* Horário */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 font-bold text-neutral-800 dark:text-neutral-100 whitespace-nowrap"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'C', value: `Horário: ${appointment.scheduledTime}` })}
                      >
                        <span className="px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-neutral-800 dark:text-neutral-200 border border-neutral-200/80 dark:border-neutral-700">
                          {appointment.scheduledTime || '--:--'}
                        </span>
                      </td>

                      {/* Pedido - Destaque em Tag Azul */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap bg-blue-50/60 dark:bg-blue-950/30"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'D', value: `Pedido: ${appointment.orderNumber || 'Sem número'}` })}
                      >
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase border bg-blue-100/80 text-blue-900 border-blue-300 dark:bg-blue-900/60 dark:text-blue-200 dark:border-blue-700 shadow-xs inline-block">
                          {appointment.orderNumber || '-'}
                        </span>
                      </td>

                      {/* Fornecedor - Destaque em Tag Neutra */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'E', value: `Fornecedor: ${appointment.supplier}` })}
                      >
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase border bg-neutral-100 text-neutral-900 border-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:border-neutral-700 truncate max-w-[220px] inline-block align-middle" title={appointment.supplier}>
                          {appointment.supplier || '-'}
                        </span>
                      </td>

                      {/* Local */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'F', value: `Local: ${appointment.receivingLocation}` })}
                      >
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getLocationBadge(appointment.receivingLocation || 'Marsil')}`}>
                          {appointment.receivingLocation || 'Marsil'}
                        </span>
                      </td>

                      {/* Tipo */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap text-neutral-700 dark:text-neutral-200 font-medium"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'G', value: `Tipo: ${appointment.receivingType}` })}
                      >
                        {appointment.receivingType || 'Recebimento'}
                      </td>

                      {/* Veículo */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap text-neutral-700 dark:text-neutral-200 font-medium"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'H', value: `Veículo: ${appointment.vehicle}` })}
                      >
                        {appointment.vehicle || '-'}
                      </td>

                      {/* Paletes */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 text-right font-black text-purple-700 dark:text-purple-300"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'I', value: `Paletes: ${appointment.pallets || 0}` })}
                      >
                        {appointment.pallets ?? 0}
                      </td>

                      {/* Valor Total */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 text-right font-black text-emerald-700 dark:text-emerald-300 whitespace-nowrap"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'J', value: `Valor Total: R$ ${(appointment.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` })}
                      >
                        R$ {(appointment.totalValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* Prazo Pagto */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap text-neutral-700 dark:text-neutral-300"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'K', value: `Prazo Boleto: ${appointment.paymentTerm || 'N/A'}` })}
                      >
                        {appointment.paymentTerm || '-'}
                      </td>

                      {/* Solicitante */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap text-neutral-800 dark:text-neutral-200 font-medium truncate max-w-[140px]"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'L', value: `Solicitante: ${appointment.requester || 'N/A'}` })}
                        title={appointment.requester}
                      >
                        {appointment.requester || '-'}
                      </td>

                      {/* Responsável */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap text-neutral-800 dark:text-neutral-200 font-medium"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'M', value: `Responsável: ${appointment.collaborator || 'N/A'}` })}
                      >
                        {appointment.collaborator || '-'}
                      </td>

                      {/* Observações */}
                      <td 
                        className="px-3 py-2 border-r border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 truncate max-w-[200px]"
                        onClick={() => setSelectedCell({ row: rowNum, colName: 'N', value: `Observações: ${appointment.observation || 'Nenhuma'}` })}
                        title={appointment.observation}
                      >
                        {appointment.observation || '-'}
                      </td>

                      {/* Ações */}
                      <td className="px-2 py-2 text-center whitespace-nowrap bg-neutral-50/50 dark:bg-neutral-800/50">
                        <div className="flex items-center justify-center gap-1">
                          {!isViewer ? (
                            <>
                              <button
                                onClick={() => handleEdit(appointment)}
                                title="Editar Linha Completa"
                                className="p-1.5 hover:bg-blue-100 text-blue-600 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded-lg transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                onClick={() => handleDuplicate(appointment)}
                                title="Duplicar Agendamento (Alterar data ou criar recorrência)"
                                className="p-1.5 hover:bg-emerald-100 text-emerald-600 dark:hover:bg-emerald-950/50 dark:text-emerald-400 rounded-lg transition-colors"
                              >
                                <Copy size={13} />
                              </button>
                              <button
                                onClick={() => handleDelete(appointment.id)}
                                title="Remover da Planilha"
                                className="p-1.5 hover:bg-red-100 text-red-600 dark:hover:bg-red-900/40 dark:text-red-400 rounded-lg transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800">
                              Consulta
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* SPREADSHEET SUMMARY TFOOT ROW */}
            <tfoot className="sticky bottom-0 z-20 bg-neutral-200/95 dark:bg-neutral-800 border-t-2 border-neutral-300 dark:border-neutral-600 font-bold text-neutral-900 dark:text-neutral-100 shadow-md">
              <tr>
                <td className="px-2 py-2.5 text-center border-r border-neutral-300 dark:border-neutral-700 font-mono text-[10px] text-neutral-700 dark:text-neutral-300 uppercase">
                  Σ
                </td>
                <td colSpan={8} className="px-4 py-2.5 border-r border-neutral-300 dark:border-neutral-700 text-right uppercase tracking-wider text-xs text-neutral-800 dark:text-neutral-200">
                  Total da Seleção ({filteredAppointments.length} registros):
                </td>
                {/* Paletes Total (I) */}
                <td className="px-3 py-2.5 border-r border-neutral-300 dark:border-neutral-700 text-right font-black text-sm text-purple-800 dark:text-purple-300 bg-purple-100/60 dark:bg-purple-950/60">
                  {summaryStats.totalPallets}
                </td>
                {/* Valor Total (J) */}
                <td className="px-4 py-2.5 border-r border-neutral-300 dark:border-neutral-700 text-right font-black text-sm text-emerald-800 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-950/60 whitespace-nowrap">
                  R$ {summaryStats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td colSpan={6} className="px-4 py-2.5 bg-neutral-200/95 dark:bg-neutral-800 text-xs text-neutral-700 dark:text-neutral-300">
                  Recebido: <span className="font-black text-emerald-700 dark:text-emerald-300">R$ {summaryStats.receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* SPREADSHEET FOOTER / STATUS BAR */}
        <div className="bg-neutral-100 dark:bg-neutral-900 px-4 py-3 border-t border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-700 dark:text-neutral-300 gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
              <CheckCircle size={14} className="shrink-0" />
              Sincronizado em Tempo Real
            </span>
            <span className="text-neutral-400 dark:text-neutral-600 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 bg-white dark:bg-neutral-800 px-2.5 py-1 rounded-lg border border-neutral-200 dark:border-neutral-700 shadow-sm">
              <span className="text-neutral-500 dark:text-neutral-400">Linhas Filtradas:</span>
              <strong className="text-neutral-900 dark:text-white font-black">{filteredAppointments.length}</strong>
            </div>
            <span className="text-neutral-400 dark:text-neutral-600 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-950/50 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800/60 shadow-sm">
              <span className="text-purple-700 dark:text-purple-300">Soma Paletes:</span>
              <strong className="text-purple-800 dark:text-purple-200 font-black">{summaryStats.totalPallets}</strong>
            </div>
            <span className="text-neutral-400 dark:text-neutral-600 hidden sm:inline">•</span>
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/50 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
              <span className="text-emerald-700 dark:text-emerald-300">Total Carga:</span>
              <strong className="text-emerald-800 dark:text-emerald-200 font-black">R$ {summaryStats.totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400 uppercase font-mono font-bold bg-neutral-200/70 dark:bg-neutral-800 px-2 py-0.5 rounded">Planilha v2.0</span>
          </div>
        </div>
      </div>

      {/* MODAL DE DUPLICAÇÃO DE AGENDAMENTO */}
      <DuplicateAppointmentModal
        isOpen={Boolean(duplicateTarget)}
        appointment={duplicateTarget}
        onClose={() => setDuplicateTarget(null)}
        onConfirmDuplicate={handleConfirmDuplicate}
        onOpenInForm={handleOpenInForm}
      />
    </div>
  );
}
