import { Ionicons } from '@expo/vector-icons';
import {
  collection, doc, getDoc, limit, onSnapshot, orderBy, query,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';
// Add this component at the top of your ProfileScreen file, after imports
const ProfileAvatar = ({ photoURL, displayName, size = 100 }) => {
  const getInitials = (name) => {
    if (!name) return 'V'; // Default to 'V' for Volunteer
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const getAvatarColor = (name) => {
    const colors = ['#4e8cff', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    if (!name) return colors;
    const index = name.length % colors.length;
    return colors[index];
  };

  // Only show default if user has NO profile image set (photoURL is null/undefined)
  if (!photoURL) {
    return (
      <View style={[
        styles.defaultAvatar, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: getAvatarColor(displayName)
        }
      ]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
          {getInitials(displayName)}
        </Text>
      </View>
    );
  }

  // If user has set a profile image, always try to show it (no fallback on error)
  return (
    <Image 
      source={{ uri: photoURL }} 
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
    />
  );
};

export default function ProfileScreen({ navigation }) {
  const { user, setUser, followedOrganizations } = useAppContext();
  const [userStats, setUserStats] = useState({
    totalHours: 0,
    eventsAttended: 0,
    eventsRegistered: 0,
    organizationsFollowed: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
      setupActivityListener();
    }
  }, [user?.uid, followedOrganizations]);

  const fetchUserData = async () => {
    try {
      // Get user document for additional stats
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUserStats(prev => ({
          ...prev,
          totalHours: userData.totalVolunteerHours || 0,
          eventsAttended: userData.eventsAttended || 0,
          eventsRegistered: userData.registeredEvents?.length || 0,
          organizationsFollowed: followedOrganizations.length,
        }));
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupActivityListener = () => {
    // Listen to user's posts for recent activity
    const userPostsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(userPostsQuery, (querySnapshot) => {
      const activities = [];
      
      querySnapshot.docs.forEach(doc => {
        const postData = doc.data();
        activities.push({
          id: doc.id,
          type: postData.type === 'report' ? 'report_created' : 'post_created',
          title: postData.type === 'report' 
            ? 'Created a new report' 
            : 'Shared a new post',
          date: postData.createdAt?.toDate ? 
            getTimeAgo(postData.createdAt.toDate()) : 
            'Recently',
          icon: postData.type === 'report' ? 'flag' : 'chatbox',
          color: postData.type === 'report' ? '#E33F3F' : '#4e8cff',
        });
      });

      setRecentActivities(activities);
    }, (error) => {
      console.error('Error fetching activities:', error);
    });

    return unsubscribe;
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInMs = now - date;
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
    
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
    return `${Math.floor(diffInDays / 30)} months ago`;
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Logout', 
          style: 'destructive',
          onPress: () => setUser(null)
        },
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Profile editing feature coming soon!');
  };

  const renderStatCard = (title, value, icon, color) => (
    <Animatable.View
      animation="fadeInUp"
      duration={600}
      style={[styles.statCard, { borderLeftColor: color }]}
    >
      <View style={styles.statContent}>
        <Ionicons name={icon} size={24} color={color} />
        <View style={styles.statText}>
          <Text style={styles.statValue}>{value}</Text>
          <Text style={styles.statTitle}>{title}</Text>
        </View>
      </View>
    </Animatable.View>
  );

  const renderActivity = ({ item, index }) => (
    <Animatable.View
      animation="fadeInLeft"
      duration={600}
      delay={index * 100}
      style={styles.activityItem}
    >
      <View style={[styles.activityIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={16} color="#fff" />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityDate}>{item.date}</Text>
      </View>
    </Animatable.View>
  );

const menuItems = [
  {
    id: '1',
    title: 'Edit Profile',
    icon: 'create-outline',
    onPress: () => navigation.navigate('EditProfile'),
  },
  {
    id: '2',
    title: 'Profile Details',
    icon: 'person-circle-outline',
    onPress: () => navigation.navigate('ProfileDetails'),
  },
  {
    id: '3',
    title: 'My Events',
    icon: 'calendar-outline',
    onPress: () => navigation.navigate('Events', { screen: 'EventsMain' }),
  },
  {
    id: '4',
    title: 'Followed Organizations',
    icon: 'heart-outline',
    onPress: () => navigation.navigate('DiscoverMain'),
  },
  {
    id: '5',
    title: 'My Reports',
    icon: 'flag-outline',
    onPress: () => Alert.alert('Reports', 'My Reports page coming soon!'),
  },
  {
    id: '6',
    title: 'Settings',
    icon: 'settings-outline',
    onPress: () => navigation.navigate('Settings'),
  },
  {
    id: '7',
    title: 'Help & Support',
    icon: 'help-circle-outline',
    onPress: () => Alert.alert('Help', 'Help & Support coming soon!'),
  },
];


  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Animatable.View animation="pulse" iterationCount="infinite">
          <Ionicons name="person" size={48} color="#4e8cff" />
        </Animatable.View>
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Info */}
 {/* Profile Info - Clean & Simple */}
<Animatable.View animation="fadeInDown" duration={800} style={styles.profileSection}>
  {/* Profile Avatar & Name */}
  <View style={styles.profileInfo}>
    <ProfileAvatar 
      photoURL={user?.photoURL} 
      displayName={user?.displayName || user?.email?.split('@')[0]} 
      size={80}
    />
    <Text style={styles.userName}>
      {user?.displayName || user?.email?.split('@') || 'Volunteer'}
    </Text>
  </View>
</Animatable.View>
      {/* Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Your Impact</Text>
        <View style={styles.statsGrid}>
          {renderStatCard('Hours Volunteered', userStats.totalHours, 'time-outline', '#4CAF50')}
          {renderStatCard('Events Attended', userStats.eventsAttended, 'calendar-outline', '#2196F3')}
          {renderStatCard('Organizations', userStats.organizationsFollowed, 'heart-outline', '#FF4757')}
          {renderStatCard('Registered Events', userStats.eventsRegistered, 'arrow-up-circle-outline', '#FF9800')}
        </View>
      </View>

      {/* Recent Activity */}
      {recentActivities.length > 0 && (
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivities.map((activity, index) => (
            <View key={activity.id}>
              {renderActivity({ item: activity, index })}
            </View>
          ))}
        </View>
      )}

      {/* Menu Items */}
      <View style={styles.menuSection}>
        {menuItems.map((item, index) => (
          <Animatable.View
            key={item.id}
            animation="fadeInUp"
            duration={600}
            delay={index * 50}
          >
            <TouchableOpacity style={styles.menuItem} onPress={item.onPress}>
              <View style={styles.menuLeft}>
                <Ionicons name={item.icon} size={20} color="#666" />
                <Text style={styles.menuText}>{item.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          </Animatable.View>
        ))}
      </View>

      {/* Logout Button */}
      <Animatable.View animation="fadeInUp" duration={800} style={styles.logoutSection}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color="#FF4757" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </Animatable.View>

      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  avatar: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
 defaultAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },

  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30, // Fixed the padding
    marginBottom: 12,
  },
  profileInfo: {
    alignItems: 'center',
  },
    userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginTop: 15,
    textAlign: 'center',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 12,
  },
  avatar: {
    width: 50,
    height: 30,
    borderRadius: 50,
    marginBottom: 15,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginBottom: 5,
  },
  userEmail: {
    fontSize: 16,
    color: '#2B2B2B',
    marginBottom: 5,
  },
  joinDate: {
    fontSize: 14,
    color: '#2B2B2B',
    marginBottom: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2B2B2B',
  },
  editButtonText: {
    color: '#2B2B2B',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  statsSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 15,
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
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginLeft: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  statTitle: {
    fontSize: 12,
    color: '#2B2B2B',
    marginTop: 2,
  },
  badgesSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  badgesList: {
    flexDirection: 'row',
    paddingRight: 20,
  },
  badge: {
    alignItems: 'center',
    marginRight: 20,
    width: 80,
  },
  badgeIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  activitySection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
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
    color: '#2B2B2B',
    fontWeight: '500',
  },
  activityDate: {
    fontSize: 12,
    color: '#2B2B2B',
    marginTop: 2,
  },
  settingsSection: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    fontSize: 16,
    color: '#2B2B2B',
    marginLeft: 12,
  },
  menuSection: {
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    fontSize: 16,
    color: '#2B2B2B',
    marginLeft: 12,
  },
  logoutSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4757',
  },
  logoutText: {
    color: '#FF4757',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  bottomPadding: {
    height: 20,
  },
});
