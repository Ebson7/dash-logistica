import React, { useState, useEffect, useMemo } from 'react';
import {
  Kanban,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  User,
  Tag,
  Trash2,
  Edit2,
  X,
  ChevronRight,
  MoreVertical,
  CheckSquare,
  Square,
  ArrowRight,
  FolderKanban,
  Sparkles,
  Lock,
  Eye,
  Layers,
  BarChart3,
  ListOrdered,
  AlertTriangle,
  MoveRight,
  Check,
  Building2,
  AlignLeft,
  CalendarDays
} from 'lucide-react';
import {
  collection,
  query,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  orderBy
} from 'firebase/firestore';
import { db } from '../firebase';

export interface KanbanCard {
  id: string;
  projectId: string;
  columnId: string;
  title: string;
  description?: string;
  priority: 'baixa' | 'media' | 'alta' | 'urgente';
  departmentId?: string;
  assigneeName?: string;
  dueDate?: string;
  startDate?: string;
  tags?: string[];
  checklist?: { id: string; text: string; done: boolean }[];
  order: number;
  color?: string;
  createdAt?: any;
  updatedAt?: any;
  updatedBy?: string;
}

export interface KanbanColumn {
  id: string;
  title: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderAccent: string;
  limit?: number;
}

export interface KanbanProject {
  id: string;
  title: string;
  description: string;
  category: string;
  targetDate?: string;
  status: 'planejamento' | 'em_andamento' | 'concluido' | 'pausado';
  color: string;
  createdAt?: any;
  createdBy?: string;
}

const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', title: 'Backlog / A Fazer', color: 'bg-neutral-500', badgeBg: 'bg-neutral-100 dark:bg-neutral-800', badgeText: 'text-neutral-700 dark:text-neutral-300', borderAccent: 'border-neutral-300 dark:border-neutral-700' },
  { id: 'em_andamento', title: 'Em Andamento', color: 'bg-blue-500', badgeBg: 'bg-blue-50 dark:bg-blue-900/30', badgeText: 'text-blue-700 dark:text-blue-300', borderAccent: 'border-blue-400 dark:border-blue-700' },
  { id: 'revisao', title: 'Em Validação / Testes', color: 'bg-amber-500', badgeBg: 'bg-amber-50 dark:bg-amber-900/30', badgeText: 'text-amber-700 dark:text-amber-300', borderAccent: 'border-amber-400 dark:border-amber-700' },
  { id: 'concluido', title: 'Concluído', color: 'bg-emerald-500', badgeBg: 'bg-emerald-50 dark:bg-emerald-900/30', badgeText: 'text-emerald-700 dark:text-emerald-300', borderAccent: 'border-emerald-400 dark:border-emerald-700' }
];

const INITIAL_PROJECTS: Omit<KanbanProject, 'id'>[] = [
  {
    title: 'Modernização & Otimização do CD Boracéia',
    description: 'Projetos prioritários de melhoria de processos, agendamento de docas e rastreabilidade logística.',
    category: 'Operacional & Logística',
    targetDate: '2026-12-31',
    status: 'em_andamento',
    color: 'emerald'
  },
  {
    title: 'Automação & Auditoria de Avarias / Devoluções',
    description: 'Fluxo estruturado para diminuir perdas no recebimento e otimizar triagem de devolução.',
    category: 'Qualidade & Perdas',
    targetDate: '2026-10-15',
    status: 'em_andamento',
    color: 'blue'
  },
  {
    title: 'Capacitação e Segurança Operacional',
    description: 'Treinamentos de NR11, conferência de carga e operação segura de empilhadeiras.',
    category: 'Gente & Gestão',
    targetDate: '2026-09-30',
    status: 'planejamento',
    color: 'amber'
  }
];

