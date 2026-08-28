import { DepartmentId, UserProfile, UserRole, AppAction, ModulePermissionConfig } from '../types';

export interface RoutePermission {
  tabId: string;
  name: string;
  allowedDepartments: (DepartmentId | 'admin')[];
  allowAllAuthenticated?: boolean;
  minLevel?: 'admin' | 'operator' | 'viewer';
  description: string;
}

export const ROLE_DEFINITIONS: Record<UserRole, { label: string; description: string; badgeColor: string; level: number }> = {
  admin: {
    label: 'Super Administrador',
    description: 'Acesso irrestrito a todos os módulos, configurações globais, gestão de usuários e exclusões críticas.',
    badgeColor: 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800',
    level: 4,
  },
  manager: {
    label: 'Gestor / Supervisor',
    description: 'Pode criar, editar, aprovar e exportar no seu departamento e acompanhar projetos e inventário.',
    badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800',
    level: 3,
  },
  operator: {
    label: 'Operador / Conferente',
    description: 'Pode registrar checklists, lançar ocorrências e atualizar status de tarefas operacionais designadas.',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    level: 2,
  },
  viewer: {
    label: 'Visualizador (Auditoria / Diretoria)',
    description: 'Somente leitura para dashboards, consultas e relatórios operacionais. Sem permissão de escrita.',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    level: 1,
  },
};

