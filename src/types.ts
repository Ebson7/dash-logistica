import { Timestamp } from 'firebase/firestore';

export type DepartmentId = 'estoque' | 'recebimento' | 'romaneio_tarde' | 'romaneio_noturno' | 'veiculos' | 'exp_loja' | 'boraceia' | 'viewer';

export interface Department {
  id: DepartmentId;
  name: string;
  totalStaff: number;
  icon: string;
  roles: string[];
  inventoryCapacity?: number;
}

export interface OccurrenceComment {
  id: string;
  authorUid: string;
  authorName: string;
  authorDepartment?: string;
  text: string;
  timestamp: number;
}

export interface Occurrence {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  isCritical?: boolean;
  comments?: OccurrenceComment[];
  deptName?: string;
  departmentId?: string;
  logId?: string;
  date?: string;
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  type: string;
}

export interface DepartmentSettings {
  roles: string[];
  totalStaff: number;
  inventoryCapacity?: number;
}

export interface VehicleTypeConfig {
  id: string;
  name: string;
  palletCapacity: number;
}

export interface AppSettings {
  departments: Record<DepartmentId, DepartmentSettings>;
  vehicles: Vehicle[];
  vehicleConfig?: VehicleTypeConfig[];
}

export interface ReceivingAppointment {
  id: string;
  date: string;
  creationDate: string;
  staff: string;
  requester: string;
  contact: string;
  orderNumber: string;
  supplier: string;
  vehicle: string;
  pallets: number;
  scheduledTime: string;
  observation: string;
  collaborator: string;
  status: 'Agendado' | 'Aguardando' | 'Descarregando' | 'Recebido' | 'Cancelado';
  totalValue: number;
  paymentTerm: string;
  receivingLocation: 'Marsil' | 'OP. Logístico' | 'Boracéia' | 'Outro';
  receivingType: 'Recebimento' | 'Retorno OP' | 'Retorno BC';
  createdAt: number | Timestamp;
  deleted?: boolean;
}

export interface BoraceiaShipment {
  id: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  paletsCount: number;
  driverName: string;
  departureTime: string;
  arrivalTimeSP: string;
  status?: 'Agendado' | 'Em Trânsito' | 'Descarregando' | 'Em Retorno SP' | 'Finalizado';
  observation?: string;
}

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  departmentId: DepartmentId;
  staffPresent: number;
  staffByRole: Record<string, number>;
  occurrences: Occurrence[];
  data: {
    vehiclesReceived?: number;
    totalVehicles?: number;
    vehicleTypes?: string[];
    vehiclesByType?: Record<string, number>;
    ordersCount?: number;
    pickersCount?: number;
    driversCount?: number;
    registeredVehicles?: string[]; // IDs of vehicles registered in the day
    availablePositions?: number;
    paletsNoChao?: number;
    folhas?: number;
    boraceiaShipments?: BoraceiaShipment[];
    totalBoraceiaPaletsSent?: number;
  };
}

export type UserRole = 'admin' | 'manager' | 'operator' | 'viewer';

export type AppAction = 'view' | 'create' | 'edit' | 'delete' | 'export' | 'manage_settings';

export interface ModulePermissionConfig {
  moduleId: string;
  moduleName: string;
  category: 'Operacional' | 'Gestão & Planejamento' | 'Corporativo' | 'Segurança & TI';
  description: string;
  defaultByRole: Record<UserRole, AppAction[]>;
}

export interface UserProfile {
  uid: string;
  email: string;
  departmentId: DepartmentId | 'admin';
  displayName: string;
  role?: UserRole;
  status?: 'active' | 'blocked' | 'pending';
  customPermissions?: Record<string, AppAction[]>;
  phone?: string;
  badgeNumber?: string;
  password?: string;
  hasCustomPassword?: boolean;
  passwordUpdatedAt?: any;
  createdAt?: any;
  lastLogin?: any;
  updatedAt?: any;
}

export interface CipaMember {
  id: string;
  name: string;
  role: string;
  cipaRole: string;
  department: string;
  unit: 'São Paulo' | 'Boracéia' | 'Todas';
  workSchedule: string;
  shift: 'Manhã' | 'Tarde' | 'Noturno' | 'Comercial' | 'Geral';
  status: 'Em Turno' | 'Disponível' | 'Folga' | 'Férias' | 'Afastado';
  phone?: string;
  email?: string;
  badgeNumber?: string;
  mandatePeriod?: string;
  trainedFirstAid?: boolean;
  trainedFireBrigade?: boolean;
  notes?: string;
  createdAt?: number | Timestamp;
  updatedAt?: number | Timestamp;
}

export interface InventoryAnnouncement {
  id: string;
  title: string;
  content: string;
  category: 'Aviso Geral' | 'Regra de Ouro' | 'Procedimento' | 'Cronograma' | 'Segurança';
  isPinned?: boolean;
  author: string;
  date: string;
  createdAt: number;
}

export interface InventoryProcess {
  id: string;
  title: string;
  stepNumber: number;
  stage: '1ª Contagem (Cega)' | '2ª Contagem (Confronto)' | '3ª Contagem (Auditoria)' | 'Corte & WMS' | 'Ajuste ERP' | 'Organização';
  description: string;
  responsible: string;
  mandatoryRules: string[];
  tips?: string;
}

export interface InventoryTeamMember {
  name: string;
  role: 'Líder de Rua' | 'Contador' | 'Digitador / RF' | 'Auditor' | 'Suporte / Empilhador';
  badgeOrPhone?: string;
}

