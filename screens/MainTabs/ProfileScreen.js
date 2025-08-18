import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
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

// Add the missing import for useAppContext
import { useAppContext } from '../../contexts/AppContext';

export default function ProfileScreen({ navigation }) {
  const { user, setUser, followedOrganizations, registeredEvents } = useAppContext();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);

  // Use real user data when available, fallback to mock data
  const displayUser = {
    id: user?.uid || '1',
    name: user?.displayName || user?.email?.split('@')[0] || 'User', // Use displayName or extract name from email
    email: user?.email || 'user@email.com',
    avatar: user?.photoURL || 'https://via.placeholder.com/100',
    joinDate: user?.metadata?.creationTime ? 
      new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 
      'January 2023',
    totalHours: 156, // You can store this in your database later
    eventsAttended: 23,
    organizationsFollowed: followedOrganizations.length,
    badges: [
      { id: '1', name: 'Environmental Hero', icon: 'leaf', color: '#4CAF50' },
      { id: '2', name: 'Community Champion', icon: 'people', color: '#2196F3' },
      { id: '3', name: 'Event Organizer', icon: 'calendar', color: '#FF9800' },
    ],
    recentActivity: [
      {
        id: '1',
        type: 'event_completed',
        title: 'Completed Beach Cleanup Drive',
        date: '2 days ago',
        icon: 'checkmark-circle',
        color: '#4CAF50',
      },
      {
        id: '2',
        type: 'organization_followed',
        title: 'Started following Green Earth Initiative',
        date: '1 week ago',
        icon: 'heart',
        color: '#FF4757',
      },
      {
        id: '3',
        type: 'event_registered',
        title: 'Registered for Tree Planting Marathon',
        date: '2 weeks ago',
        icon: 'calendar',
        color: '#4e8cff',
      },
    ],
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
          onPress: () => setUser(null) // This will automatically switch to Auth due to conditional rendering
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

  const renderBadge = ({ item, index }) => (
    <Animatable.View
      animation="fadeInRight"
      duration={600}
      delay={index * 100}
      style={styles.badge}
    >
      <View style={[styles.badgeIcon, { backgroundColor: item.color }]}>
        <Ionicons name={item.icon} size={20} color="#fff" />
      </View>
      <Text style={styles.badgeName}>{item.name}</Text>
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
      icon: 'person-outline',
      onPress: handleEditProfile,
    },
    {
      id: '2',
      title: 'My Events',
      icon: 'calendar-outline',
      onPress: () => navigation.navigate('Events', { screen: 'EventsMain' }),
    },
    {
      id: '3',
      title: 'Followed Organizations',
      icon: 'heart-outline',
      onPress: () => navigation.navigate('DiscoverMain'),
    },
    {
      id: '4',
      title: 'Achievements',
      icon: 'trophy-outline',
      onPress: () => Alert.alert('Achievements', 'Achievements page coming soon!'),
    },
    {
      id: '5',
      title: 'Settings',
      icon: 'settings-outline',
onPress: () => navigation.navigate('Settings'),
    },
    {
      id: '6',
      title: 'Help & Support',
      icon: 'help-circle-outline',
      onPress: () => Alert.alert('Help', 'Help & Support coming soon!'),
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      {/* <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#2B2B2B" />
        </TouchableOpacity>
      </View> */}

      {/* Profile Info */}
      <Animatable.View animation="fadeInDown" duration={800} style={styles.profileSection}>
        <Image source={{ uri: displayUser.avatar }} style={styles.avatar} />
        <Text style={styles.userName}>{displayUser.name}</Text>
        <Text style={styles.userEmail}>{displayUser.email}</Text>
        <Text style={styles.joinDate}>Member since {displayUser.joinDate}</Text>
        
        <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
          <Ionicons name="create-outline" size={16} color="#4e8cff" />
          <Text style={styles.editButtonText}>View Profile</Text>
        </TouchableOpacity>
      </Animatable.View>

      {/* Stats */}
      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>Your Impact</Text>
        <View style={styles.statsGrid}>
          {renderStatCard('Hours Volunteered', displayUser.totalHours, 'time-outline', '#4CAF50')}
          {renderStatCard('Events Attended', displayUser.eventsAttended, 'calendar-outline', '#2196F3')}
          {renderStatCard('Organizations', displayUser.organizationsFollowed, 'heart-outline', '#FF4757')}
          {renderStatCard('Upcoming Events', registeredEvents.length, 'arrow-up-circle-outline', '#FF9800')}
        </View>
      </View>

      {/* Badges */}
      <View style={styles.badgesSection}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.badgesList}>
            {displayUser.badges.map((badge, index) => (
              <View key={badge.id}>
                {renderBadge({ item: badge, index })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Recent Activity */}
      <View style={styles.activitySection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {displayUser.recentActivity.map((activity, index) => (
          <View key={activity.id}>
            {renderActivity({ item: activity, index })}
          </View>
        ))}
      </View>



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
    paddingVertical: 9,
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
