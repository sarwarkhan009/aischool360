// Firebase Cloud Functions for sending push notifications
// Deploy these functions to automatically send notifications when data changes

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

/**
 * Send notification when a new notice is posted
 */
export const onNoticeCreated = functions.firestore
    .document('notices/{noticeId}')
    .onCreate(async (snap, context) => {
        const notice = snap.data();
        const noticeId = context.params.noticeId;

        console.log('📢 New notice created:', noticeId);

        // Determine target users based on notice.target
        let targetRole: string[] = [];

        if (notice.target === 'All' || notice.target === 'All Students') {
            targetRole = ['PARENT', 'STUDENT'];
        } else if (notice.target === 'Parents') {
            targetRole = ['PARENT'];
        } else if (notice.target === 'Students') {
            targetRole = ['STUDENT'];
        } else if (notice.target === 'Teachers') {
            targetRole = ['TEACHER'];
        }

        if (targetRole.length === 0) {
            console.log('No target role found, skipping notification');
            return;
        }

        try {
            // Get all users matching the target roles and school
            const usersSnapshot = await admin.firestore()
                .collection('users')
                .where('schoolId', '==', notice.schoolId)
                .where('role', 'in', targetRole)
                .get();

            const userIds = usersSnapshot.docs.map(doc => doc.id);

            if (userIds.length === 0) {
                console.log('No users found to notify');
                return;
            }

            // Get FCM tokens for these users
            const tokensSnapshot = await admin.firestore()
                .collection('fcm_tokens')
                .where('userId', 'in', userIds)
                .get();

            const tokens = tokensSnapshot.docs
                .map(doc => doc.data().token)
                .filter(token => token); // Remove null/undefined

            if (tokens.length === 0) {
                console.log('No FCM tokens found');
                return;
            }

            // Prepare notification payload
            const payload = {
                notification: {
                    title: notice.type === 'URGENT' ? `🚨 ${notice.title}` : `📢 ${notice.title}`,
                    body: notice.content?.substring(0, 100) || 'New notice posted',
                    icon: '/logo.png',
                    badge: '/logo.png'
                },
                data: {
                    type: 'notice',
                    noticeId: noticeId,
                    url: '/parent-dashboard',
                    timestamp: Date.now().toString()
                }
            };

            // Send to all tokens
            const response = await admin.messaging().sendToDevice(tokens, payload);

            console.log(`✅ Sent ${response.successCount} notifications, ${response.failureCount} failed`);

            // Clean up invalid tokens
            const tokensToRemove: string[] = [];
            response.results.forEach((result, index) => {
                const error = result.error;
                if (error) {
                    console.error('Failure sending notification to', tokens[index], error);
                    if (error.code === 'messaging/invalid-registration-token' ||
                        error.code === 'messaging/registration-token-not-registered') {
                        tokensToRemove.push(tokens[index]);
                    }
                }
            });

            // Remove invalid tokens from database
            if (tokensToRemove.length > 0) {
                const batch = admin.firestore().batch();
                tokensToRemove.forEach(token => {
                    const tokenDoc = tokensSnapshot.docs.find(doc => doc.data().token === token);
                    if (tokenDoc) {
                        batch.delete(tokenDoc.ref);
                    }
                });
                await batch.commit();
                console.log(`🧹 Cleaned up ${tokensToRemove.length} invalid tokens`);
            }

            return response;
        } catch (error) {
            console.error('Error sending notice notification:', error);
            throw error;
        }
    });

/**
 * Send notification when homework is assigned
 */
