import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';
import { createMentionNotification, removeVolunteerFromEvent } from '../../../utils/EventDeletionUtils';

export default function ChatScreen({ route, navigation }) {
  const { user } = useAppContext();
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [chatRoomData, setChatRoomData] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const flatListRef = useRef(null);
  const textInputRef = useRef(null);

  // Get chat room details from route params or default to global chat
  const {
    chatRoomId = 'global-volunteer-chat',
    chatTitle = 'Volunteer Chat',
    isEventChat = false,
    eventId = null,
    organizationId = null
  } = route.params || {};

  // Check if current user is admin (event organizer)
  const isAdmin = isEventChat && eventData && user?.uid === eventData.organizationId;

  useEffect(() => {
    // Load event data if it's an event chat
    if (isEventChat && eventId) {
      loadEventData();
    }

    // Load chat room data if it's an event chat
    if (isEventChat && chatRoomId !== 'global-volunteer-chat') {
      loadChatRoomData();
      loadParticipants();
    }

    // Set up messages listener
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
          mentions: data.mentions || [],
          edited: data.edited || false,
          editedAt: data.editedAt?.toDate(),
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
  }, [chatRoomId, isEventChat, eventId]);

  const loadEventData = async () => {
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        setEventData({ id: eventDoc.id, ...eventDoc.data() });
      }
    } catch (error) {
      console.error('Error loading event data:', error);
    }
  };

  const loadChatRoomData = async () => {
    try {
      const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
      const chatRoomDoc = await getDoc(chatRoomRef);
      
      if (chatRoomDoc.exists()) {
        setChatRoomData(chatRoomDoc.data());
      }
    } catch (error) {
      console.error('Error loading chat room data:', error);
    }
  };

  const loadParticipants = async () => {
    try {
      const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
      const chatRoomDoc = await getDoc(chatRoomRef);
      
      if (chatRoomDoc.exists()) {
        const participantIds = chatRoomDoc.data().participants || [];
        const participantData = [];
        
        for (const participantId of participantIds) {
          try {
            const userDoc = await getDoc(doc(db, 'users', participantId));
            if (userDoc.exists()) {
              participantData.push({
                id: participantId,
                ...userDoc.data()
              });
            }
          } catch (error) {
            console.error('Error loading participant:', participantId, error);
          }
        }
        
        setParticipants(participantData);
      }
    } catch (error) {
      console.error('Error loading participants:', error);
    }
  };

  const handleTextChange = (text) => {
    setInputText(text);
    
    // Check for mentions
    const mentionMatch = text.match(/@(\w*)$/);
    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      setMentionQuery(query);
      
      // Filter participants for mention suggestions
      const suggestions = participants.filter(participant => 
        participant.displayName?.toLowerCase().includes(query) ||
        participant.email?.toLowerCase().includes(query)
      ).slice(0, 5);
      
      setMentionSuggestions(suggestions);
      setShowMentionSuggestions(true);
    } else {
      setShowMentionSuggestions(false);
      setMentionSuggestions([]);
      setMentionQuery('');
    }
  };

  const insertMention = (participant) => {
    const mentionText = `@${participant.displayName || participant.email}`;
    const beforeMention = inputText.substring(0, inputText.lastIndexOf('@'));
    const newText = beforeMention + mentionText + ' ';
    
    setInputText(newText);
    setShowMentionSuggestions(false);
    setMentionSuggestions([]);
    setMentionQuery('');
    
    // Focus back to input
    textInputRef.current?.focus();
  };

  const extractMentions = (text) => {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const mentionedName = match[1];
      const participant = participants.find(p => 
        p.displayName === mentionedName || p.email === mentionedName
      );
      
      if (participant) {
        mentions.push({
          userId: participant.id,
          displayName: participant.displayName || participant.email,
          position: match.index
        });
      }
    }
    
    return mentions;
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    try {
      const mentions = extractMentions(inputText);
      
      const messagesRef = collection(db, 'chatRooms', chatRoomId, 'messages');
      await addDoc(messagesRef, {
        text: inputText.trim(),
        senderId: user.uid,
        senderName: user.displayName || 'Anonymous User',
        senderAvatar: user.photoURL || 'https://via.placeholder.com/40',
        createdAt: serverTimestamp(),
        mentions: mentions,
        edited: false,
      });

      // Update chat room's last message info
      if (isEventChat && chatRoomId !== 'global-volunteer-chat') {
        const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
        await updateDoc(chatRoomRef, {
          lastMessage: inputText.trim(),
          lastMessageTime: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      // Create mention notifications (client-side)
      if (mentions.length > 0) {
        for (const mention of mentions) {
          await createMentionNotification(
            mention.userId,
            user.uid,
            chatRoomId,
            chatTitle,
            inputText.trim()
          );
        }
      }

      setInputText('');
      setShowMentionSuggestions(false);
    } catch (error) {
      console.error('Send message error:', error);
      Alert.alert('Error', 'Failed to send message');
    }
  };

  const handleLongPressMessage = (message) => {
    if (isAdmin || message.senderId === user.uid) {
      setSelectedMessage(message);
      setShowAdminMenu(true);
    }
  };

  const deleteMessage = async () => {
    if (!selectedMessage) return;

    try {
      const messageRef = doc(db, 'chatRooms', chatRoomId, 'messages', selectedMessage.id);
      await deleteDoc(messageRef);
      
      Alert.alert('Success', 'Message deleted successfully');
    } catch (error) {
      console.error('Error deleting message:', error);
      Alert.alert('Error', 'Failed to delete message');
    } finally {
      setShowAdminMenu(false);
      setSelectedMessage(null);
    }
  };

  const handleRemoveVolunteerFromEvent = async (volunteerId) => {
    if (!isAdmin || !eventId) return;

    const participant = participants.find(p => p.id === volunteerId);
    const participantName = participant?.displayName || participant?.email || 'Unknown User';

    Alert.alert(
      'Remove Volunteer',
      `Are you sure you want to remove ${participantName} from this event? This will also remove them from the chat.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeVolunteerFromEvent(
                eventId,
                volunteerId,
                eventData.organizationId,
                user.uid
              );

              Alert.alert('Success', 'Volunteer removed from event and chat');
              loadParticipants(); // Refresh participants list
            } catch (error) {
              console.error('Error removing volunteer:', error);
              Alert.alert('Error', 'Failed to remove volunteer');
            }
          }
        }
      ]
    );
  };

  const removeParticipantFromChat = async (participantId) => {
    if (!isAdmin) return;

    const participant = participants.find(p => p.id === participantId);
    const participantName = participant?.displayName || participant?.email || 'Unknown User';

    Alert.alert(
      'Remove from Chat',
      `Remove ${participantName} from the chat only? (They will remain registered for the event)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove from Chat',
          style: 'destructive',
          onPress: async () => {
            try {
              const chatRoomRef = doc(db, 'chatRooms', chatRoomId);
              await updateDoc(chatRoomRef, {
                participants: arrayRemove(participantId),
                updatedAt: serverTimestamp()
              });

              Alert.alert('Success', 'Participant removed from chat');
              loadParticipants(); // Refresh participants list
            } catch (error) {
              console.error('Error removing participant from chat:', error);
              Alert.alert('Error', 'Failed to remove participant from chat');
            }
          }
        }
      ]
    );
  };

  const renderMentionText = (text, mentions) => {
    if (!mentions || mentions.length === 0) {
      return <Text style={styles.messageText}>{text}</Text>;
    }

    const parts = [];
    let lastIndex = 0;

    mentions.forEach((mention, index) => {
      // Add text before mention
      if (mention.position > lastIndex) {
        parts.push(
          <Text key={`text-${index}`}>
            {text.substring(lastIndex, mention.position)}
          </Text>
        );
      }

      // Add mention
      const mentionText = `@${mention.displayName}`;
      parts.push(
        <Text key={`mention-${index}`} style={styles.mentionText}>
          {mentionText}
        </Text>
      );

      lastIndex = mention.position + mentionText.length;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(
        <Text key="text-end">
          {text.substring(lastIndex)}
        </Text>
      );
    }

    return <Text style={styles.messageText}>{parts}</Text>;
  };

  const renderMessageItem = ({ item, index }) => {
    const isCurrentUser = item.senderId === user.uid;
    const showAvatar = !isCurrentUser && (index === 0 || messages[index - 1].senderId !== item.senderId);
    const isMentioned = item.mentions?.some(mention => mention.userId === user.uid);
    
    return (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 50}
        duration={300}
        style={[
          styles.messageContainer,
          isMentioned && styles.mentionedMessageContainer
        ]}
      >
        <TouchableOpacity
          style={isCurrentUser ? styles.messageRowRight : styles.messageRowLeft}
          onLongPress={() => handleLongPressMessage(item)}
          delayLongPress={500}
        >
          {!isCurrentUser && (
            <View style={styles.avatarContainer}>
              {showAvatar ? (
                <TouchableOpacity 
                  onLongPress={() => isAdmin && handleRemoveVolunteerFromEvent(item.senderId)}
                  delayLongPress={1000}
                >
                  <Image source={{ uri: item.senderAvatar }} style={styles.avatar} />
                </TouchableOpacity>
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}
          
          <View style={[
            styles.messageBubble,
            isCurrentUser ? styles.messageBubbleRight : styles.messageBubbleLeft,
            isMentioned && styles.mentionedMessageBubble
          ]}>
            {!isCurrentUser && showAvatar && (
              <Text style={styles.senderName}>{item.senderName}</Text>
            )}
            
            <View style={[
              styles.messageTextContainer,
              isCurrentUser ? styles.messageTextRight : styles.messageTextLeft
            ]}>
              {renderMentionText(item.text, item.mentions)}
            </View>
            
            <View style={styles.messageFooter}>
              <Text style={[
                styles.timestamp,
                isCurrentUser ? styles.timestampRight : styles.timestampLeft
              ]}>
                {item.timestamp}
                {item.edited && ' (edited)'}
              </Text>
              
              {isMentioned && (
                <View style={styles.mentionBadge}>
                  <Text style={styles.mentionBadgeText}>@</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animatable.View>
    );
  };

  const renderMentionSuggestions = () => {
    if (!showMentionSuggestions || mentionSuggestions.length === 0) {
      return null;
    }

    return (
      <View style={styles.mentionSuggestionsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {mentionSuggestions.map((participant) => (
            <TouchableOpacity
              key={participant.id}
              style={styles.mentionSuggestion}
              onPress={() => insertMention(participant)}
            >
              <Image 
                source={{ uri: participant.photoURL || 'https://via.placeholder.com/32' }} 
                style={styles.mentionSuggestionAvatar} 
              />
              <Text style={styles.mentionSuggestionName}>
                {participant.displayName || participant.email}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderParticipantsModal = () => (
    <Modal
      visible={showParticipants}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowParticipants(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.participantsModal}>
          <View style={styles.participantsHeader}>
            <Text style={styles.participantsTitle}>
              Participants ({participants.length})
            </Text>
            <TouchableOpacity onPress={() => setShowParticipants(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <FlatList
            data={participants}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.participantItem}>
                <Image 
                  source={{ uri: item.photoURL || 'https://via.placeholder.com/40' }} 
                  style={styles.participantAvatar} 
                />
                <View style={styles.participantInfo}>
                  <Text style={styles.participantName}>
                    {item.displayName || item.email}
                  </Text>
                  <Text style={styles.participantRole}>
                    {item.id === eventData?.organizationId ? 'Admin' : 'Participant'}
                  </Text>
                </View>
                
                {isAdmin && item.id !== user.uid && (
                  <View style={styles.participantActions}>
                    <TouchableOpacity
                      style={styles.removeFromEventButton}
                      onPress={() => {
                        setShowParticipants(false);
                        handleRemoveVolunteerFromEvent(item.id);
                      }}
                    >
                      <Ionicons name="person-remove-outline" size={16} color="#FF4757" />
                      <Text style={styles.removeButtonText}>Remove from Event</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={styles.removeFromChatButton}
                      onPress={() => {
                        setShowParticipants(false);
                        removeParticipantFromChat(item.id);
                      }}
                    >
                      <Ionicons name="chatbubble-outline" size={16} color="#FF9800" />
                      <Text style={styles.removeButtonText}>Remove from Chat</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            style={styles.participantsList}
          />
        </View>
      </View>
    </Modal>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={24} color="#2B2B2B" />
      </TouchableOpacity>
      <View style={styles.headerInfo}>
        <Text style={styles.headerTitle}>{chatTitle}</Text>
        <Text style={styles.headerSubtitle}>
          {isEventChat ? (
            <>
              Event chat
              {isAdmin && ' • You are admin'}
              {participants.length > 0 && ` • ${participants.length} participants`}
            </>
          ) : (
            'Community discussion'
          )}
        </Text>
      </View>
      {isEventChat && (
        <TouchableOpacity 
          style={styles.infoButton}
          onPress={() => setShowParticipants(true)}
        >
          <Ionicons name="people-outline" size={24} color="#2B2B2B" />
        </TouchableOpacity>
      )}
    </View>
  );

  const renderAdminMenu = () => (
    <Modal
      visible={showAdminMenu}
      transparent={true}
      animationType="fade"
      onRequestClose={() => setShowAdminMenu(false)}
    >
      <TouchableOpacity 
        style={styles.modalOverlay}
        onPress={() => setShowAdminMenu(false)}
      >
        <View style={styles.adminMenu}>
          <Text style={styles.adminMenuTitle}>
            {isAdmin ? 'Admin Actions' : 'Message Options'}
          </Text>
          
          <TouchableOpacity style={styles.adminMenuItem} onPress={deleteMessage}>
            <Ionicons name="trash-outline" size={20} color="#FF4757" />
            <Text style={[styles.adminMenuText, { color: '#FF4757' }]}>Delete Message</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.adminMenuItem} 
            onPress={() => setShowAdminMenu(false)}
          >
            <Ionicons name="close-outline" size={20} color="#666" />
            <Text style={styles.adminMenuText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
      {renderHeader()}

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

      {/* Mention Suggestions */}
      {renderMentionSuggestions()}

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            ref={textInputRef}
            style={styles.textInput}
            placeholder="Type your message... Use @ to mention someone"
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={handleTextChange}
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

      {/* Admin Menu Modal */}
      {renderAdminMenu()}
      
      {/* Participants Modal */}
      {renderParticipantsModal()}
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
  
  mentionedMessageContainer: {
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    padding: 4,
    marginHorizontal: -4,
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
  
  mentionedMessageBubble: {
    borderWidth: 2,
    borderColor: '#FF9800',
  },
  
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  
  messageTextContainer: {
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
  
  mentionText: {
    fontWeight: '600',
    color: '#FF9800',
  },
  
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  
  timestamp: {
    fontSize: 10,
  },
  
  timestampLeft: {
    color: '#999',
  },
  
  timestampRight: {
    color: '#CCCCCC',
  },
  
  mentionBadge: {
    backgroundColor: '#FF9800',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  
  mentionBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  
  // Mention Suggestions
  mentionSuggestionsContainer: {
    backgroundColor: '#F8F9FA',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  
  mentionSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  
  mentionSuggestionAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 8,
  },
  
  mentionSuggestionName: {
    fontSize: 14,
    color: '#2B2B2B',
    fontWeight: '500',
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

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Admin Menu
  adminMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    minWidth: 200,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },

  adminMenuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 16,
    textAlign: 'center',
  },

  adminMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
  },

  adminMenuText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#666',
  },
  
  // Participants Modal
  participantsModal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxHeight: '70%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  
  participantsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  
  participantsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  
  participantsList: {
    maxHeight: 300,
  },
  
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  
  participantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  
  participantInfo: {
    flex: 1,
  },
  
  participantName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#2B2B2B',
  },
  
  participantRole: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  
  participantActions: {
    gap: 8,
  },
  
  removeFromEventButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  
  removeFromChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  
  removeButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
  },
});

