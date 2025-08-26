import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppContext } from '../../contexts/AppContext';
import { db, storage } from '../../firebaseConfig';

export default function CreatePostScreen({ navigation }) {
  const { user } = useAppContext();
  const [postText, setPostText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [postType, setPostType] = useState('announcement'); // announcement, update, news
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to add images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const imageRef = ref(storage, `posts/${user.uid}_${Date.now()}.jpg`);
      await uploadBytes(imageRef, blob);
      return await getDownloadURL(imageRef);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const handleSubmitPost = async () => {
    if (!postText.trim() && !selectedImage) {
      Alert.alert('Error', 'Please add some content or an image to your post.');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl = null;
      if (selectedImage) {
        imageUrl = await uploadImage(selectedImage);
      }

      const postData = {
        text: postText.trim() || null,
        imageUrl: imageUrl || null,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'Organization',
        authorAvatar: user.photoURL || null,
        authorType: 'organization',
        type: postType,
        createdAt: serverTimestamp(),
        likes: [],
        comments: [],
        views: [],
        isPublic: true,
      };

      await addDoc(collection(db, 'posts'), postData);

      Alert.alert(
        'Success', 
        'Your post has been published!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );

    } catch (error) {
      console.error('Error submitting post:', error);
      Alert.alert('Error', 'Failed to publish post. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPostTypeStyle = (type) => {
    switch (type) {
      case 'announcement':
        return { backgroundColor: '#FF6B6B', color: '#FFFFFF' };
      case 'update':
        return { backgroundColor: '#4ECDC4', color: '#FFFFFF' };
      case 'news':
        return { backgroundColor: '#FFD93D', color: '#333333' };
      default:
        return { backgroundColor: '#666666', color: '#FFFFFF' };
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="close" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Post</Text>
        <TouchableOpacity
          style={[
            styles.publishButton,
            (!postText.trim() && !selectedImage) ? styles.publishButtonDisabled : null
          ]}
          onPress={handleSubmitPost}
          disabled={isSubmitting || (!postText.trim() && !selectedImage)}
        >
          <Text style={[
            styles.publishButtonText,
            (!postText.trim() && !selectedImage) ? styles.publishButtonTextDisabled : null
          ]}>
            {isSubmitting ? 'Publishing...' : 'Publish'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Post Type Selector */}
        <View style={styles.typeSection}>
          <Text style={styles.sectionTitle}>Post Type</Text>
          <View style={styles.typeButtons}>
            {['announcement', 'update', 'news'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typeButton,
                  postType === type && getPostTypeStyle(type),
                  postType !== type && styles.inactiveTypeButton,
                ]}
                onPress={() => setPostType(type)}
              >
                <Text style={[
                  styles.typeButtonText,
                  postType === type && { color: getPostTypeStyle(type).color },
                  postType !== type && { color: '#666' },
                ]}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Text Input */}
        <View style={styles.textSection}>
          <TextInput
            style={styles.textInput}
            placeholder={`What's new with your organization?`}
            placeholderTextColor="#999"
            multiline
            value={postText}
            onChangeText={setPostText}
            maxLength={1000}
            textAlignVertical="top"
          />
        </View>

        {/* Selected Image */}
        {selectedImage && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
            >
              <Ionicons name="close-circle" size={24} color="#E33F3F" />
            </TouchableOpacity>
          </View>
        )}

        {/* Character Count */}
        <View style={styles.characterCount}>
          <Text style={styles.characterCountText}>
            {postText.length}/1000 characters
          </Text>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
          <Ionicons name="image-outline" size={24} color="#4e8cff" />
          <Text style={styles.actionText}>Add Photo</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  publishButton: {
    backgroundColor: '#4e8cff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  publishButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  publishButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  publishButtonTextDisabled: {
    color: '#9CA3AF',
  },

  // Content
  content: {
    flex: 1,
    padding: 20,
  },

  // Type Section
  typeSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  typeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inactiveTypeButton: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Text Section
  textSection: {
    marginBottom: 20,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    fontSize: 16,
    color: '#111827',
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Image
  imageContainer: {
    position: 'relative',
    marginBottom: 20,
  },
  selectedImage: {
    width: '100%',
    height: 240,
    borderRadius: 16,
  },
  removeImageButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },

  // Character Count
  characterCount: {
    alignItems: 'flex-end',
    marginBottom: 20,
  },
  characterCountText: {
    fontSize: 12,
    color: '#9CA3AF',
  },

  // Bottom Actions
  bottomActions: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  actionText: {
    fontSize: 16,
    color: '#4e8cff',
    fontWeight: '600',
    marginLeft: 8,
  },
});
