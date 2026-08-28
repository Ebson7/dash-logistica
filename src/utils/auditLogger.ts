import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { AuditActionType, AuditCategory, AuditLog, AuditSeverity, UserProfile } from '../types';

export const AUDIT_CATEGORIES: Record<AuditCategory, { label: string; icon: string; color: string; bgColor: string }> = {
  AUTH_SECURITY: {
    label: 'Segurança & Acessos',
    icon: 'Shield',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'
  },
  PERMISSIONS_RBAC: {
    label: 'Permissões & RBAC',
    icon: 'Lock',
    color: 'text-indigo-600 dark:text-indigo-400',
    bgColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800'
  },
  OCCURRENCES: {
    label: 'Ocorrências & Anotações',
    icon: 'AlertTriangle',
    color: 'text-rose-600 dark:text-rose-400',
    bgColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
  },
  LOGISTICS_OPS: {
    label: 'Operações & Agendas',
    icon: 'Truck',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
  },
  VEHICLES: {
    label: 'Frota & Veículos',
    icon: 'Car',
    color: 'text-cyan-600 dark:text-cyan-400',
    bgColor: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/60 dark:text-cyan-300 dark:border-cyan-800'
  },
  PROJECTS_KANBAN: {
    label: 'Projetos & Tarefas',
    icon: 'Kanban',
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800'
  },
  INVENTORY: {
    label: 'Inventário & WMS',
    icon: 'Boxes',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
  },
  CIPA: {
    label: 'CIPA & Segurança do Trabalho',
    icon: 'HardHat',
    color: 'text-teal-600 dark:text-teal-400',
    bgColor: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
  },
  SETTINGS: {
    label: 'Configurações do Sistema',
    icon: 'Settings',
    color: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
  },
  DATA_EXPORT: {
    label: 'Exportação de Dados',
    icon: 'Download',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800'
  }
};

export const AUDIT_SEVERITY_CONFIG: Record<AuditSeverity, { label: string; badge: string; dot: string }> = {
  info: {
    label: 'Informativo',
    badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400'
  },
  success: {
    label: 'Sucesso',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    dot: 'bg-emerald-500'
  },
  warning: {
    label: 'Atenção',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    dot: 'bg-amber-500'
  },
  critical: {
    label: 'Crítico / Segurança',
    badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    dot: 'bg-rose-600 animate-pulse'
  }
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: 'Login com Sucesso',
  LOGIN_FAILED: 'Tentativa de Login Falhou',
  LOGOUT: 'Encerramento de Sessão (Logout)',
  PASSWORD_CHANGE_ADMIN: 'Alteração de Senha Master (Admin)',
  PASSWORD_CHANGE_DEPT: 'Alteração de Senha de Setor',
  PASSWORD_CHANGE_USER: 'Alteração de Senha de Usuário',
  SECURITY_POLICY_UPDATE: 'Atualização de Políticas de Segurança',
  USER_CREATE: 'Novo Usuário Cadastrado',
  USER_UPDATE: 'Perfil de Usuário Atualizado',
  USER_BLOCK: 'Usuário Bloqueado / Suspenso',
  USER_UNBLOCK: 'Usuário Desbloqueado',
  USER_DELETE: 'Usuário Excluído',
  ROLE_CHANGE: 'Alteração de Cargo / Papel RBAC',
  PERMISSIONS_CUSTOMIZE: 'Personalização de Permissões',
  OCCURRENCE_CREATE: 'Nova Ocorrência Registrada',
  OCCURRENCE_UPDATE: 'Ocorrência Editada',
  OCCURRENCE_DELETE: 'Ocorrência Excluída',
  OCCURRENCE_RESOLVE: 'Ocorrência Marcada como Resolvida',
  COMMENT_ADD: 'Comentário / Parecer Adicionado',
  COMMENT_DELETE: 'Comentário Excluído',
  DAILY_LOG_SAVE: 'Lançamento Diário do Setor Salvo',
  RECEIVING_SCHEDULE_UPDATE: 'Agendamento de Recebimento Atualizado',
  RECEIVING_SCHEDULE_DUPLICATE: 'Agendamento Duplicado',
  RECEIVING_SCHEDULE_DELETE: 'Agendamento Excluído',
  VEHICLE_REGISTER: 'Veículo Cadastrado na Frota',
  VEHICLE_STATUS_UPDATE: 'Status do Veículo Atualizado',
  VEHICLE_CHECKLIST_SAVE: 'Checklist do Veículo Realizado',
  VEHICLE_DELETE: 'Veículo Removido da Frota',
  BORACEIA_TRANSFER_RECORD: 'Transferência Boracéia Registrada',
  STOCK_POSITION_UPDATE: 'Posição de Estoque Atualizada',
  PROJECT_TASK_CREATE: 'Nova Tarefa / Cartão Kanban',
  PROJECT_TASK_UPDATE: 'Tarefa do Kanban Atualizada',
  PROJECT_TASK_DELETE: 'Tarefa do Kanban Removida',
  INVENTORY_COUNT_RECORD: 'Contagem de Inventário Gravada',
  INVENTORY_CONFIG_UPDATE: 'Parâmetros de Inventário Atualizados',
  CIPA_MEMBER_ADD: 'Membro CIPA Adicionado',
  CIPA_MEMBER_UPDATE: 'Dados de Membro CIPA Atualizados',
  CIPA_MEMBER_DELETE: 'Membro CIPA Removido',
  EXPORT_EXCEL: 'Exportação de Planilha Excel (.xlsx)',
  EXPORT_CSV: 'Exportação de Dados (.csv)',
  EXPORT_PDF: 'Exportação / Impressão de Relatório PDF',
  SETTINGS_UPDATE: 'Configurações Gerais Alteradas',
  SYSTEM_ACTION: 'Ação do Sistema'
};

