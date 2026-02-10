import { useState, useEffect } from 'react';
import { rtdb } from '../lib/firebase';
import { ref, onValue, set, push, remove as rtdbRemove, update as rtdbUpdate } from 'firebase/database';

export function useRealtime<T = any>(path: string) {
    const [data, setData] = useState<T[]>([]);
    const [rawData, setRawData] = useState<Record<string, T> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const dbRef = ref(rtdb, path);

        const unsubscribe = onValue(dbRef, (snapshot) => {
            const val = snapshot.val();
            if (val) {
                setRawData(val);
                // Convert object to array with IDs
                const items = Object.entries(val).map(([id, value]) => ({
                    ...(value as any),
                    id
                })) as T[];
                setData(items);
            } else {
                setData([]);
                setRawData(null);
            }
            setLoading(false);
        }, (err) => {
            console.error(`RTDB Error ${path}:`, err);
            setError(err);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [path]);

    const add = async (item: any) => {
        const dbRef = ref(rtdb, path);
        return push(dbRef, item);
    };

    const update = async (id: string, item: any) => {
        const dbRef = ref(rtdb, `${path}/${id}`);
        return rtdbUpdate(dbRef, item);
    };

    const remove = async (id: string) => {
        const dbRef = ref(rtdb, `${path}/${id}`);
        return rtdbRemove(dbRef);
    };

    const setVal = async (id: string, item: any) => {
        const dbRef = ref(rtdb, `${path}/${id}`);
        return set(dbRef, item);
    };

    return { data, rawData, loading, error, add, update, remove, setVal };
}
