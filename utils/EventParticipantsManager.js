// EventParticipantsManager.js - Utility for managing event participants
import {
    arrayRemove,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export class EventParticipantsManager {
  
  /**
   * Get all participants for an event with their user data
   * @param {string} eventId - ID of the event
   * @returns {Promise<Array>} - Array of participant objects with user data
   */
  static async getEventParticipants(eventId) {
    try {
      if (!eventId) {
        throw new Error('Event ID is required');
      }

      const eventRef = doc(db, 'events', eventId);
      const eventDoc = await getDoc(eventRef);

      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();
      const participantIds = eventData.registeredVolunteers || [];

      if (participantIds.length === 0) {
        return [];
      }

      // Fetch user data for each participant
      const participantPromises = participantIds.map(async (participantId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', participantId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              id: userDoc.id,
              displayName: userData.displayName || 'Unknown User',
              email: userData.email || '',
              photoURL: userData.photoURL || 'https://via.placeholder.com/50',
              registeredAt: userData.registeredAt || null,
              role: userData.role || 'volunteer',
              bio: userData.bio || '',
              location: userData.location || '',
              skills: userData.skills || [],
              phone: userData.phone || '',
              // Add participation-specific data
              participationStatus: 'registered', // registered, attended, no-show
              registrationDate: eventData.registrationDates?.[participantId] || null,
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching participant ${participantId}:`, error);
          return null;
        }
      });

      const participants = (await Promise.all(participantPromises)).filter(Boolean);
      
      // Sort by registration date (most recent first) or display name
      participants.sort((a, b) => {
        if (a.registrationDate && b.registrationDate) {
          return new Date(b.registrationDate) - new Date(a.registrationDate);
        }
        return (a.displayName || '').localeCompare(b.displayName || '');
      });

      console.log(`Retrieved ${participants.length} participants for event ${eventId}`);
      return participants;

    } catch (error) {
      console.error('Error getting event participants:', error);
      throw error;
    }
  }

  /**
   * Remove a participant from an event
   * @param {string} eventId - ID of the event
   * @param {string} participantId - ID of the participant to remove
   * @param {string} organizationId - ID of the organization (for permission check)
   * @returns {Promise<boolean>} - Success status
   */
  static async removeParticipant(eventId, participantId, organizationId) {
    try {
      if (!eventId || !participantId || !organizationId) {
        throw new Error('Event ID, Participant ID, and Organization ID are required');
      }

      // Verify that the organization owns this event
      const eventRef = doc(db, 'events', eventId);
      const eventDoc = await getDoc(eventRef);

      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();
      if (eventData.organizationId !== organizationId) {
        throw new Error('You do not have permission to manage participants for this event');
      }

      const currentParticipants = eventData.registeredVolunteers || [];
      if (!currentParticipants.includes(participantId)) {
        throw new Error('User is not registered for this event');
      }

      // Use batch operations for consistency
      const batch = writeBatch(db);

      // Remove from event's registered volunteers
      batch.update(eventRef, {
        registeredVolunteers: arrayRemove(participantId),
        updatedAt: serverTimestamp()
      });

      // Remove from user's registered events
      const userRef = doc(db, 'users', participantId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        batch.update(userRef, {
          registeredEvents: arrayRemove(eventId),
          updatedAt: serverTimestamp()
        });
      }

      // Remove from chat room participants if event has chat
      if (eventData.withChat) {
        try {
          const chatRoomId = `event_${eventId}`;
          const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
          const chatRoomDoc = await getDoc(chatRoomRef);
          
          if (chatRoomDoc.exists()) {
            batch.update(chatRoomRef, {
              participants: arrayRemove(participantId),
              updatedAt: serverTimestamp()
            });
          }
        } catch (chatError) {
          console.warn('Chat room update failed:', chatError);
          // Continue with participant removal even if chat update fails
        }
      }

      // Execute all operations
      await batch.commit();

      console.log(`Participant ${participantId} removed from event ${eventId}`);
      return true;

    } catch (error) {
      console.error('Error removing participant:', error);
      throw error;
    }
  }

  /**
   * Get participant statistics for an event
   * @param {string} eventId - ID of the event
   * @returns {Promise<Object>} - Participant statistics
   */
  static async getParticipantStats(eventId) {
    try {
      if (!eventId) {
        throw new Error('Event ID is required');
      }

      const participants = await this.getEventParticipants(eventId);
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      
      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();
      const maxVolunteers = eventData.maxVolunteers || 0;
      
      const stats = {
        totalParticipants: participants.length,
        maxCapacity: maxVolunteers,
        availableSpots: Math.max(maxVolunteers - participants.length, 0),
        fillPercentage: maxVolunteers > 0 ? Math.round((participants.length / maxVolunteers) * 100) : 0,
        volunteerParticipants: participants.filter(p => p.role === 'volunteer').length,
        recentRegistrations: participants.filter(p => {
          if (!p.registrationDate) return false;
          const regDate = new Date(p.registrationDate);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return regDate > sevenDaysAgo;
        }).length,
        participantsWithSkills: participants.filter(p => p.skills && p.skills.length > 0).length,
      };

      return stats;

    } catch (error) {
      console.error('Error getting participant stats:', error);
      throw error;
    }
  }

  /**
   * Get all events with their participant counts for an organization
   * @param {string} organizationId - ID of the organization
   * @returns {Promise<Array>} - Array of events with participant data
   */
  static async getOrganizationEventsWithParticipants(organizationId) {
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      // Get all events for this organization
      const eventsQuery = query(
        collection(db, 'events'),
        where('organizationId', '==', organizationId)
      );

      const eventsSnapshot = await getDocs(eventsQuery);
      const eventsWithParticipants = [];

      for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        const eventId = eventDoc.id;

        try {
          const stats = await this.getParticipantStats(eventId);
          
          eventsWithParticipants.push({
            id: eventId,
            ...eventData,
            participantStats: stats,
            date: eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date),
          });
        } catch (error) {
          console.error(`Error getting stats for event ${eventId}:`, error);
          // Include event without stats if there's an error
          eventsWithParticipants.push({
            id: eventId,
            ...eventData,
            participantStats: {
              totalParticipants: eventData.registeredVolunteers?.length || 0,
              maxCapacity: eventData.maxVolunteers || 0,
              availableSpots: 0,
              fillPercentage: 0,
            },
            date: eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date),
          });
        }
      }

      // Sort by date (most recent first)
      eventsWithParticipants.sort((a, b) => new Date(b.date) - new Date(a.date));

      console.log(`Retrieved ${eventsWithParticipants.length} events with participant data`);
      return eventsWithParticipants;

    } catch (error) {
      console.error('Error getting organization events with participants:', error);
      throw error;
    }
  }

  /**
   * Update participant status (e.g., attended, no-show)
   * @param {string} eventId - ID of the event
   * @param {string} participantId - ID of the participant
   * @param {string} status - New status ('registered', 'attended', 'no-show')
   * @param {string} organizationId - ID of the organization (for permission check)
   * @returns {Promise<boolean>} - Success status
   */
  static async updateParticipantStatus(eventId, participantId, status, organizationId) {
    try {
      if (!eventId || !participantId || !status || !organizationId) {
        throw new Error('All parameters are required');
      }

      const validStatuses = ['registered', 'attended', 'no-show'];
      if (!validStatuses.includes(status)) {
        throw new Error('Invalid status. Must be one of: ' + validStatuses.join(', '));
      }

      // Verify that the organization owns this event
      const eventRef = doc(db, 'events', eventId);
      const eventDoc = await getDoc(eventRef);

      if (!eventDoc.exists()) {
        throw new Error('Event not found');
      }

      const eventData = eventDoc.data();
      if (eventData.organizationId !== organizationId) {
        throw new Error('You do not have permission to manage participants for this event');
      }

      // Update participant status in event document
      const participantStatuses = eventData.participantStatuses || {};
      participantStatuses[participantId] = {
        status: status,
        updatedAt: serverTimestamp(),
        updatedBy: organizationId,
      };

      await updateDoc(eventRef, {
        participantStatuses: participantStatuses,
        updatedAt: serverTimestamp()
      });

      console.log(`Participant ${participantId} status updated to ${status} for event ${eventId}`);
      return true;

    } catch (error) {
      console.error('Error updating participant status:', error);
      throw error;
    }
  }

  /**
   * Bulk remove multiple participants from an event
   * @param {string} eventId - ID of the event
   * @param {Array<string>} participantIds - Array of participant IDs to remove
   * @param {string} organizationId - ID of the organization (for permission check)
   * @returns {Promise<Object>} - Result with success/failure counts
   */
  static async bulkRemoveParticipants(eventId, participantIds, organizationId) {
    try {
      if (!eventId || !participantIds || !Array.isArray(participantIds) || !organizationId) {
        throw new Error('Event ID, participant IDs array, and Organization ID are required');
      }

      const results = {
        successful: 0,
        failed: 0,
        errors: []
      };

      // Process removals one by one to handle individual errors
      for (const participantId of participantIds) {
        try {
          await this.removeParticipant(eventId, participantId, organizationId);
          results.successful++;
        } catch (error) {
          results.failed++;
          results.errors.push({
            participantId,
            error: error.message
          });
          console.error(`Failed to remove participant ${participantId}:`, error);
        }
      }

      console.log(`Bulk removal completed: ${results.successful} successful, ${results.failed} failed`);
      return results;

    } catch (error) {
      console.error('Error in bulk remove participants:', error);
      throw error;
    }
  }

  /**
   * Export participants data for an event (for CSV/Excel export)
   * @param {string} eventId - ID of the event
   * @returns {Promise<Array>} - Array of participant data for export
   */
  static async exportParticipantsData(eventId) {
    try {
      if (!eventId) {
        throw new Error('Event ID is required');
      }

      const participants = await this.getEventParticipants(eventId);
      
      // Format data for export
      const exportData = participants.map(participant => ({
        'Name': participant.displayName || 'Unknown',
        'Email': participant.email || '',
        'Phone': participant.phone || '',
        'Location': participant.location || '',
        'Skills': participant.skills ? participant.skills.join(', ') : '',
        'Registration Date': participant.registrationDate 
          ? new Date(participant.registrationDate).toLocaleDateString()
          : '',
        'Status': participant.participationStatus || 'registered',
        'Bio': participant.bio || '',
      }));

      return exportData;

    } catch (error) {
      console.error('Error exporting participants data:', error);
      throw error;
    }
  }
}

export default EventParticipantsManager;

