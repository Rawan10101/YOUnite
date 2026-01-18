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

  // Search State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChatRooms = chatRooms.filter((room) =>
    room.chatTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
            // Title already set
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

        // Sort by newest message
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
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  };

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  // --- Render Components ---

  const renderAvatar = (uri) => {
    if (uri) {
      return <Image source={{ uri }} style={styles.avatar} />;
    }
    return (
      <View style={[styles.avatar, styles.avatarPlaceholder]}>
        <Ionicons name="person" size={24} color="#9CA3AF" />
      </View>
    );
  };

  const renderItem = ({ item }) => {
    const lastMessageTime = formatTimestamp(item.lastMessageTime);

    return (
      <TouchableOpacity
        style={styles.chatRow}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate("Chat", {
            chatRoomId: item.id,
            chatTitle: item.chatTitle,
            isEventChat: item.isEventChat,
          })
        }
      >
        <View style={styles.avatarContainer}>{renderAvatar(item.avatar)}</View>
        
        <View style={styles.chatInfo}>
          <View style={styles.rowTop}>
            <Text numberOfLines={1} style={styles.chatName}>
              {item.chatTitle}
            </Text>
            <Text style={styles.timeText}>{lastMessageTime}</Text>
          </View>
          
          <Text numberOfLines={1} style={styles.lastMessageText}>
            {item.lastMessage || "No messages yet"}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {isSearching ? (
          <View style={styles.searchBarContainer}>
             <Ionicons name="search" size={20} color="#6B7280" style={{marginRight: 8}} />
             <TextInput
               style={styles.searchInput}
               placeholder="Search..."
               value={searchQuery}
               onChangeText={setSearchQuery}
               autoFocus
               returnKeyType="search"
             />
             <TouchableOpacity onPress={() => { setIsSearching(false); setSearchQuery(''); }}>
               <Text style={styles.cancelText}>Cancel</Text>
             </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Messages</Text>
            <TouchableOpacity onPress={() => setIsSearching(true)} style={styles.iconBtn}>
              <Ionicons name="search" size={24} color="#111827" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#10B981" />
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
              <Ionicons name="chatbubbles-outline" size={60} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>Chats will appear here once you join events.</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB", // Light gray background
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  
  // Header
  header: {
    backgroundColor: "#fff",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  iconBtn: {
    padding: 4,
  },
  
  // Search
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  cancelText: {
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 10,
    fontSize: 14,
  },

  // List
  listContent: {
    paddingVertical: 0,
  },
  
  // Chat Row
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarPlaceholder: {
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  
  chatInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    flex: 1,
    marginRight: 10,
  },
  timeText: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  lastMessageText: {
    fontSize: 14,
    color: "#6B7280",
    lineHeight: 20,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginTop: 15,
  },
  emptySub: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: 'center',
    marginTop: 5,
  },
});