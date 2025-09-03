import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { useAppContext } from "../../../contexts/AppContext";
import { db } from "../../../firebaseConfig";

export default function ChatMainScreen() {
  const navigation = useNavigation();
  const { user } = useAppContext();

  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New state for search
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filtered chat rooms based on search
  const filteredChatRooms = chatRooms.filter((room) =>
    room.chatTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderAvatar = (uri, size = 50) => {
    if (uri) {
      return (
        <Image
          source={{ uri }}
          style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        />
      );
    }
    return (
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: "#476397",
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <Ionicons name="people" size={size * 0.6} color="#fff" />
      </View>
    );
  };

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "chatRooms"),
      where("participants", "array-contains", user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const rooms = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          const id = docSnap.id;

          let chatTitle = data.name || "";
          let avatar = null;
          let isEventChat = false;
          let isGroup = !!data.isGroupChat;
          let isGlobal = id === "global-chat" || id === "global-volunteer-chat";

          if (isGlobal) {
            chatTitle = "Global Volunteer Chat";
          } else if (id.startsWith("event_")) {
            isEventChat = true;
            const eventId = id.replace("event_", "");
            try {
              const eventDoc = await getDoc(doc(db, "events", eventId));
              if (eventDoc.exists) {
                chatTitle = eventDoc.data().title || "Event Chat";
              }
            } catch {}
          } else if (isGroup) {
            // group chat title already set
          } else if (data.participants.length === 2) {
            const otherId = data.participants.find((uid) => uid !== user.uid);
            if (otherId) {
              try {
                const otherDoc = await getDoc(doc(db, "users", otherId));
                if (otherDoc.exists) {
                  const otherData = otherDoc.data();
                  chatTitle = otherData.displayName || otherData.email || "Private Chat";
                  avatar = otherData.photoURL || null;
                }
              } catch {}
            }
          }

          rooms.push({
            id,
            chatTitle,
            avatar,
            isEventChat,
            lastMessage: data.lastMessage || "",
            lastMessageTime: data.lastMessageTime || null,
          });
        }

        rooms.sort((a, b) => {
          const timeA = a.lastMessageTime?.seconds || 0;
          const timeB = b.lastMessageTime?.seconds || 0;
          return timeB - timeA;
        });

        setChatRooms(rooms);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        Alert.alert("Error", "Failed to load chats: " + error.message);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate ? timestamp.toDate() : new Date();
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const renderItem = ({ item }) => {
    const lastMessageTime = formatTimestamp(item.lastMessageTime);

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() =>
          navigation.navigate("Chat", {
            chatRoomId: item.id,
            chatTitle: item.chatTitle,
            isEventChat: item.isEventChat,
          })
        }
      >
        <View style={styles.avatarContainer}>{renderAvatar(item.avatar)}</View>
        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text numberOfLines={1} style={styles.chatTitle}>
              {item.chatTitle}
            </Text>
            <Text style={styles.chatTimestamp}>{lastMessageTime}</Text>
          </View>
          <Text numberOfLines={1} style={styles.chatLastMessage}>
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {!isSearching ? (
          <>
            <Text style={styles.headerTitle}>Chats</Text>
            <TouchableOpacity onPress={() => setIsSearching(true)} style={styles.searchIcon}>
              <Ionicons name="search" size={24} color="#476397" />
            </TouchableOpacity>
          </>
        ) : (
          <TextInput
            style={styles.searchInput}
            placeholder="Search chats..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            onBlur={() => setIsSearching(false)}
            returnKeyType="done"
          />
        )}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4caf50" />
        </View>
      ) : (
        <FlatList
          data={filteredChatRooms}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={80} color="#bbb" />
              <Text style={styles.emptyTitle}>No Chats Yet</Text>
              <Text style={styles.emptySubText}>Browse events to join chats</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomColor: "#fff",
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 28, fontWeight: "bold", color: "#2B2B2B" },
  searchIcon: { padding: 6 },
  searchInput: {
    flex: 1,
    height: 36,
    backgroundColor: "#f0f0f0",
    borderRadius: 18,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#333",
  },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { paddingVertical: 10 },
  chatItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: "#fff",
    borderBottomColor: "#f0f0f0",
    borderBottomWidth: 1,
  },
  avatarContainer: { marginRight: 15 },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#2567e2ff",
  },
  chatContent: { flex: 1 },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 5,
  },
  chatTitle: { fontSize: 16.5, fontWeight: "600", color: "#0a0a0aff", flex: 1 },
  chatTimestamp: { fontSize: 12, color: "#0a0a0aff", marginLeft: 8 },
  chatLastMessage: { fontSize: 15, color: "#0a0a0aff" },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: "600", color: "#666", marginTop: 20 },
  emptySubText: { fontSize: 16, color: "#999", marginTop: 8 },
});
