import { Ionicons } from '@expo/vector-icons';
import {
  arrayRemove,
  arrayUnion,
  collection,
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
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  if (event.hasCustomImage && event.imageUrl) {
    return { uri: event.imageUrl };
  }
  
  if (event.category && localCategoryImages[event.category]) {
    return localCategoryImages[event.category];
  }
  
  return localCategoryImages.environment;
};

// Helper function to ensure user document exists
const ensureUserDocumentExists = async (userId, userData = {}) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('User document does not exist, creating it...');
      
      const defaultUserData = {
        uid: userId,
        registeredEvents: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        role: 'volunteer',
        ...userData
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

// Helper function to ensure chat room exists
const ensureChatRoomExists = async (eventId, eventData, userId, isOrganizer = false) => {
  try {
    const chatRoomId = `event_${eventId}`;
    const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
    const chatRoomDoc = await getDoc(chatRoomRef);
    
    if (!chatRoomDoc.exists()) {
      console.log('Chat room does not exist, creating it...');
      
      const initialParticipants = isOrganizer 
        ? [userId, eventData.organizationId].filter((id, index, arr) => arr.indexOf(id) === index)
        : [userId];
      
      const chatRoomData = {
        eventId: eventId,
        eventTitle: eventData.title,
        participants: initialParticipants,
        createdAt: serverTimestamp(),
        createdBy: userId,
        isEventChat: true,
        organizationId: eventData.organizationId,
      };
      
      await setDoc(chatRoomRef, chatRoomData);
      console.log('Chat room created successfully');
    } else {
      const chatData = chatRoomDoc.data();
      if (!chatData.participants.includes(userId)) {
        await updateDoc(chatRoomRef, {
          participants: arrayUnion(userId),
          updatedAt: serverTimestamp(),
        });
        console.log('User added to existing chat room');
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring chat room exists:', error);
    throw new Error(`Failed to setup chat room: ${error.message}`);
  }
};

export default function EventDetailsScreen({ route, navigation }) {
  const { event: initialEvent, isOrganization } = route.params;
  const { user, userRole } = useAppContext();
  
  const [event, setEvent] = useState(initialEvent);
  const [organization, setOrganization] = useState(null);
  const [registering, setRegistering] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applicationModalVisible, setApplicationModalVisible] = useState(false);
  const [applicationMessage, setApplicationMessage] = useState('');
  const [userApplication, setUserApplication] = useState(null);
  const [loadingApplication, setLoadingApplication] = useState(false);

  // Computed values
  const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
  const isRegistered = event.registeredVolunteers?.includes(user?.uid) || false;
  const isEventCreator = event.organizationId === user?.uid;
  const isPastEvent = eventDate < new Date();
  const isFull = event.registeredVolunteers?.length >= event.maxVolunteers;
  const participantCount = event.registeredVolunteers?.length || 0;

  // Load organization data
  useEffect(() => {
    const loadOrganization = async () => {
      if (event?.organizationId) {
        try {
          const orgDoc = await getDoc(doc(db, 'users', event.organizationId));
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

  // Set up real-time listener for event updates
  useEffect(() => {
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

  // Load user's application status
  useEffect(() => {
    const loadUserApplication = async () => {
      if (!user?.uid || !event?.id || userRole === 'organization') {
        return;
      }

      setLoadingApplication(true);
      try {
        // Check if user has applied to this event
        const applicationsRef = collection(db, 'events', event.id, 'applications');
        const userApplicationDoc = await getDoc(doc(applicationsRef, user.uid));
        
        if (userApplicationDoc.exists()) {
          setUserApplication(userApplicationDoc.data());
        } else {
          setUserApplication(null);
        }
      } catch (error) {
        console.error('Error loading user application:', error);
      } finally {
        setLoadingApplication(false);
      }
    };

    loadUserApplication();
  }, [user?.uid, event?.id, userRole]);

  // Handle event application
  const handleApplyToEvent = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to apply for events.');
      return;
    }

    if (isEventCreator) {
      Alert.alert('Cannot Apply', 'Organizations cannot apply to their own events.');
      return;
    }

    if (userRole === 'organization') {
      Alert.alert('Application Not Allowed', 'Organizations cannot apply to events. Only volunteers can apply.');
      return;
    }

    if (isPastEvent) {
      Alert.alert('Event Passed', 'This event has already occurred.');
      return;
    }

    if (userApplication) {
      Alert.alert('Already Applied', `You have already applied to this event. Status: ${userApplication.status}`);
      return;
    }

    // Show application modal
    setApplicationModalVisible(true);
  };

  // Submit application
  const submitApplication = async () => {
    if (!applicationMessage.trim()) {
      Alert.alert('Message Required', 'Please provide a message with your application.');
      return;
    }

    setApplying(true);
    try {
      await ensureUserDocumentExists(user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });

      // Create application document
      const applicationData = {
        volunteerId: user.uid,
        volunteerName: user.displayName || 'Unknown Volunteer',
        volunteerEmail: user.email || '',
        eventId: event.id,
        eventTitle: event.title,
        message: applicationMessage.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add application to event's applications subcollection
      const applicationsRef = collection(db, 'events', event.id, 'applications');
      await setDoc(doc(applicationsRef, user.uid), applicationData);

      setUserApplication(applicationData);
      setApplicationModalVisible(false);
      setApplicationMessage('');
      
      Alert.alert('Success', 'Your application has been submitted successfully!');
    } catch (error) {
      console.error('Error submitting application:', error);
      Alert.alert('Error', 'Failed to submit application. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  // Withdraw application
  const handleWithdrawApplication = () => {
    Alert.alert(
      'Withdraw Application',
      'Are you sure you want to withdraw your application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              const applicationsRef = collection(db, 'events', event.id, 'applications');
              await updateDoc(doc(applicationsRef, user.uid), {
                status: 'withdrawn',
                withdrawnAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              });

              setUserApplication(prev => ({ ...prev, status: 'withdrawn' }));
              Alert.alert('Success', 'Application withdrawn successfully.');
            } catch (error) {
              console.error('Error withdrawing application:', error);
              Alert.alert('Error', 'Failed to withdraw application.');
            }
          },
        },
      ]
    );
  };

  // Handle registration (existing functionality)
  const handleRegister = async () => {
    if (!user) {
      Alert.alert('Authentication Required', 'Please log in to register for events.');
      return;
    }

    if (isEventCreator) {
      Alert.alert('Cannot Register', 'Organizations cannot register for their own events.');
      return;
    }

    if (userRole === 'organization') {
      Alert.alert('Registration Not Allowed', 'Organizations cannot register for events.');
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
      await ensureUserDocumentExists(user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });

      const batch = writeBatch(db);
      const eventRef = doc(db, 'events', event.id);
      const userRef = doc(db, 'users', user.uid);
      
      if (isRegistered) {
        // Unregister
        batch.update(eventRef, {
          registeredVolunteers: arrayRemove(user.uid),
          updatedAt: serverTimestamp(),
        });

        batch.update(userRef, {
          registeredEvents: arrayRemove(event.id),
          updatedAt: serverTimestamp(),
        });

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
            }
          } catch (chatError) {
            console.warn('Chat removal failed:', chatError);
          }
        }

        await batch.commit();
        Alert.alert('Success', 'You have been unregistered from this event.');
        
      } else {
        // Register
        batch.update(eventRef, {
          registeredVolunteers: arrayUnion(user.uid),
          updatedAt: serverTimestamp(),
        });

        batch.update(userRef, {
          registeredEvents: arrayUnion(event.id),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();

        if (event.withChat) {
          try {
            await ensureChatRoomExists(event.id, event, user.uid, false);
          } catch (chatError) {
            console.warn('Chat room setup failed:', chatError);
          }
        }
        
        Alert.alert('Success', 'You have been registered for this event!');
      }
      
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Registration Error', 'An error occurred. Please try again.');
    } finally {
      setRegistering(false);
    }
  };

  // Handle chat access
  const handleChatAccess = async () => {
    if (!event.withChat) {
      Alert.alert('No Chat', 'This event does not have a chat room.');
      return;
    }

    try {
      if (isEventCreator) {
        await ensureUserDocumentExists(user.uid, {
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        });
        
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

      await ensureUserDocumentExists(user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
      
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
      Alert.alert('Chat Access Error', 'Failed to access chat. Please try again.');
    }
  };

  // Get application button text and style
  const getApplicationButtonText = () => {
    if (loadingApplication) return 'Loading...';
    if (applying) return 'Submitting...';
    if (isEventCreator) return 'You Created This Event';
    if (userRole === 'organization') return 'Organizations Cannot Apply';
    if (isPastEvent) return 'Event Has Passed';
    
    if (userApplication) {
      switch (userApplication.status) {
        case 'pending': return 'Application Pending';
        case 'approved': return 'Application Approved';
        case 'rejected': return 'Application Rejected';
        case 'withdrawn': return 'Application Withdrawn';
        default: return 'Applied';
      }
    }
    
    return 'Apply to Event';
  };

  const getApplicationButtonStyle = () => {
    if (isEventCreator || userRole === 'organization' || isPastEvent) {
      return [styles.applyButton, styles.applyButtonDisabled];
    }
    
    if (userApplication) {
      switch (userApplication.status) {
        case 'pending': return [styles.applyButton, styles.applyButtonPending];
        case 'approved': return [styles.applyButton, styles.applyButtonApproved];
        case 'rejected': return [styles.applyButton, styles.applyButtonRejected];
        case 'withdrawn': return [styles.applyButton, styles.applyButtonWithdrawn];
        default: return [styles.applyButton, styles.applyButtonDisabled];
      }
    }
    
    return [styles.applyButton, styles.applyButtonActive];
  };

  const isApplicationDisabled = () => {
    return isEventCreator || userRole === 'organization' || isPastEvent || applying || loadingApplication || (userApplication && userApplication.status !== 'withdrawn');
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
              source={{ uri: organization?.photoURL || 'https://via.placeholder.com/40' }}
              style={styles.organizationLogo}
            />
            <Text style={styles.organizationName}>
              {organization?.displayName || event.organizationName || 'Organization'}
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
              {participantCount}/{event.maxVolunteers} volunteers
            </Text>
          </View>

          {event.requirements && (
            <View style={styles.detailRow}>
              <Ionicons name="list-outline" size={20} color="#666" />
              <Text style={styles.detailText}>{event.requirements}</Text>
            </View>
          )}
        </Animatable.View>

        {/* Application Status (if user has applied) */}
        {userApplication && (
          <Animatable.View animation="fadeInUp" duration={600} delay={600} style={styles.applicationStatusContainer}>
            <Text style={styles.applicationStatusTitle}>Your Application</Text>
            <View style={[
              styles.applicationStatusBadge,
              { backgroundColor: getApplicationStatusColor(userApplication.status) }
            ]}>
              <Text style={styles.applicationStatusText}>
                {userApplication.status.charAt(0).toUpperCase() + userApplication.status.slice(1)}
              </Text>
            </View>
            {userApplication.message && (
              <Text style={styles.applicationMessage}>
                Message: "{userApplication.message}"
              </Text>
            )}
            {userApplication.response && (
              <Text style={styles.applicationResponse}>
                Response: "{userApplication.response}"
              </Text>
            )}
            {userApplication.status === 'pending' && (
              <TouchableOpacity
                style={styles.withdrawButton}
                onPress={handleWithdrawApplication}
              >
                <Text style={styles.withdrawButtonText}>Withdraw Application</Text>
              </TouchableOpacity>
            )}
          </Animatable.View>
        )}

        {/* Action Buttons */}
        <Animatable.View animation="fadeInUp" duration={600} delay={800} style={styles.actionContainer}>
          {/* Application Button */}
          <TouchableOpacity
            style={getApplicationButtonStyle()}
            onPress={handleApplyToEvent}
            disabled={isApplicationDisabled()}
          >
            <Text style={styles.buttonText}>
              {getApplicationButtonText()}
            </Text>
          </TouchableOpacity>

          {/* Registration Button */}
          <TouchableOpacity
            style={getRegistrationButtonStyle()}
            onPress={handleRegister}
            disabled={isRegistrationDisabled()}
          >
            <Text style={styles.buttonText}>
              {getRegistrationButtonText()}
            </Text>
          </TouchableOpacity>

          {/* Chat Button */}
          {event.withChat && (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={handleChatAccess}
            >
              <Ionicons name="chatbubble-outline" size={20} color="#fff" />
              <Text style={styles.buttonText}>
                {isEventCreator ? 'Manage Chat' : isRegistered ? 'Join Chat' : 'Register to Chat'}
              </Text>
            </TouchableOpacity>
          )}
        </Animatable.View>
      </View>

      {/* Application Modal */}
      <Modal
        visible={applicationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setApplicationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Apply to Event</Text>
            <Text style={styles.modalSubtitle}>
              Tell the organization why you want to participate in this event.
            </Text>
            
            <TextInput
              style={styles.messageInput}
              placeholder="Write your application message here..."
              value={applicationMessage}
              onChangeText={setApplicationMessage}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            
            <Text style={styles.characterCount}>
              {applicationMessage.length}/500 characters
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setApplicationModalVisible(false);
                  setApplicationMessage('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[
                  styles.modalSubmitButton,
                  applying && styles.modalSubmitButtonDisabled
                ]}
                onPress={submitApplication}
                disabled={applying || !applicationMessage.trim()}
              >
                {applying ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitButtonText}>Submit Application</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// Helper function to get application status color
const getApplicationStatusColor = (status) => {
  switch (status) {
    case 'pending': return '#FF9800';
    case 'approved': return '#4CAF50';
    case 'rejected': return '#F44336';
    case 'withdrawn': return '#666';
    default: return '#666';
  }
};

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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginBottom: 12,
  },
  organizationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizationLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  organizationName: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 24,
  },
  detailsContainer: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
    flex: 1,
  },
  applicationStatusContainer: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  applicationStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 8,
  },
  applicationStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  applicationStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  applicationMessage: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  applicationResponse: {
    fontSize: 14,
    color: '#4e8cff',
    fontWeight: '500',
    marginBottom: 8,
  },
  withdrawButton: {
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  withdrawButtonText: {
    color: '#F44336',
    fontWeight: '600',
    fontSize: 14,
  },
  actionContainer: {
    gap: 12,
  },
  applyButton: {
    backgroundColor: '#4e8cff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonActive: {
    backgroundColor: '#4e8cff',
  },
  applyButtonDisabled: {
    backgroundColor: '#ccc',
  },
  applyButtonPending: {
    backgroundColor: '#FF9800',
  },
  applyButtonApproved: {
    backgroundColor: '#4CAF50',
  },
  applyButtonRejected: {
    backgroundColor: '#F44336',
  },
  applyButtonWithdrawn: {
    backgroundColor: '#666',
  },
  registerButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  registerButtonActive: {
    backgroundColor: '#4CAF50',
  },
  registerButtonDisabled: {
    backgroundColor: '#ccc',
  },
  unregisterButton: {
    backgroundColor: '#F44336',
  },
  chatButton: {
    backgroundColor: '#9C27B0',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    lineHeight: 20,
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  modalSubmitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#4e8cff',
    alignItems: 'center',
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  modalSubmitButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

