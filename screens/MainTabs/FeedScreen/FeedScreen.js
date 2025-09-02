import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { collection, onSnapshot, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebaseConfig';
import { Ionicons } from '@expo/vector-icons';

export default function FeedScreen({ navigation }) {
  const [popularEvents, setPopularEvents] = useState([]);
  const [topOrganizations, setTopOrganizations] = useState([]);
  const [posts, setPosts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const followedOrgIds = ['org1', 'org2', 'org3']; // Replace with actual followed org IDs

  useEffect(() => {
    const unsubscribePopularEvents = fetchPopularEvents();
    const unsubscribeTopOrgs = fetchTopOrganizations();
    const unsubscribePosts = fetchOrganizationPosts();

    return () => {
      unsubscribePopularEvents && unsubscribePopularEvents();
      unsubscribeTopOrgs && unsubscribeTopOrgs();
      unsubscribePosts && unsubscribePosts();
    };
  }, []);

  const fetchPopularEvents = () => {
    const today = Timestamp.fromDate(new Date());
    const popularEventsQuery = query(
      collection(db, 'events'),
      where('date', '>=', today),
      orderBy('participantsCount', 'desc'),
      limit(10)
    );

    return onSnapshot(popularEventsQuery, snapshot => {
      const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPopularEvents(events);
      setLoading(false);
      setRefreshing(false);
    }, error => {
      Alert.alert('Error', 'Failed to load popular events: ' + error.message);
      setLoading(false);
      setRefreshing(false);
    });
  };

  const fetchTopOrganizations = () => {
    const orgsQuery = query(collection(db, 'organizations'), orderBy('followers', 'desc'), limit(20));

    return onSnapshot(orgsQuery, snapshot => {
      const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTopOrganizations(orgs);
    }, error => {
      Alert.alert('Error', 'Failed to load organizations: ' + error.message);
    });
  };

  const fetchOrganizationPosts = () => {
    // Fetch recent posts from all organizations, filter on client for followed/unfollowed
    const postsQuery = query(
      collection(db, 'posts'),
      orderBy('createdAt', 'desc'),
      limit(40) // fetch more for client filtering
    );

    return onSnapshot(postsQuery, snapshot => {
      const allPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Optionally you may want to prioritize followed org posts or mix
      // Here we just pass all posts; applying any user filter you want in render or earlier

      setPosts(allPosts);
    }, error => {
      Alert.alert('Error', 'Failed to load posts: ' + error.message);
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    setLoading(true);
    fetchPopularEvents();
    fetchTopOrganizations();
    fetchOrganizationPosts();
  };

  // Render Popular Event (horizontal scroll)
  const renderPopularEvent = ({ item, index }) => (
    <Animatable.View animation="fadeInLeft" delay={index * 100} style={styles.horizontalCard}>
      <Image
        source={{ uri: item.organizationAvatar || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.eventName}>{item.title || item.eventName || 'Untitled Event'}</Text>
        <Text style={styles.organizationName}>{item.organizationName || item.organization}</Text>
        <Text style={styles.eventDate}>
          {item.date?.toDate ? item.date.toDate().toLocaleDateString() : item.date || ''}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.registerButton}
        onPress={() => navigation.navigate('EventRegistration', { eventId: item.id })}
      >
        <Text style={styles.registerButtonText}>Register</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  // Render Top Organization (horizontal scroll)
 const renderOrgCard = ({ item }) => (
  <Animatable.View style={styles.orgCard} animation="fadeInLeft">
    <Image source={{ uri: item.logoUrl || item.logo || 'https://via.placeholder.com/50' }} style={styles.orgAvatar} />
    {/* Render the organization name here, never the ID */}
    <Text style={styles.orgName}>
      {item.name || item.organizationName || 'Unknown Organization'}
    </Text>
    {/* <Text style={styles.orgFollowers}>{item.followers || 0} followers</Text> */}
  </Animatable.View>
);

  // Render Organization Post (vertical Instagram style)
  const renderPost = ({ item }) => (
    <Animatable.View style={styles.postCard} animation="fadeInUp">
      <View style={styles.postHeader}>
        <Image
          source={{ uri: item.organizationAvatar || 'https://via.placeholder.com/40' }}
          style={styles.postAvatar}
        />
        <Text style={styles.postOrgName}>{item.organizationName || item.organization}</Text>
      </View>
      <Text style={styles.postCaption}>{item.caption || item.text || ''}</Text>
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
      ) : null}
      <View style={styles.postActions}>
        <TouchableOpacity><Ionicons name="heart-outline" size={24} color="#444" /></TouchableOpacity>
        <TouchableOpacity><Ionicons name="chatbubble-outline" size={24} color="#444" /></TouchableOpacity>
        <TouchableOpacity><Ionicons name="share-social-outline" size={24} color="#444" /></TouchableOpacity>
      </View>
    </Animatable.View>
  );

  if (loading) return (
    <View style={styles.loadingContainer}>
      <Ionicons name="calendar" size={50} color="#2B2B2B" />
      <Text style={styles.loadingText}>Loading feed...</Text>
    </View>
  );

  return (
    <View style={styles.outerContainer}>
      <View style={styles.topBar}>
        <Text style={styles.appName}>YOUnite</Text>
        <View style={styles.topBarButtons}>
          <TouchableOpacity onPress={() => setIsSearching(true)} style={styles.iconButton}>
            <Ionicons name="search" size={28} color="#2B2B2B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('CreateReport')}>
            <Ionicons name="flag-outline" size={28} color="#2B2B2B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={28} color="#2B2B2B" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>3</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Popular Events */}
        <View style={{ marginVertical: 12 }}>
          <Text style={styles.sectionTitle}>Popular Events</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={popularEvents}
            keyExtractor={item => item.id}
            renderItem={renderPopularEvent}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 12 }}
          />
        </View>

        {/* Top Organizations */}
        <View style={{ marginVertical: 12 }}>
          <Text style={styles.sectionTitle}>Top Organizations</Text>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={topOrganizations}
            keyExtractor={item => item.id}
            renderItem={renderOrgCard}
            contentContainerStyle={{ paddingLeft: 16, paddingRight: 12 }}
          />
        </View>

        {/* Organization Posts */}
        <View style={{ marginVertical: 12 }}>
          <Text style={styles.sectionTitle}>Posts</Text>
          <FlatList
            data={posts}
            keyExtractor={item => item.id}
            renderItem={renderPost}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomColor: '#E0E0E0',
    borderBottomWidth: 1,
  },
  appName: { fontSize: 28, fontWeight: 'bold', color: '#2B2B2B' },
  topBarButtons: { flexDirection: 'row', gap: 14 },
  iconButton: { marginLeft: 10, position: 'relative' },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#E33F3F',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

  sectionTitle: { fontSize: 22, fontWeight: '700', color: '#2B2B2B', marginLeft: 16, marginBottom: 12 },

  // Popular Events horizontal card
  horizontalCard: {
    backgroundColor: '#fefefe',
    width: 280,
    marginRight: 16,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee' },
  eventName: { fontWeight: '700', fontSize: 16, color: '#2B2B2B' },
  eventDate: { fontSize: 13, color: '#666', marginTop: 4 },
  organizationName: { fontSize: 14, color: '#555', marginTop: 2 },
  registerButton: {
    backgroundColor: '#346beb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  registerButtonText: { color: '#fff', fontWeight: '600' },

  // Top org cards
  orgCard: {
    backgroundColor: '#fff',
    width: 140,
    marginRight: 16,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  orgAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#eee', marginBottom: 8 },
  orgName: { fontWeight: '700', fontSize: 16, color: '#2B2B2B', textAlign: 'center' },
  orgFollowers: { fontSize: 12, color: '#555' },

  // Instagram-style post cards
  postCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  postAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eee', marginRight: 12 },
  postOrgName: { fontWeight: 'bold', fontSize: 16, color: '#222' },
  postCaption: { fontSize: 14, color: '#444', marginBottom: 8 },
  postImage: { width: '100%', height: 250, borderRadius: 12 },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 6,
  },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontWeight: '600', fontSize: 16, color: '#2B2B2B' },
});
