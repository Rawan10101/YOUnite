import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where
} from "firebase/firestore";
import { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as Animatable from "react-native-animatable";
import { db } from "../../firebaseConfig";

const screenWidth = Dimensions.get("window").width;
const CARD_GAP = 9;
const CARD_WIDTH = (screenWidth - 3 * CARD_GAP) / 2;

import educationImg from '../../assets/images/educationCat.jpeg';
import environmentImg from '../../assets/images/environmentCat.jpeg';
import healthcareImg from '../../assets/images/healthcareCat.jpeg';
// import communityImg from '../../assets/images/communityCat.jpeg';
const localCategoryImages = {
  environment: environmentImg,
  education: educationImg,
  healthcare: healthcareImg,
};

const getImageSource = (event) => {
  if (event.hasCustomImage && event.imageUrl) {
    return { uri: event.imageUrl };
  }

  if (event?.category && localCategoryImages[event.category]) {
    return localCategoryImages[event.category];
  }

  return localCategoryImages.environment;
}; 

export default function Feed({ navigation }) {
  const [popularEvents, setPopularEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const getColor = (letter) => {
    const colors = {
      T: "#4e8cff",
      B: "#50c878",
      R: "#f44336",
      U: "#ffd93d",
      default: "#bdbdbd",
    };
    return colors[letter] || colors.default;
  };

  const renderAvatar = (uri, name, size = 56) => {
    if (uri) {
      return (
        <Image
          source={{ uri }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        />
      );
    }
    const letter = (name?.charAt(0) || "?").toUpperCase();
    return (
      <View
        style={[
          styles.avatar,
          {
            backgroundColor: getColor(letter),
            width: size,
            height: size,
            borderRadius: size / 2,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Text style={[styles.avatarLetter, { fontSize: size / 2 }]}>{letter}</Text>
      </View>
    );
  };

  useEffect(() => {
    const today = new Date();

    // Organizations fetch
    const unsubOrgs = onSnapshot(
      collection(db, "organizations"),
      (snapshot) => {
        const orgs = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              followerCount: data.followers?.length ?? 0,
              eventCount: data.upcomingEvents ?? 0,
            };
          })
          .sort(
            (a, b) => b.followerCount - a.followerCount || b.eventCount - a.eventCount
          );
        setOrganizations(orgs);
        setFilteredOrganizations(orgs);
      },
      () => {}
    );

    // Events fetch
    const unsubEvents = onSnapshot(
      query(
        collection(db, "events"),
        where("date", ">=", today),
        orderBy("date"),
        limit(10)
      ),
      (snapshot) => {
        const events = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              dateObj: data.date?.toDate ? data.date.toDate() : new Date(data.date),
              participantCount: data.participants?.length ?? 0,
            };
          });
        setPopularEvents(events);
      },
      () => {}
    );

    // Posts fetch with org info enrichment
    const unsubPosts = onSnapshot(
      query(
        collection(db, "posts"),
        orderBy("createdAt", "desc"),
        limit(40)
      ),
      async (snapshot) => {
        const postsArr = [];
        const orgIds = new Set();
        snapshot.docs.forEach((doc) => {
          const d = doc.data();
          postsArr.push({ id: doc.id, ...d });
          if (d.authorId) orgIds.add(d.authorId);
        });
        let orgDocs = [];
        if (orgIds.size > 0) {
          orgDocs = await Promise.all(
            Array.from(orgIds).map((id) => getDoc(doc(db, "organizations", id)))
          );
        }
        const orgMap = {};
        orgDocs.forEach((d) => {
          if (d.exists()) {
            orgMap[d.id] = d.data();
          }
        });
        setPosts(
          postsArr.map((post) => ({
            ...post,
            organizationName: orgMap[post.authorId]?.name ?? "",
            organizationAvatar: orgMap[post.authorId]?.logo ?? null,
          }))
        );
      },
      () => {}
    );

    return () => {
      unsubOrgs();
      unsubEvents();
      unsubPosts();
    };
  }, []);

  // Filter organizations with search term
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredOrganizations(organizations);
    } else {
      const q = searchQuery.toLowerCase();
      const filtered = organizations.filter(
        (org) =>
          org.name?.toLowerCase().includes(q) ||
          org.description?.toLowerCase().includes(q) ||
          org.location?.toLowerCase().includes(q) ||
          org.category?.toLowerCase().includes(q)
      );
      setFilteredOrganizations(filtered);
    }
  }, [searchQuery, organizations]);

  const onRefresh = () => {
    setRefreshing(true);
    setLoading(true);
  };

  // Format date helper
  const formatDate = (dateObj) => {
    if (!dateObj) return "";
    try {
      if (dateObj instanceof Date) return dateObj.toLocaleDateString();
      return new Date(dateObj).toLocaleDateString();
    } catch {
      return "";
    }
  };

