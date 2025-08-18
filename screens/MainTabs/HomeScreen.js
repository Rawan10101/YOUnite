import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import * as Animatable from 'react-native-animatable'; // for animations
import eventsData from '../../data/events'; // Mock events data (replace with actual data)

export default function HomeScreen({ navigation }) {
  // Mock Data
  const [followedOrganizations, setFollowedOrganizations] = useState([
    { id: '1', name: 'Clean Ocean Foundation' },
    { id: '2', name: 'Green Earth Initiative' }
  ]);

  const [recommendedOrganizations, setRecommendedOrganizations] = useState([
    { id: '3', name: 'Wildlife Protection NGO' },
    { id: '4', name: 'Save the Forests' },
    { id: '5', name: 'Climate Action Alliance' }
  ]);

  const renderEvent = ({ item }) => (
    <Animatable.View
      style={styles.eventRow}
      animation="fadeInUp"
      duration={500}
      delay={300}
    >
      <Text style={styles.eventTitle}>{item.title}</Text>
      <TouchableOpacity
        style={styles.arrowContainer}
        onPress={() => navigation.navigate('EventDetails', { event: item })}
      >
        <Ionicons name="arrow-forward-circle" size={32} color="#4e8cff" />
      </TouchableOpacity>
    </Animatable.View>
  );

  const renderOrganization = ({ item }) => (
    <Animatable.View
      style={styles.organizationRow}
      animation="fadeInRight"
      duration={500}
      delay={200}
    >
      <Text style={styles.organizationName}>{item.name}</Text>
      <TouchableOpacity
        style={styles.followButton}
        onPress={() => handleFollowOrganization(item)}
      >
        <Text style={styles.followButtonText}>Follow</Text>
      </TouchableOpacity>
    </Animatable.View>
  );

  const handleFollowOrganization = (org) => {
    // In a real app, this would be an API call to save the followed organization
    setFollowedOrganizations(prev => [...prev, org]);
    setRecommendedOrganizations(prev => prev.filter(item => item.id !== org.id));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Follow Organizations</Text>

      {/* Followed Organizations Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Followed Organizations</Text>
        <FlatList
          data={followedOrganizations}
          keyExtractor={item => item.id}
          renderItem={renderOrganization}
        />
      </View>

      {/* Recommended Organizations Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recommended Organizations</Text>
        <FlatList
          data={recommendedOrganizations}
          keyExtractor={item => item.id}
          renderItem={renderOrganization}
        />
      </View>

      {/* Events Section */}
      <Text style={styles.title}>Upcoming Events</Text>
      <FlatList
        data={eventsData}
        keyExtractor={item => item.id?.toString() || item.title}
        renderItem={renderEvent}
        contentContainerStyle={{ paddingVertical: 20 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    paddingTop: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 16,
    alignSelf: 'center',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 18,
    borderBottomColor: '#eee',
    borderBottomWidth: 1,
  },
  eventTitle: { fontSize: 18, flex: 1 },
  arrowContainer: { marginLeft: 14 },

  // Organization styles
  organizationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomColor: '#ddd',
    borderBottomWidth: 1,
  },
  organizationName: {
    fontSize: 18,
    flex: 1,
  },
  followButton: {
    backgroundColor: '#4e8cff',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
