import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  Calendar, 
  Clock, 
  FileText, 
  Plus, 
  Edit3, 
  Trash2, 
  Download, 
  Pin, 
  CheckCircle2, 
  AlertCircle, 
  Users, 
  Layers, 
  FileSpreadsheet, 
  ShieldAlert, 
  Upload, 
  Search, 
  ChevronRight, 
  Target, 
  Lock, 
  Sparkles, 
  Building2, 
  BookOpen, 
  Eye, 
  X, 
  Save, 
  ExternalLink,
  Info,
  Radio,
  FileCheck,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../App';
import { 
  InventoryConfigData, 
  InventoryAnnouncement, 
  InventoryProcess, 
  InventoryStructureTeam, 
  InventoryDocument, 
  InventoryPhase 
} from '../types';

/**
 * Utilitário de formatação de data seguro contra fuso horário (previne recuo de 1 dia por UTC)
 * Ex: '2027-01-08' é exibido rigorosamente como '08/01/2027' em qualquer timezone
 */
export const formatDateDisplay = (dateValue?: string | number | null): string => {
  if (!dateValue) return '--';
  if (typeof dateValue === 'number') {
    const d = new Date(dateValue);
    if (isNaN(d.getTime())) return '--';
    return d.toLocaleDateString('pt-BR');
  }
  const str = String(dateValue).trim();
  if (!str) return '--';

  // Formato YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [year, month, day] = str.split('-');
    return `${day}/${month}/${year}`;
  }

  // Formato ISO com horário (ex: 2027-01-08T06:00:00)
  if (str.includes('T')) {
    const datePart = str.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [year, month, day] = datePart.split('-');
      return `${day}/${month}/${year}`;
    }
  }

  // Fallback seguro
  try {
    if (str.length === 10 && str.includes('-')) {
      const [year, month, day] = str.split('-').map(Number);
      const d = new Date(year, month - 1, day);
      return d.toLocaleDateString('pt-BR');
    }
    const d = new Date(str);
    return isNaN(d.getTime()) ? str : d.toLocaleDateString('pt-BR');
  } catch {
    return str;
  }
};

