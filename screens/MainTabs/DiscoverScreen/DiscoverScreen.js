import { Ionicons } from '@expo/vector-icons';
import { arrayRemove, arrayUnion, collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
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

  // Fetch organizations from Firestore
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
          activityScore: calculateActivityScore(data),
          isVerified: data.verified || false,
        };
      });

      // Sort by activity score and follower count
      orgsData.sort((a, b) => {
        if (a.activityScore !== b.activityScore) {
          return b.activityScore - a.activityScore;
        }
        return b.followerCount - a.followerCount;
      });

      setOrganizations(orgsData);
      setFilteredOrganizations(orgsData);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching organizations:', error);
      Alert.alert('Error', 'Failed to load organizations. Please try again.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    filterOrganizations();
  }, [searchQuery, organizations]);

  const calculateActivityScore = (orgData) => {
    let score = 0;

    // Recent activity boost
    const lastActive = orgData.lastActive?.toDate ? orgData.lastActive.toDate() : new Date(orgData.lastActive || 0);
    const daysSinceActive = (new Date() - lastActive) / (1000 * 60 * 60 * 24);
    if (daysSinceActive <= 7) score += 10;
    else if (daysSinceActive <= 30) score += 5;

    // Event count boost
    const eventCount = orgData.upcomingEvents || 0;
    score += Math.min(eventCount * 2, 10);

    // Follower boost
    const followers = orgData.followers?.length || 0;
    score += Math.min(Math.floor(followers / 10), 15);

    // Verification boost
    if (orgData.verified) score += 5;

    return score;
  };

  const filterOrganizations = () => {
    let filtered = organizations;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(org =>
        org.name?.toLowerCase().includes(query) ||
        org.description?.toLowerCase().includes(query) ||
        org.location?.toLowerCase().includes(query) ||
        org.category?.toLowerCase().includes(query) ||
        org.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    setFilteredOrganizations(filtered);
  };

const handleFollow = async (orgId) => {
  if (!user?.uid) {
    Alert.alert('Error', 'You must be logged in to follow organizations.');
    return;
  }

  const orgToUpdate = organizations.find(org => org.id === orgId);
  if (!orgToUpdate) return;

  try {
    console.log('Updating organization followers for:', orgId);
    const orgRef = doc(db, 'organizations', orgId);

    if (orgToUpdate.isFollowing) {
      // Unfollow - remove user from organization's followers
      await updateDoc(orgRef, {
        followers: arrayRemove(user.uid)
      });
      
      setFollowedOrganizations(prev => prev.filter(id => id !== orgId));
      console.log('Successfully unfollowed');
      
    } else {
      // Follow - add user to organization's followers
      await updateDoc(orgRef, {
        followers: arrayUnion(user.uid)
      });
      
      setFollowedOrganizations(prev => [...prev, orgId]);
      console.log('Successfully followed');
    }

  } catch (error) {
    console.error('Full error object:', error);
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    
    let errorMessage = 'Failed to update follow status';
    
    if (error?.code === 'permission-denied') {
      errorMessage = 'You do not have permission to perform this action';
    } else if (error?.code === 'not-found') {
      errorMessage = 'Organization not found';
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    Alert.alert('Error', errorMessage);
  }
};



  const getCategoryColor = (category) => {
    const colors = {
      'Environment': '#4CAF50',
      'Education': '#9C27B0',
      'Health': '#F44336',
      'Animals': '#FF9800',
      'Community': '#2196F3',
      'Disaster Relief': '#FF5722',
    };
    return colors[category] || '#666';
  };

  const renderOrganizationItem = ({ item, index }) => (
    <Animatable.View
      animation="fadeInUp"
      delay={index * 50}
      style={styles.organizationItem}
    >
      <TouchableOpacity
        onPress={() => navigation.navigate('OrganizationDetails', { organization: item })}
        style={styles.organizationContent}
        activeOpacity={0.7}
      >
        <View style={styles.logoContainer}>
          <Image 
            source={{ uri: item.logo || 'https://via.placeholder.com/60' }} 
            style={styles.organizationLogo} 
          />
          {item.isVerified && (
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
            </View>
          )}
        </View>

        <View style={styles.organizationInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.organizationName} numberOfLines={1}>
              {item.name}
            </Text>
            {item.category && (
              <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(item.category) }]}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            )}
          </View>
          
          {item.description && (
            <Text style={styles.organizationDescription} numberOfLines={2}>
              {item.description}
            </Text>
          )}
          
          <View style={styles.statsRow}>
            {item.location && (
              <Text style={styles.statItem}>
                <Ionicons name="location-outline" size={12} color="#999" />
                {' '}{item.location}
              </Text>
            )}
            <Text style={styles.statItem}>
              <Ionicons name="people-outline" size={12} color="#999" />
              {' '}{item.followerCount} followers
            </Text>
            <Text style={styles.statItem}>
              <Ionicons name="calendar-outline" size={12} color="#999" />
              {' '}{item.upcomingEvents || 0} events
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.followButton,
          item.isFollowing && styles.followingButton
        ]}
        onPress={() => handleFollow(item.id)}
        activeOpacity={0.8}
      >
        <Text style={[
          styles.followButtonText,
          item.isFollowing && styles.followingButtonText
        ]}>
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
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search organizations..."
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Results Header */}
      {filteredOrganizations.length > 0 && (
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsText}>
            {filteredOrganizations.length} organization{filteredOrganizations.length !== 1 ? 's' : ''}
          </Text>
        </View>
      )}

      {/* Organizations List */}
      {filteredOrganizations.length > 0 ? (
        <FlatList
          data={filteredOrganizations}
          keyExtractor={item => item.id}
          renderItem={renderOrganizationItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.organizationsList}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="search-outline" size={60} color="#666" />
          <Text style={styles.emptyText}>No organizations found</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery
              ? 'Try adjusting your search terms'
              : 'Check back later for new organizations'
            }
          </Text>
          {searchQuery && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={() => setSearchQuery('')}
            >
              <Text style={styles.clearAllText}>Clear search</Text>
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
    backgroundColor: '#FFFFFF',
  },
  
  // Search Container
  searchContainer: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
  },
  
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2B2B2B',
    marginLeft: 12,
    marginRight: 8,
  },
  
  // Results Header
  resultsHeader: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  
  resultsText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  
  // Organization List
  organizationsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  
  organizationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
  },
  
  organizationContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  separator: {
    height: 1,
    backgroundColor: '#E0E0E0',
    marginHorizontal: 20,
  },
  
  // Logo Container
  logoContainer: {
    position: 'relative',
    marginRight: 16,
  },
  
  organizationLogo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  
  // Organization Info
  organizationInfo: {
    flex: 1,
  },
  
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  
  organizationName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2B2B2B',
    flex: 1,
  },
  
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  
  categoryText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  organizationDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
    lineHeight: 20,
  },
  
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  
  statItem: {
    fontSize: 12,
    color: '#999999',
    marginRight: 16,
    marginBottom: 2,
  },
  
  // Follow Button
  followButton: {
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 90,
    alignItems: 'center',
    marginLeft: 12,
  },
  
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  
  followButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  
  followingButtonText: {
    color: '#2B2B2B',
  },
  
  // Loading Container
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 80,
  },
  
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2B2B2B',
    marginTop: 16,
    textAlign: 'center',
  },
  
  emptySubtext: {
    fontSize: 14,
    color: '#666666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  clearAllButton: {
    backgroundColor: '#2B2B2B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 24,
  },
  
  clearAllText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
