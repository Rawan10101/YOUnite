import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

export default function ChatScreen({ navigation }) {
  const { user } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  // Global chat room for all volunteers and organizations
  const chatRoomId = 'global-volunteer-chat';

  useEffect(() => {
    const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          senderId: data.senderId,
          senderName: data.senderName,
          senderAvatar: data.senderAvatar || 'https://via.placeholder.com/40',
          createdAt: data.createdAt?.toDate(),
          timestamp: data.createdAt?.toDate()?.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) || '',
        };
      });
      setMessages(msgs);
      setLoading(false);
      
      // Auto scroll to bottom when new messages arrive
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, error => {
      console.error('Chat messages listener error:', error);
      Alert.alert('Error', 'Failed to load messages');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    try {
      const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
      await addDoc(messagesRef, {
        text: inputText.trim(),
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous User',
        senderAvatar: user.photoURL || 'https://via.placeholder.com/40',
        createdAt: serverTimestamp(),
      });
      setInputText('');
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const renderMessageItem = ({ item, index }) => {
    const isCurrentUser = item.senderId === user.uid;
    const showAvatar = !isCurrentUser && (index === 0 || messages[index - 1].senderId !== item.senderId);
    
    return (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 50}
        duration={300}
        style={styles.messageContainer}
      >
        <View style={isCurrentUser ? styles.messageRowRight : styles.messageRowLeft}>
          {!isCurrentUser && (
            <View style={styles.avatarContainer}>
              {showAvatar ? (
                <Image source={{ uri: item.senderAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}
          
          <View style={[
            styles.messageBubble,
            isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft
          ]}>
            {!isCurrentUser && showAvatar && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            <Text style={[
              styles.messageText,
              isCurrentUser ? styles.messageTextRight : styles.messageTextLeft
            ]}>
              {item.text}
            </Text>
            <Text style={[
              styles.timestamp,
              isCurrentUser ? styles.timestampRight : styles.timestampLeft
            ]}>
              {item.timestamp}
            </Text>
          </View>
        </View>
      </Animatable.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="chatbubbles" size={50} color="#2B2B2B" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#2B2B2B" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Volunteer Chat</Text>
          <Text style={styles.headerSubtitle}>Community discussion</Text>
        </View>
        <TouchableOpacity style={styles.infoButton}>
          <Ionicons name="information-circle-outline" size={24} color="#2B2B2B" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Type your message..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
            ]} 
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Ionicons 
              name="send" 
              size={20} 
              color={inputText.trim() ? "#fff" : "#999"} 
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  
  backButton: {
    marginRight: 16,
    padding: 4,
  },
  
  headerInfo: {
    flex: 1,
  },
  
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  
  infoButton: {
    padding: 4,
  },
  
  // Messages
  messagesContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  
  messageContainer: {
    marginBottom: 8,
  },
  
  messageRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  
  messageRowRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  
  avatarContainer: {
    marginRight: 8,
    width: 32,
  },
  
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  
  avatarSpacer: {
    width: 32,
    height: 32,
  },
  
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  
  messageBubbleLeft: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 4,
  },
  
  messageBubbleRight: {
    backgroundColor: '#2B2B2B',
    borderBottomRightRadius: 4,
  },
  
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  
  messageTextLeft: {
    color: '#2B2B2B',
  },
  
  messageTextRight: {
    color: '#FFFFFF',
  },
  
  timestamp: {
    fontSize: 10,
    marginTop: 4,
  },
  
  timestampLeft: {
    color: '#999',
  },
  
  timestampRight: {
    color: '#CCCCCC',
  },
  
  // Input
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F5F5F5',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#2B2B2B',
    maxHeight: 100,
    paddingVertical: 8,
  },
  
  sendButton: {
    marginLeft: 12,
    padding: 8,
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  sendButtonActive: {
    backgroundColor: '#2B2B2B',
  },
  
  sendButtonInactive: {
    backgroundColor: '#E0E0E0',
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    color: '#2B2B2B',
    fontWeight: '600',
  },
});
