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
  
  // Use local default based on category
  if (event?.category && localCategoryImages[event.category]) {
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
  const [applicationAnswers, setApplicationAnswers] = useState({});
  const [userApplication, setUserApplication] = useState(null);
  const [loadingApplication, setLoadingApplication] = useState(false);

  // Computed values - UPDATED for application system
  const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
  const isRegistered = event.registeredVolunteers?.includes(user?.uid) || false;
  const isApproved = event.approvedApplicants?.includes(user?.uid) || false;
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

  // Handle event application - UPDATED
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

    // Initialize application answers
    const initialAnswers = {};
    if (event.applicationQuestions) {
      event.applicationQuestions.forEach((question, index) => {
        initialAnswers[index] = '';
      });
    }
    setApplicationAnswers(initialAnswers);

    // Show application modal
    setApplicationModalVisible(true);
  };

  // Submit application - UPDATED
  const submitApplication = async () => {
    // Validate answers
    if (event.applicationQuestions) {
      for (let i = 0; i < event.applicationQuestions.length; i++) {
        if (!applicationAnswers[i]?.trim()) {
          Alert.alert('Incomplete Application', `Please answer question ${i + 1}.`);
          return;
        }
      }
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
        answers: applicationAnswers,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // Add application to event's applications subcollection
      const applicationsRef = collection(db, 'events', event.id, 'applications');
      await setDoc(doc(applicationsRef, user.uid), applicationData);

      setUserApplication(applicationData);
      setApplicationModalVisible(false);
      setApplicationAnswers({});
      
      Alert.alert('Success', 'Your application has been submitted successfully! You will be notified when it is reviewed.');
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

  // Handle registration - UPDATED for application system
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

    // Check if event requires application
    if (event.requiresApplication && !isApproved) {
      Alert.alert('Application Required', 'This event requires an application. Please apply first and wait for approval.');
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

  // Handle chat access - UPDATED for application system
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

      // For application-based events, check if user is approved and registered
      if (event.requiresApplication) {
        if (!isApproved) {
          Alert.alert(
            'Approval Required', 
            'You must be approved for this event to access the chat.',
            [
              { text: 'OK', style: 'default' }
            ]
          );
          return;
        }
        
        if (!isRegistered) {
          Alert.alert(
            'Registration Required', 
            'You must register for this event to access the chat.',
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
      } else {
        // For normal events, just check registration
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
      }

      await ensureUserDocumentExists(user.uid, {
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
      
      await ensureChatRoomExists(event.id, event, user.uid, false);

      navigation.navigate('Chat', {
        chatRoomId: `event_${event.id}`,
        chatTitle: `${event?.title} - Chat`,
        isEventChat: true,
        eventId: event.id,
        organizationId: event.organizationId,
      });

    } catch (error) {
      console.error('Error accessing chat:', error);
      Alert.alert('Chat Access Error', 'Failed to access chat. Please try again.');
    }
  };

  // Get application button text and style - UPDATED
  const getApplicationButtonText = () => {
    if (loadingApplication) return 'Loading...';
    if (applying) return 'Submitting...';
    
    if (!userApplication) return 'Apply Now';
    
    switch (userApplication.status) {
      case 'pending': return 'Application Pending';
      case 'approved': return 'Application Approved';
      case 'rejected': return 'Application Rejected';
      case 'withdrawn': return 'Application Withdrawn';
      default: return 'Apply Now';
    }
  };

  const getApplicationButtonStyle = () => {
    if (loadingApplication || applying) return styles.applicationButtonDisabled;
    
    if (!userApplication) return styles.applicationButton;
    
    switch (userApplication.status) {
      case 'pending': return styles.applicationButtonPending;
      case 'approved': return styles.applicationButtonApproved;
      case 'rejected': return styles.applicationButtonRejected;
      case 'withdrawn': return styles.applicationButtonWithdrawn;
      default: return styles.applicationButton;
    }
  };

  // Render action buttons - UPDATED for application system
  const renderActionButtons = () => {
    if (isEventCreator) {
      return (
        <View style={styles.actionButtons}>
          {event.withChat && (
            <TouchableOpacity style={styles.chatButton} onPress={handleChatAccess}>
              <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
              <Text style={styles.chatButtonText}>Event Chat</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => navigation.navigate('EditEvent', { event })}
          >
            <Ionicons name="create-outline" size={20} color="#6366F1" />
            <Text style={styles.editButtonText}>Edit Event</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (userRole === 'organization') {
      return (
        <View style={styles.actionButtons}>
          <Text style={styles.organizationNote}>
            Organizations cannot register for events
          </Text>
        </View>
      );
    }

    if (isPastEvent) {
      return (
        <View style={styles.actionButtons}>
          <Text style={styles.pastEventNote}>This event has already occurred</Text>
        </View>
      );
    }

    // For application-based events
    if (event.requiresApplication) {
      return (
        <View style={styles.actionButtons}>
          {!userApplication || userApplication.status === 'withdrawn' ? (
            <TouchableOpacity
              style={getApplicationButtonStyle()}
              onPress={handleApplyToEvent}
              disabled={loadingApplication || applying}
            >
              <Text style={styles.applicationButtonText}>
                {getApplicationButtonText()}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.applicationStatusContainer}>
              <TouchableOpacity
                style={getApplicationButtonStyle()}
                disabled={true}
              >
                <Text style={styles.applicationButtonText}>
                  {getApplicationButtonText()}
                </Text>
              </TouchableOpacity>
              
              {userApplication.status === 'pending' && (
                <TouchableOpacity
                  style={styles.withdrawButton}
                  onPress={handleWithdrawApplication}
                >
                  <Text style={styles.withdrawButtonText}>Withdraw</Text>
                </TouchableOpacity>
              )}
              
              {userApplication.status === 'approved' && !isRegistered && (
                <TouchableOpacity
                  style={styles.registerButton}
                  onPress={handleRegister}
                  disabled={registering}
                >
                  <Text style={styles.registerButtonText}>
                    {registering ? 'Registering...' : 'Register Now'}
                  </Text>
                </TouchableOpacity>
              )}
              
              {isRegistered && (
                <TouchableOpacity
                  style={styles.unregisterButton}
                  onPress={handleRegister}
                  disabled={registering}
                >
                  <Text style={styles.unregisterButtonText}>
                    {registering ? 'Processing...' : 'Unregister'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          
          {event.withChat && isRegistered && (
            <TouchableOpacity style={styles.chatButton} onPress={handleChatAccess}>
              <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
              <Text style={styles.chatButtonText}>Event Chat</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // For normal events (no application required)
    return (
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[
            styles.registerButton,
            isRegistered && styles.unregisterButton,
            (registering || isFull && !isRegistered) && styles.registerButtonDisabled
          ]}
          onPress={handleRegister}
          disabled={registering || (isFull && !isRegistered)}
        >
          <Ionicons
            name={isRegistered ? 'checkmark' : 'add'}
            size={20}
            color={isRegistered ? '#EF4444' : '#FFFFFF'}
          />
          <Text
            style={[
              styles.registerButtonText,
              isRegistered && styles.unregisterButtonText
            ]}
          >
            {registering
              ? 'Processing...'
              : isRegistered
              ? 'Unregister'
              : isFull
              ? 'Event Full'
              : 'Register'}
          </Text>
        </TouchableOpacity>

        {event.withChat && isRegistered && (
          <TouchableOpacity style={styles.chatButton} onPress={handleChatAccess}>
            <Ionicons name="chatbubbles-outline" size={20} color="#FFFFFF" />
            <Text style={styles.chatButtonText}>Event Chat</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render application modal - UPDATED
  const renderApplicationModal = () => (
    <Modal
      visible={applicationModalVisible}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setApplicationModalVisible(false)}
          >
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Apply to Event</Text>
          <View style={styles.modalHeaderSpacer} />
        </View>

        <ScrollView style={styles.modalContent}>
          <Text style={styles.modalEventTitle}>{event.title}</Text>
          <Text style={styles.modalDescription}>
            Please answer the following questions to apply for this event:
          </Text>

          {event.applicationQuestions?.map((question, index) => (
            <View key={index} style={styles.questionContainer}>
              <Text style={styles.questionText}>
                {index + 1}. {question}
              </Text>
              <TextInput
                style={styles.answerInput}
                placeholder="Your answer..."
                value={applicationAnswers[index] || ''}
                onChangeText={(text) => 
                  setApplicationAnswers(prev => ({ ...prev, [index]: text }))
                }
                multiline
                numberOfLines={4}
              />
            </View>
          ))}
        </ScrollView>

        <View style={styles.modalFooter}>
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setApplicationModalVisible(false)}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modalSubmitButton, applying && styles.modalSubmitButtonDisabled]}
            onPress={submitApplication}
            disabled={applying}
          >
            <Text style={styles.modalSubmitText}>
              {applying ? 'Submitting...' : 'Submit Application'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header Image */}
      <View style={styles.imageContainer}>
        <Image source={getImageSource(event)} style={styles.eventImage} />
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        
        {/* Event Type Badge - NEW */}
        {event.requiresApplication && (
          <View style={styles.eventTypeBadge}>
            <Ionicons name="clipboard-outline" size={16} color="#FFFFFF" />
            <Text style={styles.eventTypeBadgeText}>Application Required</Text>
          </View>
        )}
      </View>

      {/* Event Content */}
      <View style={styles.content}>
        <Animatable.View animation="fadeInUp" duration={600} delay={200}>
          {/* Event Header */}
          <View style={styles.eventHeader}>
            <Text style={styles.eventTitle}>{event.title}</Text>
            <View style={styles.organizationInfo}>
              <Image
                source={{ uri: organization?.photoURL || 'https://via.placeholder.com/40' }}
                style={styles.organizationAvatar}
              />
              <Text style={styles.organizationName}>
                {organization?.displayName || event.organizationName || 'Organization'}
              </Text>
            </View>
          </View>

          {/* Event Details */}
          <View style={styles.detailsContainer}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#6B7280" />
              <Text style={styles.detailText}>
                {eventDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color="#6B7280" />
              <Text style={styles.detailText}>
                {eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={20} color="#6B7280" />
              <Text style={styles.detailText}>{event.location}</Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={20} color="#6B7280" />
              <Text style={styles.detailText}>
                {participantCount}/{event.maxVolunteers} volunteers
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color="#6B7280" />
              <Text style={styles.detailText}>{event.estimatedHours} hours</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.min((participantCount / event.maxVolunteers) * 100, 100)}%`,
                  },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round((participantCount / event.maxVolunteers) * 100)}% filled
            </Text>
          </View>

          {/* Description */}
          <View style={styles.descriptionContainer}>
            <Text style={styles.sectionTitle}>About This Event</Text>
            <Text style={styles.description}>{event.description}</Text>
          </View>

          {/* Requirements */}
          {event.requirements && (
            <View style={styles.requirementsContainer}>
              <Text style={styles.sectionTitle}>Requirements</Text>
              <Text style={styles.requirements}>{event.requirements}</Text>
            </View>
          )}

          {/* Skills */}
          {event.skills && event.skills.length > 0 && (
            <View style={styles.skillsContainer}>
              <Text style={styles.sectionTitle}>Skills Needed</Text>
              <View style={styles.skillsGrid}>
                {event.skills.map((skill, index) => (
                  <View key={index} style={styles.skillBadge}>
                    <Text style={styles.skillText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Application Questions Preview - NEW */}
          {event.requiresApplication && event.applicationQuestions && (
            <View style={styles.applicationPreviewContainer}>
              <Text style={styles.sectionTitle}>Application Questions</Text>
              {event.applicationQuestions.map((question, index) => (
                <View key={index} style={styles.previewQuestion}>
                  <Text style={styles.previewQuestionText}>
                    {index + 1}. {question}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Contact Information */}
          <View style={styles.contactContainer}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactRow}>
              <Ionicons name="mail-outline" size={20} color="#6B7280" />
              <Text style={styles.contactText}>{event.contactEmail}</Text>
            </View>
            {event.contactPhone && (
              <View style={styles.contactRow}>
                <Ionicons name="call-outline" size={20} color="#6B7280" />
                <Text style={styles.contactText}>{event.contactPhone}</Text>
              </View>
            )}
          </View>
        </Animatable.View>
      </View>

      {/* Action Buttons */}
      {renderActionButtons()}

      {/* Application Modal */}
      {renderApplicationModal()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventTypeBadge: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,152,0,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  eventTypeBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  content: {
    padding: 24,
  },
  eventHeader: {
    marginBottom: 24,
  },
  eventTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 36,
  },
  organizationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizationAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  organizationName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
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
    color: '#374151',
    marginLeft: 12,
    flex: 1,
  },
  progressContainer: {
    marginBottom: 32,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  descriptionContainer: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  requirementsContainer: {
    marginBottom: 32,
  },
  requirements: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  skillsContainer: {
    marginBottom: 32,
  },
  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  skillBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  skillText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  // Application Preview Styles - NEW
  applicationPreviewContainer: {
    marginBottom: 32,
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewQuestion: {
    marginBottom: 12,
  },
  previewQuestionText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  contactContainer: {
    marginBottom: 32,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 12,
  },
  // Action Buttons - UPDATED
  actionButtons: {
    padding: 24,
    paddingTop: 0,
  },
  applicationButton: {
    backgroundColor: '#FF9800',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  applicationButtonPending: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  applicationButtonApproved: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  applicationButtonRejected: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  applicationButtonWithdrawn: {
    backgroundColor: '#6B7280',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  applicationButtonDisabled: {
    backgroundColor: '#9CA3AF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  applicationButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  applicationStatusContainer: {
    marginBottom: 12,
  },
  withdrawButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  withdrawButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  registerButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  registerButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  unregisterButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#EF4444',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 8,
  },
  unregisterButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#EF4444',
    marginLeft: 8,
  },
  chatButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  chatButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  editButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  editButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6366F1',
    marginLeft: 8,
  },
  organizationNote: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  pastEventNote: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Modal Styles - UPDATED
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  modalHeaderSpacer: {
    width: 40,
  },
  modalContent: {
    flex: 1,
    padding: 24,
  },
  modalEventTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: '#6B7280',
    marginBottom: 24,
    lineHeight: 24,
  },
  questionContainer: {
    marginBottom: 24,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
    lineHeight: 24,
  },
  answerInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#F9FAFB',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginRight: 12,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalSubmitButton: {
    flex: 1,
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginLeft: 12,
  },
  modalSubmitButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  modalSubmitText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

