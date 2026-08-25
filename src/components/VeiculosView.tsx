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
  Info
} from 'lucide-react';
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
import { DEPARTMENTS } from '../constants';
import { DepartmentId, BoraceiaShipment, UserProfile, Vehicle } from '../types';

interface VeiculosViewProps {
  profile: UserProfile | null;
}

export function VeiculosView({ profile }: VeiculosViewProps) {
  const isViewer = profile?.departmentId === 'viewer';
  const [settings, setSettings] = useState<any>(null);
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
  const today = new Date().toLocaleDateString('en-CA');

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
      limit(7)
    );

    const unsubLogs = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(d => ({ id: d.id, ...d.data() as any }));
      setLogs(logsData);
      const todayLog = logsData.find((d: any) => d.date === today);
      if (todayLog) {
        setStaffPresent(todayLog.staffPresent || 0);
        setStaffByRole(todayLog.staffByRole || {});
        setDriversCount(todayLog.data?.driversCount || 0);
        setRegisteredVehicles(todayLog.data?.registeredVehicles || []);
        
        if (todayLog.data?.boraceiaShipments && Array.isArray(todayLog.data.boraceiaShipments) && todayLog.data.boraceiaShipments.length > 0) {
          setBoraceiaShipments(todayLog.data.boraceiaShipments);
        }
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs/veiculos');
    });

    return () => {
      unsubSettings();
      unsubLogs();
    };
  }, [today]);

  const vehicles: Vehicle[] = settings?.vehicles || [];
  const roles = settings?.departments?.veiculos?.roles || DEPARTMENTS.veiculos.roles;
  const totalStaff = settings?.departments?.veiculos?.totalStaff || DEPARTMENTS.veiculos.totalStaff;

  // Real-time calculations for Boracéia transfer
  const totalPaletsBoraceia = useMemo(() => {
    return boraceiaShipments.reduce((acc, s) => acc + (Number(s.paletsCount) || 0), 0);
  }, [boraceiaShipments]);

  const activeShipmentsCount = useMemo(() => {
    return boraceiaShipments.filter(s => (Number(s.paletsCount) > 0 || s.driverName || s.departureTime)).length;
  }, [boraceiaShipments]);

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
    setBoraceiaShipments(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    const logRef = collection(db, 'logs');
    const existingLog = logs.find(l => l.date === today);

    const logData = {
      date: today,
      departmentId: 'veiculos' as DepartmentId,
      staffPresent,
      staffByRole,
      data: {
        driversCount,
        registeredVehicles,
        boraceiaShipments,
        totalBoraceiaPaletsSent: totalPaletsBoraceia,
      },
      updatedAt: serverTimestamp(),
      updatedBy: profile?.uid
    };

    try {
      if (existingLog) {
        await setDoc(doc(db, 'logs', existingLog.id), logData, { merge: true });
      } else {
        await addDoc(logRef, { ...logData, occurrences: [] });
      }
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3500);
    } catch (error) {
      setSaveStatus('idle');
      handleFirestoreError(error, OperationType.WRITE, `logs/${existingLog?.id || 'new'}`);
    }
  };

  const addOccurrence = async () => {
    if (!occurrenceTitle || !occurrence) return;
    const existingLog = logs.find(l => l.date === today);
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
      alert("Por favor, registre e salve os dados do dia primeiro.");
    }
  };

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    'Agendado': { bg: 'bg-neutral-100 dark:bg-neutral-800', text: 'text-neutral-700 dark:text-neutral-300', border: 'border-neutral-200 dark:border-neutral-700' },
    'Em Trânsito': { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-700' },
    'Descarregando': { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-300 dark:border-amber-700' },
    'Em Retorno SP': { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-300 dark:border-purple-700' },
    'Finalizado': { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-300 dark:border-emerald-700' },
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-16">
      {/* Header with Title and Overview KPIs */}
      <header className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
          
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-2.5 rounded-2xl text-sm font-bold flex items-center gap-2 border border-blue-200 dark:border-blue-800 shadow-sm">
              <Calendar size={16} />
              <span>{new Date().toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</span>
            </div>
          </div>
        </div>

        {/* Quick KPI Stat Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-900 p-4 sm:p-5 rounded-2xl border border-amber-200/80 dark:border-amber-800/50 shadow-sm flex items-center gap-3.5">
            <div className="p-3 bg-amber-500/15 text-amber-600 dark:text-amber-400 rounded-xl shrink-0">
              <Package size={22} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase text-amber-600 dark:text-amber-400 tracking-wider block">
                Palets p/ Boracéia
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
                    Transferência Diária de Estoque (1 a 2 carretas)
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
                  Total Palets Hoje
                </span>
                <span className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white leading-none mt-1 block">
                  {totalPaletsBoraceia} <span className="text-xs font-semibold text-neutral-400">palets</span>
                </span>
              </div>
            </div>
          </div>

          {/* Operational Guidance Notice */}
          <div className="bg-amber-100/70 dark:bg-amber-900/30 p-4 rounded-2xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <Info size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="leading-relaxed">
              Registre abaixo as carretas responsáveis pelo abastecimento da <strong>Filial Boracéia</strong> no dia de hoje. Preencha a <strong>quantidade de palets</strong>, o <strong>motorista</strong> escalado, o <strong>horário de saída de SP</strong> e o <strong>horário de retorno/chegada em SP</strong>.
            </p>
          </div>

          {/* Carretas Grid (1 ou 2 lado a lado para perfeita distribuição) */}
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

                      {/* Row 2: Horários Saída & Chegada */}
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
                          <label className="block text-xs font-black uppercase text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                            <Clock size={14} className="text-purple-500" />
                            Horário de Chegada em SP *
                          </label>
                          <input 
                            type="time"
                            disabled={isViewer}
                            value={shipment.arrivalTimeSP || ''}
                            onChange={(e) => handleUpdateShipment(index, 'arrivalTimeSP', e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm font-bold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                          />
                        </div>
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
                          Observações da Viagem / Carga (Opcional)
                        </label>
                        <input 
                          type="text"
                          disabled={isViewer}
                          value={shipment.observation || ''}
                          onChange={(e) => handleUpdateShipment(index, 'observation', e.target.value)}
                          placeholder="Ex: Transferência de refrigerantes, retorno com 30 paletes vazios, etc."
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
              <span>Adicionar 2ª Carreta para Boracéia (Operação com 2 carretas hoje)</span>
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
                      Equipe & Motoristas
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
                    Veículos em Operação Hoje
                  </h4>
                  <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2.5 py-0.5 rounded-full">
                    {registeredVehicles.length} selecionados
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mb-3.5">
                  Selecione os veículos da frota Marsil que estão rodando na data de hoje:
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
                        <span>Salvando Dados do Setor Veículos & Boracéia...</span>
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
                        <span className="text-base">Salvar Dados de Veículos & Envio Boracéia</span>
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

            {/* 2. Histórico de Envios para Boracéia */}
            <section className="bg-white dark:bg-neutral-900 p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-black uppercase text-neutral-400 dark:text-neutral-500 tracking-wider flex items-center gap-2">
                  <Clock size={15} className="text-amber-500" />
                  Histórico de Envios (Boracéia)
                </h4>
                <span className="text-[10px] text-neutral-400 font-bold">Últimos dias</span>
              </div>

              <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                {logs.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic text-center py-4">Nenhum registro anterior encontrado.</p>
                ) : (
                  logs.map((log: any) => {
                    const shipments: BoraceiaShipment[] = log.data?.boraceiaShipments || [];
                    const totalPalets = log.data?.totalBoraceiaPaletsSent ?? shipments.reduce((a, s) => a + (Number(s.paletsCount) || 0), 0);
                    const formattedDate = log.date ? log.date.split('-').reverse().join('/') : 'Data não informada';
                    const isTodayLog = log.date === today;

                    return (
                      <div 
                        key={log.id}
                        className={`p-4 rounded-2xl border space-y-2.5 text-xs transition-all ${
                          isTodayLog 
                            ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700/60' 
                            : 'bg-neutral-50/70 dark:bg-neutral-800/40 border-neutral-100 dark:border-neutral-700/50'
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-white">
                          <span className="flex items-center gap-1.5 font-black text-xs">
                            <Calendar size={13} className="text-neutral-400" />
                            {formattedDate} {isTodayLog && <span className="text-[9px] bg-amber-500 text-white px-1.5 py-0.2 rounded font-extrabold uppercase">Hoje</span>}
                          </span>
                          <span className="text-amber-600 dark:text-amber-400 font-black text-xs">
                            {totalPalets} palets enviados
                          </span>
                        </div>

                        {shipments.length === 0 ? (
                          <p className="text-[11px] text-neutral-400 italic">Sem carretas registradas neste dia.</p>
                        ) : (
                          <div className="space-y-1.5 pt-1">
                            {shipments.map((s, idx) => (
                              <div key={idx} className="bg-white dark:bg-neutral-900 p-2.5 rounded-xl border border-neutral-100 dark:border-neutral-800 text-[11px]">
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
                                <div className="text-[10px] text-neutral-400 flex items-center justify-between mt-1 pt-1 border-t border-neutral-50 dark:border-neutral-800">
                                  <span>Saída SP: <strong>{s.departureTime || '--:--'}</strong></span>
                                  <span>Chegada SP: <strong>{s.arrivalTimeSP || '--:--'}</strong></span>
                                </div>
                              </div>
                            ))}
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
    </div>
  );
}
