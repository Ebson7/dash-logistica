import React, { useState } from 'react';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  CornerDownRight, 
  Sparkles, 
  Loader2, 
  Check, 
  User,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Occurrence, OccurrenceComment, UserProfile } from '../types';
import { addCommentToOccurrence, deleteCommentFromOccurrence } from '../lib/occurrenceUtils';

interface OccurrenceCommentSectionProps {
  occurrence: Occurrence;
  profile: UserProfile | null;
  onCommentAdded?: () => void;
  compact?: boolean;
}

const QUICK_RESPONSES = [
  '✅ Resolvido pela equipe',
  '👀 Ciente, acompanhando',
  '📞 Em contato com fornecedor',
  '🚜 Manutenção acionada',
  '⚠️ Aguardando liberação'
];

export function OccurrenceCommentSection({ 
  occurrence, 
  profile, 
  onCommentAdded,
  compact = false 
}: OccurrenceCommentSectionProps) {
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const comments: OccurrenceComment[] = occurrence.comments || [];
  const isAdmin = profile?.departmentId === 'admin';

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || submitting) return;

    setSubmitting(true);
    const success = await addCommentToOccurrence({
      logId: occurrence.logId,
      date: occurrence.date,
      departmentId: occurrence.departmentId,
      occurrenceIdOrTimestamp: occurrence.id || occurrence.timestamp,
      commentText: commentText.trim(),
      profile
    });

    if (success) {
      setCommentText('');
      if (onCommentAdded) onCommentAdded();
    }
    setSubmitting(false);
  };

  const handleQuickResponse = (text: string) => {
    setCommentText(prev => prev ? `${prev} ${text}` : text);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Deseja excluir este comentário?')) return;
    setDeletingId(commentId);
    await deleteCommentFromOccurrence({
      logId: occurrence.logId,
      date: occurrence.date,
      departmentId: occurrence.departmentId,
      occurrenceIdOrTimestamp: occurrence.id || occurrence.timestamp,
      commentId
    });
    setDeletingId(null);
  };

  const formatCommentDate = (timestamp: number) => {
    if (!timestamp) return '';
    const now = Date.now();
    const diffMin = Math.round((now - timestamp) / 60000);
    
    if (diffMin < 1) return 'Agora mesmo';
    if (diffMin < 60) return `Há ${diffMin} min`;
    
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
      const d = new Date(timestamp);
      return `Hoje às ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const d = new Date(timestamp);
    return `${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div 
      onClick={(e) => e.stopPropagation()} 
      className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 space-y-3"
    >
      {/* Header of comments section */}
      <div className="flex items-center justify-between text-xs font-bold text-neutral-600 dark:text-neutral-300">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
          <MessageSquare size={13} className="text-blue-500" />
          Comentários e Atualizações ({comments.length})
        </span>
        {comments.length === 0 && (
          <span className="text-[10px] text-neutral-400 font-normal">Seja o primeiro a comentar</span>
        )}
      </div>

      {/* List of existing comments */}
      {comments.length > 0 && (
        <div className="space-y-2 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
          {comments.map((comm) => {
            const canDelete = isAdmin || (profile && comm.authorUid === profile.uid);
            return (
              <div 
                key={comm.id}
                className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-100 dark:border-neutral-700/60 text-xs space-y-1 group/comm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-black uppercase">
                      {comm.authorName.charAt(0) || <User size={10} />}
                    </div>
                    <span className="font-bold text-neutral-900 dark:text-neutral-100 text-[11px]">
                      {comm.authorName}
                    </span>
                    {comm.authorDepartment && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-neutral-200/70 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 font-medium">
                        {comm.authorDepartment}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-neutral-400">
                      {formatCommentDate(comm.timestamp)}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(comm.id)}
                        disabled={deletingId === comm.id}
                        className="opacity-0 group-hover/comm:opacity-100 text-neutral-400 hover:text-red-500 transition-opacity p-0.5"
                        title="Excluir comentário"
                      >
                        {deletingId === comm.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-neutral-700 dark:text-neutral-200 text-[11px] leading-relaxed pl-6 whitespace-pre-wrap">
                  {comm.text}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick suggestions */}
      {!compact && (
        <div className="flex flex-wrap gap-1 pt-1">
          {QUICK_RESPONSES.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickResponse(chip)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-300 transition-colors border border-neutral-200/50 dark:border-neutral-700"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* Input box */}
      <form onSubmit={handleSubmit} className="flex items-center gap-1.5 pt-1">
        <input
          type="text"
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          placeholder="Escreva um comentário ou status..."
          className="flex-1 text-xs px-3 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-white placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        />
        <button
          type="submit"
          disabled={!commentText.trim() || submitting}
          className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1 shadow-sm shrink-0"
        >
          {submitting ? (
            <Loader2 size={13} className="animate-spin" />
          ) : (
            <>
              <Send size={12} />
              <span className="hidden sm:inline">Comentar</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
