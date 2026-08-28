import React from 'react';
import {
  Activity,
  FileSpreadsheet,
  Boxes,
  Truck,
  Bell,
  Menu,
  MessageSquareWarning,
  Sparkles
} from 'lucide-react';
import { UserProfile } from '../types';

interface MobileBottomNavProps {
  activeTab: string;
  onSelectTab: (tabId: string) => void;
  onOpenMobileMenu: () => void;
  onOpenNotificationCenter: () => void;
  unreadCount: number;
  unreadCriticalCount: number;
  profile: UserProfile | null;
}

export function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenMobileMenu,
  onOpenNotificationCenter,
  unreadCount,
  unreadCriticalCount,
  profile
}: MobileBottomNavProps) {
  const items = [
    {
      id: 'dashboard',
      label: 'Geral',
      icon: Activity
    },
    {
      id: 'recebimento',
      label: 'Agenda',
      icon: FileSpreadsheet
    },
    {
      id: 'estoque',
      label: 'Estoque',
      icon: Boxes
    },
    {
      id: 'romaneio_tarde',
      label: 'Expedição',
      icon: Truck
    }
  ];

  return (
    <div className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 pb-[env(safe-area-inset-bottom,0px)] shadow-2xl">
      <div className="flex items-center justify-around px-2 py-1.5 max-w-lg mx-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all min-h-[48px] min-w-[54px] active:scale-95 ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium'
              }`}
            >
              <div className="relative">
                <Icon size={20} className={isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'} />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                )}
              </div>
              <span className="text-[10px] mt-1 leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Notifications Button */}
        <button
          type="button"
          onClick={onOpenNotificationCenter}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium transition-all min-h-[48px] min-w-[54px] active:scale-95 relative"
        >
          <div className="relative">
            <Bell size={20} className="stroke-[1.75]" />
            {unreadCount > 0 && (
              <span
                className={`absolute -top-1 -right-2 px-1 min-w-[15px] h-[15px] rounded-full text-white text-[8px] font-black flex items-center justify-center shadow-xs ${
                  unreadCriticalCount > 0 ? 'bg-rose-500 animate-pulse' : 'bg-blue-600'
                }`}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-1 leading-none tracking-tight">
            Alertas
          </span>
        </button>

        {/* All Modules Menu Button */}
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex flex-col items-center justify-center py-1 px-2.5 rounded-xl text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium transition-all min-h-[48px] min-w-[54px] active:scale-95"
        >
          <Menu size={20} className="stroke-[1.75]" />
          <span className="text-[10px] mt-1 leading-none tracking-tight">
            Menu
          </span>
        </button>
      </div>
    </div>
  );
}