export interface InventoryStructureTeam {
  id: string;
  teamName: string;
  zone: string;
  shift: 'Diurno' | 'Noturno' | 'Madrugada' | 'Integral';
  leader: string;
  members: InventoryTeamMember[];
  equipment: string[];
  status: 'Confirmado' | 'Pendente' | 'Em Ajuste';
}

export interface InventoryDocument {
  id: string;
  title: string;
  description: string;
  category: 'Manual' | 'Cronograma' | 'Mapeamento' | 'POP / Norma' | 'Planilha de Apoio' | 'Outro';
  fileName: string;
  fileSize?: string;
  fileData?: string;
  fileUrl?: string;
  uploadedAt: string;
  uploadedBy: string;
}

export interface InventoryPhase {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'Concluído' | 'Em Andamento' | 'Planejado' | 'Pendente';
  description: string;
  progressPercent: number;
}

export interface InventoryConfigData {
  id?: string;
  title: string;
  targetDate: string;
  targetTime?: string;
  status: 'Planejamento Inicial' | 'Preparação & Treinamento' | 'Auditoria Prévia' | 'Inventário em Andamento' | 'Reconciliação Final' | 'Inventário Concluído';
  accuracyGoal: number;
  estimatedItems: number;
  estimatedPositions: number;
  coordinator: string;
  coCoordinator?: string;
  description: string;
  guidelinesSummary: string;
  announcements: InventoryAnnouncement[];
  processes: InventoryProcess[];
  structure: InventoryStructureTeam[];
  documents: InventoryDocument[];
  phases: InventoryPhase[];
  updatedAt?: string;
  updatedBy?: string;
}

export type AuditActionType =
  // Auth & Security
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE_ADMIN'
  | 'PASSWORD_CHANGE_DEPT'
  | 'PASSWORD_CHANGE_USER'
  | 'SECURITY_POLICY_UPDATE'
  // RBAC & User Management
  | 'USER_CREATE'
  | 'USER_UPDATE'
  | 'USER_BLOCK'
  | 'USER_UNBLOCK'
  | 'USER_DELETE'
  | 'ROLE_CHANGE'
  | 'PERMISSIONS_CUSTOMIZE'
  // Occurrences & Comments
  | 'OCCURRENCE_CREATE'
  | 'OCCURRENCE_UPDATE'
  | 'OCCURRENCE_DELETE'
  | 'OCCURRENCE_RESOLVE'
  | 'COMMENT_ADD'
  | 'COMMENT_DELETE'
  // Operations & Logistics
  | 'DAILY_LOG_SAVE'
  | 'RECEIVING_SCHEDULE_UPDATE'
  | 'RECEIVING_SCHEDULE_DUPLICATE'
  | 'RECEIVING_SCHEDULE_DELETE'
  | 'VEHICLE_REGISTER'
  | 'VEHICLE_STATUS_UPDATE'
  | 'VEHICLE_CHECKLIST_SAVE'
  | 'VEHICLE_DELETE'
  | 'BORACEIA_TRANSFER_RECORD'
  | 'STOCK_POSITION_UPDATE'
  // Projects, Inventory, CIPA
  | 'PROJECT_TASK_CREATE'
  | 'PROJECT_TASK_UPDATE'
  | 'PROJECT_TASK_DELETE'
  | 'INVENTORY_COUNT_RECORD'
  | 'INVENTORY_CONFIG_UPDATE'
  | 'CIPA_MEMBER_ADD'
  | 'CIPA_MEMBER_UPDATE'
  | 'CIPA_MEMBER_DELETE'
  // Exports & System
  | 'EXPORT_EXCEL'
  | 'EXPORT_CSV'
  | 'EXPORT_PDF'
  | 'SETTINGS_UPDATE'
  | 'SYSTEM_ACTION';

export type AuditCategory =
  | 'AUTH_SECURITY'
  | 'PERMISSIONS_RBAC'
  | 'OCCURRENCES'
  | 'LOGISTICS_OPS'
  | 'VEHICLES'
  | 'PROJECTS_KANBAN'
  | 'INVENTORY'
  | 'CIPA'
  | 'SETTINGS'
  | 'DATA_EXPORT';

export type AuditSeverity = 'info' | 'success' | 'warning' | 'critical';

export interface AuditLog {
  id?: string;
  timestamp: any; // Firestore Timestamp or ISO string / number
  createdAtClient?: string;
  action: AuditActionType | string;
  category: AuditCategory;
  severity: AuditSeverity;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  actorRole?: UserRole | string;
  actorDepartment?: string;
  targetId?: string;
  targetType?: string;
  targetName?: string;
  description: string;
  details?: Record<string, any>;
  clientInfo?: {
    userAgent?: string;
    platform?: string;
    url?: string;
  };
  ipAddress?: string;
}

// --- Notifications & Real-Time Alerts ---
export type NotificationType = 
  | 'occurrence'
  | 'critical_alert'
  | 'receiving_schedule'
  | 'inventory'
  | 'project_task'
  | 'security_auth'
  | 'cipa_safety'
  | 'broadcast'
  | 'vehicle_fleet'
  | 'system_info';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'critical';

export type NotificationTargetType = 'all' | 'department' | 'role' | 'user';

export interface SystemNotification {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  targetType: NotificationTargetType;
  targetDepartment?: DepartmentId | 'admin' | 'viewer' | 'all';
  targetRole?: UserRole | string;
  targetUserId?: string;
  linkTab?: string;
  linkParams?: Record<string, any>;
  timestamp: any; // Firestore Timestamp or Date / number
  createdAtClient?: number;
  createdBy?: {
    uid?: string;
    name?: string;
    email?: string;
    departmentId?: string;
  };
  readBy: string[]; // List of user IDs or department IDs who read this notification
  isPinned?: boolean;
  soundAlert?: boolean;
  actionLabel?: string;
}


