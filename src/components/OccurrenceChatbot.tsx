import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  setDoc, 
  doc, 
  serverTimestamp, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreUtils';
import { DepartmentId, Occurrence } from '../types';
import { DEPARTMENTS } from '../constants';
import { useAuth } from '../App';
import { 
  MessageSquareWarning, 
  X, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Bot, 
  ShieldAlert, 
  Flame, 
  Clock, 
  Filter, 
  List, 
  ChevronRight, 
  ChevronDown,
  ChevronUp,
  Layers,
  BellRing,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { OccurrenceCommentSection } from './OccurrenceCommentSection';
import { OccurrenceCommentBalloon } from './OccurrenceCommentBalloon';
import { sendSystemNotification } from '../utils/notificationService';
import { logAuditEvent } from '../utils/auditLogger';

interface OccurrenceChatbotProps {
  currentDepartmentId?: string;
  onOccurrenceCreated?: () => void;
}

const QUICK_CATEGORIES = [
  { title: 'Atraso de Veículo', severity: 'medium', icon: '🚛' },
  { title: 'Divergência de Carga', severity: 'medium', icon: '📦' },
  { title: 'Avaria em Produto', severity: 'high', icon: '⚠️' },
  { title: 'Problema em Empilhadeira', severity: 'high', icon: '🚜' },
  { title: 'Falta de Colaborador', severity: 'low', icon: '👥' },
  { title: 'Desvio de Segurança', severity: 'high', icon: '🛡️' },
];

export function OccurrenceChatbot({ currentDepartmentId = 'recebimento', onOccurrenceCreated }: OccurrenceChatbotProps) {
  const { profile } = useAuth();
  const isViewer = profile?.departmentId === 'viewer';
  
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'create' | 'list'>('create');
  
  // Department selected inside chatbot
  const defaultDept = (currentDepartmentId && currentDepartmentId in DEPARTMENTS) 
    ? (currentDepartmentId as DepartmentId) 
    : (profile?.departmentId && profile.departmentId in DEPARTMENTS ? (profile.departmentId as DepartmentId) : 'recebimento');
    
  const [selectedDept, setSelectedDept] = useState<DepartmentId>(defaultDept);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [isCritical, setIsCritical] = useState(false);
  
  const [sending, setSending] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // All occurrences for today badge
  const today = new Date().toISOString().split('T')[0];
  const [todayOccurrences, setTodayOccurrences] = useState<any[]>([]);

  useEffect(() => {
    if (currentDepartmentId && currentDepartmentId in DEPARTMENTS) {
      setSelectedDept(currentDepartmentId as DepartmentId);
    }
  }, [currentDepartmentId]);

  // Sync today's occurrences across all departments
  useEffect(() => {
    const q = query(collection(db, 'logs'), where('date', '==', today));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all: any[] = [];
      snapshot.docs.forEach(docSnap => {
        const logData = docSnap.data();
        if (logData.occurrences && Array.isArray(logData.occurrences)) {
          logData.occurrences.forEach((occ: any) => {
            all.push({
              ...occ,
              departmentId: logData.departmentId,
              deptName: DEPARTMENTS[logData.departmentId as DepartmentId]?.name || logData.departmentId
            });
          });
        }
      });
      all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setTodayOccurrences(all);
    }, (error) => {
      console.warn('Error fetching occurrences for chatbot', error);
    });

    return () => unsubscribe();
  }, [today]);

  const handleSelectQuickCategory = (cat: typeof QUICK_CATEGORIES[0]) => {
    setTitle(cat.title);
    setSeverity(cat.severity as any);
    if (cat.severity === 'high') setIsCritical(true);
  };

  const handleSendOccurrence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert('Por favor, informe o título e a descrição da ocorrência.');
      return;
    }

    setSending(true);
    try {
      // Find today's log for the selected department
      const q = query(
        collection(db, 'logs'), 
        where('departmentId', '==', selectedDept),
        where('date', '==', today)
      );
      const snapshot = await getDocs(q);

      const newOcc: Occurrence = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: Date.now(),
        title: title.trim(),
        description: description.trim(),
        severity
      };

      if (!snapshot.empty) {
        const logDoc = snapshot.docs[0];
        const currentData = logDoc.data();
        const updatedOccurrences = [...(currentData.occurrences || []), newOcc];
        
        await setDoc(doc(db, 'logs', logDoc.id), {
          occurrences: updatedOccurrences,
          isCritical: isCritical || currentData.isCritical || false,
          updatedAt: serverTimestamp(),
          timestamp: serverTimestamp()
        }, { merge: true });
      } else {
        // Create today's log document if not present
        const deptConfig = DEPARTMENTS[selectedDept];
        await addDoc(collection(db, 'logs'), {
          date: today,
          departmentId: selectedDept,
          staffPresent: deptConfig ? deptConfig.totalStaff : 0,
          staffByRole: {},
          data: {},
          occurrences: [newOcc],
          isCritical: isCritical,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          timestamp: serverTimestamp()
        });
      }

      // Dispatch Real-Time System Notification
      try {
        const deptName = DEPARTMENTS[selectedDept]?.name || selectedDept;
        await sendSystemNotification({
          title: isCritical ? `🚨 Alerta Crítico: ${title.trim()}` : `Ocorrência: ${title.trim()}`,
          message: `Setor ${deptName}: ${description.trim().slice(0, 100)}${description.trim().length > 100 ? '...' : ''}`,
          type: isCritical ? 'critical_alert' : 'occurrence',
          severity: isCritical ? 'critical' : severity === 'high' ? 'warning' : 'info',
          targetType: isCritical ? 'all' : 'department',
          targetDepartment: isCritical ? undefined : selectedDept,
          soundAlert: true,
          isPinned: isCritical,
          linkTab: selectedDept,
          actionLabel: `Ver ${deptName}`,
          actorProfile: profile
        });

        await logAuditEvent({
          action: isCritical ? 'CRITICAL_ALERT_BROADCAST' : 'OCCURRENCE_CREATE',
          category: 'OCCURRENCES',
          description: `Ocorrência ${isCritical ? 'CRÍTICA ' : ''}criada: "${title.trim()}" (Gravidade: ${severity})`,
          targetName: `Assistente IA / ${deptName}`,
          severity: isCritical ? 'critical' : severity === 'high' ? 'warning' : 'info',
          actorProfile: profile
        });
      } catch (err) {
        console.error('Error dispatching chatbot occurrence notification:', err);
      }

      setSuccessMessage('Ocorrência registrada e comunicada à equipe!');
      setTitle('');
      setDescription('');
      setIsCritical(false);
      
      if (onOccurrenceCreated) {
        onOccurrenceCreated();
      }

      setTimeout(() => {
        setSuccessMessage(null);
        setActiveTab('list');
      }, 1500);

    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `logs/${selectedDept}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Action Button (Chatbot Style) */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-3">
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className={`relative flex items-center gap-3 px-5 py-3.5 rounded-full font-black text-sm shadow-2xl transition-all ${
            isOpen 
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900' 
              : 'bg-gradient-to-r from-red-600 via-orange-600 to-amber-600 text-white shadow-red-500/30'
          }`}
        >
          {/* Animated pulse ring */}
          {!isOpen && (
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-red-500 to-orange-500 opacity-40 blur-sm animate-pulse" />
          )}

          <div className="relative flex items-center justify-center">
            {isOpen ? (
              <X size={20} />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <Bot size={15} className="text-white" />
                </div>
                <MessageSquareWarning size={18} />
              </div>
            )}
          </div>

          <span className="relative hidden sm:inline-block">
            {isOpen ? 'Fechar' : 'Registrar Ocorrência'}
          </span>

          {todayOccurrences.length > 0 && !isOpen && (
            <span className="relative bg-white text-red-600 font-black text-xs px-2 py-0.5 rounded-full shadow-sm">
              {todayOccurrences.length}
            </span>
          )}
        </motion.button>
      </div>

      {/* Floating Chat / Occurrence Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-32px)] sm:w-[460px] bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col max-h-[82vh]"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
                  <Bot size={22} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-sm text-white">Assistente de Ocorrências</h3>
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <p className="text-[11px] text-neutral-300">
                    Registro rápido e alerta em tempo real
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Sub-Navigation Tabs */}
            <div className="flex items-center border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/80 dark:bg-neutral-800/40 p-1.5 gap-1 text-xs">
              <button
                onClick={() => setActiveTab('create')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'create'
                    ? 'bg-white dark:bg-neutral-900 text-red-600 dark:text-red-400 shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <AlertCircle size={14} />
                <span>Nova Ocorrência</span>
              </button>

              <button
                onClick={() => setActiveTab('list')}
                className={`flex-1 py-2 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${
                  activeTab === 'list'
                    ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-sm'
                    : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
                }`}
              >
                <List size={14} />
                <span>Ocorrências de Hoje ({todayOccurrences.length})</span>
              </button>
            </div>

            {/* Content Body */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4">
              {activeTab === 'create' ? (
                <form onSubmit={handleSendOccurrence} className="space-y-4">
                  {/* Chatbot Greeting bubble */}
                  <div className="flex items-start gap-2.5 bg-neutral-50 dark:bg-neutral-800/60 p-3.5 rounded-2xl border border-neutral-100 dark:border-neutral-800 text-xs text-neutral-600 dark:text-neutral-300">
                    <Sparkles size={16} className="text-amber-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-neutral-900 dark:text-white">
                        Qual desvio ou ocorrência deseja reportar agora?
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        Selecione um atalho rápido ou descreva o ocorrido abaixo:
                      </p>
                    </div>
                  </div>

                  {/* Quick Category Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_CATEGORIES.map(cat => (
                      <button
                        key={cat.title}
                        type="button"
                        onClick={() => handleSelectQuickCategory(cat)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all flex items-center gap-1 ${
                          title === cat.title
                            ? 'bg-red-50 dark:bg-red-950/40 border-red-300 text-red-700 dark:text-red-300'
                            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.title}</span>
                      </button>
                    ))}
                  </div>

                  {/* Department Selector */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 mb-1">
                      Departamento / Setor Afetado *
                    </label>
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value as DepartmentId)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-bold outline-none focus:ring-2 focus:ring-red-500"
                    >
                      {Object.values(DEPARTMENTS).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Title */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 mb-1">
                      Título da Ocorrência *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Atraso de Carreta da Marsil, Avaria..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 mb-1">
                      Detalhamento do Fato *
                    </label>
                    <textarea
                      required
                      rows={3}
                      placeholder="Descreva o que ocorreu, horários, placas, quantidades ou impactos na operação..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  {/* Severity & Critical Toggle */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-neutral-500 dark:text-neutral-400 mb-1">
                        Gravidade
                      </label>
                      <select
                        value={severity}
                        onChange={(e) => setSeverity(e.target.value as any)}
                        className="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white text-xs font-semibold outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <option value="low">Baixa</option>
                        <option value="medium">Média</option>
                        <option value="high">Alta</option>
                      </select>
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-red-600 dark:text-red-400">
                        <input
                          type="checkbox"
                          checked={isCritical}
                          onChange={(e) => setIsCritical(e.target.checked)}
                          className="w-4 h-4 rounded text-red-600 focus:ring-red-500"
                        />
                        <Flame size={15} />
                        Ocorrência Crítica
                      </label>
                    </div>
                  </div>

                  {/* Success Banner */}
                  <AnimatePresence>
                    {successMessage && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-emerald-200 dark:border-emerald-800"
                      >
                        <CheckCircle2 size={16} />
                        <span>{successMessage}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={sending || isViewer}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white font-bold py-3 px-4 rounded-2xl text-xs shadow-lg shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Send size={15} />
                    <span>{sending ? 'Registrando...' : 'Registrar Ocorrência Agora'}</span>
                  </button>
                </form>
              ) : (
                /* List of occurrences */
                <div className="space-y-3">
                  <OccurrenceCommentBalloon />
                  {todayOccurrences.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400 space-y-2">
                      <CheckCircle2 size={32} className="mx-auto text-emerald-500 opacity-60" />
                      <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                        Nenhuma ocorrência registrada hoje!
                      </p>
                      <p className="text-[11px] text-neutral-400">Operação fluindo sem desvios reportados.</p>
                    </div>
                  ) : (
                    todayOccurrences.map((occ, idx) => (
                      <ChatbotOccurrenceItem key={occ.id || idx} occ={occ} profile={profile} />
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatbotOccurrenceItem({ occ, profile }: { occ: any; profile: any }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const commentsCount = (occ.comments || []).length;

  return (
    <div
      className={`p-3.5 rounded-2xl border text-xs space-y-1.5 transition-all ${
        occ.severity === 'high'
          ? 'bg-red-50/70 dark:bg-red-950/30 border-red-200 dark:border-red-900/50'
          : occ.severity === 'medium'
          ? 'bg-orange-50/70 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50'
          : 'bg-neutral-50 dark:bg-neutral-800/60 border-neutral-200 dark:border-neutral-700'
      }`}
    >
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="cursor-pointer"
      >
        <div className="flex items-center justify-between">
          <span className="font-bold text-neutral-900 dark:text-white flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              occ.severity === 'high' ? 'bg-red-500' : occ.severity === 'medium' ? 'bg-orange-500' : 'bg-blue-500'
            }`} />
            {occ.title}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400">
            {occ.deptName}
          </span>
        </div>

        <p className={`text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed transition-all ${isExpanded ? '' : 'line-clamp-2'}`}>
          {occ.description}
        </p>

        <div className="flex items-center justify-between text-[10px] text-neutral-400 pt-1">
          <span className="flex items-center gap-1">
            <Clock size={11} />
            {occ.timestamp ? new Date(occ.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'Hoje'}
          </span>
          <div className="flex items-center gap-2">
            <span className="uppercase font-bold tracking-wider">
              {occ.severity === 'high' ? 'Alta' : occ.severity === 'medium' ? 'Média' : 'Baixa'}
            </span>
            {commentsCount > 0 && (
              <span className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-0.5">
                <MessageSquare size={10} />
                {commentsCount}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="pt-2 border-t border-neutral-200/60 dark:border-neutral-700/60 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
        >
          <MessageSquare size={11} />
          <span>{isExpanded ? 'Recolher comentários' : (commentsCount > 0 ? `Comentários (${commentsCount})` : 'Adicionar comentário')}</span>
        </button>
        <button
          type="button"
          onClick={() => setIsExpanded(prev => !prev)}
          className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <OccurrenceCommentSection occurrence={occ} profile={profile} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
