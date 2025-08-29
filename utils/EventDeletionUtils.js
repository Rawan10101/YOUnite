import {
    arrayRemove,
    collection,
    doc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

/**
 * Client-side event deletion with cleanup
 * This function attempts to clean up related data when an event is deleted
 * Note: Some operations may fail due to security rules or permissions
 */
export const deleteEventWithCleanup = async (eventId, organizationId, currentUserId) => {
  // Verify user has permission to delete (must be the organization owner)
  if (currentUserId !== organizationId) {
    throw new Error('Only the event organizer can delete this event');
  }

  const batch = writeBatch(db);
  const cleanupResults = {
    event: false,
    chatRoom: false,
    messages: 0,
    userUpdates: 0,
    notifications: 0,
    activities: 0,
    images: 0,
    errors: []
  };

  try {
    // 1. Get event data first to access registered volunteers
    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists()) {
      throw new Error('Event not found');
    }

    const eventData = eventDoc.data();
    const registeredVolunteers = eventData.registeredVolunteers || [];

    // 2. Delete chat room and messages if exists
    try {
      const chatRoomId = `event_${eventId}`;
      const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
      
      // Delete all messages in the chat room
      const messagesQuery = query(collection(db, 'chatRooms', chatRoomId, 'messages'));
      const messagesSnapshot = await getDocs(messagesQuery);
      
      messagesSnapshot.docs.forEach(messageDoc => {
        batch.delete(messageDoc.ref);
        cleanupResults.messages++;
      });

      // Delete chat room
      batch.delete(chatRoomRef);
      cleanupResults.chatRoom = true;
    } catch (error) {
      cleanupResults.errors.push(`Chat cleanup error: ${error.message}`);
    }

    // 3. Remove event from registered volunteers' profiles
    for (const volunteerId of registeredVolunteers) {
      try {
        const userRef = doc(db, 'users', volunteerId);
        batch.update(userRef, {
          registeredEvents: arrayRemove(eventId),
          updatedAt: serverTimestamp()
        });
        cleanupResults.userUpdates++;
      } catch (error) {
        cleanupResults.errors.push(`User update error for ${volunteerId}: ${error.message}`);
      }
    }

    // 4. Delete event-related notifications (best effort)
    try {
      const notificationsQuery = query(
        collection(db, 'notifications'),
        where('eventId', '==', eventId)
      );
      const notificationsSnapshot = await getDocs(notificationsQuery);
      
      notificationsSnapshot.docs.forEach(notificationDoc => {
        batch.delete(notificationDoc.ref);
        cleanupResults.notifications++;
      });
    } catch (error) {
      cleanupResults.errors.push(`Notifications cleanup error: ${error.message}`);
    }

    // 5. Delete event-related activities (best effort)
    try {
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('eventId', '==', eventId)
      );
      const activitiesSnapshot = await getDocs(activitiesQuery);
      
      activitiesSnapshot.docs.forEach(activityDoc => {
        batch.delete(activityDoc.ref);
        cleanupResults.activities++;
      });
    } catch (error) {
      cleanupResults.errors.push(`Activities cleanup error: ${error.message}`);
    }

    // 6. Delete the event itself
    batch.delete(eventRef);
    cleanupResults.event = true;

    // Execute all batch operations
    await batch.commit();

    // 7. Delete event images from storage (separate operation)
    try {
      if (eventData.imageUrl && eventData.hasCustomImage) {
        const imageRef = ref(storage, `events/${eventId}/image`);
        await deleteObject(imageRef);
        cleanupResults.images++;
      }
    } catch (error) {
      cleanupResults.errors.push(`Image deletion error: ${error.message}`);
    }

    return cleanupResults;

  } catch (error) {
    cleanupResults.errors.push(`Main deletion error: ${error.message}`);
    throw error;
  }
};

/**
 * Remove volunteer from event and related cleanup
 */
