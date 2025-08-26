import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { useAppContext } from '../../contexts/AppContext';

const SECTIONS = ['Active Volunteers', 'Followers', 'Applications', 'Top Volunteers'];

export default function VolunteersTab({ navigation }) {
  const { user } = useAppContext();
  const [selectedSection, setSelectedSection] = useState('Active Volunteers');
  const [activeVolunteers, setActiveVolunteers] = useState([]);
  const [followers, setFollowers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [topVolunteers, setTopVolunteers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fixed useEffect with proper cleanup
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Load data once instead of using real-time listeners (which can cause loops)
    const loadVolunteerData = async () => {
      try {
        // Get organization data to find followers
        const orgDoc = await getDoc(doc(db, 'organizations', user.uid));
        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          setFollowers(orgData.followers || []);
        }

        // Mock data for now - replace with actual queries
        setActiveVolunteers([
          {
            id: '1',
            displayName: 'John Doe',
            email: 'john@example.com',
            photoURL: 'https://via.placeholder.com/40',
            eventsAttended: 5,
            hours: 25,
          },
          {
            id: '2',
            displayName: 'Jane Smith',
            email: 'jane@example.com',
            photoURL: 'https://via.placeholder.com/40',
            eventsAttended: 3,
            hours: 18,
          },
        ]);

        setApplications([
          {
            id: '1',
            volunteerName: 'Mike Wilson',
            eventName: 'Beach Cleanup',
            createdAt: { seconds: Date.now() / 1000 },
            status: 'pending',
          },
          {
            id: '2',
            volunteerName: 'Sarah Johnson',
            eventName: 'Tree Planting',
            createdAt: { seconds: Date.now() / 1000 },
            status: 'pending',
          },
        ]);

        setTopVolunteers([
          {
            id: '1',
            displayName: 'John Doe',
            photoURL: 'https://via.placeholder.com/40',
            eventsAttended: 8,
            hours: 45,
            volunteerScore: 95,
          },
          {
            id: '2',
            displayName: 'Emily Davis',
            photoURL: 'https://via.placeholder.com/40',
            eventsAttended: 6,
            hours: 32,
            volunteerScore: 87,
          },
        ]);

      } catch (error) {
        console.error('Error loading volunteer data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadVolunteerData();
  }, [user?.uid]); // Only depend on user.uid

  const handleApproveApplication = (appId) => {
    // TODO: Update application status in Firestore
    console.log('Approve application:', appId);
    setApplications(prev => prev.filter(app => app.id !== appId));
  };

  const handleRejectApplication = (appId) => {
    // TODO: Update application status in Firestore
    console.log('Reject application:', appId);
    setApplications(prev => prev.filter(app => app.id !== appId));
  };

  const renderSectionTabs = () => (
    <View style={styles.tabsContainer}>
      {SECTIONS.map((section) => (
        <TouchableOpacity
          key={section}
          style={[
            styles.tab,
            selectedSection === section && styles.activeTab,
          ]}
          onPress={() => setSelectedSection(section)}
        >
          <Text
            style={[
              styles.tabText,
              selectedSection === section && styles.activeTabText,
            ]}
          >
            {section.split(' ')[0]} {/* Show first word to save space */}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderVolunteerCard = ({ item }) => (
    <View style={styles.volunteerCard}>
      <Image
        source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.volunteerInfo}>
        <Text style={styles.volunteerName}>
          {item.displayName || item.name || 'Unknown'}
        </Text>
        <Text style={styles.volunteerDetails}>
          {item.eventsAttended || 0} events • {item.hours || 0} hours
        </Text>
      </View>
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.messageButton}
          onPress={() => navigation.navigate('SendMessage', { volunteerId: item.id })}
        >
          <Ionicons name="chatbubble-outline" size={20} color="#4e8cff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('VolunteerProfile', { volunteerId: item.id })}
        >
          <Ionicons name="person-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderApplicationCard = ({ item }) => (
    <View style={styles.applicationCard}>
      <View style={styles.applicationInfo}>
        <Text style={styles.volunteerName}>{item.volunteerName}</Text>
        <Text style={styles.eventName}>Applied for: {item.eventName}</Text>
        <Text style={styles.applicationDate}>
          {new Date(item.createdAt.seconds * 1000).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.applicationActions}>
        <TouchableOpacity
          style={styles.approveButton}
          onPress={() => handleApproveApplication(item.id)}
        >
          <Ionicons name="checkmark" size={18} color="#4CAF50" />
          <Text style={styles.approveText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.rejectButton}
          onPress={() => handleRejectApplication(item.id)}
        >
          <Ionicons name="close" size={18} color="#E74C3C" />
          <Text style={styles.rejectText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFollowerCard = ({ item }) => (
    <View style={styles.followerCard}>
      <Image
        source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
        style={styles.avatar}
      />
      <View style={styles.followerInfo}>
        <Text style={styles.followerName}>
          {item.displayName || item.name || 'Follower'}
        </Text>
        <Text style={styles.followerStatus}>Following since 2024</Text>
      </View>
      <TouchableOpacity
        style={styles.messageButton}
        onPress={() => navigation.navigate('SendMessage', { userId: item.id })}
      >
        <Ionicons name="mail-outline" size={20} color="#4e8cff" />
      </TouchableOpacity>
    </View>
  );

  const getCurrentData = () => {
    switch (selectedSection) {
      case 'Active Volunteers':
        return activeVolunteers;
      case 'Followers':
        return followers;
      case 'Applications':
        return applications;
      case 'Top Volunteers':
        return topVolunteers;
      default:
        return [];
    }
  };

  const getCurrentRenderItem = () => {
    switch (selectedSection) {
      case 'Active Volunteers':
        return renderVolunteerCard;
      case 'Followers':
        return renderFollowerCard;
      case 'Applications':
        return renderApplicationCard;
      case 'Top Volunteers':
        return renderVolunteerCard;
      default:
        return renderVolunteerCard;
    }
  };

  const getEmptyMessage = () => {
    switch (selectedSection) {
      case 'Active Volunteers':
        return 'No active volunteers at the moment';
      case 'Followers':
        return 'No followers yet';
      case 'Applications':
        return 'No pending applications';
      case 'Top Volunteers':
        return 'No top volunteers to show';
      default:
        return 'No data available';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4e8cff" />
        <Text style={styles.loadingText}>Loading volunteers...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Volunteers</Text>
        <Text style={styles.headerSubtitle}>Manage your volunteer community</Text>
      </View>

      {/* Section Tabs */}
      {renderSectionTabs()}

      {/* Content */}
      <FlatList
        data={getCurrentData()}
        keyExtractor={(item) => item.id}
        renderItem={getCurrentRenderItem()}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>{getEmptyMessage()}</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 15,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginHorizontal: 2,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#4e8cff',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },

  // List
  listContainer: {
    padding: 16,
  },

  // Volunteer Card
  volunteerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  volunteerInfo: {
    flex: 1,
  },
  volunteerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  volunteerDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  messageButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#E3F2FD',
  },
  profileButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },

  // Application Card
  applicationCard: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  applicationInfo: {
    marginBottom: 12,
  },
  eventName: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  applicationDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  applicationActions: {
    flexDirection: 'row',
    gap: 12,
  },
  approveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  approveText: {
    color: '#4CAF50',
    fontWeight: '600',
    marginLeft: 4,
  },
  rejectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rejectText: {
    color: '#E74C3C',
    fontWeight: '600',
    marginLeft: 4,
  },

  // Follower Card
  followerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  followerInfo: {
    flex: 1,
  },
  followerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  followerStatus: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
});
