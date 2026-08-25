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
    <div className="max-w-5xl space-y-8 pb-12">
      {/* Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <Truck size={20} />
            </span>
            <h2 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white">Veículos & Transportes</h2>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm md:text-base">
            Gestão diária da frota, motoristas e transferências de estoque para Boracéia
          </p>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-4 py-2 rounded-2xl text-sm font-bold flex items-center gap-2 border border-blue-200 dark:border-blue-800">
          <Calendar size={16} />
          {new Date().toLocaleDateString('pt-BR')}
        </div>
      </header>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <form onSubmit={handleSubmit} className="space-y-8">
            
            {/* SEÇÃO PRINCIPAL: ENVIO PARA BORACÉIA (TRANSFERÊNCIA DE ESTOQUE) */}
            <section className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent dark:from-amber-950/40 dark:via-neutral-900 dark:to-neutral-900 rounded-3xl p-6 sm:p-8 border-2 border-amber-400/80 dark:border-amber-500/50 shadow-md shadow-amber-500/5 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-amber-200/60 dark:border-amber-800/40">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
                    <ArrowRightLeft size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] bg-amber-500 text-white font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                        Rota SP ⇄ Boracéia
                      </span>
                      <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                        1 a 2 carretas diárias
                      </span>
                    </div>
                    <h3 className="text-xl font-black text-neutral-900 dark:text-white mt-1">
                      Envio para Boracéia (Transferência de Estoque)
                    </h3>
                  </div>
                </div>

                {/* KPI Summary */}
                <div className="flex items-center gap-3">
                  <div className="bg-white dark:bg-neutral-800/90 border border-amber-300 dark:border-amber-700/60 px-4 py-2 rounded-2xl text-right">
                    <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 block leading-none">
                      Total Palets Hoje
                    </span>
                    <span className="text-2xl font-black text-neutral-900 dark:text-white leading-none mt-1 block">
                      {totalPaletsBoraceia} <span className="text-xs font-normal text-neutral-400">palets</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Notice / Operational Guidance */}
              <div className="bg-amber-100/60 dark:bg-amber-900/30 p-3.5 rounded-2xl border border-amber-200 dark:border-amber-800/50 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
                <Info size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <p>
                  Registre aqui as carretas responsáveis pela transferência de estoque de São Paulo para a unidade <strong>Boracéia</strong>. Informe a <strong>quantidade de palets</strong>, <strong>motorista</strong>, <strong>horário de saída</strong> e <strong>horário de chegada em SP</strong>.
                </p>
              </div>

              {/* Carretas Form List */}
              <div className="space-y-6">
                {boraceiaShipments.map((shipment, index) => {
                  const currentStatus = shipment.status || 'Agendado';
                  const style = statusColors[currentStatus] || statusColors['Agendado'];

                  return (
                    <div 
                      key={shipment.id || index}
                      className="bg-white dark:bg-neutral-900 p-5 sm:p-6 rounded-2xl border border-amber-200 dark:border-neutral-800 shadow-sm relative overflow-hidden transition-all hover:border-amber-400"
                    >
                      {/* Header of Carreta Card */}
                      <div className="flex items-center justify-between pb-4 mb-4 border-b border-neutral-100 dark:border-neutral-800">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-sm">
                            #{index + 1}
                          </div>
                          <div>
                            <h4 className="text-base font-black text-neutral-900 dark:text-white flex items-center gap-2">
                              {index === 0 ? 'Carreta 01 (Principal)' : 'Carreta 02 (Complementar)'}
                              <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}>
                                {currentStatus}
                              </span>
                            </h4>
                            <p className="text-xs text-neutral-400">Transferência de estoque SP ➔ Boracéia</p>
                          </div>
                        </div>

                        {boraceiaShipments.length > 1 && !isViewer && (
                          <button
                            type="button"
                            onClick={() => handleRemoveShipment(index)}
                            className="text-neutral-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all text-xs font-bold flex items-center gap-1"
                            title="Remover esta carreta"
                          >
                            <Trash2 size={15} />
                            <span className="hidden sm:inline">Remover</span>
                          </button>
                        )}
                      </div>

                      {/* Input Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        
                        {/* 1. Quantidade de Palets */}
                        <div className="sm:col-span-2 lg:col-span-1">
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
                              className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 text-neutral-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-amber-500 outline-none disabled:opacity-60"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 font-bold">
                              palets
                            </span>
                          </div>
                        </div>

                        {/* 2. Motorista */}
                        <div className="sm:col-span-2 lg:col-span-1">
                          <label className="block text-xs font-black uppercase text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                            <UserIcon size={14} className="text-blue-500" />
                            Motorista *
                          </label>
                          <input 
                            type="text"
                            disabled={isViewer}
                            value={shipment.driverName || ''}
                            onChange={(e) => handleUpdateShipment(index, 'driverName', e.target.value)}
                            placeholder="Nome do Motorista"
                            className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                          />
                        </div>

                        {/* 3. Horário de Saída */}
                        <div>
                          <label className="block text-xs font-black uppercase text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                            <Clock size={14} className="text-emerald-500" />
                            Horário Saída (SP) *
                          </label>
                          <input 
                            type="time"
                            disabled={isViewer}
                            value={shipment.departureTime || ''}
                            onChange={(e) => handleUpdateShipment(index, 'departureTime', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                          />
                        </div>

                        {/* 4. Horário de Chegada em SP */}
                        <div>
                          <label className="block text-xs font-black uppercase text-neutral-600 dark:text-neutral-400 mb-1.5 flex items-center gap-1.5">
                            <Clock size={14} className="text-purple-500" />
                            Horário Chegada SP *
                          </label>
                          <input 
                            type="time"
                            disabled={isViewer}
                            value={shipment.arrivalTimeSP || ''}
                            onChange={(e) => handleUpdateShipment(index, 'arrivalTimeSP', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                          />
                        </div>

                        {/* 5. Placa / Identificação da Carreta */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1 flex items-center gap-1.5">
                            <Truck size={14} />
                            Placa / Identificação da Carreta
                          </label>
                          <input 
                            type="text"
                            disabled={isViewer}
                            value={shipment.vehiclePlate || ''}
                            onChange={(e) => handleUpdateShipment(index, 'vehiclePlate', e.target.value)}
                            placeholder="Ex: ABC-1234 (Carreta Scania)"
                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                          />
                        </div>

                        {/* 6. Status do Envio */}
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                            Status do Envio / Viagem
                          </label>
                          <select
                            disabled={isViewer}
                            value={shipment.status || 'Agendado'}
                            onChange={(e) => handleUpdateShipment(index, 'status', e.target.value)}
                            className="w-full px-3.5 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                          >
                            <option value="Agendado">Agendado (Aguardando saída em SP)</option>
                            <option value="Em Trânsito">Em Trânsito (A caminho de Boracéia)</option>
                            <option value="Descarregando">Descarregando (Na Filial Boracéia)</option>
                            <option value="Em Retorno SP">Em Retorno (Voltando para SP)</option>
                            <option value="Finalizado">Finalizado (Chegou em SP e concluiu)</option>
                          </select>
                        </div>

                        {/* 7. Observações */}
                        <div className="sm:col-span-4">
                          <label className="block text-xs font-bold text-neutral-500 dark:text-neutral-400 mb-1">
                            Observações do Envio (Opcional)
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
                  );
                })}
              </div>

              {/* Add 2nd Carreta Button */}
              {boraceiaShipments.length < 2 && !isViewer && (
                <button
                  type="button"
                  onClick={handleAddShipment}
                  className="w-full py-3.5 px-4 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 hover:border-amber-500 dark:hover:border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:bg-amber-100/50"
                >
                  <Plus size={16} />
                  <span>Adicionar 2ª Carreta para Boracéia (Máximo 2 carretas/dia)</span>
                </button>
              )}
            </section>

            {/* SEÇÃO: OPERAÇÃO GERAL DA FROTA E MOTORISTAS */}
            <section className="bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-6">
              <h3 className="text-lg font-bold flex items-center gap-2 dark:text-white">
                <Users size={20} className="text-blue-600 dark:text-blue-400" />
                Dados da Equipe e Frota Geral
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Total Colaboradores Presentes
                  </label>
                  <input 
                    type="number" 
                    value={staffPresent}
                    disabled={isViewer}
                    onChange={(e) => setStaffPresent(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60"
                  />
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">Total do setor: {totalStaff}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                    Motoristas Trabalhando Hoje
                  </label>
                  <input 
                    type="number" 
                    value={driversCount}
                    disabled={isViewer}
                    onChange={(e) => setDriversCount(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-60"
                  />
                  <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-2">Motoristas em rotas e entregas</p>
                </div>
              </div>

              {/* Colaboradores por Cargo */}
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-4">Colaboradores por Função</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {roles.map((role: string) => (
                    <div key={role}>
                      <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">{role}</label>
                      <input 
                        type="number"
                        value={staffByRole[role] || 0}
                        disabled={isViewer}
                        onChange={(e) => setStaffByRole({...staffByRole, [role]: parseInt(e.target.value) || 0})}
                        className="w-full px-3 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-60"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Veículos Cadastrados em Operação Hoje */}
              <div className="border-t border-neutral-100 dark:border-neutral-800 pt-6">
                <h4 className="text-sm font-bold text-neutral-900 dark:text-white mb-2">
                  Veículos em Operação Hoje ({registeredVehicles.length} selecionados)
                </h4>
                <p className="text-xs text-neutral-400 mb-3">Clique para selecionar os veículos da frota que estão rodando hoje:</p>
                
                {vehicles.length === 0 ? (
                  <p className="text-xs text-neutral-400 italic">Nenhum veículo cadastrado nas Configurações.</p>
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
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                              : 'bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                          } disabled:opacity-60`}
                        >
                          {isSelected && '✓ '}
                          {itemLabel}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Save Button */}
              {!isViewer && (
                <div className="pt-4">
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
                        <Loader2 className="animate-spin" size={19} />
                        <span>Salvando Dados do Setor Veículos...</span>
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
                        <Save size={19} />
                        <span>Salvar Dados de Veículos & Envio para Boracéia</span>
                      </div>
                    )}
                  </motion.button>
                </div>
              )}

            </section>

          </form>
        </div>

        {/* Sidebar: Occurrence Panel & History */}
        <div className="space-y-8">
          
          {/* Register Occurrence */}
          {!isViewer && (
            <section className="bg-white dark:bg-neutral-900 p-6 sm:p-7 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-4">
              <h3 className="text-base font-black flex items-center gap-2 dark:text-white">
                <AlertCircle size={18} className="text-amber-500" />
                Registrar Ocorrência de Frota
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">Título</label>
                  <input 
                    type="text" 
                    placeholder="Ex: Atraso na Carreta SP-Boracéia" 
                    value={occurrenceTitle}
                    onChange={(e) => setOccurrenceTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">Descrição</label>
                  <textarea 
                    placeholder="Detalhe o ocorrido..." 
                    value={occurrence}
                    onChange={(e) => setOccurrence(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase mb-1">Severidade</label>
                    <select 
                      value={severity}
                      onChange={(e: any) => setSeverity(e.target.value)}
                      className="w-full px-2 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2 pt-4">
                    <input 
                      type="checkbox" 
                      id="crit-occ"
                      checked={isCritical}
                      onChange={(e) => setIsCritical(e.target.checked)}
                      className="w-4 h-4 text-red-600 rounded"
                    />
                    <label htmlFor="crit-occ" className="text-xs font-bold text-red-600 dark:text-red-400 cursor-pointer">Crítica?</label>
                  </div>
                </div>
                <button 
                  type="button"
                  onClick={addOccurrence}
                  className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-white text-white dark:text-neutral-900 font-bold text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  <span>Publicar Ocorrência</span>
                </button>
              </div>
            </section>
          )}

          {/* Quick History of Boracéia Shipments */}
          <section className="bg-white dark:bg-neutral-900 p-6 rounded-3xl shadow-sm border border-neutral-100 dark:border-neutral-800 space-y-4">
            <h4 className="text-xs font-black uppercase text-neutral-400 dark:text-neutral-500 tracking-wider flex items-center gap-2">
              <Clock size={14} className="text-amber-500" />
              Histórico de Envios para Boracéia
            </h4>

            <div className="space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar">
              {logs.length === 0 ? (
                <p className="text-xs text-neutral-400 italic">Nenhum registro anterior encontrado.</p>
              ) : (
                logs.map((log: any) => {
                  const shipments: BoraceiaShipment[] = log.data?.boraceiaShipments || [];
                  const totalPalets = log.data?.totalBoraceiaPaletsSent || shipments.reduce((a, s) => a + (s.paletsCount || 0), 0);
                  const formattedDate = log.date ? log.date.split('-').reverse().join('/') : 'Data não informada';

                  return (
                    <div 
                      key={log.id}
                      className="bg-neutral-50 dark:bg-neutral-800/60 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-700/60 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between font-bold text-neutral-900 dark:text-white">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-neutral-400" />
                          {formattedDate}
                        </span>
                        <span className="text-amber-600 dark:text-amber-400 font-black">
                          {totalPalets} palets
                        </span>
                      </div>

                      {shipments.length === 0 ? (
                        <p className="text-[11px] text-neutral-400 italic">Sem carretas registradas neste dia.</p>
                      ) : (
                        <div className="space-y-1.5 pt-1">
                          {shipments.map((s, idx) => (
                            <div key={idx} className="bg-white dark:bg-neutral-900 p-2 rounded-xl border border-neutral-100 dark:border-neutral-800 text-[11px]">
                              <div className="flex justify-between font-semibold">
                                <span className="text-neutral-800 dark:text-neutral-200">
                                  {s.driverName || `Carreta 0${idx + 1}`}
                                </span>
                                <span className="font-bold text-amber-600 dark:text-amber-400">
                                  {s.paletsCount} palets
                                </span>
                              </div>
                              <div className="text-[10px] text-neutral-400 flex items-center justify-between mt-1">
                                <span>Saída: {s.departureTime || '--:--'}</span>
                                <span>Chegada SP: {s.arrivalTimeSP || '--:--'}</span>
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
    </div>
  );
}
