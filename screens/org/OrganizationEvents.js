// screens/Organization/OrganizationEvents.js
import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

const { width: screenWidth } = Dimensions.get('window');

export default function OrganizationEvents({ navigation }) {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState('all');
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      const cleanup = setupRealtimeListener();
      return cleanup;
    }
  }, [user]);

  useEffect(() => {
    filterEvents();
  }, [events, activeTab, searchQuery]);

  const setupRealtimeListener = () => {
    if (!user?.uid) return () => {};

    const eventsQuery = query(
      collection(db, 'events'),
      where('organizationId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventsData = [];
        snapshot.forEach((doc) => {
          const eventData = doc.data();
          eventsData.push({
            id: doc.id,
            ...eventData,
            date: eventData.date?.toDate ? eventData.date.toDate() : (eventData.date ? new Date(eventData.date) : null),
          });
        });
        setEvents(eventsData);
        setLoading(false);
        setError(null);
      },
      (error) => {
        console.error('Error fetching events:', error);
        setError('Failed to load events');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  };

  const filterEvents = () => {
    let filtered = events;

    // Filter by status
    if (activeTab !== 'all') {
      filtered = filtered.filter(event => event.status === activeTab);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredEvents(filtered);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    // The real-time listener will automatically update the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#4CAF50';
      case 'draft': return '#FF9800';
      case 'completed': return '#666';
      case 'cancelled': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active': return 'Published';
      case 'draft': return 'Draft';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const getEventProgress = (event) => {
    const registered = event.registeredVolunteers?.length || 0;
    const max = event.maxParticipants || 1;
    return (registered / max) * 100;
  };

  const handleEventPress = (event) => {
    navigation.navigate('EventDetails', { event, isOrganization: true });
  };

  const handleCreateEvent = () => {
    navigation.navigate('CreateEvent');
  };

  const handleEditEvent = (event) => {
    navigation.navigate('EditEvent', { eventId: event.id });
  };

  const handleDeleteEvent = (event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'events', event.id));
              Alert.alert('Success', 'Event deleted successfully');
            } catch (error) {
              console.error('Error deleting event:', error);
              Alert.alert('Error', 'Failed to delete event');
            }
          },
        },
      ]
    );
  };

  const handleToggleEventStatus = async (event) => {
    const newStatus = event.status === 'active' ? 'draft' : 'active';
    
    try {
      await updateDoc(doc(db, 'events', event.id), {
        status: newStatus,
        updatedAt: new Date(),
      });
      
      Alert.alert(
        'Status Updated',
        `Event ${newStatus === 'active' ? 'published' : 'unpublished'} successfully`
      );
    } catch (error) {
      console.error('Error updating event status:', error);
      Alert.alert('Error', 'Failed to update event status');
    }
  };

  const formatDate = (date) => {
    if (!date) return 'TBD';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getDaysUntilEvent = (date) => {
    if (!date) return null;
    const today = new Date();
    const eventDate = new Date(date);
    const diffTime = eventDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const renderEventCard = ({ item, index }) => {
    const progress = getEventProgress(item);
    const daysUntil = getDaysUntilEvent(item.date);
    const isUpcoming = daysUntil > 0;
    const isToday = daysUntil === 0;
    const isPast = daysUntil < 0;

    return (
      <Animatable.View
        animation="fadeInUp"
        duration={600}
        delay={index * 100}
        style={styles.eventCard}
      >
        <TouchableOpacity onPress={() => handleEventPress(item)}>
          {/* Event Image with Overlay */}
          <View style={styles.eventImageContainer}>
            <Image 
              source={{ uri: item.image || 'https://via.placeholder.com/300x150' }} 
              style={styles.eventImage} 
            />
            <View style={styles.eventImageOverlay} />
            
            {/* Status Badge */}
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
            </View>

            {/* Urgency Indicator */}
            {isUpcoming && daysUntil <= 7 && (
              <View style={styles.urgencyBadge}>
                <Ionicons name="time" size={12} color="#fff" />
                <Text style={styles.urgencyText}>
                  {daysUntil === 1 ? 'Tomorrow' : `${daysUntil} days`}
                </Text>
              </View>
            )}

            {isToday && (
              <View style={[styles.urgencyBadge, { backgroundColor: '#FF6B35' }]}>
                <Ionicons name="flash" size={12} color="#fff" />
                <Text style={styles.urgencyText}>Today</Text>
              </View>
            )}
          </View>
          
          <View style={styles.eventContent}>
            {/* <View style={styles.eventHeader}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {item.title}
              </Text>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            </View> */}

            {/* Event Details */}
            <View style={styles.eventDetails}>
              <View style={styles.eventDetailRow}>
                <Ionicons name="calendar-outline" size={16} color="#666" />
                <Text style={styles.eventDetailText}>
                  {formatDate(item.date)} at {item.time || 'TBD'}
                </Text>
              </View>
              
              <View style={styles.eventDetailRow}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.eventDetailText} numberOfLines={1}>
                  {item.location || 'Location TBD'}
                </Text>
              </View>
              
              <View style={styles.eventDetailRow}>
                <Ionicons name="people-outline" size={16} color="#666" />
                <Text style={styles.eventDetailText}>
                  {item.registeredVolunteers?.length || 0}/{item.maxParticipants || 0} volunteers
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { 
                      width: `${Math.min(progress, 100)}%`,
                      backgroundColor: progress >= 100 ? '#4CAF50' : '#4e8cff'
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {Math.round(progress)}% filled
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.eventActions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.editButton]}
            onPress={() => handleEditEvent(item)}
          >
            <Ionicons name="create-outline" size={16} color="#4e8cff" />
            <Text style={[styles.actionButtonText, { color: '#4e8cff' }]}>Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.statusButton]}
            onPress={() => handleToggleEventStatus(item)}
          >
            <Ionicons 
              name={item.status === 'active' ? 'pause-outline' : 'play-outline'} 
              size={16} 
              color="#FF9800" 
            />
            <Text style={[styles.actionButtonText, { color: '#FF9800' }]}>
              {item.status === 'active' ? 'Unpublish' : 'Publish'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.analyticsButton]}
            onPress={() => navigation.navigate('EventAnalytics', { eventId: item.id })}
          >
            <Ionicons name="analytics-outline" size={16} color="#4CAF50" />
            <Text style={[styles.actionButtonText, { color: '#4CAF50' }]}>Analytics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteEvent(item)}
          >
            <Ionicons name="trash-outline" size={16} color="#F44336" />
          </TouchableOpacity>
        </View>
      </Animatable.View>
    );
  };

  const renderTabButton = (tab, label, count) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.activeTabButton]}
      onPress={() => setActiveTab(tab)}
    >
      <Text style={[styles.tabButtonText, activeTab === tab && styles.activeTabButtonText]}>
        {label}
      </Text>
      {count > 0 && (
        <View style={[styles.tabBadge, activeTab === tab && styles.activeTabBadge]}>
          <Text style={[styles.tabBadgeText, activeTab === tab && styles.activeTabBadgeText]}>
            {count}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const getTabCounts = () => {
    return {
      all: events.length,
      active: events.filter(e => e.status === 'active').length,
      draft: events.filter(e => e.status === 'draft').length,
      completed: events.filter(e => e.status === 'completed').length,
    };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4e8cff" />
        <Text style={styles.loadingText}>Loading events...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF6B35" />
        <Text style={styles.errorTitle}>Unable to Load Events</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => setError(null)}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const tabCounts = getTabCounts();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>My Events</Text>
            <Text style={styles.headerSubtitle}>
              {events.length} total events • {tabCounts.active} active
            </Text>
          </View>
          <TouchableOpacity style={styles.createButton} onPress={handleCreateEvent}>
            <Ionicons name="add" size={24} color="#4e8cff" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScrollContent}>
          {renderTabButton('all', 'All Events', tabCounts.all)}
          {renderTabButton('active', 'Published', tabCounts.active)}
          {renderTabButton('draft', 'Drafts', tabCounts.draft)}
          {renderTabButton('completed', 'Completed', tabCounts.completed)}
        </ScrollView>
      </View>

      {/* Events List */}
      <FlatList
        data={filteredEvents}
        renderItem={renderEventCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.eventsList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={searchQuery ? "search-outline" : "calendar-outline"} 
              size={64} 
              color="#ccc" 
            />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No Events Found' : 'No Events Yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery 
                ? `No events match "${searchQuery}"`
                : activeTab === 'all' 
                  ? 'Create your first event to get started'
                  : `No ${activeTab} events at the moment`
              }
            </Text>
            {!searchQuery && activeTab === 'all' && (
              <TouchableOpacity style={styles.emptyButton} onPress={handleCreateEvent}>
                <Text style={styles.emptyButtonText}>Create Event</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Loading & Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: '#f8f9fa',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  retryButton: {
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Header
  header: {
    backgroundColor: '#2B2B2B',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  createButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
  },

  // Tabs
  tabContainer: {
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tabScrollContent: {
    paddingHorizontal: 20,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeTabButton: {
    backgroundColor: '#2B2B2B',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#ddd',
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabBadgeText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
  },
  activeTabBadgeText: {
    color: '#fff',
  },

  // Events List
  eventsList: {
    padding: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 15,
    marginBottom: 20,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  // Event Image
  eventImageContainer: {
    position: 'relative',
    height: 140,
  },
  eventImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  eventImageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  urgencyBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  urgencyText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },

  // Event Content
  eventContent: {
    padding: 20,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
    marginRight: 10,
  },
  categoryBadge: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // Event Details
  eventDetails: {
    marginBottom: 15,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  eventDetailText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    flex: 1,
  },

  // Progress
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#f0f0f0',
    borderRadius: 3,
    marginRight: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },

  // Actions
  eventActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  editButton: {
    borderColor: '#4e8cff',
  },
  statusButton: {
    borderColor: '#FF9800',
  },
  analyticsButton: {
    borderColor: '#4CAF50',
  },
  deleteButton: {
    borderColor: '#F44336',
    paddingHorizontal: 8,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  emptyButton: {
    backgroundColor: '#4e8cff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

