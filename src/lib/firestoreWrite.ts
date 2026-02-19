/**
 * ─── Firestore Write Guard ────────────────────────────────────────────────────
 * All mutation helpers (add / update / delete / setDoc / writeBatch commit)
 * check the current user's `canWrite` flag before touching Firestore.
 *
 * Collections listed in EXEMPT_COLLECTIONS bypass the check (internal app use).
 *
 * Usage:
 *   import { guardedAddDoc, guardedUpdateDoc, guardedDeleteDoc, guardedSetDoc } from '../../lib/firestoreWrite';
 *   await guardedAddDoc(collection(db, 'students'), data);
 * ─────────────────────────────────────────────────────────────────────────────
 */

import {
    addDoc,
    updateDoc,
    deleteDoc,
    setDoc,
} from 'firebase/firestore';
import type {
    CollectionReference,
    DocumentReference,
    UpdateData,
    SetOptions,
    WriteBatch,
} from 'firebase/firestore';

// Collections that are always writable (internal app / role management)
const EXEMPT_COLLECTIONS = ['settings'];

const WRITE_DENIED_MSG =
    '🔒 Access Denied: Your role has View-Only permissions.\nContact the Administrator to enable write access.';

/** Returns true if the logged-in user has canWrite permission */
export function canCurrentUserWrite(collectionPath?: string): boolean {
    // If this is an exempt collection, always allow
    if (collectionPath) {
        const base = collectionPath.split('/')[0];
        if (EXEMPT_COLLECTIONS.includes(base)) return true;
    }

    try {
        const user = JSON.parse(localStorage.getItem('aischool360_user') || 'null');
        if (!user) return false;
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;

        const customRoles = JSON.parse(localStorage.getItem('millat_custom_roles') || '[]');
        const roleConfig = customRoles.find(
            (r: any) => r.role === user.role || r.id === user.role
        );
        return roleConfig?.canWrite === true;
    } catch {
        return false;
    }
}

function assertCanWrite(collectionPath?: string) {
    if (!canCurrentUserWrite(collectionPath)) {
        alert(WRITE_DENIED_MSG);
        throw new Error('WRITE_DENIED');
    }
}

// ─── Guarded wrappers ────────────────────────────────────────────────────────

export async function guardedAddDoc<T>(ref: CollectionReference<T>, data: any) {
    assertCanWrite((ref as any).path);
    return addDoc(ref, data);
}

export async function guardedUpdateDoc<T>(ref: DocumentReference<T>, data: Record<string, any>) {
    assertCanWrite((ref as any).path);
    return updateDoc(ref as any, data);

}

export async function guardedDeleteDoc<T>(ref: DocumentReference<T>) {
    assertCanWrite((ref as any).path);
    return deleteDoc(ref);
}

export async function guardedSetDoc<T>(
    ref: DocumentReference<T>,
    data: any,
    options?: SetOptions
) {
    assertCanWrite((ref as any).path);
    return options ? setDoc(ref, data, options) : setDoc(ref, data);
}

/** Wraps a WriteBatch commit with canWrite check */
export async function guardedBatchCommit(batch: WriteBatch, collectionPath?: string) {
    assertCanWrite(collectionPath);
    return batch.commit();
}
