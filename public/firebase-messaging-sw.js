// Firebase Cloud Messaging Service Worker
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyCe-UiH-tAdsalwqZqpMjd4w1mci509aT4",
    authDomain: "ai-school360.firebaseapp.com",
    projectId: "ai-school360",
    storageBucket: "ai-school360.firebasestorage.app",
    messagingSenderId: "224285030074",
    appId: "1:224285030074:web:e53896e81e4e98ad07b483"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    console.log('📢 [Service Worker] Background message received:', payload);

    const notificationTitle = payload.notification?.title || 'New Update';
    const notificationOptions = {
        body: payload.notification?.body || 'You have a new notification',
        icon: '/logo.png',
        badge: '/logo.png',
        tag: payload.data?.type || 'general',
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: {
            url: payload.data?.url || '/',
            type: payload.data?.type || 'general',
            timestamp: Date.now()
        },
        actions: [
            {
                action: 'view',
                title: 'View',
                icon: '/logo.png'
            },
            {
                action: 'close',
                title: 'Dismiss'
            }
        ]
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
    console.log('📱 [Service Worker] Notification clicked:', event.notification.tag);

    event.notification.close();

    if (event.action === 'view' || !event.action) {
        const urlToOpen = event.notification.data?.url || '/';

        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true })
                .then((clientList) => {
                    // Check if there's already a window/tab open
                    for (const client of clientList) {
                        if (client.url.includes(self.location.origin) && 'focus' in client) {
                            client.postMessage({
                                type: 'NOTIFICATION_CLICKED',
                                data: event.notification.data
                            });
                            return client.focus();
                        }
                    }
                    // If no window is open, open a new one
                    if (clients.openWindow) {
                        return clients.openWindow(urlToOpen);
                    }
                })
        );
    }
});

console.log('✅ [Service Worker] Firebase Messaging Service Worker loaded');
