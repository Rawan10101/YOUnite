import { Ionicons } from '@expo/vector-icons';
import { arrayUnion, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';
import FollowersManager from '../../utils/FollowersManager';

// Simplified sections - removed mock data sections
const SECTIONS = ['Applications', 'Followers'];

export default function VolunteersTab({ navigation }) {
  const { user } = useAppContext();
  const [selectedSection, setSelectedSection] = useState('Applications');
  const [followers, setFollowers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [followerStats, setFollowerStats] = useState(null);
  const [followersUnsubscribe, setFollowersUnsubscribe] = useState(null);

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadOrganizationData();

    // Cleanup function to unsubscribe from real-time listeners
    return () => {
      if (followersUnsubscribe) {
        followersUnsubscribe();
      }
    };
  }, [user?.uid]);

  const loadOrganizationData = async () => {
    try {
      await Promise.all([
        setupFollowersListener(),
        loadApplications()
      ]);
    } catch (error) {
      console.error('Error loading organization data:', error);
      Alert.alert('Error', 'Failed to load volunteer data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setupFollowersListener = () => {
    return new Promise((resolve) => {
      console.log('Setting up real-time followers listener for organization:', user.uid);
      
      const unsubscribe = FollowersManager.subscribeToOrganizationFollowers(
        user.uid,
        (followersData, stats) => {
          console.log('Received real-time followers update:', followersData.length, 'followers');
          setFollowers(followersData);
          setFollowerStats(stats);
          resolve();
        }
      );
      
      setFollowersUnsubscribe(() => unsubscribe);
    });
  };

  const loadApplications = async () => {
    try {
      console.log('Loading applications for organization:', user.uid);
      
      const eventsQuery = query(
        collection(db, 'events'), 
        where('organizationId', '==', user.uid)
      );
      
      const eventsSnapshot = await getDocs(eventsQuery);
      const allApplications = [];
      
      for (const eventDoc of eventsSnapshot.docs) {
        const eventId = eventDoc.id;
        const eventData = eventDoc.data();
        const eventTitle = eventData.title;
        
        try {
          const applicationsQuery = collection(db, 'events', eventId, 'applications');
          const applicationsSnapshot = await getDocs(applicationsQuery);
          
          const eventApplications = [];
          applicationsSnapshot.forEach(appDoc => {
            const appData = appDoc.data();
            eventApplications.push({
              id: appDoc.id,
              ...appData,
              eventName: eventTitle,
              eventId: eventId,
              eventData: eventData, // Include full event data for approval process
            });
          });
          
          if (eventApplications.length > 0) {
            allApplications.push({
              eventId: eventId,
              eventName: eventTitle,
              eventData: eventData,
              applications: eventApplications,
              applicationCount: eventApplications.length,
              pendingCount: eventApplications.filter(app => app.status === 'pending').length,
              approvedCount: eventApplications.filter(app => app.status === 'approved').length,
              rejectedCount: eventApplications.filter(app => app.status === 'rejected').length,
            });
          }
          
        } catch (error) {
          console.error(`Error loading applications for event ${eventId}:`, error);
        }
      }
      
      allApplications.sort((a, b) => a.eventName.localeCompare(b.eventName));
      
      setApplications(allApplications);
      console.log(`Loaded applications for ${allApplications.length} events`);
      
    } catch (error) {
      console.error('Error loading applications:', error);
      setApplications([]);
    }
  };

  // ENHANCED: Handle application approval with proper event updates
  const handleApproveApplication = async (appId, eventId, volunteerId) => {
    try {
      // Update application status
      const appRef = doc(db, 'events', eventId, 'applications', appId);
      await updateDoc(appRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
      });

      // Add volunteer to approved applicants list in event
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        approvedApplicants: arrayUnion(volunteerId),
        updatedAt: serverTimestamp(),
      });
      
      await loadApplications();
      Alert.alert('Success', 'Application approved successfully! The volunteer can now register for the event.');
      
    } catch (error) {
      console.error('Error approving application:', error);
      Alert.alert('Error', 'Failed to approve application');
    }
  };

  // ENHANCED: Handle application rejection
  const handleRejectApplication = async (appId, eventId, volunteerId) => {
    Alert.alert(
      'Reject Application',
      'Are you sure you want to reject this application?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              // Update application status
              const appRef = doc(db, 'events', eventId, 'applications', appId);
              await updateDoc(appRef, {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                rejectedBy: user.uid,
              });

              // Add volunteer to rejected applicants list in event
              const eventRef = doc(db, 'events', eventId);
              await updateDoc(eventRef, {
                rejectedApplicants: arrayUnion(volunteerId),
                updatedAt: serverTimestamp(),
              });
              
              await loadApplications();
              Alert.alert('Success', 'Application rejected successfully');
              
            } catch (error) {
              console.error('Error rejecting application:', error);
              Alert.alert('Error', 'Failed to reject application');
            }
          },
        },
      ]
    );
  };

  const handleRemoveFollower = async (followerId) => {
    Alert.alert(
      'Remove Follower',
      'Are you sure you want to remove this follower?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await FollowersManager.removeFollower(user.uid, followerId);
              // No need to manually refresh - real-time listener will handle the update
              Alert.alert('Success', 'Follower removed successfully');
            } catch (error) {
              console.error('Error removing follower:', error);
              Alert.alert('Error', 'Failed to remove follower');
            }
          },
        },
      ]
    );
  };

  const renderSectionTabs = () => (
    <View style={styles.tabsContainer}>
      {SECTIONS.map((section) => {
        let count = 0;
        switch (section) {
          case 'Applications':
            count = applications.reduce((total, eventGroup) => total + eventGroup.pendingCount, 0);
            break;
          case 'Followers':
            count = followers.length;
            break;
        }

        return (
          <TouchableOpacity
            key={section}
            style={[
              styles.tab,
              selectedSection === section && styles.activeTab,
            ]}
            onPress={() => setSelectedSection(section)}
          >
            <Text
              style={[
                styles.tabText,
                selectedSection === section && styles.activeTabText,
              ]}
            >
              {section}
            </Text>
            {count > 0 && (
              <View style={[
                styles.tabBadge,
                selectedSection === section && styles.activeTabBadge
              ]}>
                <Text style={[
                  styles.tabBadgeText,
                  selectedSection === section && styles.activeTabBadgeText
                ]}>
                  {count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ENHANCED: Application card with better UI and actions
  const renderApplicationCard = ({ item }) => (
    <View style={styles.applicationCard}>
      <View style={styles.applicationHeader}>
        <View style={styles.applicationInfo}>
          <Text style={styles.volunteerName}>{item.volunteerName || 'Unknown Volunteer'}</Text>
          <Text style={styles.volunteerEmail}>{item.volunteerEmail || ''}</Text>
        </View>
        <View style={[
          styles.applicationStatusBadge,
          { backgroundColor: getApplicationStatusColor(item.status) }
        ]}>
          <Text style={styles.applicationStatusText}>
            {(item.status || 'pending').charAt(0).toUpperCase() + (item.status || 'pending').slice(1)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.applicationDate}>
        Applied: {item.createdAt?.seconds 
          ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
          : item.createdAt?.toDate
          ? item.createdAt.toDate().toLocaleDateString()
          : 'Unknown date'
        }
      </Text>
      
      {/* Application Answers - NEW */}
      {item.answers && Object.keys(item.answers).length > 0 && (
        <View style={styles.answersContainer}>
          <Text style={styles.answersLabel}>Application Responses:</Text>
          {Object.entries(item.answers).map(([questionIndex, answer]) => (
            <View key={questionIndex} style={styles.answerItem}>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Legacy message support */}
      {item.message && !item.answers && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Message:</Text>
          <Text style={styles.applicationMessage}>{item.message}</Text>
        </View>
      )}
      
      {(!item.status || item.status === 'pending') && (
        <View style={styles.applicationActions}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => handleApproveApplication(item.id, item.eventId, item.volunteerId)}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.approveText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRejectApplication(item.id, item.eventId, item.volunteerId)}
          >
            <Ionicons name="close-circle" size={16} color="#fff" />
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Show approval/rejection info */}
      {item.status === 'approved' && item.approvedAt && (
        <View style={styles.statusInfo}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.statusInfoText}>
            Approved on {new Date(item.approvedAt.seconds * 1000).toLocaleDateString()}
          </Text>
        </View>
      )}

      {item.status === 'rejected' && item.rejectedAt && (
        <View style={styles.statusInfo}>
          <Ionicons name="close-circle" size={16} color="#EF4444" />
          <Text style={styles.statusInfoText}>
            Rejected on {new Date(item.rejectedAt.seconds * 1000).toLocaleDateString()}
          </Text>
        </View>
      )}
    </View>
  );

  const getApplicationStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
      case 'pending':
      default: return '#F59E0B';
    }
  };

  const renderFollowerCard = ({ item }) => (
    <View style={styles.followerCard}>
      <Image
        source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.followerInfo}>
        <Text style={styles.followerName}>
          {item.displayName || item.name || 'Follower'}
        </Text>
        <Text style={styles.followerRole}>
          {item.role === 'volunteer' ? 'Volunteer' : 'User'}
        </Text>
        {item.location && (
          <View style={styles.locationContainer}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            <Text style={styles.followerLocation}>{item.location}</Text>
          </View>
        )}
        {item.skills && item.skills.length > 0 && (
          <View style={styles.skillsContainer}>
            <Text style={styles.skillsLabel}>Skills:</Text>
            <Text style={styles.followerSkills} numberOfLines={1}>
              {item.skills.slice(0, 3).join(', ')}
              {item.skills.length > 3 && '...'}
            </Text>
          </View>
        )}
      </View>
      <View style={styles.followerActions}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => navigation.navigate('SendMessage', { userId: item.id })}
        >
          <Ionicons name="mail-outline" size={18} color="#6366F1" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFollower(item.id)}
        >
          <Ionicons name="person-remove-outline" size={18} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ENHANCED: Event applications group with statistics
  const renderEventApplicationsGroup = ({ item }) => (
    <View style={styles.eventApplicationsGroup}>
      <View style={styles.eventApplicationsHeader}>
        <View style={styles.eventHeaderLeft}>
          <Text style={styles.eventApplicationsTitle}>{item.eventName}</Text>
          <View style={styles.applicationStats}>
            <View style={styles.statBadge}>
              <Text style={styles.statBadgeText}>{item.pendingCount} Pending</Text>
            </View>
            <View style={[styles.statBadge, { backgroundColor: '#10B981' }]}>
              <Text style={styles.statBadgeText}>{item.approvedCount} Approved</Text>
            </View>
            {item.rejectedCount > 0 && (
              <View style={[styles.statBadge, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.statBadgeText}>{item.rejectedCount} Rejected</Text>
              </View>
            )}
          </View>
        </View>
      </View>
      <FlatList
        data={item.applications}
        keyExtractor={(app) => app.id}
        renderItem={renderApplicationCard}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false}
        ItemSeparatorComponent={() => <View style={styles.applicationSeparator} />}
      />
    </View>
  );

  const getCurrentData = () => {
    switch (selectedSection) {
      case 'Followers':
        return followers;
      case 'Applications':
        return applications;
      default:
        return [];
    }
  };

  const getCurrentRenderItem = () => {
    switch (selectedSection) {
      case 'Followers':
        return renderFollowerCard;
      case 'Applications':
        return renderEventApplicationsGroup;
      default:
        return renderFollowerCard;
    }
  };

  const getEmptyMessage = () => {
    switch (selectedSection) {
      case 'Followers':
        return 'No followers yet. Share your organization to gain followers!';
      case 'Applications':
        return 'No applications yet. Create events that require applications to receive them!';
      default:
        return 'No data available';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading volunteers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Volunteers</Text>
        <Text style={styles.headerSubtitle}>Manage your volunteer community</Text>
        
        {/* Application Stats - NEW */}
        {selectedSection === 'Applications' && applications.length > 0 && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {applications.reduce((total, eventGroup) => total + eventGroup.pendingCount, 0)}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {applications.reduce((total, eventGroup) => total + eventGroup.approvedCount, 0)}
              </Text>
              <Text style={styles.statLabel}>Approved</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {applications.reduce((total, eventGroup) => total + eventGroup.applicationCount, 0)}
              </Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
          </View>
        )}

        {/* Follower Stats */}
        {followerStats && selectedSection === 'Followers' && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{followerStats.totalFollowers}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{followerStats.volunteerFollowers}</Text>
              <Text style={styles.statLabel}>Volunteers</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{followerStats.recentFollowers}</Text>
              <Text style={styles.statLabel}>Recent</Text>
            </View>
          </View>
        )}
      </View>

      {/* Section Tabs */}
      {renderSectionTabs()}

      {/* Content */}
      <FlatList
        data={getCurrentData()}
        keyExtractor={(item) => selectedSection === 'Applications' ? item.eventId : item.id}
        renderItem={getCurrentRenderItem()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={selectedSection === 'Applications' ? 'document-text-outline' : 'people-outline'} 
              size={48} 
              color="#D1D5DB" 
            />
            <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
          </View>
        }
      />
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

  // Stats Container - ENHANCED
  statsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 12,
  },
  activeTab: {
    backgroundColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
  },
  activeTabBadgeText: {
    color: '#FFFFFF',
  },

  // List
  listContainer: {
    padding: 24,
  },
  itemSeparator: {
    height: 16,
  },

  // Event Applications Group - ENHANCED
  eventApplicationsGroup: {
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
  eventApplicationsHeader: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  eventHeaderLeft: {
    flex: 1,
  },
  eventApplicationsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  applicationStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statBadge: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
    marginBottom: 4,
  },
  statBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Application Card - ENHANCED
  applicationCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  applicationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  applicationInfo: {
    flex: 1,
    marginRight: 12,
  },
  volunteerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  volunteerEmail: {
    fontSize: 14,
    color: '#6B7280',
  },
  applicationStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  applicationStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  applicationDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 12,
  },

  // Application Answers - NEW
  answersContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  answersLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  answerItem: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  answerText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },

  // Legacy message support
  messageContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  messageLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  applicationMessage: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },

  applicationActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  approveButton: {
    flex: 0.48,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  rejectButton: {
    flex: 0.48,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 6,
  },

  // Status Info - NEW
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  statusInfoText: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 6,
  },

  applicationSeparator: {
    height: 12,
  },

  // Follower Card
  followerCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  followerInfo: {
    flex: 1,
  },
  followerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  followerRole: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  followerLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  skillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skillsLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    marginRight: 4,
  },
  followerSkills: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
  },
  followerActions: {
    flexDirection: 'row',
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F9FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
});

