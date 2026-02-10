import { useEffect, useState, useCallback, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { playNotificationSound } from '../lib/notifications';

export interface RealtimeUpdate {
    id: string;
    type: 'notice' | 'homework' | 'message';
    title: string;
    body?: string;
    createdAt: any;
    data: any;
    isNew?: boolean;
    assignedDate?: any;
}

interface UseRealtimeUpdatesOptions {
    userId: string;
    userRole: 'PARENT' | 'STUDENT' | 'TEACHER' | 'ADMIN';
    studentClass?: string;
    section?: string;
    schoolId: string;
    enabled?: boolean;
}

/**
 * Custom hook for real-time updates (notices, homework, messages)
 * Automatically plays notification sound and shows toast when new updates arrive
 */
export const useRealtimeUpdates = (options: UseRealtimeUpdatesOptions) => {
    const { userId, userRole, studentClass, section, schoolId, enabled = true } = options;

    const [notices, setNotices] = useState<RealtimeUpdate[]>([]);
    const [homework, setHomework] = useState<RealtimeUpdate[]>([]);
    const [messages, setMessages] = useState<RealtimeUpdate[]>([]);
    const [loading, setLoading] = useState(true);
    const [newUpdateCount, setNewUpdateCount] = useState(0);

    // Track last seen timestamp to identify new items
    const [lastSeenTimestamp, setLastSeenTimestamp] = useState<number>(() => {
        const stored = localStorage.getItem(`last_seen_${userId}`);
        return stored ? parseInt(stored) : Date.now();
    });

    // Update last seen timestamp
    const markAllAsSeen = useCallback(() => {
        const now = Date.now();
        setLastSeenTimestamp(now);
        localStorage.setItem(`last_seen_${userId}`, now.toString());
        setNewUpdateCount(0);
    }, [userId]);

    const isInitialNotices = useRef(true);
    // Listen to notices
    useEffect(() => {
        if (!enabled || !schoolId) {
            setNotices([]);
            setLoading(false);
            return;
        }

        const noticesQuery = query(
            collection(db, 'notices'),
            where('schoolId', '==', schoolId),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(noticesQuery, (snapshot) => {
            const noticesData: RealtimeUpdate[] = [];
            let newItemsDetected = 0;
            let latestNewNotice: any = null;

            snapshot.forEach((doc) => {
                const data = doc.data();

                // Check if notice is for this user
                const target = data.target;
                const isForUser = target === 'All' ||
                    target === 'All Students' ||
                    (userRole === 'PARENT' && target === 'Parents') ||
                    (userRole === 'STUDENT' && target === 'Students') ||
                    (userRole === 'TEACHER' && target === 'Teachers');

                if (!isForUser) {
                    return;
                }

                // Treat items with no createdAt as old if we just started, or new if they just arrived
                const createdAt = data.createdAt?.toMillis?.() || (isInitialNotices.current ? 0 : Date.now());
                const isNew = createdAt > lastSeenTimestamp;

                if (isNew) {
                    newItemsDetected++;
                    if (!latestNewNotice || createdAt > (latestNewNotice.createdAt?.toMillis?.() || 0)) {
                        latestNewNotice = data;
                    }
                }

                noticesData.push({
                    id: doc.id,
                    type: 'notice',
                    title: data.title,
                    body: data.content,
                    createdAt: data.createdAt,
                    data,
                    isNew
                });
            });

            setNotices(noticesData);
            // Play sound once if there are new notices and it's not the initial load
            if (newItemsDetected > 0 && !isInitialNotices.current) {
                setNewUpdateCount(prev => prev + newItemsDetected);
                playNotificationSound();

                // Show browser notification
                if (Notification.permission === 'granted' && latestNewNotice) {
                    const notificationTitle = latestNewNotice.type === 'URGENT' ? '🚨 Urgent Notice' : 'New Notice';
                    const notificationOptions: any = {
                        body: latestNewNotice.title,
                        icon: '/logo.png',
                        badge: '/logo.png',
                        tag: 'notice',
                        requireInteraction: latestNewNotice.type === 'URGENT',
                        vibrate: [200, 100, 200],
                        data: { type: 'notice', ...latestNewNotice }
                    };

                    new Notification(notificationTitle, notificationOptions as any);
                }
            }

            isInitialNotices.current = false;
            setLoading(false);
        });

        return unsubscribe;
    }, [enabled, schoolId, userRole, lastSeenTimestamp]);

    const isInitialHomework = useRef(true);
    // Listen to homework
    useEffect(() => {
        if (!enabled || !schoolId || !studentClass) {
            setHomework([]); // Clear if conditions not met
            return;
        }

        const homeworkQuery = query(
            collection(db, 'homework'),
            where('schoolId', '==', schoolId),
            where('class', '==', studentClass)
        );

        const unsubscribe = onSnapshot(homeworkQuery, (snapshot) => {
            const homeworkData: RealtimeUpdate[] = [];
            let newItemsDetected = 0;
            let latestNewHomework: any = null;

            snapshot.forEach((doc) => {
                const data = doc.data();

                // Check section match
                const hwSection = data.section;
                const isForSection = !hwSection ||
                    hwSection === 'All Sections' ||
                    hwSection === section;

                if (!isForSection) return;

                const createdAt = data.createdAt?.toMillis?.() || data.assignedDate?.toMillis?.() || (isInitialHomework.current ? 0 : Date.now());
                const isNew = createdAt > lastSeenTimestamp;

                if (isNew) {
                    newItemsDetected++;
                    if (!latestNewHomework || createdAt > (latestNewHomework.createdAt?.toMillis?.() || 0)) {
                        latestNewHomework = data;
                    }
                }

                homeworkData.push({
                    id: doc.id,
                    type: 'homework',
                    title: `${data.subject}: ${data.title}`,
                    body: data.description,
                    createdAt: data.createdAt || data.assignedDate,
                    assignedDate: data.assignedDate,
                    data,
                    isNew
                });
            });

            // Sort by date in code (newest first)
            homeworkData.sort((a, b) => {
                // Parse ISO string or Firestore timestamp
                const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
                const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
                return bTime - aTime;
            });

            // Take only latest 20
            const latestHomework = homeworkData.slice(0, 20);

            setHomework(latestHomework);
            // Play sound and show notification only if it's not the initial snapshot
            if (newItemsDetected > 0 && !isInitialHomework.current) {
                setNewUpdateCount(prev => prev + newItemsDetected);
                playNotificationSound();

                // Show browser notification
                if (Notification.permission === 'granted' && latestNewHomework) {
                    const notificationTitle = 'New Homework Assignment';
                    const notificationOptions: any = {
                        body: `${latestNewHomework.subject}: ${latestNewHomework.title}`,
                        icon: '/logo.png',
                        badge: '/logo.png',
                        tag: 'homework',
                        requireInteraction: false,
                        vibrate: [200, 100, 200],
                        data: { type: 'homework', ...latestNewHomework }
                    };

                    new Notification(notificationTitle, notificationOptions as any);
                }
            }

            isInitialHomework.current = false;
        });

        return unsubscribe;
    }, [enabled, schoolId, studentClass, section, lastSeenTimestamp]);

    const isInitialMessages = useRef(true);
    // Listen to messages (if applicable)
    useEffect(() => {
        if (!enabled || !userId) return;

        // Listen to messages where user is recipient
        const messagesQuery = query(
            collection(db, 'messages'),
            where('recipientId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
            const messagesData: RealtimeUpdate[] = [];
            let newItemsDetected = 0;

            snapshot.forEach((doc) => {
                const data = doc.data();
                const createdAt = data.createdAt?.toMillis?.() || (isInitialMessages.current ? 0 : Date.now());
                const isNew = createdAt > lastSeenTimestamp && !data.read;

                if (isNew) {
                    newItemsDetected++;
                }

                messagesData.push({
                    id: doc.id,
                    type: 'message',
                    title: data.subject || 'New Message',
                    body: data.content,
                    createdAt: data.createdAt,
                    data,
                    isNew
                });
            });

            setMessages(messagesData);
            if (newItemsDetected > 0 && !isInitialMessages.current) {
                setNewUpdateCount(prev => prev + newItemsDetected);
                // playNotificationSound(); // Enable if sound is needed for messages
            }

            isInitialMessages.current = false;
        });

        return unsubscribe;
    }, [enabled, userId, lastSeenTimestamp]);

    return {
        notices,
        homework,
        messages,
        loading,
        newUpdateCount,
        markAllAsSeen,
        allUpdates: [...notices, ...homework, ...messages].sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() || 0;
            const bTime = b.createdAt?.toMillis?.() || 0;
            return bTime - aTime;
        })
    };
};

export default useRealtimeUpdates;
