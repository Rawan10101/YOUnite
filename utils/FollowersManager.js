// FollowersManager.js - Utility for managing followers functionality with real-time updates
import {
    arrayRemove,
    arrayUnion,
    doc,
    getDoc,
    onSnapshot,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';

export class FollowersManager {
  
  /**
   * Follow an organization
   * @param {string} userId - ID of the user following
   * @param {string} organizationId - ID of the organization to follow
   * @returns {Promise<boolean>} - Success status
   */
  static async followOrganization(userId, organizationId) {
    try {
      if (!userId || !organizationId) {
        throw new Error('User ID and Organization ID are required');
      }

      // Prevent self-following (if user is an organization)
      if (userId === organizationId) {
        throw new Error('Organizations cannot follow themselves');
      }

      const orgRef = doc(db, 'organizations', organizationId);
      const orgDoc = await getDoc(orgRef);

      if (!orgDoc.exists()) {
        throw new Error('Organization not found');
      }

      const orgData = orgDoc.data();
      const currentFollowers = orgData.followers || [];

      // Check if already following
      if (currentFollowers.includes(userId)) {
        throw new Error('Already following this organization');
      }

      // Add follower to organization
      await updateDoc(orgRef, {
        followers: arrayUnion(userId),
        followerCount: (orgData.followerCount || 0) + 1,
        updatedAt: serverTimestamp()
      });

      // Optionally, add to user's following list (if you want to track this)
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        await updateDoc(userRef, {
          following: arrayUnion(organizationId),
          updatedAt: serverTimestamp()
        });
      }

      console.log(`User ${userId} successfully followed organization ${organizationId}`);
      return true;

    } catch (error) {
      console.error('Error following organization:', error);
      throw error;
    }
  }

  /**
   * Unfollow an organization
   * @param {string} userId - ID of the user unfollowing
   * @param {string} organizationId - ID of the organization to unfollow
   * @returns {Promise<boolean>} - Success status
   */
  static async unfollowOrganization(userId, organizationId) {
    try {
      if (!userId || !organizationId) {
        throw new Error('User ID and Organization ID are required');
      }

      const orgRef = doc(db, 'organizations', organizationId);
      const orgDoc = await getDoc(orgRef);

      if (!orgDoc.exists()) {
        throw new Error('Organization not found');
      }

      const orgData = orgDoc.data();
      const currentFollowers = orgData.followers || [];

      // Check if actually following
      if (!currentFollowers.includes(userId)) {
        throw new Error('Not following this organization');
      }

      // Remove follower from organization
      await updateDoc(orgRef, {
        followers: arrayRemove(userId),
        followerCount: Math.max((orgData.followerCount || 1) - 1, 0),
        updatedAt: serverTimestamp()
      });

      // Remove from user's following list
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        await updateDoc(userRef, {
          following: arrayRemove(organizationId),
          updatedAt: serverTimestamp()
        });
      }

      console.log(`User ${userId} successfully unfollowed organization ${organizationId}`);
      return true;

    } catch (error) {
      console.error('Error unfollowing organization:', error);
      throw error;
    }
  }

  /**
   * Get followers data for an organization with real-time updates
   * @param {string} organizationId - ID of the organization
   * @param {function} callback - Callback function to handle follower updates
   * @returns {function} - Unsubscribe function to stop listening
   */
  static subscribeToOrganizationFollowers(organizationId, callback) {
    if (!organizationId) {
      console.error('Organization ID is required');
      return () => {};
    }

    console.log('Setting up real-time listener for organization followers:', organizationId);

    const orgRef = doc(db, 'organizations', organizationId);
    
    const unsubscribe = onSnapshot(orgRef, async (orgDoc) => {
      try {
        if (!orgDoc.exists()) {
          console.error('Organization not found');
          callback([], null);
          return;
        }

        const orgData = orgDoc.data();
        const followerIds = orgData.followers || [];

        if (followerIds.length === 0) {
          callback([], {
            totalFollowers: 0,
            volunteerFollowers: 0,
            organizationFollowers: 0,
            recentFollowers: 0,
            followersWithSkills: 0,
          });
          return;
        }

        // Fetch user data for each follower
        const followerPromises = followerIds.map(async (followerId) => {
          try {
            const userDoc = await getDoc(doc(db, 'users', followerId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                id: userDoc.id,
                displayName: userData.displayName || 'Unknown User',
                email: userData.email || '',
                photoURL: userData.photoURL || 'https://via.placeholder.com/50',
                followedAt: userData.followedAt || null,
                role: userData.role || 'volunteer',
                // Add any other relevant user data
                bio: userData.bio || '',
                location: userData.location || '',
                skills: userData.skills || [],
              };
            }
            return null;
          } catch (error) {
            console.error(`Error fetching follower ${followerId}:`, error);
            return null;
          }
        });

        const followers = (await Promise.all(followerPromises)).filter(Boolean);
        
        // Sort by display name
        followers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

        // Calculate stats
        const stats = {
          totalFollowers: followers.length,
          volunteerFollowers: followers.filter(f => f.role === 'volunteer').length,
          organizationFollowers: followers.filter(f => f.role === 'organization').length,
          recentFollowers: followers.filter(f => {
            if (!f.followedAt) return false;
            const followDate = f.followedAt.toDate ? f.followedAt.toDate() : new Date(f.followedAt);
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            return followDate > thirtyDaysAgo;
          }).length,
          followersWithSkills: followers.filter(f => f.skills && f.skills.length > 0).length,
        };

        console.log(`Real-time update: ${followers.length} followers for organization ${organizationId}`);
        callback(followers, stats);

      } catch (error) {
        console.error('Error in followers real-time listener:', error);
        callback([], null);
      }
    }, (error) => {
      console.error('Error setting up followers listener:', error);
      callback([], null);
    });

    return unsubscribe;
  }

  /**
   * Get followers data for an organization (static method for backward compatibility)
   * @param {string} organizationId - ID of the organization
   * @returns {Promise<Array>} - Array of follower objects with user data
   */
  static async getOrganizationFollowers(organizationId) {
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const orgRef = doc(db, 'organizations', organizationId);
      const orgDoc = await getDoc(orgRef);

      if (!orgDoc.exists()) {
        throw new Error('Organization not found');
      }

      const orgData = orgDoc.data();
      const followerIds = orgData.followers || [];

      if (followerIds.length === 0) {
        return [];
      }

      // Fetch user data for each follower
      const followerPromises = followerIds.map(async (followerId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', followerId));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            return {
              id: userDoc.id,
              displayName: userData.displayName || 'Unknown User',
              email: userData.email || '',
              photoURL: userData.photoURL || 'https://via.placeholder.com/50',
              followedAt: userData.followedAt || null,
              role: userData.role || 'volunteer',
              // Add any other relevant user data
              bio: userData.bio || '',
              location: userData.location || '',
              skills: userData.skills || [],
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching follower ${followerId}:`, error);
          return null;
        }
      });

      const followers = (await Promise.all(followerPromises)).filter(Boolean);
      
      // Sort by display name
      followers.sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

      console.log(`Retrieved ${followers.length} followers for organization ${organizationId}`);
      return followers;

    } catch (error) {
      console.error('Error getting organization followers:', error);
      throw error;
    }
  }

  /**
   * Get organizations that a user is following
   * @param {string} userId - ID of the user
   * @returns {Promise<Array>} - Array of organization objects
   */
  static async getUserFollowing(userId) {
    try {
      if (!userId) {
        throw new Error('User ID is required');
      }

      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        return [];
      }

      const userData = userDoc.data();
      const followingIds = userData.following || [];

      if (followingIds.length === 0) {
        return [];
      }

      // Fetch organization data for each followed organization
      const organizationPromises = followingIds.map(async (orgId) => {
        try {
          const orgDoc = await getDoc(doc(db, 'organizations', orgId));
          if (orgDoc.exists()) {
            return {
              id: orgDoc.id,
              ...orgDoc.data()
            };
          }
          return null;
        } catch (error) {
          console.error(`Error fetching organization ${orgId}:`, error);
          return null;
        }
      });

      const organizations = (await Promise.all(organizationPromises)).filter(Boolean);
      
      console.log(`User ${userId} is following ${organizations.length} organizations`);
      return organizations;

    } catch (error) {
      console.error('Error getting user following:', error);
      throw error;
    }
  }

  /**
   * Check if a user is following an organization
   * @param {string} userId - ID of the user
   * @param {string} organizationId - ID of the organization
   * @returns {Promise<boolean>} - Following status
   */
  static async isFollowing(userId, organizationId) {
    try {
      if (!userId || !organizationId) {
        return false;
      }

      const orgRef = doc(db, 'organizations', organizationId);
      const orgDoc = await getDoc(orgRef);

      if (!orgDoc.exists()) {
        return false;
      }

      const orgData = orgDoc.data();
      const followers = orgData.followers || [];

      return followers.includes(userId);

    } catch (error) {
      console.error('Error checking following status:', error);
      return false;
    }
  }

  /**
   * Get follower statistics for an organization
   * @param {string} organizationId - ID of the organization
   * @returns {Promise<Object>} - Follower statistics
   */
  static async getFollowerStats(organizationId) {
    try {
      if (!organizationId) {
        throw new Error('Organization ID is required');
      }

      const followers = await this.getOrganizationFollowers(organizationId);
      
      const stats = {
        totalFollowers: followers.length,
        volunteerFollowers: followers.filter(f => f.role === 'volunteer').length,
        organizationFollowers: followers.filter(f => f.role === 'organization').length,
        recentFollowers: followers.filter(f => {
          if (!f.followedAt) return false;
          const followDate = f.followedAt.toDate ? f.followedAt.toDate() : new Date(f.followedAt);
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          return followDate > thirtyDaysAgo;
        }).length,
        followersWithSkills: followers.filter(f => f.skills && f.skills.length > 0).length,
      };

      return stats;

    } catch (error) {
      console.error('Error getting follower stats:', error);
      throw error;
    }
  }

  /**
   * Remove a follower from an organization (for organization admins)
   * @param {string} organizationId - ID of the organization
   * @param {string} followerId - ID of the follower to remove
   * @returns {Promise<boolean>} - Success status
   */
  static async removeFollower(organizationId, followerId) {
    try {
      if (!organizationId || !followerId) {
        throw new Error('Organization ID and Follower ID are required');
      }

      // This is essentially the same as unfollowing, but initiated by the organization
      return await this.unfollowOrganization(followerId, organizationId);

    } catch (error) {
      console.error('Error removing follower:', error);
      throw error;
    }
  }
}

export default FollowersManager;