export const removeVolunteerFromEvent = async (eventId, volunteerId, organizationId, currentUserId) => {
  // Verify user has permission (must be the organization owner)
  if (currentUserId !== organizationId) {
    throw new Error('Only the event organizer can remove volunteers');
  }

  const batch = writeBatch(db);
  const cleanupResults = {
    eventUpdate: false,
    userUpdate: false,
    chatUpdate: false,
    errors: []
  };

  try {
    // 1. Remove from event registrations
    const eventRef = doc(db, 'events', eventId);
    batch.update(eventRef, {
      registeredVolunteers: arrayRemove(volunteerId),
      updatedAt: serverTimestamp()
    });
    cleanupResults.eventUpdate = true;

    // 2. Remove from user's registered events
    const userRef = doc(db, 'users', volunteerId);
    batch.update(userRef, {
      registeredEvents: arrayRemove(eventId),
      updatedAt: serverTimestamp()
    });
    cleanupResults.userUpdate = true;

    // 3. Remove from chat participants
    try {
      const chatRoomId = `event_${eventId}`;
      const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
      batch.update(chatRoomRef, {
        participants: arrayRemove(volunteerId),
        updatedAt: serverTimestamp()
      });
      cleanupResults.chatUpdate = true;
    } catch (error) {
      cleanupResults.errors.push(`Chat update error: ${error.message}`);
    }

    // Execute batch operations
    await batch.commit();

    return cleanupResults;

  } catch (error) {
    cleanupResults.errors.push(`Volunteer removal error: ${error.message}`);
    throw error;
  }
};

/**
 * Clean up old chat messages (can be called periodically)
 */
export const cleanupOldMessages = async (chatRoomId, daysOld = 30) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  try {
    const messagesQuery = query(
      collection(db, 'chatRooms', chatRoomId, 'messages'),
      where('createdAt', '<', cutoffDate)
    );
    
    const messagesSnapshot = await getDocs(messagesQuery);
    const batch = writeBatch(db);
    let deletedCount = 0;

    messagesSnapshot.docs.forEach(messageDoc => {
      batch.delete(messageDoc.ref);
      deletedCount++;
    });

    if (deletedCount > 0) {
      await batch.commit();
    }

    return { deletedCount, errors: [] };

  } catch (error) {
    return { deletedCount: 0, errors: [error.message] };
  }
};

/**
 * Sync chat participants with event registrations
 */
export const syncChatParticipants = async (eventId, organizationId, currentUserId) => {
  // Verify user has permission (must be the organization owner)
  if (currentUserId !== organizationId) {
    throw new Error('Only the event organizer can sync chat participants');
  }

  try {
    // Get current event registrations
    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await eventRef.get();
    
    if (!eventDoc.exists()) {
      throw new Error('Event not found');
    }

    const eventData = eventDoc.data();
    const registeredVolunteers = eventData.registeredVolunteers || [];
    
    // Include the organization in participants for moderation
    const expectedParticipants = [...registeredVolunteers, organizationId];

    // Update chat room participants
    const chatRoomId = `event_${eventId}`;
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    
    await updateDoc(chatRoomRef, {
      participants: expectedParticipants,
      updatedAt: serverTimestamp()
    });

    return { 
      success: true, 
      participantCount: expectedParticipants.length,
      errors: [] 
    };

  } catch (error) {
    return { 
      success: false, 
      participantCount: 0,
      errors: [error.message] 
    };
  }
};

/**
 * Create mention notification (client-side)
 */
export const createMentionNotification = async (mentionedUserId, senderUserId, chatRoomId, chatTitle, messageText) => {
  try {
    const notificationRef = collection(db, 'notifications');
    await addDoc(notificationRef, {
      userId: mentionedUserId,
      type: 'mention',
      title: 'You were mentioned in a chat',
      message: `You were mentioned in ${chatTitle}`,
      chatRoomId: chatRoomId,
      senderId: senderUserId,
      messagePreview: messageText.substring(0, 100),
      read: false,
      createdAt: serverTimestamp()
    });

    return { success: true, error: null };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

