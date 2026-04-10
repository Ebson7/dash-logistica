import { DepartmentId, Department } from './types';

export const DEPARTMENTS: Record<DepartmentId, Department> = {
  estoque: {
    id: 'estoque',
    name: 'Estoque',
    totalStaff: 15,
    icon: 'Package',
    roles: ['Conferente', 'Operador de Empilhadeira', 'Auxiliar de Logística'],
  },
  recebimento: {
    id: 'recebimento',
    name: 'Recebimento',
    totalStaff: 10,
    icon: 'Download',
    roles: ['Conferente', 'Auxiliar de Recebimento', 'Operador de Pátio'],
  },
  romaneio_tarde: {
    id: 'romaneio_tarde',
    name: 'Romaneio Tarde',
    totalStaff: 12,
    icon: 'ClipboardList',
    roles: ['Separador', 'Conferente de Carga', 'Auxiliar de Expedição'],
  },
  romaneio_noturno: {
    id: 'romaneio_noturno',
    name: 'Romaneio Noturno',
    totalStaff: 12,
    icon: 'ClipboardList',
    roles: ['Separador', 'Conferente de Carga', 'Auxiliar de Expedição'],
  },
  veiculos: {
    id: 'veiculos',
    name: 'Veículos',
    totalStaff: 8,
    icon: 'Truck',
    roles: ['Motorista', 'Ajudante', 'Monitor de Frota'],
  },
  exp_loja: {
    id: 'exp_loja',
    name: 'Exp. Loja',
    totalStaff: 10,
    icon: 'ClipboardList',
    roles: ['Separador', 'Conferente de Carga', 'Auxiliar de Expedição'],
  },
};

export const VEHICLE_TYPES = [
  'Caminhão Baú',
  'Sider',
  'VUC',
  'Carreta',
  'Contêiner',
];
