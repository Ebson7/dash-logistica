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

