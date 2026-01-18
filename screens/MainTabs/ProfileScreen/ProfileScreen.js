import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { getAuth, updateProfile } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';

// --- Profile Avatar Component ---
const ProfileAvatar = ({ photoURL, displayName, size = 100, onPressAdd }) => {
  const getInitials = (name) => {
    if (!name) return 'V';
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };

  const getAvatarColor = (name) => {
    const colors = ['#4e8cff', '#FF6B6B', '#4ECDC4', '#FECA57', '#54A0FF'];
    if (!name) return colors[0];
    return colors[name.length % colors.length];
  };

  const photoUri = photoURL ? `${photoURL}?t=${Date.now()}` : null;

  return (
    <View style={{ width: size, height: size, alignSelf: 'center', marginBottom: 10 }}>
      <View style={[styles.avatarContainer, { width: size, height: size, borderRadius: size / 2 }]}>
        {!photoURL ? (
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: getAvatarColor(displayName),
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: 'white', fontSize: size * 0.4, fontWeight: '700' }}>
              {getInitials(displayName)}
            </Text>
          </View>
        ) : (
          <Image
            source={{ uri: photoUri }}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Edit Badge */}
      <TouchableOpacity
        style={styles.editBadge}
        onPress={onPressAdd}
        activeOpacity={0.8}
      >
        <Ionicons name="camera" size={14} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

export default function ProfileScreen({ navigation }) {
  const { user, setUser, followedOrganizations } = useAppContext();
  
  // State
  const [userStats, setUserStats] = useState({
    totalHours: 0,
    eventsAttended: 0,
    eventsRegistered: 0,
    organizationsFollowed: 0,
  });
  const [recentActivities, setRecentActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (user?.uid) {
      fetchUserData();
      const unsubscribe = setupActivityListener();
      return () => unsubscribe && unsubscribe();
    }
  }, [user?.uid, followedOrganizations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserData();
    setRefreshing(false);
  };

  const fetchUserData = async () => {
    try {
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
    const userPostsQuery = query(
      collection(db, 'posts'),
      where('authorId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    return onSnapshot(userPostsQuery, (querySnapshot) => {
      const activities = [];
      querySnapshot.docs.forEach(doc => {
        const postData = doc.data();
        activities.push({
          id: doc.id,
          type: postData.type === 'report' ? 'report_created' : 'post_created',
          title: postData.type === 'report' ? 'Submitted a Report' : 'Shared a Post',
          date: postData.createdAt?.toDate ? getTimeAgo(postData.createdAt.toDate()) : 'Recently',
          icon: postData.type === 'report' ? 'flag' : 'chatbox',
          color: postData.type === 'report' ? '#EF4444' : '#3B82F6',
        });
      });
      setRecentActivities(activities);
    });
  };

  const getTimeAgo = (date) => {
    const now = new Date();
    const diffInDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return date.toLocaleDateString();
  };

  // --- Image Upload Logic (Cloud Function) ---
  const CLOUD_FUNCTION_URL = 'https://us-central1-younite-7eb12.cloudfunctions.net/uploadProfileImage';

  const handleAddProfileImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert("Permission Required", "Please allow access to your photos to upload a profile picture.");
        return;
      }

      const pickerResult = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6, // Slightly lower quality for faster upload
      });

      if (pickerResult.canceled) return;

      const imageUri = pickerResult.assets?.[0]?.uri;
      if (!imageUri) return;

      setUploading(true);

      const base64String = await FileSystem.readAsStringAsync(imageUri, { encoding: FileSystem.EncodingType.Base64 });
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) throw new Error("User not authenticated");

      const response = await fetch(CLOUD_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64: base64String, userId: currentUser.uid }),
      });

      if (!response.ok) throw new Error('Upload failed');

      const { downloadURL } = await response.json();

      // Update Firebase Auth & Firestore
      await updateProfile(currentUser, { photoURL: downloadURL });
      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL: downloadURL });

      // Update Local State
      setUser((prev) => ({ ...prev, photoURL: downloadURL }));
      
      Alert.alert("Success", "Profile photo updated!");
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Could not upload image. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => setUser(null) },
    ]);
  };

  // --- Menu Data ---
  const menuItems = [
    { id: '1', title: 'Edit Profile', icon: 'person-outline', onPress: () => navigation.navigate('EditProfile') },
    { id: '3', title: 'My Events', icon: 'calendar-outline', onPress: () => navigation.navigate('Events', { screen: 'EventsMain' }) },
    { id: '4', title: 'Followed Organizations', icon: 'heart-outline', onPress: () => navigation.navigate('DiscoverMain') },
    { id: '6', title: 'Settings', icon: 'settings-outline', onPress: () => navigation.navigate('Settings') },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header / Profile Card */}
        <View style={styles.headerSection}>
          <ProfileAvatar
            photoURL={user?.photoURL}
            displayName={user?.displayName || user?.email}
            size={90}
            onPressAdd={handleAddProfileImage}
          />
          <Text style={styles.userName}>
            {user?.displayName || "Volunteer"}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Your Impact</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
               <Ionicons name="time-outline" size={22} color="#10B981" />
               <Text style={styles.statValue}>{userStats.totalHours}</Text>
               <Text style={styles.statLabel}>Hours</Text>
            </View>
            <View style={styles.statCard}>
               <Ionicons name="calendar-outline" size={22} color="#3B82F6" />
               <Text style={styles.statValue}>{userStats.eventsAttended}</Text>
               <Text style={styles.statLabel}>Attended</Text>
            </View>
            <View style={styles.statCard}>
               <Ionicons name="heart-outline" size={22} color="#EF4444" />
               <Text style={styles.statValue}>{userStats.organizationsFollowed}</Text>
               <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        {recentActivities.length > 0 && (
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.card}>
              {recentActivities.map((item, index) => (
                <View key={item.id} style={[styles.activityRow, index === recentActivities.length - 1 && styles.lastRow]}>
                   <View style={[styles.activityIcon, { backgroundColor: item.color + '20' }]}>
                      <Ionicons name={item.icon} size={16} color={item.color} />
                   </View>
                   <View style={styles.activityContent}>
                      <Text style={styles.activityText}>{item.title}</Text>
                      <Text style={styles.activityDate}>{item.date}</Text>
                   </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Menu */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            {menuItems.map((item, index) => (
              <TouchableOpacity 
                key={item.id} 
                style={[styles.menuRow, index === menuItems.length - 1 && styles.lastRow]}
                onPress={item.onPress}
              >
                <View style={styles.menuLeft}>
                  <Ionicons name={item.icon} size={20} color="#4B5563" />
                  <Text style={styles.menuText}>{item.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
           <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Uploading Overlay */}
      {uploading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#10B981" />
            <Text style={styles.loadingText}>Updating Photo...</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB', // Light gray modern background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Header Section
  headerSection: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingBottom: 30,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 20,
  },
  avatarContainer: {
    marginBottom: 5,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
    backgroundColor: '#fff',
  },
  editBadge: {
    position: 'absolute',
    bottom: 5,
    right: 0,
    backgroundColor: '#10B981',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginTop: 10,
  },
  userEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },

  // Sections
  sectionContainer: {
    paddingHorizontal: 20,
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 10,
    marginLeft: 4,
  },
  
  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },

  // Generic Card Container (for Lists)
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 2,
  },
  
  // Activity Rows
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  activityText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F2937',
  },
  activityDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // Menu Rows
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuText: {
    fontSize: 15,
    color: '#1F2937',
    marginLeft: 12,
    fontWeight: '500',
  },

  // Logout
  logoutBtn: {
    marginHorizontal: 20,
    backgroundColor: '#FEE2E2',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '600',
    fontSize: 15,
  },

  // Loading Overlay
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 999,
  },
  loadingBox: {
    backgroundColor: '#fff',
    padding: 25,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  loadingText: {
    marginTop: 10,
    color: '#374151',
    fontWeight: '500',
  },
});