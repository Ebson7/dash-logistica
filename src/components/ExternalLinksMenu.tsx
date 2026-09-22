import React, { useState, useRef, useEffect } from 'react';
import { 
  ExternalLink, 
  ChevronDown, 
  ChevronUp, 
  Globe, 
  ClipboardList, 
  Package, 
  Truck, 
  FileSpreadsheet, 
  Boxes, 
  Sparkles,
  Search,
  ArrowUpRight,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ExternalLinkItem {
  id: string;
  title: string;
  subtitle?: string;
  url: string;
  iconName: 'ClipboardList' | 'Package' | 'Truck' | 'FileSpreadsheet' | 'Boxes' | 'Globe';
  category?: string;
  badge?: string;
  badgeColor?: 'blue' | 'amber' | 'emerald' | 'purple' | 'rose';
  description?: string;
}

export const EXTERNAL_SYSTEM_LINKS: ExternalLinkItem[] = [
  {
    id: 'agenda_boraceia',
    title: 'Agenda Boracéia',
    subtitle: 'Sistema de agendamento e controle Boracéia',
    url: 'https://agendabora.vercel.app/',
    iconName: 'FileSpreadsheet',
    category: 'Agendamento',
    badge: 'Agenda Boracéia',
    badgeColor: 'emerald',
    description: 'Sistema web para controle de agendamentos da Filial Boracéia.'
  },
  {
    id: 'romaneio',
    title: 'Acessar Romaneio',
    subtitle: 'Acessar após às 13:30 em dias de semana',
    url: 'https://romaneiomarsil.lovable.app/',
    iconName: 'ClipboardList',
    category: 'Romaneio',
    badge: 'Romaneio SP',
    badgeColor: 'blue',
    description: 'Sistema web para gestão e conferência de romaneios de entrega.'
  },
  {
    id: 'estoque_boraceia',
    title: 'Consulta Estoque Boracéia',
    subtitle: 'Aplicação de consulta de estoque Boracéia',
    url: 'https://reposi-o-de-estoque-bc.vercel.app/',
    iconName: 'Package',
    category: 'Estoque',
    badge: 'Boracéia',
    badgeColor: 'amber',
    description: 'Painel e relatórios para conferência e consulta de posições de estoque da Filial Boracéia.'
  }
];

const ICON_MAP = {
  ClipboardList,
  Package,
  Truck,
  FileSpreadsheet,
  Boxes,
  Globe
};

interface ExternalLinksMenuProps {
  isCollapsed?: boolean;
}

export function ExternalLinksMenu({ isCollapsed = false }: ExternalLinksMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Close flyout on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (flyoutRef.current && !flyoutRef.current.contains(event.target as Node)) {
        setFlyoutOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isCollapsed) {
    return (
      <div className="relative" ref={flyoutRef}>
        <button
          onClick={() => setFlyoutOpen(!flyoutOpen)}
          title="Sistemas Externos & Links"
          className={`w-full flex items-center justify-center p-2.5 rounded-xl transition-all relative ${
            flyoutOpen 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Globe size={18} className="shrink-0" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-white dark:ring-neutral-900" />
        </button>

        {/* Flyout popup for collapsed mode */}
        <AnimatePresence>
          {flyoutOpen && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.95 }}
              className="absolute left-full ml-3 bottom-0 w-72 bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-3 z-50 space-y-2"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-neutral-800 px-1">
                <div className="flex items-center gap-2">
                  <Globe size={15} className="text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-xs text-neutral-900 dark:text-white uppercase tracking-wider">
                    Sistemas Externos ({EXTERNAL_SYSTEM_LINKS.length})
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                {EXTERNAL_SYSTEM_LINKS.map(link => {
                  const IconComponent = ICON_MAP[link.iconName] || Globe;
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-start gap-2.5 p-2 rounded-xl bg-neutral-50 hover:bg-blue-50/70 dark:bg-neutral-800/60 dark:hover:bg-blue-950/40 border border-neutral-100 dark:border-neutral-700/60 transition-all"
                    >
                      <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                        link.badgeColor === 'emerald'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : link.badgeColor === 'amber' 
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' 
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      }`}>
                        <IconComponent size={14} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-bold text-xs text-neutral-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                            {link.title}
                          </span>
                          <ArrowUpRight size={12} className="text-neutral-400 group-hover:text-blue-600 shrink-0" />
                        </div>
                        {link.subtitle && (
                          <p className="text-[10px] text-neutral-400 dark:text-neutral-400 line-clamp-2 mt-0.5 leading-tight">
                            {link.subtitle}
                          </p>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="bg-neutral-50/80 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-800/80 rounded-xl overflow-hidden transition-all">
      {/* Header Menu Toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100/70 dark:hover:bg-neutral-800/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Globe size={12} />
          </div>
          <span className="uppercase tracking-wider text-[10px] font-bold">Sistemas Externos</span>
          <span className="text-[9px] bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded-full font-bold">
            {EXTERNAL_SYSTEM_LINKS.length}
          </span>
        </div>
        <div className="text-neutral-400">
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {/* Links List */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="px-2 pb-2 space-y-1.5 overflow-hidden"
          >
            {EXTERNAL_SYSTEM_LINKS.map(link => {
              const IconComponent = ICON_MAP[link.iconName] || Globe;
              const isAmber = link.badgeColor === 'amber';
              const isEmerald = link.badgeColor === 'emerald';
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group block p-2 rounded-lg border transition-all relative overflow-hidden ${
                    isEmerald
                      ? 'bg-white dark:bg-neutral-800 hover:bg-emerald-50/60 dark:hover:bg-emerald-950/30 border-neutral-200/70 dark:border-neutral-700/60 hover:border-emerald-300'
                      : isAmber
                        ? 'bg-white dark:bg-neutral-800 hover:bg-amber-50/60 dark:hover:bg-amber-950/30 border-neutral-200/70 dark:border-neutral-700/60 hover:border-amber-300'
                        : 'bg-white dark:bg-neutral-800 hover:bg-blue-50/60 dark:hover:bg-blue-950/30 border-neutral-200/70 dark:border-neutral-700/60 hover:border-blue-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                      isEmerald
                        ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-100'
                        : isAmber
                          ? 'bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 group-hover:bg-amber-100'
                          : 'bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-100'
                    }`}>
                      <IconComponent size={14} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`font-semibold text-xs truncate ${
                          isEmerald
                            ? 'text-neutral-800 dark:text-neutral-200 group-hover:text-emerald-600'
                            : isAmber 
                              ? 'text-neutral-800 dark:text-neutral-200 group-hover:text-amber-600' 
                              : 'text-neutral-800 dark:text-neutral-200 group-hover:text-blue-600'
                        }`}>
                          {link.title}
                        </span>
                        <ArrowUpRight size={12} className="text-neutral-400 group-hover:text-neutral-800 dark:group-hover:text-neutral-200 shrink-0" />
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