export const ACTION_DEFINITIONS: Record<AppAction, { label: string; shortLabel: string; description: string; color: string }> = {
  view: {
    label: 'Visualizar',
    shortLabel: 'Ver',
    description: 'Consultar telas, dashboards, gráficos e listagens do módulo.',
    color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  },
  create: {
    label: 'Criar / Cadastrar',
    shortLabel: 'Criar',
    description: 'Inserir novos agendamentos, tarefas, ocorrências, checklists e contagens.',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  edit: {
    label: 'Editar / Atualizar',
    shortLabel: 'Editar',
    description: 'Modificar registros existentes, trocar status de tarefas e preencher dados.',
    color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
  delete: {
    label: 'Excluir / Cancelar',
    shortLabel: 'Excluir',
    description: 'Remover agendamentos, cartões do kanban, veículos ou registros históricos.',
    color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  },
  export: {
    label: 'Exportar Relatórios',
    shortLabel: 'Exportar',
    description: 'Gerar planilhas Excel (.xlsx, CSV) e relatórios executivos para download.',
    color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  manage_settings: {
    label: 'Configurar Módulo',
    shortLabel: 'Configurar',
    description: 'Alterar parâmetros, senhas, capacidades, tipos de veículos e regras do sistema.',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  },
};

/**
 * Matriz Granular de Módulos x Papéis x Ações
 */
export const MODULE_PERMISSIONS_MATRIX: ModulePermissionConfig[] = [
  {
    moduleId: 'dashboard',
    moduleName: 'Dashboard Geral & Torre de Controle',
    category: 'Gestão & Planejamento',
    description: 'Visão executiva com KPIs consolidados de todos os setores operacionais da Marsil Log.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'export'],
      operator: ['view'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'recebimento',
    moduleName: 'Recebimento de Cargas & Descarga',
    category: 'Operacional',
    description: 'Controle de fluxo de entrada, checklists de carretas, inspeção e fotos de avarias.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'agenda_planilha',
    moduleName: 'Agenda de Recebimento (Planilha Interativa)',
    category: 'Operacional',
    description: 'Agendamento oficial de descarregamento de carretas por horário, doca e fornecedor.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'delete', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view', 'export'],
    },
  },
  {
    moduleId: 'estoque',
    moduleName: 'Gestão de Estoque & Pulmão',
    category: 'Operacional',
    description: 'Ocupação de posições palete, inventário rotativo e movimentação de mercadorias.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'romaneio_tarde',
    moduleName: 'Romaneio Tarde (Separação)',
    category: 'Operacional',
    description: 'Conferência e separação de pedidos da operação do turno da tarde.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'romaneio_noturno',
    moduleName: 'Romaneio Noturno (Expedição)',
    category: 'Operacional',
    description: 'Conferência, carregamento e expedição noturna de rotas.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'exp_loja',
    moduleName: 'Expedição Loja',
    category: 'Operacional',
    description: 'Separação e atendimento para abastecimento de lojas da rede.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'boraceia',
    moduleName: 'Filial Boracéia (Transferências)',
    category: 'Operacional',
    description: 'Gestão de viagens, transbordo e recebimento entre filiais.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'veiculos',
    moduleName: 'Gestão de Frota & Veículos',
    category: 'Operacional',
    description: 'Checklists diários de veículos, controle de manutenções e cadastro de frota.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'delete', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'projetos',
    moduleName: 'Quadro de Projetos & Ações (Kanban)',
    category: 'Gestão & Planejamento',
    description: 'Gerenciamento visual de planos de ação, metas corporativas e tarefas entre setores.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'delete', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'inventario_geral',
    moduleName: 'Inventário Geral & WMS',
    category: 'Gestão & Planejamento',
    description: 'Contagens físicas, auditorias de lote e acuracidade de estoque.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'export'],
      operator: ['view', 'create', 'edit'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'cipa',
    moduleName: 'Segurança do Trabalho & CIPA',
    category: 'Corporativo',
    description: 'Membros da comissão, mapa de riscos, ocorrências e treinamentos de brigada.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: ['view', 'create', 'edit', 'export'],
      operator: ['view', 'create'],
      viewer: ['view'],
    },
  },
  {
    moduleId: 'audit_logs',
    moduleName: 'Trilha de Auditoria & Logs de Sistema',
    category: 'Segurança & TI',
    description: 'Rastreabilidade e log de alterações, senhas, acessos, operações e exclusões.',
    defaultByRole: {
      admin: ['view', 'export'],
      manager: ['view'],
      operator: [],
      viewer: [],
    },
  },
  {
    moduleId: 'settings',
    moduleName: 'Configurações do Sistema & Senhas',
    category: 'Segurança & TI',
    description: 'Gestão de senhas mestre, parâmetros de capacidade e permissões de usuários.',
    defaultByRole: {
      admin: ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'],
      manager: [],
      operator: [],
      viewer: [],
    },
  },
];

export const ROUTE_PERMISSIONS: Record<string, RoutePermission> = {
  dashboard: {
    tabId: 'dashboard',
    name: 'Dashboard Geral',
    allowedDepartments: ['admin', 'viewer', 'recebimento', 'estoque', 'romaneio_tarde', 'romaneio_noturno', 'exp_loja', 'boraceia', 'veiculos'],
    allowAllAuthenticated: true,
    description: 'Acesso liberado a todos os colaboradores e visualizadores.',
  },
  recebimento: {
    tabId: 'recebimento',
    name: 'Recebimento de Cargas',
    allowedDepartments: ['admin', 'recebimento', 'viewer'],
    description: 'Setor restrito aos operadores e conferentes de Recebimento ou Administradores.',
  },
  agenda_planilha: {
    tabId: 'agenda_planilha',
    name: 'Agenda de Recebimento (Planilha)',
    allowedDepartments: ['admin', 'recebimento', 'viewer'],
    description: 'Gestão e visualização da agenda oficial de descarregamento de carretas.',
  },
  estoque: {
    tabId: 'estoque',
    name: 'Gestão de Estoque & Pulmão',
    allowedDepartments: ['admin', 'estoque'],
    description: 'Exclusivo para a equipe de Estoque e Armazenamento.',
  },
  romaneio_tarde: {
    tabId: 'romaneio_tarde',
    name: 'Romaneio Tarde',
    allowedDepartments: ['admin', 'romaneio_tarde'],
    description: 'Exclusivo para os operadores e supervisores do Romaneio Tarde.',
  },
  romaneio_noturno: {
    tabId: 'romaneio_noturno',
    name: 'Romaneio Noturno',
    allowedDepartments: ['admin', 'romaneio_noturno'],
    description: 'Exclusivo para a equipe e conferentes do Romaneio Noturno.',
  },
  exp_loja: {
    tabId: 'exp_loja',
    name: 'Expedição Loja',
    allowedDepartments: ['admin', 'exp_loja'],
    description: 'Exclusivo para a equipe de Expedição Loja.',
  },
  boraceia: {
    tabId: 'boraceia',
    name: 'Filial Boracéia',
    allowedDepartments: ['admin', 'boraceia'],
    description: 'Exclusivo para os colaboradores da filial Boracéia.',
  },
  veiculos: {
    tabId: 'veiculos',
    name: 'Gestão de Frota & Veículos',
    allowedDepartments: ['admin', 'veiculos'],
    description: 'Exclusivo para o setor de Veículos, Transporte e Frota.',
  },
  projetos: {
    tabId: 'projetos',
    name: 'Projetos & Kanban Corporativo',
    allowedDepartments: ['admin', 'viewer', 'recebimento', 'estoque', 'romaneio_tarde', 'romaneio_noturno', 'exp_loja', 'boraceia', 'veiculos'],
    allowAllAuthenticated: true,
    description: 'Acompanhamento interativo de metas, tarefas e planos de ação da empresa.',
  },
  inventario_geral: {
    tabId: 'inventario_geral',
    name: 'Inventário Geral & WMS',
    allowedDepartments: ['admin', 'viewer', 'recebimento', 'estoque', 'romaneio_tarde', 'romaneio_noturno', 'exp_loja', 'boraceia', 'veiculos'],
    allowAllAuthenticated: true,
    description: 'Planejamento e execução de contagens de inventário para toda a operação.',
  },
  cipa: {
    tabId: 'cipa',
    name: 'Comissão Interna de Prevenção de Acidentes (CIPA)',
    allowedDepartments: ['admin', 'viewer', 'recebimento', 'estoque', 'romaneio_tarde', 'romaneio_noturno', 'exp_loja', 'boraceia', 'veiculos'],
    allowAllAuthenticated: true,
    description: 'Portal de segurança e saúde ocupacional com acesso a toda a empresa.',
  },
  audit_logs: {
    tabId: 'audit_logs',
    name: 'Trilha de Auditoria (Audit Logs)',
    allowedDepartments: ['admin'],
    description: 'Visualização completa da trilha de auditoria e conformidade da empresa.',
  },
  settings: {
    tabId: 'settings',
    name: 'Configurações do Sistema & Senhas',
    allowedDepartments: ['admin'],
    description: 'Área ultra restrita para Administradores de TI e Gestão Geral.',
  },
};

/**
 * Determina o papel do usuário (Role) com inteligência e fallback
 */
export function resolveUserRole(profile: UserProfile | null | undefined): UserRole {
  if (!profile) return 'viewer';
  
  if (profile.email === 'ebsonsilva7@gmail.com' || profile.departmentId === 'admin' || profile.role === 'admin') {
    return 'admin';
  }
  
  if (profile.departmentId === 'viewer' || profile.role === 'viewer') {
    return 'viewer';
  }

  if (profile.role) {
    return profile.role;
  }

  // Se tem departamento operacional específico, papel padrão é operador
  return 'operator';
}

/**
 * Valida se um usuário pode executar uma ação específica em determinado módulo
 */
export function canUserPerform(
  profile: UserProfile | null | undefined,
  moduleId: string,
  action: AppAction
): boolean {
  if (!profile) return false;

  const role = resolveUserRole(profile);

  // Super Admin pode tudo
  if (role === 'admin') return true;

  // Se o usuário possui permissão customizada explícita para este módulo, usa ela
  if (profile.customPermissions && profile.customPermissions[moduleId]) {
    return profile.customPermissions[moduleId].includes(action);
  }

  // Verifica se o usuário tem acesso geral à aba
  const tabAccess = checkTabAccess(moduleId, profile);
  if (!tabAccess.authorized && action === 'view') {
    return false;
  }

  // Procura na matriz de permissões padrão
  const moduleConfig = MODULE_PERMISSIONS_MATRIX.find(m => m.moduleId === moduleId);
  if (!moduleConfig) {
    return false;
  }

  const allowedActions = moduleConfig.defaultByRole[role] || [];
  return allowedActions.includes(action);
}

/**
 * Retorna a lista de ações permitidas para o usuário em um módulo
 */
export function getUserModuleActions(
  profile: UserProfile | null | undefined,
  moduleId: string
): AppAction[] {
  if (!profile) return [];

  const role = resolveUserRole(profile);
  if (role === 'admin') {
    return ['view', 'create', 'edit', 'delete', 'export', 'manage_settings'];
  }

  if (profile.customPermissions && profile.customPermissions[moduleId]) {
    return profile.customPermissions[moduleId];
  }

  const moduleConfig = MODULE_PERMISSIONS_MATRIX.find(m => m.moduleId === moduleId);
  if (!moduleConfig) return [];

  return moduleConfig.defaultByRole[role] || [];
}

/**
 * Valida se um usuário possui permissão para acessar determinada aba / tela do sistema
 */
export function checkTabAccess(tabId: string, profile: UserProfile | null | undefined): {
  authorized: boolean;
  reason?: string;
  permission?: RoutePermission;
} {
  if (!profile) {
    return {
      authorized: false,
      reason: 'Sessão não autenticada. Faça login para continuar.',
    };
  }

  const dept = profile.departmentId;
  const role = resolveUserRole(profile);

  // Administrador tem acesso universal
  if (role === 'admin' || dept === 'admin') {
    return { authorized: true, permission: ROUTE_PERMISSIONS[tabId] };
  }

  const permission = ROUTE_PERMISSIONS[tabId];
  if (!permission) {
    // Se não houver regra explícita, bloqueia por padrão (Zero Trust)
    return {
      authorized: false,
      reason: 'Esta seção não possui regras de acesso definidas.',
    };
  }

  if (permission.allowAllAuthenticated) {
    return { authorized: true, permission };
  }

  const isAllowed = permission.allowedDepartments.includes(dept);

  if (isAllowed) {
    return { authorized: true, permission };
  }

  return {
    authorized: false,
    reason: `Seu perfil (${getDepartmentName(dept)}) não tem credencial de acesso ao módulo de ${permission.name}.`,
    permission,
  };
}

export function getDepartmentName(deptId: DepartmentId | 'admin' | string | undefined): string {
  if (!deptId) return 'Desconhecido';
  if (deptId === 'admin') return 'Administrador Geral';
  if (deptId === 'viewer') return 'Visualizador (Somente Leitura)';
  if (deptId === 'recebimento') return 'Recebimento';
  if (deptId === 'estoque') return 'Estoque';
  if (deptId === 'romaneio_tarde') return 'Romaneio Tarde';
  if (deptId === 'romaneio_noturno') return 'Romaneio Noturno';
  if (deptId === 'exp_loja') return 'Expedição Loja';
  if (deptId === 'boraceia') return 'Filial Boracéia';
  if (deptId === 'veiculos') return 'Veículos / Frota';
  return deptId;
}

