import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, arrayUnion, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';

// Import local category images
import environmentImg from '../../../assets/images/environmentCat.jpeg';
import educationImg from '../../../assets/images/educationCat.jpeg';
import healthcareImg from '../../../assets/images/healthcareCat.jpeg';

// Local category images mapping (add more as you create the image files)
const localCategoryImages = {
  environment: environmentImg,
  education: educationImg,
  healthcare: healthcareImg,
  // Use existing images as fallbacks for missing categories
  community: environmentImg,
  seniors: healthcareImg,
  animals: environmentImg,
  food: educationImg,
  disaster: healthcareImg,
  technology: educationImg,
};

// Function to get the correct image source
const getEventImageSource = (event) => {
  // If has custom image uploaded to Firebase
  if (event.hasCustomImage && event.imageUrl) {
    return { uri: event.imageUrl };
  }
  
  // Use local default based on category
  if (event.category && localCategoryImages[event.category]) {
    return localCategoryImages[event.category];
  }
  
  // Fallback to environment image
  return environmentImg;
};

export default function EventDetailsScreen({ route, navigation }) {
  const { event: initialEvent } = route.params;
  const { user, registeredEvents, setRegisteredEvents } = useAppContext();
  const [event, setEvent] = useState(initialEvent);

  // Effect to listen for real-time updates to the event document
  useEffect(() => {
    if (!event?.id) return;

    const eventRef = doc(db, 'events', event.id);
    const unsubscribe = onSnapshot(eventRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const updatedEventData = docSnapshot.data();
        // Process the event data to ensure date is a Date object
        const processedEvent = {
          id: docSnapshot.id,
          ...updatedEventData,
          date: updatedEventData.date?.toDate ? updatedEventData.date.toDate() : (updatedEventData.date ? new Date(updatedEventData.date) : null),
        };
        setEvent(processedEvent);
      } else {
        // Event no longer exists, navigate back or show alert
        Alert.alert('Event Not Found', 'This event may have been cancelled or removed.');
        navigation.goBack();
      }
    }, (error) => {
      console.error('Error fetching real-time event updates:', error);
      Alert.alert('Error', 'Failed to get real-time event updates.');
    });

    return () => unsubscribe();
  }, [initialEvent.id, navigation]);

  // Derive isRegistered from the updated event state
  const isRegistered = event.registeredVolunteers?.includes(user?.uid);

  const handleRegister = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to register for events.');
      return;
    }

    try {
      const eventRef = doc(db, 'events', event.id);
      
      if (isRegistered) {
        // Unregister
        await updateDoc(eventRef, {
          registeredVolunteers: arrayRemove(user.uid)
        });
        
        setRegisteredEvents(prev => prev.filter(e => e.id !== event.id));
        Alert.alert('Cancelled', 'Your registration has been cancelled.');
      } else {
        // Register - Check if event is full
        const currentRegistrations = event.registeredVolunteers?.length || 0;
        if (currentRegistrations >= event.maxVolunteers) {
          Alert.alert('Event Full', 'This event is already at maximum capacity.');
          return;
        }

        await updateDoc(eventRef, {
          registeredVolunteers: arrayUnion(user.uid)
        });
        
        setRegisteredEvents(prev => [...prev, event]);
        Alert.alert('Success', 'You have successfully registered for this event!');
      }
    } catch (error) {
      console.error('Error updating registration:', error);
      Alert.alert('Error', 'Failed to update registration. Please try again.');
    }
  };

  const handleGetDirections = () => {
    const url = `https://maps.google.com/?q=${encodeURIComponent(event.location)}`;
    Linking.openURL(url);
  };

  const handleShare = () => {
    Alert.alert('Share Event', 'Share functionality coming soon!');
  };

  const formatDate = (date) => {
    if (!date) return 'TBD';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    if (!date) return 'TBD';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  // Calculate progress
  const currentRegistrations = event.registeredVolunteers?.length || 0;
  const maxRegistrations = event.maxVolunteers || 1;
  const progressPercentage = (currentRegistrations / maxRegistrations) * 100;

  return (
    <ScrollView style={styles.container}>
      <Animatable.View animation="fadeIn" duration={800}>
        {/* Event Image with proper source handling */}
        <Image 
          source={getEventImageSource(event)} 
          style={styles.eventImage}
          onError={(error) => {
            console.log('Image loading error:', error);
          }}
        />
        
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{event.title}</Text>
            <TouchableOpacity
              style={styles.organizationContainer}
              onPress={() => navigation.navigate('OrganizationProfile', { organizationId: event.organizationId })}
            >
              <View style={styles.organizationLogo}>
                <Ionicons name="business" size={20} color="#4CAF50" />
              </View>
              <Text style={styles.organizationName}>
                {event.organizationName || 'Organization'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.badgeText}>
                {event.category ? event.category.charAt(0).toUpperCase() + event.category.slice(1) : 'General'}
              </Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#2196F3' }]}>
              <Text style={styles.badgeText}>
                {event.estimatedHours ? `${event.estimatedHours}h` : 'Duration TBD'}
              </Text>
            </View>
          </View>

          <Text style={styles.description}>
            {event.description || 'No description available.'}
          </Text>

          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#4e8cff" />
              <Text style={styles.detailText}>
                {formatDate(event.date)} at {formatTime(event.date)}
              </Text>
            </View>
            
            <TouchableOpacity style={styles.detailRow} onPress={handleGetDirections}>
              <Ionicons name="location-outline" size={20} color="#4e8cff" />
              <Text style={[styles.detailText, styles.linkText]}>
                {event.location || 'Location TBD'}
              </Text>
            </TouchableOpacity>
            
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color="#4e8cff" />
              <Text style={styles.detailText}>
                Duration: {event.estimatedHours ? `${event.estimatedHours} hours` : 'TBD'}
              </Text>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={20} color="#4e8cff" />
              <Text style={styles.detailText}>
                {currentRegistrations}/{maxRegistrations} volunteers registered
              </Text>
            </View>

            {event.contactEmail ? (
              <View style={styles.detailRow}>
                <Ionicons name="mail-outline" size={20} color="#4e8cff" />
                <Text style={styles.detailText}>{event.contactEmail}</Text>
              </View>
            ) : null}

            {event.contactPhone ? (
              <View style={styles.detailRow}>
                <Ionicons name="call-outline" size={20} color="#4e8cff" />
                <Text style={styles.detailText}>{event.contactPhone}</Text>
              </View>
            ) : null}
          </View>

{event.requirements && typeof event.requirements === 'string' && event.requirements.trim() ? (
  <View style={styles.requirementsSection}>
    <Text style={styles.sectionTitle}>Requirements</Text>
    <View style={styles.requirementItem}>
      <Ionicons name="information-circle-outline" size={16} color="#FF9800" />
      <Text style={styles.requirementText}>{event.requirements}</Text>
    </View>
  </View>
) : null}


          {event.skills && event.skills.length > 0 ? (
            <View style={styles.skillsSection}>
              <Text style={styles.sectionTitle}>Skills Needed</Text>
              <View style={styles.skillsContainer}>
                {event.skills.map((skill, index) => (
                  <View key={index} style={styles.skillBadge}>
                    <Text style={styles.skillText}>{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Registration Progress</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${Math.min(progressPercentage, 100)}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progressPercentage)}% full
              </Text>
            </View>
          </View>
        </View>
      </Animatable.View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.registerButton, isRegistered && styles.registeredButton]}
          onPress={handleRegister}
          disabled={!isRegistered && currentRegistrations >= maxRegistrations}
        >
          <Ionicons
            name={isRegistered ? "checkmark" : currentRegistrations >= maxRegistrations ? "close" : "add"}
            size={20}
            color={isRegistered ? "#4e8cff" : currentRegistrations >= maxRegistrations ? "#999" : "#fff"}
          />
          <Text
            style={[
              styles.registerButtonText,
              isRegistered && styles.registeredButtonText,
              currentRegistrations >= maxRegistrations && styles.disabledButtonText
            ]}
          >
            {isRegistered ? 'Registered' : 
             currentRegistrations >= maxRegistrations ? 'Event Full' : 
             'Register for Event'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#4e8cff" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  eventImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#f0f0f0',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  organizationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizationLogo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  organizationName: {
    fontSize: 16,
    color: '#4e8cff',
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    marginBottom: 15,
    flexWrap: 'wrap',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
    marginBottom: 5,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
    marginBottom: 20,
  },
  detailsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  linkText: {
    color: '#4e8cff',
    textDecorationLine: 'underline',
  },
  requirementsSection: {
    marginBottom: 20,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
    lineHeight: 20,
  },
  skillsSection: {
    marginBottom: 20,
  },
  skillsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 8,
    marginBottom: 8,
  },
  skillText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  progressSection: {
    marginBottom: 20,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CAF50',
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  registeredButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#4e8cff',
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  registeredButtonText: {
    color: '#4e8cff',
  },
  disabledButtonText: {
    color: '#999',
  },
  shareButton: {
    padding: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#4e8cff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
