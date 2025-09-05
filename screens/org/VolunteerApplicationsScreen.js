import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

export default function VolunteerApplicationsScreen({ navigation }) {
  const { user } = useAppContext();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState('all');

  const filters = [
    { id: 'all', title: 'All', icon: 'list-outline' },
    { id: 'pending', title: 'Pending', icon: 'time-outline' },
    { id: 'approved', title: 'Approved', icon: 'checkmark-circle-outline' },
    { id: 'rejected', title: 'Rejected', icon: 'close-circle-outline' },
  ];

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    loadApplications();
  }, [user?.uid]);

  const loadApplications = async () => {
    console.log("Loading volunteer applications for:", user.uid);
    setLoading(true);

    try {
      const eventsRef = collection(db, "events");
      const eventsSnapshot = await getDocs(eventsRef);

      const allApplications = [];

      for (const eventDoc of eventsSnapshot.docs) {
        const eventData = eventDoc.data();
        const eventId = eventDoc.id;

        try {
          const applicationsQuery = query(
            collection(db, "events", eventId, "applications"),
            where("volunteerId", "==", user.uid)
          );

          const applicationsSnapshot = await getDocs(applicationsQuery);

          applicationsSnapshot.forEach((appDoc) => {
            const appData = appDoc.data();
            allApplications.push({
              id: appDoc.id,
              ...appData,
              eventId,
              eventTitle: eventData.title,
              eventDate: eventData.date,
              eventLocation: eventData.location,
              eventCategory: eventData.category,
              organizationName: eventData.organizationName || "Organization",
              organizationLogo: eventData.organizationLogo || "https://via.placeholder.com/50",
              requiresApplication: eventData.requiresApplication,
              isApproved: eventData.approvedApplicants?.includes(user.uid) || false,
              isRegistered: eventData.registeredVolunteers?.includes(user.uid) || false,
            });
          });
        } catch (error) {
          console.error(`Error loading applications for event ${eventId}:`, error);
        }
      }

      // Sort by creation date (newest first)
      allApplications.sort((a, b) => {
        const aDate = a.createdAt?.seconds
          ? new Date(a.createdAt.seconds * 1000)
          : new Date(0);
        const bDate = b.createdAt?.seconds
          ? new Date(b.createdAt.seconds * 1000)
          : new Date(0);
        return bDate - aDate;
      });

      setApplications(allApplications);
      console.log(`Loaded ${allApplications.length} applications for volunteer`);
    } catch (error) {
      console.error("Error loading applications:", error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredApplications = () => {
    if (selectedFilter === 'all') {
      return applications;
    }
    return applications.filter(app => app.status === selectedFilter);
  };

  const getApplicationStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'withdrawn': return '#6B7280';
      case 'pending':
      default: return '#F59E0B';
    }
  };

  const getApplicationStatusText = (status) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'withdrawn': return 'Withdrawn';
      case 'pending':
      default: return 'Pending Review';
    }
  };

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
    const dateObj = date.seconds ? new Date(date.seconds * 1000) : (date.toDate ? date.toDate() : new Date(date));
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const renderFilterTabs = () => (
    <View style={styles.filtersContainer}>
      <FlatList
        data={filters}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.filtersList}
        renderItem={({ item }) => {
          const count = item.id === 'all' 
            ? applications.length 
            : applications.filter(app => app.status === item.id).length;
          
          return (
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedFilter === item.id && styles.filterButtonSelected
              ]}
              onPress={() => setSelectedFilter(item.id)}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={selectedFilter === item.id ? '#FFFFFF' : '#6B7280'}
              />
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === item.id && styles.filterTextSelected
                ]}
              >
                {item.title}
              </Text>
              {count > 0 && (
                <View style={[
                  styles.filterBadge,
                  selectedFilter === item.id && styles.filterBadgeSelected
                ]}>
                  <Text style={[
                    styles.filterBadgeText,
                    selectedFilter === item.id && styles.filterBadgeTextSelected
                  ]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );

  const renderApplicationCard = ({ item }) => (
    <TouchableOpacity
      style={styles.applicationCard}
      onPress={() => navigation.navigate('EventDetails', { 
        event: {
          id: item.eventId,
          title: item.eventTitle,
          date: item.eventDate,
          location: item.eventLocation,
          category: item.eventCategory,
          organization: item.organizationName,
          organizationLogo: item.organizationLogo,
          requiresApplication: item.requiresApplication,
        }
      })}
    >
      <View style={styles.applicationHeader}>
        <View style={styles.applicationInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>
            {item.eventTitle}
          </Text>
          <Text style={styles.organizationName}>{item.organizationName}</Text>
          <View style={styles.eventDetails}>
            <View style={styles.eventDetailItem}>
              <Ionicons name="calendar-outline" size={14} color="#6B7280" />
              <Text style={styles.eventDetailText}>{formatDate(item.eventDate)}</Text>
            </View>
            <View style={styles.eventDetailItem}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.eventDetailText} numberOfLines={1}>
                {item.eventLocation}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.applicationMeta}>
          <View style={[
            styles.statusBadge,
            { backgroundColor: getApplicationStatusColor(item.status) }
          ]}>
            <Text style={styles.statusText}>
              {getApplicationStatusText(item.status)}
            </Text>
          </View>
          
          {item.eventCategory && (
            <View style={[
              styles.categoryBadge,
              { backgroundColor: getCategoryColor(item.eventCategory) }
            ]}>
              <Text style={styles.categoryText}>{item.eventCategory}</Text>
            </View>
          )}
        </View>
      </View>
      
      {/* Application Status Details - ENHANCED */}
      <View style={styles.applicationStatusDetails}>
        <Text style={styles.applicationDate}>
          Applied: {formatDate(item.createdAt)}
        </Text>
        
        {item.status === 'approved' && item.approvedAt && (
          <Text style={styles.approvedDate}>
            Approved: {formatDate(item.approvedAt)}
          </Text>
        )}
        
        {item.status === 'rejected' && item.rejectedAt && (
          <Text style={styles.rejectedDate}>
            Rejected: {formatDate(item.rejectedAt)}
          </Text>
        )}

        {/* Registration Status for Approved Applications */}
        {item.status === 'approved' && (
          <View style={styles.registrationStatus}>
            {item.isRegistered ? (
              <View style={styles.registeredIndicator}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={styles.registeredText}>Registered for Event</Text>
              </View>
            ) : (
              <View style={styles.notRegisteredIndicator}>
                <Ionicons name="alert-circle" size={16} color="#F59E0B" />
                <Text style={styles.notRegisteredText}>Not Registered Yet</Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Application Answers Preview - NEW */}
      {item.answers && Object.keys(item.answers).length > 0 && (
        <View style={styles.answersPreview}>
          <Text style={styles.answersLabel}>Your Responses:</Text>
          {Object.entries(item.answers).slice(0, 2).map(([questionIndex, answer]) => (
            <View key={questionIndex} style={styles.answerPreview}>
              <Text style={styles.answerText} numberOfLines={2}>
                {answer}
              </Text>
            </View>
          ))}
          {Object.keys(item.answers).length > 2 && (
            <Text style={styles.moreAnswers}>
              +{Object.keys(item.answers).length - 2} more responses
            </Text>
          )}
        </View>
      )}
      
      <View style={styles.applicationFooter}>
        <View style={styles.applicationActions}>
          <TouchableOpacity
            style={styles.viewEventButton}
            onPress={() => navigation.navigate('EventDetails', { 
              event: {
                id: item.eventId,
                title: item.eventTitle,
                date: item.eventDate,
                location: item.eventLocation,
                category: item.eventCategory,
                organization: item.organizationName,
                organizationLogo: item.organizationLogo,
                requiresApplication: item.requiresApplication,
              }
            })}
          >
            <Ionicons name="eye-outline" size={16} color="#6366F1" />
            <Text style={styles.viewEventText}>View Event</Text>
          </TouchableOpacity>

          {/* Action Button Based on Status */}
          {item.status === 'approved' && !item.isRegistered && (
            <TouchableOpacity
              style={styles.registerNowButton}
              onPress={() => navigation.navigate('EventDetails', { 
                event: {
                  id: item.eventId,
                  title: item.eventTitle,
                  date: item.eventDate,
                  location: item.eventLocation,
                  category: item.eventCategory,
                  organization: item.organizationName,
                  organizationLogo: item.organizationLogo,
                  requiresApplication: item.requiresApplication,
                }
              })}
            >
              <Ionicons name="person-add-outline" size={16} color="#10B981" />
              <Text style={styles.registerNowText}>Register Now</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
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
          Track your event applications and status
        </Text>
      </View>

      {/* Filter Tabs */}
      {renderFilterTabs()}

      {/* Applications List */}
      {filteredApplications.length > 0 ? (
        <FlatList
          data={filteredApplications}
          keyExtractor={item => item.id}
          renderItem={renderApplicationCard}
          contentContainerStyle={styles.applicationsList}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons 
            name="document-text-outline" 
            size={64} 
            color="#D1D5DB" 
          />
          <Text style={styles.emptyTitle}>
            {selectedFilter === 'all' 
              ? 'No Applications Yet' 
              : `No ${selectedFilter.charAt(0).toUpperCase() + selectedFilter.slice(1)} Applications`
            }
          </Text>
          <Text style={styles.emptyText}>
            {selectedFilter === 'all'
              ? 'Apply to events that require applications to see them here.'
              : `You don't have any ${selectedFilter} applications at the moment.`
            }
          </Text>
          {selectedFilter === 'all' && (
            <TouchableOpacity
              style={styles.browseEventsButton}
              onPress={() => navigation.navigate('Events')}
            >
              <Ionicons name="search-outline" size={16} color="#FFFFFF" />
              <Text style={styles.browseEventsText}>Browse Events</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#111827',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '400',
  },

  // Filters
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filtersList: {
    paddingHorizontal: 24,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  filterButtonSelected: {
    backgroundColor: '#6366F1',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
    marginLeft: 6,
  },
  filterTextSelected: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
    minWidth: 20,
    alignItems: 'center',
  },
  filterBadgeSelected: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  filterBadgeTextSelected: {
    color: '#FFFFFF',
  },

  // Applications List
  applicationsList: {
    padding: 24,
  },
  separator: {
    height: 16,
  },

  // Application Card - ENHANCED
  applicationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  applicationHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  applicationInfo: {
    flex: 1,
    marginRight: 16,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 24,
  },
  organizationName: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  eventDetails: {
    flexDirection: 'column',
  },
  eventDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
    flex: 1,
  },
  applicationMeta: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },

  // Application Status Details - NEW
  applicationStatusDetails: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  applicationDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  approvedDate: {
    fontSize: 12,
    color: '#10B981',
    marginBottom: 4,
  },
  rejectedDate: {
    fontSize: 12,
    color: '#EF4444',
    marginBottom: 4,
  },
  registrationStatus: {
    marginTop: 8,
  },
  registeredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registeredText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },
  notRegisteredIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notRegisteredText: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Answers Preview - NEW
  answersPreview: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  answersLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  answerPreview: {
    marginBottom: 6,
  },
  answerText: {
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
  moreAnswers: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },

  applicationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  applicationActions: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'space-between',
  },
  viewEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F0F9FF',
  },
  viewEventText: {
    fontSize: 12,
    color: '#6366F1',
    fontWeight: '500',
    marginLeft: 4,
  },
  registerNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  registerNowText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
    marginLeft: 4,
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  browseEventsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366F1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  browseEventsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
  },
});