export interface AuditEventParams {
  action: AuditActionType | string;
  category: AuditCategory;
  description: string;
  severity?: AuditSeverity;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  details?: Record<string, any>;
  actorProfile?: UserProfile | null;
  customActorName?: string;
  customActorEmail?: string;
  customActorDepartment?: string;
}

/**
 * Registra um evento de auditoria de forma não bloqueante no Firestore
 */
export async function logAuditEvent(params: AuditEventParams): Promise<string | null> {
  try {
    const currentAuthUser = auth.currentUser;
    const profile = params.actorProfile;

    const actorId = profile?.uid || currentAuthUser?.uid || 'anonymous';
    const actorName = params.customActorName || profile?.displayName || (currentAuthUser?.isAnonymous ? 'Colaborador Anônimo' : currentAuthUser?.email?.split('@')[0]) || 'Sistema / Usuário';
    const actorEmail = params.customActorEmail || profile?.email || currentAuthUser?.email || 'sistema@marsillog.com';
    const actorRole = profile?.role || (profile?.departmentId === 'admin' ? 'admin' : (profile?.departmentId === 'viewer' ? 'viewer' : 'operator'));
    const actorDepartment = params.customActorDepartment || profile?.departmentId || 'geral';

    const clientInfo = {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Desconhecido',
      platform: typeof navigator !== 'undefined' ? navigator.platform : 'Web',
      url: typeof window !== 'undefined' ? window.location.pathname : '/'
    };

    const auditPayload = {
      action: params.action,
      category: params.category,
      severity: params.severity || 'info',
      description: params.description,
      actorId,
      actorName,
      actorEmail,
      actorRole,
      actorDepartment,
      targetId: params.targetId || null,
      targetType: params.targetType || null,
      targetName: params.targetName || null,
      details: params.details || {},
      clientInfo,
      timestamp: serverTimestamp(),
      createdAtClient: Date.now()
    };

    // Grava na coleção `system_audit_logs` (imutável e com regras seguras)
    const docRef = await addDoc(collection(db, 'system_audit_logs'), auditPayload);
    return docRef.id;
  } catch (error) {
    console.warn('Não foi possível gravar o log de auditoria no Firestore:', error);
    return null;
  }
}

/**
 * Formata timestamp do Firestore, Date, ou número para padrão legível em pt-BR
 */
export function formatAuditTimestamp(timestamp: any): { fullDate: string; time: string; relative: string } {
  if (!timestamp) {
    return { fullDate: 'Agora', time: '', relative: 'recente' };
  }

  let date: Date;
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    date = new Date();
  }

  if (isNaN(date.getTime())) {
    return { fullDate: 'Data inválida', time: '', relative: '' };
  }

  const fullDate = date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const time = date.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  // Relative time calculation
  const diffSeconds = Math.floor((Date.now() - date.getTime()) / 1000);
  let relative = '';
  if (diffSeconds < 60) {
    relative = 'há poucos segundos';
  } else if (diffSeconds < 3600) {
    const min = Math.floor(diffSeconds / 60);
    relative = `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  } else if (diffSeconds < 86400) {
    const hours = Math.floor(diffSeconds / 3600);
    relative = `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  } else if (diffSeconds < 2592000) {
    const days = Math.floor(diffSeconds / 86400);
    relative = `há ${days} ${days === 1 ? 'dia' : 'dias'}`;
  } else {
    relative = fullDate;
  }

  return { fullDate, time, relative };
}
