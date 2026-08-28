import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  arrayUnion,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import {
  SystemNotification,
  NotificationType,
  NotificationSeverity,
  NotificationTargetType,
  DepartmentId,
  UserProfile
} from '../types';
import { logAuditEvent } from './auditLogger';

// Web Audio API Synthesizer for reliable offline chime sounds
let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  } catch (e) {
    return null;
  }
}

/**
 * Toca um som harmônico sintetizado correspondente ao nível do alerta
 */
export function playNotificationSound(severity: NotificationSeverity = 'info'): void {
  try {
    // Check if user disabled sound in settings
    const isMuted = localStorage.getItem('marsil_notifications_muted') === 'true';
    if (isMuted) return;

    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);

    if (severity === 'critical') {
      // 🚨 Alerta crítico (tom duplo urgente e nítido)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      
      osc1.type = 'sawtooth';
      osc2.type = 'sine';

      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.setValueAtTime(659.25, now + 0.15); // E5
      osc1.frequency.setValueAtTime(880, now + 0.3); // A5

      osc2.frequency.setValueAtTime(440, now);
      osc2.frequency.setValueAtTime(329.63, now + 0.15);
      osc2.frequency.setValueAtTime(440, now + 0.3);

      gainNode.gain.setValueAtTime(0.2, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc1.connect(gainNode);
      osc2.connect(gainNode);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);
    } else if (severity === 'warning') {
      // 🟡 Alerta de atenção (duplo acorde suave)
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(783.99, now + 0.12); // G5

      gainNode.gain.setValueAtTime(0.18, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.45);
    } else if (severity === 'success') {
      // 🟢 Sucesso / Confirmação (arpeggio ascendente)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, now + 0.2); // G5

      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.5);
    } else {
      // 🔵 Informativo (sino sutil)
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5

      gainNode.gain.setValueAtTime(0.12, now);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gainNode);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (err) {
    // Audio context was blocked or not supported
  }
}

/**
 * Solicita permissão para notificações do navegador (Desktop Web Notifications)
 */
export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    return await Notification.requestPermission();
  } catch (e) {
    return 'default';
  }
}

/**
 * Dispara uma notificação nativa do sistema operacional (Desktop)
 */
