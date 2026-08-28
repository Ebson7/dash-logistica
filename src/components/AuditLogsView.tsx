import React, { useState, useEffect, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  where,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { AuditLog, AuditCategory, AuditSeverity, UserProfile } from '../types';
import {
  AUDIT_CATEGORIES,
  AUDIT_SEVERITY_CONFIG,
  AUDIT_ACTION_LABELS,
  formatAuditTimestamp,
  logAuditEvent
} from '../utils/auditLogger';
import { DEPARTMENTS } from '../constants';
import {
  Shield,
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lock,
  User,
  Clock,
  ChevronDown,
  ChevronUp,
  FileText,
  SlidersHorizontal,
  Eye,
  Copy,
  Check,
  Radio,
  FileSpreadsheet,
  Printer,
  Sparkles,
  Layers,
  ArrowUpDown,
  History,
  Activity,
  UserCheck,
  AlertOctagon,
  Laptop
} from 'lucide-react';

interface AuditLogsViewProps {
  currentUserProfile?: UserProfile | null;
}

export const AuditLogsView: React.FC<AuditLogsViewProps> = ({ currentUserProfile }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLiveActive, setIsLiveActive] = useState<boolean>(true);
  const [fetchLimit, setFetchLimit] = useState<number>(200);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [dateRangePreset, setDateRangePreset] = useState<'ALL' | 'TODAY' | '7DAYS' | '30DAYS' | 'CUSTOM'>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'timeline'>('table');

  // Selected detail modal
  const [selectedLogDetail, setSelectedLogDetail] = useState<AuditLog | null>(null);
  const [copiedDetail, setCopiedDetail] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Subscribe to real-time logs
  useEffect(() => {
    setLoading(true);
    const logsRef = collection(db, 'system_audit_logs');
    const q = query(logsRef, orderBy('timestamp', 'desc'), limit(fetchLimit));

    if (isLiveActive) {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const loadedLogs: AuditLog[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any)
          }));
          setLogs(loadedLogs);
          setLoading(false);
        },
        (error) => {
          console.error('Erro ao escutar audit logs:', error);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      getDocs(q)
        .then((snapshot) => {
          const loadedLogs: AuditLog[] = snapshot.docs.map((docSnap) => ({
            id: docSnap.id,
            ...(docSnap.data() as any)
          }));
          setLogs(loadedLogs);
          setLoading(false);
        })
        .catch((err) => {
          console.error('Erro ao buscar audit logs:', err);
          setLoading(false);
        });
    }
  }, [fetchLimit, isLiveActive]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Search term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const actor = (log.actorName || '').toLowerCase();
        const email = (log.actorEmail || '').toLowerCase();
        const desc = (log.description || '').toLowerCase();
        const act = (log.action || '').toLowerCase();
        const target = (log.targetName || log.targetId || '').toLowerCase();
        const details = JSON.stringify(log.details || {}).toLowerCase();
        const matches =
          actor.includes(term) ||
          email.includes(term) ||
          desc.includes(term) ||
          act.includes(term) ||
          target.includes(term) ||
          details.includes(term);
        if (!matches) return false;
      }

      // 2. Category
      if (selectedCategory !== 'ALL' && log.category !== selectedCategory) {
        return false;
      }

      // 3. Severity
      if (selectedSeverity !== 'ALL' && log.severity !== selectedSeverity) {
        return false;
      }

      // 4. Department
      if (selectedDept !== 'ALL' && log.actorDepartment !== selectedDept) {
        return false;
      }

      // 5. Date Range
      if (dateRangePreset !== 'ALL') {
        const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp || log.createdAtClient || 0);
        const logTime = logDate.getTime();
        const now = new Date();

        if (dateRangePreset === 'TODAY') {
          const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
          if (logTime < startOfDay) return false;
        } else if (dateRangePreset === '7DAYS') {
          const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
          if (logTime < sevenDaysAgo) return false;
        } else if (dateRangePreset === '30DAYS') {
          const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;
          if (logTime < thirtyDaysAgo) return false;
        } else if (dateRangePreset === 'CUSTOM') {
          if (customStartDate) {
            const start = new Date(customStartDate + 'T00:00:00').getTime();
            if (logTime < start) return false;
          }
          if (customEndDate) {
            const end = new Date(customEndDate + 'T23:59:59').getTime();
            if (logTime > end) return false;
          }
        }
      }

      return true;
    });
  }, [logs, searchTerm, selectedCategory, selectedSeverity, selectedDept, dateRangePreset, customStartDate, customEndDate]);

  // Analytical stats
  const stats = useMemo(() => {
    const total = filteredLogs.length;
    const securityCount = filteredLogs.filter(
      (l) => l.category === 'AUTH_SECURITY' || l.category === 'PERMISSIONS_RBAC'
    ).length;
    const criticalCount = filteredLogs.filter(
      (l) => l.severity === 'critical' || l.severity === 'warning'
    ).length;
    const distinctActors = new Set(filteredLogs.map((l) => l.actorEmail || l.actorName)).size;

    return { total, securityCount, criticalCount, distinctActors };
  }, [filteredLogs]);

  // Export to CSV
  const handleExportCSV = () => {
    try {
      const headers = ['ID', 'Data/Hora', 'Ação', 'Categoria', 'Severidade', 'Autor', 'E-mail', 'Setor', 'Descrição', 'Alvo', 'Detalhes (JSON)'];
      const rows = filteredLogs.map((log) => {
        const { fullDate, time } = formatAuditTimestamp(log.timestamp || log.createdAtClient);
        return [
          `"${log.id || ''}"`,
          `"${fullDate} ${time}"`,
          `"${AUDIT_ACTION_LABELS[log.action] || log.action}"`,
          `"${AUDIT_CATEGORIES[log.category as AuditCategory]?.label || log.category}"`,
          `"${AUDIT_SEVERITY_CONFIG[log.severity as AuditSeverity]?.label || log.severity}"`,
          `"${(log.actorName || '').replace(/"/g, '""')}"`,
          `"${log.actorEmail || ''}"`,
          `"${log.actorDepartment || ''}"`,
          `"${(log.description || '').replace(/"/g, '""')}"`,
          `"${(log.targetName || log.targetId || '').replace(/"/g, '""')}"`,
          `"${JSON.stringify(log.details || {}).replace(/"/g, '""')}"`
        ];
      });

      const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `trilha_auditoria_marsil_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logAuditEvent({
        action: 'EXPORT_CSV',
        category: 'DATA_EXPORT',
        description: `Exportou ${filteredLogs.length} registros da Trilha de Auditoria para arquivo CSV.`,
        severity: 'info',
        actorProfile: currentUserProfile
      });

      showToast('Relatório de auditoria CSV gerado com sucesso!');
    } catch (err) {
      console.error('Erro ao exportar CSV:', err);
      showToast('Falha ao exportar CSV.');
    }
  };

  // Export to JSON
  const handleExportJSON = () => {
    try {
      const dataStr = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit_logs_marsil_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      logAuditEvent({
        action: 'EXPORT_EXCEL',
        category: 'DATA_EXPORT',
        description: `Exportou dump estruturado de auditoria em JSON (${filteredLogs.length} registros).`,
        severity: 'info',
        actorProfile: currentUserProfile
      });

      showToast('Dump JSON baixado com sucesso!');
    } catch (e) {
      console.error(e);
      showToast('Erro ao exportar JSON.');
    }
  };

  // Print view
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-neutral-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-neutral-700 text-sm font-medium flex items-center gap-2 animate-bounce">
          <CheckCircle2 size={18} className="text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-neutral-900 to-indigo-950 p-6 md:p-8 rounded-3xl text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-semibold">
              <Shield size={14} className="text-indigo-400" />
              Segurança & Rastreabilidade Corporativa
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Trilha de Auditoria & Logs de Sistema
            </h2>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              Registro imutável de todas as ações operacionais, alterações de credenciais, movimentações de cargas, modificações de permissões e acessos efetuados no sistema Marsil Log.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsLiveActive(!isLiveActive)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border ${
                isLiveActive
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                  : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'
              }`}
              title={isLiveActive ? 'Feed em tempo real ativo' : 'Feed pausado'}
            >
              <Radio size={14} className={isLiveActive ? 'text-emerald-400 animate-pulse' : 'text-neutral-500'} />
              {isLiveActive ? 'Feed Ao Vivo Ativo' : 'Feed Pausado'}
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-2"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" />
              Exportar CSV
            </button>

            <button
              type="button"
              onClick={handleExportJSON}
              className="px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all flex items-center gap-2"
            >
              <Download size={14} className="text-indigo-300" />
              Exportar JSON
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all"
              title="Imprimir Trilha"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <Activity size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Total de Eventos
            </p>
            <p className="text-2xl font-black text-neutral-900 dark:text-white mt-0.5">
              {stats.total}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Lock size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Segurança & RBAC
            </p>
            <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
              {stats.securityCount}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
            <AlertOctagon size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Alertas / Críticos
            </p>
            <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
              {stats.criticalCount}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-neutral-900 p-5 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Atores Distintos
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
              {stats.distinctActors}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Control Bar */}
      <div className="bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Main search input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por colaborador, ação, e-mail, placa, ID de ocorrência ou detalhes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Quick Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode */}
            <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Layers size={13} />
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'timeline'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <Clock size={13} />
                Linha do Tempo
              </button>
            </div>

            {/* Fetch Limit Selector */}
            <select
              value={fetchLimit}
              onChange={(e) => setFetchLimit(Number(e.target.value))}
              className="px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-medium outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={50}>Últimos 50 logs</option>
              <option value={100}>Últimos 100 logs</option>
              <option value={200}>Últimos 200 logs</option>
              <option value={500}>Últimos 500 logs</option>
            </select>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all border ${
              selectedCategory === 'ALL'
                ? 'bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white shadow-sm'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-200'
            }`}
          >
            Todas as Categorias ({logs.length})
          </button>
          {Object.entries(AUDIT_CATEGORIES).map(([catKey, catMeta]) => {
            const count = logs.filter((l) => l.category === catKey).length;
            const isSelected = selectedCategory === catKey;
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => setSelectedCategory(catKey)}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100'
                }`}
              >
                <span>{catMeta.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Secondary Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800">
          {/* Severity filter */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">
              Severidade do Evento
            </label>
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Todas as Severidades</option>
              <option value="critical">🔴 Crítico / Segurança</option>
              <option value="warning">🟡 Atenção / Alertas</option>
              <option value="success">🟢 Sucesso</option>
              <option value="info">🔵 Informativo</option>
            </select>
          </div>

          {/* Department filter */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">
              Setor / Departamento
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Todos os Setores</option>
              <option value="admin">Administração / TI</option>
              <option value="viewer">Diretoria / Auditoria</option>
              {Object.values(DEPARTMENTS).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range preset */}
          <div>
            <label className="block text-[10px] font-bold text-neutral-400 dark:text-neutral-500 uppercase mb-1">
              Período de Tempo
            </label>
            <select
              value={dateRangePreset}
              onChange={(e) => setDateRangePreset(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">Todo o Histórico</option>
              <option value="TODAY">Hoje (Últimas 24h)</option>
              <option value="7DAYS">Últimos 7 dias</option>
              <option value="30DAYS">Últimos 30 dias</option>
              <option value="CUSTOM">Período Customizado...</option>
            </select>
          </div>

          {/* Reset button */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('ALL');
                setSelectedSeverity('ALL');
                setSelectedDept('ALL');
                setDateRangePreset('ALL');
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw size={13} />
              Resetar Filtros
            </button>
          </div>
        </div>

        {/* Custom date range inputs */}
        {dateRangePreset === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200 dark:border-neutral-700">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">De:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">Até:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-xs text-neutral-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-3">
          <RefreshCw className="animate-spin text-indigo-500 mx-auto" size={32} />
          <p className="text-sm font-semibold text-neutral-600 dark:text-neutral-400">
            Carregando trilha de auditoria...
          </p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-3">
          <Shield className="text-neutral-300 dark:text-neutral-700 mx-auto" size={48} />
          <h4 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
            Nenhum registro de auditoria encontrado
          </h4>
          <p className="text-xs text-neutral-500 max-w-md mx-auto">
            Não foram encontrados eventos que correspondam aos filtros selecionados. Tente ajustar os termos de busca ou o período selecionado.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/75 dark:bg-neutral-800/50 text-[11px] font-bold text-neutral-500 uppercase tracking-wider">
                  <th className="py-3.5 px-4">Data & Horário</th>
                  <th className="py-3.5 px-4">Severidade / Categoria</th>
                  <th className="py-3.5 px-4">Ação / Descrição</th>
                  <th className="py-3.5 px-4">Colaborador / Autor</th>
                  <th className="py-3.5 px-4">Alvo / Recurso</th>
                  <th className="py-3.5 px-4 text-right">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60 text-xs">
                {filteredLogs.map((log) => {
                  const { fullDate, time, relative } = formatAuditTimestamp(log.timestamp || log.createdAtClient);
                  const catConfig = AUDIT_CATEGORIES[log.category as AuditCategory] || {
                    label: log.category,
                    bgColor: 'bg-neutral-100 text-neutral-700'
                  };
                  const sevConfig = AUDIT_SEVERITY_CONFIG[log.severity as AuditSeverity] || AUDIT_SEVERITY_CONFIG.info;
                  const actionLabel = AUDIT_ACTION_LABELS[log.action] || log.action;

                  return (
                    <tr
                      key={log.id || `${log.timestamp}-${Math.random()}`}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors group"
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="font-semibold text-neutral-900 dark:text-white flex items-center gap-1.5">
                          <Clock size={12} className="text-neutral-400 shrink-0" />
                          {fullDate}
                          <span className="font-mono text-neutral-500 dark:text-neutral-400 font-normal">
                            {time}
                          </span>
                        </div>
                        <p className="text-[10px] text-neutral-400 mt-0.5">{relative}</p>
                      </td>

                      {/* Severity & Category */}
                      <td className="py-3.5 px-4 whitespace-nowrap space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${sevConfig.dot} shrink-0`} />
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sevConfig.badge}`}>
                            {sevConfig.label}
                          </span>
                        </div>
                        <div>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catConfig.bgColor}`}>
                            {catConfig.label}
                          </span>
                        </div>
                      </td>

                      {/* Action & Description */}
                      <td className="py-3.5 px-4 max-w-md">
                        <div className="font-bold text-neutral-900 dark:text-white flex items-center gap-1">
                          {actionLabel}
                        </div>
                        <p className="text-neutral-600 dark:text-neutral-300 text-xs mt-0.5 line-clamp-2">
                          {log.description}
                        </p>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-[11px] shrink-0">
                            {(log.actorName || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-neutral-900 dark:text-white">
                              {log.actorName || 'Usuário Marsil'}
                            </p>
                            <p className="text-[10px] text-neutral-400">
                              {log.actorRole === 'admin'
                                ? 'Super Admin'
                                : log.actorRole === 'manager'
                                ? 'Gestor'
                                : log.actorRole === 'viewer'
                                ? 'Visualizador'
                                : 'Operador'}
                              {log.actorDepartment ? ` • ${log.actorDepartment}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {log.targetName || log.targetId ? (
                          <div className="space-y-0.5">
                            <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                              {log.targetName || log.targetId}
                            </span>
                            {log.targetType && (
                              <p className="text-[10px] text-neutral-400 uppercase font-mono">
                                {log.targetType}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-neutral-400 text-[11px] italic">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setSelectedLogDetail(log)}
                          className="px-2.5 py-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 text-neutral-600 dark:text-neutral-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-semibold text-xs transition-colors inline-flex items-center gap-1.5"
                        >
                          <Eye size={13} />
                          Ver Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* TIMELINE VIEW */
        <div className="bg-white dark:bg-neutral-900 p-6 md:p-8 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm relative">
          <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
            {filteredLogs.map((log) => {
              const { fullDate, time, relative } = formatAuditTimestamp(log.timestamp || log.createdAtClient);
              const catConfig = AUDIT_CATEGORIES[log.category as AuditCategory] || {
                label: log.category,
                bgColor: 'bg-neutral-100 text-neutral-700'
              };
              const sevConfig = AUDIT_SEVERITY_CONFIG[log.severity as AuditSeverity] || AUDIT_SEVERITY_CONFIG.info;
              const actionLabel = AUDIT_ACTION_LABELS[log.action] || log.action;

              return (
                <div key={log.id || `${log.timestamp}-${Math.random()}`} className="relative group">
                  {/* Dot indicator */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-1.5 w-6 h-6 rounded-full border-4 border-white dark:border-neutral-900 ${sevConfig.dot} shadow-sm`}
                  />

                  {/* Content card */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-200 dark:border-neutral-700/60 hover:border-indigo-400 transition-all space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sevConfig.badge}`}>
                          {sevConfig.label}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${catConfig.bgColor}`}>
                          {catConfig.label}
                        </span>
                        <span className="font-bold text-neutral-900 dark:text-white text-xs sm:text-sm">
                          {actionLabel}
                        </span>
                      </div>

                      <div className="text-[11px] text-neutral-500 font-mono flex items-center gap-1">
                        <Clock size={12} className="text-neutral-400" />
                        {fullDate} às {time} ({relative})
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed">
                      {log.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 text-xs">
                      <div className="flex items-center gap-2">
                        <User size={13} className="text-neutral-400" />
                        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                          {log.actorName}
                        </span>
                        <span className="text-neutral-400 text-[11px]">
                          ({log.actorRole || 'operador'} {log.actorDepartment ? `• ${log.actorDepartment}` : ''})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedLogDetail(log)}
                        className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-xs flex items-center gap-1"
                      >
                        <Eye size={13} />
                        Inspecionar Payload
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DETAIL MODAL (Payload & Metadata Inspector) */}
      {selectedLogDetail && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-2xl rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Shield size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                    Inspeção do Registro de Auditoria
                  </h3>
                  <p className="text-xs text-neutral-500 font-mono">
                    ID: {selectedLogDetail.id || 'N/A'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Summary metadata grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-neutral-50 dark:bg-neutral-800/60 rounded-2xl border border-neutral-200 dark:border-neutral-700">
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Ação</p>
                  <p className="font-bold text-neutral-900 dark:text-white">
                    {AUDIT_ACTION_LABELS[selectedLogDetail.action] || selectedLogDetail.action}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Categoria</p>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {AUDIT_CATEGORIES[selectedLogDetail.category as AuditCategory]?.label || selectedLogDetail.category}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Severidade</p>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {AUDIT_SEVERITY_CONFIG[selectedLogDetail.severity as AuditSeverity]?.label || selectedLogDetail.severity}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Autor</p>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {selectedLogDetail.actorName} ({selectedLogDetail.actorRole})
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">E-mail</p>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {selectedLogDetail.actorEmail || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400">Setor</p>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {selectedLogDetail.actorDepartment || 'Geral'}
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase text-neutral-400">Descrição do Evento</label>
                <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 font-medium">
                  {selectedLogDetail.description}
                </div>
              </div>

              {/* Target */}
              {(selectedLogDetail.targetName || selectedLogDetail.targetId) && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-neutral-400">Recurso Alvo</label>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200">
                    <span className="font-bold">{selectedLogDetail.targetName || selectedLogDetail.targetId}</span>
                    {selectedLogDetail.targetType && (
                      <span className="ml-2 text-neutral-500 font-mono text-[11px]">
                        [{selectedLogDetail.targetType}]
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Client Info */}
              {selectedLogDetail.clientInfo && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-neutral-400 flex items-center gap-1">
                    <Laptop size={12} />
                    Informações do Cliente & Plataforma
                  </label>
                  <div className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700 text-[11px] text-neutral-600 dark:text-neutral-300 font-mono space-y-1">
                    <p>Plataforma: {selectedLogDetail.clientInfo.platform || 'N/A'}</p>
                    <p>Navegador / Agente: {selectedLogDetail.clientInfo.userAgent || 'N/A'}</p>
                    <p>Rota Acessada: {selectedLogDetail.clientInfo.url || '/'}</p>
                  </div>
                </div>
              )}

              {/* Raw JSON Payload */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold uppercase text-neutral-400">
                    Payload & Parâmetros (JSON)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedLogDetail, null, 2));
                      setCopiedDetail(true);
                      setTimeout(() => setCopiedDetail(false), 2000);
                    }}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 text-[11px]"
                  >
                    {copiedDetail ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                    {copiedDetail ? 'Copiado!' : 'Copiar JSON'}
                  </button>
                </div>
                <pre className="p-4 bg-neutral-900 text-neutral-200 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48 border border-neutral-800">
                  {JSON.stringify(selectedLogDetail.details || {}, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-800/40 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedLogDetail(null)}
                className="px-5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs hover:opacity-90 transition-opacity"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
