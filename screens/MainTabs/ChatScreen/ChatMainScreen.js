import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';

export default function ChatMainScreen({ navigation }) {
  const { user } = useAppContext();
  const [chatRooms, setChatRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    console.log('Setting up chat rooms listener for user:', user.uid);

    // FIXED: Use correct field name 'lastMessageTime' instead of 'lastMessageTimestamp'
    const q = query(
      collection(db, 'chatRooms'),
      where('participants', 'array-contains', user.uid),
    //   orderBy('lastMessageTime', 'desc') // ← FIXED: Changed from 'lastMessageTimestamp' to 'lastMessageTime'
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      console.log('Chat rooms snapshot received:', snapshot.docs.length, 'documents');
      
      const rooms = [];
      
      for (const docSnapshot of snapshot.docs) {
        const roomData = docSnapshot.data();
        const roomId = docSnapshot.id;
        
        console.log('Processing chat room:', roomId, roomData);
        
        const enrichedRoom = {
          id: roomId,
          ...roomData,
        };

        // Determine chat type and title
        if (roomId === 'global-volunteer-chat') {
          enrichedRoom.chatTitle = 'Global Volunteer Chat';
          enrichedRoom.avatar = 'https://via.placeholder.com/50/4CAF50/ffffff?text=🌍';
        } else if (roomId.startsWith('event_')) {
          // Event chat
          const eventId = roomId.replace('event_', '');
          try {
            const eventDoc = await getDoc(doc(db, 'events', eventId));
            if (eventDoc.exists()) {
              const eventData = eventDoc.data();
              enrichedRoom.chatTitle = `${eventData.title}`;
              enrichedRoom.eventTitle = eventData.title;
              enrichedRoom.isEventChat = true;
            } else {
              enrichedRoom.chatTitle = 'Event Chat';
              enrichedRoom.isEventChat = true;
            }
          } catch (error) {
            console.error('Error fetching event details:', error);
            enrichedRoom.chatTitle = 'Event Chat';
            enrichedRoom.isEventChat = true;
          }
          enrichedRoom.avatar = 'https://via.placeholder.com/50/2196F3/ffffff?text=📅';
        } else if (roomData.isGroupChat) {
          // Group chat
          enrichedRoom.chatTitle = roomData.name || 'Group Chat';
          enrichedRoom.avatar = 'https://via.placeholder.com/50/FF9800/ffffff?text=👥';
        } else if (roomData.participants && roomData.participants.length === 2) {
          // Private 1:1 chat
          const otherParticipantId = roomData.participants.find(id => id !== user.uid);
          if (otherParticipantId) {
            try {
              const participantDoc = await getDoc(doc(db, 'users', otherParticipantId));
              if (participantDoc.exists()) {
                const participantData = participantDoc.data();
                enrichedRoom.chatTitle = participantData.displayName || participantData.email || 'User';
                enrichedRoom.avatar = participantData.photoURL || 'https://via.placeholder.com/50/666/ffffff?text=👤';
              } else {
                enrichedRoom.chatTitle = 'Private Chat';
                enrichedRoom.avatar = 'https://via.placeholder.com/50/666/ffffff?text=👤';
              }
            } catch (error) {
              console.error('Error fetching participant details:', error);
              enrichedRoom.chatTitle = 'Private Chat';
              enrichedRoom.avatar = 'https://via.placeholder.com/50/666/ffffff?text=👤';
            }
          }
        } else {
          // Fallback
          enrichedRoom.chatTitle = roomData.name || 'Chat';
          enrichedRoom.avatar = 'https://via.placeholder.com/50/999/ffffff?text=💬';
        }

        rooms.push(enrichedRoom);
      }
        rooms.sort((a, b) => {
    const timeA = a.lastMessageTime?.seconds || 0;
    const timeB = b.lastMessageTime?.seconds || 0;
    return timeB - timeA; 
  });
  
      console.log('Processed chat rooms:', rooms.length);
      setChatRooms(rooms);
      setLoading(false);
    }, (error) => {
      console.error('Chat rooms listener error:', error);
      setLoading(false);
    });

    return () => {
      console.log('Cleaning up chat rooms listener');
      unsubscribe();
    };
  }, [user?.uid]);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 168) { // Less than a week
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const renderChatItem = ({ item }) => {
    const lastMessageTime = formatTimestamp(item.lastMessageTime); // ← FIXED: Use correct field name
    const chatTitle = item.chatTitle || 'Chat';
    const avatarUri = item.avatar || 'https://via.placeholder.com/50/999/ffffff?text=💬';
    const isGlobalChat = item.id === 'global-volunteer-chat';
    const isEventChat = item.isEventChat || item.id.startsWith('event_');

    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('Chat', {
          chatRoomId: item.id,
          chatTitle: chatTitle,
          isEventChat: isEventChat,
          eventId: isEventChat ? item.id.replace('event_', '') : null,
        })}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
          {isGlobalChat && (
            <View style={styles.globalBadge}>
              <Ionicons name="globe" size={12} color="#fff" />
            </View>
          )}
          {isEventChat && !isGlobalChat && (
            <View style={styles.eventBadge}>
              <Ionicons name="calendar" size={12} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName} numberOfLines={1}>
              {chatTitle}
            </Text>
            <Text style={styles.timestamp}>{lastMessageTime}</Text>
          </View>
          
          <View style={styles.lastMessageRow}>
            <Text style={styles.lastMessage} numberOfLines={1}>
              {item.lastMessage || 'No messages yet'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>No Chats Yet</Text>
      <Text style={styles.emptySubtitle}>
        Register for events to join their chat rooms
      </Text>
      <TouchableOpacity 
        style={styles.emptyButton}
        onPress={() => navigation.navigate('Events')}
      >
        <Text style={styles.emptyButtonText}>Browse Events</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading chats...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
        <TouchableOpacity 
          style={styles.newChatButton}
          onPress={() => {
            // Navigate to global chat if no chats exist
            navigation.navigate('Chat', {
              chatRoomId: 'global-volunteer-chat',
              chatTitle: 'Global Volunteer Chat',
              isEventChat: false,
            });
          }}
        >
          <Ionicons name="chatbubbles-outline" size={24} color="#4CAF50" />
        </TouchableOpacity>
      </View>

      {/* Chat List */}
      <FlatList
        data={chatRooms}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  newChatButton: {
    padding: 5,
  },
  chatList: {
    paddingVertical: 10,
  },
  chatItem: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f0f0f0',
  },
  globalBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#4CAF50',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#2196F3',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginLeft: 10,
  },
  lastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
