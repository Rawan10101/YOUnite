import { Ionicons } from '@expo/vector-icons';
import { updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAppContext } from '../../../contexts/AppContext';
import { db, auth } from '../../../firebaseConfig';

const ProfileAvatar = ({ photoURL, displayName, size = 100 }) => {
  const [imageError, setImageError] = useState(false);
  
  const getInitials = (name) => {
    if (!name) return 'V';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .substring(0, 2);
  };
  
  const getAvatarColor = (name) => {
    const colors = ['#4e8cff', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57', '#FF9FF3', '#54A0FF'];
    if (!name) return colors;
    const index = name.length % colors.length;
    return colors[index];
  };

  if (!photoURL || imageError) {
    return (
      <View style={[
        styles.defaultAvatar, 
        { 
          width: size, 
          height: size, 
          borderRadius: size / 2,
          backgroundColor: getAvatarColor(displayName)
        }
      ]}>
        <Text style={[styles.avatarText, { fontSize: size * 0.4 }]}>
          {getInitials(displayName)}
        </Text>
      </View>
    );
  }

  return (
    <Image 
      source={{ uri: photoURL }} 
      style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
      onError={() => setImageError(true)}
    />
  );
};

export default function EditProfileScreen({ navigation }) {
  const { user, setUser } = useAppContext();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    try {
      // Request permission first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setLoading(true);
        // Fix: Correct way to access the URI
        const uploadedURL = await uploadImage(result.assets[0].uri);
        setPhotoURL(uploadedURL);
        setLoading(false);
      }
    } catch (error) {
      console.error('Image pick error:', error);
      setLoading(false);
      Alert.alert('Error', 'Failed to pick image: ' + error.message);
    }
  };

  const uploadImage = async (uri) => {
    try {
      console.log('Starting image upload for URI:', uri);
      
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storage = getStorage();
      const imageRef = ref(storage, `profile-images/${user.uid}_${Date.now()}`);
      
      console.log('Uploading to Firebase Storage...');
      await uploadBytes(imageRef, blob);
      
      console.log('Getting download URL...');
      const downloadURL = await getDownloadURL(imageRef);
      
      console.log('Upload successful, URL:', downloadURL);
      return downloadURL;
    } catch (error) {
      console.error('Image upload error:', error);
      throw new Error('Failed to upload image: ' + error.message);
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Display name is required');
      return;
    }

    setLoading(true);
    console.log('Starting profile update...');
    
    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        throw new Error('No authenticated user found');
      }

      console.log('Updating Firebase Auth profile...');
      // Update Firebase Auth profile
      await updateProfile(auth.currentUser, {
        displayName: displayName.trim(),
        photoURL: photoURL,
      });

      console.log('Firebase Auth profile updated successfully');

      // Update Firestore user document (optional - create if doesn't exist)
      console.log('Updating Firestore document...');
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: displayName.trim(),
          photoURL: photoURL,
          updatedAt: new Date(),
        });
        console.log('Firestore document updated successfully');
      } catch (firestoreError) {
        console.log('Firestore update failed, but Auth update succeeded:', firestoreError);
        // Don't fail the whole operation if Firestore update fails
      }

      // Update local user state
      const updatedUser = {
        ...user,
        displayName: displayName.trim(),
        photoURL: photoURL,
      };
      
      setUser(updatedUser);
      console.log('Local user state updated');

      Alert.alert('Success', 'Profile updated successfully!', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);

    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', `Failed to update profile: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity 
          onPress={handleSave}
          disabled={loading}
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
        >
          <Text style={[styles.saveButtonText, loading && styles.saveButtonTextDisabled]}>
            {loading ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Profile Photo Section */}
      <View style={styles.photoSection}>
        <ProfileAvatar 
          photoURL={photoURL} 
          displayName={displayName} 
          size={120}
        />
        <TouchableOpacity 
          style={styles.changePhotoButton} 
          onPress={pickImage}
          disabled={loading}
        >
          <Ionicons name="camera" size={16} color="#4e8cff" />
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Form Fields */}
      <View style={styles.formSection}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Display Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Enter your display name"
            maxLength={50}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={email}
            editable={false}
            placeholder="Email cannot be changed"
          />
          <Text style={styles.helpText}>Email cannot be changed</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },

  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#4e8cff',
    borderRadius: 8,
  },

  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },

  saveButtonText: {
    color: '#fff',
    fontWeight: '600',
  },

  saveButtonTextDisabled: {
    color: '#999',
  },

  photoSection: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    marginBottom: 20,
  },

  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#4e8cff',
    backgroundColor: '#f0f6ff',
  },

  changePhotoText: {
    color: '#4e8cff',
    marginLeft: 6,
    fontWeight: '500',
  },

  formSection: {
    backgroundColor: '#fff',
    padding: 20,
  },

  inputGroup: {
    marginBottom: 20,
  },

  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },

  inputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },

  helpText: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },

  avatar: {
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  defaultAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },

  avatarText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
