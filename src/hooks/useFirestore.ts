import { useState, useEffect } from 'react';
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

export function useFirestore<T = DocumentData>(collectionName: string, constraints: QueryConstraint[] = [], options: { skipSchoolFilter?: boolean } = {}) {
    const [data, setData] = useState<T[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const { currentSchool } = useSchool();

    useEffect(() => {
        // Skip listener setup if waiting for school context (unless it's a school-independent collection)
        const needsSchool = !options.skipSchoolFilter && collectionName !== 'schools';
        if (needsSchool && !currentSchool?.id) {
            setLoading(false);
            return;
        }

        const finalConstraints = [...constraints];

        // Auto-inject schoolId filter unless skipped or collection is 'schools'
        if (currentSchool?.id && !options.skipSchoolFilter && collectionName !== 'schools') {
            finalConstraints.push(where('schoolId', '==', currentSchool.id));
        }

        const q = query(collection(db, collectionName), ...finalConstraints);

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const items = snapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id
            })) as T[];
            setData(items);
            setLoading(false);
        }, (err) => {
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [collectionName, currentSchool?.id, options.skipSchoolFilter, constraints.length]);

    const add = async (item: any) => {
        const dataToAdd = { ...item };
        if (currentSchool && !options.skipSchoolFilter && !['schools', 'settings'].includes(collectionName)) {
            dataToAdd.schoolId = currentSchool.id;
        }
        return await addDoc(collection(db, collectionName), dataToAdd);
    };

    const update = async (id: string, item: any) => {
        const docRef = doc(db, collectionName, id);
        return await updateDoc(docRef, item);
    };

    const remove = async (id: string) => {
        const docRef = doc(db, collectionName, id);
        return await deleteDoc(docRef);
    };

    return { data, loading, error, add, update, remove };
}
