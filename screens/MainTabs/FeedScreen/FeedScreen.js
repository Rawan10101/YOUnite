import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
  Alert,
  StyleSheet,
  Dimensions,
} from "react-native";
import * as Animatable from "react-native-animatable";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../../firebaseConfig";
import { Ionicons } from "@expo/vector-icons";

const screenWidth = Dimensions.get("window").width;
const CARD_GAP = 16;
const CARD_WIDTH = (screenWidth - 3 * CARD_GAP) / 2;

export default function FeedScreen({ navigation }) {
  const [popularEvents, setPopularEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

    const unsubscribeEvents = onSnapshot(
      query(
        collection(db, "events"),
        where("date", ">=", today),
        orderBy("date", "asc"),
        limit(10)
      ),
      async (snapshot) => {
        const events = [];
        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const orgId = data.organizationId;
          let orgData = null;
          if (orgId) {
            const orgSnap = await getDoc(doc(db, "organizations", orgId));
            if (orgSnap.exists) orgData = orgSnap.data();
          }
          events.push({
            id: docSnap.id,
            ...data,
            organizationName: orgData?.name || "",
            organizationAvatar: orgData?.logo || null,
            dateObj: data.date?.toDate ? data.date.toDate() : new Date(data.date),
          });
        }
        setPopularEvents(events);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        Alert.alert("Error", "Failed to load popular events: " + error.message);
        setLoading(false);
        setRefreshing(false);
      }
    );

    const unsubscribePosts = onSnapshot(
      query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(40)),
      async (snapshot) => {
        const postsData = [];
        const orgIdsSet = new Set();

        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data();
          postsData.push({ id: docSnap.id, ...d });
          if (d.authorId) orgIdsSet.add(d.authorId);
        });

        const orgDocs = await Promise.all(
          Array.from(orgIdsSet).map((id) => getDoc(doc(db, "organizations", id)))
        );

        const orgMap = {};
        orgDocs.forEach((orgSnap) => {
          if (orgSnap.exists) orgMap[orgSnap.id] = orgSnap.data();
        });

        const postsWithOrg = postsData.map((post) => ({
          ...post,
          organizationName: orgMap[post.authorId]?.name || "",
          organizationAvatar: orgMap[post.authorId]?.logo || null,
        }));

        setPosts(postsWithOrg);
      },
      (error) => {
        Alert.alert("Error", "Failed to load posts: " + error.message);
      }
    );

    return () => {
      unsubscribeEvents();
      unsubscribePosts();
    };
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setLoading(true);
  };

  const formatDate = (dateObj) => {
    if (!dateObj) return "";
    try {
      return dateObj instanceof Date
        ? dateObj.toLocaleDateString()
        : new Date(dateObj).toLocaleDateString();
    } catch {
      return "";
    }
  };

  const renderEvent = ({ item, index }) => (
    <Animatable.View
      animation="fadeInLeft"
      delay={index * 80}
      style={[
        styles.horizontalCard,
        {
          width: CARD_WIDTH,
          marginLeft: index === 0 ? CARD_GAP : CARD_GAP / 2,
          marginRight: index % 2 === 1 ? CARD_GAP : CARD_GAP / 2,
        },
      ]}
    >
      {renderAvatar(item.organizationAvatar, item.organizationName, 56)}
      <View style={styles.eventInfo}>
        <Text style={styles.eventTitle} numberOfLines={2} ellipsizeMode="tail">
          {item.title}
        </Text>
        <Text style={styles.organizationName} numberOfLines={1} ellipsizeMode="tail">
          {item.organizationName}
        </Text>
        <Text style={styles.eventDate}>{formatDate(item.dateObj)}</Text>
        <TouchableOpacity
          style={styles.registerButton}
          onPress={() => navigation.navigate("EventRegistration", { eventId: item.id })}
        >
          <Text style={styles.registerButtonText}>Register</Text>
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  const renderPost = ({ item }) => (
    <Animatable.View style={styles.postCard} animation="fadeInUp">
      <View style={styles.postHeader}>
        {renderAvatar(item.organizationAvatar, item.organizationName, 32)}
        <Text style={styles.postOrgName}>{item.organizationName}</Text>
      </View>
      <Text style={styles.postCaption}>{item.caption || item.text}</Text>
      {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={styles.postImage} />}
      <View style={styles.postActions}>
        <TouchableOpacity>
          <Ionicons name="heart-outline" size={24} color="#444" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="chatbubble-outline" size={24} color="#444" />
        </TouchableOpacity>
        <TouchableOpacity>
          <Ionicons name="share-social-outline" size={24} color="#444" />
        </TouchableOpacity>
      </View>
    </Animatable.View>
  );

  if (loading)
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="calendar" size={50} color="#2B2B2B" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );

  return (
    <View style={styles.outerContainer}>
      <View style={styles.topBar}>
        <Text style={styles.appName}>YOUnite</Text>
        <View style={styles.topBarButtons}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="search" size={28} color="#2B2B2B" />
          </TouchableOpacity>
         <TouchableOpacity
  style={styles.iconButton}
  onPress={() => navigation.navigate('CreateReport')}
>
  <Ionicons name="flag-outline" size={28} color="rgba(5, 5, 5, 0.73)" />
</TouchableOpacity>

          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={28} color="#2B2B2B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <View style={{ marginVertical: 16 }}>
          <Text style={styles.sectionTitle}>Popular Events</Text>
          <FlatList
            data={popularEvents}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id}
            renderItem={renderEvent}
            contentContainerStyle={{ paddingHorizontal: CARD_GAP / 2 }}
          />
        </View>

        <View style={{ marginVertical: 16 }}>
          <Text style={styles.sectionTitle}>Posts</Text>
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPost}
            scrollEnabled={false}
            ListEmptyComponent={(<Text style={styles.emptyText}>No posts available.</Text>)}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styleCardWidth = (Dimensions.get("window").width - 48) / 2; // 48 accounts for padding and gaps

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  topBar: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: "#E0E0E0",
    borderBottomWidth: 1,
  },
  appName: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2B2B2B",
  },
  topBarButtons: {
    flexDirection: "row",
    gap: 14,
  },
  iconButton: {
    marginLeft: 10,
    position: "relative",
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2B2B2B",
    marginLeft: 16,
    marginBottom: 12,
  },
  horizontalCard: {
    backgroundColor: "#fff",
    width: styleCardWidth,
    marginVertical: 8,
    marginHorizontal: CARD_GAP / 2,
    borderRadius: 18,
    padding: 23,
    alignItems: "center",
    justifyContent: "space-between",
    elevation: 5,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  avatarLetter: {
    fontWeight: "700",
    color: "#fff",
    fontSize: 28,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    color: "#222",
    marginBottom: 4,
  },
  organizationName: {
    fontSize: 14,
    color: "#555",
    textAlign: "center",
  },
  eventDate: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
    textAlign: "center",
  },
  registerButton: {
    backgroundColor: "#2B2B2B",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 22,
    marginTop: 12,
  },
  registerButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  postCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  postOrgName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#222",
    marginLeft: 12,
  },
  postCaption: {
    fontSize: 14,
    color: "#444",
    marginBottom: 12,
  },
  postImage: {
    width: "100%",
    height: 220,
    borderRadius: 16,
  },
  postActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "600",
    color: "#555",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 60,
    color: "#888",
  },
});
