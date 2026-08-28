import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { Occurrence, OccurrenceComment, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from './firestoreUtils';
import { sendSystemNotification } from '../utils/notificationService';
import { logAuditEvent } from '../utils/auditLogger';

interface AddCommentParams {
  logId?: string;
  date?: string;
  departmentId?: string;
  occurrenceIdOrTimestamp: string | number;
  commentText: string;
  profile: UserProfile | null;
}

interface DeleteCommentParams {
  logId?: string;
  date?: string;
  departmentId?: string;
  occurrenceIdOrTimestamp: string | number;
  commentId: string;
}

/**
 * Adds a comment to a specific occurrence inside a log document
 */
export async function addCommentToOccurrence({
  logId,
  date,
  departmentId,
  occurrenceIdOrTimestamp,
  commentText,
  profile
}: AddCommentParams): Promise<boolean> {
  if (!commentText.trim()) return false;

  const newComment: OccurrenceComment = {
    id: `comm-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    authorUid: profile?.uid || 'anonymous',
    authorName: profile?.displayName || profile?.email?.split('@')[0] || 'Colaborador',
    authorDepartment: profile?.departmentId || undefined,
    text: commentText.trim(),
    timestamp: Date.now()
  };

  try {
    let targetDocRef: any = null;
    let targetLogData: any = null;

    if (logId) {
      const docRef = doc(db, 'logs', logId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        targetDocRef = docRef;
        targetLogData = docSnap.data();
      }
    }

    // Fallback: search by date + departmentId if logId was not supplied or not found
    if (!targetDocRef && departmentId) {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'logs'),
        where('departmentId', '==', departmentId),
        where('date', '==', targetDate)
      );
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        targetDocRef = doc(db, 'logs', querySnap.docs[0].id);
        targetLogData = querySnap.docs[0].data();
      }
    }

    // Fallback 2: search all logs containing this occurrence timestamp/id
    if (!targetDocRef) {
      const qAll = query(collection(db, 'logs'));
      const allSnap = await getDocs(qAll);
      for (const d of allSnap.docs) {
        const data = d.data();
        const occList: Occurrence[] = data.occurrences || [];
        const match = occList.some(
          occ => String(occ.id) === String(occurrenceIdOrTimestamp) || String(occ.timestamp) === String(occurrenceIdOrTimestamp)
        );
        if (match) {
          targetDocRef = doc(db, 'logs', d.id);
          targetLogData = data;
          break;
        }
      }
    }

    if (!targetDocRef || !targetLogData) {
      console.warn('Log document not found for occurrence', occurrenceIdOrTimestamp);
      return false;
    }

    const occurrences: Occurrence[] = [...(targetLogData.occurrences || [])];
    let found = false;

    const updatedOccurrences = occurrences.map(occ => {
      const matches = String(occ.id) === String(occurrenceIdOrTimestamp) || String(occ.timestamp) === String(occurrenceIdOrTimestamp);
      if (matches) {
        found = true;
        const currentComments = occ.comments || [];
        return {
          ...occ,
          comments: [...currentComments, newComment]
        };
      }
      return occ;
    });

    if (!found) {
      console.warn('Occurrence not found in target log', occurrenceIdOrTimestamp);
      return false;
    }

    await updateDoc(targetDocRef, {
      occurrences: updatedOccurrences,
      updatedAt: serverTimestamp()
    });

    try {
      const dept = departmentId || targetLogData.departmentId || 'all';
      await sendSystemNotification({
        title: `Novo comentário em ocorrência`,
        message: `${newComment.authorName}: "${newComment.text.slice(0, 80)}${newComment.text.length > 80 ? '...' : ''}"`,
        type: 'occurrence',
        severity: 'info',
        targetType: dept === 'all' ? 'all' : 'department',
        targetDepartment: dept,
        linkTab: dept,
        actionLabel: 'Ver Ocorrência',
        actorProfile: profile
      });

      await logAuditEvent({
        action: 'COMMENT_ADD',
        category: 'OCCURRENCES',
        description: `Comentário adicionado por ${newComment.authorName}: "${newComment.text.slice(0, 60)}"`,
        targetName: `Ocorrência (${dept})`,
        severity: 'info',
        actorProfile: profile
      });
    } catch (err) {
      console.error('Failed to send notification for comment:', err);
    }

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `logs/occurrence-comment`);
    return false;
  }
}

/**
 * Removes a comment from an occurrence
 */
export async function deleteCommentFromOccurrence({
  logId,
  date,
  departmentId,
  occurrenceIdOrTimestamp,
  commentId
}: DeleteCommentParams): Promise<boolean> {
  try {
    let targetDocRef: any = null;
    let targetLogData: any = null;

    if (logId) {
      const docRef = doc(db, 'logs', logId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        targetDocRef = docRef;
        targetLogData = docSnap.data();
      }
    }

    if (!targetDocRef && departmentId) {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const q = query(
        collection(db, 'logs'),
        where('departmentId', '==', departmentId),
        where('date', '==', targetDate)
      );
      const querySnap = await getDocs(q);
      if (!querySnap.empty) {
        targetDocRef = doc(db, 'logs', querySnap.docs[0].id);
        targetLogData = querySnap.docs[0].data();
      }
    }

    if (!targetDocRef) return false;

    const occurrences: Occurrence[] = [...(targetLogData.occurrences || [])];
    const updatedOccurrences = occurrences.map(occ => {
      const matches = String(occ.id) === String(occurrenceIdOrTimestamp) || String(occ.timestamp) === String(occurrenceIdOrTimestamp);
      if (matches) {
        const currentComments = occ.comments || [];
        return {
          ...occ,
          comments: currentComments.filter(c => c.id !== commentId)
        };
      }
      return occ;
    });

    await updateDoc(targetDocRef, {
      occurrences: updatedOccurrences,
      updatedAt: serverTimestamp()
    });

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `logs/delete-comment`);
    return false;
  }
}