const renderEvent = ({ item, index }) => (
  <Animatable.View
    animation="fadeInLeft"
    delay={index * 80}
    style={[
      styles.eventCard,
      {
        marginLeft: index === 0 ? CARD_GAP : CARD_GAP / 2,
        marginRight: CARD_GAP / 2,
      },
    ]}
  >
    <TouchableOpacity
      style={{ flex: 1 }}
      onPress={() => navigation.navigate("EventDetails", { event: item })}
      activeOpacity={0.9}
    >
      {/* Sharp rectangular event image */}
<Image
  source={getImageSource(item)}
  style={styles.eventImage}
  onError={({ nativeEvent: { error } }) => {
    console.log(`❌ Image error for: ${item.title}`);
    console.log('Image URL:', item.imageUrl);
    console.log('Error details:', error);
  }}
/>
      {/* Divider */}
      <View style={styles.cardDivider} />
      <View style={styles.eventContent}>
        <Text style={styles.eventTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.eventOrg} numberOfLines={1}>
          {item.organizationName}
        </Text>
        <Text style={styles.eventLocation} numberOfLines={1}>
          {item.place || "Unknown location"}
        </Text>
        <Text style={styles.eventMeta}>
          {item.participantCount} participant{item.participantCount === 1 ? "" : "s"}
        </Text>
        <Text style={styles.eventDate}>{formatDate(item.dateObj)}</Text>
      </View>
    </TouchableOpacity>
  </Animatable.View>
);



