import { Ionicons } from '@expo/vector-icons';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, ref } from "firebase/storage";
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
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../contexts/AppContext';
import { db, storage } from '../../firebaseConfig';

// Import all local category images
import educationImg from '../../assets/images/educationCat.jpeg';
import environmentImg from '../../assets/images/environmentCat.jpeg';
import healthcareImg from '../../assets/images/healthcareCat.jpeg';

const localCategoryImages = {
  environment: environmentImg,
  education: educationImg,
  healthcare: healthcareImg,
};

const { width: screenWidth } = Dimensions.get('window');

// --- Helper Component: Event Card ---
const EventCard = ({ item, index, navigation, onDelete, onToggleStatus }) => {
  const [menuVisible, setMenuVisible] = useState(false);

  const toggleMenu = () => setMenuVisible(!menuVisible);
  const closeMenu = () => setMenuVisible(false);

  const getEventProgress = (event) => {
    const registered = event.registeredVolunteers?.length || 0;
    const max = event.maxVolunteers || 1;
    return (registered / max) * 100;
  };

  const formatDate = (date) => {
    if (!date) return 'TBD';
    const dateObj = date.toDate ? date.toDate() : new Date(date);
    return dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const getImageSource = (event) => {
    if (event.hasCustomImage && event.imageUrl) {
      return { uri: event.imageUrl };
    }
    if (event?.category && localCategoryImages[event.category]) {
      return localCategoryImages[event.category];
    }
    return localCategoryImages.environment;
  };

  const progress = getEventProgress(item);
  const participantCount = item.registeredVolunteers?.length || 0;

  // Determine badge color
  let statusColor = '#6B7280';
  let statusText = 'Unknown';
  
  if (item.status === 'active') {
    statusColor = '#10B981'; // Green
    statusText = 'Published';
  } else if (item.status === 'draft') {
    statusColor = '#F59E0B'; // Orange
    statusText = 'Draft';
  } else if (item.status === 'completed') {
    statusColor = '#3B82F6'; // Blue
    statusText = 'Completed';
  }

  return (
    <Animatable.View 
      animation="fadeInUp" 
      duration={500} 
      delay={index * 100} 
      // Important: zIndex ensures menu pops over other cards
      style={[styles.cardContainer, { zIndex: menuVisible ? 1000 : 1 }]} 
    >
      <TouchableWithoutFeedback onPress={closeMenu}>
        <View>
          {/* Image Section */}
          <View style={styles.cardImageContainer}>
            <Image source={getImageSource(item)} style={styles.cardImage} />
            <View style={styles.imageOverlay} />
            
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>

            <TouchableOpacity style={styles.kebabButton} onPress={toggleMenu}>
              <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Menu Dropdown - Moved OUTSIDE image container so it isn't clipped */}
          {menuVisible && (
            <Animatable.View animation="fadeIn" duration={200} style={styles.menuDropdown}>
              {item.status !== 'completed' && (
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={() => { closeMenu(); onToggleStatus(item); }}
                >
                  <Ionicons name={item.status === 'active' ? "eye-off-outline" : "eye-outline"} size={18} color="#4B5563" />
                  <Text style={styles.menuText}>{item.status === 'active' ? 'Unpublish' : 'Publish'}</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => { closeMenu(); navigation.navigate('EventAnalytics', { eventId: item.id }); }}
              >
                <Ionicons name="bar-chart-outline" size={18} color="#4B5563" />
                <Text style={styles.menuText}>Analytics</Text>
              </TouchableOpacity>

              <View style={styles.menuDivider} />

              <TouchableOpacity 
                style={styles.menuItem} 
                onPress={() => { closeMenu(); onDelete(item); }}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={[styles.menuText, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            </Animatable.View>
          )}

          {/* Content Section */}
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            
            <View style={styles.metaRow}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText}>{formatDate(item.date)}</Text>
              <Text style={styles.metaDivider}>|</Text>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.metaText} numberOfLines={1}>{item.location || 'Location TBD'}</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { width: `${Math.min(progress, 100)}%`, backgroundColor: progress >= 100 ? '#10B981' : '#3B82F6' }
                  ]} 
                />
              </View>
              <Text style={styles.progressLabel}>{participantCount}/{item.maxVolunteers || 0} Volunteers</Text>
            </View>

            {/* Primary Action Button */}
            <TouchableOpacity 
              style={styles.manageButton}
              onPress={() => navigation.navigate('EventDetails', { event: item, isOrganization: true })}
            >
              <Text style={styles.manageButtonText}>Manage Event</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Animatable.View>
  );
};

// --- Main Screen Component ---

