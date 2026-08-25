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

export interface Occurrence {
  id: string;
  timestamp: number;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
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

export interface UserProfile {
  uid: string;
  email: string;
  departmentId: DepartmentId | 'admin';
  displayName: string;
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

