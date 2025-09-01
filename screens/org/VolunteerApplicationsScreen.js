import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

const STATUS_COLORS = {
  pending: '#FF9800',
  approved: '#4CAF50',
  rejected: '#F44336',
  withdrawn: '#666',
};

const STATUS_ICONS = {
  pending: 'time-outline',
  approved: 'checkmark-circle-outline',
  rejected: 'close-circle-outline',
  withdrawn: 'remove-circle-outline',
};

export default function VolunteerApplicationsScreen({ navigation }) {
  const { user } = useAppContext();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    loadApplications();
  }, [user?.uid]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      console.log('Loading applications for volunteer:', user.uid);

      // Get all events first
      const eventsQuery = collection(db, 'events');
      const eventsSnapshot = await getDocs(eventsQuery);
      
      const allApplications = [];

      // For each event, check if the volunteer has applied
      for (const eventDoc of eventsSnapshot.docs) {
        const eventId = eventDoc.id;
        const eventData = eventDoc.data();

        try {
          // Get applications subcollection for this event
          const applicationsQuery = query(
            collection(db, 'events', eventId, 'applications'),
            where('volunteerId', '==', user.uid)
          );
          
          const applicationsSnapshot = await getDocs(applicationsQuery);
          
          applicationsSnapshot.forEach(appDoc => {
            const appData = appDoc.data();
            allApplications.push({
              id: appDoc.id,
              ...appData,
              eventId: eventId,
              eventTitle: eventData.title || 'Unknown Event',
              eventDate: eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date),
              eventLocation: eventData.location || 'Location TBD',
              eventOrganization: eventData.organizationName || 'Unknown Organization',
              eventOrganizationLogo: eventData.organizationLogo || 'https://via.placeholder.com/40',
              eventCategory: eventData.category || 'general',
              eventMaxVolunteers: eventData.maxVolunteers || 0,
              eventCurrentVolunteers: eventData.registeredVolunteers?.length || 0,
            });
          });
        } catch (error) {
          console.error(`Error loading applications for event ${eventId}:`, error);
        }
      }

      // Sort by application date (most recent first)
      allApplications.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
        return dateB - dateA;
      });

      setApplications(allApplications);
      console.log(`Loaded ${allApplications.length} applications`);

    } catch (error) {
      console.error('Error loading applications:', error);
      Alert.alert('Error', 'Failed to load applications. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadApplications();
  };

  const getFilteredApplications = () => {
    if (selectedStatus === 'all') {
      return applications;
    }
    return applications.filter(app => app.status === selectedStatus);
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'withdrawn': return 'Withdrawn';
      default: return 'Unknown';
    }
  };

  const formatDate = (date) => {
    if (!date) return 'Unknown date';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventStatus = (eventDate) => {
    if (!eventDate) return 'unknown';
    const now = new Date();
    const diffTime = eventDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'past';
    if (diffDays === 0) return 'today';
    if (diffDays <= 7) return 'soon';
    return 'upcoming';
  };

  const getEventStatusColor = (status) => {
    switch (status) {
      case 'past': return '#666';
      case 'today': return '#FF6B35';
      case 'soon': return '#FF9800';
      case 'upcoming': return '#4e8cff';
      default: return '#666';
    }
  };

  const handleViewEvent = (application) => {
    // Navigate to event details
    navigation.navigate('EventDetails', { 
      event: {
        id: application.eventId,
        title: application.eventTitle,
        date: application.eventDate,
        location: application.eventLocation,
        organizationName: application.eventOrganization,
        organizationLogo: application.eventOrganizationLogo,
        category: application.eventCategory,
        maxVolunteers: application.eventMaxVolunteers,
        registeredVolunteers: Array(application.eventCurrentVolunteers).fill(''),
      }
    });
  };

  const handleWithdrawApplication = (application) => {
    Alert.alert(
      'Withdraw Application',
      `Are you sure you want to withdraw your application for "${application.eventTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'destructive',
          onPress: async () => {
            try {
              // TODO: Implement withdrawal logic
              console.log('Withdraw application:', application.id);
              Alert.alert('Success', 'Application withdrawn successfully');
              loadApplications(); // Refresh the list
            } catch (error) {
              console.error('Error withdrawing application:', error);
              Alert.alert('Error', 'Failed to withdraw application');
            }
          },
        },
      ]
    );
  };

  const renderStatusFilter = () => {
    const statusOptions = [
      { key: 'all', label: 'All', count: applications.length },
      { key: 'pending', label: 'Pending', count: applications.filter(a => a.status === 'pending').length },
      { key: 'approved', label: 'Approved', count: applications.filter(a => a.status === 'approved').length },
      { key: 'rejected', label: 'Rejected', count: applications.filter(a => a.status === 'rejected').length },
    ];

    return (
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {statusOptions.map(option => (
            <TouchableOpacity
              key={option.key}
              style={[
                styles.filterButton,
                selectedStatus === option.key && styles.activeFilterButton
              ]}
              onPress={() => setSelectedStatus(option.key)}
            >
              <Text style={[
                styles.filterButtonText,
                selectedStatus === option.key && styles.activeFilterButtonText
              ]}>
                {option.label}
              </Text>
              {option.count > 0 && (
                <View style={[
                  styles.filterBadge,
                  selectedStatus === option.key && styles.activeFilterBadge
                ]}>
                  <Text style={[
                    styles.filterBadgeText,
                    selectedStatus === option.key && styles.activeFilterBadgeText
                  ]}>
                    {option.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderApplicationCard = ({ item, index }) => {
    const eventStatus = getEventStatus(item.eventDate);
    const canWithdraw = item.status === 'pending' && eventStatus !== 'past';

    return (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 100}
        style={styles.applicationCard}
      >
        {/* Application Header */}
        <View style={styles.applicationHeader}>
          <Image
            source={{ uri: item.eventOrganizationLogo }}
            style={styles.organizationLogo}
          />
          <View style={styles.applicationHeaderInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {item.eventTitle}
            </Text>
            <Text style={styles.organizationName}>
              {item.eventOrganization}
            </Text>
            <Text style={styles.applicationDate}>
              Applied: {formatDate(item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt))}
            </Text>
          </View>
          
          {/* Status Badge */}
          <View style={[
            styles.statusBadge,
            { backgroundColor: STATUS_COLORS[item.status] || STATUS_COLORS.pending }
          ]}>
            <Ionicons 
              name={STATUS_ICONS[item.status] || STATUS_ICONS.pending} 
              size={12} 
              color="#fff" 
            />
            <Text style={styles.statusText}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>

        {/* Event Details */}
        <View style={styles.eventDetails}>
          <View style={styles.eventDetailRow}>
            <Ionicons name="calendar-outline" size={16} color="#666" />
            <Text style={styles.eventDetailText}>
              {item.eventDate ? formatDate(item.eventDate) : 'Date TBD'}
            </Text>
            <View style={[
              styles.eventStatusBadge,
              { backgroundColor: getEventStatusColor(eventStatus) }
            ]}>
              <Text style={styles.eventStatusText}>
                {eventStatus === 'past' ? 'Past' : 
                 eventStatus === 'today' ? 'Today' :
                 eventStatus === 'soon' ? 'Soon' : 'Upcoming'}
              </Text>
            </View>
          </View>
          
          <View style={styles.eventDetailRow}>
            <Ionicons name="location-outline" size={16} color="#666" />
            <Text style={styles.eventDetailText} numberOfLines={1}>
              {item.eventLocation}
            </Text>
          </View>
          
          <View style={styles.eventDetailRow}>
            <Ionicons name="people-outline" size={16} color="#666" />
            <Text style={styles.eventDetailText}>
              {item.eventCurrentVolunteers}/{item.eventMaxVolunteers} volunteers
            </Text>
          </View>
        </View>

        {/* Application Message */}
        {item.message && (
          <View style={styles.messageContainer}>
            <Text style={styles.messageLabel}>Your message:</Text>
            <Text style={styles.messageText} numberOfLines={3}>
              {item.message}
            </Text>
          </View>
        )}

        {/* Response from Organization */}
        {item.response && (
          <View style={styles.responseContainer}>
            <Text style={styles.responseLabel}>Organization response:</Text>
            <Text style={styles.responseText} numberOfLines={3}>
              {item.response}
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.viewEventButton}
            onPress={() => handleViewEvent(item)}
          >
            <Ionicons name="eye-outline" size={16} color="#4e8cff" />
            <Text style={styles.viewEventButtonText}>View Event</Text>
          </TouchableOpacity>
          
          {canWithdraw && (
            <TouchableOpacity
              style={styles.withdrawButton}
              onPress={() => handleWithdrawApplication(item)}
            >
              <Ionicons name="close-outline" size={16} color="#F44336" />
              <Text style={styles.withdrawButtonText}>Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animatable.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4e8cff" />
        <Text style={styles.loadingText}>Loading your applications...</Text>
      </View>
    );
  }

  const filteredApplications = getFilteredApplications();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Applications</Text>
        <Text style={styles.headerSubtitle}>
          Track your volunteer applications
        </Text>
      </View>

      {/* Status Filter */}
      {renderStatusFilter()}

      {/* Applications List */}
      <FlatList
        data={filteredApplications}
        keyExtractor={(item) => `${item.eventId}-${item.id}`}
        renderItem={renderApplicationCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={selectedStatus === 'all' ? 'document-text-outline' : 'filter-outline'} 
              size={64} 
              color="#ccc" 
            />
            <Text style={styles.emptyText}>
              {selectedStatus === 'all' 
                ? 'No applications yet'
                : `No ${selectedStatus} applications`
              }
            </Text>
            <Text style={styles.emptySubtext}>
              {selectedStatus === 'all'
                ? 'Apply to events to see your applications here'
                : 'Try selecting a different status filter'
              }
            </Text>
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

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },

  // Filter
  filterContainer: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginRight: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  activeFilterButton: {
    backgroundColor: '#4e8cff',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeFilterButtonText: {
    color: '#fff',
  },
  filterBadge: {
    backgroundColor: '#666',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  activeFilterBadge: {
    backgroundColor: '#fff',
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  activeFilterBadgeText: {
    color: '#4e8cff',
  },

  // List
  listContainer: {
    padding: 20,
  },

  // Application Card
  applicationCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  // Application Header
  applicationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  organizationLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  applicationHeaderInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  applicationDate: {
    fontSize: 12,
    color: '#999',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
  },

  // Event Details
  eventDetails: {
    marginBottom: 16,
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
  eventStatusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  eventStatusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },

  // Message
  messageContainer: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },

  // Response
  responseContainer: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 4,
  },
  responseText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
  },

  // Action Buttons
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  viewEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
  },
  viewEventButtonText: {
    color: '#4e8cff',
    fontWeight: '600',
    marginLeft: 4,
  },
  withdrawButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
  },
  withdrawButtonText: {
    color: '#F44336',
    fontWeight: '600',
    marginLeft: 4,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
});

