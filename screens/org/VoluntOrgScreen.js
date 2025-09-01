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
import FollowersManager from '../../utils/FollowersManager'; //utils/FollowersManager.js

const SECTIONS = ['Applications', 'Followers', 'Active Volunteers', 'Top Volunteers'];

export default function VolunteersTab({ navigation }) {
  const { user } = useAppContext();
  const [selectedSection, setSelectedSection] = useState('Applications'); // Default to Applications
  const [activeVolunteers, setActiveVolunteers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [topVolunteers, setTopVolunteers] = useState([]);
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
      // Load followers using FollowersManager
      await loadFollowers();
      
      // Load applications grouped by events
      await loadApplications();
      
      // Load other data (mock for now)
      loadMockData();

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
      
      // Get followers using FollowersManager
      const followersData = await FollowersManager.getOrganizationFollowers(user.uid);
      setFollowers(followersData);
      
      // Get follower statistics
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
      
      // First, get all events for this organization
      const eventsQuery = query(
        collection(db, 'events'), 
        where('organizationId', '==', user.uid)
      );
      
      const eventsSnapshot = await getDocs(eventsQuery);
      const allApplications = [];
      
      // For each event, get its applications
      for (const eventDoc of eventsSnapshot.docs) {
        const eventId = eventDoc.id;
        const eventData = eventDoc.data();
        const eventTitle = eventData.title;
        
        try {
          // Get applications subcollection for this event - FIXED: Use getDocs instead of getDoc
          const applicationsQuery = collection(db, 'events', eventId, 'applications');
          const applicationsSnapshot = await getDocs(applicationsQuery); // FIXED: This was the issue
          
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
      
      // Sort by event name
      allApplications.sort((a, b) => a.eventName.localeCompare(b.eventName));
      
      setApplications(allApplications);
      console.log(`Loaded applications for ${allApplications.length} events`);
      
    } catch (error) {
      console.error('Error loading applications:', error);
      setApplications([]);
    }
  };

  const loadMockData = () => {
    // Mock data for Active Volunteers and Top Volunteers
    // TODO: Replace with real data from Firebase
    setActiveVolunteers([
      {
        id: '1',
        displayName: 'John Doe',
        email: 'john@example.com',
        photoURL: 'https://via.placeholder.com/40',
        eventsAttended: 5,
        hours: 25,
      },
      {
        id: '2',
        displayName: 'Jane Smith',
        email: 'jane@example.com',
        photoURL: 'https://via.placeholder.com/40',
        eventsAttended: 3,
        hours: 18,
      },
    ]);

    setTopVolunteers([
      {
        id: '1',
        displayName: 'John Doe',
        photoURL: 'https://via.placeholder.com/40',
        eventsAttended: 8,
        hours: 45,
        volunteerScore: 95,
      },
      {
        id: '2',
        displayName: 'Emily Davis',
        photoURL: 'https://via.placeholder.com/40',
        eventsAttended: 6,
        hours: 32,
        volunteerScore: 87,
      },
    ]);
  };

  const handleApproveApplication = async (appId, eventId) => {
    try {
      console.log('Approve application:', appId, 'for event:', eventId);
      
      // Update application status in Firestore
      const appRef = doc(db, 'events', eventId, 'applications', appId);
      await updateDoc(appRef, {
        status: 'approved',
        approvedAt: new Date(),
        approvedBy: user.uid,
      });
      
      // Refresh applications
      await loadApplications();
      
      Alert.alert('Success', 'Application approved successfully');
      
    } catch (error) {
      console.error('Error approving application:', error);
      Alert.alert('Error', 'Failed to approve application');
    }
  };

  const handleRejectApplication = async (appId, eventId) => {
    try {
      console.log('Reject application:', appId, 'for event:', eventId);
      
      // Update application status in Firestore
      const appRef = doc(db, 'events', eventId, 'applications', appId);
      await updateDoc(appRef, {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: user.uid,
      });
      
      // Refresh applications
      await loadApplications();
      
      Alert.alert('Success', 'Application rejected successfully');
      
    } catch (error) {
      console.error('Error rejecting application:', error);
      Alert.alert('Error', 'Failed to reject application');
    }
  };

  const handleRemoveFollower = async (followerId) => {
    try {
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
                
                // Refresh followers list
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
    } catch (error) {
      console.error('Error in handleRemoveFollower:', error);
    }
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
          case 'Active Volunteers':
            count = activeVolunteers.length;
            break;
          case 'Top Volunteers':
            count = topVolunteers.length;
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
              {section.split(' ')[0]} {/* Show first word to save space */}
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

  const renderVolunteerCard = ({ item }) => (
    <View style={styles.volunteerCard}>
      <Image
        source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.volunteerInfo}>
        <Text style={styles.volunteerName}>
          {item.displayName || item.name || 'Unknown'}
        </Text>
        <Text style={styles.volunteerDetails}>
          {item.eventsAttended || 0} events • {item.hours || 0} hours
        </Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => navigation.navigate('SendMessage', { volunteerId: item.id })}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#4e8cff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('VolunteerProfile', { volunteerId: item.id })}
        >
          <Ionicons name="person-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderApplicationCard = ({ item }) => (
    <View style={styles.applicationCard}>
      <View style={styles.applicationInfo}>
        <Text style={styles.volunteerName}>{item.volunteerName || 'Unknown Volunteer'}</Text>
        <Text style={styles.eventName}>Applied for: {item.eventName}</Text>
        <Text style={styles.applicationDate}>
          {item.createdAt?.seconds 
            ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
            : item.createdAt?.toDate
            ? item.createdAt.toDate().toLocaleDateString()
            : 'Unknown date'
          }
        </Text>
        {item.message && (
          <Text style={styles.applicationMessage} numberOfLines={2}>
            Message: {item.message}
          </Text>
        )}
        {item.status && (
          <View style={[
            styles.applicationStatusBadge,
            { backgroundColor: getApplicationStatusColor(item.status) }
          ]}>
            <Text style={styles.applicationStatusText}>
              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
            </Text>
          </View>
        )}
      </View>
      
      {/* Only show action buttons for pending applications */}
      {(!item.status || item.status === 'pending') && (
        <View style={styles.applicationActions}>
          <TouchableOpacity
            style={styles.approveButton}
            onPress={() => handleApproveApplication(item.id, item.eventId)}
          >
            <Ionicons name="checkmark" size={18} color="#4CAF50" />
            <Text style={styles.approveText}>Approve</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rejectButton}
            onPress={() => handleRejectApplication(item.id, item.eventId)}
          >
            <Ionicons name="close" size={18} color="#E74C3C" />
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const getApplicationStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#4CAF50';
      case 'rejected': return '#F44336';
      case 'pending':
      default: return '#FF9800';
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
        <Text style={styles.followerStatus}>
          {item.role === 'volunteer' ? 'Volunteer' : 'User'} • Following since 2024
        </Text>
        {item.location && (
          <Text style={styles.followerLocation}>
            <Ionicons name="location-outline" size={12} color="#999" />
            {' '}{item.location}
          </Text>
        )}
        {item.skills && item.skills.length > 0 && (
          <Text style={styles.followerSkills} numberOfLines={1}>
            Skills: {item.skills.slice(0, 3).join(', ')}
            {item.skills.length > 3 && '...'}
          </Text>
        )}
      </View>
      <View style={styles.followerActions}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => navigation.navigate('SendMessage', { userId: item.id })}
        >
          <Ionicons name="mail-outline" size={20} color="#4e8cff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFollower(item.id)}
        >
          <Ionicons name="person-remove-outline" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEventApplicationsGroup = ({ item }) => (
    <View style={styles.eventApplicationsGroup}>
      <View style={styles.eventApplicationsHeader}>
        <Text style={styles.eventApplicationsTitle}>{item.eventName}</Text>
        <View style={styles.applicationCountBadge}>
          <Text style={styles.applicationCountText}>{item.applicationCount}</Text>
        </View>
      </View>
      <FlatList
        data={item.applications}
        keyExtractor={(app) => app.id}
        renderItem={renderApplicationCard}
        showsVerticalScrollIndicator={false}
        scrollEnabled={false} // Disable scrolling for nested FlatList
      />
    </View>
  );

  const getCurrentData = () => {
    switch (selectedSection) {
      case 'Active Volunteers':
        return activeVolunteers;
      case 'Followers':
        return followers;
      case 'Applications':
        return applications; // Return grouped applications
      case 'Top Volunteers':
        return topVolunteers;
      default:
        return [];
    }
  };

  const getCurrentRenderItem = () => {
    switch (selectedSection) {
      case 'Active Volunteers':
        return renderVolunteerCard;
      case 'Followers':
        return renderFollowerCard;
      case 'Applications':
        return renderEventApplicationsGroup; // Render grouped applications
      case 'Top Volunteers':
        return renderVolunteerCard;
      default:
        return renderVolunteerCard;
    }
  };

  const getEmptyMessage = () => {
    switch (selectedSection) {
      case 'Active Volunteers':
        return 'No active volunteers at the moment';
      case 'Followers':
        return 'No followers yet. Share your organization to gain followers!';
      case 'Applications':
        return 'No pending applications. Create events to receive applications!';
      case 'Top Volunteers':
        return 'No top volunteers to show';
      default:
        return 'No data available';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4e8cff" />
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
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={selectedSection === 'Applications' ? 'document-text-outline' : 'people-outline'} 
              size={64} 
              color="#ccc" 
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

  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    marginTop: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4e8cff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 2,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  activeTab: {
    backgroundColor: '#4e8cff',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  tabBadge: {
    backgroundColor: '#666',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
    minWidth: 20,
    alignItems: 'center',
  },
  activeTabBadge: {
    backgroundColor: '#fff',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  activeTabBadgeText: {
    color: '#4e8cff',
  },

  // List
  listContainer: {
    padding: 16,
  },

  // Volunteer Card
  volunteerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  volunteerInfo: {
    flex: 1,
  },
  volunteerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  volunteerDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  messageButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
  },
  profileButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },

  // Application Card
  applicationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  applicationInfo: {
    marginBottom: 12,
  },
  eventName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  applicationDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  applicationMessage: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
    fontStyle: 'italic',
  },
  applicationStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  applicationStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  applicationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  approveText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rejectText: {
    color: '#E74C3C',
    fontWeight: '600',
    marginLeft: 4,
  },

  // Follower Card
  followerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  followerInfo: {
    flex: 1,
  },
  followerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  followerStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  followerLocation: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  followerSkills: {
    fontSize: 12,
    color: '#4e8cff',
    marginTop: 4,
  },
  followerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  removeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFEBEE',
  },

  // Event Applications Group
  eventApplicationsGroup: {
    backgroundColor: '#EBF4FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  eventApplicationsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventApplicationsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2B2B2B',
    flex: 1,
  },
  applicationCountBadge: {
    backgroundColor: '#4e8cff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginLeft: 8,
  },
  applicationCountText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 24,
  },
});

