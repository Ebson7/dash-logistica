import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  setDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { CipaMember } from '../types';
import { useAuth } from '../App';
import { 
  ShieldCheck, 
  Users, 
  Clock, 
  Building2, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Phone, 
  Mail, 
  AlertCircle, 
  CheckCircle2, 
  HardHat, 
  HeartPulse, 
  Flame, 
  Filter, 
  LayoutGrid, 
  List, 
  X, 
  UserCheck, 
  MapPin, 
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const INITIAL_CIPA_MEMBERS: Omit<CipaMember, 'id'>[] = [
  {
    name: 'Carlos Eduardo Santos',
    role: 'Operador de Empilhadeira',
    cipaRole: 'Presidente da CIPA',
    department: 'Estoque',
    unit: 'São Paulo',
    workSchedule: '06:00 às 14:20',
    shift: 'Manhã',
    status: 'Em Turno',
    phone: '(11) 98765-4321',
    email: 'carlos.santos@marsil.com.br',
    badgeNumber: 'MAT-1042',
    mandatePeriod: 'Gestão 2026/2027',
    trainedFirstAid: true,
    trainedFireBrigade: true,
    notes: 'Plantonista de emergência no período da manhã.'
  },
  {
    name: 'Mariana Oliveira Lima',
    role: 'Conferente de Carga',
    cipaRole: 'Vice-Presidente da CIPA',
    department: 'Recebimento',
    unit: 'São Paulo',
    workSchedule: '08:00 às 17:48',
    shift: 'Comercial',
    status: 'Em Turno',
    phone: '(11) 97654-3210',
    email: 'mariana.lima@marsil.com.br',
    badgeNumber: 'MAT-1088',
    mandatePeriod: 'Gestão 2026/2027',
    trainedFirstAid: true,
    trainedFireBrigade: false,
    notes: 'Responsável pelo mapa de riscos do setor de recebimento.'
  },
  {
    name: 'Ricardo Souza Mendes',
    role: 'Supervisor de Operações',
    cipaRole: 'Secretário da CIPA',
    department: 'Filial Boracéia',
    unit: 'Boracéia',
    workSchedule: '07:00 às 16:48',
    shift: 'Comercial',
    status: 'Em Turno',
    phone: '(11) 96543-2109',
    email: 'ricardo.mendes@marsil.com.br',
    badgeNumber: 'MAT-2015',
    mandatePeriod: 'Gestão 2026/2027',
    trainedFirstAid: true,
    trainedFireBrigade: true,
    notes: 'Ponto focal de segurança da Filial Boracéia.'
  },
  {
    name: 'Fernando Guimarães',
    role: 'Separador de Pedidos',
    cipaRole: 'Titular Representante',
    department: 'Romaneio Tarde',
    unit: 'São Paulo',
    workSchedule: '14:00 às 22:20',
    shift: 'Tarde',
    status: 'Disponível',
    phone: '(11) 95432-1098',
    email: 'fernando.guimaraes@marsil.com.br',
    badgeNumber: 'MAT-1130',
    mandatePeriod: 'Gestão 2026/2027',
    trainedFirstAid: false,
    trainedFireBrigade: true,
    notes: 'Acompanhamento de ergonomia e uso de EPIs no turno da tarde.'
  },
  {
    name: 'Lucas Barbosa Silva',
    role: 'Conferente Noturno',
    cipaRole: 'Titular Representante',
    department: 'Romaneio Noturno',
    unit: 'São Paulo',
    workSchedule: '22:00 às 06:00',
    shift: 'Noturno',
    status: 'Disponível',
    phone: '(11) 94321-0987',
    email: 'lucas.barbosa@marsil.com.br',
    badgeNumber: 'MAT-1195',
    mandatePeriod: 'Gestão 2026/2027',
    trainedFirstAid: true,
    trainedFireBrigade: true,
    notes: 'Plantonista de segurança durante as operações noturnas.'
  },
  {
    name: 'Juliana Beatriz Costa',
    role: 'Assistente Administrativo',
    cipaRole: 'Suplente da CIPA',
    department: 'Exp. Loja',
    unit: 'São Paulo',
    workSchedule: '08:00 às 17:48',
    shift: 'Comercial',
    status: 'Em Turno',
    phone: '(11) 93210-9876',
    email: 'juliana.costa@marsil.com.br',
    badgeNumber: 'MAT-1220',
    mandatePeriod: 'Gestão 2026/2027',
    trainedFirstAid: true,
    trainedFireBrigade: false,
    notes: 'Comunicação interna e campanhas de prevenção da CIPA.'
  },
  {
    name: 'Antônio Marcos Ferreira',
    role: 'Estoquista',
    cipaRole: 'Suplente da CIPA',
    department: 'Filial Boracéia',
    unit: 'Boracéia',
    workSchedule: '08:00 às 17:48',
    shift: 'Comercial',
    status: 'Em Turno',
    phone: '(11) 92109-8765',
    email: 'antonio.ferreira@marsil.com.br',
    badgeNumber: 'MAT-2032',
    mandatePeriod: 'Gestão 2026/2027',
    trainedFirstAid: false,
    trainedFireBrigade: true,
    notes: 'Inspeção diária de extintores e rotas de fuga em Boracéia.'
  }
];

export function CipaView() {
  const { profile } = useAuth();
  const isViewer = profile?.departmentId === 'viewer';
  const [members, setMembers] = useState<CipaMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterUnit, setFilterUnit] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterShift, setFilterShift] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<CipaMember | null>(null);
  const [formData, setFormData] = useState<Partial<CipaMember>>({
    name: '',
    role: '',
    cipaRole: 'Titular Representante',
    department: 'Estoque',
    unit: 'São Paulo',
    workSchedule: '08:00 às 17:48',
    shift: 'Comercial',
    status: 'Em Turno',
    phone: '',
    email: '',
    badgeNumber: '',
    mandatePeriod: 'Gestão 2026/2027',
    trainedFirstAid: false,
    trainedFireBrigade: false,
    notes: ''
  });

  const [saving, setSaving] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Firestore sync
  useEffect(() => {
    const q = query(collection(db, 'cipa_members'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        // Seed initial data if collection is completely empty
        seedInitialMembers();
      } else {
        const loadedMembers: CipaMember[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as CipaMember));
        setMembers(loadedMembers);
        setLoading(false);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'cipa_members');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const seedInitialMembers = async () => {
    try {
      for (const m of INITIAL_CIPA_MEMBERS) {
        await addDoc(collection(db, 'cipa_members'), {
          ...m,
          createdAt: serverTimestamp()
        });
      }
      setLoading(false);
    } catch (e) {
      console.error('Error seeding CIPA members', e);
      setLoading(false);
    }
  };

  const handleOpenModal = (member?: CipaMember) => {
    if (member) {
      setEditingMember(member);
      setFormData(member);
    } else {
      setEditingMember(null);
      setFormData({
        name: '',
        role: '',
        cipaRole: 'Titular Representante',
        department: 'Estoque',
        unit: 'São Paulo',
        workSchedule: '08:00 às 17:48',
        shift: 'Comercial',
        status: 'Em Turno',
        phone: '',
        email: '',
        badgeNumber: '',
        mandatePeriod: 'Gestão 2026/2027',
        trainedFirstAid: false,
        trainedFireBrigade: false,
        notes: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.role) {
      alert('Por favor, preencha o Nome e o Cargo.');
      return;
    }

    setSaving(true);
    try {
      if (editingMember) {
        await setDoc(doc(db, 'cipa_members', editingMember.id), {
          ...formData,
          updatedAt: serverTimestamp()
        }, { merge: true });
        setSuccessToast('Colaborador CIPA atualizado com sucesso!');
      } else {
        await addDoc(collection(db, 'cipa_members'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        setSuccessToast('Novo colaborador CIPA cadastrado com sucesso!');
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'cipa_members');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja remover ${name} da lista da CIPA?`)) {
      try {
        await deleteDoc(doc(db, 'cipa_members', id));
        setSuccessToast('Colaborador removido da CIPA.');
        setTimeout(() => setSuccessToast(null), 3000);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `cipa_members/${id}`);
      }
    }
  };

  const filteredMembers = members.filter(m => {
    const matchesSearch = !search || 
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()) ||
      m.department.toLowerCase().includes(search.toLowerCase()) ||
      m.cipaRole.toLowerCase().includes(search.toLowerCase());
    
    const matchesUnit = filterUnit === 'all' || m.unit === filterUnit;
    const matchesDept = filterDepartment === 'all' || m.department === filterDepartment;
    const matchesShift = filterShift === 'all' || m.shift === filterShift;
    const matchesStatus = filterStatus === 'all' || m.status === filterStatus;

    return matchesSearch && matchesUnit && matchesDept && matchesShift && matchesStatus;
  });

  const totalMembers = members.length;
  const inShiftCount = members.filter(m => m.status === 'Em Turno').length;
  const spCount = members.filter(m => m.unit === 'São Paulo').length;
  const bcCount = members.filter(m => m.unit === 'Boracéia').length;
  const firstAidCount = members.filter(m => m.trainedFirstAid).length;
  const fireBrigadeCount = members.filter(m => m.trainedFireBrigade).length;

  const departmentsList = Array.from(new Set(members.map(m => m.department))).filter(Boolean);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3.5 rounded-2xl shadow-xl flex items-center gap-3 font-semibold text-sm"
          >
            <CheckCircle2 size={20} />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-neutral-900 p-6 md:p-8 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
            <ShieldCheck size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                Segurança & Saúde no Trabalho
              </span>
              <span className="text-xs font-semibold text-neutral-400">Gestão 2026/2027</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-neutral-900 dark:text-white mt-1">
              CIPA - Comissão Interna de Prevenção de Acidentes
            </h2>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Mapeamento de cipeiros, horários de turno, departamentos e localização em tempo real
            </p>
          </div>
        </div>

        {!isViewer && (
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={18} />
            <span>Cadastrar Cipeiro</span>
          </button>
        )}
      </header>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Total de Cipeiros</p>
            <p className="text-3xl font-black text-neutral-900 dark:text-white mt-1">{totalMembers}</p>
            <p className="text-[11px] text-neutral-400 mt-1">Membros ativos eleitos e designados</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Users size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Em Turno Agora</p>
            <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{inShiftCount}</p>
            <p className="text-[11px] text-neutral-400 mt-1">Presentes na planta no momento</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <UserCheck size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Cobertura Unidades</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-2xl font-black text-blue-600">{spCount} <span className="text-xs font-medium text-neutral-400">SP</span></span>
              <span className="text-neutral-300">|</span>
              <span className="text-2xl font-black text-amber-600">{bcCount} <span className="text-xs font-medium text-neutral-400">BC</span></span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">São Paulo e Filial Boracéia</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Building2 size={24} />
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-5 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">Brigada & Socorros</p>
            <div className="flex items-center gap-3 mt-1 text-sm font-bold text-neutral-800 dark:text-neutral-200">
              <span className="flex items-center gap-1 text-red-500"><Flame size={15} /> {fireBrigadeCount} Brigadistas</span>
              <span className="flex items-center gap-1 text-emerald-500"><HeartPulse size={15} /> {firstAidCount} Socorristas</span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1">Treinamento específico concluído</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center">
            <HardHat size={24} />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Buscar cipeiro por nome, cargo, departamento ou função na CIPA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 text-neutral-900 dark:text-white placeholder-neutral-400 text-sm outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto">
            <div className="bg-neutral-100 dark:bg-neutral-800 p-1 rounded-xl flex items-center">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-neutral-500'}`}
                title="Visualização em Grade"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-white dark:bg-neutral-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-neutral-500'}`}
                title="Visualização em Lista / Tabela"
              >
                <List size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs">
          <div className="flex items-center gap-1.5 text-neutral-400 font-bold uppercase text-[10px]">
            <Filter size={13} />
            <span>Filtros:</span>
          </div>

          <select
            value={filterUnit}
            onChange={(e) => setFilterUnit(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todas as Unidades</option>
            <option value="São Paulo">Unidade São Paulo</option>
            <option value="Boracéia">Filial Boracéia</option>
          </select>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos os Departamentos</option>
            {departmentsList.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select
            value={filterShift}
            onChange={(e) => setFilterShift(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos os Turnos</option>
            <option value="Manhã">Manhã</option>
            <option value="Comercial">Comercial</option>
            <option value="Tarde">Tarde</option>
            <option value="Noturno">Noturno</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-medium outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">Todos os Status</option>
            <option value="Em Turno">Em Turno</option>
            <option value="Disponível">Disponível</option>
            <option value="Folga">Folga</option>
            <option value="Férias">Férias</option>
          </select>

          {(filterUnit !== 'all' || filterDepartment !== 'all' || filterShift !== 'all' || filterStatus !== 'all' || search) && (
            <button
              onClick={() => {
                setSearch('');
                setFilterUnit('all');
                setFilterDepartment('all');
                setFilterShift('all');
                setFilterStatus('all');
              }}
              className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 font-bold ml-auto"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Members View */}
      {loading ? (
        <div className="p-12 text-center text-neutral-400">Carregando lista da CIPA...</div>
      ) : filteredMembers.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 p-12 rounded-3xl border border-neutral-100 dark:border-neutral-800 text-center space-y-3 shadow-sm">
          <ShieldCheck size={48} className="mx-auto text-neutral-300 dark:text-neutral-700" />
          <h3 className="text-lg font-bold text-neutral-700 dark:text-neutral-300">Nenhum colaborador CIPA encontrado</h3>
          <p className="text-sm text-neutral-400 max-w-md mx-auto">
            Tente ajustar seus termos de busca ou filtros aplicados para visualizar os cipeiros cadastrados.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMembers.map((member) => {
            const isBoraceia = member.unit === 'Boracéia';
            return (
              <div
                key={member.id}
                className={`bg-white dark:bg-neutral-900 rounded-3xl border ${
                  isBoraceia 
                    ? 'border-amber-200/80 dark:border-amber-900/50 shadow-amber-500/5' 
                    : 'border-neutral-100 dark:border-neutral-800 shadow-sm'
                } p-6 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden`}
              >
                {/* Top badges */}
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      isBoraceia 
                        ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800' 
                        : 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 border border-blue-300 dark:border-blue-800'
                    }`}>
                      {member.unit}
                    </span>
                    <span className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {member.department}
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    member.status === 'Em Turno' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                    member.status === 'Disponível' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                    member.status === 'Folga' ? 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400' :
                    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      member.status === 'Em Turno' ? 'bg-emerald-500 animate-pulse' :
                      member.status === 'Disponível' ? 'bg-blue-500' : 'bg-neutral-400'
                    }`} />
                    {member.status}
                  </span>
                </div>

                {/* Member Info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-lg flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
                      {member.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-neutral-900 dark:text-white text-base truncate" title={member.name}>
                        {member.name}
                      </h4>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium truncate">
                        {member.role}
                      </p>
                    </div>
                  </div>

                  <div className="bg-emerald-50/50 dark:bg-neutral-800/60 p-3 rounded-2xl border border-emerald-100/60 dark:border-neutral-700/60">
                    <div className="text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-400 tracking-wider">
                      Cargo CIPA:
                    </div>
                    <div className="text-sm font-black text-neutral-900 dark:text-white mt-0.5">
                      {member.cipaRole}
                    </div>
                  </div>

                  {/* Schedule & Location */}
                  <div className="space-y-1.5 text-xs text-neutral-600 dark:text-neutral-300 pt-1">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className="text-neutral-400 shrink-0" />
                      <span className="font-semibold text-neutral-900 dark:text-white">{member.workSchedule}</span>
                      <span className="text-neutral-400">({member.shift})</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin size={14} className="text-neutral-400 shrink-0" />
                      <span>Setor: <strong className="text-neutral-900 dark:text-white">{member.department}</strong></span>
                    </div>

                    {member.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-neutral-400 shrink-0" />
                        <span>{member.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Qualifications */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-2">
                    {member.trainedFirstAid && (
                      <span className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <HeartPulse size={11} /> Primeiros Socorros
                      </span>
                    )}
                    {member.trainedFireBrigade && (
                      <span className="bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-900 text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                        <Flame size={11} /> Brigadista
                      </span>
                    )}
                  </div>
                </div>

                {/* Card footer / Actions */}
                {!isViewer && (
                  <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800">
                    <button
                      onClick={() => handleOpenModal(member)}
                      className="p-2 text-neutral-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl transition-all"
                      title="Editar Cipeiro"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteMember(member.id, member.name)}
                      className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-all"
                      title="Remover"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* Table Mode */
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/60 border-b border-neutral-100 dark:border-neutral-800 text-neutral-400 uppercase font-black text-[10px] tracking-wider">
                  <th className="p-4">Colaborador / Cargo</th>
                  <th className="p-4">Função CIPA</th>
                  <th className="p-4">Unidade / Setor</th>
                  <th className="p-4">Horário & Turno</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Qualificações</th>
                  {!isViewer && <th className="p-4 text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                {filteredMembers.map(member => (
                  <tr key={member.id} className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors">
                    <td className="p-4">
                      <div className="font-bold text-neutral-900 dark:text-white text-sm">{member.name}</div>
                      <div className="text-neutral-400">{member.role} {member.badgeNumber ? `• ${member.badgeNumber}` : ''}</div>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-lg">
                        {member.cipaRole}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-neutral-800 dark:text-neutral-200">{member.department}</div>
                      <div className="text-neutral-400 font-medium">{member.unit}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                        <Clock size={13} className="text-neutral-400" />
                        {member.workSchedule}
                      </div>
                      <div className="text-neutral-400">{member.shift}</div>
                    </td>
                    <td className="p-4">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                        member.status === 'Em Turno' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        member.status === 'Disponível' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                        'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${member.status === 'Em Turno' ? 'bg-emerald-500' : 'bg-neutral-400'}`} />
                        {member.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1.5">
                        {member.trainedFirstAid && (
                          <span className="bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                            <HeartPulse size={11} /> Socorrista
                          </span>
                        )}
                        {member.trainedFireBrigade && (
                          <span className="bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                            <Flame size={11} /> Brigadista
                          </span>
                        )}
                      </div>
                    </td>
                    {!isViewer && (
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenModal(member)}
                            className="p-1.5 text-neutral-400 hover:text-emerald-600 rounded-lg"
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id, member.name)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 rounded-lg"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Cadastrar / Editar Cipeiro */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-100 dark:border-neutral-800 w-full max-w-2xl overflow-hidden my-8"
            >
              <div className="p-6 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-800/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center">
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-neutral-900 dark:text-white">
                      {editingMember ? 'Editar Colaborador CIPA' : 'Cadastrar Colaborador CIPA'}
                    </h3>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Informe os dados funcionais, horários e cargo de representação na CIPA
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSaveMember} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Nome Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Carlos Eduardo Silva"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Cargo na Empresa *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Operador de Empilhadeira"
                      value={formData.role || ''}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Função na CIPA *</label>
                    <select
                      value={formData.cipaRole || 'Titular Representante'}
                      onChange={(e) => setFormData({ ...formData, cipaRole: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="Presidente da CIPA">Presidente da CIPA</option>
                      <option value="Vice-Presidente da CIPA">Vice-Presidente da CIPA</option>
                      <option value="Secretário da CIPA">Secretário da CIPA</option>
                      <option value="Titular Representante">Titular Representante dos Empregados</option>
                      <option value="Titular Indicado">Titular Indicado do Empregador</option>
                      <option value="Suplente da CIPA">Suplente da CIPA</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Unidade *</label>
                    <select
                      value={formData.unit || 'São Paulo'}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="São Paulo">Unidade São Paulo (Marsil)</option>
                      <option value="Boracéia">Filial Boracéia</option>
                      <option value="Todas">Ambas as Unidades</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Departamento / Setor *</label>
                    <select
                      value={formData.department || 'Estoque'}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                    >
                      <option value="Estoque">Estoque</option>
                      <option value="Recebimento">Recebimento</option>
                      <option value="Romaneio Tarde">Romaneio Tarde</option>
                      <option value="Romaneio Noturno">Romaneio Noturno</option>
                      <option value="Exp. Loja">Exp. Loja</option>
                      <option value="Filial Boracéia">Filial Boracéia</option>
                      <option value="Veículos">Veículos / Transporte</option>
                      <option value="Administrativo">Administrativo / RH</option>
                      <option value="Manutenção">Manutenção / Facilities</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Horário de Trabalho (Turno) *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 06:00 às 14:20 ou 08:00 às 17:48"
                      value={formData.workSchedule || ''}
                      onChange={(e) => setFormData({ ...formData, workSchedule: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Turno Principal</label>
                    <select
                      value={formData.shift || 'Comercial'}
                      onChange={(e) => setFormData({ ...formData, shift: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Manhã">Manhã</option>
                      <option value="Comercial">Comercial</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noturno">Noturno</option>
                      <option value="Geral">Geral / Escala</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Status Atual</label>
                    <select
                      value={formData.status || 'Em Turno'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Em Turno">Em Turno (Presente)</option>
                      <option value="Disponível">Disponível / Fora de Turno</option>
                      <option value="Folga">Folga / Escala</option>
                      <option value="Férias">Férias</option>
                      <option value="Afastado">Afastado</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Telefone / WhatsApp / Ramal</label>
                    <input
                      type="text"
                      placeholder="Ex: (11) 98765-4321 ou Ramal 204"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Matrícula / Crachá</label>
                    <input
                      type="text"
                      placeholder="Ex: MAT-1042"
                      value={formData.badgeNumber || ''}
                      onChange={(e) => setFormData({ ...formData, badgeNumber: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-100 dark:border-neutral-800 pt-4">
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-2">Treinamentos e Especialidades</label>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={formData.trainedFirstAid || false}
                        onChange={(e) => setFormData({ ...formData, trainedFirstAid: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <HeartPulse size={16} className="text-red-500" />
                      Treinado em Primeiros Socorros
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-neutral-700 dark:text-neutral-300">
                      <input
                        type="checkbox"
                        checked={formData.trainedFireBrigade || false}
                        onChange={(e) => setFormData({ ...formData, trainedFireBrigade: e.target.checked })}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <Flame size={16} className="text-orange-500" />
                      Membro da Brigada de Incêndio
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-neutral-500 mb-1">Observações / Ponto Focal</label>
                  <textarea
                    placeholder="Informações adicionais sobre o cipeiro ou escala..."
                    value={formData.notes || ''}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-emerald-500 min-h-[70px]"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-bold text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
                  >
                    {saving ? 'Salvando...' : editingMember ? 'Atualizar Cipeiro' : 'Salvar Cipeiro'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