export default function OrganizationEvents({ navigation }) {
  const { user } = useAppContext();
  const [activeTab, setActiveTab] = useState('all');
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  const fetchStorageDownloadURL = async (event) => {
    if (event.hasCustomImage && event.imageUrl && !event.imageUrl.startsWith('http')) {
      try {
        const imageRef = ref(storage, event.imageUrl);
        return await getDownloadURL(imageRef);
      } catch (e) {
        return null;
      }
    }
    return event.imageUrl || null;
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  useEffect(() => {
    if (!user?.uid) return;

    const eventsQuery = query(
      collection(db, 'events'),
      where('organizationId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(eventsQuery, async (snapshot) => {
      const eventsData = [];
      const now = new Date();

      for (const docSnap of snapshot.docs) {
        let eventData = docSnap.data();
        const imageUrl = await fetchStorageDownloadURL(eventData);
        
        // Convert timestamp to Date object
        const eventDate = eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date);

        // --- AUTO-COMPLETE LOGIC ---
        // If the event date has passed and status is not 'completed', update it.
        if (eventDate < now && eventData.status !== 'completed' && eventData.status !== 'cancelled') {
          try {
            // Update Firestore (this triggers a snapshot update again, ensuring consistency)
            await updateDoc(doc(db, 'events', docSnap.id), { status: 'completed' });
            // Update local variable for immediate display
            eventData.status = 'completed';
          } catch (err) {
            console.error("Error auto-completing event:", err);
          }
        }

        eventsData.push({
          id: docSnap.id,
          ...eventData,
          imageUrl,
          date: eventDate,
        });
      }

      setEvents(eventsData);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching events:', err);
      setError('Failed to load events');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    let filtered = events;
    
    // Filter by Tab
    if (activeTab !== 'all') {
      filtered = filtered.filter((event) => event.status === activeTab);
    }

    // Filter by Search
    if (searchQuery.trim()) {
      filtered = filtered.filter((event) =>
        (event.title && event.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (event.category && event.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (event.location && event.location.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    setFilteredEvents(filtered);
  }, [events, activeTab, searchQuery]);

  const handleDeleteEvent = (event) => {
    Alert.alert(
      'Delete Event',
      `Are you sure you want to delete "${event.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'events', event.id));
            } catch (error) {
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
    } catch (error) {
      Alert.alert('Error', 'Failed to update status');
    }
  };

  const renderTab = (key, label) => (
    <TouchableOpacity
      style={[styles.tab, activeTab === key && styles.activeTab]}
      onPress={() => setActiveTab(key)}
    >
      <Text style={[styles.tabText, activeTab === key && styles.activeTabText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* 1. Header */}
      <View style={styles.header}>
        {/* <Text style={styles.screenTitle}>Events</Text> */}
        
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search events..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
           {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            )}
        </View>

        {/* Filter Tabs */}
        <View style={styles.tabsContainer}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingRight: 20 }}
          >
            {renderTab('all', 'All')}
            {renderTab('active', 'Published')}
            {renderTab('draft', 'Drafts')}
            {renderTab('completed', 'Completed')}
          </ScrollView>
        </View>
      </View>

      {/* 2. List */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#10B981" />
        </View>
      ) : (
        <FlatList
          data={filteredEvents}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <EventCard 
              item={item} 
              index={index} 
              navigation={navigation}
              onDelete={handleDeleteEvent}
              onToggleStatus={handleToggleEventStatus}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-clear-outline" size={64} color="#E5E7EB" />
              <Text style={styles.emptyText}>No events found</Text>
            </View>
          }
        />
      )}

      {/* 3. FAB */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('CreateEvent')}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Header
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 45,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    paddingBottom: 10,
  },
  screenTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 15,
    letterSpacing: -0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 48,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    height: '100%',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  tab: {
    marginRight: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  activeTab: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },

  // List & FAB
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },

  // Card
  cardContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  cardImageContainer: {
    height: 160,
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  kebabButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  
  // Menu
  menuDropdown: {
    position: 'absolute',
    top: 45, // Adjusted position
    right: 12,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 4,
    width: 160,
    zIndex: 9999, // Super high Z-index
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  menuText: {
    marginLeft: 12,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },

  // Card Content
  cardContent: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  metaText: {
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 6,
    fontWeight: '500',
  },
  metaDivider: {
    marginHorizontal: 10,
    color: '#D1D5DB',
    fontSize: 12,
  },
  
  // Progress
  progressContainer: {
    marginBottom: 20,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressLabel: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Manage Button
  manageButton: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  manageButtonText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 14,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    marginTop: 60,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
    marginTop: 10,
    fontWeight: '500',
  },
});