export const onHomeworkCreated = functions.firestore
    .document('homework/{homeworkId}')
    .onCreate(async (snap, context) => {
        const homework = snap.data();
        const homeworkId = context.params.homeworkId;

        console.log('📚 New homework created:', homeworkId);

        try {
            // Get all students in the target class and section
            let studentsQuery = admin.firestore()
                .collection('students')
                .where('schoolId', '==', homework.schoolId)
                .where('class', '==', homework.class);

            // Filter by section if specified
            if (homework.section && homework.section !== 'All Sections') {
                studentsQuery = studentsQuery.where('section', '==', homework.section);
            }

            const studentsSnapshot = await studentsQuery.get();
            const studentIds = studentsSnapshot.docs.map(doc => doc.id);

            if (studentIds.length === 0) {
                console.log('No students found for this homework');
                return;
            }

            // Get parent users for these students
            // Assuming parents are linked to students via student.parentId or similar
            // Adjust this query based on your data structure
            const parentsSnapshot = await admin.firestore()
                .collection('users')
                .where('role', '==', 'PARENT')
                .where('schoolId', '==', homework.schoolId)
                .get();

            // Filter parents who have children in this class
            const relevantParentIds = parentsSnapshot.docs
                .filter(doc => {
                    const parentData = doc.data();
                    // Adjust this logic based on how parents are linked to students
                    return studentIds.includes(doc.id); // Simplified - adjust as needed
                })
                .map(doc => doc.id);

            if (relevantParentIds.length === 0) {
                console.log('No parents found to notify');
                return;
            }

            // Get FCM tokens
            const tokensSnapshot = await admin.firestore()
                .collection('fcm_tokens')
                .where('userId', 'in', relevantParentIds)
                .get();

            const tokens = tokensSnapshot.docs
                .map(doc => doc.data().token)
                .filter(token => token);

            if (tokens.length === 0) {
                console.log('No FCM tokens found');
                return;
            }

            // Prepare notification
            const payload = {
                notification: {
                    title: '📝 New Homework Assigned',
                    body: `${homework.subject}: ${homework.title}`,
                    icon: '/logo.png',
                    badge: '/logo.png'
                },
                data: {
                    type: 'homework',
                    homeworkId: homeworkId,
                    url: '/parent-dashboard',
                    timestamp: Date.now().toString()
                }
            };

            // Send notification
            const response = await admin.messaging().sendToDevice(tokens, payload);

            console.log(`✅ Sent ${response.successCount} homework notifications`);

            return response;
        } catch (error) {
            console.error('Error sending homework notification:', error);
            throw error;
        }
    });

/**
 * Send notification when a message is sent
 */
export const onMessageCreated = functions.firestore
    .document('messages/{messageId}')
    .onCreate(async (snap, context) => {
        const message = snap.data();
        const messageId = context.params.messageId;

        console.log('💬 New message created:', messageId);

        try {
            const recipientId = message.recipientId;

            if (!recipientId) {
                console.log('No recipient specified');
                return;
            }

            // Get recipient's FCM token
            const tokenDoc = await admin.firestore()
                .collection('fcm_tokens')
                .doc(recipientId)
                .get();

            if (!tokenDoc.exists) {
                console.log('No FCM token found for recipient');
                return;
            }

            const token = tokenDoc.data()?.token;

            if (!token) {
                console.log('Invalid token');
                return;
            }

            // Get sender info
            const senderDoc = await admin.firestore()
                .collection('users')
                .doc(message.senderId)
                .get();

            const senderName = senderDoc.exists ? senderDoc.data()?.name : 'Someone';

            // Prepare notification
            const payload = {
                notification: {
                    title: `💬 Message from ${senderName}`,
                    body: message.subject || message.content?.substring(0, 100) || 'New message',
                    icon: '/logo.png',
                    badge: '/logo.png'
                },
                data: {
                    type: 'message',
                    messageId: messageId,
                    senderId: message.senderId,
                    url: '/parent-dashboard',
                    timestamp: Date.now().toString()
                }
            };

            // Send notification
            const response = await admin.messaging().sendToDevice(token, payload);

            console.log('✅ Message notification sent');

            return response;
        } catch (error) {
            console.error('Error sending message notification:', error);
            throw error;
        }
    });

/**
 * Clean up FCM token when user deletes their account
 */
export const onUserDeleted = functions.firestore
    .document('users/{userId}')
    .onDelete(async (snap, context) => {
        const userId = context.params.userId;

        try {
            await admin.firestore()
                .collection('fcm_tokens')
                .doc(userId)
                .delete();

            console.log(`✅ Cleaned up FCM token for deleted user: ${userId}`);
        } catch (error) {
            console.error('Error cleaning up FCM token:', error);
        }
    });
