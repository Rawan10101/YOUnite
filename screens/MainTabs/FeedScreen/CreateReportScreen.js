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
import { useAppContext } from '../../../contexts/AppContext';
import { db, storage } from '../../../firebaseConfig';

export default function CreateReportScreen({ navigation }) {
  const { user, followedOrganizations } = useAppContext();
  const [reportText, setReportText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [mentionedOrganizations, setMentionedOrganizations] = useState([]);
  const [isPublic, setIsPublic] = useState(true); // Public to community or private to organizations
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
      const imageRef = ref(storage, `reports/${user.uid}_${Date.now()}.jpg`);
      await uploadBytes(imageRef, blob);
      return await getDownloadURL(imageRef);
    } catch (error) {
      console.error('Error uploading image:', error);
      throw error;
    }
  };

  const toggleOrganizationMention = (org) => {
    setMentionedOrganizations(prev => {
      const isAlreadyMentioned = prev.find(mentioned => mentioned.id === org.id);
      if (isAlreadyMentioned) {
        return prev.filter(mentioned => mentioned.id !== org.id);
      } else {
        return [...prev, org];
      }
    });
  };

const handleSubmitReport = async () => {
  if (!reportText.trim() && !selectedImage) {
    Alert.alert('Error', 'Please add some content or an image to your report.');
    return;
  }

  if (mentionedOrganizations.length === 0) {
    Alert.alert('Error', 'Please mention at least one organization for your report.');
    return;
  }

  setIsSubmitting(true);
  console.log('Starting report submission...');

  try {
    let imageUrl = null;
    if (selectedImage) {
      console.log('Uploading image...');
      imageUrl = await uploadImage(selectedImage);
      console.log('Image uploaded successfully:', imageUrl);
    }

    // Fixed: Convert all undefined values to null or remove them
    const reportData = {
      text: reportText.trim() || null,
      imageUrl: imageUrl || null,
      reporterId: user.uid,
      reporterName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
      reporterAvatar: user.photoURL || null, // Convert undefined to null
      mentionedOrganizations: mentionedOrganizations.map(org => ({
        id: org.id || null,
        name: org.name || null,
        logo: org.logo || null
      })),
      isPublic: isPublic,
      type: 'report',
      status: 'pending',
      createdAt: serverTimestamp(),
      likes: [],
      comments: [],
      views: [],
    };

    console.log('Report data prepared:', reportData);

    // If public, save to posts collection for community feed
    if (isPublic) {
      console.log('Saving to posts collection...');
      const postData = {
        ...reportData,
        authorId: user.uid,
        authorName: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        authorAvatar: user.photoURL || null, // Convert undefined to null
        authorType: 'user',
      };
      
      await addDoc(collection(db, 'posts'), postData);
      console.log('Post saved successfully');
    }

    // Always save to reports collection for organization managers
    console.log('Saving to reports collection...');
    await addDoc(collection(db, 'reports'), reportData);
    console.log('Report saved successfully');

    Alert.alert(
      'Success', 
      isPublic 
        ? 'Your report has been submitted and posted to the community!' 
        : 'Your report has been sent to the mentioned organizations!',
      [{ text: 'OK', onPress: () => navigation.goBack() }]
    );

  } catch (error) {
    console.error('Error submitting report:', error);
    console.error('Error code:', error?.code);
    console.error('Error message:', error?.message);
    
    let errorMessage = 'Failed to submit report. Please try again.';
    
    if (error?.code === 'permission-denied') {
      errorMessage = 'Permission denied. Please check your account permissions.';
    } else if (error?.code === 'invalid-argument') {
      errorMessage = 'Invalid data format. Please check your input.';
    } else if (error?.message?.includes('invalid data')) {
      errorMessage = 'Some required information is missing. Please check all fields.';
    } else if (error?.message) {
      errorMessage = `Error: ${error.message}`;
    }
    
    Alert.alert('Error', errorMessage);
  } finally {
    setIsSubmitting(false);
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
          <Ionicons name="close" size={28} color="#2B2B2B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Report</Text>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!reportText.trim() && !selectedImage) || mentionedOrganizations.length === 0 
              ? styles.submitButtonDisabled 
              : null
          ]}
          onPress={handleSubmitReport}
          disabled={isSubmitting || (!reportText.trim() && !selectedImage) || mentionedOrganizations.length === 0}
        >
          <Text style={[
            styles.submitButtonText,
            (!reportText.trim() && !selectedImage) || mentionedOrganizations.length === 0 
              ? styles.submitButtonTextDisabled 
              : null
          ]}>
            {isSubmitting ? 'Submitting...' : 'Submit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* User Info */}
        <View style={styles.userInfo}>
          <Image 
            source={{ uri: user?.photoURL || 'https://via.placeholder.com/50' }} 
            style={styles.avatar} 
          />
          <View>
            <Text style={styles.userName}>
              {user?.displayName || user?.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={styles.reportLabel}>Creating a report</Text>
          </View>
        </View>

        {/* Text Input */}
        <TextInput
          style={styles.textInput}
          placeholder="Describe the issue or request you want to report..."
          placeholderTextColor="#999"
          multiline
          value={reportText}
          onChangeText={setReportText}
          maxLength={1000}
        />

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

        {/* Organization Mentions (Required) */}
        <View style={styles.organizationSection}>
          <Text style={styles.sectionTitle}>
            Mention Organizations <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.sectionSubtitle}>
            Select the organizations related to your report
          </Text>
          
          {followedOrganizations && followedOrganizations.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.orgScrollView}>
              {followedOrganizations.map((org) => {
                console.log('Individual org data:', org);
  console.log('Org name specifically:', org.name);
  console.log('Org name type:', typeof org.name);
  
                const isSelected = mentionedOrganizations.find(mentioned => mentioned.id === org.id);
                return (
                  <TouchableOpacity
                    key={org.id}
                    style={[
                      styles.organizationOption,
                      isSelected && styles.organizationOptionSelected
                    ]}
                    onPress={() => toggleOrganizationMention(org)}
                  >
                    <Image source={{ uri: org.logo }} style={styles.orgOptionLogo} />
                    <Text style={styles.organizationOptionText}>{org.name}</Text>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={16} color="#007AFF" style={styles.checkIcon} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.noOrganizationsText}>
              You need to follow organizations to mention them in reports.
            </Text>
          )}
        </View>

        {/* Visibility Settings */}
        <View style={styles.visibilitySection}>
          <Text style={styles.sectionTitle}>Report Visibility</Text>
          
          <TouchableOpacity
            style={[styles.visibilityOption, isPublic && styles.visibilityOptionSelected]}
            onPress={() => setIsPublic(true)}
          >
            <Ionicons 
              name={isPublic ? "radio-button-on" : "radio-button-off"} 
              size={20} 
              color={isPublic ? "#007AFF" : "#999"} 
            />
            <View style={styles.visibilityTextContainer}>
              <Text style={styles.visibilityTitle}>Public to Community</Text>
              <Text style={styles.visibilityDescription}>
                Everyone can see this report in the community feed
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.visibilityOption, !isPublic && styles.visibilityOptionSelected]}
            onPress={() => setIsPublic(false)}
          >
            <Ionicons 
              name={!isPublic ? "radio-button-on" : "radio-button-off"} 
              size={20} 
              color={!isPublic ? "#007AFF" : "#999"} 
            />
            <View style={styles.visibilityTextContainer}>
              <Text style={styles.visibilityTitle}>Private to Organizations</Text>
              <Text style={styles.visibilityDescription}>
                Only mentioned organization managers can see this report
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
          <Ionicons name="image" size={24} color="#007AFF" />
          <Text style={styles.actionText}>Add Photo</Text>
        </TouchableOpacity>
        
        <View style={styles.characterCount}>
          <Text style={styles.characterCountText}>{reportText.length}/1000</Text>
          {mentionedOrganizations.length > 0 && (
            <Text style={styles.mentionedCount}>
              {mentionedOrganizations.length} org{mentionedOrganizations.length !== 1 ? 's' : ''} mentioned
            </Text>
          )}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  submitButtonDisabled: {
    backgroundColor: '#E0E0E0',
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  submitButtonTextDisabled: {
    color: '#999',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: '#F5F5F5',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  reportLabel: {
    fontSize: 12,
    color: '#E33F3F',
    marginTop: 2,
    fontWeight: '500',
  },
  textInput: {
    fontSize: 18,
    color: '#2B2B2B',
    lineHeight: 24,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imageContainer: {
    position: 'relative',
    marginVertical: 16,
  },
  selectedImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  organizationSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 4,
  },
  required: {
    color: '#E33F3F',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  orgScrollView: {
    marginBottom: 8,
  },
  organizationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    backgroundColor: '#FFFFFF',
  },
  organizationOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#2B2B2B',
  },
  organizationOptionText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#2B2B2B',
  },
  orgOptionLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  checkIcon: {
    marginLeft: 4,
  },
  noOrganizationsText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  visibilitySection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  visibilityOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  visibilityOptionSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  visibilityTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  visibilityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 2,
  },
  visibilityDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 18,
  },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  characterCount: {
    alignItems: 'flex-end',
  },
  characterCountText: {
    fontSize: 12,
    color: '#999',
  },
  mentionedCount: {
    fontSize: 12,
    color: '#007AFF',
    marginTop: 2,
  },
});
