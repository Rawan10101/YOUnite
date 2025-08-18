// screens/Organization/OrganizationDashboard.js
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

const { width: screenWidth } = Dimensions.get('window');

export default function OrganizationDashboard({ navigation }) {
  const { user } = useAppContext();
  const [stats, setStats] = useState({
    totalEvents: 0,
    activeEvents: 0,
    totalVolunteers: 0,
    totalHours: 0,
    pendingApplications: 0,
    totalFollowers: 0,
    completedEvents: 0,
    impactScore: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [organizationData, setOrganizationData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user?.uid) {
      loadDashboardData();
      const cleanup = setupRealtimeListeners();
      return cleanup;
    }
  }, [user]);

  const setupRealtimeListeners = () => {
    if (!user?.uid) return () => {};

    const unsubscribeFunctions = [];

    try {
      // Listen to organization data changes
      const orgRef = doc(db, 'organizations', user.uid);
      const unsubscribeOrg = onSnapshot(
        orgRef, 
        (doc) => {
          if (doc.exists()) {
            setOrganizationData(doc.data());
          }
        },
        (error) => {
          console.error('Error listening to organization data:', error);
        }
      );
      unsubscribeFunctions.push(unsubscribeOrg);

      // Listen to events changes
      const eventsQuery = query(
        collection(db, 'events'),
        where('organizationId', '==', user.uid),
        orderBy('createdAt', 'desc')
      );
      
      const unsubscribeEvents = onSnapshot(
        eventsQuery, 
        (snapshot) => {
          const events = [];
          snapshot.forEach((doc) => {
            const eventData = doc.data();
            events.push({ 
              id: doc.id, 
              ...eventData,
              date: eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date)
            });
          });
          
          calculateStatsFromEvents(events);
          
          // Filter upcoming events
          const upcoming = events.filter(event => 
            event.status === 'active' && 
            event.date && 
            new Date(event.date) > new Date()
          ).slice(0, 3);
          
          setUpcomingEvents(upcoming);
        },
        (error) => {
          console.error('Error listening to events:', error);
          setError('Failed to load events data');
        }
      );
      unsubscribeFunctions.push(unsubscribeEvents);

    } catch (error) {
      console.error('Error setting up listeners:', error);
      setError('Failed to setup real-time updates');
    }

    return () => {
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  };

  const loadDashboardData = async () => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      setError(null);

      // Load organization data
      const orgDoc = await getDoc(doc(db, 'organizations', user.uid));
      if (orgDoc.exists()) {
        setOrganizationData(orgDoc.data());
      }

      // Load events created by this organization
      const eventsQuery = query(
        collection(db, 'events'),
        where('organizationId', '==', user.uid)
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      
      const events = [];
      eventsSnapshot.forEach((doc) => {
        const eventData = doc.data();
        events.push({ 
          id: doc.id, 
          ...eventData,
          date: eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date)
        });
      });

      calculateStatsFromEvents(events);
      await loadRecentActivity();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const calculateStatsFromEvents = (events) => {
    let totalEvents = events.length;
    let activeEvents = 0;
    let completedEvents = 0;
    let totalVolunteers = 0;
    let totalHours = 0;
    let impactScore = 0;

    events.forEach((event) => {
      if (event.status === 'active') activeEvents++;
      if (event.status === 'completed') completedEvents++;
      
      const volunteers = event.registeredVolunteers?.length || 0;
      totalVolunteers += volunteers;
      totalHours += event.estimatedHours || 0;
      
      // Calculate impact score based on various factors
      impactScore += volunteers * (event.estimatedHours || 1) * (event.impactMultiplier || 1);
    });

    setStats(prev => ({
      ...prev,
      totalEvents,
      activeEvents,
      completedEvents,
      totalVolunteers,
      totalHours,
      impactScore: Math.round(impactScore),
      totalFollowers: organizationData?.followers?.length || 0,
      pendingApplications: 5, // This would come from volunteer applications collection
    }));
  };

  const loadRecentActivity = async () => {
    try {
      // Load recent activity from Firestore
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('organizationId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
      
      const activitiesSnapshot = await getDocs(activitiesQuery);
      const activities = [];
      
      activitiesSnapshot.forEach((doc) => {
        activities.push({ id: doc.id, ...doc.data() });
      });
//=========================================================//we need to handle the recent activity data to remove the mock data
      // If no activities in database, use mock data
      if (activities.length === 0) {
        setRecentActivity([
          {
            id: '1',
            type: 'new_registration',
            title: 'New volunteer registered for Beach Cleanup',
            time: '2 hours ago',
            icon: 'person-add',
            color: '#4e8cff',
          },
          {
            id: '2',
            type: 'event_completed',
            title: 'Tree Planting Drive completed successfully',
            time: '1 day ago',
            icon: 'checkmark-circle',
            color: '#4CAF50',
          },
          {
            id: '3',
            type: 'event_published',
            title: 'Food Distribution Event published',
            time: '3 days ago',
            icon: 'calendar',
            color: '#FF9800',
          },
          {
            id: '4',
            type: 'milestone',
            title: 'Reached 100 total volunteers!',
            time: '1 week ago',
            icon: 'trophy',
            color: '#9C27B0',
          },
        ]);
      } else {
        setRecentActivity(activities);
      }
    } catch (error) {
      console.error('Error loading recent activity:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const renderStatCard = (title, value, icon, color, subtitle, onPress) => (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
    >
      <Animatable.View animation="fadeInUp" duration={600} style={styles.statContent}>
        <View style={[styles.statIcon, { backgroundColor: color }]}>
          <Ionicons name={icon} size={24} color="#fff" />
        </View>
        <View style={styles.statText}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
          {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
        </View>
      </Animatable.View>
    </TouchableOpacity>
  );

  const renderActivityItem = (item, index) => (
    <Animatable.View
      key={item.id}
      animation="fadeInLeft"
      duration={600}
      delay={index * 100}
      style={styles.activityItem}
    >
      <View style={[styles.activityIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={18} color="#fff" />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityTime}>{item.time}</Text>
      </View>
    </Animatable.View>
  );

  const renderUpcomingEvent = (event, index) => (
    <TouchableOpacity
      key={event.id}
      style={styles.upcomingEventCard}
      onPress={() => navigation.navigate('EventDetails', { event })}
    >
      <Image 
        source={{ uri: event.image || 'https://via.placeholder.com/150x100' }} 
        style={styles.upcomingEventImage} 
      />
      <View style={styles.upcomingEventContent}>
        <Text style={styles.upcomingEventTitle} numberOfLines={2}>
          {event.title}
        </Text>
        <View style={styles.upcomingEventDetails}>
          <Ionicons name="calendar-outline" size={14} color="#666" />
          <Text style={styles.upcomingEventDate}>
            {event.date ? new Date(event.date).toLocaleDateString() : 'TBD'}
          </Text>
        </View>
        <View style={styles.upcomingEventProgress}>
          <Text style={styles.upcomingEventProgressText}>
            {event.registeredVolunteers?.length || 0}/{event.maxParticipants || 0} volunteers
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2B2B2B" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF6B35" />
        <Text style={styles.errorTitle}>Unable to Load Dashboard</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadDashboardData}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container} 
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Hero Header */}
      <View style={styles.heroHeader}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.organizationName}>
              {organizationData?.name || 'Organization'}
            </Text>
            <View style={styles.verificationBadge}>
              <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
              <Text style={styles.verificationText}>Verified Organization</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.profileButton}>
            <Image 
              source={{ uri: organizationData?.logo || 'https://via.placeholder.com/50' }} 
              style={styles.profileImage} 
            />
          </TouchableOpacity>
        </View>
        
        {/* Impact Score */}
        <View style={styles.impactScoreContainer}>
          <Text style={styles.impactScoreLabel}>Impact Score</Text>
          <Text style={styles.impactScoreValue}>{stats.impactScore}</Text>
          <Text style={styles.impactScoreSubtext}>Based on volunteer hours & reach</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <Animatable.View animation="fadeInUp" duration={800} style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4e8cff' }]}
            onPress={() => navigation.navigate('CreateEvent')}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Create Event</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#4CAF50' }]}
            onPress={() => navigation.navigate('Volunteers')}
          >
            <Ionicons name="people" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Volunteers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: '#FF9800' }]}
            onPress={() => navigation.navigate('Analytics')}
          >
            <Ionicons name="analytics" size={24} color="#fff" />
            <Text style={styles.actionButtonText}>Analytics</Text>
          </TouchableOpacity>
        </View>
      </Animatable.View>

      {/* Statistics Grid */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Organization Overview</Text>
        <View style={styles.statsGrid}>
          {renderStatCard(
            'Total Events',
            stats.totalEvents,
            'calendar-outline',
            '#4e8cff',
            `${stats.activeEvents} active`,
            () => navigation.navigate('OrganizationEvents')
          )}
          {renderStatCard(
            'Total Volunteers',
            stats.totalVolunteers,
            'people-outline',
            '#4CAF50',
            'All time',
            () => navigation.navigate('Volunteers')
          )}
          {renderStatCard(
            'Hours Contributed',
            `${stats.totalHours}h`,
            'time-outline',
            '#FF9800',
            'Community impact',
            () => {}
          )}
          {renderStatCard(
            'Followers',
            stats.totalFollowers,
            'heart-outline',
            '#9C27B0',
            'Growing community',
            () => navigation.navigate('Followers')
          )}
        </View>
      </View>

      {/* Pending Applications Alert */}
      {stats.pendingApplications > 0 && (
        <Animatable.View animation="fadeInUp" duration={800} style={styles.alertSection}>
          <TouchableOpacity
            style={styles.alertCard}
            onPress={() => navigation.navigate('Volunteers')}
          >
            <View style={styles.alertIcon}>
              <Ionicons name="person-add" size={24} color="#FF6B35" />
            </View>
            <View style={styles.alertContent}>
              <Text style={styles.alertTitle}>Pending Applications</Text>
              <Text style={styles.alertSubtitle}>
                {stats.pendingApplications} volunteers waiting for approval
              </Text>
            </View>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>{stats.pendingApplications}</Text>
            </View>
          </TouchableOpacity>
        </Animatable.View>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <View style={styles.upcomingEventsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => navigation.navigate('OrganizationEvents')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {upcomingEvents.map((event, index) => renderUpcomingEvent(event, index))}
          </ScrollView>
        </View>
      )}

      {/* Recent Activity */}
      <View style={styles.activitySection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityContainer}>
          {recentActivity.map((item, index) => renderActivityItem(item, index))}
        </View>
        <TouchableOpacity style={styles.viewAllActivity}>
          <Text style={styles.viewAllActivityText}>View All Activity</Text>
          <Ionicons name="chevron-forward" size={16} color="#4e8cff" />
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
    backgroundColor: '#4e8cff',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Hero Header
  heroHeader: {
    backgroundColor: '#4e8cff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 25,
  },
  headerLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 5,
  },
  organizationName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  verificationText: {
    fontSize: 12,
    color: '#fff',
    marginLeft: 4,
    fontWeight: '500',
  },
  profileButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  impactScoreContainer: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  impactScoreLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 5,
  },
  impactScoreValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  impactScoreSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },

  // Quick Actions
  quickActions: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    marginHorizontal: 3,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Statistics
  statsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statText: {
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },

  // Alert Section
  alertSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  alertCard: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#FF6B35',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  alertIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#FFF3F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  alertSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  alertBadge: {
    backgroundColor: '#FF6B35',
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Upcoming Events
  upcomingEventsSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  seeAllText: {
    fontSize: 14,
    color: '#4e8cff',
    fontWeight: '600',
  },
  upcomingEventCard: {
    backgroundColor: '#fff',
    width: 200,
    marginLeft: 20,
    borderRadius: 12,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  upcomingEventImage: {
    width: '100%',
    height: 100,
    backgroundColor: '#f0f0f0',
  },
  upcomingEventContent: {
    padding: 15,
  },
  upcomingEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  upcomingEventDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  upcomingEventDate: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  upcomingEventProgress: {
    backgroundColor: '#f0f0f0',
    padding: 6,
    borderRadius: 6,
  },
  upcomingEventProgressText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },

  // Activity Section
  activitySection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 15,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  activityContainer: {
    marginBottom: 15,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#666',
  },
  viewAllActivity: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  viewAllActivityText: {
    fontSize: 14,
    color: '#4e8cff',
    fontWeight: '600',
    marginRight: 4,
  },

  bottomPadding: {
    height: 30,
  },
});

