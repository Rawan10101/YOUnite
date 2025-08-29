const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();

/**
 * Cloud Function to handle event deletion and cleanup
 * Triggered when an event document is deleted
 */
exports.onEventDeleted = functions.firestore
  .document('events/{eventId}')
  .onDelete(async (snap, context) => {
    const eventId = context.params.eventId;
    const eventData = snap.data();
    
    console.log(`Event deleted: ${eventId}, cleaning up related data...`);
    
    const batch = db.batch();
    
    try {
      // 1. Delete associated chat room if it exists
      const chatRoomId = `event_${eventId}`;
      const chatRoomRef = db.collection('chatRooms').doc(chatRoomId);
      const chatRoomDoc = await chatRoomRef.get();
      
      if (chatRoomDoc.exists()) {
        console.log(`Deleting chat room: ${chatRoomId}`);
        
        // Delete all messages in the chat room
        const messagesSnapshot = await chatRoomRef.collection('messages').get();
        messagesSnapshot.docs.forEach(messageDoc => {
          batch.delete(messageDoc.ref);
        });
        
        // Delete the chat room itself
        batch.delete(chatRoomRef);
      }
      
      // 2. Remove event from organization's events array
      if (eventData.organizationId) {
        const orgRef = db.collection('organizations').doc(eventData.organizationId);
        batch.update(orgRef, {
          events: admin.firestore.FieldValue.arrayRemove(eventId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // 3. Delete event-related notifications
      const notificationsSnapshot = await db.collection('notifications')
        .where('eventId', '==', eventId)
        .get();
      
      notificationsSnapshot.docs.forEach(notificationDoc => {
        batch.delete(notificationDoc.ref);
      });
      
      // 4. Delete event-related activities
      const activitiesSnapshot = await db.collection('activities')
        .where('eventId', '==', eventId)
        .get();
      
      activitiesSnapshot.docs.forEach(activityDoc => {
        batch.delete(activityDoc.ref);
      });
      
      // 5. Delete event applications if any
      const applicationsSnapshot = await db.collection('applications')
        .where('eventId', '==', eventId)
        .get();
      
      applicationsSnapshot.docs.forEach(applicationDoc => {
        batch.delete(applicationDoc.ref);
      });
      
      // 6. Remove event from users' registered events
      if (eventData.registeredVolunteers && eventData.registeredVolunteers.length > 0) {
        for (const userId of eventData.registeredVolunteers) {
          const userRef = db.collection('users').doc(userId);
          batch.update(userRef, {
            registeredEvents: admin.firestore.FieldValue.arrayRemove(eventId),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      
      // Execute all deletions
      await batch.commit();
      
      console.log(`Successfully cleaned up all data for event: ${eventId}`);
      
      // 7. Delete event image from Storage if it exists
      if (eventData.imageUrl && eventData.hasCustomImage) {
        try {
          const bucket = admin.storage().bucket();
          const imagePath = eventData.imageUrl.split('/o/')[1].split('?')[0];
          const decodedPath = decodeURIComponent(imagePath);
          await bucket.file(decodedPath).delete();
          console.log(`Deleted event image: ${decodedPath}`);
        } catch (imageError) {
          console.error('Error deleting event image:', imageError);
          // Don't fail the entire operation if image deletion fails
        }
      }
      
    } catch (error) {
      console.error('Error cleaning up event data:', error);
      throw new functions.https.HttpsError('internal', 'Failed to cleanup event data');
    }
  });

/**
 * Cloud Function for chat administration operations
 * Allows organization admins to moderate their event chats
 */
exports.chatAdminOperation = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  
  const { operation, chatRoomId, messageId, participantId } = data;
  const adminUserId = context.auth.uid;
  
  try {
    // Verify the chat room exists and user is admin
    const chatRoomRef = db.collection('chatRooms').doc(chatRoomId);
    const chatRoomDoc = await chatRoomRef.get();
    
    if (!chatRoomDoc.exists()) {
      throw new functions.https.HttpsError('not-found', 'Chat room not found');
    }
    
    const chatRoomData = chatRoomDoc.data();
    
    // Verify user is admin of this chat room
    if (chatRoomData.adminId !== adminUserId) {
      throw new functions.https.HttpsError('permission-denied', 'User is not admin of this chat room');
    }
    
    switch (operation) {
      case 'deleteMessage':
        if (!messageId) {
          throw new functions.https.HttpsError('invalid-argument', 'Message ID is required');
        }
        
        // Delete the message
        const messageRef = chatRoomRef.collection('messages').doc(messageId);
        const messageDoc = await messageRef.get();
        
        if (!messageDoc.exists()) {
          throw new functions.https.HttpsError('not-found', 'Message not found');
        }
        
        await messageRef.delete();
        
        // Log the admin action
        await db.collection('adminActions').add({
          adminId: adminUserId,
          action: 'deleteMessage',
          chatRoomId: chatRoomId,
          messageId: messageId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, message: 'Message deleted successfully' };
        
      case 'removeParticipant':
        if (!participantId) {
          throw new functions.https.HttpsError('invalid-argument', 'Participant ID is required');
        }
        
        // Remove participant from chat room
        await chatRoomRef.update({
          participants: admin.firestore.FieldValue.arrayRemove(participantId),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Log the admin action
        await db.collection('adminActions').add({
          adminId: adminUserId,
          action: 'removeParticipant',
          chatRoomId: chatRoomId,
          participantId: participantId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
        
        return { success: true, message: 'Participant removed successfully' };
        
      default:
        throw new functions.https.HttpsError('invalid-argument', 'Invalid operation');
    }
    
  } catch (error) {
    console.error('Chat admin operation error:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Internal server error');
  }
});

/**
 * Cloud Function to handle user mentions in chat
 * Sends notifications when users are mentioned
 */
exports.onChatMessage = functions.firestore
  .document('chatRooms/{chatRoomId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const messageData = snap.data();
    const chatRoomId = context.params.chatRoomId;
    const messageId = context.params.messageId;
    
    try {
      // Extract mentions from message text
      const mentionRegex = /@(\w+)/g;
      const mentions = [];
      let match;
      
      while ((match = mentionRegex.exec(messageData.text)) !== null) {
        mentions.push(match[1]);
      }
      
      if (mentions.length === 0) {
        return null; // No mentions found
      }
      
      // Get chat room data
      const chatRoomRef = db.collection('chatRooms').doc(chatRoomId);
      const chatRoomDoc = await chatRoomRef.get();
      
      if (!chatRoomDoc.exists()) {
        return null;
      }
      
      const chatRoomData = chatRoomDoc.data();
      const batch = db.batch();
      
      // Create notifications for mentioned users
      for (const mention of mentions) {
        // Find user by display name or username
        const usersSnapshot = await db.collection('users')
          .where('displayName', '==', mention)
          .limit(1)
          .get();
        
        if (!usersSnapshot.empty) {
          const mentionedUser = usersSnapshot.docs[0];
          const mentionedUserId = mentionedUser.id;
          
          // Check if mentioned user is participant in the chat
          if (chatRoomData.participants.includes(mentionedUserId)) {
            const notificationRef = db.collection('notifications').doc();
            batch.set(notificationRef, {
              userId: mentionedUserId,
              type: 'mention',
              title: 'You were mentioned in a chat',
              message: `${messageData.senderName} mentioned you in ${chatRoomData.name}`,
              chatRoomId: chatRoomId,
              messageId: messageId,
              senderId: messageData.senderId,
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        }
      }
      
      await batch.commit();
      
    } catch (error) {
      console.error('Error processing chat mentions:', error);
    }
  });

/**
 * Cloud Function to clean up old chat messages
 * Runs daily to delete messages older than 30 days
 */
exports.cleanupOldMessages = functions.pubsub
  .schedule('0 2 * * *') // Run daily at 2 AM
  .timeZone('UTC')
  .onRun(async (context) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    try {
      const chatRoomsSnapshot = await db.collection('chatRooms').get();
      
      for (const chatRoomDoc of chatRoomsSnapshot.docs) {
        const messagesSnapshot = await chatRoomDoc.ref
          .collection('messages')
          .where('createdAt', '<', thirtyDaysAgo)
          .get();
        
        const batch = db.batch();
        let batchCount = 0;
        
        for (const messageDoc of messagesSnapshot.docs) {
          batch.delete(messageDoc.ref);
          batchCount++;
          
          // Firestore batch limit is 500 operations
          if (batchCount >= 500) {
            await batch.commit();
            batchCount = 0;
          }
        }
        
        if (batchCount > 0) {
          await batch.commit();
        }
        
        console.log(`Cleaned up ${messagesSnapshot.docs.length} old messages from chat room: ${chatRoomDoc.id}`);
      }
      
    } catch (error) {
      console.error('Error cleaning up old messages:', error);
    }
  });

/**
 * Cloud Function to handle event registration
 * Automatically adds users to event chat when they register
 */
exports.onEventRegistration = functions.firestore
  .document('events/{eventId}')
  .onUpdate(async (change, context) => {
    const eventId = context.params.eventId;
    const beforeData = change.before.data();
    const afterData = change.after.data();
    
    // Check if registeredVolunteers array changed
    const beforeVolunteers = beforeData.registeredVolunteers || [];
    const afterVolunteers = afterData.registeredVolunteers || [];
    
    // Find newly registered volunteers
    const newVolunteers = afterVolunteers.filter(volunteer => !beforeVolunteers.includes(volunteer));
    
    // Find unregistered volunteers
    const removedVolunteers = beforeVolunteers.filter(volunteer => !afterVolunteers.includes(volunteer));
    
    if (newVolunteers.length === 0 && removedVolunteers.length === 0) {
      return null; // No changes in registration
    }
    
    // Only proceed if event has chat enabled
    if (!afterData.withChat) {
      return null;
    }
    
    try {
      const chatRoomId = `event_${eventId}`;
      const chatRoomRef = db.collection('chatRooms').doc(chatRoomId);
      const chatRoomDoc = await chatRoomRef.get();
      
      if (chatRoomDoc.exists()) {
        const updates = {};
        
        // Add new volunteers to chat participants
        if (newVolunteers.length > 0) {
          updates.participants = admin.firestore.FieldValue.arrayUnion(...newVolunteers);
        }
        
        // Remove unregistered volunteers from chat participants
        if (removedVolunteers.length > 0) {
          updates.participants = admin.firestore.FieldValue.arrayRemove(...removedVolunteers);
        }
        
        if (Object.keys(updates).length > 0) {
          updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
          await chatRoomRef.update(updates);
          
          console.log(`Updated chat room participants for event ${eventId}: +${newVolunteers.length}, -${removedVolunteers.length}`);
        }
      }
      
    } catch (error) {
      console.error('Error updating chat room participants:', error);
    }
  });

