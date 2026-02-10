# Real-time Notifications & Push Notifications Setup

This document explains how to configure and use the real-time notifications system in AI School 360.

## 🚀 Features Implemented

### 1. **Real-time Updates (Without Refresh)**
- ✅ Notices update automatically when admin/teacher posts
- ✅ Homework updates automatically when teacher assigns
- ✅ Messages update automatically when sent
- ✅ Notification sound plays for new updates
- ✅ "NEW" badge shows on fresh notifications

### 2. **Background Push Notifications**
- ✅ Works even when PWA app is closed
- ✅ Uses Firebase Cloud Messaging (FCM)
- ✅ Shows browser notifications
- ✅ Plays notification sound
- ✅ Vibration support on mobile

## 📋 Setup Instructions

### Step 1: Generate VAPID Key in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **ai-school360**
3. Click **Settings (⚙️)** > **Project settings**
4. Go to **Cloud Messaging** tab
5. Scroll to **Web Push certificates** section
6. Click **Generate key pair**
7. Copy the generated key

### Step 2: Update VAPID Key

Open `src/lib/notifications.ts` and replace `YOUR_VAPID_KEY_HERE` with your actual VAPID key:

```typescript
const VAPID_KEY = 'YOUR_ACTUAL_VAPID_KEY_FROM_FIREBASE';
```

### Step 3: Add Notification Sound

1. Download or create a notification sound (`.mp3` format)
2. Place it in the `public` folder as `notification.mp3`
3. Recommended: Short, pleasant sound (1-2 seconds)

**Free notification sounds:**
- https://notificationsounds.com/
- https://mixkit.co/free-sound-effects/notification/

### Step 4: Update Service Worker Registration

The service worker is already configured in `public/firebase-messaging-sw.js`. 

Make sure your `vite.config.ts` or build process copies this file to the build output.

### Step 5: Test Notifications

1. **Start development server:**
   ```bash
   npm run dev
   ```

2. **Open Parent Dashboard**
   - Log in as a parent
   - You'll see a browser notification permission popup
   - Click **Allow**

3. **Test real-time updates:**
   - Open another browser window
   - Log in as Admin/Teacher
   - Post a notice or assign homework
   - Check parent dashboard - it should update automatically with sound!

4. **Test background notifications:**
   - Close the parent's browser tab completely
   - Post a notice/homework as admin
   - Parent should receive a browser notification even with app closed

## 🔧 How It Works

### Real-time Updates (Firestore Listeners)

```typescript
// Custom hook: src/hooks/useRealtimeUpdates.ts
const realtimeUpdates = useRealtimeUpdates({
  userId: user?.id,
  userRole: 'PARENT',
  studentClass: studentData?.class,
  section: studentData?.section,
  schoolId: user?.schoolId,
  enabled: true
});

// Access data:
realtimeUpdates.notices      // Real-time notices
realtimeUpdates.homework      // Real-time homework
realtimeUpdates.messages      // Real-time messages
realtimeUpdates.newUpdateCount // Count of new items
```

### Background Notifications (FCM)

1. **Permission Request:** User grants notification permission
2. **Token Generation:** FCM token is generated and saved to Firestore
3. **Server Side:** When admin/teacher posts, server sends FCM notification
4. **Service Worker:** Receives notification even when app is closed
5. **User sees:** Browser notification with sound and vibration

## 📱 Sending Notifications (Server Side)

To send push notifications from your backend, use Firebase Admin SDK:

```javascript
// Example: Send notification when homework is posted
const admin = require('firebase-admin');

async function sendHomeworkNotification(studentIds, homework) {
  // Get FCM tokens for all parents
  const tokensSnapshot = await admin.firestore()
    .collection('fcm_tokens')
    .where('userId', 'in', studentIds)
    .get();
  
  const tokens = tokensSnapshot.docs.map(doc => doc.data().token);
  
  // Send notification
  const message = {
    notification: {
      title: 'New Homework Assigned',
      body: `${homework.subject}: ${homework.title}`
    },
    data: {
      type: 'homework',
      homeworkId: homework.id,
      url: '/parent-dashboard'
    },
    tokens: tokens
  };
  
  const response = await admin.messaging().sendMulticast(message);
  console.log('Sent notifications:', response.successCount);
}
```

## 🎨 Customization

### Change Notification Sound

Replace `public/notification.mp3` with your preferred sound file.

### Adjust Notification Badge Styling

Edit the "NEW" badge in `src/pages/portals/ParentDashboard.tsx`:

```tsx
<span style={{ 
  background: '#fbbf24',  // Change color
  color: '#78350f',       // Change text color
  // ... other styles
}}>NEW</span>
```

### Disable Sound for Specific Notifications

Modify `src/hooks/useRealtimeUpdates.ts`:

```typescript
// Remove or comment out this line to disable sound:
playNotificationSound();
```

## 🐛 Troubleshooting

### Notifications not working?

1. **Check browser permissions:**
   - Chrome: `chrome://settings/content/notifications`
   - Firefox: Settings > Privacy & Security > Permissions > Notifications

2. **Check service worker:**
   - Open DevTools > Application > Service Workers
   - Verify `firebase-messaging-sw.js` is registered

3. **Check console logs:**
   - Look for errors in browser console
   - Check for "Firebase Messaging initialized successfully"

4. **VAPID key issues:**
   - Ensure VAPID key is correctly set in `src/lib/notifications.ts`
   - Generate a new key if needed

### Sound not playing?

1. Check `public/notification.mp3` exists
2. Verify audio file is valid (test in audio player)
3. Check browser autoplay policy (some browsers block autoplay)

## 📊 Database Structure

### FCM Tokens Collection

```
fcm_tokens/{userId}
  ├─ token: "FCM_TOKEN_STRING"
  ├─ userId: "user123"
  ├─ updatedAt: Timestamp
  └─ platform: "web"
```

### Notices Collection

```
notices/{noticeId}
  ├─ title: "Important Notice"
  ├─ content: "Content here..."
  ├─ type: "URGENT" | "GENERAL"
  ├─ target: "Parents" | "All"
  ├─ schoolId: "school123"
  └─ createdAt: Timestamp
```

## 🔐 Security Rules

Ensure Firestore rules allow:
- Users can read their own FCM tokens
- Users can write their own FCM tokens
- Only admins/teachers can create notices/homework

## 🎯 Next Steps

1. **Add email notifications:** Integrate with SendGrid/Mailgun
2. **SMS notifications:** Use Twilio for important alerts
3. **Notification history:** Create a dedicated notifications page
4. **Mark as read:** Track which notifications user has seen
5. **Notification preferences:** Let users choose notification types

## 📞 Support

For issues or questions, contact the development team.

---

**Last Updated:** January 30, 2026
**Version:** 1.0.0
