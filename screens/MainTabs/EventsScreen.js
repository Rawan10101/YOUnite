import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

export default function EventsScreen({ navigation }) {
  const { user, registeredEvents, setRegisteredEvents } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [events, setEvents] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [newEvents, setNewEvents] = useState([]);
  const [pastEvents, setPastEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const categories = [
    { id: 'all', title: 'All' },
    { id: 'environment', title: 'Environment' },
    { id: 'education', title: 'Education' },
    { id: 'healthcare', title: 'Health' },
    { id: 'animals', title: 'Animals' },
    { id: 'community', title: 'Community' },
    { id: 'emergency', title: 'Emergency' },
  ];

  // Set up real-time listener for events
  useEffect(() => {
    console.log('Setting up events listener...');
    
    const eventsQuery = query(
      collection(db, 'events'),
      orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(eventsQuery, (querySnapshot) => {
      const eventsData = [];
      
      querySnapshot.forEach((doc) => {
        const eventData = doc.data();
        
        const eventDate = eventData.date?.toDate ? eventData.date.toDate() : (eventData.date ? new Date(eventData.date) : null);
        const createdAtDate = eventData.createdAt?.toDate ? eventData.createdAt.toDate() : (eventData.createdAt ? new Date(eventData.createdAt) : null);
        const processedEvent = {
          id: doc.id,
          ...eventData,
          date: eventDate,
          createdAt: createdAtDate,
          organization: eventData.organizationName || 'Organization',
          organizationLogo: eventData.organizationLogo || 'https://via.placeholder.com/50',
          time: eventDate ? 
            eventDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 
            '12:00 PM',
          duration: `${eventData.estimatedHours || 2} hours`,
          participants: eventData.registeredVolunteers?.length || 0,
          maxParticipants: eventData.maxVolunteers || 50,
          isRegistered: eventData.registeredVolunteers?.includes(user?.uid) || false,
          status: getDerivedStatus(eventDate),
          requirements: eventData.requirements?.split(',') || [],
          coordinates: { latitude: 34.0522, longitude: -118.2437 },
          image: eventData.imageUrl || 'https://via.placeholder.com/300x200',
        };
        
        eventsData.push(processedEvent);
      });

      console.log('Events loaded from Firestore:', eventsData.length);
      setEvents(eventsData);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error('Error loading events:', error);
      setLoading(false);
      setRefreshing(false);
      setEvents([]);
    });

    return () => {
      console.log('Cleaning up events listener');
      unsubscribe();
    };
  }, [user?.uid]);

  const getDerivedStatus = (eventDate) => {
    if (!eventDate) return 'unknown';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    
    if (eventDay < today) {
      return 'past';
    } else {
      return 'upcoming';
    }
  };

  // Filter events into categories
  useEffect(() => {
    filterEvents();
  }, [searchQuery, selectedCategory, events]);

  const filterEvents = () => {
    let filteredBySearch = events;

    // Filter by search query first
    if (searchQuery) {
      filteredBySearch = filteredBySearch.filter(event =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.category.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      filteredBySearch = filteredBySearch.filter(event => 
        event.category.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    // Separate into categories
    const upcoming = filteredBySearch.filter(event => event.status === 'upcoming');
    const newEventsFiltered = filteredBySearch.filter(event => event.status === 'upcoming' && !event.isRegistered);
    const past = filteredBySearch.filter(event => event.status === 'past').sort((a, b) => b.date?.getTime() - a.date?.getTime());

    setUpcomingEvents(upcoming);
    setNewEvents(newEventsFiltered);
    setPastEvents(past);
  };

  const handleRegister = async (eventId) => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to register for events.');
      return;
    }

    const event = events.find(e => e.id === eventId);
    if (!event) return;

    try {
      const eventRef = doc(db, 'events', eventId);
      
      if (event.isRegistered) {
        await updateDoc(eventRef, {
          registeredVolunteers: arrayRemove(user.uid)
        });
        
        setRegisteredEvents(prev => prev.filter(e => e.id !== eventId));
        Alert.alert('Cancelled', 'Your registration has been cancelled.');
      } else {
        if (event.participants >= event.maxParticipants) {
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

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };
// Categories Colors
  const getCategoryColor = (category) => {
    switch (category) {
      case 'environment': return '#4CAF50';
      case 'community': return '#2196F3';
      case 'animals': return '#FF9800';
      case 'education': return '#9C27B0';
      case 'healthcare': return '#F44336';
      case 'food': return '#607D8B';
      case 'emergency': return '#F44336';
      case 'seniors': return '#9C27B0';
      default: return '#666';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'TBD';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderEvent = ({ item, index }) => (
    <Animatable.View
      animation="fadeInUp"
      duration={600}
      delay={index * 100}
      style={[
        styles.eventCard,
        item.status === 'past' && styles.pastEventCard,
      ]}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate('EventDetails', { event: item })}
      >
        <Image source={{ uri: item.image }} style={styles.eventImage} />
        
        {item.status === 'past' && (
          <View style={styles.pastEventOverlay}>
            <Text style={styles.pastEventText}>Past Event</Text>
          </View>
        )}

        <View style={styles.eventContent}>
          <View style={styles.eventHeader}>
            <View style={styles.eventTitleContainer}>
              <Text style={styles.eventTitle}>{item.title}</Text>
              <View style={styles.organizationContainer}>
                <Image source={{ uri: item.organizationLogo }} style={styles.organizationLogo} />
                <Text style={styles.organizationName}>{item.organization}</Text>
              </View>
            </View>
            <View style={styles.eventBadges}>
              <View style={[styles.badge, { backgroundColor: getCategoryColor(item.category) }]}>
                <Text style={styles.badgeText}>{item.category}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.eventDescription}>{item.description}</Text>

          <View style={styles.eventDetails}>
            <View style={styles.detailRow}>
              <Ionicons name="calendar-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{formatDate(item.date)} at {item.time}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.location}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time-outline" size={16} color="#666" />
              <Text style={styles.detailText}>{item.duration}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="people-outline" size={16} color="#666" />
              <Text style={styles.detailText}>
                {item.participants}/{item.maxParticipants} participants
              </Text>
            </View>
          </View>

          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min((item.participants / item.maxParticipants) * 100, 100)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressText}>
              {Math.round((item.participants / item.maxParticipants) * 100)}% full
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.eventActions}>
        {item.status === 'upcoming' && (
          <TouchableOpacity
            style={[
              styles.registerButton,
              item.isRegistered && styles.registeredButton,
            ]}
            onPress={() => handleRegister(item.id)}
          >
            <Ionicons
              name={item.isRegistered ? 'checkmark' : 'add'}
              size={16}
              color={item.isRegistered ? '#4e8cff' : '#fff'}
            />
            <Text
              style={[
                styles.registerButtonText,
                item.isRegistered && styles.registeredButtonText,
              ]}
            >
              {item.isRegistered ? 'Registered' : 'Register'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.shareButton}>
          <Ionicons name="share-outline" size={16} color="#4e8cff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.favoriteButton}>
          <Ionicons name="heart-outline" size={16} color="#4e8cff" />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  const renderEmptyCategory = (categoryName) => (
    <View style={styles.emptyCategoryContainer}>
      <Ionicons name="calendar-outline" size={32} color="#ccc" />
      <Text style={styles.emptyCategoryText}>No {categoryName.toLowerCase()} events found</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Search Bar - at the very top */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color="#666" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#666" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Categories Filter */}
      <View style={styles.categoriesContainer}>
        <FlatList
          data={categories}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.categoriesList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryButton,
                selectedCategory === item.id && styles.categoryButtonSelected
              ]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item.id && styles.categoryTextSelected
                ]}
              >
                {item.title}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Scrollable content with event categories */}
      <ScrollView 
        style={styles.scrollContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#4e8cff']}
            tintColor="#4e8cff"
          />
        }
      >
        {/* Upcoming Events Section */}
        <View style={styles.categorySection}>
          <Text style={styles.categoryTitle}>Upcoming Events</Text>
          {upcomingEvents.length > 0 ? (
            <FlatList
              data={upcomingEvents}
              keyExtractor={item => item.id}
              renderItem={renderEvent}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          ) : (
            renderEmptyCategory('upcoming')
          )}
        </View>

        {/* New Events Section */}
        <View style={styles.categorySection}>
          <Text style={styles.categoryTitle}>New Events</Text>
          {newEvents.length > 0 ? (
            <FlatList
              data={newEvents}
              keyExtractor={item => item.id}
              renderItem={renderEvent}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          ) : (
            renderEmptyCategory('new')
          )}
        </View>

        {/* Past Events Section */}
        <View style={styles.categorySection}>
          <Text style={styles.categoryTitle}>Past Events</Text>
          {pastEvents.length > 0 ? (
            <FlatList
              data={pastEvents}
              keyExtractor={item => item.id}
              renderItem={renderEvent}
              horizontal={true}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
            />
          ) : (
            renderEmptyCategory('past')
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
    paddingTop: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF', // White background for search bar
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E5E5E5', // Light border instead of shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    marginLeft: 10,
    color: '#2B2B2B', // Dark text
  },
  categoriesContainer: {
    marginBottom: 10,
  },
  categoriesList: {
    paddingHorizontal: 20,
  },
  categoryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#F5F5F5', // Light gray for unselected categories
    borderRadius: 20,
    marginRight: 10,
  },
  categoryButtonSelected: {
    backgroundColor: '#2B2B2B', // Dark background for selected category
  },
  categoryText: {
    fontSize: 14,
    color: '#2B2B2B', // Dark text for unselected categories
    fontWeight: '500',
  },
  categoryTextSelected: {
    color: '#FFFFFF', // White text for selected category
    fontWeight: '600',
  },
  scrollContainer: {
    flex: 1,
  },
  categorySection: {
    marginVertical: 15,
  },
  categoryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2B2B2B', // Dark text for section titles
    marginLeft: 20,
    marginBottom: 15,
  },
  horizontalList: {
    paddingHorizontal: 20,
  },
  eventCard: {
    width: 260,
    marginRight: 15,
    backgroundColor: '#FFFFFF', // White background for event cards
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5', // Light border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pastEventCard: {
    opacity: 0.7,
  },
  pastEventOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(43,43,43,0.7)', // Dark overlay using #2B2B2B
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  pastEventText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  eventImage: {
    width: '100%',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  eventContent: {
    padding: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  eventTitleContainer: {
    flex: 1,
    marginRight: 10,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B', // Dark text for event titles
    marginBottom: 5,
  },
  organizationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  organizationLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 5,
  },
  organizationName: {
    fontSize: 12,
    color: '#666666', // Medium gray for organization names
  },
  eventBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 5,
    marginBottom: 5,
  },
  badgeText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: 'bold',
  },
  eventDescription: {
    fontSize: 13,
    color: '#666666', // Medium gray for descriptions
    lineHeight: 18,
    marginBottom: 10,
  },
  eventDetails: {
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detailText: {
    fontSize: 13,
    color: '#2B2B2B', // Dark text for detail text
    marginLeft: 8,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E5E5', // Light gray background for progress bar
    borderRadius: 4,
    marginRight: 10,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2B2B2B',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#666666', // Medium gray for progress text
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2B2B', // Dark background for register button
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  registeredButton: {
    backgroundColor: '#FFFFFF', // White background for registered state
    borderWidth: 1,
    borderColor: '#2B2B2B', // Dark border
  },
  registerButtonText: {
    color: '#FFFFFF', // White text for register button
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
  },
  registeredButtonText: {
    color: '#2B2B2B', // Dark text for registered button
  },
  shareButton: {
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2B2B2B', // Dark border
    marginRight: 10,
  },
  favoriteButton: {
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2B2B2B', // Dark border
  },
  emptyCategoryContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyCategoryText: {
    fontSize: 16,
    color: '#666666', // Medium gray for empty state text
    marginTop: 10,
    textAlign: 'center',
  },
});

