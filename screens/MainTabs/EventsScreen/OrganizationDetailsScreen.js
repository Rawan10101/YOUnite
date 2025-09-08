import { Ionicons } from "@expo/vector-icons";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import * as Animatable from "react-native-animatable";
import { useAppContext } from "../../../contexts/AppContext";
import { db } from "../../../firebaseConfig";

const EMERALD = "#476397ff";

const renderAvatar = (orgName, orgLogo, size = 64) => {
  if (orgLogo) {
    return (
      <Image source={{ uri: orgLogo }} style={[styles.avatarImage, { width: size, height: size, borderRadius: size / 2 }]} />
    );
  } else {
    const firstLetter = orgName ? orgName[0].toUpperCase() : "?";
    return (
      <View style={[styles.avatarLetterCircle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Text style={[styles.avatarLetter, { fontSize: size / 2 }]}>{firstLetter}</Text>
      </View>
    );
  }
};

export default function OrganizationDetailsScreen({ route, navigation }) {
  const { organization: initialOrganization } = route.params;
  const { user, setFollowedOrganizations } = useAppContext();

  const [organization, setOrganization] = useState(initialOrganization);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);

  const [activeTab, setActiveTab] = useState("posts");
  const [orgPosts, setOrgPosts] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);

  useEffect(() => {
    if (!organization?.id) return;
    setIsFollowing(organization.followers?.includes(user?.uid) || false);
    const unsubscribe = setupListeners();
    return () => unsubscribe();
  }, [organization?.id, user?.uid]);

  const setupListeners = () => {
    setLoading(true);
    const orgDocRef = doc(db, "organizations", organization.id);
    const unsubscribeOrg = onSnapshot(
      orgDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setOrganization({ id: snapshot.id, ...snapshot.data() });
          setIsFollowing(snapshot.data().followers?.includes(user?.uid));
        }
      },
      (error) => {
        Alert.alert("Error", "Failed to load organization.");
      }
    );
    const postsQuery = query(
      collection(db, "posts"),
      where("authorId", "==", organization.id),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubscribePosts = onSnapshot(
      postsQuery,
      (snapshot) => {
        const posts = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setOrgPosts(posts);
      },
      (error) => {
        console.error("Error loading posts:", error);
      }
    );
    const upcomingEventsQuery = query(
      collection(db, "events"),
      where("organizationId", "==", organization.id),
      where("date", ">=", new Date()),
      orderBy("date", "asc"),
      limit(10)
    );
    const unsubscribeEvents = onSnapshot(
      upcomingEventsQuery,
      (snapshot) => {
        const events = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            date: data.date?.toDate ? data.date.toDate() : new Date(data.date),
            isRegistered: data.registeredVolunteers?.includes(user?.uid) || false,
            participants: data.registeredVolunteers?.length || 0,
          };
        });
        setUpcomingEvents(events);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Error loading events:", error);
      }
    );
    return () => {
      unsubscribeOrg();
      unsubscribePosts();
      unsubscribeEvents();
    };
  };

  const handleFollow = async () => {
    if (!user?.uid || !organization?.id) {
      Alert.alert("Error", "User or organization info missing.");
      return;
    }
    try {
      const orgRef = doc(db, "organizations", organization.id);
      const userRef = doc(db, "users", user.uid);
      const orgSnap = await getDoc(orgRef);
      if (!orgSnap.exists()) {
        await setDoc(orgRef, { followers: [] }, { merge: true });
      }
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, { followedOrganizations: [] }, { merge: true });
      }
      if (isFollowing) {
        await updateDoc(orgRef, { followers: arrayRemove(user.uid) });
        await updateDoc(userRef, { followedOrganizations: arrayRemove(organization.id) });
        setFollowedOrganizations((prev) => prev.filter((id) => id !== organization.id));
        setIsFollowing(false);
      } else {
        await updateDoc(orgRef, { followers: arrayUnion(user.uid) });
        await updateDoc(userRef, { followedOrganizations: arrayUnion(organization.id) });
        setFollowedOrganizations((prev) => [...prev, organization.id]);
        setIsFollowing(true);
      }
    } catch {
      Alert.alert("Error", "Failed to update follow status.");
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    setupListeners();
  };

  const formatDate = (date) =>
    date instanceof Date ? date.toLocaleDateString() : new Date(date).toLocaleDateString();

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="business" size={48} color={EMERALD} />
        <Text>Loading organization details...</Text>
      </View>
    );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Animatable.View animation="fadeIn" duration={800}>
        {/* Header Section */}
  <View style={styles.heroSection}>
  <View style={styles.avatarWrap}>
    {renderAvatar(organization.name, organization.logo, 64, '#50C878')}
  </View>

  <View style={styles.nameFollowWrap}>
    <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
      {organization.name}
    </Text>

    <TouchableOpacity
      onPress={handleFollow}
      style={[
        styles.followButtonMini,
        isFollowing && styles.followingButtonMini,
      ]}
    >
      {isFollowing ? (
        <Ionicons name="checkmark" size={14} color="EMERALD" />
      ) : (
        <Ionicons name="add" size={14} color="#fff" />
      )}
      <Text
        style={[
          styles.followButtonTextMini,
          isFollowing && styles.followingButtonTextMini,
        ]}
      >
        {isFollowing ? "Following" : "Follow"}
      </Text>
    </TouchableOpacity>
  </View>
</View>

