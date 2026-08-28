import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Truck, 
  Calendar, 
  Users, 
  Save, 
  CheckCircle2, 
  Loader2, 
  Plus, 
  Trash2, 
  Clock, 
  User as UserIcon, 
  Package, 
  ArrowRightLeft, 
  AlertCircle, 
  Check, 
  Building2,
  FileText,
  HelpCircle,
  TrendingUp,
  MapPin,
  ExternalLink,
  Info,
  FileSpreadsheet,
  Moon,
  Sun,
  History,
  RotateCcw,
  Sparkles,
  CalendarDays,
  X
} from 'lucide-react';
import { AgendaPlanilhaView } from './AgendaPlanilhaView';
import { 
  doc, 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { logAuditEvent } from '../utils/auditLogger';
import { DEPARTMENTS } from '../constants';
import { DepartmentId, BoraceiaShipment, UserProfile, Vehicle } from '../types';

interface VeiculosViewProps {
  profile: UserProfile | null;
}

export function VeiculosView({ profile }: VeiculosViewProps) {
  const isViewer = profile?.departmentId === 'viewer';
  const [activeSubTab, setActiveSubTab] = useState<'frota' | 'planilha'>('frota');
  const [settings, setSettings] = useState<any>(null);
  
  const today = new Date().toLocaleDateString('en-CA');
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('en-CA');

  // Selected date to view / edit (defaults to today, but can be yesterday or any previous day)
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const [staffPresent, setStaffPresent] = useState<number>(0);
  const [staffByRole, setStaffByRole] = useState<Record<string, number>>({});
  const [driversCount, setDriversCount] = useState<number>(0);
  const [registeredVehicles, setRegisteredVehicles] = useState<string[]>([]);
  
  // Envio para Boracéia (Transferência de Estoque) - 1 a 2 carretas diárias
  const [boraceiaShipments, setBoraceiaShipments] = useState<BoraceiaShipment[]>([
    {
      id: 'carreta-1',
      vehiclePlate: '',
      vehicleModel: 'Carreta 01',
      paletsCount: 0,
      driverName: '',
      departureTime: '',
      arrivalTimeSP: '',
      isNextDayArrival: false,
      status: 'Agendado',
      observation: ''
    }
  ]);

  // Occurrences state
  const [occurrenceTitle, setOccurrenceTitle] = useState('');
  const [occurrence, setOccurrence] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('low');
  const [isCritical, setIsCritical] = useState(false);

  const [logs, setLogs] = useState<any[]>([]);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Quick arrival update state (for inline or modal update of pending shipments)
  const [quickArrivalTarget, setQuickArrivalTarget] = useState<{
    logId: string;
    logDate: string;
    shipmentIndex: number;
    shipment: BoraceiaShipment;
  } | null>(null);
  const [quickArrivalTime, setQuickArrivalTime] = useState('21:30');
  const [quickArrivalIsNextDay, setQuickArrivalIsNextDay] = useState(true);
  const [quickArrivalObs, setQuickArrivalObs] = useState('');
  const [quickArrivalSaving, setQuickArrivalSaving] = useState(false);
  const [quickArrivalSuccess, setQuickArrivalSuccess] = useState(false);

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) setSettings(docSnap.data());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
    });

    const q = query(
      collection(db, 'logs'),
      where('departmentId', '==', 'veiculos'),
      orderBy('date', 'desc'),
      limit(14)
    );

    const unsubLogs = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      setLogs(logsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs/veiculos');
    });

    return () => {
      unsubSettings();
      unsubLogs();
    };
  }, []);

  // When selectedDate or logs change, load that day's data into the form
  useEffect(() => {
    const activeLog = logs.find((d: any) => d.date === selectedDate);
    if (activeLog) {
      setStaffPresent(activeLog.staffPresent || 0);
      setStaffByRole(activeLog.staffByRole || {});
      setDriversCount(activeLog.data?.driversCount || 0);
      setRegisteredVehicles(activeLog.data?.registeredVehicles || []);
      
      if (activeLog.data?.boraceiaShipments && Array.isArray(activeLog.data.boraceiaShipments) && activeLog.data.boraceiaShipments.length > 0) {
        setBoraceiaShipments(activeLog.data.boraceiaShipments);
      } else {
        setBoraceiaShipments([
          {
            id: 'carreta-1',
            vehiclePlate: '',
            vehicleModel: 'Carreta 01',
            paletsCount: 0,
            driverName: '',
            departureTime: '',
            arrivalTimeSP: '',
            isNextDayArrival: false,
            status: 'Agendado',
            observation: ''
          }
        ]);
      }
    } else {
      // Clean slate for new date
      setStaffPresent(0);
      setStaffByRole({});
      setDriversCount(0);
      setRegisteredVehicles([]);
      setBoraceiaShipments([
        {
          id: 'carreta-1',
          vehiclePlate: '',
          vehicleModel: 'Carreta 01',
          paletsCount: 0,
          driverName: '',
          departureTime: '',
          arrivalTimeSP: '',
          isNextDayArrival: false,
          status: 'Agendado',
          observation: ''
        }
      ]);
    }
  }, [selectedDate, logs]);

  const vehicles: Vehicle[] = settings?.vehicles || [];
  const roles = settings?.departments?.veiculos?.roles || DEPARTMENTS.veiculos.roles;
  const totalStaff = settings?.departments?.veiculos?.totalStaff || DEPARTMENTS.veiculos.totalStaff;

  // Real-time calculations for Boracéia transfer in the currently edited date
  const totalPaletsBoraceia = useMemo(() => {
    return boraceiaShipments.reduce((acc, s) => acc + (Number(s.paletsCount) || 0), 0);
  }, [boraceiaShipments]);

  // Identify shipments from yesterday or previous days that left SP but have no arrival time or are not finalized
  const pendingArrivalShipments = useMemo(() => {
    const list: Array<{
      logId: string;
      logDate: string;
      shipmentIndex: number;
      shipment: BoraceiaShipment;
    }> = [];

    logs.forEach((l: any) => {
      const shipments: BoraceiaShipment[] = l.data?.boraceiaShipments || [];
      shipments.forEach((s, idx) => {
        const hasActivity = Number(s.paletsCount) > 0 || s.driverName || s.departureTime;
        const isMissingArrival = !s.arrivalTimeSP || s.arrivalTimeSP.trim() === '';
        const isNotFinalized = s.status !== 'Finalizado';
        if (hasActivity && (isMissingArrival || isNotFinalized)) {
          list.push({
            logId: l.id,
            logDate: l.date,
            shipmentIndex: idx,
            shipment: s
          });
        }
      });
    });

    return list;
  }, [logs]);

  const handleAddShipment = () => {
    if (boraceiaShipments.length >= 2) return;
    const newShipment: BoraceiaShipment = {
      id: `carreta-${Date.now()}`,
      vehiclePlate: '',
      vehicleModel: `Carreta 0${boraceiaShipments.length + 1}`,
      paletsCount: 0,
      driverName: '',
      departureTime: '',
      arrivalTimeSP: '',
      isNextDayArrival: false,
      status: 'Agendado',
      observation: ''
    };
    setBoraceiaShipments([...boraceiaShipments, newShipment]);
  };

  const handleRemoveShipment = (index: number) => {
    if (boraceiaShipments.length <= 1) {
      // Reset the single item
      setBoraceiaShipments([{
        id: 'carreta-1',
        vehiclePlate: '',
        vehicleModel: 'Carreta 01',
        paletsCount: 0,
        driverName: '',
        departureTime: '',
        arrivalTimeSP: '',
        isNextDayArrival: false,
        status: 'Agendado',
        observation: ''
      }]);
      return;
    }
    const updated = boraceiaShipments.filter((_, i) => i !== index);
    setBoraceiaShipments(updated);
  };

  const handleUpdateShipment = (index: number, field: keyof BoraceiaShipment, value: any) => {
    const updated = [...boraceiaShipments];
    updated[index] = {
      ...updated[index],
      [field]: value
    };
    
    // Auto-adjust status if arrival time is provided
    if (field === 'arrivalTimeSP' && value && value.trim() !== '') {
      if (updated[index].status === 'Agendado' || updated[index].status === 'Em Trânsito' || updated[index].status === 'Em Retorno SP') {
        updated[index].status = 'Finalizado';
      }
    }

    setBoraceiaShipments(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    const logRef = collection(db, 'logs');
    const existingLog = logs.find(l => l.date === selectedDate);

    const cleanStaffByRole: Record<string, number> = {};
    roles.forEach((r: string) => {
      cleanStaffByRole[r] = Number(staffByRole[r]) || 0;
    });

    const logData = {
      date: selectedDate,
      departmentId: 'veiculos' as DepartmentId,
      staffPresent: Number(staffPresent) || 0,
      staffByRole: cleanStaffByRole,
      data: {
        driversCount: Number(driversCount) || 0,
        registeredVehicles,
        boraceiaShipments,
        totalBoraceiaPaletsSent: totalPaletsBoraceia,
      },
      updatedAt: serverTimestamp(),
      updatedBy: profile?.uid || 'user'
    };

    try {
      if (existingLog) {
        await setDoc(doc(db, 'logs', existingLog.id), logData, { merge: true });
      } else {
        await addDoc(logRef, { ...logData, occurrences: [] });
      }
      setSaveStatus('saved');

      try {
        await logAuditEvent({
          action: 'DAILY_LOG_UPDATE',
          category: 'VEHICLES',
          description: `Atualização dos dados de Veículos e Transferência Boracéia (${selectedDate.split('-').reverse().join('/')}).`,
          targetName: 'Veículos & Boracéia',
          severity: 'info',
          actorProfile: profile,
          details: {
            date: selectedDate,
            totalPalets: totalPaletsBoraceia,
            shipmentsCount: boraceiaShipments.length
          }
        });
      } catch (auditErr) {
        console.warn('Audit log error:', auditErr);
      }

      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch (error) {
      setSaveStatus('idle');
      console.error('Error saving vehicles log:', error);
      handleFirestoreError(error, OperationType.WRITE, `logs/${existingLog?.id || 'new'}`);
    }
  };

  // Fast resolution for quick arrival registration from pending banner or history list
  const handleSaveQuickArrival = async () => {
    if (!quickArrivalTarget) return;
    setQuickArrivalSaving(true);

    try {
      const targetLog = logs.find(l => l.id === quickArrivalTarget.logId || l.date === quickArrivalTarget.logDate);
      if (!targetLog) {
        throw new Error('Registro do dia não encontrado');
      }

      const existingShipments: BoraceiaShipment[] = [...(targetLog.data?.boraceiaShipments || [])];
      if (!existingShipments[quickArrivalTarget.shipmentIndex]) {
        throw new Error('Carreta não localizada no registro');
      }

      existingShipments[quickArrivalTarget.shipmentIndex] = {
        ...existingShipments[quickArrivalTarget.shipmentIndex],
        arrivalTimeSP: quickArrivalTime,
        isNextDayArrival: quickArrivalIsNextDay,
        status: 'Finalizado',
        observation: quickArrivalObs 
          ? (existingShipments[quickArrivalTarget.shipmentIndex].observation 
              ? `${existingShipments[quickArrivalTarget.shipmentIndex].observation} • ${quickArrivalObs}` 
              : quickArrivalObs)
          : existingShipments[quickArrivalTarget.shipmentIndex].observation
      };

      const updatedData = {
        ...(targetLog.data || {}),
        boraceiaShipments: existingShipments
      };

      await setDoc(doc(db, 'logs', targetLog.id), {
        data: updatedData,
        updatedAt: serverTimestamp(),
        updatedBy: profile?.uid || 'user'
      }, { merge: true });

      await logAuditEvent({
        action: 'VEHICLE_ARRIVAL_UPDATE',
        category: 'VEHICLES',
        description: `Horário de Chegada em SP registrado para ${quickArrivalTarget.shipment.driverName || 'Motorista'} (${quickArrivalTime} - ${quickArrivalIsNextDay ? 'Retorno Noturno/D+1' : 'Mesmo dia'}) na data ${quickArrivalTarget.logDate.split('-').reverse().join('/')}.`,
        targetName: 'Carreta Boracéia',
        severity: 'success',
        actorProfile: profile,
        details: {
          logDate: quickArrivalTarget.logDate,
          arrivalTimeSP: quickArrivalTime,
          isNextDayArrival: quickArrivalIsNextDay
        }
      });

      setQuickArrivalSuccess(true);
      setTimeout(() => {
        setQuickArrivalSaving(false);
        setQuickArrivalSuccess(false);
        setQuickArrivalTarget(null);
      }, 1500);

    } catch (err) {
      console.error('Failed to save quick arrival:', err);
      setQuickArrivalSaving(false);
      handleFirestoreError(err, OperationType.WRITE, `logs/${quickArrivalTarget.logId}`);
    }
  };

  const addOccurrence = async () => {
    if (!occurrenceTitle || !occurrence) return;
    const existingLog = logs.find(l => l.date === selectedDate);
    const newOcc = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      title: occurrenceTitle,
      description: occurrence,
      severity,
      isCritical
    };

    if (existingLog) {
      try {
        const updatedOccurrences = [...(existingLog.occurrences || []), newOcc];
        await setDoc(doc(db, 'logs', existingLog.id), { 
          occurrences: updatedOccurrences,
          isCritical: isCritical || existingLog.isCritical || false,
          timestamp: serverTimestamp()
        }, { merge: true });
        setOccurrenceTitle('');
        setOccurrence('');
        setIsCritical(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `logs/${existingLog.id}/occurrences`);
      }
    } else {
      alert("Por favor, registre e salve os dados do dia selecionado primeiro.");
    }
  };

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    'Agendado': { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-300', border: 'border-neutral-200 dark:border-neutral-700' },
    'Em Trânsito': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
    'Descarregando': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' },
    'Em Retorno SP': { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
    'Finalizado': { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700' },
  };

  const isEditingToday = selectedDate === today;
  const isEditingYesterday = selectedDate === yesterday;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-16">
      {/* Sub-tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
        <button 
          onClick={() => setActiveSubTab('frota')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${activeSubTab === 'frota' ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm border border-neutral-200/60 dark:border-neutral-700' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
        >
          <Truck size={15} />
          Gestão da Frota & Boracéia
        </button>
        <button 
          onClick={() => setActiveSubTab('planilha')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${activeSubTab === 'planilha' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'}`}
        >
          <FileSpreadsheet size={15} />
          Agenda Planilha (Consulta & Exportação)
        </button>
      </div>

      {activeSubTab === 'planilha' ? (
        <AgendaPlanilhaView 
          isViewer={true}
          customTitle="Agenda de Recebimento — Consulta Veículos"
          customDescription="Consulta e exportação da grade de agendamentos, previsão de caminhões e horários de descarga na doca."
        />
      ) : (
        <>
          {/* Header with Title and Date Switcher */}
          <header className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div>
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm shadow-blue-500/20">
                    <Truck size={22} />
                  </span>
                  <h2 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                    Veículos & Transportes
                  </h2>
                </div>
                <p className="text-neutral-500 dark:text-neutral-400 text-sm md:text-base">
                  Gestão da frota, motoristas em rota e controle de transferências de estoque para a Filial Boracéia
                </p>
              </div>
              
              {/* Date Switcher: Hoje, Ontem e Seletor de Data */}
              <div className="bg-white dark:bg-neutral-900 p-1.5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                    isEditingToday 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Sun size={14} />
                  <span>Hoje ({today.split('-').reverse().slice(0, 2).join('/')})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDate(yesterday)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                    isEditingYesterday 
                      ? 'bg-amber-600 text-white shadow-sm' 
                      : 'text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <Moon size={14} />
                  <span>Ontem ({yesterday.split('-').reverse().slice(0, 2).join('/')})</span>
                </button>

                <div className="flex items-center gap-1.5 pl-2 border-l border-neutral-200 dark:border-neutral-700">
                  <CalendarDays size={14} className="text-neutral-400" />
                  <input
                    type="date"
                    value={selectedDate}
                    max={today}
                    onChange={(e) => {
                      if (e.target.value) setSelectedDate(e.target.value);
                    }}
                    className="bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-xs font-bold px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Context Notice when editing past date */}
            {!isEditingToday && (
              <motion.div 
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-amber-500/10 border-2 border-amber-500/30 dark:bg-amber-950/30 dark:border-amber-700/50 p-4 rounded-2xl flex items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200"
              >
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-amber-500 text-white rounded-xl font-black">
                    <History size={16} />
                  </span>
                  <div>
                    <p className="font-black text-sm text-neutral-900 dark:text-white">
                      Editando Operação de {isEditingYesterday ? 'Ontem' : selectedDate.split('-').reverse().join('/')} ({selectedDate.split('-').reverse().join('/')})
                    </p>
                    <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-0.5">
                      Você pode adicionar ou corrigir o <strong>horário de chegada em SP (21h+ / Madrugada)</strong> e os dados das carretas deste dia.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDate(today)}
                  className="px-3 py-1.5 bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-bold rounded-xl border border-neutral-200 dark:border-neutral-700 text-xs flex items-center gap-1.5 transition-all shadow-sm shrink-0"
                >
                  <RotateCcw size={13} />
                  <span>Voltar para Hoje</span>
                </button>
              </motion.div>
            )}

            {/* ========================================================================= */}
            {/* PENDING ARRIVALS BANNER (Carretas que saíram ontem ou recente sem retorno) */}
            {/* ========================================================================= */}
            {pendingArrivalShipments.length > 0 && !isViewer && (
              <section className="bg-gradient-to-r from-purple-900/90 via-indigo-900/90 to-blue-900/90 text-white p-5 sm:p-6 rounded-3xl shadow-lg border border-purple-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/15">
                  <div className="flex items-center gap-3">
                    <span className="p-2.5 bg-purple-500 text-white rounded-2xl shadow-md">
                      <Moon size={20} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-purple-400/30 text-purple-200 border border-purple-300/30 font-extrabold uppercase px-2 py-0.5 rounded-full">
                          Retorno Noturno / D+1
                        </span>
                        <span className="text-xs font-bold text-purple-200">
                          {pendingArrivalShipments.length} {pendingArrivalShipments.length === 1 ? 'carreta aguardando' : 'carretas aguardando'} confirmação de chegada
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white mt-0.5">
                        Carretas com Chegada em SP Pendente
                      </h3>
                    </div>
                  </div>
                  <p className="text-xs text-purple-200/90 max-w-md">
                    Como o expediente termina às 17h e o motorista retorna à noite (21h+), confirme o horário real de chegada abaixo:
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {pendingArrivalShipments.map((item, idx) => {
                    const isYesterdayItem = item.logDate === yesterday;
                    const dateFormatted = item.logDate.split('-').reverse().join('/');
                    return (
                      <div 
                        key={`${item.logId}-${item.shipmentIndex}`}
                        className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/15 flex flex-col justify-between gap-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-400 text-amber-950">
                              {isYesterdayItem ? 'Viagem de Ontem' : `Viagem de ${dateFormatted}`}
                            </span>
                            <h4 className="font-black text-sm text-white mt-1">
                              {item.shipment.vehicleModel || `Carreta 0${item.shipmentIndex + 1}`} {item.shipment.vehiclePlate && `(${item.shipment.vehiclePlate})`}
                            </h4>
                            <p className="text-xs text-purple-200 flex items-center gap-1.5 mt-0.5">
                              <UserIcon size={12} />
                              <strong>{item.shipment.driverName || 'Motorista não informado'}</strong>
                              <span>•</span>
                              <span>{item.shipment.paletsCount || 0} palets</span>
                            </p>
                          </div>

                          <div className="text-right text-xs">
                            <span className="text-purple-300 block text-[10px] uppercase font-bold">Saída SP</span>
                            <strong className="text-white font-black text-sm">{item.shipment.departureTime || '--:--'}</strong>
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                          <span className="text-xs text-purple-200">
                            Chegada: <strong className="text-amber-300">{item.shipment.arrivalTimeSP || 'Ainda não registrada'}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setQuickArrivalTarget(item);
                              setQuickArrivalTime(item.shipment.arrivalTimeSP || '21:30');
                              setQuickArrivalIsNextDay(true);
                              setQuickArrivalObs(item.shipment.observation || '');
                            }}
                            className="px-3.5 py-2 bg-white hover:bg-purple-50 text-purple-900 font-black rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 active:scale-95"
                          >
                            <Clock size={14} className="text-purple-600" />
                            <span>Registrar Chegada (21h+)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Quick KPI Stat Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-2xl border border-amber-200/80 dark:border-amber-800/50 shadow-sm flex items-center gap-3.5">
                <div className="p-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
                  <Package size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider block">
                    Palets p/ Boracéia ({isEditingToday ? 'Hoje' : isEditingYesterday ? 'Ontem' : selectedDate.split('-').reverse().slice(0, 2).join('/')})
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-baseline gap-1">
                    {totalPaletsBoraceia}
                    <span className="text-xs font-normal text-neutral-400">palets</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
                <div className="p-3 bg-blue-500/15 text-blue-600 dark:text-blue-400 rounded-xl shrink-0">
                  <ArrowRightLeft size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-neutral-400 dark:text-neutral-500 tracking-wider block">
                    Carretas em Rota
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-baseline gap-1">
                    {boraceiaShipments.length}
                    <span className="text-xs font-normal text-neutral-400">de 2 max</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
                <div className="p-3 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-xl shrink-0">
                  <UserIcon size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-neutral-400 dark:text-neutral-500 tracking-wider block">
                    Motoristas Ativos
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-baseline gap-1">
                    {driversCount}
                    <span className="text-xs font-normal text-neutral-400">em operação</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center gap-3.5">
                <div className="p-3 bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-xl shrink-0">
                  <Truck size={22} />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-neutral-400 dark:text-neutral-500 tracking-wider block">
                    Veículos em Operação
                  </span>
                  <div className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white flex items-baseline gap-1">
                    {registeredVehicles.length}
                    <span className="text-xs font-normal text-neutral-400">/{vehicles.length} frota</span>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* ========================================================================= */}
            {/* SEÇÃO PRINCIPAL: ENVIO PARA BORACÉIA (FULL WIDTH / GRID 2-COL BALANCEADO) */}
            {/* ========================================================================= */}
            <section className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/40 dark:via-neutral-900/90 dark:to-neutral-900 rounded-3xl p-6 sm:p-8 border-2 border-amber-300/80 dark:border-amber-700/60 shadow-md shadow-amber-500/5 space-y-6">
              
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-amber-200/70 dark:border-amber-800/40">
                <div className="flex items-center gap-3.5">
                  <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
                    <ArrowRightLeft size={24} />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] bg-amber-500 text-white font-extrabold uppercase px-2.5 py-0.5 rounded-full shadow-sm">
                        Rota SP ⇄ Boracéia
                      </span>
                      <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        Transferência Diária de Estoque ({isEditingToday ? 'Hoje' : isEditingYesterday ? 'Ontem' : selectedDate.split('-').reverse().join('/')})
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-white mt-1">
                      Envio para Boracéia
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="bg-white dark:bg-neutral-900 border-2 border-amber-300 dark:border-amber-600 px-5 py-2 rounded-2xl text-right shadow-sm">
                    <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 block leading-none">
                      Total Palets ({isEditingToday ? 'Hoje' : isEditingYesterday ? 'Ontem' : selectedDate.split('-').reverse().slice(0, 2).join('/')})
                    </span>
                    <span className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white leading-none mt-1 block">
                      {totalPaletsBoraceia} <span className="text-xs font-semibold text-neutral-400">palets</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Operational Guidance Notice with Night Return Context */}
              <div className="bg-amber-100/70 dark:bg-amber-900/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                <Info size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1 leading-relaxed">
                  <p>
                    Registre abaixo as carretas responsáveis pelo abastecimento da <strong>Filial Boracéia</strong>. Preencha a <strong>quantidade de palets</strong>, o <strong>motorista</strong>, o <strong>horário de saída de SP</strong> e o <strong>horário de retorno/chegada em SP</strong>.
                  </p>
                  <p className="text-amber-800 dark:text-amber-300 font-semibold">
                    🌙 <strong>Horário de Chegada em SP:</strong> Como o turno encerra às 17h e o motorista frequentemente retorna às <strong>21h, 22h ou na madrugada</strong>, o sistema permite registrar ou atualizar o horário de chegada a qualquer momento ou no dia seguinte normalmente.
                  </p>
                </div>
              </div>

              {/* Carretas Grid */}
              <div className={`grid grid-cols-1 ${boraceiaShipments.length > 1 ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-6`}>
                {boraceiaShipments.map((shipment, index) => {
                  const currentStatus = shipment.status || 'Agendado';
                  const style = statusColors[currentStatus] || statusColors['Agendado'];

                  return (
                    <div 
                      key={shipment.id || index}
                      className="bg-white dark:bg-neutral-900 p-6 sm:p-7 rounded-2xl border-2 border-amber-200 dark:border-neutral-800 shadow-sm relative overflow-hidden transition-all hover:border-amber-400 dark:hover:border-amber-600/70 flex flex-col justify-between"
                    >
                      {/* Header of Carreta Card */}
                      <div>
                        <div className="flex items-center justify-between pb-4 mb-5 border-b border-neutral-100 dark:border-neutral-800">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black text-base shadow-sm">
                              #{index + 1}
                            </div>
                            <div>
                              <h4 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                                {index === 0 ? 'Carreta 01 (Principal)' : 'Carreta 02 (Complementar)'}
                              </h4>
                              <p className="text-xs text-neutral-400">Transferência de estoque SP ➔ Boracéia</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                              {currentStatus}
                            </span>
                            {boraceiaShipments.length > 1 && !isViewer && (
                              <button
                                type="button"
                                onClick={() => handleRemoveShipment(index)}
                                className="text-neutral-400 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                title="Remover esta 2ª carreta"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inputs Layout */}
                        <div className="space-y-4">
                          
                          {/* Row 1: Palets (Em destaque) & Motorista */}
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                            <div className="sm:col-span-5">
                              <label className="block text-xs font-black uppercase text-amber-700 dark:text-amber-400 mb-1.5 flex items-center gap-1.5">
                                <Package size={14} />
                                Palets Enviados *
                              </label>
                              <div className="relative">
                                <input 
                                  type="number"
                                  min="0"
                                  disabled={isViewer}
                                  value={shipment.paletsCount || ''}
                                  onChange={(e) => handleUpdateShipment(index, 'paletsCount', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full pl-4 pr-16 py-3 rounded-xl border-2 border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 text-neutral-900 dark:text-white font-black text-xl focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
                                />
                                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-amber-700 dark:text-amber-400 font-black">
                                  palets
                                </span>
                              </div>
                            </div>

                            <div className="sm:col-span-7">
                              <label className="block text-xs font-black uppercase text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                                <UserIcon size={14} className="text-blue-500" />
                                Motorista Responsável *
                              </label>
                              <input 
                                type="text"
                                disabled={isViewer}
                                value={shipment.driverName || ''}
                                onChange={(e) => handleUpdateShipment(index, 'driverName', e.target.value)}
                                placeholder="Nome do motorista condutor"
                                className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                              />
                            </div>
                          </div>

                          {/* Row 2: Horários Saída & Chegada com Suporte a Horário Noturno */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-black uppercase text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                                <Clock size={14} className="text-emerald-500" />
                                Horário de Saída (SP) *
                              </label>
                              <input 
                                type="time"
                                disabled={isViewer}
                                value={shipment.departureTime || ''}
                                onChange={(e) => handleUpdateShipment(index, 'departureTime', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-black uppercase text-neutral-600 dark:text-neutral-400 flex items-center gap-1.5">
                                  <Clock size={14} className="text-purple-500" />
                                  Horário de Chegada em SP *
                                </label>
                                <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold">
                                  Turno Noturno / D+1
                                </span>
                              </div>
                              <input 
                                type="time"
                                disabled={isViewer}
                                value={shipment.arrivalTimeSP || ''}
                                onChange={(e) => handleUpdateShipment(index, 'arrivalTimeSP', e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border-2 border-purple-300 dark:border-purple-700/60 bg-purple-50/30 dark:bg-purple-950/20 text-neutral-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-60"
                              />

                              {/* Quick Time Pills for Common Late Returns */}
                              {!isViewer && (
                                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                                  <span className="text-[10px] text-neutral-400 font-bold">Atalhos:</span>
                                  {['20:30', '21:00', '21:30', '22:00', '22:30', '23:00'].map((timeStr) => (
                                    <button
                                      key={timeStr}
                                      type="button"
                                      onClick={() => {
                                        handleUpdateShipment(index, 'arrivalTimeSP', timeStr);
                                        handleUpdateShipment(index, 'isNextDayArrival', true);
                                      }}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition-all ${
                                        shipment.arrivalTimeSP === timeStr 
                                          ? 'bg-purple-600 text-white border-purple-600' 
                                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-purple-100 dark:hover:bg-purple-900/30'
                                      }`}
                                    >
                                      {timeStr}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Checkbox: Retorno no Turno Noturno / D+1 */}
                          <div className="bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input 
                                type="checkbox"
                                disabled={isViewer}
                                checked={shipment.isNextDayArrival || false}
                                onChange={(e) => handleUpdateShipment(index, 'isNextDayArrival', e.target.checked)}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                              />
                              <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                                <Moon size={14} className="text-purple-500" />
                                Retorno no turno noturno / dia seguinte (D+1)
                              </span>
                            </label>
                            {shipment.arrivalTimeSP && (
                              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                Chegada: {shipment.arrivalTimeSP} {shipment.isNextDayArrival ? '(Noturno)' : ''}
                              </span>
                            )}
                          </div>

                          {/* Row 3: Placa & Status da Viagem */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1 flex items-center gap-1.5">
                                <Truck size={14} />
                                Placa / Identificação Carreta
                              </label>
                              <input 
                                type="text"
                                disabled={isViewer}
                                value={shipment.vehiclePlate || ''}
                                onChange={(e) => handleUpdateShipment(index, 'vehiclePlate', e.target.value)}
                                placeholder="Ex: ABC-1234 (Cavalo Scania)"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-neutral-600 dark:text-neutral-400 mb-1">
                                Status do Envio / Viagem
                              </label>
                              <select
                                disabled={isViewer}
                                value={shipment.status || 'Agendado'}
                                onChange={(e) => handleUpdateShipment(index, 'status', e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                              >
                                <option value="Agendado">Agendado (Aguardando saída em SP)</option>
                                <option value="Em Trânsito">Em Trânsito (A caminho de Boracéia)</option>
                                <option value="Descarregando">Descarregando (Na Filial Boracéia)</option>
                                <option value="Em Retorno SP">Em Retorno (Voltando para SP)</option>
                                <option value="Finalizado">Finalizado (Chegou em SP e concluiu)</option>
                              </select>
                            </div>
                          </div>

                          {/* Row 4: Observações */}
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                              Observações da Viagem / Retorno de Paletes Vazios
                            </label>
                            <input 
                              type="text"
                              disabled={isViewer}
                              value={shipment.observation || ''}
                              onChange={(e) => handleUpdateShipment(index, 'observation', e.target.value)}
                              placeholder="Ex: Retornou às 21:40 com 32 paletes vazios, descarga no dia seguinte."
                              className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            />
                          </div>

                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add 2nd Carreta Button */}
              {boraceiaShipments.length < 2 && !isViewer && (
                <button
                  type="button"
                  onClick={handleAddShipment}
                  className="w-full py-4 px-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 hover:border-amber-500 dark:hover:border-amber-500 bg-white/70 dark:bg-neutral-900/70 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 text-amber-800 dark:text-amber-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Plus size={18} />
                  <span>Adicionar 2ª Carreta para Boracéia (Operação com 2 carretas neste dia)</span>
                </button>
              )}
            </section>

            {/* ========================================================================= */}
            {/* SEÇÃO 2: DUAS COLUNAS EQUILIBRADAS (FROTA/EQUIPE & OCORRÊNCIAS/HISTÓRICO) */}
            {/* ========================================================================= */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* COLUNA ESQUERDA: DADOS DA EQUIPE & FROTA GERAL (7 colunas) */}
              <div className="lg:col-span-7 space-y-8">
                <section className="bg-white dark:bg-neutral-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-600/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                        <Users size={22} />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                          Equipe & Motoristas ({isEditingToday ? 'Hoje' : selectedDate.split('-').reverse().join('/')})
                        </h3>
                        <p className="text-xs text-neutral-400">Presença diária e distribuição operacional</p>
                      </div>
                    </div>
                  </div>

                  {/* Colaboradores & Motoristas */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div className="bg-neutral-50/70 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60">
                      <label className="block text-xs font-black uppercase text-neutral-600 dark:text-neutral-300 mb-2">
                        Total Colaboradores Presentes
                      </label>
                      <input 
                        type="number" 
                        value={staffPresent}
                        disabled={isViewer}
                        onChange={(e) => setStaffPresent(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60"
                      />
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2 font-medium">
                        Total cadastrado do setor: <strong className="text-neutral-700 dark:text-neutral-300">{totalStaff}</strong>
                      </p>
                    </div>

                    <div className="bg-neutral-50/70 dark:bg-neutral-800/40 p-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60">
                      <label className="block text-xs font-black uppercase text-neutral-600 dark:text-neutral-300 mb-2">
                        Motoristas Trabalhando Hoje
                      </label>
                      <input 
                        type="number" 
                        value={driversCount}
                        disabled={isViewer}
                        onChange={(e) => setDriversCount(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold text-base focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60"
                      />
                      <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-2 font-medium">
                        Motoristas em rotas de entrega e transferência
                      </p>
                    </div>
                  </div>

                  {/* Colaboradores por Função */}
                  <div className="pt-2">
                    <h4 className="text-xs font-black uppercase text-neutral-400 dark:text-neutral-500 tracking-wider mb-3">
                      Colaboradores por Função
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {roles.map((role: string) => (
                        <div key={role} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/60 dark:bg-neutral-800/30 border border-neutral-100 dark:border-neutral-800">
                          <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">{role}</label>
                          <input 
                            type="number"
                            value={staffByRole[role] || 0}
                            disabled={isViewer}
                            onChange={(e) => setStaffByRole({...staffByRole, [role]: parseInt(e.target.value) || 0})}
                            className="w-20 px-3 py-1.5 text-center font-bold rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-xs disabled:opacity-60"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Veículos Cadastrados em Operação Hoje */}
                  <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-black uppercase text-neutral-400 dark:text-neutral-500 tracking-wider">
                        Veículos em Operação ({isEditingToday ? 'Hoje' : selectedDate.split('-').reverse().join('/')})
                      </h4>
                      <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full">
                        {registeredVehicles.length} selecionados
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 mb-3.5">
                      Selecione os veículos da frota Marsil que estão rodando nesta data:
                    </p>
                    
                    {vehicles.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic bg-neutral-50 dark:bg-neutral-800/50 p-4 rounded-xl text-center">
                        Nenhum veículo cadastrado nas Configurações do sistema.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {vehicles.map((v: any) => {
                          const itemLabel = `${v.plate} - ${v.model}`;
                          const isSelected = registeredVehicles.includes(itemLabel);
                          return (
                            <button
                              key={v.id || v.plate}
                              type="button"
                              disabled={isViewer}
                              onClick={() => {
                                const next = isSelected 
                                  ? registeredVehicles.filter(i => i !== itemLabel) 
                                  : [...registeredVehicles, itemLabel];
                                setRegisteredVehicles(next);
                              }}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-md shadow-blue-500/20'
                                  : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                              } disabled:opacity-60`}
                            >
                              {isSelected ? (
                                <Check size={14} className="stroke-[3]" />
                              ) : (
                                <Truck size={14} className="opacity-60" />
                              )}
                              <span>{itemLabel}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Botão de Salvar Dados Geral */}
                  {!isViewer && (
                    <div className="pt-4 border-t border-neutral-100 dark:border-neutral-800">
                      <motion.button 
                        type="submit" 
                        disabled={saveStatus === 'saving'}
                        whileTap={{ scale: 0.98 }}
                        animate={
                          saveStatus === 'saved' 
                            ? { scale: [1, 1.02, 1] } 
                            : {}
                        }
                        className={`w-full py-4 px-6 rounded-2xl font-black text-sm transition-all shadow-lg flex items-center justify-center gap-2.5 ${
                          saveStatus === 'saved' 
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/30' 
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/25'
                        } disabled:opacity-60`}
                      >
                        {saveStatus === 'saving' ? (
                          <div className="flex items-center gap-2">
                            <Loader2 className="animate-spin" size={20} />
                            <span>Salvando Dados de Veículos & Boracéia ({selectedDate.split('-').reverse().join('/')})...</span>
                          </div>
                        ) : saveStatus === 'saved' ? (
                          <motion.div 
                            initial={{ scale: 0.85, opacity: 0 }} 
                            animate={{ scale: 1, opacity: 1 }} 
                            className="flex items-center gap-2 text-white"
                          >
                            <CheckCircle2 size={22} className="animate-bounce" />
                            <span className="text-base font-black">Dados de Veículos e Boracéia Salvos com Sucesso! ✓</span>
                          </motion.div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Save size={20} />
                            <span className="text-base">
                              Salvar Dados de Veículos & Envio Boracéia ({isEditingToday ? 'Hoje' : selectedDate.split('-').reverse().join('/')})
                            </span>
                          </div>
                        )}
                      </motion.button>
                    </div>
                  )}

                </section>
              </div>

              {/* COLUNA DIREITA: OCORRÊNCIAS & HISTÓRICO RECENTE (5 colunas) */}
              <div className="lg:col-span-5 space-y-8">
                
                {/* 1. Registrar Ocorrência de Frota */}
                {!isViewer && (
                  <section className="bg-white dark:bg-neutral-900 p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-black flex items-center gap-2 dark:text-white">
                        <AlertCircle size={19} className="text-amber-500" />
                        Registrar Ocorrência
                      </h3>
                      <span className="text-[10px] bg-neutral-100 dark:bg-neutral-800 text-neutral-500 font-bold px-2 py-0.5 rounded-full uppercase">
                        Frota & Transporte
                      </span>
                    </div>

                    <div className="space-y-3.5">
                      <div>
                        <label className="block text-[11px] font-black uppercase text-neutral-400 dark:text-neutral-500 mb-1">
                          Título da Ocorrência
                        </label>
                        <input 
                          type="text" 
                          placeholder="Ex: Atraso na Carreta SP-Boracéia / Pneu furado" 
                          value={occurrenceTitle}
                          onChange={(e) => setOccurrenceTitle(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-black uppercase text-neutral-400 dark:text-neutral-500 mb-1">
                          Descrição Detalhada
                        </label>
                        <textarea 
                          placeholder="Descreva o ocorrido e as ações tomadas..." 
                          value={occurrence}
                          onChange={(e) => setOccurrence(e.target.value)}
                          rows={3}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3 items-center">
                        <div>
                          <label className="block text-[10px] font-black uppercase text-neutral-400 mb-1">Severidade</label>
                          <select 
                            value={severity}
                            onChange={(e: any) => setSeverity(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold outline-none"
                          >
                            <option value="low">Baixa</option>
                            <option value="medium">Média</option>
                            <option value="high">Alta</option>
                          </select>
                        </div>
                        <div className="flex items-center gap-2 pt-4">
                          <input 
                            type="checkbox" 
                            id="crit-occ-veiculos"
                            checked={isCritical}
                            onChange={(e) => setIsCritical(e.target.checked)}
                            className="w-4 h-4 text-red-600 rounded"
                          />
                          <label htmlFor="crit-occ-veiculos" className="text-xs font-bold text-red-600 dark:text-red-400 cursor-pointer">
                            Crítica? (Alerta geral)
                          </label>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={addOccurrence}
                        className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 mt-1"
                      >
                        <Plus size={15} />
                        <span>Publicar Ocorrência de Veículos</span>
                      </button>
                    </div>
                  </section>
                )}

                {/* 2. Histórico de Envios para Boracéia com Ações Rápidas */}
                <section className="bg-white dark:bg-neutral-900 p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-neutral-400 dark:text-neutral-500 tracking-wider flex items-center gap-2">
                      <Clock size={15} className="text-amber-500" />
                      Histórico de Envios (Boracéia)
                    </h4>
                    <span className="text-[10px] text-neutral-400 font-bold">Últimos dias</span>
                  </div>

                  <div className="space-y-3 max-h-[460px] overflow-y-auto custom-scrollbar pr-1">
                    {logs.length === 0 ? (
                      <p className="text-xs text-neutral-400 italic text-center py-4">Nenhum registro anterior encontrado.</p>
                    ) : (
                      logs.map((log: any) => {
                        const shipments: BoraceiaShipment[] = log.data?.boraceiaShipments || [];
                        const totalPalets = log.data?.totalBoraceiaPaletsSent ?? shipments.reduce((a, s) => a + (Number(s.paletsCount) || 0), 0);
                        const formattedDate = log.date ? log.date.split('-').reverse().join('/') : 'Data não informada';
                        const isThisDayActive = log.date === selectedDate;
                        const isTodayLog = log.date === today;

                        return (
                          <div 
                            key={log.id}
                            className={`p-4 rounded-2xl border space-y-2.5 text-xs transition-all ${
                              isThisDayActive 
                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-400 dark:border-amber-600 ring-2 ring-amber-500/20' 
                                : 'bg-neutral-50/70 dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-700/50 hover:border-neutral-300 dark:hover:border-neutral-600'
                            }`}
                          >
                            <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-white">
                              <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 font-black text-xs">
                                  <Calendar size={13} className="text-neutral-400" />
                                  {formattedDate}
                                </span>
                                {isTodayLog && (
                                  <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-extrabold uppercase">
                                    Hoje
                                  </span>
                                )}
                                {isThisDayActive && !isTodayLog && (
                                  <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.2 rounded font-extrabold uppercase">
                                    No Formulário
                                  </span>
                                )}
                              </div>
                              <span className="text-amber-600 dark:text-amber-400 font-black text-xs">
                                {totalPalets} palets
                              </span>
                            </div>

                            {shipments.length === 0 ? (
                              <p className="text-[11px] text-neutral-400 italic">Sem carretas registradas neste dia.</p>
                            ) : (
                              <div className="space-y-2 pt-1">
                                {shipments.map((s, idx) => {
                                  const hasArrival = s.arrivalTimeSP && s.arrivalTimeSP.trim() !== '';
                                  return (
                                    <div key={idx} className="bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 text-[11px] space-y-1.5">
                                      <div className="flex justify-between items-center font-bold">
                                        <span className="text-neutral-800 dark:text-neutral-200 flex items-center gap-1.5">
                                          <span className="w-4 h-4 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black text-[9px] flex items-center justify-center">
                                            #{idx + 1}
                                          </span>
                                          {s.driverName || `Carreta 0${idx + 1}`}
                                        </span>
                                        <span className="font-extrabold text-amber-600 dark:text-amber-400">
                                          {s.paletsCount || 0} palets
                                        </span>
                                      </div>

                                      <div className="text-[10px] text-neutral-400 flex items-center justify-between pt-1 border-t border-neutral-50 dark:border-neutral-800">
                                        <span>Saída SP: <strong>{s.departureTime || '--:--'}</strong></span>
                                        <span className="flex items-center gap-1">
                                          Chegada SP: 
                                          <strong className={hasArrival ? 'text-purple-600 dark:text-purple-400' : 'text-neutral-400'}>
                                            {s.arrivalTimeSP || '--:--'}
                                          </strong>
                                          {s.isNextDayArrival && (
                                            <span className="text-[8px] bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 font-extrabold px-1 rounded">
                                              D+1
                                            </span>
                                          )}
                                        </span>
                                      </div>

                                      {/* Quick Action Button if arrival is missing */}
                                      {!hasArrival && !isViewer && (
                                        <div className="pt-1 flex justify-end">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setQuickArrivalTarget({
                                                logId: log.id,
                                                logDate: log.date,
                                                shipmentIndex: idx,
                                                shipment: s
                                              });
                                              setQuickArrivalTime('21:30');
                                              setQuickArrivalIsNextDay(true);
                                              setQuickArrivalObs(s.observation || '');
                                            }}
                                            className="text-[10px] font-black text-purple-600 dark:text-purple-400 hover:text-purple-700 flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-lg border border-purple-200 dark:border-purple-800/60"
                                          >
                                            <Clock size={11} />
                                            <span>Informar Chegada em SP</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Button to load this day in form if not selected */}
                            {!isThisDayActive && (
                              <div className="pt-1 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDate(log.date)}
                                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                >
                                  <span>Carregar este dia para edição ➔</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

              </div>
            </div>

          </form>

          {/* ========================================================================= */}
          {/* MODAL / BOTTOM SHEET DE REGISTRO RÁPIDO DE CHEGADA EM SP (21H+ / D+1) */}
          {/* ========================================================================= */}
          <AnimatePresence>
            {quickArrivalTarget && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: 15 }}
                  className="bg-white dark:bg-neutral-900 w-full max-w-lg rounded-3xl p-6 sm:p-7 shadow-2xl border border-neutral-200 dark:border-neutral-800 space-y-5"
                >
                  <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-neutral-800">
                    <div className="flex items-center gap-3">
                      <span className="p-2.5 bg-purple-600 text-white rounded-2xl shadow-sm">
                        <Moon size={20} />
                      </span>
                      <div>
                        <h3 className="text-lg font-black text-neutral-900 dark:text-white">
                          Registrar Chegada em SP
                        </h3>
                        <p className="text-xs text-neutral-400">
                          Operação de {quickArrivalTarget.logDate.split('-').reverse().join('/')} (Saída: {quickArrivalTarget.shipment.departureTime || '--:--'})
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setQuickArrivalTarget(null)}
                      className="p-2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Summary of Carreta */}
                  <div className="bg-purple-50/60 dark:bg-purple-950/20 p-4 rounded-2xl border border-purple-100 dark:border-purple-800/40 text-xs space-y-1">
                    <div className="flex justify-between items-center font-bold text-neutral-900 dark:text-white">
                      <span>{quickArrivalTarget.shipment.vehicleModel || `Carreta 0${quickArrivalTarget.shipmentIndex + 1}`}</span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">{quickArrivalTarget.shipment.paletsCount || 0} palets</span>
                    </div>
                    <p className="text-neutral-500 dark:text-neutral-400">
                      Motorista: <strong className="text-neutral-800 dark:text-neutral-200">{quickArrivalTarget.shipment.driverName || 'Não informado'}</strong>
                    </p>
                  </div>

                  {/* Input of Arrival Time */}
                  <div className="space-y-3">
                    <label className="block text-xs font-black uppercase text-neutral-700 dark:text-neutral-300">
                      Horário de Retorno / Chegada em SP *
                    </label>
                    <div className="relative">
                      <input 
                        type="time" 
                        value={quickArrivalTime}
                        onChange={(e) => setQuickArrivalTime(e.target.value)}
                        className="w-full px-4 py-3 rounded-2xl border-2 border-purple-300 dark:border-purple-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xl font-black outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>

                    {/* Quick Time Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] text-neutral-400 font-bold">Horários Comuns:</span>
                      {['20:30', '21:00', '21:30', '22:00', '22:30', '23:00', '00:30'].map((timeStr) => (
                        <button
                          key={timeStr}
                          type="button"
                          onClick={() => setQuickArrivalTime(timeStr)}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all ${
                            quickArrivalTime === timeStr 
                              ? 'bg-purple-600 text-white border-purple-600 shadow-sm' 
                              : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-purple-100'
                          }`}
                        >
                          {timeStr}
                        </button>
                      ))}
                    </div>

                    {/* D+1 / Noturno Checkbox */}
                    <div className="bg-neutral-50 dark:bg-neutral-800/40 p-3 rounded-xl border border-neutral-100 dark:border-neutral-800 flex items-center justify-between mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox"
                          checked={quickArrivalIsNextDay}
                          onChange={(e) => setQuickArrivalIsNextDay(e.target.checked)}
                          className="w-4 h-4 text-purple-600 rounded"
                        />
                        <span className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                          Chegada após às 17h / Turno Noturno ou Dia Seguinte (D+1)
                        </span>
                      </label>
                    </div>

                    {/* Optional Note */}
                    <div>
                      <label className="block text-xs font-bold text-neutral-500 mb-1">
                        Observação do Retorno / Paletes Vazios (Opcional)
                      </label>
                      <input 
                        type="text"
                        value={quickArrivalObs}
                        onChange={(e) => setQuickArrivalObs(e.target.value)}
                        placeholder="Ex: Chegou com 30 paletes vazios, descarregado."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setQuickArrivalTarget(null)}
                      className="flex-1 py-3 px-4 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-bold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      disabled={quickArrivalSaving || !quickArrivalTime}
                      onClick={handleSaveQuickArrival}
                      className="flex-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-black shadow-md shadow-purple-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-60"
                    >
                      {quickArrivalSaving ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : quickArrivalSuccess ? (
                        <CheckCircle2 size={16} className="text-white" />
                      ) : (
                        <Save size={16} />
                      )}
                      <span>
                        {quickArrivalSaving ? 'Salvando...' : quickArrivalSuccess ? 'Chegada Confirmada! ✓' : 'Salvar e Concluir Chegada'}
                      </span>
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
