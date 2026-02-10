import { messaging } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';

// VAPID key - You need to generate this from Firebase Console
// Go to Project Settings > Cloud Messaging > Web Push certificates
const VAPID_KEY = 'BL8XaU0DvujxZ2t94QiyKmJWDYyRTCuZMlbHihD_x5__A4757oQN72mm9ZSZ7UhYi-Rmr30oBQlOMJvcqdlVjaA'; // Replace with actual VAPID key from Firebase Console

/**
 * Request notification permission and get FCM token
 */
export const requestNotificationPermission = async (): Promise<string | null> => {
    try {
        if (!messaging) {
            console.warn('Firebase Messaging not initialized');
            return null;
        }

        // Check if notifications are supported
        if (!('Notification' in window)) {
            console.warn('This browser does not support notifications');
            return null;
        }

        // Request permission
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            console.log('✅ Notification permission granted');

            // Register service worker
            if ('serviceWorker' in navigator) {
                try {
                    // Register the service worker
                    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    console.log('✅ Service Worker registered:', registration);

                    // Wait for the service worker to be ready
                    await navigator.serviceWorker.ready;
                    console.log('✅ Service Worker is ready');

                    // Get FCM token
                    const token = await getToken(messaging, {
                        vapidKey: VAPID_KEY,
                        serviceWorkerRegistration: registration
                    });

                    if (token) {
                        console.log('✅ FCM Token:', token);
                        // Store token in localStorage for future use
                        localStorage.setItem('fcm_token', token);
                        return token;
                    } else {
                        console.warn('No registration token available');
                        return null;
                    }
                } catch (swError) {
                    console.error('Service Worker registration or token retrieval failed:', swError);
                    return null;
                }
            }
        } else if (permission === 'denied') {
            console.warn('❌ Notification permission denied');
            return null;
        } else {
            console.warn('⚠️ Notification permission dismissed');
            return null;
        }

        return null;
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return null;
    }
};

/**
 * Setup foreground notification listener
 */
export const setupForegroundListener = (onNotificationReceived: (payload: any) => void) => {
    if (!messaging) {
        console.warn('Firebase Messaging not initialized');
        return () => { };
    }

    const unsubscribe = onMessage(messaging, (payload) => {
        console.log('📢 Foreground message received:', payload);

        // Play notification sound
        playNotificationSound();

        // Show browser notification even when app is in foreground
        if (Notification.permission === 'granted') {
            const notificationTitle = payload.notification?.title || 'New Update';
            const notificationOptions: any = {
                body: payload.notification?.body || 'You have a new notification',
                icon: '/logo.png',
                badge: '/logo.png',
                tag: payload.data?.type || 'general',
                requireInteraction: false,
                vibrate: [200, 100, 200],
                data: payload.data
            };

            new Notification(notificationTitle, notificationOptions as any);
        }

        // Call custom handler
        onNotificationReceived(payload);
    });

    return unsubscribe;
};

/**
 * Play notification sound
 * Added "unlocking" logic to handle browser autoplay policies
 */
let audioUnlocked = false;

export const unlockAudio = () => {
    if (audioUnlocked) return;
    try {
        const audio = new Audio();
        audio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
        audio.play().then(() => {
            audioUnlocked = true;
            console.log('🔊 Audio system unlocked');
            window.removeEventListener('click', unlockAudio);
            window.removeEventListener('touchstart', unlockAudio);
        }).catch(() => {
            // Silently fail, we'll try again on next click
        });
    } catch (e) {
        // Ignore
    }
};

// Add global listeners to unlock audio on first interaction
if (typeof window !== 'undefined') {
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
}

export const playNotificationSound = () => {
    try {
        const audio = new Audio('/notification.mp3');
        audio.volume = 0.5;
        audio.play().catch(err => {
            console.warn('Could not play notification sound (Browser Autoplay block):', err.message);
            // If it failed, try to unlock again
            unlockAudio();
        });
    } catch (error) {
        console.warn('Error with notification sound:', error);
    }
};

/**
 * Save FCM token to Firestore for the current user
 */
export const saveFCMToken = async (
    userId: string,
    token: string,
    db: any
) => {
    try {
        const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

        await setDoc(doc(db, 'fcm_tokens', userId), {
            token,
            userId,
            updatedAt: serverTimestamp(),
            platform: 'web'
        }, { merge: true });

        console.log('✅ FCM token saved to Firestore');
    } catch (error: any) {
        // Silently handle permission errors - token is still functional locally
        if (error?.code === 'permission-denied') {
            console.warn('FCM token not saved to Firestore (permission issue), but notifications will still work');
        } else {
            console.error('Error saving FCM token:', error);
        }
    }
};

/**
 * Initialize notifications for a user
 */
export const initializeNotifications = async (userId: string, db: any) => {
    try {
        const token = await requestNotificationPermission();

        if (token) {
            await saveFCMToken(userId, token, db);
            return token;
        }

        return null;
    } catch (error) {
        console.error('Error initializing notifications:', error);
        return null;
    }
};
