// AppContext.js - Updated version
import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followedOrganizations, setFollowedOrganizations] = useState([]);
  const [registeredEvents, setRegisteredEvents] = useState([]);

  // Fetch followed organizations data when user changes
 // In your AppContext fetchFollowedOrganizations function:
const fetchFollowedOrganizations = async (userId) => {
  if (!userId) {
    setFollowedOrganizations([]);
    return;
  }

  try {
    console.log('Fetching followed organizations for user:', userId);

    // Check if followedOrganizations already contains objects
    if (followedOrganizations.length > 0 && typeof followedOrganizations[0] === 'object') {
      console.log('Already have organization objects');
      return;
    }

    // Get current followedOrganizations (might be IDs from local state)
    let followedOrgIds = followedOrganizations;
    
    // If empty, try to get from user document
    if (followedOrgIds.length === 0) {
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        followedOrgIds = userData?.followedOrganizations || [];
      }
    }
    
    console.log('Organization IDs to fetch:', followedOrgIds);

    if (followedOrgIds.length === 0) {
      setFollowedOrganizations([]);
      return;
    }

    // Fetch the actual organization data for each ID
    const organizationPromises = followedOrgIds.map(async (orgId) => {
      try {
        const orgDocRef = doc(db, 'organizations', orgId);
        const orgDoc = await getDoc(orgDocRef);
        
        if (orgDoc.exists()) {
          const orgData = {
            id: orgDoc.id,
            ...orgDoc.data()
          };
          console.log('Fetched organization:', orgData);
          return orgData;
        } else {
          console.log('Organization document does not exist:', orgId);
          return null;
        }
      } catch (error) {
        console.error('Error fetching organization:', orgId, error);
        return null;
      }
    });

    const organizations = await Promise.all(organizationPromises);
    const validOrganizations = organizations.filter(org => org !== null);
    
    console.log('Final followed organizations:', validOrganizations);
    setFollowedOrganizations(validOrganizations);

  } catch (error) {
    console.error('Error fetching followed organizations:', error);
    setFollowedOrganizations([]);
  }
};


  // Fetch registered events (you can implement this similarly if needed)
  const fetchRegisteredEvents = async (userId) => {
    if (!userId) {
      setRegisteredEvents([]);
      return;
    }

    try {
      // Implementation depends on your events data structure
      // This is a placeholder - adjust based on your needs
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const eventIds = userData?.registeredEvents || [];
        setRegisteredEvents(eventIds);
      }
    } catch (error) {
      console.error('Error fetching registered events:', error);
      setRegisteredEvents([]);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Fetch user's followed organizations when they sign in
        await fetchFollowedOrganizations(firebaseUser.uid);
        await fetchRegisteredEvents(firebaseUser.uid);
      } else {
        // Clear data when user signs out
        setFollowedOrganizations([]);
        setRegisteredEvents([]);
      }
      
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Helper function to refresh followed organizations (useful after following/unfollowing)
  const refreshFollowedOrganizations = async () => {
    if (user?.uid) {
      await fetchFollowedOrganizations(user.uid);
    }
  };

  // Helper function to refresh registered events
  const refreshRegisteredEvents = async () => {
    if (user?.uid) {
      await fetchRegisteredEvents(user.uid);
    }
  };

  const value = {
    user,
    setUser,
    loading,
    followedOrganizations,
    setFollowedOrganizations,
    registeredEvents,
    setRegisteredEvents,
    refreshFollowedOrganizations, // Expose helper function
    refreshRegisteredEvents, // Expose helper function
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
