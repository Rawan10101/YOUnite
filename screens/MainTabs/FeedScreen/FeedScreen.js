import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, orderBy, query, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';

export default function FeedScreen({ navigation }) {
  const { user, followedOrganizations } = useAppContext();
  const [feedData, setFeedData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = fetchFeedData();
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user?.uid, followedOrganizations]);

  const fetchFeedData = () => {
    setLoading(true);
    console.log('Fetching posts from Firestore...'); // Debug log
    
    const postsQuery = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));

    const unsubscribePosts = onSnapshot(
      postsQuery, 
      snapshot => {
        console.log('Posts snapshot received:', snapshot.size); // Debug log
        
        const posts = snapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Post data:', data); // Debug log
          
          return {
            id: doc.id,
            type: data.type || 'user_post',
            authorId: data.authorId,
            authorType: data.authorType || 'user',
            authorName: data.authorName,
            authorAvatar: data.authorAvatar || 'https://via.placeholder.com/50',
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleString() : new Date().toLocaleString(),
            text: data.text || '',
            imageUrl: data.imageUrl || null,
          };
        });
        
        console.log('Processed posts:', posts.length); // Debug log
        setFeedData(posts);
        setLoading(false);
        setRefreshing(false);
      }, 
      error => {
        console.error('Firestore error:', error); // Debug log
        Alert.alert('Error', 'Failed to load posts: ' + error.message);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return unsubscribePosts;
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFeedData();
  };

  const renderFeedItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 80} style={styles.feedItem}>
      <View style={styles.feedHeader}>
        <Image source={{ uri: item.authorAvatar }} style={styles.orgLogo} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.orgName}>{item.authorName}</Text>
          <Text style={styles.timestamp}>{item.createdAt}</Text>
        </View>
        <View style={styles.postTypeIndicator}>
          <Ionicons
            name={item.authorType === 'organization' ? 'business' : 'person'}
            size={16}
            color="#666"
          />
        </View>
      </View>
      <View style={styles.feedContent}>
        <Text style={styles.feedText}>{item.text}</Text>
        {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.feedImage} />}
      </View>
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postActionButton}>
          <Ionicons name="heart-outline" size={18} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.postActionButton}>
          <Ionicons name="chatbubble-outline" size={18} color="#666" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.postActionButton}>
          <Ionicons name="share-outline" size={18} color="#666" />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="heart" size={50} color="#2B2B2B" />
        <Text style={styles.loadingText}>Loading posts...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.appName}>YOUnite</Text>
        <View style={styles.topBarButtons}>
          {/* Create Post Button */}<TouchableOpacity
  style={styles.iconButton}
  onPress={() => navigation.navigate('CreateReport')}
>
  <Ionicons name="flag-outline" size={28} color="#2B2B2B" />
</TouchableOpacity>

          
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={28} color="#2B2B2B" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>3</Text>
            </View>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => navigation.navigate('Chat')}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={28} color="#2B2B2B" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={feedData}
        keyExtractor={(item) => item.id}
        renderItem={renderFeedItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ paddingBottom: 50 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  appName: {
    fontSize: 30,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  topBarButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  iconButton: {
    marginLeft: 8,
    position: 'relative',
  },
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
  notificationCount: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  feedItem: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  feedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
  },
  orgLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  orgName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  postTypeIndicator: {
    padding: 4,
  },
  feedContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  feedText: {
    fontSize: 16,
    color: '#2B2B2B',
    lineHeight: 24,
    marginBottom: 12,
  },
  feedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginTop: 8,
  },
  postActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  postActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#2B2B2B2B',
    fontWeight: '600',
  },
});
