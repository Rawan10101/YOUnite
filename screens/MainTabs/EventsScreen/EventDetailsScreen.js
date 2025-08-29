import { Ionicons } from '@expo/vector-icons';
import {
  arrayRemove,
  arrayUnion,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';

// Import local category images
import educationImg from '../../../assets/images/educationCat.jpeg';
import environmentImg from '../../../assets/images/environmentCat.jpeg';
import healthcareImg from '../../../assets/images/healthcareCat.jpeg';

const { width: screenWidth } = Dimensions.get('window');

// Local category images mapping
const localCategoryImages = {
  environment: environmentImg,
  education: educationImg,
  healthcare: healthcareImg,
};

// Function to get the correct image source based on event data
const getImageSource = (event) => {
  // If has custom image uploaded to Firebase
  if (event.hasCustomImage && event.imageUrl) {
    return { uri: event.imageUrl };
  }
  
  // Use local default based on category
  if (event.category && localCategoryImages[event.category]) {
    return localCategoryImages[event.category];
  }
  
  // Fallback to a default local image
  return localCategoryImages.environment;
};

// IMPROVED: Helper function to ensure user document exists
const ensureUserDocumentExists = async (userId, userData = {}) => {
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
      return true;
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring user document exists:', error);
    throw new Error(`Failed to create user document: ${error.message}`);
  }
};

// IMPROVED: Helper function to ensure chat room exists with proper structure
const ensureChatRoomExists = async (eventId, eventData, userId, isOrganizer = false) => {
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
      return true;
    } else {
      // Chat room exists, ensure user is in participants if they should be
      const currentParticipants = chatRoomDoc.data().participants || [];
      if (!currentParticipants.includes(userId)) {
        await updateDoc(chatRoomRef, {
          participants: arrayUnion(userId),
          updatedAt: serverTimestamp(),
        });
        console.log('User added to existing chat participants');
      }
      return true;
    }
  } catch (error) {
    console.error('Error ensuring chat room exists:', error);
    // Don't throw error for chat room issues - registration should still work
    return false;
  }
};

