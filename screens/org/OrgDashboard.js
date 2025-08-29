import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

export default function OrganizationDashboard({ navigation }) {
  const { user } = useAppContext();
  const [organization, setOrganization] = useState(null);
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Load organization data
  useEffect(() => {
    if (!user?.uid) return;

    const fetchOrganizationData = async () => {
      try {
        const orgDoc = await getDoc(doc(db, 'organizations', user.uid));
        if (orgDoc.exists()) {
          setOrganization(orgDoc.data());
        }
      } catch (error) {
        console.error('Error fetching organization:', error);
      }
    };

    fetchOrganizationData();
  }, [user?.uid]);

  // Setup real-time listener for REPORTS ONLY
  useEffect(() => {
    if (!user?.uid) return;

    // Listen to reports mentioning this organization
    console.log('Setting up reports listener for organization:', user.uid);
    const unsubscribeReports = onSnapshot(
      query(
        collection(db, 'reports'),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        console.log('Reports snapshot received:', snapshot.docs.length, 'total documents');
        
        // Filter reports that mention this organization and add sourceType
        const filteredReports = snapshot.docs
          .map(doc => ({ 
            id: doc.id, 
            ...doc.data(),
            sourceType: 'report', // Add this to maintain consistency with your existing design
            sortTime: doc.data().createdAt?.seconds || 0
          }))
          .filter(report => {
            // Check if this organization is mentioned in the report
            const isMentioned = report.mentionedOrganizations?.some(org => {
              if (typeof org === 'string') {
                return org === user.uid;
              } else if (typeof org === 'object' && org !== null) {
                return org.id === user.uid;
              }
              return false;
            });
            
            if (isMentioned) {
              console.log('Report mentions this org:', report.id);
            }
            
            return isMentioned;
          });

        console.log('Filtered reports for this org:', filteredReports.length);
        setFeedItems(filteredReports); // Set only reports
        setLoading(false);
      },
      (error) => {
        console.error('Reports listener error:', error);
        setLoading(false);
      }
    );

    return () => {
      console.log('Cleaning up dashboard listeners');
      unsubscribeReports();
    };
  }, [user?.uid]);

  const handleRefresh = async () => {
    setRefreshing(true);
    // Real-time listener will automatically update the data
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const renderFeedItem = ({ item }) => {
    // Since we only have reports now, we can simplify this
    const isReport = item.sourceType === 'report';

    return (
      <View style={styles.feedCard}>
        {/* Report Header */}
        <View style={styles.feedHeader}>
          <View style={styles.authorInfo}>
            <Image
              source={{
                uri: item.reporterAvatar || 'https://via.placeholder.com/44'
              }}
              style={styles.authorAvatar}
            />
            <View style={styles.authorDetails}>
              <Text style={styles.authorName}>
                {item.reporterName || 'Anonymous User'}
              </Text>
              <Text style={styles.postTimestamp}>
                {formatTimestamp(item.createdAt)}
              </Text>
            </View>
          </View>
          
          {/* Type Badge - Always REPORT now */}
          <View style={[styles.typeBadge, getTypeStyle(item.sourceType)]}>
            <Ionicons name={getTypeIcon(item.sourceType)} size={12} color="#fff" />
            <Text style={styles.badgeText}>REPORT</Text>
          </View>
        </View>

        {/* Content */}
        {item.text && (
          <Text style={styles.feedText}>{item.text}</Text>
        )}

        {/* Image */}
        {item.imageUrl && (
          <Image source={{ uri: item.imageUrl }} style={styles.feedImage} />
        )}

        {/* Mentioned Organizations */}
        {item.mentionedOrganizations && (
          <View style={styles.mentionedOrgsContainer}>
            <Text style={styles.mentionedOrgsLabel}>Mentioned Organizations:</Text>
            <View style={styles.mentionedOrgs}>
              {item.mentionedOrganizations.map((org, index) => (
                <View key={index} style={styles.mentionedOrg}>
                  <Image 
                    source={{ uri: (typeof org === 'object' ? org.logo : null) || 'https://via.placeholder.com/20' }}
                    style={styles.mentionedOrgLogo}
                  />
                  <Text style={styles.mentionedOrgName}>
                    {typeof org === 'object' ? org.name : 'Organization'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Engagement Footer */}
        <View style={styles.engagementFooter}>
          <TouchableOpacity style={styles.engagementButton}>
            <Ionicons name="heart-outline" size={18} color="#666" />
            <Text style={styles.engagementText}>{item.likes?.length || 0}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.engagementButton}>
            <Ionicons name="chatbubble-outline" size={18} color="#666" />
            <Text style={styles.engagementText}>{item.comments?.length || 0}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.engagementButton}>
            <Ionicons name="eye-outline" size={18} color="#666" />
            <Text style={styles.engagementText}>{item.views?.length || 0}</Text>
          </TouchableOpacity>

          {/* Respond button - Always shown for reports */}
          <TouchableOpacity 
            style={styles.respondButton}
            onPress={() => navigation.navigate('RespondToReport', { report: item })}
          >
            <Ionicons name="mail-outline" size={16} color="#2B2B2B" />
            <Text style={styles.respondText}>Respond</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const getTypeStyle = (sourceType) => {
    return { backgroundColor: '#E74C3C' }; // Always red for reports
  };

  const getTypeIcon = (sourceType) => {
    return 'flag'; // Always flag for reports
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="flag-outline" size={80} color="#E0E0E0" />
      <Text style={styles.emptyTitle}>No Reports Yet</Text>
      <Text style={styles.emptySubtitle}>
        Community reports about your organization will appear here
      </Text>
    </View>
  );

  if (loading && feedItems.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2B2B2B" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Simple Header with Icons Only */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>YOUnite</Text>
        
        {/* Action Icon Buttons */}
        <View style={styles.actionIcons}>
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: '#fff' }]}
            onPress={() => navigation.navigate('PostDetails')}
          >
            <Ionicons name="add" size={26} color="#2B2B2B" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: '#fff' }]}
            onPress={() => navigation.navigate('CreateEvent')}
          >
            <Ionicons name="calendar-outline" size={26} color="#2B2B2B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed Content - Now only reports */}
      <FlatList
        data={feedItems}
        keyExtractor={(item) => `${item.sourceType}-${item.id}`}
        renderItem={renderFeedItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },

  // Loading State
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },

  // Simple Header
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },

  // Action Icon Buttons
  actionIcons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  // Feed Content
  feedContent: {
    paddingVertical: 16,
  },

  // Feed Card
  feedCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },

  // Feed Header
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#F3F4F6',
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  postTimestamp: {
    fontSize: 14,
    color: '#6B7280',
  },

  // Type Badge
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 4,
    letterSpacing: 0.5,
  },

  // Feed Content
  feedText: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
    marginBottom: 16,
  },
  feedImage: {
    width: '100%',
    height: 240,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
  },

  // Mentioned Organizations (Reports only)
  mentionedOrgsContainer: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  mentionedOrgsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  mentionedOrgs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mentionedOrg: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  mentionedOrgLogo: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
  },
  mentionedOrgName: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },

  // Engagement Footer
  engagementFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 24,
  },
  engagementText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    marginLeft: 6,
  },
  respondButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 'auto',
  },
  respondText: {
    fontSize: 14,
    color: '#4e8cff',
    fontWeight: '600',
    marginLeft: 6,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#374151',
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});
