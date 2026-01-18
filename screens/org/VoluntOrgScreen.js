import { Ionicons } from '@expo/vector-icons';
import { arrayUnion, collection, doc, getDocs, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';
import FollowersManager from '../../utils/FollowersManager';

// Simplified sections
const SECTIONS = ['Applications', 'Followers'];
const { width: screenWidth } = Dimensions.get('window');

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
      const unsubscribe = FollowersManager.subscribeToOrganizationFollowers(
        user.uid,
        (followersData, stats) => {
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
              eventData: eventData,
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
      
    } catch (error) {
      console.error('Error loading applications:', error);
      setApplications([]);
    }
  };

  const handleApproveApplication = async (appId, eventId, volunteerId) => {
    try {
      const appRef = doc(db, 'events', eventId, 'applications', appId);
      await updateDoc(appRef, {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user.uid,
      });

      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        approvedApplicants: arrayUnion(volunteerId),
        updatedAt: serverTimestamp(),
      });
      
      await loadApplications();
      Alert.alert('Success', 'Application approved successfully!');
      
    } catch (error) {
      console.error('Error approving application:', error);
      Alert.alert('Error', 'Failed to approve application');
    }
  };

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
              const appRef = doc(db, 'events', eventId, 'applications', appId);
              await updateDoc(appRef, {
                status: 'rejected',
                rejectedAt: serverTimestamp(),
                rejectedBy: user.uid,
              });

              const eventRef = doc(db, 'events', eventId);
              await updateDoc(eventRef, {
                rejectedApplicants: arrayUnion(volunteerId),
                updatedAt: serverTimestamp(),
              });
              
              await loadApplications();
              
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
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {SECTIONS.map((section) => {
          let count = 0;
          if (section === 'Applications') {
            count = applications.reduce((total, group) => total + group.pendingCount, 0);
          } else if (section === 'Followers') {
            count = followers.length;
          }

          const isActive = selectedSection === section;

          return (
            <TouchableOpacity
              key={section}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setSelectedSection(section)}
            >
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>
                {section}
              </Text>
              {count > 0 && (
                <View style={[styles.tabBadge, isActive && styles.activeTabBadge]}>
                  <Text style={[styles.tabBadgeText, isActive && styles.activeTabBadgeText]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderApplicationCard = ({ item }) => (
    <View style={styles.applicationCard}>
      {/* Header Row */}
      <View style={styles.appCardHeader}>
        <View style={styles.appCardUserInfo}>
          <Text style={styles.volunteerName}>{item.volunteerName || 'Unknown Volunteer'}</Text>
          <Text style={styles.volunteerEmail}>{item.volunteerEmail || ''}</Text>
          <Text style={styles.applicationDate}>
             Applied: {item.createdAt?.seconds 
              ? new Date(item.createdAt.seconds * 1000).toLocaleDateString()
              : 'Unknown'}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getApplicationStatusColor(item.status) }]}>
          <Text style={styles.statusText}>
            {(item.status || 'pending').toUpperCase()}
          </Text>
        </View>
      </View>
      
      {/* Content Body */}
      {item.answers && Object.keys(item.answers).length > 0 && (
        <View style={styles.answersContainer}>
          <Text style={styles.answersLabel}>Responses:</Text>
          {Object.entries(item.answers).map(([key, answer]) => (
            <View key={key} style={styles.answerItem}>
              <Text style={styles.answerText}>{answer}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Legacy Message */}
      {item.message && !item.answers && (
        <View style={styles.messageContainer}>
          <Text style={styles.messageLabel}>Message:</Text>
          <Text style={styles.answerText}>{item.message}</Text>
        </View>
      )}
      
      {/* Action Buttons */}
      {(!item.status || item.status === 'pending') && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={() => handleApproveApplication(item.id, item.eventId, item.volunteerId)}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Approve</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleRejectApplication(item.id, item.eventId, item.volunteerId)}
          >
            <Ionicons name="close" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Reject</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* History Info */}
      {item.status !== 'pending' && (
        <View style={styles.statusFooter}>
          <Ionicons 
            name={item.status === 'approved' ? "checkmark-circle" : "close-circle"} 
            size={14} 
            color={item.status === 'approved' ? "#10B981" : "#EF4444"} 
          />
          <Text style={styles.statusFooterText}>
             Processed on {item.updatedAt?.seconds ? new Date(item.updatedAt.seconds * 1000).toLocaleDateString() : 'Unknown'}
          </Text>
        </View>
      )}
    </View>
  );

  const getApplicationStatusColor = (status) => {
    switch (status) {
      case 'approved': return '#10B981';
      case 'rejected': return '#EF4444';
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
        <Text style={styles.followerName}>{item.displayName || item.name || 'User'}</Text>
        <Text style={styles.followerRole}>{item.role === 'volunteer' ? 'Volunteer' : 'User'}</Text>
        
        {item.location && (
          <View style={styles.metaRow}>
            <Ionicons name="location-outline" size={12} color="#6B7280" />
            <Text style={styles.metaText}>{item.location}</Text>
          </View>
        )}
      </View>
      
      <View style={styles.followerActions}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('SendMessage', { userId: item.id })}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#3B82F6" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconButton, styles.deleteIcon]}
          onPress={() => handleRemoveFollower(item.id)}
        >
          <Ionicons name="trash-outline" size={20} color="#EF4444" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEventApplicationsGroup = ({ item }) => (
    <View style={styles.eventGroupContainer}>
      <View style={styles.eventGroupHeader}>
        <Text style={styles.eventGroupTitle}>{item.eventName}</Text>
        <View style={styles.eventStatsRow}>
          <Text style={styles.eventStatText}>{item.pendingCount} Pending</Text>
          <Text style={styles.statDivider}>•</Text>
          <Text style={[styles.eventStatText, {color: '#10B981'}]}>{item.approvedCount} Approved</Text>
        </View>
      </View>
      
      <FlatList
        data={item.applications}
        keyExtractor={(app) => app.id}
        renderItem={renderApplicationCard}
        scrollEnabled={false}
      />
    </View>
  );

  // --- Render Main Content ---

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 1. Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Community</Text>
        
        {/* Dashboard Stats */}
        {selectedSection === 'Applications' && applications.length > 0 && (
          <View style={styles.statsGrid}>
             <View style={styles.statBox}>
               <Text style={styles.statValue}>{applications.reduce((t, g) => t + g.pendingCount, 0)}</Text>
               <Text style={styles.statLabel}>Pending</Text>
             </View>
             <View style={styles.statBox}>
               <Text style={[styles.statValue, {color: '#10B981'}]}>{applications.reduce((t, g) => t + g.approvedCount, 0)}</Text>
               <Text style={styles.statLabel}>Approved</Text>
             </View>
             <View style={styles.statBox}>
               <Text style={styles.statValue}>{applications.reduce((t, g) => t + g.applicationCount, 0)}</Text>
               <Text style={styles.statLabel}>Total</Text>
             </View>
          </View>
        )}

        {selectedSection === 'Followers' && followerStats && (
           <View style={styles.statsGrid}>
             <View style={styles.statBox}>
               <Text style={styles.statValue}>{followerStats.totalFollowers}</Text>
               <Text style={styles.statLabel}>Total</Text>
             </View>
             <View style={styles.statBox}>
               <Text style={styles.statValue}>{followerStats.volunteerFollowers}</Text>
               <Text style={styles.statLabel}>Volunteers</Text>
             </View>
             <View style={styles.statBox}>
               <Text style={styles.statValue}>{followerStats.recentFollowers}</Text>
               <Text style={styles.statLabel}>New</Text>
             </View>
          </View>
        )}
      </View>

      {/* 2. Tabs */}
      {renderSectionTabs()}

      {/* 3. Main List */}
      <FlatList
        data={selectedSection === 'Applications' ? applications : followers}
        keyExtractor={(item) => selectedSection === 'Applications' ? item.eventId : item.id}
        renderItem={selectedSection === 'Applications' ? renderEventApplicationsGroup : renderFollowerCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={selectedSection === 'Applications' ? 'documents-outline' : 'people-outline'} 
              size={64} 
              color="#E5E7EB" 
            />
            <Text style={styles.emptyText}>
              {selectedSection === 'Applications' 
                ? 'No applications received yet.' 
                : 'You have no followers yet.'}
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
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  
  // Dashboard Stats
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statBox: {
    width: '31%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },

  // Tabs
  tabsContainer: {
    paddingHorizontal: 20,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    marginRight: 10,
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
  tabBadge: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  activeTabBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
  },
  activeTabBadgeText: {
    color: '#FFFFFF',
  },

  // List Content
  listContent: {
    padding: 20,
    paddingBottom: 50,
  },
  
  // --- Event Group (Applications) ---
  eventGroupContainer: {
    marginBottom: 30,
  },
  eventGroupHeader: {
    marginBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#F3F4F6',
    paddingBottom: 8,
  },
  eventGroupTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  eventStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventStatText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  statDivider: {
    marginHorizontal: 8,
    color: '#D1D5DB',
  },

  // --- Application Card ---
  applicationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  appCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  appCardUserInfo: {
    flex: 1,
    marginRight: 10,
  },
  volunteerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  volunteerEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  applicationDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  
  // Answers Section
  answersContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  messageContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  answersLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  answerItem: {
    marginBottom: 4,
  },
  answerText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },

  // Action Buttons
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  rejectButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  statusFooterText: {
    fontSize: 11,
    color: '#6B7280',
    marginLeft: 4,
  },

  // --- Follower Card ---
  followerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E5E7EB',
  },
  followerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  followerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  followerRole: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 4,
  },
  followerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteIcon: {
    backgroundColor: '#FEF2F2',
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