import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
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

  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadOrganizationData();
  }, [user?.uid]);

  const loadOrganizationData = async () => {
    try {
      await Promise.all([
        loadFollowers(),
        loadApplications()
      ]);
    } catch (error) {
      console.error('Error loading organization data:', error);
      Alert.alert('Error', 'Failed to load volunteer data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadFollowers = async () => {
    try {
      console.log('Loading followers for organization:', user.uid);
      
      const followersData = await FollowersManager.getOrganizationFollowers(user.uid);
      setFollowers(followersData);
      
      const stats = await FollowersManager.getFollowerStats(user.uid);
      setFollowerStats(stats);
      
      console.log(`Loaded ${followersData.length} followers`);
      
    } catch (error) {
      console.error('Error loading followers:', error);
      setFollowers([]);
      setFollowerStats(null);
    }
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
            });
          });
          
          if (eventApplications.length > 0) {
            allApplications.push({
              eventId: eventId,
              eventName: eventTitle,
              applications: eventApplications,
              applicationCount: eventApplications.length,
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

  const handleApproveApplication = async (appId, eventId) => {
    try {
      const appRef = doc(db, 'events', eventId, 'applications', appId);
      await updateDoc(appRef, {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: user.uid,
      });
      
      await loadApplications();
      Alert.alert('Success', 'Application approved successfully');
      
    } catch (error) {
      console.error('Error approving application:', error);
      Alert.alert('Error', 'Failed to approve application');
    }
  };

  const handleRejectApplication = async (appId, eventId) => {
    try {
      const appRef = doc(db, 'events', eventId, 'applications', appId);
      await updateDoc(appRef, {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: user.uid,
      });
      
      await loadApplications();
      Alert.alert('Success', 'Application rejected successfully');
      
    } catch (error) {
      console.error('Error rejecting application:', error);
      Alert.alert('Error', 'Failed to reject application');
    }
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
              await loadFollowers();
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
            count = applications.reduce((total, eventGroup) => total + eventGroup.applications.length, 0);
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
      
      {item.message && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Message:</Text>
          <Text style={styles.applicationMessage}>{item.message}</Text>
        </View>
      )}
      
      {(!item.status || item.status === 'pending') && (
        <View style={styles.applicationActions}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => handleApproveApplication(item.id, item.eventId)}
          >
            <Ionicons name="checkmark-circle" size={16} color="#fff" />
            <Text style={styles.approveText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRejectApplication(item.id, item.eventId)}
          >
            <Ionicons name="close-circle" size={16} color="#fff" />
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
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

  const renderEventApplicationsGroup = ({ item }) => (
    <View style={styles.eventApplicationsGroup}>
      <View style={styles.eventApplicationsHeader}>
        <View style={styles.eventHeaderLeft}>
          <Text style={styles.eventApplicationsTitle}>{item.eventName}</Text>
          <View style={styles.applicationCountBadge}>
            <Text style={styles.applicationCountText}>{item.applicationCount}</Text>
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
        return 'No applications yet. Create events to receive applications!';
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

  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#6366F1',
  },
  statLabel: {
    fontSize: 14,
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
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 4,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#6366F1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#FFFFFF',
  },
  tabBadge: {
    backgroundColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
    minWidth: 24,
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

  // Application Card
  applicationCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
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
  },
  volunteerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  volunteerEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  applicationStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginLeft: 12,
  },
  applicationStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  applicationDate: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  messageContainer: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  applicationMessage: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  applicationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  approveText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  rejectText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  applicationSeparator: {
    height: 12,
  },

  // Follower Card
  followerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 16,
  },
  followerInfo: {
    flex: 1,
  },
  followerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  followerRole: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  followerLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginLeft: 4,
  },
  skillsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  skillsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginRight: 4,
  },
  followerSkills: {
    fontSize: 12,
    color: '#6366F1',
    flex: 1,
  },
  followerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  messageButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  removeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
  },

  // Event Applications Group
  eventApplicationsGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  eventApplicationsHeader: {
    marginBottom: 16,
  },
  eventHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventApplicationsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  applicationCountBadge: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginLeft: 12,
  },
  applicationCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
});

