import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, arrayUnion, collection, doc, limit, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Linking,
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

export default function OrganizationDetailsScreen({ route, navigation }) {
  const { organization: initialOrganization } = route.params;
  const { user, followedOrganizations, setFollowedOrganizations } = useAppContext();
  
  const [organization, setOrganization] = useState(initialOrganization);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [recentEvents, setRecentEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    // Set initial following status
    setIsFollowing(organization.followers?.includes(user?.uid) || false);
    
    // Set up real-time listeners
    setupListeners();
  }, [organization.id, user?.uid]);

  const setupListeners = () => {
    setLoading(true);

    // Listen to organization updates
    const orgRef = doc(db, 'organizations', organization.id);
    const unsubscribeOrg = onSnapshot(orgRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const orgData = docSnapshot.data();
        setOrganization({
          id: docSnapshot.id,
          ...orgData,
        });
        setIsFollowing(orgData.followers?.includes(user?.uid) || false);
      }
    }, (error) => {
      console.error('Error fetching organization:', error);
    });

    // Listen to upcoming events
    const upcomingEventsQuery = query(
      collection(db, 'events'),
      where('organizationId', '==', organization.id),
      where('date', '>=', new Date()),
      orderBy('date', 'asc'),
      limit(10)
    );

    const unsubscribeUpcoming = onSnapshot(upcomingEventsQuery, (querySnapshot) => {
      const events = querySnapshot.docs.map(doc => {
        const eventData = doc.data();
        return {
          id: doc.id,
          ...eventData,
          date: eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date),
          isRegistered: eventData.registeredVolunteers?.includes(user?.uid) || false,
          participants: eventData.registeredVolunteers?.length || 0,
        };
      });
      setUpcomingEvents(events);
      setLoading(false);
      setRefreshing(false);
    }, (error) => {
      console.error('Error fetching upcoming events:', error);
      setLoading(false);
      setRefreshing(false);
    });

    // Listen to recent events (past events for impact showcase)
    const recentEventsQuery = query(
      collection(db, 'events'),
      where('organizationId', '==', organization.id),
      where('date', '<', new Date()),
      orderBy('date', 'desc'),
      limit(5)
    );

    const unsubscribeRecent = onSnapshot(recentEventsQuery, (querySnapshot) => {
      const events = querySnapshot.docs.map(doc => {
        const eventData = doc.data();
        return {
          id: doc.id,
          ...eventData,
          date: eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date),
          participants: eventData.registeredVolunteers?.length || 0,
        };
      });
      setRecentEvents(events);
    }, (error) => {
      console.error('Error fetching recent events:', error);
    });

    // Return cleanup function
    return () => {
      unsubscribeOrg();
      unsubscribeUpcoming();
      unsubscribeRecent();
    };
  };

  const handleFollow = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to follow organizations.');
      return;
    }

    try {
      const orgRef = doc(db, 'organizations', organization.id);
      const userRef = doc(db, 'users', user.uid);

      if (isFollowing) {
        // Unfollow
        await updateDoc(orgRef, {
          followers: arrayRemove(user.uid)
        });
        await updateDoc(userRef, {
          followedOrganizations: arrayRemove(organization.id)
        });
        setFollowedOrganizations(prev => prev.filter(id => id !== organization.id));
        Alert.alert('Unfollowed', `You are no longer following ${organization.name}.`);
      } else {
        // Follow
        await updateDoc(orgRef, {
          followers: arrayUnion(user.uid)
        });
        await updateDoc(userRef, {
          followedOrganizations: arrayUnion(organization.id)
        });
        setFollowedOrganizations(prev => [...prev, organization.id]);
        Alert.alert('Following', `You are now following ${organization.name}!`);
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', 'Failed to update follow status. Please try again.');
    }
  };

  const handleContact = (type) => {
    switch (type) {
      case 'email':
        if (organization.email) {
          Linking.openURL(`mailto:${organization.email}`);
        } else {
          Alert.alert('Contact Info', 'Email not available for this organization.');
        }
        break;
      case 'phone':
        if (organization.phone) {
          Linking.openURL(`tel:${organization.phone}`);
        } else {
          Alert.alert('Contact Info', 'Phone number not available for this organization.');
        }
        break;
      case 'website':
        if (organization.website) {
          Linking.openURL(organization.website);
        } else {
          Alert.alert('Contact Info', 'Website not available for this organization.');
        }
        break;
      default:
        Alert.alert('Contact', 'Contact feature coming soon!');
    }
  };

  const handleShare = () => {
    Alert.alert('Share', `Share ${organization.name} with friends!`);
  };

  const onRefresh = () => {
    setRefreshing(true);
    setupListeners();
  };

  const formatDate = (date) => {
    if (!date) return 'TBD';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      environment: '#4CAF50',
      community: '#2196F3',
      animals: '#FF9800',
      education: '#9C27B0',
      healthcare: '#F44336',
      food: '#607D8B',
      disaster: '#F44336',
      seniors: '#9C27B0',
    };
    return colors[category?.toLowerCase()] || '#666';
  };

  const calculateImpactMetrics = () => {
    const totalVolunteers = organization.followers?.length || 0;
    const totalEvents = recentEvents.length + upcomingEvents.length;
    const totalParticipants = recentEvents.reduce((sum, event) => sum + event.participants, 0);
    
    return {
      volunteers: totalVolunteers,
      events: totalEvents,
      participants: totalParticipants,
      founded: organization.founded || new Date().getFullYear(),
    };
  };

  const renderUpcomingEvent = ({ item, index }) => (
    <Animatable.View
      animation="fadeInRight"
      duration={600}
      delay={index * 100}
      style={styles.eventCard}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate('EventDetails', { event: item })}
      >
        <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/200x120' }} style={styles.eventImage} />
        <View style={styles.eventContent}>
          <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.eventMeta}>
            <View style={styles.eventDetail}>
              <Ionicons name="calendar-outline" size={14} color="#666" />
              <Text style={styles.eventDetailText}>{formatDate(item.date)}</Text>
            </View>
            <View style={styles.eventDetail}>
              <Ionicons name="location-outline" size={14} color="#666" />
              <Text style={styles.eventDetailText} numberOfLines={1}>{item.location}</Text>
            </View>
            <View style={styles.eventDetail}>
              <Ionicons name="people-outline" size={14} color="#666" />
              <Text style={styles.eventDetailText}>
                {item.participants}/{item.maxVolunteers || 50}
              </Text>
            </View>
          </View>
          
          <View style={styles.eventActions}>
            <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) }]}>
              <Text style={styles.categoryText}>{item.category}</Text>
            </View>
            {item.isRegistered && (
              <View style={styles.registeredBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                <Text style={styles.registeredText}>Registered</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderRecentEvent = ({ item, index }) => (
    <Animatable.View
      animation="fadeInLeft"
      duration={600}
      delay={index * 100}
      style={styles.recentEventCard}
    >
      <Image source={{ uri: item.imageUrl || 'https://via.placeholder.com/80x80' }} style={styles.recentEventImage} />
      <View style={styles.recentEventContent}>
        <Text style={styles.recentEventTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.recentEventDate}>{formatDate(item.date)}</Text>
        <Text style={styles.recentEventParticipants}>
          <Ionicons name="people" size={12} color="#4CAF50" />
          {' '}{item.participants} volunteers participated
        </Text>
      </View>
    </Animatable.View>
  );

  const metrics = calculateImpactMetrics();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animatable.View animation="pulse" iterationCount="infinite">
          <Ionicons name="business" size={48} color="#4e8cff" />
        </Animatable.View>
        <Text style={styles.loadingText}>Loading organization details...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <Animatable.View animation="fadeIn" duration={800}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Image 
            source={{ uri: organization.coverImage || organization.image || 'https://via.placeholder.com/400x200' }} 
            style={styles.coverImage} 
          />
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <Image source={{ uri: organization.logo || organization.image }} style={styles.logo} />
              <View style={styles.heroInfo}>
                <View style={styles.nameContainer}>
                  <Text style={styles.name}>{organization.name}</Text>
                  {organization.verified && (
                    <Ionicons name="checkmark-circle" size={20} color="#4e8cff" style={styles.verifiedIcon} />
                  )}
                </View>
                <Text style={styles.location}>
                  <Ionicons name="location-outline" size={14} color="#fff" />
                  {' '}{organization.location}
                </Text>
                <View style={styles.categoryContainer}>
                  <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(organization.category) }]}>
                    <Text style={styles.categoryText}>{organization.category}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
            >
              <Ionicons
                name={isFollowing ? "checkmark" : "add"}
                size={16}
                color={isFollowing ? "#4e8cff" : "#fff"}
              />
              <Text
                style={[
                  styles.followButtonText,
                  isFollowing && styles.followingButtonText,
                ]}
              >
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.contactButton} 
              onPress={() => handleContact('email')}
            >
              <Ionicons name="mail-outline" size={16} color="#4e8cff" />
              <Text style={styles.contactButtonText}>Contact</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={16} color="#4e8cff" />
            </TouchableOpacity>
          </View>

          {/* Impact Metrics */}
          <View style={styles.metricsSection}>
            <Text style={styles.sectionTitle}>Impact & Reach</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metrics.volunteers}</Text>
                <Text style={styles.metricLabel}>Followers</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metrics.events}</Text>
                <Text style={styles.metricLabel}>Total Events</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metrics.participants}</Text>
                <Text style={styles.metricLabel}>Volunteers Served</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricValue}>{metrics.founded}</Text>
                <Text style={styles.metricLabel}>Founded</Text>
              </View>
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{organization.description}</Text>
            {organization.mission && (
              <View style={styles.missionContainer}>
                <Text style={styles.missionLabel}>Our Mission</Text>
                <Text style={styles.mission}>{organization.mission}</Text>
              </View>
            )}
          </View>

          {/* Upcoming Events */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
              {upcomingEvents.length > 3 && (
                <TouchableOpacity onPress={() => navigation.navigate('Events', { organizationId: organization.id })}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {upcomingEvents.length > 0 ? (
              <FlatList
                data={upcomingEvents.slice(0, 3)}
                keyExtractor={item => item.id}
                renderItem={renderUpcomingEvent}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.eventsList}
              />
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color="#ccc" />
                <Text style={styles.emptyStateText}>No upcoming events</Text>
                <Text style={styles.emptyStateSubtext}>Check back later for new opportunities</Text>
              </View>
            )}
          </View>

          {/* Recent Impact */}
          {recentEvents.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recent Impact</Text>
              <FlatList
                data={recentEvents.slice(0, 3)}
                keyExtractor={item => item.id}
                renderItem={renderRecentEvent}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Get in Touch</Text>
            <View style={styles.contactGrid}>
              {organization.email && (
                <TouchableOpacity 
                  style={styles.contactItem}
                  onPress={() => handleContact('email')}
                >
                  <Ionicons name="mail-outline" size={20} color="#4e8cff" />
                  <Text style={styles.contactText}>Email</Text>
                </TouchableOpacity>
              )}
              
              {organization.phone && (
                <TouchableOpacity 
                  style={styles.contactItem}
                  onPress={() => handleContact('phone')}
                >
                  <Ionicons name="call-outline" size={20} color="#4e8cff" />
                  <Text style={styles.contactText}>Call</Text>
                </TouchableOpacity>
              )}
              
              {organization.website && (
                <TouchableOpacity 
                  style={styles.contactItem}
                  onPress={() => handleContact('website')}
                >
                  <Ionicons name="globe-outline" size={20} color="#4e8cff" />
                  <Text style={styles.contactText}>Website</Text>
                </TouchableOpacity>
              )}
              
              <TouchableOpacity 
                style={styles.contactItem}
                onPress={handleShare}
              >
                <Ionicons name="share-outline" size={20} color="#4e8cff" />
                <Text style={styles.contactText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Animatable.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  heroSection: {
    position: 'relative',
    height: 250,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 20,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 70,
    height: 70,
    borderRadius: 35,
    marginRight: 15,
    borderWidth: 3,
    borderColor: '#fff',
  },
  heroInfo: {
    flex: 1,
  },
  nameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginRight: 8,
  },
  verifiedIcon: {
    marginLeft: 4,
  },
  location: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  categoryContainer: {
    flexDirection: 'row',
  },
  content: {
    padding: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    marginBottom: 25,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    flex: 1,
    marginRight: 10,
    justifyContent: 'center',
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 6,
  },
  followingButtonText: {
    color: '#2B2B2B',
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    marginRight: 10,
  },
  contactButtonText: {
    color: '#2B2B2B',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  shareButton: {
    padding: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricsSection: {
    marginBottom: 25,
  },
  metricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  viewAllText: {
    fontSize: 14,
    color: '#2B2B2B',
    fontWeight: '500',
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
    marginBottom: 15,
  },
  missionContainer: {
    backgroundColor: '#f8f9fa',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2B2B2B',
  },
  missionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 5,
  },
  mission: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  eventsList: {
    paddingRight: 20,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 15,
    width: 250,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  eventImage: {
    width: '100%',
    height: 120,
  },
  eventContent: {
    padding: 15,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  eventMeta: {
    marginBottom: 12,
  },
  eventDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventDetailText: {
    fontSize: 12,
    color: '#666',
    marginLeft: 6,
    flex: 1,
  },
  eventActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  registeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  registeredText: {
    fontSize: 10,
    color: '#4CAF50',
    marginLeft: 4,
    fontWeight: '600',
  },
  recentEventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  recentEventImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  recentEventContent: {
    flex: 1,
  },
  recentEventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  recentEventDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  recentEventParticipants: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    width: '48%',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  contactText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});