const renderOrganization = ({ item }) => (
  <Animatable.View animation="fadeInUp" style={styles.organizationCard}>
    <TouchableOpacity
      style={styles.organizationContent}
      onPress={() => navigation.navigate("OrganizationDetails", { organization: item })}
      activeOpacity={0.8}
    >
      {item.logo ? (
        <Image source={{ uri: item.logo }} style={styles.organizationAvatar} />
      ) : (
        <View style={[styles.organizationAvatar, { backgroundColor: "#28b35dff" }]}>
          <Text style={styles.organizationAvatarLetter}>
            {(item.name?.charAt(0) ?? "?").toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.organizationInfo}>
        <Text style={styles.organizationName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.organizationCategory} numberOfLines={1}>
          {item.category || ""}
        </Text>
        <Text style={styles.organizationStats} numberOfLines={1}>
          <Ionicons name="people-outline" size={14} color="#666" /> {item.followerCount} followers • {item.eventCount} events
        </Text>
      </View>
    </TouchableOpacity>

    <TouchableOpacity style={styles.followButton}>
      <Text style={styles.followButtonText}>Follow</Text>
    </TouchableOpacity>
  </Animatable.View>
);


 const renderPost = ({ item }) => (
  
  <Animatable.View animation="fadeInUp" style={styles.postCard}>
    <View style={styles.postHeader}>
      {item.organizationAvatar ? (
        <Image source={{ uri: item.organizationAvatar }} style={styles.postAvatar} />
      ) : (
        <View style={[styles.postAvatar, { backgroundColor: "#476397" }]}>
          <Text style={styles.postAvatarLetter}>{item.organizationName?.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <Text style={styles.postOrganization}>{item.organizationName}</Text>
    </View>
    <Text style={styles.postText}>{item.caption || item.text}</Text>
    {/* Show multiple images if available, else single */}
    {item.imageUrls && item.imageUrls.length > 0 ? (
      item.imageUrls.map((uri, index) => (
        <Image key={index} source={{ uri }} style={styles.postImage} />
      ))
    ) : item.imageUrl ? (
      <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
    ) : null}
    <View style={styles.postActions}>
      <TouchableOpacity><Ionicons name="heart-outline" size={24} color="#444" /></TouchableOpacity>

<TouchableOpacity
  onPress={() => {
    if (item.id) {
      navigation.navigate("CommentsScreen", { reportId: item.id });
    } else {
      console.warn("Item id is undefined");
    }
  }}
>
  <Ionicons name="chatbubble-outline" size={24} color="#444" />
</TouchableOpacity>

          {/* <TouchableOpacity><Ionicons name="share-social-outline" size={24} color="#444" /></TouchableOpacity> */}
    </View>
  </Animatable.View>
);


  return (
    <View style={styles.container}>
  <View style={styles.topBar}>
  {!searchActive ? (
    <>
      <Text style={styles.appName}>YOUnite</Text>
      <View style={styles.topActions}>
        <TouchableOpacity onPress={() => setSearchActive(true)} style={styles.iconButton}>
          <Ionicons name="search" size={28} color="#2B2B2B" />
        </TouchableOpacity>
          <TouchableOpacity
                    style={[styles.iconButton, { backgroundColor: '#fff' }]}
                    onPress={() => navigation.navigate('PostDetails')}
                  >
                    
                    <Ionicons name="add" size={26} color="#2B2B2B" />
                  </TouchableOpacity>
                  
        <TouchableOpacity onPress={() => navigation.navigate("CreateEvent")} style={styles.iconButton}>
          <Ionicons name="calendar-outline" size={28} color="rgba(5,5,5,0.73)" />
                </TouchableOpacity>
                         <TouchableOpacity
        style={styles.iconButton}
        onPress={() => navigation.navigate('ReportsScreen')}
      >
        <Ionicons name="flag-outline" size={26} color="#2B2B2B" />
      </TouchableOpacity>
      </View>
    </>
  ) : (
    <View style={styles.searchBarWrapper}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={20} color="#888" />
        <TextInput
          style={styles.searchInput}
          onChangeText={setSearchQuery}
          value={searchQuery}
          placeholder="Search organizations..."
          autoFocus
          returnKeyType="done"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={20} color="#bbb" />
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchActive(false); }} style={styles.cancelButton}>
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  )}
</View>
      <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
        setRefreshing(true);
        setLoading(true);
      }} />}>

        {searchActive && searchQuery.trim().length > 0 && (
          <FlatList
            data={filteredOrganizations}
            keyExtractor={item => item.id}
            renderItem={renderOrganization}
            ListEmptyComponent={<Text style={styles.emptyText}>No organizations found.</Text>}
            scrollEnabled={false}
          />
        )}

        {!searchActive && (
          <>
            <View style={{ marginVertical: 16 }}>
              <Text style={styles.sectionTitle}>Popular Events</Text>
              <FlatList
                data={popularEvents}
                horizontal
                keyExtractor={item => item.id}
                renderItem={renderEvent}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 8 }}
              />
            </View>

            <View style={{ marginVertical: 16 }}>
              <Text style={styles.sectionTitle}>Posts</Text>
              <FlatList
                data={posts}
                keyExtractor={item => item.id}
                renderItem={renderPost}
                scrollEnabled={false}
                ListEmptyComponent={<Text style={styles.emptyText}>No posts available</Text>}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2B2B2B",
    flex: 1,
  },
  organizationCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginVertical: 6,
    marginHorizontal: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  organizationContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  organizationAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
  },
  eventCard: {
  width: CARD_WIDTH + 10,
  backgroundColor: "#fff",
  borderColor: "#e6e6e6",
  borderRadius: 10,      // Smooth corners but not circles
  borderWidth: 1.5,
  marginBottom: 0,
  minHeight: 220,
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.07,
  shadowRadius: 0.5,
  elevation: 2,
  overflow: "hidden", // Ensure contents don't spill over
},
eventImage: {
  width: "100%",
  height: 120,
  borderTopLeftRadius: 10,
  borderTopRightRadius: 10,
    backgroundColor: "#ddd",
},
cardDivider: {
  height: 1,
  backgroundColor: "#e6e6e6",
  marginHorizontal: 0,
},
eventContent: {
  padding: 12,
},
eventTitle: {
  fontSize: 17,
  fontWeight: "bold",
  color: "#222",
  marginBottom: 4,
},
eventOrg: {
  fontSize: 14,
  color: "#384c72ff",
  marginBottom: 2,
},
eventLocation: {
  fontSize: 13,
  color: "#444",
  marginBottom: 2,
},
eventMeta: {
  fontSize: 12,
  color: "#666",
  marginBottom: 2,
},
eventDate: {
  fontSize: 13,
  fontWeight: "600",
  color: "#3867d6",
  marginTop: 5,
},

  organizationAvatarLetter: {
    fontSize: 29,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    lineHeight: 56,
  },
  organizationInfo: {
    flexShrink: 1,
  },
  organizationName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
  },
  organizationCategory: {
    fontSize: 13,
    color: "#666",
    marginVertical: 2,
  },
  organizationStats: {
    fontSize: 14,
    color: "#888",
  },
  followButton: {
    backgroundColor: "#157efb",
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderRadius: 20,
    marginLeft: 12,
  },
  followButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  topActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  iconButton: {
    padding: 6,
  },
  searchBarWrapper: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f4f6fb",
    borderRadius: 22,
    borderWidth: 1,
    height: 44,               
    borderColor: "#ccc",
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 44,
    marginLeft: 8,
    color: "#333",
    paddingVertical: 0,
  },
  cancelButton: {
    marginLeft: 10,
  },
  cancelText: {
    fontSize: 16,
    color: "#2B2B2B",
  },


  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  topBar: {
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2B2B2B",
    flex: 1,
  },
  topActions: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    padding: 6,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    marginLeft: 8,
    marginBottom: 10,
    color: "#222",
  },
  horizontalCard: {
    width: CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 10,
    marginHorizontal: 4,
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 12,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarLetter: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  eventTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#222",
  },
  eventInfo: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  eventDate: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  participantInfo: {
    fontSize: 14,
    color: "#555",
    marginTop: 2,
  },
  postCard: {
    marginHorizontal: 12,
    marginVertical: 8,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    elevation: 3,
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  postAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#476397",
    justifyContent: "center",
    alignItems: "center",
  },
  postAvatarLetter: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  postOrganization: {
    marginLeft: 12,
    fontSize: 16,
    fontWeight: "bold",
    color: "#222",
  },
  postText: {
    marginTop: 6,
    fontSize: 16,
    color: "#444",
  },
  postImage: {
    marginTop: 10,
    width: "100%",
    height: 220,
    borderRadius: 12,
  },
  postActions: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  emptyText: {
    marginTop: 40,
    fontSize: 16,
    color: "#999",
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
    marginTop: 10,
    color: "#666",
  },
});