export default function EventDetailsScreen({ route, navigation }) {
  const { user } = useAppContext();
  const { event: initialEvent, isOrganization = false } = route.params;
  
  const [event, setEvent] = useState(initialEvent);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [organization, setOrganization] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Check if current user is the organization that created this event
  const isEventCreator = user?.uid === event?.organizationId;
  
  // Check if user is already registered
  const isRegistered = event?.registeredVolunteers?.includes(user?.uid);
  
  // Check if event is full
  const isFull = event?.registeredVolunteers?.length >= event?.maxVolunteers;
  
  // Check if event has passed
  const eventDate = event?.date?.toDate ? event.date.toDate() : new Date(event?.date);
  const isPastEvent = eventDate < new Date();

  useEffect(() => {
    // Determine user role
    const determineUserRole = async () => {
      try {
        // First ensure user document exists
        await ensureUserDocumentExists(user.uid, {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role);
        }
      } catch (error) {
        console.error('Error determining user role:', error);
        // Set default role if there's an error
        setUserRole('volunteer');
      }
    };

    if (user?.uid) {
      determineUserRole();
    }
  }, [user]);

  useEffect(() => {
    // Load organization data
    const loadOrganization = async () => {
      if (event?.organizationId) {
        try {
          const orgDoc = await getDoc(doc(db, 'organizations', event.organizationId));
          if (orgDoc.exists()) {
            setOrganization(orgDoc.data());
          }
        } catch (error) {
          console.error('Error loading organization:', error);
        }
      }
    };

    loadOrganization();
  }, [event?.organizationId]);

  useEffect(() => {
    // Set up real-time listener for event updates
    if (event?.id) {
      const unsubscribe = onSnapshot(
        doc(db, 'events', event.id),
        (doc) => {
          if (doc.exists()) {
            const updatedEvent = { id: doc.id, ...doc.data() };
            setEvent(updatedEvent);
          }
        },
        (error) => {
          console.error('Event listener error:', error);
        }
      );

      return () => unsubscribe();
    }
  }, [event?.id]);

  // IMPROVED: Comprehensive registration/unregistration with error handling
  const handleRegister = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to register for events.');
      return;
    }

    // Prevent organizations from registering for their own events
    if (isEventCreator) {
      Alert.alert(
        'Cannot Register', 
        'Organizations cannot register for their own events. You are the creator of this event.'
      );
      return;
    }

    // Prevent organizations from registering for any events
    if (userRole === 'organization') {
      Alert.alert(
        'Registration Not Allowed', 
        'Organizations cannot register for events. Only volunteers can participate in events.'
      );
      return;
    }

    if (isPastEvent) {
      Alert.alert('Event Passed', 'This event has already occurred.');
      return;
    }

    if (isFull && !isRegistered) {
      Alert.alert('Event Full', 'This event has reached its maximum capacity.');
      return;
    }

    setRegistering(true);

    try {
      console.log(`Starting ${isRegistered ? 'unregistration' : 'registration'} process...`);
      
      // STEP 1: Ensure user document exists before any operations
      await ensureUserDocumentExists(user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });

      // STEP 2: Prepare batch operations
      const batch = writeBatch(db);
      
      const eventRef = doc(db, 'events', event.id);
      const userRef = doc(db, 'users', user.uid);
      
      if (isRegistered) {
        // UNREGISTER PROCESS
        console.log('Processing unregistration...');
        
        // Remove from event registrations
        batch.update(eventRef, {
          registeredVolunteers: arrayRemove(user.uid),
          updatedAt: serverTimestamp(),
        });

        // Remove from user's registered events
        batch.update(userRef, {
          registeredEvents: arrayRemove(event.id),
          updatedAt: serverTimestamp(),
        });

        // Handle chat room participant removal
        if (event.withChat) {
          try {
            const chatRoomId = `event_${event.id}`;
            const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
            
            const chatRoomDoc = await getDoc(chatRoomRef);
            if (chatRoomDoc.exists()) {
              batch.update(chatRoomRef, {
                participants: arrayRemove(user.uid),
                updatedAt: serverTimestamp(),
              });
              console.log('User will be removed from chat participants');
            }
          } catch (chatError) {
            console.warn('Chat removal preparation failed:', chatError);
            // Continue with unregistration even if chat update fails
          }
        }

        // Execute batch operations
        await batch.commit();
        console.log('Unregistration completed successfully');
        
        Alert.alert('Success', 'You have been unregistered from this event.');
        
      } else {
        // REGISTER PROCESS
        console.log('Processing registration...');
        
        // Add to event registrations
        batch.update(eventRef, {
          registeredVolunteers: arrayUnion(user.uid),
          updatedAt: serverTimestamp(),
        });

        // Add to user's registered events
        batch.update(userRef, {
          registeredEvents: arrayUnion(event.id),
          updatedAt: serverTimestamp(),
        });

        // Execute main batch operations first
        await batch.commit();
        console.log('Registration completed successfully');

        // STEP 3: Handle chat room setup separately (non-critical)
        if (event.withChat) {
          try {
            await ensureChatRoomExists(event.id, event, user.uid, false);
            console.log('Chat room setup completed');
          } catch (chatError) {
            console.warn('Chat room setup failed:', chatError);
            // Don't fail registration for chat issues
          }
        }
        
        Alert.alert('Success', 'You have been registered for this event!');
      }
      
    } catch (error) {
      console.error('Registration/Unregistration error:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'An unexpected error occurred. Please try again.';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to perform this action. Please check your account status.';
      } else if (error.code === 'not-found') {
        errorMessage = 'Event not found. It may have been deleted.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Service temporarily unavailable. Please check your internet connection and try again.';
      } else if (error.code === 'deadline-exceeded') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message.includes('user document')) {
        errorMessage = 'There was an issue with your user profile. Please try logging out and back in.';
      } else if (error.message.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection.';
      }
      
      Alert.alert('Registration Error', errorMessage);
    } finally {
      setRegistering(false);
    }
  };

  // IMPROVED: Enhanced chat access with comprehensive error handling
  const handleChatAccess = async () => {
    if (!event.withChat) {
      Alert.alert('No Chat', 'This event does not have a chat room.');
      return;
    }

    try {
      // Allow event creators (organizations) to access chat for moderation
      if (isEventCreator) {
        console.log('Event creator accessing chat for moderation');
        
        // Ensure user document exists
        await ensureUserDocumentExists(user.uid, {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
        
        // Ensure chat room exists for organization access
        await ensureChatRoomExists(event.id, event, user.uid, true);
        
        navigation.navigate('Chat', {
          chatRoomId: `event_${event.id}`,
          chatTitle: `${event.title} - Chat`,
          isEventChat: true,
          eventId: event.id,
          organizationId: event.organizationId,
        });
        return;
      }

      // For volunteers, check if they are registered
      if (!isRegistered) {
        Alert.alert(
          'Registration Required', 
          'You must be registered for this event to access the chat.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Register Now', 
              onPress: handleRegister,
              style: 'default'
            }
          ]
        );
        return;
      }

      // Volunteer is registered, ensure they have chat access
      console.log('Registered volunteer accessing chat');
      
      // Ensure user document exists
      await ensureUserDocumentExists(user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
      
      // Ensure chat room exists and user has access
      await ensureChatRoomExists(event.id, event, user.uid, false);

      navigation.navigate('Chat', {
        chatRoomId: `event_${event.id}`,
        chatTitle: `${event.title} - Chat`,
        isEventChat: true,
        eventId: event.id,
        organizationId: event.organizationId,
      });

    } catch (error) {
      console.error('Error accessing chat:', error);
      
      let errorMessage = 'Failed to access chat. Please try again.';
      
      if (error.code === 'permission-denied') {
        errorMessage = 'You do not have permission to access this chat.';
      } else if (error.code === 'not-found') {
        errorMessage = 'Chat room not found. Please try registering for the event again.';
      } else if (error.code === 'unavailable') {
        errorMessage = 'Chat service temporarily unavailable. Please try again later.';
      }
      
      Alert.alert('Chat Access Error', errorMessage);
    }
  };

  const getRegistrationButtonText = () => {
    if (registering) {
      return isRegistered ? 'Unregistering...' : 'Registering...';
    }
    
    if (isEventCreator) {
      return 'You Created This Event';
    }
    
    if (userRole === 'organization') {
      return 'Organizations Cannot Register';
    }
    
    if (isPastEvent) {
      return 'Event Has Passed';
    }
    
    if (isRegistered) {
      return 'Unregister';
    }
    
    if (isFull) {
      return 'Event Full';
    }
    
    return 'Register';
  };

  const getRegistrationButtonStyle = () => {
    if (isEventCreator || userRole === 'organization' || isPastEvent || (isFull && !isRegistered)) {
      return [styles.registerButton, styles.registerButtonDisabled];
    }
    
    if (isRegistered) {
      return [styles.registerButton, styles.unregisterButton];
    }
    
    return [styles.registerButton, styles.registerButtonActive];
  };

  const isRegistrationDisabled = () => {
    return isEventCreator || userRole === 'organization' || isPastEvent || (isFull && !isRegistered) || registering;
  };

  const getChatButtonText = () => {
    if (!event.withChat) {
      return 'No Chat Available';
    }
    
    if (isEventCreator) {
      return 'Manage Chat';
    }
    
    if (!isRegistered) {
      return 'Register to Chat';
    }
    
    return 'Join Chat';
  };

  const getChatButtonStyle = () => {
    if (!event.withChat) {
      return [styles.chatButton, styles.chatButtonDisabled];
    }
    
    if (isEventCreator || isRegistered) {
      return [styles.chatButton, styles.chatButtonActive];
    }
    
    return [styles.chatButton, styles.chatButtonSecondary];
  };

  const isChatDisabled = () => {
    return !event.withChat;
  };

  // Rest of the component remains the same...
  // (Include all the existing render logic, styles, etc.)
  
  return (
    <ScrollView style={styles.container}>
      {/* Event Image */}
      <View style={styles.imageContainer}>
        <Image source={getImageSource(event)} style={styles.eventImage} />
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Event Content */}
      <View style={styles.content}>
        <Animatable.View animation="fadeInUp" duration={600} style={styles.header}>
          <Text style={styles.title}>{event.title}</Text>
          <View style={styles.organizationInfo}>
            <Image
              source={{ uri: organization?.logo || 'https://via.placeholder.com/40' }}
              style={styles.organizationLogo}
            />
            <Text style={styles.organizationName}>
              {organization?.name || event.organizationName || 'Organization'}
            </Text>
          </View>
        </Animatable.View>

        <Animatable.View animation="fadeInUp" duration={600} delay={200}>
          <Text style={styles.description}>{event.description}</Text>
        </Animatable.View>

        {/* Event Details */}
        <Animatable.View animation="fadeInUp" duration={600} delay={400} style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={20} color="#666" />
            <Text style={styles.detailText}>
              {eventDate.toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={20} color="#666" />
            <Text style={styles.detailText}>
              {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={20} color="#666" />
            <Text style={styles.detailText}>{event.location}</Text>
          </View>

          <View style={styles.detailRow}>
            <Ionicons name="people-outline" size={20} color="#666" />
            <Text style={styles.detailText}>
              {event.registeredVolunteers?.length || 0} / {event.maxVolunteers} volunteers
            </Text>
          </View>

          {event.estimatedHours && (
            <View style={styles.detailRow}>
              <Ionicons name="hourglass-outline" size={20} color="#666" />
              <Text style={styles.detailText}>{event.estimatedHours} hours</Text>
            </View>
          )}
        </Animatable.View>

        {/* Action Buttons */}
        <Animatable.View animation="fadeInUp" duration={600} delay={600} style={styles.actionsContainer}>
          <TouchableOpacity
            style={getRegistrationButtonStyle()}
            onPress={handleRegister}
            disabled={isRegistrationDisabled()}
          >
            {registering && (
              <ActivityIndicator size="small" color="#fff" style={styles.buttonLoader} />
            )}
            <Text style={[
              styles.registerButtonText,
              (isEventCreator || userRole === 'organization' || isPastEvent || (isFull && !isRegistered)) && styles.disabledButtonText
            ]}>
              {getRegistrationButtonText()}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={getChatButtonStyle()}
            onPress={handleChatAccess}
            disabled={isChatDisabled()}
          >
            <Ionicons 
              name="chatbubble-outline" 
              size={16} 
              color={isChatDisabled() ? "#999" : "#fff"} 
              style={styles.buttonIcon}
            />
            <Text style={[
              styles.chatButtonText,
              isChatDisabled() && styles.disabledButtonText
            ]}>
              {getChatButtonText()}
            </Text>
          </TouchableOpacity>
        </Animatable.View>
      </View>
    </ScrollView>
  );
}

// Styles remain the same as original...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  imageContainer: {
    position: 'relative',
    height: 250,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginBottom: 10,
  },
  organizationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizationLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  organizationName: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#444',
    marginBottom: 20,
  },
  detailsContainer: {
    marginBottom: 30,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 10,
    flex: 1,
  },
  actionsContainer: {
    gap: 12,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  registerButtonActive: {
    backgroundColor: '#4e8cff',
  },
  unregisterButton: {
    backgroundColor: '#ff6b6b',
  },
  registerButtonDisabled: {
    backgroundColor: '#ccc',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButtonText: {
    color: '#999',
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
  },
  chatButtonActive: {
    backgroundColor: '#4e8cff',
    borderColor: '#4e8cff',
  },
  chatButtonSecondary: {
    backgroundColor: 'transparent',
    borderColor: '#4e8cff',
  },
  chatButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  chatButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },
  buttonLoader: {
    marginRight: 8,
  },
});

