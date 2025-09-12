import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
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
import { db } from '../../firebaseConfig';

const CLOUD_FUNCTION_URL = 'https://us-central1-younite-7eb12.cloudfunctions.net/uploadPostImage'; 

export default function CreatePostScreen({ navigation }) {
  const { user } = useAppContext();
  const [postText, setPostText] = useState('');
  const [selectedImages, setSelectedImages] = useState([]); // multiple images
  const [postType, setPostType] = useState('announcement');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pick multiple images (using updated ImagePicker API)
 const pickImages = async () => {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log('Gallery permission status:', status);
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to add images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images, // Use MediaTypeOptions for compatibility
      allowsMultipleSelection: true,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled) {
      console.log('User picked images:', result.assets);
      setSelectedImages(result.assets.map(asset => asset.uri));
    } else {
      console.log('User cancelled image picker');
    }
  } catch (error) {
    console.error('Error picking images:', error);
    Alert.alert('Error', 'Failed to pick images.');
  }
};

  


  // Upload image by calling your Cloud Function (like CreateEventScreen)
  const uploadImageToFirebase = async (imageUri) => {
    try {
      const base64 = await FileSystem.readAsStringAsync(imageUri, { encoding: 'base64' });
      const response = await fetch(CLOUD_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64, userId: user.uid }),
      });
      if (!response.ok) throw new Error('Upload failed');
      const { downloadURL } = await response.json();
      return downloadURL;
    } catch (error) {
      console.error('Image upload failed:', error);
      Alert.alert('Error', 'Failed to upload image');
      throw error;
    }
  };

  // Upload all selected images using Cloud Function
  const uploadImages = async (uris) => {
    const urls = [];
    for (const uri of uris) {
      const url = await uploadImageToFirebase(uri);
      urls.push(url);
    }
    return urls;
  };

  const handleSubmitPost = async () => {
    if (!postText.trim() && selectedImages.length === 0) {
      Alert.alert('Error', 'Please add some content or images.');
      return;
    }
    setIsSubmitting(true);
    try {
      let imageUrls = [];
      if (selectedImages.length > 0) {
        imageUrls = await uploadImages(selectedImages);
      }
      const postData = {
        text: postText.trim() || null,
        imageUrls,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'User',
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
      Alert.alert('Success', 'Your post has been published!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
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
            (!postText.trim() && selectedImages.length === 0) ? styles.publishButtonDisabled : null
          ]}
          onPress={handleSubmitPost}
          disabled={isSubmitting || (!postText.trim() && selectedImages.length === 0)}
        >
          <Text style={[
            styles.publishButtonText,
            (!postText.trim() && selectedImages.length === 0) ? styles.publishButtonTextDisabled : null
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

        {/* Selected Images */}
        {selectedImages.length > 0 && (
          <ScrollView horizontal style={styles.imagesScroll}>
            {selectedImages.map((uri, idx) => (
              <View key={idx} style={styles.imageContainer}>
                <Image source={{ uri }} style={styles.selectedImage} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => setSelectedImages(selectedImages.filter((_, i) => i !== idx))}
                >
                  <Ionicons name="close-circle" size={24} color="#E33F3F" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
     <TouchableOpacity style={styles.actionButton} onPress={pickImages}>
  <Ionicons name="image-outline" size={24} color="#4e8cff" />
  <Text style={styles.actionText}>Add Photos</Text>
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
  content: {
    flex: 1,
    padding: 20,
  },
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
  imagesScroll: {
    marginBottom: 20,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  selectedImage: {
    width: 160,
    height: 120,
    borderRadius: 16,
  },
  removeImageButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 2,
  },
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