export function sendBrowserDesktopNotification(title: string, options?: NotificationOptions): void {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      const notif = new Notification(title, {
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        ...options
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
  } catch (e) {
    // Ignored in constrained environments
  }
}

export interface SendNotificationParams {
  title: string;
  message: string;
  type?: NotificationType;
  severity?: NotificationSeverity;
  targetType?: NotificationTargetType;
  targetDepartment?: DepartmentId | 'admin' | 'viewer' | 'all';
  targetRole?: string;
  targetUserId?: string;
  linkTab?: string;
  linkParams?: Record<string, any>;
  isPinned?: boolean;
  soundAlert?: boolean;
  actionLabel?: string;
  actorProfile?: UserProfile | null;
}

/**
 * Cria e envia uma notificação no Firestore para consumo em tempo real
 */
export async function sendSystemNotification(params: SendNotificationParams): Promise<string | null> {
  try {
    const authUser = auth.currentUser;
    const profile = params.actorProfile;

    const payload = {
      title: params.title,
      message: params.message,
      type: params.type || 'system_info',
      severity: params.severity || 'info',
      targetType: params.targetType || 'all',
      targetDepartment: params.targetDepartment || 'all',
      targetRole: params.targetRole || null,
      targetUserId: params.targetUserId || null,
      linkTab: params.linkTab || null,
      linkParams: params.linkParams || null,
      isPinned: !!params.isPinned,
      soundAlert: params.soundAlert !== false,
      actionLabel: params.actionLabel || null,
      readBy: [],
      timestamp: serverTimestamp(),
      createdAtClient: Date.now(),
      createdBy: {
        uid: profile?.uid || authUser?.uid || 'system',
        name: profile?.displayName || authUser?.email?.split('@')[0] || 'Sistema Marsil',
        email: profile?.email || authUser?.email || 'sistema@marsillog.com',
        departmentId: profile?.departmentId || 'admin'
      }
    };

    const docRef = await addDoc(collection(db, 'system_notifications'), payload);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao enviar notificação de sistema:', error);
    return null;
  }
}

/**
 * Dispara um comunicado operacional global / broadcast com registro de auditoria
 */
export async function broadcastOperationalAlert(params: {
  title: string;
  message: string;
  severity: NotificationSeverity;
  targetDepartment?: DepartmentId | 'admin' | 'viewer' | 'all';
  linkTab?: string;
  isPinned?: boolean;
  actorProfile: UserProfile | null;
}): Promise<string | null> {
  const notifId = await sendSystemNotification({
    title: params.title,
    message: params.message,
    type: 'broadcast',
    severity: params.severity,
    targetType: params.targetDepartment === 'all' || !params.targetDepartment ? 'all' : 'department',
    targetDepartment: params.targetDepartment || 'all',
    linkTab: params.linkTab,
    isPinned: params.isPinned,
    soundAlert: true,
    actionLabel: params.linkTab ? 'Visualizar Módulo' : undefined,
    actorProfile: params.actorProfile
  });

  // Grava auditoria da transmissão
  await logAuditEvent({
    action: 'SYSTEM_ACTION',
    category: 'SETTINGS',
    severity: params.severity === 'critical' ? 'critical' : 'info',
    description: `Alerta Operacional transmitido por ${params.actorProfile?.displayName || 'Admin'}: "${params.title}" (Destino: ${params.targetDepartment || 'Todos'}).`,
    targetType: 'system_notification',
    targetId: notifId || undefined,
    targetName: params.title,
    actorProfile: params.actorProfile,
    details: {
      title: params.title,
      severity: params.severity,
      targetDepartment: params.targetDepartment
    }
  });

  return notifId;
}

/**
 * Marca uma notificação individual como lida pelo usuário atual
 */
export async function markNotificationAsRead(notificationId: string, userIdentifier: string): Promise<void> {
  if (!notificationId || !userIdentifier) return;
  try {
    const notifRef = doc(db, 'system_notifications', notificationId);
    await updateDoc(notifRef, {
      readBy: arrayUnion(userIdentifier)
    });
  } catch (err) {
    console.error('Erro ao marcar notificação como lida:', err);
  }
}

/**
 * Marca todas as notificações visíveis como lidas
 */
export async function markAllNotificationsAsRead(
  notifications: SystemNotification[],
  userIdentifier: string
): Promise<void> {
  if (!notifications.length || !userIdentifier) return;
  try {
    const batch = writeBatch(db);
    const unread = notifications.filter(n => n.id && (!n.readBy || !n.readBy.includes(userIdentifier)));
    
    // Batch limit is 500 in Firestore
    unread.slice(0, 400).forEach(n => {
      if (n.id) {
        const notifRef = doc(db, 'system_notifications', n.id);
        batch.update(notifRef, {
          readBy: arrayUnion(userIdentifier)
        });
      }
    });

    await batch.commit();
  } catch (err) {
    console.error('Erro ao marcar todas as notificações como lidas:', err);
  }
}

/**
 * Exclui uma notificação (apenas administradores ou autor)
 */
export async function deleteSystemNotification(notificationId: string): Promise<void> {
  if (!notificationId) return;
  try {
    await deleteDoc(doc(db, 'system_notifications', notificationId));
  } catch (err) {
    console.error('Erro ao excluir notificação:', err);
  }
}

/**
 * Formata timestamps de notificações de maneira humanizada e em tempo relativo
 */
export function formatNotificationRelativeTime(timestamp: any): string {
  if (!timestamp) return 'Agora';

  let date: Date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return 'Agora';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 30) {
    return 'Agora mesmo';
  }
  if (diffInSeconds < 60) {
    return `há ${diffInSeconds}s`;
  }
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `há ${diffInMinutes} min`;
  }
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `há ${diffInHours}h`;
  }
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return 'Ontem às ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffInDays < 7) {
    return `há ${diffInDays} dias`;
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