// Default starter data for Marsil Inventário Geral 2027
const DEFAULT_INVENTORY_DATA: InventoryConfigData = {
  title: 'Inventário Geral Marsil 2027',
  targetDate: '2027-01-16',
  targetTime: '06:00',
  status: 'Planejamento Inicial',
  accuracyGoal: 99.8,
  estimatedItems: 185000,
  estimatedPositions: 5200,
  coordinator: 'Ebson Silva (Gerência de Logística)',
  coCoordinator: 'Supervisão de Operações & Estoque',
  description: 'Painel oficial de diretrizes, procedimentos, cronogramas, distribuição de equipes e documentos normativos para a realização do Inventário Geral de Estoque 2027.',
  guidelinesSummary: 'O inventário geral tem como objetivo a acuracidade de 99.8% do estoque físico versus sistema WMS/ERP, garantindo auditoria de 100% dos endereços de armazenagem e picking com corte total de movimentações.',
  announcements: [
    {
      id: 'ann-1',
      title: 'Regra de Corte de WMS e Parada de Recebimento / Expedição',
      content: 'A partir das 22h00 da véspera do inventário, todos os processos de recebimento, faturamento e transferências entre filiais (Boracéia e SP) serão congelados no sistema WMS. Nenhuma mercadoria poderá ser movimentada sem autorização da coordenação.',
      category: 'Regra de Ouro',
      isPinned: true,
      author: 'Administração Marsil Log',
      date: '2026-08-25',
      createdAt: Date.now()
    },
    {
      id: 'ann-2',
      title: 'Convocação e Alinhamento das Equipes de Contagem',
      content: 'Todos os colaboradores escalados para o inventário deverão participar do treinamento prévio de contagem cega e uso do coletor RF. Os coletes coloridos por setor serão entregues na abertura.',
      category: 'Procedimento',
      isPinned: false,
      author: 'Coordenação de Inventário',
      date: '2026-08-20',
      createdAt: Date.now() - 86400000
    }
  ],
  processes: [
    {
      id: 'proc-1',
      title: '1ª Contagem (Contagem Cega no Endereço)',
      stepNumber: 1,
      stage: '1ª Contagem (Cega)',
      responsible: 'Dupla de Contadores do Setor',
      description: 'A dupla realiza a contagem física de cada caixa/unidade no endereço sem saber o saldo do sistema. Registra o total e aplica a primeira etiqueta adesiva verde no palete.',
      mandatoryRules: [
        'Contar peça por peça ou caixa por caixa conforme unidade de estoque (UN/CX)',
        'Verificar lotes e datas de validade (FIFO/FEFO)',
        'Nunca deduzir quantidade pela etiqueta do fornecedor sem conferência física'
      ],
      tips: 'Em caso de palete fechado padronizado com lastro e altura homogêneos, conferir lastro x camadas e validar ao menos uma caixa.'
    },
    {
      id: 'proc-2',
      title: '2ª Contagem (Confronto de Divergências)',
      stepNumber: 2,
      stage: '2ª Contagem (Confronto)',
      responsible: 'Segunda Dupla Independente (Troca de Ruas)',
      description: 'Todos os endereços com divergência entre a 1ª contagem e o WMS serão recontados por uma equipe diferente da que realizou a primeira contagem.',
      mandatoryRules: [
        'A equipe da 2ª contagem não pode ser a mesma que realizou a 1ª no mesmo endereço',
        'Se a 2ª contagem bater com a 1ª, o valor é consolidado',
        'Se houver nova divergência, encaminhar imediatamente para a 3ª Contagem / Auditoria'
      ],
      tips: 'Conferir se não há produto invertido na posição ao lado.'
    },
    {
      id: 'proc-3',
      title: '3ª Contagem e Auditoria da Coordenação',
      stepNumber: 3,
      stage: '3ª Contagem (Auditoria)',
      responsible: 'Auditor Líder + Supervisor de Estoque',
      description: 'Auditoria minuciosa das divergências residuais de alto valor ou divergência quantitativa significativa antes da digitação final e homologação.',
      mandatoryRules: [
        'Acompanhamento obrigatório do líder da área',
        'Registro fotográfico se houver avaria oculta ou lote danificado',
        'Assinatura do formulário de liberação de endereço'
      ]
    },
    {
      id: 'proc-4',
      title: 'Corte de Movimentação e Conciliação ERP',
      stepNumber: 4,
      stage: 'Corte & WMS',
      responsible: 'TI & Controladoria',
      description: 'Consolidação das contagens, conciliação fiscal e contábil, e liberação gradual das ruas auditadas para retomada operacional.',
      mandatoryRules: [
        'Validação das justificativas de sobras e faltas',
        'Geração do relatório final de acuracidade por setor e geral'
      ]
    }
  ],
  structure: [
    {
      id: 'team-1',
      teamName: 'Equipe Alpha - Pulmão Ruas 01 a 06',
      zone: 'Pulmão Níveis 2 a 5 (Ruas 01 a 06)',
      shift: 'Integral',
      leader: 'Carlos Oliveira (Supervisor)',
      members: [
        { name: 'Lucas Mendes', role: 'Líder de Rua', badgeOrPhone: 'Ramal 204' },
        { name: 'Gabriel Santos', role: 'Contador' },
        { name: 'Mateus Lima', role: 'Digitador / RF' },
        { name: 'Marcos Vinicius', role: 'Suporte / Empilhador' }
      ],
      equipment: ['2 Coletores RF Zebra', '1 Prancheta + Prontuário', '1 Rolo de Etiquetas Verdes', 'Coletes Amarelos'],
      status: 'Confirmado'
    },
    {
      id: 'team-2',
      teamName: 'Equipe Bravo - Picking e Nível 1',
      zone: 'Picking Ruas 01 a 12 (Nível Térreo)',
      shift: 'Integral',
      leader: 'Renata Souza (Líder de Estoque)',
      members: [
        { name: 'Felipe Rocha', role: 'Líder de Rua' },
        { name: 'André Silva', role: 'Contador' },
        { name: 'Juliana Costa', role: 'Digitador / RF' }
      ],
      equipment: ['2 Coletores RF', 'Pranchetas', 'Etiquetas de Lacre', 'Coletes Azuis'],
      status: 'Confirmado'
    },
    {
      id: 'team-3',
      teamName: 'Equipe Charlie - Mezanino & Risco / Avarias',
      zone: 'Mezanino, Gaiola de Alto Risco e Área de Devoluções',
      shift: 'Integral',
      leader: 'Patrícia Ramos (Auditoria)',
      members: [
        { name: 'Diego Ferreira', role: 'Auditor' },
        { name: 'Bruno Henrique', role: 'Contador' }
      ],
      equipment: ['1 Coletor RF', 'Balança de Precisão', 'Coletes Vermelhos'],
      status: 'Confirmado'
    }
  ],
  documents: [
    {
      id: 'doc-1',
      title: 'Manual de Procedimentos do Inventário Geral (POP-LOG-027)',
      description: 'Instruções oficiais de contagem, manuseio de coletores, critérios de desempate e normas de conduta.',
      category: 'Manual',
      fileName: 'Manual_Inventario_Geral_Marsil_2027.pdf',
      fileSize: '1.8 MB',
      uploadedAt: '2026-08-25',
      uploadedBy: 'Admin Ebson Silva'
    },
    {
      id: 'doc-2',
      title: 'Mapeamento de Endereços e Layout do Galpão',
      description: 'Planta baixa detalhada com numeração das ruas, posições de pulmão, picking, mezanino e docas.',
      category: 'Mapeamento',
      fileName: 'Planta_Enderecamento_Estoque_2027.pdf',
      fileSize: '3.4 MB',
      uploadedAt: '2026-08-22',
      uploadedBy: 'Admin Ebson Silva'
    },
    {
      id: 'doc-3',
      title: 'Cronograma Detalhado de Bloqueio e Liberação de Ruas',
      description: 'Grade horária de corte de sistema, turnos de contagem e horários de corte para a expedição.',
      category: 'Cronograma',
      fileName: 'Cronograma_Bloqueio_Ruas_2027.pdf',
      fileSize: '850 KB',
      uploadedAt: '2026-08-24',
      uploadedBy: 'Admin Ebson Silva'
    }
  ],
  phases: [
    {
      id: 'phase-1',
      name: '1. Pré-Inventário & Higienização do Layout',
      startDate: '2026-12-01',
      endDate: '2027-01-10',
      status: 'Em Andamento',
      description: 'Arrumação de estoques, identificação de produtos sem código, descarte de avarias autorizadas e alinhamento de etiquetas de posição.',
      progressPercent: 35
    },
    {
      id: 'phase-2',
      name: '2. Treinamento das Equipes & Teste de RF',
      startDate: '2027-01-11',
      endDate: '2027-01-15',
      status: 'Planejado',
      description: 'Simulado de contagem cega com os operadores, distribuição dos coletes e testes de bateria dos coletores RF.',
      progressPercent: 0
    },
    {
      id: 'phase-3',
      name: '3. Execução do Inventário Físico Oficial',
      startDate: '2027-01-16',
      endDate: '2027-01-17',
      status: 'Planejado',
      description: 'Parada total das operações, 1ª contagem cega, 2ª contagem e 3ª contagem auditoria.',
      progressPercent: 0
    },
    {
      id: 'phase-4',
      name: '4. Reconciliação Contábil & Ajuste ERP',
      startDate: '2027-01-18',
      endDate: '2027-01-20',
      status: 'Planejado',
      description: 'Análise de causas-raiz de divergências, aprovação da diretoria e desbloqueio do WMS.',
      progressPercent: 0
    }
  ]
};

