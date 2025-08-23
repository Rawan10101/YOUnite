import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';

export default function CommentsScreen({ navigation, route }) {
  const { user } = useAppContext();
  const { postId } = route.params;
  const [comments, setComments] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    const q = query(commentsRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, snapshot => {
      const fetchedComments = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text,
          authorId: data.authorId,
          authorName: data.authorName,
          authorAvatar: data.authorAvatar || 'https://via.placeholder.com/40',
          createdAt: data.createdAt?.toDate(),
          timestamp: data.createdAt?.toDate()?.toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          }) || '',
        };
      });
      setComments(fetchedComments);
      setLoading(false);
      
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, error => {
      console.error('Comments listener error:', error);
      Alert.alert('Error', 'Failed to load comments');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [postId]);

  const sendComment = async () => {
    if (!inputText.trim()) return;
    
    if (!user?.uid) {
      Alert.alert('Error', 'You must be logged in to comment.');
      return;
    }

    try {
      const commentsRef = collection(db, 'posts', postId, 'comments');
      
      // Add comment to subcollection
      await addDoc(commentsRef, {
        text: inputText.trim(),
        authorId: user.uid,
        authorName: user.displayName || 'Anonymous User',
        authorAvatar: user.photoURL || 'https://via.placeholder.com/40',
        createdAt: serverTimestamp(),
      });

      // Update post's comment count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        commentCount: comments.length + 1
      });

      setInputText('');
    } catch (error) {
      console.error('Send comment error:', error);
      Alert.alert('Error', 'Failed to send comment. Please try again.');
    }
  };

  const renderCommentItem = ({ item, index }) => {
    const isCurrentUser = item.authorId === user.uid;
    const showAvatar = !isCurrentUser && (index === 0 || comments[index - 1].authorId !== item.authorId);
    
    return (
      <Animatable.View
        animation="fadeInUp"
        delay={index * 50}
        duration={300}
        style={styles.commentContainer}
      >
        <View style={isCurrentUser ? styles.commentRowRight : styles.commentRowLeft}>
          {!isCurrentUser && (
            <View style={styles.avatarContainer}>
              {showAvatar ? (
                <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarSpacer} />
              )}
            </View>
          )}
          
          <View style={[
            styles.commentBubble,
            isCurrentUser ? styles.commentBubbleRight : styles.commentBubbleLeft
          ]}>
            {!isCurrentUser && showAvatar && (
              <Text style={styles.commentAuthor}>{item.authorName}</Text>
            )}
            <Text style={[
              styles.commentText,
              isCurrentUser ? styles.commentTextRight : styles.commentTextLeft
            ]}>
              {item.text}
            </Text>
            <Text style={[
              styles.commentTimestamp,
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
        <Ionicons name="chatbubble-ellipses" size={50} color="#2B2B2B" />
        <Text style={styles.loadingText}>Loading comments...</Text>
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
          <Text style={styles.headerTitle}>Comments</Text>
          <Text style={styles.headerSubtitle}>{comments.length} comment{comments.length !== 1 ? 's' : ''}</Text>
        </View>
      </View>

      {/* Comments List */}
      <FlatList
        ref={flatListRef}
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={renderCommentItem}
        contentContainerStyle={styles.commentsContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubble-outline" size={60} color="#CCC" />
            <Text style={styles.emptyText}>No comments yet</Text>
            <Text style={styles.emptySubtext}>Be the first to comment on this post!</Text>
          </View>
        )}
      />

      {/* Input */}
      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.textInput}
            placeholder="Write a comment..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={300}
          />
          <TouchableOpacity 
            style={[
              styles.sendButton,
              inputText.trim() ? styles.sendButtonActive : styles.sendButtonInactive
            ]} 
            onPress={sendComment}
            disabled={!inputText.trim()}
          >
            <Ionicons 
              name="send" 
              size={18} 
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
  
  // Comments
  commentsContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  
  commentContainer: {
    marginBottom: 8,
  },
  
  commentRowLeft: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  
  commentRowRight: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
  },
  
  avatarContainer: {
    marginRight: 8,
    width: 28,
  },
  
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5F5F5',
  },
  
  avatarSpacer: {
    width: 28,
    height: 28,
  },
  
  commentBubble: {
    maxWidth: '75%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  
  commentBubbleLeft: {
    backgroundColor: '#F5F5F5',
    borderBottomLeftRadius: 4,
  },
  
  commentBubbleRight: {
    backgroundColor: '#2B2B2B',
    borderBottomRightRadius: 4,
  },
  
  commentAuthor: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    marginBottom: 2,
  },
  
  commentText: {
    fontSize: 14,
    lineHeight: 18,
  },
  
  commentTextLeft: {
    color: '#2B2B2B',
  },
  
  commentTextRight: {
    color: '#FFFFFF',
  },
  
  commentTimestamp: {
    fontSize: 9,
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
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  
  textInput: {
    flex: 1,
    fontSize: 14,
    color: '#2B2B2B',
    maxHeight: 80,
    paddingVertical: 6,
  },
  
  sendButton: {
    marginLeft: 12,
    padding: 6,
    borderRadius: 16,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  sendButtonActive: {
    backgroundColor: '#2B2B2B',
  },
  
  sendButtonInactive: {
    backgroundColor: '#E0E0E0',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2B2B2B',
    marginTop: 16,
  },
  
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
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
