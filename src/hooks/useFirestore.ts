import { useState, useEffect, useCallback } from 'react';
import { db } from '../lib/firebase';
import { useSchool } from '../context/SchoolContext';
import {
    collection,
    query,
    onSnapshot,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    QueryConstraint,
    where
} from 'firebase/firestore';

// Generic type for Firestore document data
type DocumentData = Record<string, any>;

// Stable empty array reference — prevents default [] from creating new references each render
const EMPTY_CONSTRAINTS: QueryConstraint[] = [];

// ─── Utility: get canWrite from localStorage (same source as AuthContext) ─────
// We read from localStorage directly to avoid circular hook deps.
const getCanWriteFromStorage = (): boolean => {
    try {
        const user = JSON.parse(localStorage.getItem('aischool360_user') || 'null');
        if (!user) return false;
        // ADMIN / SUPER_ADMIN always have write
        if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') return true;
        const customRoles = JSON.parse(localStorage.getItem('millat_custom_roles') || '[]');
        const roleConfig = customRoles.find((r: any) => r.role === user.role || r.id === user.role);
        return roleConfig?.canWrite === true;
    } catch {
        return false;
    }
};

const WRITE_DENIED_MSG = '🔒 Access Denied: Your role has View-Only permissions. Contact the Administrator to enable write access.';

export function useFirestore<T = DocumentData>(collectionName: string, constraints: QueryConstraint[] | null = EMPTY_CONSTRAINTS, options: { skipSchoolFilter?: boolean } = {}) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { currentSchool } = useSchool();

    useEffect(() => {
        // ─── If constraints is null, skip listener entirely (lazy/conditional loading) ─
        if (constraints === null) {
            setData([]);
            setLoading(false);
            return;
        }

        // Skip listener setup if waiting for school context (unless it's a school-independent collection)
        const needsSchool = !options.skipSchoolFilter && collectionName !== 'schools';
        if (needsSchool && !currentSchool?.id) {
            setLoading(false);
            return;
        }

        setLoading(true); // Reset loading when constraints change

        const finalConstraints = [...constraints];

        // Auto-inject schoolId filter unless skipped or collection is 'schools'
        if (currentSchool?.id && !options.skipSchoolFilter && collectionName !== 'schools') {
            finalConstraints.push(where('schoolId', '==', currentSchool.id));
        }

        const q = query(collection(db, collectionName), ...finalConstraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    ...data,
                    uid: doc.id,
                    id: data.id || doc.id
                };
            }) as T[];
            setData(items);
            setLoading(false);
        }, (err) => {
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [collectionName, currentSchool?.id, options.skipSchoolFilter,
        constraints === null ? 'null' : JSON.stringify(constraints)]);

    // ─── Settings / role collections are exempt from write guard ─────────────
    // These are used internally by the app (role save, module control, etc.)
    const EXEMPT_COLLECTIONS = ['settings'];
    const isExempt = EXEMPT_COLLECTIONS.includes(collectionName);

    const add = useCallback(async (item: any) => {
        if (!isExempt && !getCanWriteFromStorage()) {
            alert(WRITE_DENIED_MSG);
            throw new Error('Write access denied');
        }
        const dataToAdd = { ...item };
        if (currentSchool && !options.skipSchoolFilter && !['schools', 'settings'].includes(collectionName)) {
            dataToAdd.schoolId = currentSchool.id;
        }
        return await addDoc(collection(db, collectionName), dataToAdd);
    }, [collectionName, currentSchool, options.skipSchoolFilter, isExempt]);

    const update = useCallback(async (id: string, item: any) => {
        if (!isExempt && !getCanWriteFromStorage()) {
            alert(WRITE_DENIED_MSG);
            throw new Error('Write access denied');
        }
        const docRef = doc(db, collectionName, id);
        return await updateDoc(docRef, item);
    }, [collectionName, isExempt]);

    const remove = useCallback(async (id: string) => {
        if (!isExempt && !getCanWriteFromStorage()) {
            alert(WRITE_DENIED_MSG);
            throw new Error('Write access denied');
        }
        const docRef = doc(db, collectionName, id);
        return await deleteDoc(docRef);
    }, [collectionName, isExempt]);

    return { data, loading, error, add, update, remove };
}