const PRIORITY_CONFIG = {
  baixa: { label: 'Baixa', color: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700' },
  media: { label: 'Média', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
  alta: { label: 'Alta', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  urgente: { label: 'Urgente', color: 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-700 font-bold animate-pulse' }
};

const DEPARTMENTS_LIST = [
  'Recebimento',
  'Veículos & Boracéia',
  'Separação',
  'Avarias',
  'Devolução',
  'Estoque',
  'Logística Geral',
  'TI & Sistemas',
  'Diretoria & Adm'
];

interface KanbanProjectsViewProps {
  isAdminUser: boolean;
  userEmail?: string;
  userName?: string;
}

export function KanbanProjectsView({ isAdminUser, userEmail, userName }: KanbanProjectsViewProps) {
  const [projects, setProjects] = useState<KanbanProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [cards, setCards] = useState<KanbanCard[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'board' | 'metrics'>('board');

  // Modals & Card Editing
  const [isCardModalOpen, setIsCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
  const [targetColumnForNewCard, setTargetColumnForNewCard] = useState<string>('backlog');

  // Project Modal
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<KanbanProject | null>(null);

  // Card details view for viewer or editing
  const [selectedCardDetail, setSelectedCardDetail] = useState<KanbanCard | null>(null);

  // Load Projects from Firestore
  useEffect(() => {
    const q = query(collection(db, 'kanban_projects'), orderBy('title', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projs: KanbanProject[] = [];
      snapshot.forEach((docSnap) => {
        projs.push({ id: docSnap.id, ...(docSnap.data() as any) });
      });

      if (projs.length === 0 && isAdminUser) {
        // Seed initial projects
        INITIAL_PROJECTS.forEach(async (initP) => {
          try {
            await addDoc(collection(db, 'kanban_projects'), {
              ...initP,
              createdAt: serverTimestamp(),
              createdBy: userEmail || 'admin'
            });
          } catch (e) {
            console.error('Error creating initial project', e);
          }
        });
      } else {
        setProjects(projs);
        if (!activeProjectId && projs.length > 0) {
          setActiveProjectId(projs[0].id);
        }
      }
      setLoading(false);
    }, (error) => {
      console.error('Error fetching projects:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAdminUser, userEmail, activeProjectId]);

  // Load Cards for active project
  useEffect(() => {
    if (!activeProjectId) {
      setCards([]);
      return;
    }

    const q = query(collection(db, 'kanban_cards'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allCards: KanbanCard[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as any;
        if (data.projectId === activeProjectId) {
          allCards.push({ id: docSnap.id, ...data });
        }
      });
      // Sort cards by order
      allCards.sort((a, b) => (a.order || 0) - (b.order || 0));
      setCards(allCards);
    }, (error) => {
      console.error('Error fetching cards:', error);
    });

    return () => unsubscribe();
  }, [activeProjectId]);

  // Active Project object
  const activeProject = useMemo(() => {
    return projects.find((p) => p.id === activeProjectId) || projects[0] || null;
  }, [projects, activeProjectId]);

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return cards.filter((card) => {
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const matchTitle = card.title.toLowerCase().includes(queryLower);
        const matchDesc = card.description?.toLowerCase().includes(queryLower);
        const matchAssignee = card.assigneeName?.toLowerCase().includes(queryLower);
        const matchTags = card.tags?.some((t) => t.toLowerCase().includes(queryLower));
        if (!matchTitle && !matchDesc && !matchAssignee && !matchTags) return false;
      }

      if (filterPriority !== 'all' && card.priority !== filterPriority) {
        return false;
      }

      if (filterDepartment !== 'all' && card.departmentId !== filterDepartment) {
        return false;
      }

      return true;
    });
  }, [cards, searchQuery, filterPriority, filterDepartment]);

  // Handle Move card to another column (Admin only)
  const handleMoveCard = async (cardId: string, newColumnId: string) => {
    if (!isAdminUser) return;
    try {
      const cardRef = doc(db, 'kanban_cards', cardId);
      await updateDoc(cardRef, {
        columnId: newColumnId,
        updatedAt: serverTimestamp(),
        updatedBy: userName || userEmail || 'admin'
      });
    } catch (e) {
      console.error('Error moving card:', e);
      alert('Erro ao mover o card. Tente novamente.');
    }
  };

  // Handle Delete card (Admin only)
  const handleDeleteCard = async (cardId: string) => {
    if (!isAdminUser) return;
    if (!window.confirm('Tem certeza que deseja excluir esta tarefa do projeto?')) return;
    try {
      await deleteDoc(doc(db, 'kanban_cards', cardId));
      if (selectedCardDetail?.id === cardId) {
        setSelectedCardDetail(null);
      }
    } catch (e) {
      console.error('Error deleting card:', e);
      alert('Erro ao excluir card.');
    }
  };

  // Handle Save Card (Create or Edit) (Admin only)
  const handleSaveCard = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAdminUser || !activeProjectId) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const priority = formData.get('priority') as 'baixa' | 'media' | 'alta' | 'urgente';
    const departmentId = formData.get('departmentId') as string;
    const assigneeName = formData.get('assigneeName') as string;
    const dueDate = formData.get('dueDate') as string;
    const startDate = formData.get('startDate') as string;
    const tagsStr = formData.get('tags') as string;
    const columnId = (formData.get('columnId') as string) || targetColumnForNewCard;

    const tags = tagsStr
      ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean)
      : [];

    try {
      if (editingCard) {
        await updateDoc(doc(db, 'kanban_cards', editingCard.id), {
          title,
          description,
          priority,
          departmentId,
          assigneeName,
          dueDate,
          startDate,
          tags,
          columnId,
          updatedAt: serverTimestamp(),
          updatedBy: userName || userEmail || 'admin'
        });
      } else {
        const columnCards = cards.filter((c) => c.columnId === columnId);
        await addDoc(collection(db, 'kanban_cards'), {
          projectId: activeProjectId,
          columnId,
          title,
          description,
          priority,
          departmentId,
          assigneeName,
          dueDate,
          startDate,
          tags,
          order: columnCards.length,
          checklist: [],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: userName || userEmail || 'admin'
        });
      }

      setIsCardModalOpen(false);
      setEditingCard(null);
    } catch (err) {
      console.error('Error saving card:', err);
      alert('Erro ao salvar o item.');
    }
  };

  // Toggle Checklist Item
  const handleToggleChecklist = async (card: KanbanCard, checkId: string) => {
    if (!isAdminUser) return;
    const updatedChecklist = (card.checklist || []).map((item) =>
      item.id === checkId ? { ...item, done: !item.done } : item
    );

    try {
      await updateDoc(doc(db, 'kanban_cards', card.id), {
        checklist: updatedChecklist,
        updatedAt: serverTimestamp(),
        updatedBy: userName || userEmail || 'admin'
      });
      if (selectedCardDetail?.id === card.id) {
        setSelectedCardDetail({ ...selectedCardDetail, checklist: updatedChecklist });
      }
    } catch (e) {
      console.error('Error toggling checklist:', e);
    }
  };

  // Add checklist item in detail view
  const [newChecklistText, setNewChecklistText] = useState('');
  const handleAddChecklistItem = async (card: KanbanCard) => {
    if (!isAdminUser || !newChecklistText.trim()) return;
    const newItem = {
      id: Date.now().toString(),
      text: newChecklistText.trim(),
      done: false
    };
    const updatedChecklist = [...(card.checklist || []), newItem];

    try {
      await updateDoc(doc(db, 'kanban_cards', card.id), {
        checklist: updatedChecklist,
        updatedAt: serverTimestamp(),
        updatedBy: userName || userEmail || 'admin'
      });
      setNewChecklistText('');
      if (selectedCardDetail?.id === card.id) {
        setSelectedCardDetail({ ...selectedCardDetail, checklist: updatedChecklist });
      }
    } catch (e) {
      console.error('Error adding checklist item:', e);
    }
  };

  // Handle Save Project (Create / Edit) (Admin only)
  const handleSaveProject = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAdminUser) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const category = formData.get('category') as string;
    const targetDate = formData.get('targetDate') as string;
    const status = formData.get('status') as 'planejamento' | 'em_andamento' | 'concluido' | 'pausado';
    const color = (formData.get('color') as string) || 'blue';

    try {
      if (editingProject) {
        await updateDoc(doc(db, 'kanban_projects', editingProject.id), {
          title,
          description,
          category,
          targetDate,
          status,
          color,
          updatedAt: serverTimestamp()
        });
      } else {
        const docRef = await addDoc(collection(db, 'kanban_projects'), {
          title,
          description,
          category,
          targetDate,
          status,
          color,
          createdAt: serverTimestamp(),
          createdBy: userName || userEmail || 'admin'
        });
        setActiveProjectId(docRef.id);
      }

      setIsProjectModalOpen(false);
      setEditingProject(null);
    } catch (err) {
      console.error('Error saving project:', err);
      alert('Erro ao salvar projeto.');
    }
  };

  // Handle Delete Project (Admin only)
  const handleDeleteProject = async (projectId: string) => {
    if (!isAdminUser) return;
    if (!window.confirm('Tem certeza que deseja excluir este projeto inteiro e seus cards?')) return;

    try {
      // delete project
      await deleteDoc(doc(db, 'kanban_projects', projectId));
      // switch active project
      const remaining = projects.filter((p) => p.id !== projectId);
      if (remaining.length > 0) {
        setActiveProjectId(remaining[0].id);
      } else {
        setActiveProjectId('');
      }
    } catch (e) {
      console.error('Error deleting project:', e);
      alert('Erro ao excluir projeto.');
    }
  };

  // Metrics calculation
  const metrics = useMemo(() => {
    const total = cards.length;
    const completed = cards.filter((c) => c.columnId === 'concluido').length;
    const inProgress = cards.filter((c) => c.columnId === 'em_andamento').length;
    const testing = cards.filter((c) => c.columnId === 'revisao').length;
    const backlog = cards.filter((c) => c.columnId === 'backlog').length;
    const urgent = cards.filter((c) => c.priority === 'urgente' || c.priority === 'alta').length;
    const progressRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { total, completed, inProgress, testing, backlog, urgent, progressRate };
  }, [cards]);

  return (
    <div id="kanban-projects-root" className="w-full max-w-7xl mx-auto space-y-6 pb-20">
      {/* Top Header */}
      <header className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-500 text-white shadow-md shadow-indigo-500/20">
                <Kanban size={22} className="stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-neutral-900 dark:text-white tracking-tight">
                    Quadro de Projetos & Ações
                  </h1>
                  {isAdminUser ? (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                      Modo Gestor / Admin
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 flex items-center gap-1">
                      <Eye size={12} />
                      Somente Visualização
                    </span>
                  )}
                </div>
                <p className="text-sm text-neutral-500 dark:text-neutral-400">
                  Gestão visual estilo Trello / Kanban para planos de ação, melhorias contínuas e projetos operacionais.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions for Admin */}
          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-neutral-100 dark:bg-neutral-800/80 rounded-xl border border-neutral-200 dark:border-neutral-700">
              <button
                id="btn-toggle-board-view"
                onClick={() => setViewMode('board')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'board'
                    ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <Kanban size={14} />
                Quadro Kanban
              </button>
              <button
                id="btn-toggle-metrics-view"
                onClick={() => setViewMode('metrics')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'metrics'
                    ? 'bg-white dark:bg-neutral-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                <BarChart3 size={14} />
                Progresso & Métricas
              </button>
            </div>

            {isAdminUser && (
              <button
                id="btn-new-project"
                onClick={() => {
                  setEditingProject(null);
                  setIsProjectModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-bold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <FolderKanban size={15} />
                Novo Projeto
              </button>
            )}
          </div>
        </div>

        {/* Project Selector Bar */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-neutral-200 dark:border-neutral-800">
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 shrink-0 mr-1 flex items-center gap-1">
            <FolderKanban size={14} />
            Projetos:
          </span>
          {projects.map((proj) => {
            const isActive = proj.id === activeProjectId;
            return (
              <button
                key={proj.id}
                id={`btn-select-project-${proj.id}`}
                onClick={() => setActiveProjectId(proj.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20'
                    : 'bg-white dark:bg-neutral-800/90 text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700/80 hover:border-neutral-300 dark:hover:border-neutral-600'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  proj.color === 'emerald' ? 'bg-emerald-400' :
                  proj.color === 'amber' ? 'bg-amber-400' :
                  proj.color === 'rose' ? 'bg-rose-400' : 'bg-blue-400'
                }`} />
                <span className="truncate max-w-[200px]">{proj.title}</span>
              </button>
            );
          })}
        </div>

        {/* Active Project Banner & KPIs */}
        {activeProject && (
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800">
                    {activeProject.category || 'Operação'}
                  </span>
                  <h2 className="text-lg font-black text-neutral-900 dark:text-white">
                    {activeProject.title}
                  </h2>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl">
                  {activeProject.description}
                </p>
              </div>

              {/* Project Action buttons for Admin */}
              <div className="flex items-center gap-2 shrink-0">
                {activeProject.targetDate && (
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-700/50 text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                    <CalendarDays size={13} className="text-neutral-500" />
                    Meta: {new Date(activeProject.targetDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                  </div>
                )}

                {isAdminUser && (
                  <>
                    <button
                      id="btn-edit-active-project"
                      onClick={() => {
                        setEditingProject(activeProject);
                        setIsProjectModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-all"
                      title="Editar informações do projeto"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      id="btn-delete-active-project"
                      onClick={() => handleDeleteProject(activeProject.id)}
                      className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                      title="Excluir projeto"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-neutral-100 dark:border-neutral-700/60">
              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800">
                <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400">
                  <Layers size={16} />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Total Tarefas</div>
                  <div className="text-base font-black text-neutral-900 dark:text-white">{metrics.total}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
                  <Clock size={16} />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Em Andamento</div>
                  <div className="text-base font-black text-blue-600 dark:text-blue-400">{metrics.inProgress}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Concluídas</div>
                  <div className="text-base font-black text-emerald-600 dark:text-emerald-400">{metrics.completed}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-900/40 border border-neutral-100 dark:border-neutral-800">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400">
                  <Sparkles size={16} />
                </div>
                <div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">Conclusão</div>
                  <div className="text-base font-black text-amber-600 dark:text-amber-400">{metrics.progressRate}%</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                id="input-kanban-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tarefa, tag, responsável..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Priority Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-400 font-bold hidden sm:inline">Prioridade:</span>
              <select
                id="select-filter-priority"
                value={filterPriority}
                onChange={(e) => setFilterPriority(e.target.value)}
                className="py-1.5 px-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Todas Prioridades</option>
                <option value="urgente">Urgente</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            {/* Department Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-neutral-400 font-bold hidden sm:inline">Setor:</span>
              <select
                id="select-filter-department"
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="py-1.5 px-2.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">Todos Setores</option>
                {DEPARTMENTS_LIST.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          {/* New Card Button (Admin Only) */}
          {isAdminUser && (
            <button
              id="btn-add-card-top"
              onClick={() => {
                setEditingCard(null);
                setTargetColumnForNewCard('backlog');
                setIsCardModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm shadow-indigo-600/20"
            >
              <Plus size={15} />
              Adicionar Tarefa / Ação
            </button>
          )}
        </div>
      </header>

      {/* Main Kanban Board View */}
      {viewMode === 'board' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {DEFAULT_COLUMNS.map((column) => {
            const columnCards = filteredCards.filter((card) => card.columnId === column.id);

            return (
              <div
                key={column.id}
                id={`kanban-column-${column.id}`}
                className="flex flex-col rounded-2xl bg-neutral-100/90 dark:bg-neutral-900/90 border border-neutral-200/80 dark:border-neutral-800 p-3 min-h-[480px] shadow-sm"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between gap-2 pb-3 mb-2 border-b border-neutral-200/60 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${column.color}`} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
                      {column.title}
                    </h3>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-black ${column.badgeBg} ${column.badgeText} border border-neutral-200/50 dark:border-neutral-700/50`}>
                    {columnCards.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div className="space-y-3 flex-1 overflow-y-auto max-h-[650px] pr-1 scrollbar-thin">
                  {columnCards.map((card) => {
                    const priorityMeta = PRIORITY_CONFIG[card.priority] || PRIORITY_CONFIG.media;
                    const checklistTotal = card.checklist?.length || 0;
                    const checklistDone = card.checklist?.filter((c) => c.done).length || 0;

                    return (
                      <div
                        key={card.id}
                        id={`kanban-card-${card.id}`}
                        onClick={() => setSelectedCardDetail(card)}
                        className="group relative p-3.5 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700/80 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-sm hover:shadow-md transition-all cursor-pointer space-y-2.5"
                      >
                        {/* Top card tag row */}
                        <div className="flex items-center justify-between gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${priorityMeta.color}`}>
                            {priorityMeta.label}
                          </span>

                          {card.departmentId && (
                            <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 flex items-center gap-1 truncate max-w-[130px]">
                              <Building2 size={11} className="shrink-0 text-neutral-400" />
                              {card.departmentId}
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-900 dark:text-white leading-snug line-clamp-2">
                          {card.title}
                        </h4>

                        {/* Description excerpt */}
                        {card.description && (
                          <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2 leading-relaxed">
                            {card.description}
                          </p>
                        )}

                        {/* Checklist progress pill */}
                        {checklistTotal > 0 && (
                          <div className="flex items-center gap-2 pt-1">
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-600 dark:text-neutral-300">
                              <CheckSquare size={12} className={checklistDone === checklistTotal ? 'text-emerald-500' : 'text-neutral-400'} />
                              <span>{checklistDone}/{checklistTotal}</span>
                            </div>
                            <div className="flex-1 h-1.5 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${checklistDone === checklistTotal ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                style={{ width: `${(checklistDone / checklistTotal) * 100}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Bottom Row: Assignee & Date & Move Quick Actions */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-700/50 text-[11px] text-neutral-500 dark:text-neutral-400">
                          <div className="flex items-center gap-2 truncate">
                            {card.assigneeName ? (
                              <div className="flex items-center gap-1 font-semibold text-neutral-700 dark:text-neutral-300 truncate">
                                <User size={12} className="text-neutral-400 shrink-0" />
                                <span className="truncate">{card.assigneeName}</span>
                              </div>
                            ) : (
                              <span className="text-[10px] italic text-neutral-400">Sem resp.</span>
                            )}
                          </div>

                          {card.dueDate && (
                            <div className="flex items-center gap-1 font-medium text-neutral-500 shrink-0">
                              <Calendar size={11} className="text-neutral-400" />
                              <span>{new Date(card.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                            </div>
                          )}
                        </div>

                        {/* Admin Move actions bar on hover/touch */}
                        {isAdminUser && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="pt-2 flex items-center justify-between gap-1 border-t border-dashed border-neutral-200 dark:border-neutral-700"
                          >
                            <span className="text-[10px] font-bold text-neutral-400 uppercase">Mover:</span>
                            <div className="flex items-center gap-1">
                              {DEFAULT_COLUMNS.filter((col) => col.id !== card.columnId).map((targetCol) => (
                                <button
                                  key={targetCol.id}
                                  id={`btn-move-${card.id}-to-${targetCol.id}`}
                                  onClick={() => handleMoveCard(card.id, targetCol.id)}
                                  className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-neutral-100 hover:bg-indigo-100 hover:text-indigo-700 dark:bg-neutral-700 dark:hover:bg-indigo-900/60 dark:hover:text-indigo-300 text-neutral-600 dark:text-neutral-300 transition-all flex items-center gap-0.5"
                                  title={`Mover para ${targetCol.title}`}
                                >
                                  <ArrowRight size={10} />
                                  <span className="truncate max-w-[60px]">{targetCol.title.split(' ')[0]}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {columnCards.length === 0 && (
                    <div className="py-10 px-4 text-center rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 text-neutral-400 dark:text-neutral-600 text-xs">
                      Nenhuma tarefa nesta etapa
                    </div>
                  )}
                </div>

                {/* Add Card Footer Button in Column (Admin Only) */}
                {isAdminUser && (
                  <button
                    id={`btn-add-card-col-${column.id}`}
                    onClick={() => {
                      setEditingCard(null);
                      setTargetColumnForNewCard(column.id);
                      setIsCardModalOpen(true);
                    }}
                    className="mt-3 w-full py-2 px-3 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white/80 dark:hover:bg-neutral-800/80 hover:border-indigo-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus size={14} />
                    Adicionar nesta coluna
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Metrics & Analytical View */}
      {viewMode === 'metrics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Status Breakdown Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <BarChart3 size={16} className="text-indigo-600" />
                Distribuição das Tarefas por Coluna
              </h3>

              <div className="space-y-3">
                {DEFAULT_COLUMNS.map((col) => {
                  const count = cards.filter((c) => c.columnId === col.id).length;
                  const pct = metrics.total > 0 ? Math.round((count / metrics.total) * 100) : 0;
                  return (
                    <div key={col.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-neutral-700 dark:text-neutral-300">{col.title}</span>
                        <span className="text-neutral-500 font-bold">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100 dark:bg-neutral-700 overflow-hidden">
                        <div className={`h-full rounded-full ${col.color}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Priority Breakdown Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-4">
              <h3 className="text-sm font-black text-neutral-900 dark:text-white flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-500" />
                Tarefas por Nível de Prioridade
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {Object.entries(PRIORITY_CONFIG).map(([key, meta]) => {
                  const count = cards.filter((c) => c.priority === key).length;
                  return (
                    <div key={key} className={`p-3 rounded-xl border ${meta.color} space-y-1`}>
                      <div className="text-xs font-semibold">{meta.label}</div>
                      <div className="text-xl font-black">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="p-5 rounded-2xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm space-y-4">
            <h3 className="text-sm font-black text-neutral-900 dark:text-white flex items-center gap-2">
              <Building2 size={16} className="text-blue-600" />
              Tarefas por Setor Operacional
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {DEPARTMENTS_LIST.map((dept) => {
                const count = cards.filter((c) => c.departmentId === dept).length;
                return (
                  <div key={dept} className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 space-y-1">
                    <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 truncate">{dept}</div>
                    <div className="text-lg font-black text-neutral-900 dark:text-white">{count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CARD DETAIL / VIEW / EDIT MODAL */}
      {/* ========================================================================= */}
      {selectedCardDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between gap-4 bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${PRIORITY_CONFIG[selectedCardDetail.priority]?.color}`}>
                    {PRIORITY_CONFIG[selectedCardDetail.priority]?.label}
                  </span>
                  {selectedCardDetail.departmentId && (
                    <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                      {selectedCardDetail.departmentId}
                    </span>
                  )}
                  <span className="text-xs text-neutral-400 font-medium">
                    Coluna: <strong className="text-neutral-700 dark:text-neutral-200">{DEFAULT_COLUMNS.find((c) => c.id === selectedCardDetail.columnId)?.title}</strong>
                  </span>
                </div>
                <h3 className="text-lg font-black text-neutral-900 dark:text-white leading-tight">
                  {selectedCardDetail.title}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {isAdminUser && (
                  <>
                    <button
                      id="btn-edit-card-modal"
                      onClick={() => {
                        setEditingCard(selectedCardDetail);
                        setSelectedCardDetail(null);
                        setIsCardModalOpen(true);
                      }}
                      className="p-2 rounded-xl text-neutral-600 hover:text-indigo-600 hover:bg-indigo-50 dark:text-neutral-400 dark:hover:text-indigo-400 dark:hover:bg-indigo-950/40 transition-all"
                      title="Editar Tarefa"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      id="btn-delete-card-modal"
                      onClick={() => handleDeleteCard(selectedCardDetail.id)}
                      className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all"
                      title="Excluir Tarefa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button
                  id="btn-close-detail-modal"
                  onClick={() => setSelectedCardDetail(null)}
                  className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-5 overflow-y-auto flex-1">
              {/* Meta Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 text-xs">
                <div>
                  <span className="text-neutral-400 font-medium block">Responsável</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1 mt-0.5">
                    <User size={13} className="text-neutral-400" />
                    {selectedCardDetail.assigneeName || 'Não atribuído'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-400 font-medium block">Data Limite</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1 mt-0.5">
                    <Calendar size={13} className="text-neutral-400" />
                    {selectedCardDetail.dueDate
                      ? new Date(selectedCardDetail.dueDate + 'T12:00:00').toLocaleDateString('pt-BR')
                      : 'Sem prazo'}
                  </span>
                </div>

                <div>
                  <span className="text-neutral-400 font-medium block">Início Previsto</span>
                  <span className="font-bold text-neutral-800 dark:text-neutral-200 flex items-center gap-1 mt-0.5">
                    <CalendarDays size={13} className="text-neutral-400" />
                    {selectedCardDetail.startDate
                      ? new Date(selectedCardDetail.startDate + 'T12:00:00').toLocaleDateString('pt-BR')
                      : 'Imediato'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                  <AlignLeft size={14} />
                  Descrição da Ação
                </h4>
                <div className="p-3.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/60 border border-neutral-100 dark:border-neutral-700/60 text-xs sm:text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                  {selectedCardDetail.description || 'Nenhuma descrição detalhada informada.'}
                </div>
              </div>

              {/* Checklist Section */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <CheckSquare size={14} />
                    Checklist de Atividades
                  </h4>
                  {selectedCardDetail.checklist && selectedCardDetail.checklist.length > 0 && (
                    <span className="text-xs font-bold text-neutral-500">
                      {selectedCardDetail.checklist.filter((c) => c.done).length} de {selectedCardDetail.checklist.length} concluídos
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {(selectedCardDetail.checklist || []).map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleChecklist(selectedCardDetail, item.id)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all ${
                        isAdminUser ? 'cursor-pointer' : 'cursor-default'
                      } ${
                        item.done
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/50 text-neutral-500 line-through'
                          : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {item.done ? (
                        <CheckSquare size={16} className="text-emerald-500 shrink-0" />
                      ) : (
                        <Square size={16} className="text-neutral-400 shrink-0" />
                      )}
                      <span className="text-xs sm:text-sm font-medium flex-1">{item.text}</span>
                    </div>
                  ))}

                  {/* Add item to checklist (Admin Only) */}
                  {isAdminUser && (
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newChecklistText}
                        onChange={(e) => setNewChecklistText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddChecklistItem(selectedCardDetail);
                          }
                        }}
                        placeholder="Adicionar novo item ao checklist..."
                        className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        id="btn-add-checklist-item"
                        onClick={() => handleAddChecklistItem(selectedCardDetail)}
                        className="px-3 py-1.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-bold hover:bg-neutral-800"
                      >
                        Adicionar
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Tags */}
              {selectedCardDetail.tags && selectedCardDetail.tags.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <Tag size={14} />
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCardDetail.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Move Actions for Admin */}
            {isAdminUser && (
              <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-neutral-500">Mover para etapa:</span>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_COLUMNS.map((col) => {
                    const isCurrent = col.id === selectedCardDetail.columnId;
                    return (
                      <button
                        key={col.id}
                        disabled={isCurrent}
                        onClick={() => {
                          handleMoveCard(selectedCardDetail.id, col.id);
                          setSelectedCardDetail({ ...selectedCardDetail, columnId: col.id });
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                          isCurrent
                            ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-500 cursor-not-allowed opacity-60'
                            : 'bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-indigo-50 hover:text-indigo-600 dark:hover:bg-indigo-950/40'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${col.color}`} />
                        {col.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT CARD MODAL (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {isCardModalOpen && isAdminUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-xl bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                  <Kanban size={18} />
                </div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  {editingCard ? 'Editar Tarefa / Ação' : 'Nova Tarefa no Quadro'}
                </h3>
              </div>
              <button
                id="btn-close-card-form"
                onClick={() => {
                  setIsCardModalOpen(false);
                  setEditingCard(null);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  Título da Tarefa / Plano de Ação *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingCard?.title || ''}
                  placeholder="Ex: Treinamento de segurança na triagem de avarias..."
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Etapa / Coluna
                  </label>
                  <select
                    name="columnId"
                    defaultValue={editingCard?.columnId || targetColumnForNewCard}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {DEFAULT_COLUMNS.map((col) => (
                      <option key={col.id} value={col.id}>{col.title}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Nível de Prioridade
                  </label>
                  <select
                    name="priority"
                    defaultValue={editingCard?.priority || 'media'}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="media">Média</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Setor Operacional Relacionado
                  </label>
                  <select
                    name="departmentId"
                    defaultValue={editingCard?.departmentId || 'Recebimento'}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {DEPARTMENTS_LIST.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Responsável / Atribuído a
                  </label>
                  <input
                    name="assigneeName"
                    type="text"
                    defaultValue={editingCard?.assigneeName || ''}
                    placeholder="Ex: Carlos Oliveira, Líder Turno 1"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Data de Início
                  </label>
                  <input
                    name="startDate"
                    type="date"
                    defaultValue={editingCard?.startDate || new Date().toISOString().split('T')[0]}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Prazo Limite (Entrega)
                  </label>
                  <input
                    name="dueDate"
                    type="date"
                    defaultValue={editingCard?.dueDate || ''}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  Descrição & Detalhes
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingCard?.description || ''}
                  placeholder="Instruções, objetivos, critérios de aceite..."
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  Tags (separadas por vírgula)
                </label>
                <input
                  name="tags"
                  type="text"
                  defaultValue={editingCard?.tags?.join(', ') || ''}
                  placeholder="Ex: auditoria, doca, urgente, wms"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCardModalOpen(false);
                    setEditingCard(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30"
                >
                  {editingCard ? 'Salvar Alterações' : 'Criar Tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CREATE / EDIT PROJECT MODAL (ADMIN ONLY) */}
      {/* ========================================================================= */}
      {isProjectModalOpen && isAdminUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                  <FolderKanban size={18} />
                </div>
                <h3 className="text-base font-black text-neutral-900 dark:text-white">
                  {editingProject ? 'Editar Projeto' : 'Criar Novo Projeto / Quadro'}
                </h3>
              </div>
              <button
                id="btn-close-project-form"
                onClick={() => {
                  setIsProjectModalOpen(false);
                  setEditingProject(null);
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  Nome do Projeto *
                </label>
                <input
                  name="title"
                  type="text"
                  required
                  defaultValue={editingProject?.title || ''}
                  placeholder="Ex: Otimização do Romaneio e Expedição"
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  Categoria / Área
                </label>
                <input
                  name="category"
                  type="text"
                  defaultValue={editingProject?.category || 'Operacional & Logística'}
                  placeholder="Ex: Melhoria Contínua, TI, Infraestrutura"
                  className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Status do Projeto
                  </label>
                  <select
                    name="status"
                    defaultValue={editingProject?.status || 'em_andamento'}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="planejamento">Planejamento</option>
                    <option value="em_andamento">Em Andamento</option>
                    <option value="concluido">Concluído</option>
                    <option value="pausado">Pausado</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                    Data Alvo (Conclusão)
                  </label>
                  <input
                    name="targetDate"
                    type="date"
                    defaultValue={editingProject?.targetDate || ''}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  Descrição & Metas do Projeto
                </label>
                <textarea
                  name="description"
                  rows={3}
                  defaultValue={editingProject?.description || ''}
                  placeholder="Escopo do projeto, metas esperadas, entregáveis..."
                  className="w-full px-3 py-2 rounded-xl text-xs sm:text-sm bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">
                  Cor de Identificação
                </label>
                <select
                  name="color"
                  defaultValue={editingProject?.color || 'blue'}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="emerald">Verde (Operacional / Boracéia)</option>
                  <option value="blue">Azul (Qualidade & Processos)</option>
                  <option value="amber">Amarelo / Laranja (Gente & Treinamentos)</option>
                  <option value="rose">Rosa / Vermelho (Urgências & Auditoria)</option>
                </select>
              </div>

              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsProjectModalOpen(false);
                    setEditingProject(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-600/30"
                >
                  {editingProject ? 'Salvar Alterações' : 'Criar Projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
