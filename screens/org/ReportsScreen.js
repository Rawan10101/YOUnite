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
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  collection,
  query,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { useNavigation } from "@react-navigation/native";
import { useAppContext } from "../../contexts/AppContext";

export default function ReportsScreen() {
  const navigation = useNavigation();
  const { user } = useAppContext();
const renderHeader = () => (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>Reports</Text>
    </View>
  );

  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const reportsQuery = query(
      collection(db, "reports"),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      reportsQuery,
      (snapshot) => {
        const allReports = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          sourceType: "report",
          sortTime: doc.data().createdAt?.seconds || 0,
        }));

        // Client-side filtering to match dashboard filter by mentionedOrganizations includes user.uid
        const filteredReports = allReports.filter((report) => {
          if (!report.mentionedOrganizations) return false;
          return report.mentionedOrganizations.some((org) => {
            if (typeof org === "string") {
              return org === user.uid;
            }
            if (org && typeof org === "object" && org.id) {
              return org.id === user.uid;
            }
            return false;
          });
        });

        setFeedItems(filteredReports);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        Alert.alert("Error", "Failed to load reports: " + error.message);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "Unknown";

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const getTypeStyle = () => ({ backgroundColor: "#E74C3C" });

  const getTypeIcon = () => "flag";

  const renderFeedItem = ({ item }) => (
    <View style={styles.feedCard}>
      {/* Report Header */}
      <View style={styles.feedHeader}>
        <View style={styles.authorInfo}>
          <Image
            source={{ uri: item.reporterAvatar || "https://via.placeholder.com/44" }}
            style={styles.authorAvatar}
          />
          <View style={styles.authorDetails}>
            <Text style={styles.authorName}>{item.reporterName || "Anonymous User"}</Text>
            <Text style={styles.postTimestamp}>{formatTimestamp(item.createdAt)}</Text>
          </View>
        </View>

        <View style={[styles.typeBadge, getTypeStyle()]}>
          <Ionicons name={getTypeIcon()} size={12} color="#fff" />
          <Text style={styles.badgeText}>REPORT</Text>
        </View>
      </View>

      {/* Content */}
      {item.text ? <Text style={styles.feedText}>{item.text}</Text> : null}

      {/* Image */}
      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.feedImage}
          resizeMode="cover"
        />
      )}

      {/* Engagement Footer */}
      <View style={styles.engagementFooter}>
        {/* <TouchableOpacity style={styles.engagementButton}>
          <Ionicons name="heart-outline" size={18} color="#666" />
          <Text style={styles.engagementText}>{item.likes?.length || 0}</Text>
        </TouchableOpacity> */}

        {/* <TouchableOpacity style={styles.engagementButton}>
          <Ionicons name="chatbubble-outline" size={18} color="#666" />
          <Text style={styles.engagementText}>{item.comments?.length || 0}</Text>
        </TouchableOpacity> */}

        {/* <TouchableOpacity style={styles.engagementButton}>
          <Ionicons name="eye-outline" size={18} color="#666" />
          <Text style={styles.engagementText}>{item.views?.length || 0}</Text>
        </TouchableOpacity> */}

        <TouchableOpacity
          style={styles.respondButton}
          onPress={() => navigation.navigate("RespondReportScreen", { report: item })}
        >
          <Ionicons name="mail-outline" size={16} color="#2B2B2B" />
          <Text style={styles.respondText}>Respond</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && feedItems.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2B2B2B" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  if (feedItems.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="flag-outline" size={80} color="#E0E0E0" />
        <Text style={styles.emptyTitle}>No Reports Yet</Text>
        <Text style={styles.emptySubtitle}>
          Community reports about your organization will appear here
        </Text>
      </View>
    );
  }

 return (
    <FlatList
      data={feedItems}
      keyExtractor={(item) => `${item.source}-${item.id}`}
      renderItem={renderFeedItem}
      ListHeaderComponent={renderHeader}
      contentContainerStyle={styles.feedContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={() => (
        <View style={styles.emptyState}>
          <Ionicons name="flag-outline" size={80} color="#E0E0E0" />
          <Text style={styles.emptyTitle}>No Reports Yet</Text>
          <Text style={styles.emptySubtitle}>
            Community reports about your organizations will appear here.
          </Text>
        </View>
      )}
    />
  );
}
const styles = StyleSheet.create({
  feedContent: {
    paddingVertical: 16,
    backgroundColor: "#F8F9FB",
  },
   headerContainer: {
    padding: 16,
    backgroundColor: '#f8fafc',
      borderBottomWidth: 1,
  borderBottomColor: '#ddd',
    marginBottom: 20
    // alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0c0c0cff',
  },
  feedCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  feedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  authorInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#F3F4F6",
  },
  authorDetails: {
    flex: 1,
  },
  authorName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 2,
  },
  postTimestamp: {
    fontSize: 14,
    color: "#6B7280",
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#E74C3C",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
    marginLeft: 4,
    letterSpacing: 0.5,
  },
  feedText: {
    fontSize: 16,
    color: "#374151",
    lineHeight: 24,
    marginBottom: 16,
  },
  feedImage: {
    width: "100%",
    height: 240,
    borderRadius: 12,
    marginBottom: 16,
    backgroundColor: "#F3F4F6",
  },
  engagementFooter: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },
  engagementButton: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 24,
  },
  engagementText: {
    fontSize: 14,
    color: "#6B7280",
    fontWeight: "500",
    marginLeft: 6,
  },
  respondButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EBF4FF",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: "auto",
  },
  respondText: {
    fontSize: 14,
    color: "#4e8cff",
    fontWeight: "600",
    marginLeft: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6B7280",
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#374151",
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
  },
});
