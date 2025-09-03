import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  StyleSheet,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';

export default function DiscoverScreen({ navigation }) {
  const { user, followedOrganizations, setFollowedOrganizations } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [organizations, setOrganizations] = useState([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'organizations'), (snapshot) => {
      const orgsData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          isFollowing: user ? data.followers?.includes(user.uid) : false,
          followerCount: data.followers?.length || 0,
          eventCount: data.upcomingEvents || 0,
        };
      });

      // Sort by most followers, then most events
      orgsData.sort((a, b) => {
        if (b.followerCount !== a.followerCount) return b.followerCount - a.followerCount;
        return b.eventCount - a.eventCount;
      });

      setOrganizations(orgsData);
      setFilteredOrganizations(orgsData);
      setLoading(false);
    }, (error) => {
      Alert.alert('Error', 'Failed to load organizations.');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    let filtered = organizations;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(org =>
        org.name?.toLowerCase().includes(query) ||
        org.description?.toLowerCase().includes(query) ||
        org.location?.toLowerCase().includes(query) ||
        org.category?.toLowerCase().includes(query)
      );
    }
    setFilteredOrganizations(filtered);
  }, [searchQuery, organizations]);

  const handleFollow = async (orgId) => {
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to follow organizations.');
      return;
    }
    const orgRef = doc(db, 'organizations', orgId);
    const orgToUpdate = organizations.find(org => org.id === orgId);
    if (!orgToUpdate) return;

    try {
      if (orgToUpdate.isFollowing) {
        await updateDoc(orgRef, { followers: arrayRemove(user.uid) });
        setFollowedOrganizations(prev => prev.filter(id => id !== orgId));
      } else {
        await updateDoc(orgRef, { followers: arrayUnion(user.uid) });
        setFollowedOrganizations(prev => [...prev, orgId]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update follow status.');
    }
  };

  const getColor = (key) => {
    const colors = {
      'A': '#4e8cff',
      'B': '#4CAF50',
      'R': '#F44336',
      'U': '#FFD93D',
      'T': '#1976d2',
      // default color
      'default': '#BDBDBD',
    };
    return colors[key] || colors['default'];
  };

  const renderLogo = (org) => {
    if (org.logo) {
      return <Image source={{ uri: org.logo }} style={styles.avatar} />;
    } else {
      // Render first letter avatar
      const first = org.name?.charAt(0).toUpperCase() || '';
      return (
        <View style={[styles.avatar, { backgroundColor: getColor(first) }]}>
          <Text style={styles.avatarLetter}>{first}</Text>
        </View>
      );
    }
  };

  const renderOrganizationItem = ({ item, index }) => (
    <Animatable.View animation="fadeInUp" delay={index * 40} style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() => navigation.navigate('OrganizationDetails', { organization: item })}
        activeOpacity={0.8}
      >
        {renderLogo(item)}
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.cardSubtitle}>{item.description || item.category || ' '}</Text>
          <View style={styles.cardStats}>
            <Text style={styles.stat}><Ionicons name="people-outline" size={14} color="#666" /> {item.followerCount} followers</Text>
            <Text style={styles.stat}><Ionicons name="calendar-outline" size={14} color="#666" /> {item.eventCount} events</Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
        onPress={() => handleFollow(item.id)}
      >
        <Text style={[styles.followTxt, item.isFollowing && styles.followingTxt]}>
          {item.isFollowing ? 'Following' : 'Follow'}
        </Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="search" size={50} color="#4e8cff" />
        <Text style={styles.loadingText}>Discovering organizations...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchSection}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={20} color="#888" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search organizations..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#bbb" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <Text style={styles.popularHeader}>Top Organizations</Text>

      <FlatList
        data={filteredOrganizations}
        // horizontal={true}
        keyExtractor={item => item.id}
        renderItem={renderOrganizationItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={52} color="#bbb" />
            <Text style={styles.emptyText}>No organizations found</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
searchSection: {
  paddingHorizontal: 20,
  paddingTop: 50,  // Increased paddingTop to move search bar down
  paddingBottom: 6,
  backgroundColor: '#fff',
},  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F4F6FB',
    borderRadius: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#ececec',
  },
  searchInput: { flex: 1, fontSize: 16, color: '#2B2B2B', marginLeft: 8 },
  popularHeader: {
    marginLeft: 22,
    marginTop: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  listContainer: { paddingHorizontal: 14, paddingBottom: 16 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fafbff',
    borderRadius: 16,
    padding: 14,
    elevation: 1,
    shadowColor: '#ececec',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
  },
  cardContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: { fontSize: 22, fontWeight: '700', color: '#fff' },
  cardInfo: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '600', color: '#263238' },
  cardSubtitle: { fontSize: 13, color: '#75838f', marginVertical: 2 },
  cardStats: { flexDirection: 'row', marginTop: 6 },
  stat: { color: '#989898', fontSize: 13, marginRight: 18 },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#222',
    alignItems: 'center',
    minWidth: 85,
  },
  followTxt: { color: '#fff', fontWeight: '500', fontSize: 14 },
  followingBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#222',
  },
  followingTxt: { color: '#222' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  loadingText: { marginTop: 16, fontSize: 16, color: '#888', textAlign: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 16, color: '#888', marginTop: 10 },
});