<Text style={styles.location}>{organization.location || "No location"}</Text>



        {/* Impact Metrics */}
        <View style={styles.metricsSection}>
          <Text style={styles.sectionTitle}>Impact & Reach</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>
                {organization.followers?.length || 0}
              </Text>
              <Text style={styles.metricLabel}>Followers</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{upcomingEvents.length}</Text>
              <Text style={styles.metricLabel}>Upcoming Events</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.description}>
            {organization.description || "No description available."}
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "posts" && styles.activeTabButton]}
            onPress={() => setActiveTab("posts")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "posts" && styles.activeTabButtonText,
              ]}
            >
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === "events" && styles.activeTabButton]}
            onPress={() => setActiveTab("events")}
          >
            <Text
              style={[
                styles.tabButtonText,
                activeTab === "events" && styles.activeTabButtonText,
              ]}
            >
              Events
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === "posts" && (
          <FlatList
            data={orgPosts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Animatable.View animation="fadeInUp" style={styles.postCard}>
                <View style={styles.postHeader}>
                  {renderAvatar(organization.name, organization.logo, 32)}
                  <Text style={styles.postOrgName}>{organization.name}</Text>
                </View>
                <Text style={styles.postCaption}>
                  {item.caption || item.text}
                </Text>
                {item.imageUrl && (
                  <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
                )}
              </Animatable.View>
            )}
            scrollEnabled={false}
            nestedScrollEnabled
            contentContainerStyle={{ paddingBottom: 30 }}
          />
        )}
        {activeTab === "events" && (
          upcomingEvents.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming events.</Text>
          ) : (
            <FlatList
              data={upcomingEvents}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => (
                <Animatable.View
                  animation="fadeInRight"
                  delay={index * 100}
                  style={styles.eventCard}
                >
                  <TouchableOpacity
                    onPress={() =>
                      navigation.navigate("EventDetails", { eventId: item.id })
                    }
                  >
                    <Image
                      source={{
                        uri: item.imageUrl || "https://via.placeholder.com/200x120",
                      }}
                      style={styles.eventImage}
                    />
                    <View style={styles.eventContent}>
                      <Text style={styles.eventTitle} numberOfLines={2}>
                        {item.title}
                      </Text>
                      <View style={styles.eventMeta}>
                        <View style={styles.eventDetail}>
                          <Ionicons name="calendar-outline" size={14} color="#666" />
                          <Text style={styles.eventDetailText}>
                            {formatDate(item.date)}
                          </Text>
                        </View>
                        <View style={styles.eventDetail}>
                          <Ionicons name="location-outline" size={14} color="#666" />
                          <Text style={styles.eventDetailText} numberOfLines={1}>
                            {item.location}
                          </Text>
                        </View>
                        <View style={styles.eventDetail}>
                          <Ionicons name="people-outline" size={14} color="#666" />
                          <Text style={styles.eventDetailText}>
                            {item.participants || 0}/{item.maxVolunteers || item.maxParticipants || 50}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Animatable.View>
              )}
              contentContainerStyle={{ paddingBottom: 30, paddingLeft: 16 }}
            />
          )
        )}
      </Animatable.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
heroSection: {
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 24,
  paddingTop: 32,
  paddingBottom: 24,
  backgroundColor: "#fff",
},

  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 8,
  },
  avatarWrap: {
  marginRight: 16,
},

nameFollowWrap: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: "#fff",
    backgroundColor: EMERALD,
    marginBottom: 4,
  },
  avatarLetterCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: EMERALD,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  avatarLetter: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
  },

name: {
  fontSize: 22,
  fontWeight: "bold",
  color: "#222",
  flexShrink: 1,
  marginRight: 12,
},
 followButtonMini: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#50C878", // Emerald
  paddingHorizontal: 18,
  paddingVertical: 6,
  borderRadius: 16,
  minWidth: 90,
  justifyContent: "center",
},

followingButtonMini: {
  backgroundColor: "#fff",
  borderWidth: 1.5,
  borderColor: EMERALD,
},

followButtonTextMini: {
  color: "#fff",
  fontWeight: "bold",
  fontSize: 15,
  marginLeft: 4,
},
followingButtonTextMini: {
  color: EMERALD,
},
 location: {
  fontSize: 14,
  color: "#888",
  marginTop: 8,
  paddingHorizontal: 24,
},
  metricsSection: { padding: 20, backgroundColor: "#fff" },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12, color: "#222" },
  metricsGrid: { flexDirection: "row", justifyContent: "space-between" },
  metricItem: { alignItems: "center", flex: 1 },
  metricValue: { fontSize: 20, fontWeight: "bold", color: EMERALD },
  metricLabel: { fontSize: 14, color: "#666" },
  section: { paddingHorizontal: 20, marginBottom: 22, backgroundColor: "#fff", paddingVertical: 16 },
  description: { fontSize: 16, color: "#555", lineHeight: 23 },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 20,
    borderBottomWidth: 1,
    borderColor: "#e0e0e0",
    marginBottom: 10,
    backgroundColor: "#fff",
    borderRadius: 100,
    paddingVertical: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 100,
    backgroundColor: "#fff",
  },
  activeTabButton: {
    backgroundColor: EMERALD,
  },
  tabButtonText: {
    fontSize: 16,
    color: "#888",
  },
  activeTabButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    padding: 20,
    textAlign: "center",
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  postOrgName: { fontWeight: "700", fontSize: 15, color: "#222", marginLeft: 10 },
  postCaption: { fontSize: 14, color: "#444", marginVertical: 8 },
  postImage: { width: "100%", height: 250, borderRadius: 12, marginTop: 10 },
  eventCard: {
    width: 280,
    borderRadius: 12,
    backgroundColor: "#fff",
    marginRight: 15,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  eventImage: { width: "100%", height: 120 },
  eventContent: { padding: 15 },
  eventTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8, color: "#222" },
  eventMeta: { marginVertical: 8 },
  eventDetail: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  eventDetailText: { marginLeft: 8, fontSize: 14, color: "#555", flexShrink: 1 },
});