export default function InventarioGeralView() {
  const { profile } = useAuth();
  const isAdmin = profile?.departmentId === 'admin';

  const [data, setData] = useState<InventoryConfigData>(DEFAULT_INVENTORY_DATA);
  const [activeTab, setActiveTab] = useState<'avisos' | 'processos' | 'estrutura' | 'documentos' | 'cronograma'>('avisos');
  const [searchTerm, setSearchTerm] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Time remaining calculation
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  // Modals state
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isProcessModalOpen, setIsProcessModalOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [isPhaseModalOpen, setIsPhaseModalOpen] = useState(false);

  // Form states for editing
  const [configForm, setConfigForm] = useState<Partial<InventoryConfigData>>({});
  const [editingAnnouncement, setEditingAnnouncement] = useState<Partial<InventoryAnnouncement> | null>(null);
  const [editingProcess, setEditingProcess] = useState<Partial<InventoryProcess> | null>(null);
  const [editingTeam, setEditingTeam] = useState<Partial<InventoryStructureTeam> | null>(null);
  const [editingDoc, setEditingDoc] = useState<Partial<InventoryDocument> | null>(null);
  const [editingPhase, setEditingPhase] = useState<Partial<InventoryPhase> | null>(null);

  // Load from Firestore
  useEffect(() => {
    const docRef = doc(db, 'inventory_2027', 'main_2027');
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.exists()) {
        const firestoreData = snapshot.data() as InventoryConfigData;
        setData({
          ...DEFAULT_INVENTORY_DATA,
          ...firestoreData,
          announcements: firestoreData.announcements || DEFAULT_INVENTORY_DATA.announcements,
          processes: firestoreData.processes || DEFAULT_INVENTORY_DATA.processes,
          structure: firestoreData.structure || DEFAULT_INVENTORY_DATA.structure,
          documents: firestoreData.documents || DEFAULT_INVENTORY_DATA.documents,
          phases: firestoreData.phases || DEFAULT_INVENTORY_DATA.phases
        });
      }
    }, (error) => {
      console.warn('Usando dados locais para Inventário Geral:', error);
    });

    return () => unsubscribe();
  }, []);

  // Update countdown clock
  useEffect(() => {
    const calculateTime = () => {
      if (!data.targetDate) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      let targetYear = 2027;
      let targetMonth = 1;
      let targetDay = 1;

      if (/^\d{4}-\d{2}-\d{2}$/.test(data.targetDate)) {
        const parts = data.targetDate.split('-').map(Number);
        targetYear = parts[0];
        targetMonth = parts[1];
        targetDay = parts[2];
      } else {
        const d = new Date(data.targetDate);
        if (!isNaN(d.getTime())) {
          targetYear = d.getFullYear();
          targetMonth = d.getMonth() + 1;
          targetDay = d.getDate();
        }
      }

      const [hoursStr, minutesStr] = (data.targetTime || '06:00').split(':');
      const hours = parseInt(hoursStr, 10) || 0;
      const minutes = parseInt(minutesStr, 10) || 0;

      // Cria data no timezone local do usuário sem offset UTC
      const target = new Date(targetYear, targetMonth - 1, targetDay, hours, minutes, 0, 0).getTime();
      const now = new Date().getTime();
      const diff = target - now;

      if (diff > 0) {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hoursLeft = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutesLeft = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secondsLeft = Math.floor((diff % (1000 * 60)) / 1000);
        setTimeLeft({ days, hours: hoursLeft, minutes: minutesLeft, seconds: secondsLeft });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [data.targetDate, data.targetTime]);

  // Save changes to Firestore (Admin only)
  const saveToFirestore = async (updatedData: InventoryConfigData) => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      const docRef = doc(db, 'inventory_2027', 'main_2027');
      await setDoc(docRef, {
        ...updatedData,
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.displayName || profile?.email || 'Administrador'
      }, { merge: true });

      setData(updatedData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Erro ao salvar Inventário no Firestore:', error);
      alert('Erro ao salvar dados do inventário. Verifique sua conexão e permissões.');
    } finally {
      setSaving(false);
    }
  };

  // --- HANDLERS FOR ADMIN CRUD ---

  // 1. General Config
  const handleSaveConfig = () => {
    const updated: InventoryConfigData = {
      ...data,
      ...configForm
    };
    saveToFirestore(updated);
    setIsConfigModalOpen(false);
  };

  // 2. Announcements
  const handleSaveAnnouncement = () => {
    if (!editingAnnouncement?.title || !editingAnnouncement?.content) {
      alert('Preencha o título e o conteúdo do comunicado.');
      return;
    }

    let updatedAnnouncements = [...(data.announcements || [])];
    if (editingAnnouncement.id) {
      updatedAnnouncements = updatedAnnouncements.map(a => a.id === editingAnnouncement.id ? { ...a, ...editingAnnouncement } as InventoryAnnouncement : a);
    } else {
      const newAnn: InventoryAnnouncement = {
        id: `ann-${Date.now()}`,
        title: editingAnnouncement.title || '',
        content: editingAnnouncement.content || '',
        category: editingAnnouncement.category || 'Aviso Geral',
        isPinned: editingAnnouncement.isPinned || false,
        author: profile?.displayName || 'Administração Marsil',
        date: new Date().toISOString().split('T')[0],
        createdAt: Date.now()
      };
      updatedAnnouncements.unshift(newAnn);
    }

    saveToFirestore({ ...data, announcements: updatedAnnouncements });
    setIsAnnouncementModalOpen(false);
    setEditingAnnouncement(null);
  };

  const handleDeleteAnnouncement = (id: string) => {
    if (!confirm('Deseja excluir este comunicado?')) return;
    const filtered = data.announcements.filter(a => a.id !== id);
    saveToFirestore({ ...data, announcements: filtered });
  };

  // 3. Processes
  const handleSaveProcess = () => {
    if (!editingProcess?.title || !editingProcess?.description) {
      alert('Preencha o título e a descrição do procedimento.');
      return;
    }

    let updated = [...(data.processes || [])];
    if (editingProcess.id) {
      updated = updated.map(p => p.id === editingProcess.id ? { ...p, ...editingProcess } as InventoryProcess : p);
    } else {
      const newProc: InventoryProcess = {
        id: `proc-${Date.now()}`,
        title: editingProcess.title || '',
        stepNumber: (data.processes?.length || 0) + 1,
        stage: editingProcess.stage || '1ª Contagem (Cega)',
        responsible: editingProcess.responsible || 'Equipe do Setor',
        description: editingProcess.description || '',
        mandatoryRules: editingProcess.mandatoryRules || [],
        tips: editingProcess.tips || ''
      };
      updated.push(newProc);
    }

    saveToFirestore({ ...data, processes: updated });
    setIsProcessModalOpen(false);
    setEditingProcess(null);
  };

  const handleDeleteProcess = (id: string) => {
    if (!confirm('Deseja excluir este procedimento?')) return;
    const filtered = data.processes.filter(p => p.id !== id);
    saveToFirestore({ ...data, processes: filtered });
  };

  // 4. Structure / Teams
  const handleSaveTeam = () => {
    if (!editingTeam?.teamName || !editingTeam?.zone) {
      alert('Preencha o nome da equipe e o setor/zona.');
      return;
    }

    let updated = [...(data.structure || [])];
    if (editingTeam.id) {
      updated = updated.map(t => t.id === editingTeam.id ? { ...t, ...editingTeam } as InventoryStructureTeam : t);
    } else {
      const newTeam: InventoryStructureTeam = {
        id: `team-${Date.now()}`,
        teamName: editingTeam.teamName || '',
        zone: editingTeam.zone || '',
        shift: editingTeam.shift || 'Integral',
        leader: editingTeam.leader || 'A definir',
        members: editingTeam.members || [],
        equipment: editingTeam.equipment || [],
        status: editingTeam.status || 'Confirmado'
      };
      updated.push(newTeam);
    }

    saveToFirestore({ ...data, structure: updated });
    setIsTeamModalOpen(false);
    setEditingTeam(null);
  };

  const handleDeleteTeam = (id: string) => {
    if (!confirm('Deseja excluir esta equipe da estrutura?')) return;
    const filtered = data.structure.filter(t => t.id !== id);
    saveToFirestore({ ...data, structure: filtered });
  };

  // 5. Documents & PDFs
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check size (< 6MB for direct base64 storage)
    if (file.size > 6 * 1024 * 1024) {
      alert('O arquivo selecionado é maior que 6MB. Para arquivos muito pesados, utilize a opção de link URL externo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = reader.result as string;
      const sizeFormatted = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      
      setEditingDoc(prev => ({
        ...prev,
        fileName: file.name,
        fileSize: sizeFormatted,
        fileData: base64Data,
        title: prev?.title || file.name.replace(/\.[^/.]+$/, '')
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveDocument = () => {
    if (!editingDoc?.title || (!editingDoc?.fileData && !editingDoc?.fileUrl && !editingDoc?.fileName)) {
      alert('Forneça um título e selecione um arquivo PDF ou informe um link.');
      return;
    }

    let updated = [...(data.documents || [])];
    if (editingDoc.id) {
      updated = updated.map(d => d.id === editingDoc.id ? { ...d, ...editingDoc } as InventoryDocument : d);
    } else {
      const newDoc: InventoryDocument = {
        id: `doc-${Date.now()}`,
        title: editingDoc.title || '',
        description: editingDoc.description || '',
        category: editingDoc.category || 'Manual',
        fileName: editingDoc.fileName || 'documento.pdf',
        fileSize: editingDoc.fileSize || '1.0 MB',
        fileData: editingDoc.fileData,
        fileUrl: editingDoc.fileUrl,
        uploadedAt: new Date().toISOString().split('T')[0],
        uploadedBy: profile?.displayName || 'Administrador'
      };
      updated.unshift(newDoc);
    }

    saveToFirestore({ ...data, documents: updated });
    setIsDocModalOpen(false);
    setEditingDoc(null);
  };

  const handleDeleteDocument = (id: string) => {
    if (!confirm('Deseja excluir este documento?')) return;
    const filtered = data.documents.filter(d => d.id !== id);
    saveToFirestore({ ...data, documents: filtered });
  };

  const handleDownloadDoc = (docItem: InventoryDocument) => {
    if (docItem.fileData) {
      const link = document.createElement('a');
      link.href = docItem.fileData;
      link.download = docItem.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else if (docItem.fileUrl) {
      window.open(docItem.fileUrl, '_blank');
    } else {
      alert(`Download de exemplo: Arquivo "${docItem.fileName}" pronto para ser arquivado ou gerado.`);
    }
  };

  // 6. Phases / Timeline
  const handleSavePhase = () => {
    if (!editingPhase?.name || !editingPhase?.startDate) {
      alert('Preencha o nome da fase e a data de início.');
      return;
    }

    let updated = [...(data.phases || [])];
    if (editingPhase.id) {
      updated = updated.map(p => p.id === editingPhase.id ? { ...p, ...editingPhase } as InventoryPhase : p);
    } else {
      const newPhase: InventoryPhase = {
        id: `phase-${Date.now()}`,
        name: editingPhase.name || '',
        startDate: editingPhase.startDate || '',
        endDate: editingPhase.endDate || '',
        status: editingPhase.status || 'Planejado',
        description: editingPhase.description || '',
        progressPercent: editingPhase.progressPercent || 0
      };
      updated.push(newPhase);
    }

    saveToFirestore({ ...data, phases: updated });
    setIsPhaseModalOpen(false);
    setEditingPhase(null);
  };

  const handleDeletePhase = (id: string) => {
    if (!confirm('Deseja excluir esta etapa do cronograma?')) return;
    const filtered = data.phases.filter(p => p.id !== id);
    saveToFirestore({ ...data, phases: filtered });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-sm font-bold"
          >
            <CheckCircle2 size={18} />
            <span>Informações do Inventário 2027 salvas com sucesso!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Access Permission Status Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-neutral-100 dark:bg-neutral-800/80 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/60 text-xs">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-xl ${isAdmin ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'}`}>
            {isAdmin ? <Edit3 size={15} /> : <BookOpen size={15} />}
          </div>
          <div>
            <span className="font-bold text-neutral-900 dark:text-white">
              {isAdmin ? '🛡️ Painel de Gestão do Inventário (Modo Administrador)' : '👁️ Quadro Geral Informativo (Todos os Colaboradores)'}
            </span>
            <p className="text-neutral-500 dark:text-neutral-400 text-[11px]">
              {isAdmin 
                ? 'Você possui privilégios de Administrador para atualizar datas, publicar comunicados, anexar PDFs e gerenciar equipes.' 
                : 'Página oficial de consulta e alinhamento do Inventário 2027. Informações e manuais atualizados pela Administração.'}
            </p>
          </div>
        </div>

        {isAdmin && (
          <button
            onClick={() => {
              setConfigForm({ ...data });
              setIsConfigModalOpen(true);
            }}
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs shrink-0"
          >
            <Edit3 size={14} />
            Editar Dados Gerais
          </button>
        )}
      </div>

      {/* Hero Header & Countdown */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-neutral-900 via-neutral-800 to-blue-950 text-white p-6 sm:p-8 shadow-xl border border-neutral-700/50">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Main Title & Status */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Boxes size={14} />
                Gestão Marsil Logística
              </span>
              <span className="px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-bold flex items-center gap-1.5">
                <Target size={14} />
                Meta: {data.accuracyGoal}% Acurácia
              </span>
              <span className="px-3 py-1 bg-neutral-700/80 border border-neutral-600 rounded-full text-neutral-200 text-xs font-semibold">
                Status: {data.status}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              {data.title}
            </h1>
            <p className="text-sm text-neutral-300 leading-relaxed max-w-2xl">
              {data.description}
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-neutral-300 font-medium border-t border-neutral-700/60">
              <div className="flex items-center gap-1.5">
                <Users size={14} className="text-blue-400" />
                <span>Coordenação: <strong>{data.coordinator}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Layers size={14} className="text-emerald-400" />
                <span>Posições Estimadas: <strong>{data.estimatedPositions.toLocaleString()}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Boxes size={14} className="text-amber-400" />
                <span>Itens Estimados: <strong>{data.estimatedItems.toLocaleString()}</strong></span>
              </div>
            </div>
          </div>

          {/* Countdown Clock Box */}
          <div className="lg:col-span-5 bg-neutral-900/80 backdrop-blur-md rounded-2xl p-5 border border-neutral-700/80 shadow-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 mb-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-300">
                <Clock size={15} className="text-amber-400 animate-pulse" />
                <span>CONTAGEM REGRESSIVA OFICIAL</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-400">
                <Calendar size={13} />
                <span>{formatDateDisplay(data.targetDate)} às {data.targetTime || '06:00'}</span>
              </div>
            </div>

            {/* Numbers Grid */}
            <div className="grid grid-cols-4 gap-2 text-center py-2">
              <div className="bg-neutral-800/90 rounded-xl p-2.5 border border-neutral-700">
                <span className="text-2xl sm:text-3xl font-black text-white block leading-tight">{timeLeft.days}</span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Dias</span>
              </div>
              <div className="bg-neutral-800/90 rounded-xl p-2.5 border border-neutral-700">
                <span className="text-2xl sm:text-3xl font-black text-blue-400 block leading-tight">{timeLeft.hours}</span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Horas</span>
              </div>
              <div className="bg-neutral-800/90 rounded-xl p-2.5 border border-neutral-700">
                <span className="text-2xl sm:text-3xl font-black text-emerald-400 block leading-tight">{timeLeft.minutes}</span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Minutos</span>
              </div>
              <div className="bg-neutral-800/90 rounded-xl p-2.5 border border-neutral-700">
                <span className="text-2xl sm:text-3xl font-black text-amber-400 block leading-tight">{timeLeft.seconds}</span>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Segundos</span>
              </div>
            </div>

            <p className="text-[11px] text-neutral-400 text-center mt-3 bg-neutral-800/40 py-1.5 px-2 rounded-lg">
              🎯 Objetivo: 100% dos endereços auditados com zero movimentação durante a contagem.
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 dark:border-neutral-800 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 p-1 bg-neutral-100 dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => setActiveTab('avisos')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'avisos'
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Pin size={15} />
            <span>Quadro de Avisos</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold">
              {data.announcements?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('processos')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'processos'
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Layers size={15} />
            <span>Processos & Regras</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-bold">
              {data.processes?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('estrutura')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'estrutura'
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Users size={15} />
            <span>Estrutura & Equipes</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-bold">
              {data.structure?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('documentos')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'documentos'
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <FileText size={15} />
            <span>Documentos & PDFs</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold">
              {data.documents?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('cronograma')}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
              activeTab === 'cronograma'
                ? 'bg-white dark:bg-neutral-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
            }`}
          >
            <Calendar size={15} />
            <span>Cronograma & Fases</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-bold">
              {data.phases?.length || 0}
            </span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:w-64">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Filtrar nesta página..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
          />
        </div>
      </div>

      {/* TAB CONTENT 1: AVISOS & COMUNICADOS */}
      {activeTab === 'avisos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Pin size={18} className="text-blue-600" />
                Quadro de Avisos & Comunicados Oficiais
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Informações críticas, diretrizes de segurança e regras obrigatórias para o Inventário 2027.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingAnnouncement({
                    title: '',
                    content: '',
                    category: 'Aviso Geral',
                    isPinned: false
                  });
                  setIsAnnouncementModalOpen(true);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={15} />
                Novo Comunicado
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.announcements
              ?.filter(a => 
                !searchTerm || 
                a.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                a.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                a.category.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((ann) => {
                const isImportant = ann.category === 'Regra de Ouro' || ann.isPinned;
                return (
                  <div
                    key={ann.id}
                    className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                      isImportant
                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 shadow-xs'
                        : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                            ann.category === 'Regra de Ouro'
                              ? 'bg-amber-500 text-white'
                              : ann.category === 'Segurança'
                              ? 'bg-red-500 text-white'
                              : ann.category === 'Procedimento'
                              ? 'bg-blue-500 text-white'
                              : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                          }`}>
                            {ann.category}
                          </span>
                          {ann.isPinned && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                              <Pin size={10} /> Fixado
                            </span>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                setEditingAnnouncement(ann);
                                setIsAnnouncementModalOpen(true);
                              }}
                              className="p-1 hover:bg-neutral-200 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                              title="Editar comunicado"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg text-red-500"
                              title="Excluir comunicado"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-tight">
                        {ann.title}
                      </h3>

                      <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                        {ann.content}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
                      <span>Por: <strong className="text-neutral-600 dark:text-neutral-300">{ann.author}</strong></span>
                      <span>{formatDateDisplay(ann.date)}</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: PROCESSOS & REGRAS */}
      {activeTab === 'processos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" />
                Processos & Metodologia de Contagem
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Instruções passo a passo desde a 1ª contagem cega até a conciliação final no sistema.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingProcess({
                    title: '',
                    stage: '1ª Contagem (Cega)',
                    responsible: '',
                    description: '',
                    mandatoryRules: [''],
                    tips: ''
                  });
                  setIsProcessModalOpen(true);
                }}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={15} />
                Adicionar Processo
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {data.processes
              ?.filter(p => 
                !searchTerm || 
                p.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.stage.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((proc, index) => (
                <div
                  key={proc.id}
                  className="p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-black text-sm shrink-0">
                        {proc.stepNumber || index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md uppercase">
                            {proc.stage}
                          </span>
                          <span className="text-xs text-neutral-400 font-medium">
                            Responsável: <strong>{proc.responsible}</strong>
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-neutral-900 dark:text-white mt-0.5">
                          {proc.title}
                        </h3>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingProcess(proc);
                            setIsProcessModalOpen(true);
                          }}
                          className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                          title="Editar processo"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteProcess(proc.id)}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg text-red-500"
                          title="Excluir processo"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                    {proc.description}
                  </p>

                  {proc.mandatoryRules && proc.mandatoryRules.length > 0 && (
                    <div className="p-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl space-y-1.5 border border-neutral-100 dark:border-neutral-800">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
                        <ShieldAlert size={12} className="text-amber-500" />
                        Regras Obrigatórias para esta Etapa:
                      </span>
                      <ul className="space-y-1">
                        {proc.mandatoryRules.map((rule, rIdx) => (
                          <li key={rIdx} className="text-xs text-neutral-700 dark:text-neutral-300 flex items-start gap-1.5">
                            <span className="text-emerald-500 font-bold">•</span>
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {proc.tips && (
                    <div className="flex items-start gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-xl text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/40">
                      <Info size={14} className="shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                      <span><strong>Dica Prática:</strong> {proc.tips}</span>
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: ESTRUTURA & EQUIPES */}
      {activeTab === 'estrutura' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-amber-600" />
                Estrutura Organizacional & Escalação das Equipes
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Divisão de setores, duplas de contagem, líderes de rua e equipamentos alocados.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingTeam({
                    teamName: '',
                    zone: '',
                    shift: 'Integral',
                    leader: '',
                    members: [],
                    equipment: [],
                    status: 'Confirmado'
                  });
                  setIsTeamModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={15} />
                Adicionar Equipe
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.structure
              ?.filter(t => 
                !searchTerm || 
                t.teamName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                t.zone.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.leader.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((team) => (
                <div
                  key={team.id}
                  className="p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="px-2.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-md">
                        Turno: {team.shift}
                      </span>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingTeam(team);
                              setIsTeamModalOpen(true);
                            }}
                            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                            title="Editar equipe"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg text-red-500"
                            title="Excluir equipe"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                        {team.teamName}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1">
                        <Building2 size={12} />
                        <span>Setor: <strong>{team.zone}</strong></span>
                      </p>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-semibold mt-1">
                        Líder / Responsável: {team.leader}
                      </p>
                    </div>

                    {/* Members List */}
                    <div className="space-y-1.5 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Integrantes Escalados:
                      </span>
                      <div className="space-y-1">
                        {team.members?.map((member, mIdx) => (
                          <div key={mIdx} className="flex items-center justify-between text-xs p-1.5 bg-neutral-50 dark:bg-neutral-800/60 rounded-lg">
                            <span className="font-medium text-neutral-800 dark:text-neutral-200">{member.name}</span>
                            <span className="text-[10px] font-semibold text-neutral-500 bg-white dark:bg-neutral-700 px-1.5 py-0.5 rounded shadow-2xs">
                              {member.role}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Equipment */}
                    {team.equipment && team.equipment.length > 0 && (
                      <div className="space-y-1 pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                          Recursos & Equipamentos:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {team.equipment.map((eq, eqIdx) => (
                            <span key={eqIdx} className="px-2 py-0.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 text-[10px] rounded-md">
                              {eq}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Status da Equipe:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 size={12} /> {team.status || 'Confirmado'}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: DOCUMENTOS & PDFS */}
      {activeTab === 'documentos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <FileText size={18} className="text-purple-600" />
                Manuais, POPs & Anexos em PDF
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Documentos oficiais para download, regras de auditoria e mapeamento de endereços.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingDoc({
                    title: '',
                    description: '',
                    category: 'Manual',
                    fileName: '',
                    fileSize: ''
                  });
                  setIsDocModalOpen(true);
                }}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Upload size={15} />
                Anexar Novo PDF / Documento
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.documents
              ?.filter(d => 
                !searchTerm || 
                d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                d.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                d.category.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((docItem) => (
                <div
                  key={docItem.id}
                  className="p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs flex flex-col justify-between space-y-4 hover:border-purple-200 dark:hover:border-purple-900/40 transition-all"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="p-2.5 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
                          <FileText size={20} />
                        </div>
                        <div>
                          <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-md uppercase">
                            {docItem.category}
                          </span>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            {docItem.fileSize || 'PDF Oficial'}
                          </p>
                        </div>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingDoc(docItem);
                              setIsDocModalOpen(true);
                            }}
                            className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                            title="Editar documento"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteDocument(docItem.id)}
                            className="p-1 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg text-red-500"
                            title="Excluir documento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-neutral-900 dark:text-white leading-tight">
                        {docItem.title}
                      </h3>
                      <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                        {docItem.description}
                      </p>
                    </div>

                    <div className="text-[11px] text-neutral-400 font-mono truncate bg-neutral-50 dark:bg-neutral-800/50 p-2 rounded-lg border border-neutral-100 dark:border-neutral-800">
                      📄 {docItem.fileName}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-neutral-400">
                      Postado: {formatDateDisplay(docItem.uploadedAt)}
                    </span>

                    <button
                      onClick={() => handleDownloadDoc(docItem)}
                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
                    >
                      <Download size={13} />
                      Baixar PDF
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: CRONOGRAMA & FASES */}
      {activeTab === 'cronograma' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" />
                Cronograma de Execução & Marcos Principais
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Fases do inventário desde o pré-inventário até a homologação contábil.
              </p>
            </div>

            {isAdmin && (
              <button
                onClick={() => {
                  setEditingPhase({
                    name: '',
                    startDate: '',
                    endDate: '',
                    status: 'Planejado',
                    description: '',
                    progressPercent: 0
                  });
                  setIsPhaseModalOpen(true);
                }}
                className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                <Plus size={15} />
                Adicionar Etapa
              </button>
            )}
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-neutral-200 dark:before:bg-neutral-800">
            {data.phases
              ?.filter(p => 
                !searchTerm || 
                p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                p.description.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((phase) => {
                const isCompleted = phase.status === 'Concluído';
                const isOngoing = phase.status === 'Em Andamento';

                return (
                  <div key={phase.id} className="relative space-y-2 group">
                    {/* Timeline Node Dot */}
                    <div className={`absolute -left-6 top-1 w-5 h-5 rounded-full border-4 border-white dark:border-neutral-900 flex items-center justify-center ${
                      isCompleted ? 'bg-emerald-500' : (isOngoing ? 'bg-blue-500 ring-4 ring-blue-500/20' : 'bg-neutral-300 dark:bg-neutral-700')
                    }`} />

                    <div className="p-5 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-neutral-900 dark:text-white">
                            {phase.name}
                          </h3>
                          <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-md uppercase tracking-wider ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isOngoing
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                              : 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                          }`}>
                            {phase.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                            📅 {formatDateDisplay(phase.startDate)} até {formatDateDisplay(phase.endDate)}
                          </span>

                          {isAdmin && (
                            <div className="flex items-center gap-1 ml-2">
                              <button
                                onClick={() => {
                                  setEditingPhase(phase);
                                  setIsPhaseModalOpen(true);
                                }}
                                className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
                                title="Editar etapa"
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeletePhase(phase.id)}
                                className="p-1 hover:bg-red-100 dark:hover:bg-red-950/50 rounded-lg text-red-500"
                                title="Excluir etapa"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
                        {phase.description}
                      </p>

                      {/* Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-neutral-500">
                          <span>Progresso da Fase</span>
                          <span>{phase.progressPercent || 0}%</span>
                        </div>
                        <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                            }`}
                            style={{ width: `${phase.progressPercent || 0}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS (ADMIN ONLY) */}
      {/* ========================================================================= */}

      {/* 1. Modal: Configurações Gerais */}
      {isConfigModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-xl w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Boxes size={18} className="text-blue-600" />
                Configurar Dados do Inventário Geral
              </h3>
              <button onClick={() => setIsConfigModalOpen(false)} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Título do Painel</label>
                <input
                  type="text"
                  value={configForm.title || ''}
                  onChange={(e) => setConfigForm({ ...configForm, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Data Prevista de Início</label>
                  <input
                    type="date"
                    value={configForm.targetDate || ''}
                    onChange={(e) => setConfigForm({ ...configForm, targetDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Horário de Corte</label>
                  <input
                    type="time"
                    value={configForm.targetTime || '06:00'}
                    onChange={(e) => setConfigForm({ ...configForm, targetTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Meta de Acurácia (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={configForm.accuracyGoal || 99.8}
                    onChange={(e) => setConfigForm({ ...configForm, accuracyGoal: parseFloat(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Posições Estimadas</label>
                  <input
                    type="number"
                    value={configForm.estimatedPositions || 5000}
                    onChange={(e) => setConfigForm({ ...configForm, estimatedPositions: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Itens Estimados</label>
                  <input
                    type="number"
                    value={configForm.estimatedItems || 150000}
                    onChange={(e) => setConfigForm({ ...configForm, estimatedItems: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Status Oficial</label>
                <select
                  value={configForm.status || 'Planejamento Inicial'}
                  onChange={(e) => setConfigForm({ ...configForm, status: e.target.value as any })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                >
                  <option value="Planejamento Inicial">Planejamento Inicial</option>
                  <option value="Preparação & Treinamento">Preparação & Treinamento</option>
                  <option value="Auditoria Prévia">Auditoria Prévia</option>
                  <option value="Inventário em Andamento">Inventário em Andamento</option>
                  <option value="Reconciliação Final">Reconciliação Final</option>
                  <option value="Inventário Concluído">Inventário Concluído</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Coordenador Geral</label>
                <input
                  type="text"
                  value={configForm.coordinator || ''}
                  onChange={(e) => setConfigForm({ ...configForm, coordinator: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Descrição Geral do Painel</label>
                <textarea
                  rows={3}
                  value={configForm.description || ''}
                  onChange={(e) => setConfigForm({ ...configForm, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setIsConfigModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveConfig}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                Salvar Configurações
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Modal: Comunicado */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-lg w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Pin size={18} className="text-blue-600" />
                {editingAnnouncement?.id ? 'Editar Comunicado' : 'Novo Comunicado de Inventário'}
              </h3>
              <button onClick={() => setIsAnnouncementModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Título do Comunicado</label>
                <input
                  type="text"
                  placeholder="Ex: Horário de Entrega dos Coletes e Coletores"
                  value={editingAnnouncement?.title || ''}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Categoria</label>
                  <select
                    value={editingAnnouncement?.category || 'Aviso Geral'}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, category: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="Aviso Geral">Aviso Geral</option>
                    <option value="Regra de Ouro">Regra de Ouro</option>
                    <option value="Procedimento">Procedimento</option>
                    <option value="Cronograma">Cronograma</option>
                    <option value="Segurança">Segurança</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-6">
                  <input
                    type="checkbox"
                    id="isPinned"
                    checked={editingAnnouncement?.isPinned || false}
                    onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, isPinned: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <label htmlFor="isPinned" className="font-bold text-neutral-700 dark:text-neutral-300 cursor-pointer">
                    Fixar no topo do quadro
                  </label>
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Conteúdo da Mensagem</label>
                <textarea
                  rows={5}
                  placeholder="Escreva os detalhes, orientações ou regras deste comunicado..."
                  value={editingAnnouncement?.content || ''}
                  onChange={(e) => setEditingAnnouncement({ ...editingAnnouncement, content: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setIsAnnouncementModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveAnnouncement}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                Publicar Comunicado
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Processos */}
      {isProcessModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-xl w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" />
                {editingProcess?.id ? 'Editar Procedimento' : 'Adicionar Procedimento de Contagem'}
              </h3>
              <button onClick={() => setIsProcessModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Título do Procedimento</label>
                <input
                  type="text"
                  placeholder="Ex: 1ª Contagem Cega no Endereço"
                  value={editingProcess?.title || ''}
                  onChange={(e) => setEditingProcess({ ...editingProcess, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Etapa / Fase</label>
                  <select
                    value={editingProcess?.stage || '1ª Contagem (Cega)'}
                    onChange={(e) => setEditingProcess({ ...editingProcess, stage: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="1ª Contagem (Cega)">1ª Contagem (Cega)</option>
                    <option value="2ª Contagem (Confronto)">2ª Contagem (Confronto)</option>
                    <option value="3ª Contagem (Auditoria)">3ª Contagem (Auditoria)</option>
                    <option value="Corte & WMS">Corte & WMS</option>
                    <option value="Ajuste ERP">Ajuste ERP</option>
                    <option value="Organização">Organização</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Responsável / Perfil</label>
                  <input
                    type="text"
                    placeholder="Ex: Dupla de Contadores do Setor"
                    value={editingProcess?.responsible || ''}
                    onChange={(e) => setEditingProcess({ ...editingProcess, responsible: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Descrição Detalhada do Processo</label>
                <textarea
                  rows={4}
                  placeholder="Descreva exatamente como o operador deve proceder..."
                  value={editingProcess?.description || ''}
                  onChange={(e) => setEditingProcess({ ...editingProcess, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Regras Obrigatórias (Uma por linha)
                </label>
                <textarea
                  rows={3}
                  placeholder="Ex: Não deduzir quantidade pela caixa&#10;Validar data de validade&#10;Colar etiqueta verde no palete"
                  value={editingProcess?.mandatoryRules?.join('\n') || ''}
                  onChange={(e) => setEditingProcess({ ...editingProcess, mandatoryRules: e.target.value.split('\n').filter(Boolean) })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white font-sans"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Dica Prática / Boas Práticas (Opcional)</label>
                <input
                  type="text"
                  placeholder="Ex: Paletes homogêneos podem ser conferidos por lastro x camada"
                  value={editingProcess?.tips || ''}
                  onChange={(e) => setEditingProcess({ ...editingProcess, tips: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setIsProcessModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProcess}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                Salvar Procedimento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Modal: Equipes & Estrutura */}
      {isTeamModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-lg w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Users size={18} className="text-amber-600" />
                {editingTeam?.id ? 'Editar Equipe' : 'Adicionar Equipe de Inventário'}
              </h3>
              <button onClick={() => setIsTeamModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Nome da Equipe</label>
                <input
                  type="text"
                  placeholder="Ex: Equipe Alpha - Pulmão Ruas 01 a 06"
                  value={editingTeam?.teamName || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, teamName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Setor / Zona de Atuação</label>
                  <input
                    type="text"
                    placeholder="Ex: Pulmão Ruas 01 a 08"
                    value={editingTeam?.zone || ''}
                    onChange={(e) => setEditingTeam({ ...editingTeam, zone: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Turno</label>
                  <select
                    value={editingTeam?.shift || 'Integral'}
                    onChange={(e) => setEditingTeam({ ...editingTeam, shift: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="Integral">Integral</option>
                    <option value="Diurno">Diurno</option>
                    <option value="Noturno">Noturno</option>
                    <option value="Madrugada">Madrugada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Líder / Responsável</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Oliveira (Supervisor)"
                  value={editingTeam?.leader || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, leader: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              {/* Members */}
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">
                  Integrantes da Equipe (Formato: Nome - Função)
                </label>
                <textarea
                  rows={4}
                  placeholder="Ex:&#10;Lucas Mendes - Líder de Rua&#10;Gabriel Santos - Contador&#10;Mateus Lima - Digitador / RF"
                  value={editingTeam?.members?.map(m => `${m.name} - ${m.role}`).join('\n') || ''}
                  onChange={(e) => {
                    const lines = e.target.value.split('\n').filter(Boolean);
                    const members = lines.map(line => {
                      const parts = line.split('-');
                      return {
                        name: parts[0]?.trim() || line.trim(),
                        role: (parts[1]?.trim() as any) || 'Contador'
                      };
                    });
                    setEditingTeam({ ...editingTeam, members });
                  }}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white font-sans"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Equipamentos / Coletores Alocados (Separados por vírgula)</label>
                <input
                  type="text"
                  placeholder="Ex: 2 Coletores RF, 1 Prancheta, Coletes Amarelos"
                  value={editingTeam?.equipment?.join(', ') || ''}
                  onChange={(e) => setEditingTeam({ ...editingTeam, equipment: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setIsTeamModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTeam}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                Salvar Equipe
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal: Documentos & PDFs */}
      {isDocModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-lg w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <FileText size={18} className="text-purple-600" />
                {editingDoc?.id ? 'Editar Documento' : 'Anexar PDF / Manual'}
              </h3>
              <button onClick={() => setIsDocModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Título do Documento</label>
                <input
                  type="text"
                  placeholder="Ex: Manual de Procedimentos POP-LOG-027"
                  value={editingDoc?.title || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Categoria</label>
                  <select
                    value={editingDoc?.category || 'Manual'}
                    onChange={(e) => setEditingDoc({ ...editingDoc, category: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="Manual">Manual</option>
                    <option value="Cronograma">Cronograma</option>
                    <option value="Mapeamento">Mapeamento</option>
                    <option value="POP / Norma">POP / Norma</option>
                    <option value="Planilha de Apoio">Planilha de Apoio</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Nome do Arquivo</label>
                  <input
                    type="text"
                    placeholder="Ex: Manual_Inventario_2027.pdf"
                    value={editingDoc?.fileName || ''}
                    onChange={(e) => setEditingDoc({ ...editingDoc, fileName: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>

              {/* File Upload Box */}
              <div className="p-4 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-2xl text-center space-y-2 bg-neutral-50 dark:bg-neutral-800/40">
                <Upload size={24} className="mx-auto text-purple-600 dark:text-purple-400" />
                <div>
                  <label className="cursor-pointer px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs inline-block transition-all shadow-xs">
                    Selecionar Arquivo PDF / Documento
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xlsx,.xls,.png,.jpg"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    {editingDoc?.fileName ? `Arquivo carregado: ${editingDoc.fileName} (${editingDoc.fileSize || ''})` : 'Suporta arquivos PDF, planilhas ou imagens'}
                  </p>
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Ou Link URL Externo (Google Drive / Nuvem)</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/..."
                  value={editingDoc?.fileUrl || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, fileUrl: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Descrição / Finalidade do Documento</label>
                <textarea
                  rows={3}
                  placeholder="Instruções de leitura, quem deve consultar, versão do POP..."
                  value={editingDoc?.description || ''}
                  onChange={(e) => setEditingDoc({ ...editingDoc, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setIsDocModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDocument}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                Salvar Documento
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal: Fases & Cronograma */}
      {isPhaseModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-3xl p-6 max-w-lg w-full border border-neutral-200 dark:border-neutral-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
              <h3 className="text-base font-bold text-neutral-900 dark:text-white flex items-center gap-2">
                <Calendar size={18} className="text-blue-600" />
                {editingPhase?.id ? 'Editar Etapa' : 'Adicionar Etapa do Cronograma'}
              </h3>
              <button onClick={() => setIsPhaseModalOpen(false)} className="text-neutral-400 hover:text-neutral-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Nome da Etapa</label>
                <input
                  type="text"
                  placeholder="Ex: 1. Pré-Inventário & Limpeza de Layout"
                  value={editingPhase?.name || ''}
                  onChange={(e) => setEditingPhase({ ...editingPhase, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Data de Início</label>
                  <input
                    type="date"
                    value={editingPhase?.startDate || ''}
                    onChange={(e) => setEditingPhase({ ...editingPhase, startDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Data de Término</label>
                  <input
                    type="date"
                    value={editingPhase?.endDate || ''}
                    onChange={(e) => setEditingPhase({ ...editingPhase, endDate: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Status</label>
                  <select
                    value={editingPhase?.status || 'Planejado'}
                    onChange={(e) => setEditingPhase({ ...editingPhase, status: e.target.value as any })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  >
                    <option value="Planejado">Planejado</option>
                    <option value="Em Andamento">Em Andamento</option>
                    <option value="Concluído">Concluído</option>
                    <option value="Pendente">Pendente</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Progresso (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={editingPhase?.progressPercent || 0}
                    onChange={(e) => setEditingPhase({ ...editingPhase, progressPercent: parseInt(e.target.value) || 0 })}
                    className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-neutral-700 dark:text-neutral-300 block mb-1">Descrição dos Objetivos desta Fase</label>
                <textarea
                  rows={3}
                  placeholder="Quais atividades serão executadas nesta janela de tempo..."
                  value={editingPhase?.description || ''}
                  onChange={(e) => setEditingPhase({ ...editingPhase, description: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-100 dark:border-neutral-800">
              <button
                onClick={() => setIsPhaseModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePhase}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save size={14} />
                Salvar Etapa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
