import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRoute, useNavigation } from "@react-navigation/native";
import { db } from "../../firebaseConfig";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { useAppContext } from "../../contexts/AppContext";

export default function RespondToReportScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { user } = useAppContext();
  const report = route.params?.report;

  const [responseText, setResponseText] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendResponse = async () => {
    if (!responseText.trim()) {
      Alert.alert("Please enter a response message.");
      return;
    }
    setLoading(true);
    try {
      await addDoc(collection(db, "reportResponses"), {
        reportId: report.id,
        responderName: user?.displayName || "Organization Admin",
        responderAvatar: user?.photoURL || "https://via.placeholder.com/44",
        text: responseText.trim(),
        createdAt: serverTimestamp(),
        organizationId: user.uid,
      });
      setLoading(false);
      Alert.alert("Response sent!");
      navigation.goBack();
    } catch (err) {
      setLoading(false);
      Alert.alert("Failed to send response", err.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.reportHeader}>
        <Image
          source={{ uri: report.reporterAvatar || "https://via.placeholder.com/44" }}
          style={styles.avatar}
        />
        <View style={styles.authorDetails}>
          <Text style={styles.authorName}>{report.reporterName || "Anonymous User"}</Text>
          <Text style={styles.timestamp}>
            {report.createdAt?.seconds ? new Date(report.createdAt.seconds * 1000).toLocaleString() : "Unknown"}
          </Text>
        </View>
      </View>
      <Text style={styles.reportText}>{report.text || "No report text."}</Text>
      {report.imageUrl && (
        <Image source={{ uri: report.imageUrl }} style={styles.reportImage} resizeMode="cover" />
      )}

      <Text style={styles.label}>Your Response</Text>
      <TextInput
        style={styles.input}
        multiline
        placeholder="Write your response..."
        value={responseText}
        onChangeText={setResponseText}
        editable={!loading}
      />
      <TouchableOpacity style={styles.sendButton} onPress={handleSendResponse} disabled={loading}>
        <Ionicons name="send" size={20} color="#fff" />
        <Text style={styles.sendText}>{loading ? "Sending..." : "Send Response"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, backgroundColor: "#fff" },
  reportHeader: {flexDirection: "row", alignItems: "center", marginBottom: 18 },
  avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 10 },
authorDetails: {
  marginTop: 8,
},
authorName: {
  fontWeight: "bold",
  fontSize: 17,
  marginTop: 8, 
}, 
 timestamp: { color: "#999", fontSize: 13 },
  reportText: { fontSize: 16, color: "#222", marginVertical: 12 },
  reportImage: { width: "100%", height: 200, borderRadius: 10, marginBottom: 18 },
  label: { fontWeight: "bold", fontSize: 15, marginVertical: 8 },
  input: { borderColor: "#ccc", borderWidth: 1, borderRadius: 8, fontSize: 16, padding: 10, minHeight: 60, backgroundColor: "#f8f8f8" },
  sendButton: { flexDirection: "row", alignItems: "center", backgroundColor: "#2B2B2B", padding: 12, borderRadius: 8, marginTop: 16, justifyContent: "center" },
  sendText: { color: "#fff", fontSize: 16, marginLeft: 10 },
});
