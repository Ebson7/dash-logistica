import { Timestamp } from 'firebase/firestore';

export type DepartmentId = 'estoque' | 'recebimento' | 'romaneio_tarde' | 'romaneio_noturno' | 'veiculos' | 'exp_loja' | 'viewer';

export interface Department {
  id: DepartmentId;
  name: string;
  totalStaff: number;
  icon: string;
  roles: string[];
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
  status: 'Aguardando' | 'Descarregando' | 'Recebido' | 'Cancelado';
  totalValue: number;
  paymentTerm: string;
  createdAt: number | Timestamp;
  deleted?: boolean;
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
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  departmentId: DepartmentId | 'admin';
  displayName: string;
}
