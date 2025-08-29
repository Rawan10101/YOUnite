import {
    addDoc,
    arrayRemove,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { deleteObject, ref } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

/**
 * IMPROVED: Enhanced error handling and logging utility
 */
export class FirebaseErrorHandler {
  static async logError(userId, error, context = {}) {
    try {
      const errorLogRef = collection(db, 'errorLogs');
      await addDoc(errorLogRef, {
        userId: userId,
        error: error.message || error.toString(),
        code: error.code || 'unknown',
        context: context,
        timestamp: serverTimestamp(),
        userAgent: navigator.userAgent || 'unknown',
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }
  }

  static getErrorMessage(error) {
    const errorMessages = {
      'permission-denied': 'You do not have permission to perform this action. Please check your account status.',
      'not-found': 'The requested resource was not found. It may have been deleted.',
      'unavailable': 'Service temporarily unavailable. Please check your internet connection and try again.',
      'deadline-exceeded': 'Request timed out. Please try again.',
      'already-exists': 'This resource already exists.',
      'failed-precondition': 'Operation failed due to invalid conditions.',
      'invalid-argument': 'Invalid data provided. Please check your input.',
      'resource-exhausted': 'Service quota exceeded. Please try again later.',
      'unauthenticated': 'Authentication required. Please log in.',
      'cancelled': 'Operation was cancelled.',
      'data-loss': 'Data corruption detected. Please contact support.',
      'internal': 'Internal server error. Please try again later.',
      'out-of-range': 'Value out of valid range.',
      'unimplemented': 'Feature not implemented.',
    };

    if (error.code && errorMessages[error.code]) {
      return errorMessages[error.code];
    }

    if (error.message) {
      if (error.message.includes('user document')) {
        return 'There was an issue with your user profile. Please try logging out and back in.';
      }
      if (error.message.includes('network')) {
        return 'Network error. Please check your internet connection.';
      }
      if (error.message.includes('offline')) {
        return 'You appear to be offline. Please check your internet connection.';
      }
    }

    return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * IMPROVED: Enhanced user document management with error handling
 */
export const ensureUserDocumentExists = async (userId, userData = {}) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('User document does not exist, creating it...');
      
      // Create user document with default structure
      const defaultUserData = {
        uid: userId,
        registeredEvents: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        role: 'volunteer', // Default role
        ...userData // Merge any additional user data
      };
      
      await setDoc(userRef, defaultUserData);
      console.log('User document created successfully');
      return { success: true, created: true };
    }
    
    return { success: true, created: false };
  } catch (error) {
    console.error('Error ensuring user document exists:', error);
    await FirebaseErrorHandler.logError(userId, error, { 
      operation: 'ensureUserDocumentExists',
      userData 
    });
    throw new Error(`Failed to create user document: ${FirebaseErrorHandler.getErrorMessage(error)}`);
  }
};

/**
 * IMPROVED: Enhanced chat room management with error handling
 */
export const ensureChatRoomExists = async (eventId, eventData, userId, isOrganizer = false) => {
  try {
    const chatRoomId = `event_${eventId}`;
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    const chatRoomDoc = await getDoc(chatRoomRef);
    
    if (!chatRoomDoc.exists()) {
      console.log('Chat room does not exist, creating it...');
      
      // Determine initial participants
      const initialParticipants = [userId];
      
      // Include organization in participants for moderation
      if (eventData.organizationId && eventData.organizationId !== userId) {
        initialParticipants.push(eventData.organizationId);
      }
      
      const chatRoomData = {
        eventId: eventId,
        isEventChat: true,
        participants: initialParticipants,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
        lastMessageTime: null,
      };
      
      await setDoc(chatRoomRef, chatRoomData);
      console.log('Chat room created successfully with participants:', initialParticipants);
      return { success: true, created: true };
    } else {
      // Chat room exists, ensure user is in participants if they should be
      const currentParticipants = chatRoomDoc.data().participants || [];
      if (!currentParticipants.includes(userId)) {
        await updateDoc(chatRoomRef, {
          participants: arrayUnion(userId),
          updatedAt: serverTimestamp(),
        });
        console.log('User added to existing chat participants');
        return { success: true, created: false, added: true };
      }
      return { success: true, created: false, added: false };
    }
  } catch (error) {
    console.error('Error ensuring chat room exists:', error);
    await FirebaseErrorHandler.logError(userId, error, { 
      operation: 'ensureChatRoomExists',
      eventId,
      isOrganizer 
    });
    // Don't throw error for chat room issues - registration should still work
    return { success: false, error: FirebaseErrorHandler.getErrorMessage(error) };
  }
};

/**
 * IMPROVED: Enhanced event registration with comprehensive error handling
 */
export const handleEventRegistration = async (eventId, userId, userData, isRegistered = false) => {
  const results = {
    success: false,
    userDocumentEnsured: false,
    eventUpdated: false,
    userUpdated: false,
    chatUpdated: false,
    errors: []
  };

  try {
    console.log(`Starting ${isRegistered ? 'unregistration' : 'registration'} for event ${eventId}...`);
    
    // STEP 1: Ensure user document exists
    try {
      const userResult = await ensureUserDocumentExists(userId, userData);
      results.userDocumentEnsured = userResult.success;
    } catch (error) {
      results.errors.push(`User document error: ${error.message}`);
      throw error;
    }

    // STEP 2: Get event data
    const eventRef = doc(db, 'events', eventId);
    const eventDoc = await getDoc(eventRef);
    
    if (!eventDoc.exists()) {
      throw new Error('Event not found. It may have been deleted.');
    }

    const eventData = eventDoc.data();
    
    // STEP 3: Validate registration conditions
    if (!isRegistered) {
      // Check if event is full
      const currentRegistrations = eventData.registeredVolunteers?.length || 0;
      const maxVolunteers = eventData.maxVolunteers || 0;
      
      if (currentRegistrations >= maxVolunteers) {
        throw new Error('Event is at maximum capacity.');
      }
      
      // Check if event has passed
      const eventDate = eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date);
      if (eventDate < new Date()) {
        throw new Error('This event has already occurred.');
      }
    }

    // STEP 4: Prepare batch operations
    const batch = writeBatch(db);
    const userRef = doc(db, 'users', userId);
    
    if (isRegistered) {
      // UNREGISTER
      batch.update(eventRef, {
        registeredVolunteers: arrayRemove(userId),
        updatedAt: serverTimestamp(),
      });

      batch.update(userRef, {
        registeredEvents: arrayRemove(eventId),
        updatedAt: serverTimestamp(),
      });
    } else {
      // REGISTER
      batch.update(eventRef, {
        registeredVolunteers: arrayUnion(userId),
        updatedAt: serverTimestamp(),
      });

      batch.update(userRef, {
        registeredEvents: arrayUnion(eventId),
        updatedAt: serverTimestamp(),
      });
    }

    // STEP 5: Execute batch operations
    await batch.commit();
    results.eventUpdated = true;
    results.userUpdated = true;
    
    console.log(`${isRegistered ? 'Unregistration' : 'Registration'} completed successfully`);

    // STEP 6: Handle chat room (non-critical)
    if (eventData.withChat) {
      try {
        if (isRegistered) {
          // Remove from chat participants
          const chatRoomId = `event_${eventId}`;
          const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
          const chatRoomDoc = await getDoc(chatRoomRef);
          
          if (chatRoomDoc.exists()) {
            await updateDoc(chatRoomRef, {
              participants: arrayRemove(userId),
              updatedAt: serverTimestamp(),
            });
            results.chatUpdated = true;
            console.log('User removed from chat participants');
          }
        } else {
          // Add to chat participants
          const chatResult = await ensureChatRoomExists(eventId, eventData, userId, false);
          results.chatUpdated = chatResult.success;
          if (!chatResult.success) {
            results.errors.push(`Chat setup warning: ${chatResult.error}`);
          }
        }
      } catch (chatError) {
        console.warn('Chat operation failed:', chatError);
        results.errors.push(`Chat operation failed: ${FirebaseErrorHandler.getErrorMessage(chatError)}`);
        // Don't fail the entire operation for chat issues
      }
    }

    results.success = true;
    return results;

  } catch (error) {
    console.error('Registration/Unregistration error:', error);
    
    // Log the error
    await FirebaseErrorHandler.logError(userId, error, { 
      operation: isRegistered ? 'unregister' : 'register',
      eventId,
      results 
    });
    
    results.errors.push(FirebaseErrorHandler.getErrorMessage(error));
    throw new Error(FirebaseErrorHandler.getErrorMessage(error));
  }
};

/**
 * IMPROVED: Enhanced event deletion with cleanup and error handling
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
    const eventDoc = await getDoc(eventRef);
    
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
      cleanupResults.errors.push(`Chat cleanup error: ${FirebaseErrorHandler.getErrorMessage(error)}`);
    }

    // 3. Remove event from registered volunteers' profiles
    for (const volunteerId of registeredVolunteers) {
      try {
        // Ensure user document exists before updating
        await ensureUserDocumentExists(volunteerId);
        
        const userRef = doc(db, 'users', volunteerId);
        batch.update(userRef, {
          registeredEvents: arrayRemove(eventId),
          updatedAt: serverTimestamp()
        });
        cleanupResults.userUpdates++;
      } catch (error) {
        cleanupResults.errors.push(`User update error for ${volunteerId}: ${FirebaseErrorHandler.getErrorMessage(error)}`);
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
      cleanupResults.errors.push(`Notifications cleanup error: ${FirebaseErrorHandler.getErrorMessage(error)}`);
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
      cleanupResults.errors.push(`Activities cleanup error: ${FirebaseErrorHandler.getErrorMessage(error)}`);
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
      cleanupResults.errors.push(`Image deletion error: ${FirebaseErrorHandler.getErrorMessage(error)}`);
    }

    // Log successful deletion
    await FirebaseErrorHandler.logError(currentUserId, new Error('Event deleted successfully'), {
      operation: 'deleteEvent',
      eventId,
      cleanupResults
    });

    return cleanupResults;

  } catch (error) {
    cleanupResults.errors.push(`Main deletion error: ${FirebaseErrorHandler.getErrorMessage(error)}`);
    
    // Log the error
    await FirebaseErrorHandler.logError(currentUserId, error, {
      operation: 'deleteEvent',
      eventId,
      cleanupResults
    });
    
    throw error;
  }
};

/**
 * IMPROVED: Enhanced volunteer removal with error handling
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
    // Ensure user document exists before updating
    await ensureUserDocumentExists(volunteerId);

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
      cleanupResults.errors.push(`Chat update error: ${FirebaseErrorHandler.getErrorMessage(error)}`);
    }

    // Execute batch operations
    await batch.commit();

    // Log successful removal
    await FirebaseErrorHandler.logError(currentUserId, new Error('Volunteer removed successfully'), {
      operation: 'removeVolunteer',
      eventId,
      volunteerId,
      cleanupResults
    });

    return cleanupResults;

  } catch (error) {
    cleanupResults.errors.push(`Volunteer removal error: ${FirebaseErrorHandler.getErrorMessage(error)}`);
    
    // Log the error
    await FirebaseErrorHandler.logError(currentUserId, error, {
      operation: 'removeVolunteer',
      eventId,
      volunteerId,
      cleanupResults
    });
    
    throw error;
  }
};

/**
 * IMPROVED: Enhanced mention notification with error handling
 */
export const createMentionNotification = async (mentionedUserId, senderUserId, chatRoomId, chatTitle, messageText) => {
  try {
    // Ensure mentioned user document exists
    await ensureUserDocumentExists(mentionedUserId);
    
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
    console.error('Error creating mention notification:', error);
    
    // Log the error
    await FirebaseErrorHandler.logError(senderUserId, error, {
      operation: 'createMentionNotification',
      mentionedUserId,
      chatRoomId
    });
    
    return { success: false, error: FirebaseErrorHandler.getErrorMessage(error) };
  }
};

/**
 * IMPROVED: Network connectivity checker
 */
export const checkNetworkConnectivity = () => {
  return new Promise((resolve) => {
    if (!navigator.onLine) {
      resolve(false);
      return;
    }
    
    // Try to fetch a small resource to verify actual connectivity
    fetch('/favicon.ico', { 
      method: 'HEAD',
      cache: 'no-cache',
      mode: 'no-cors'
    })
    .then(() => resolve(true))
    .catch(() => resolve(false));
  });
};

/**
 * IMPROVED: Retry mechanism for failed operations
 */
export const retryOperation = async (operation, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`Operation failed (attempt ${attempt}/${maxRetries}):`, error);
      
      // Don't retry on certain error types
      if (error.code === 'permission-denied' || 
          error.code === 'not-found' || 
          error.code === 'invalid-argument') {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError;
};

