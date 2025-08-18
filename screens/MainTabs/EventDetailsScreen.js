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
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

export default function EventDetailsScreen({ route, navigation }) {
  const { event: initialEvent } = route.params; // Rename to initialEvent
  const { user, registeredEvents, setRegisteredEvents } = useAppContext();
  const [event, setEvent] = useState(initialEvent); // Use state to hold event data

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
  }, [initialEvent.id, navigation]); // Depend on initialEvent.id and navigation

  // Derive isRegistered from the updated event state and registeredEvents context
  // Prioritize the real-time data from 'event.registeredVolunteers'
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
        
        // Update local context only if the real-time update hasn't propagated yet
        setRegisteredEvents(prev => prev.filter(e => e.id !== event.id));
        Alert.alert('Cancelled', 'Your registration has been cancelled.');
      } else {
        // Register
        // Check if event is full before registering
        if (event.participants >= event.maxParticipants) {
          Alert.alert('Event Full', 'This event is already at maximum capacity.');
          return;
        }

        await updateDoc(eventRef, {
          registeredVolunteers: arrayUnion(user.uid)
        });
        
        // Update local context only if the real-time update hasn't propagated yet
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

  return (
    <ScrollView style={styles.container}>
      <Animatable.View animation="fadeIn" duration={800}>
        <Image source={{ uri: event.image }} style={styles.eventImage} />
        
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{event.title}</Text>
            <TouchableOpacity
              style={styles.organizationContainer}
              onPress={() => navigation.navigate('OrganizationDetails', { organization: event.organization })}
            >
              <Image source={{ uri: event.organizationLogo }} style={styles.organizationLogo} />
              <Text style={styles.organizationName}>{event.organization}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.badgeText}>{event.category}</Text>
            </View>
           
          </View>

          <Text style={styles.description}>{event.description}</Text>

          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={20} color="#4e8cff" />
              <Text style={styles.detailText}>{formatDate(event.date)} at {event.time}</Text>
            </View>
            
            <TouchableOpacity style={styles.detailRow} onPress={handleGetDirections}>
              <Ionicons name="location-outline" size={20} color="#4e8cff" />
              <Text style={[styles.detailText, styles.linkText]}>{event.location}</Text>
            </TouchableOpacity>
            
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={20} color="#4e8cff" />
              <Text style={styles.detailText}>Duration: {event.duration}</Text>
            </View>
            
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={20} color="#4e8cff" />
              <Text style={styles.detailText}>
                {event.participants}/{event.maxParticipants} participants
              </Text>
            </View>
          </View>

          {event.requirements && event.requirements.length > 0 && (
            <View style={styles.requirementsSection}>
              <Text style={styles.sectionTitle}>Requirements</Text>
              {event.requirements.map((requirement, index) => (
                <View key={index} style={styles.requirementItem}>
                  <Ionicons name="checkmark-circle-outline" size={16} color="#4CAF50" />
                  <Text style={styles.requirementText}>{requirement}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.progressSection}>
            <Text style={styles.sectionTitle}>Registration Progress</Text>
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(event.participants / event.maxParticipants) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round((event.participants / event.maxParticipants) * 100)}% full
              </Text>
            </View>
          </View>
        </View>
      </Animatable.View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={[styles.registerButton, isRegistered && styles.registeredButton]}
          onPress={handleRegister}
        >
          <Ionicons
            name={isRegistered ? "checkmark" : "add"}
            size={20}
            color={isRegistered ? "#4e8cff" : "#fff"}
          />
          <Text
            style={[
              styles.registerButtonText,
              isRegistered && styles.registeredButtonText,
            ]}
          >
            {isRegistered ? 'Registered' : 'Register for Event'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
          <Ionicons name="share-outline" size={20} color="#4e8cff" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// Add all the missing styles here:
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  eventImage: {
    width: '100%',
    height: 250,
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
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    marginRight: 10,
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
    marginBottom: 10,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    flex: 1,
  },
  linkText: {
    color: '#2B2B2B',
    textDecorationLine: 'underline',
  },
  requirementsSection: {
    marginBottom: 20,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
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
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2B2B2B',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
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
    backgroundColor: '#2B2B2B',
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
    color: '#2B2B2B',
  },
  shareButton: {
    padding: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    justifyContent: 'center',
    alignItems: 'center',
  },
});


