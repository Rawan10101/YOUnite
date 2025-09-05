import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, arrayUnion, collection, doc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAppContext } from '../../contexts/AppContext';
import { db, storage } from '../../firebaseConfig';

// Import local category images
import educationImg from '../../assets/images/educationCat.jpeg';
import environmentImg from '../../assets/images/environmentCat.jpeg';
import healthcareImg from '../../assets/images/healthcareCat.jpeg';
// import communityImg from '../../assets/images/communityCat.jpeg';

// Local category images mapping
const localCategoryImages = {
  environment: environmentImg,
  education: educationImg,
  healthcare: healthcareImg,
  // community: communityImg,

};

export default function CreateEventScreen({ navigation }) {
  const { user } = useAppContext();
  
  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState(new Date());
  const [time, setTime] = useState(new Date());
  const [maxVolunteers, setMaxVolunteers] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [category, setCategory] = useState('');
  const [requirements, setRequirements] = useState('');
  const [contactEmail, setContactEmail] = useState(user?.email || '');
  const [contactPhone, setContactPhone] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [skills, setSkills] = useState('');
  
  // Chat feature state
  const [withChat, setWithChat] = useState(false);
  
  // Application feature state - ENHANCED
  const [requiresApplication, setRequiresApplication] = useState(false);
  const [applicationQuestions, setApplicationQuestions] = useState(['']);
  const [requiresApproval, setRequiresApproval] = useState(true);
  
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Image Handling
  const [selectedImage, setSelectedImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);

  const categories = [
    { id: 'environment', name: 'Environment', icon: 'leaf', color: '#4CAF50' },
    { id: 'education', name: 'Education', icon: 'book', color: '#2196F3' },
    { id: 'healthcare', name: 'Healthcare', icon: 'medical', color: '#FF4757' },
    { id: 'community', name: 'Community', icon: 'people', color: '#FF9800' },
    { id: 'seniors', name: 'Seniors', icon: 'heart', color: '#9C27B0' },
    { id: 'animals', name: 'Animals', icon: 'paw', color: '#795548' },
    { id: 'food', name: 'Food Security', icon: 'restaurant', color: '#607D8B' },
    { id: 'disaster', name: 'Disaster Relief', icon: 'warning', color: '#F44336' },
    { id: 'technology', name: 'Technology', icon: 'code-slash', color: '#673AB7' },
  ];

  // Image selection function
  const selectImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library permissions to upload an image.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  // Upload image to Firebase Storage
  const uploadImageToFirebase = async (imageUri) => {
    try {
      setImageLoading(true);
      
      // Convert image to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();
      
      // Create unique filename
      const filename = `event-images/${user.uid}/${Date.now()}.jpg`;
      
      // Create storage reference
      const imageRef = ref(storage, filename);
      
      // Upload the blob
      const snapshot = await uploadBytes(imageRef, blob);
      
      // Get download URL
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      console.log('Image uploaded successfully:', downloadURL);
      return downloadURL;
      
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
      throw error;
    } finally {
      setImageLoading(false);
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter an event title');
      return false;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter an event description');
      return false;
    }
    if (!location.trim()) {
      Alert.alert('Error', 'Please enter an event location');
      return false;
    }
    if (!selectedCategory) {
      Alert.alert('Error', 'Please select a category');
      return false;
    }
    if (!maxVolunteers || isNaN(maxVolunteers) || parseInt(maxVolunteers) < 1) {
      Alert.alert('Error', 'Please enter a valid number of volunteers needed');
      return false;
    }
    if (!estimatedHours || isNaN(estimatedHours) || parseInt(estimatedHours) < 1) {
      Alert.alert('Error', 'Please enter estimated hours');
      return false;
    }
    if (!contactEmail.trim()) {
      Alert.alert('Error', 'Please enter a contact email');
      return false;
    }
    
    // Validate application-specific fields
    if (requiresApplication) {
      const validQuestions = applicationQuestions.filter(q => q.trim());
      if (validQuestions.length === 0) {
        Alert.alert('Error', 'Please add at least one application question');
        return false;
      }
    }
    
    // Check if date is in the future
    const eventDateTime = new Date(date);
    eventDateTime.setHours(time.getHours(), time.getMinutes());
    if (eventDateTime <= new Date()) {
      Alert.alert('Error', 'Event date and time must be in the future');
      return false;
    }

    return true;
  };

  // Handle event creation with proper image logic
  const handleCreateEvent = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Combine date and time
      const eventDateTime = new Date(date);
      eventDateTime.setHours(time.getHours(), time.getMinutes());

      // Handle image logic
      let imageUrl = null;
      let hasCustomImage = false;
      let useLocalDefault = true;
      
      if (selectedImage) {
        try {
          // Upload custom image to Firebase Storage
          imageUrl = await uploadImageToFirebase(selectedImage);
          hasCustomImage = true;
          useLocalDefault = false;
          console.log('Custom image uploaded:', imageUrl);
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError);
          // If upload fails, fall back to local default
          hasCustomImage = false;
          useLocalDefault = true;
          Alert.alert(
            'Image Upload Failed', 
            'Your event will be created with a default category image.',
            [{ text: 'Continue', style: 'default' }]
          );
        }
      } else {
        // No custom image selected - use local default
        hasCustomImage = false;
        useLocalDefault = true;
        imageUrl = null; // Don't store anything in Firebase for local images
      }

      const eventData = {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        date: eventDateTime,
        category: selectedCategory,
        maxVolunteers: parseInt(maxVolunteers),
        estimatedHours: parseInt(estimatedHours),
        requirements: requirements.trim(),
        skills: skills.trim().split(',').map(skill => skill.trim()).filter(skill => skill),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        isRecurring,
        participantsCount: 0,  
        
        // Chat feature
        withChat: withChat,
        
        // Application feature - ENHANCED
        requiresApplication: requiresApplication,
        
        // Application-specific fields (only if application is required)
        ...(requiresApplication && {
          applicationQuestions: applicationQuestions.filter(q => q.trim()),
          requiresApproval: requiresApproval,
          applicants: [],
          approvedApplicants: [],
          rejectedApplicants: [],
          pendingApplications: [],
        }),
        
        // Organization data
        organizationId: user.uid,
        organizationName: user.displayName || 'Organization',
        
        // Event status
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        
        // Volunteer tracking - UPDATED for application system
        registeredVolunteers: requiresApplication ? [] : [], // Always start empty
        confirmedVolunteers: [],
        completedVolunteers: [],
        
        // Engagement metrics
        views: 0,
        applications: 0,
        
        // Image data - UPDATED LOGIC
        imageUrl: hasCustomImage ? imageUrl : null, // Only store Firebase URL if custom
        hasCustomImage: hasCustomImage,
        useLocalDefault: useLocalDefault, // Flag to use local image
        tags: skills.trim().split(',').map(skill => skill.trim()).filter(skill => skill),
      };

      console.log('Creating event:', eventData);

      // Add event to events collection
      const eventRef = await addDoc(collection(db, 'events'), eventData);
      console.log('Event created with ID:', eventRef.id);

      // Update organization's events array
      try {
        await updateDoc(doc(db, 'organizations', user.uid), {
          events: arrayUnion(eventRef.id),
          updatedAt: new Date(),
        });
        console.log('Organization events updated');
      } catch (orgError) {
        console.error('Failed to update organization events:', orgError);
      }

      const successMessage = requiresApplication 
        ? 'Your event has been created successfully! Volunteers will need to apply and wait for approval before joining.'
        : `Your event has been created successfully!${withChat ? ' Event chat will be available once volunteers register.' : ''}`;

      Alert.alert(
        'Success!',
        successMessage,
        [
          {
            text: 'View Events',
            onPress: () => {
              navigation.goBack();
              navigation.navigate('Events');
            }
          },
          {
            text: 'Create Another',
            onPress: () => resetForm()
          }
        ]
      );

    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setDate(new Date());
    setTime(new Date());
    setMaxVolunteers('');
    setEstimatedHours('');
    setSelectedCategory('');
    setRequirements('');
    setSkills('');
    setContactPhone('');
    setIsRecurring(false);
    setWithChat(false);
    setRequiresApplication(false);
    setApplicationQuestions(['']);
    setRequiresApproval(true);
    setSelectedImage(null);
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setTime(selectedTime);
    }
  };

  // Application questions functions
  const addApplicationQuestion = () => {
    setApplicationQuestions([...applicationQuestions, '']);
  };

  const updateApplicationQuestion = (index, value) => {
    const updated = [...applicationQuestions];
    updated[index] = value;
    setApplicationQuestions(updated);
  };

  const removeApplicationQuestion = (index) => {
    if (applicationQuestions.length > 1) {
      const updated = applicationQuestions.filter((_, i) => i !== index);
      setApplicationQuestions(updated);
    }
  };

  const renderApplicationSection = () => (
    <View style={styles.applicationSection}>
      <View style={styles.applicationToggleContainer}>
        <View style={styles.applicationToggleInfo}>
          <Text style={styles.applicationToggleLabel}>Require Application</Text>
          <Text style={styles.applicationToggleDescription}>
            Screen volunteers before they can join this event
          </Text>
        </View>
        <Switch
          value={requiresApplication}
          onValueChange={setRequiresApplication}
          trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
          thumbColor={requiresApplication ? '#FFFFFF' : '#9CA3AF'}
        />
      </View>

      {requiresApplication && (
        <View style={styles.applicationDetailsContainer}>
          <Text style={styles.sectionTitle}>Application Questions</Text>
          <Text style={styles.sectionSubtitle}>Create questions to screen volunteers</Text>
          
          {applicationQuestions.map((question, index) => (
            <View key={index} style={styles.questionGroup}>
              <View style={styles.questionHeader}>
                <Text style={styles.questionLabel}>Question {index + 1}</Text>
                {applicationQuestions.length > 1 ? (
                  <TouchableOpacity
                    onPress={() => removeApplicationQuestion(index)}
                    style={styles.removeQuestionButton}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF4757" />
                  </TouchableOpacity>
                ) : null}
              </View>
              <TextInput
                style={styles.questionInput}
                placeholder="Enter your screening question..."
                value={question}
                onChangeText={(value) => updateApplicationQuestion(index, value)}
                multiline
              />
            </View>
          ))}
          
          <TouchableOpacity style={styles.addQuestionButton} onPress={addApplicationQuestion}>
            <Ionicons name="add-circle-outline" size={20} color="#4CAF50" />
            <Text style={styles.addQuestionText}>Add Another Question</Text>
          </TouchableOpacity>

          <View style={styles.approvalToggle}>
            <View style={styles.approvalInfo}>
              <Text style={styles.approvalLabel}>Manual Approval Required</Text>
              <Text style={styles.approvalDescription}>
                Review and approve each application manually
              </Text>
            </View>
            <Switch
              value={requiresApproval}
              onValueChange={setRequiresApproval}
              trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
              thumbColor={requiresApproval ? '#FFFFFF' : '#9CA3AF'}
            />
          </View>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Event</Text>
        </View>

        <View style={styles.form}>
          {/* Basic Event Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Details</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter event title"
                value={title}
                onChangeText={setTitle}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe your event..."
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location *</Text>
              <TextInput
                style={styles.input}
                placeholder="Event location"
                value={location}
                onChangeText={setLocation}
              />
            </View>

            {/* Date and Time */}
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeGroup}>
                <Text style={styles.label}>Date *</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>
                    {date.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dateTimeGroup}>
                <Text style={styles.label}>Time *</Text>
                <TouchableOpacity
                  style={styles.dateTimeButton}
                  onPress={() => setShowTimePicker(true)}
                >
                  <Ionicons name="time-outline" size={20} color="#666" />
                  <Text style={styles.dateTimeText}>
                    {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                onChange={onDateChange}
                minimumDate={new Date()}
              />
            )}

            {showTimePicker && (
              <DateTimePicker
                value={time}
                mode="time"
                display="default"
                onChange={onTimeChange}
              />
            )}
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category *</Text>
            <View style={styles.categoriesGrid}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    styles.categoryCard,
                    selectedCategory === cat.id && styles.categoryCardSelected
                  ]}
                  onPress={() => setSelectedCategory(cat.id)}
                >
                  <View style={[styles.categoryIcon, { backgroundColor: cat.color }]}>
                    <Ionicons name={cat.icon} size={24} color="#fff" />
                  </View>
                  <Text style={styles.categoryName}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Event Requirements */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Requirements</Text>
            
            <View style={styles.inputRow}>
              <View style={styles.inputHalf}>
                <Text style={styles.label}>Max Volunteers *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="50"
                  value={maxVolunteers}
                  onChangeText={setMaxVolunteers}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputHalf}>
                <Text style={styles.label}>Estimated Hours *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="4"
                  value={estimatedHours}
                  onChangeText={setEstimatedHours}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Requirements</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Any specific requirements or qualifications..."
                value={requirements}
                onChangeText={setRequirements}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Skills Needed</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., teamwork, communication, physical fitness"
                value={skills}
                onChangeText={setSkills}
              />
            </View>
          </View>

          {/* Contact Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Email *</Text>
              <TextInput
                style={styles.input}
                placeholder="contact@organization.com"
                value={contactEmail}
                onChangeText={setContactEmail}
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 (555) 123-4567"
                value={contactPhone}
                onChangeText={setContactPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Event Image */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Image</Text>
            <Text style={styles.sectionSubtitle}>
              Add a custom image or use the default category image
            </Text>
            
            <TouchableOpacity style={styles.imageSelector} onPress={selectImage}>
              {selectedImage ? (
                <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="camera-outline" size={32} color="#9CA3AF" />
                  <Text style={styles.imagePlaceholderText}>Tap to select image</Text>
                </View>
              )}
            </TouchableOpacity>
            
            {selectedImage && (
              <TouchableOpacity
                style={styles.removeImageButton}
                onPress={() => setSelectedImage(null)}
              >
                <Text style={styles.removeImageText}>Remove Image</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Application Section - ENHANCED */}
          {renderApplicationSection()}

          {/* Additional Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Additional Features</Text>
            
            <View style={styles.featureToggle}>
              <View style={styles.featureInfo}>
                <Text style={styles.featureLabel}>Enable Event Chat</Text>
                <Text style={styles.featureDescription}>
                  Allow registered volunteers to chat with each other
                </Text>
              </View>
              <Switch
                value={withChat}
                onValueChange={setWithChat}
                trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
                thumbColor={withChat ? '#FFFFFF' : '#9CA3AF'}
              />
            </View>

            <View style={styles.featureToggle}>
              <View style={styles.featureInfo}>
                <Text style={styles.featureLabel}>Recurring Event</Text>
                <Text style={styles.featureDescription}>
                  This event repeats regularly
                </Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: '#E5E7EB', true: '#6366F1' }}
                thumbColor={isRecurring ? '#FFFFFF' : '#9CA3AF'}
              />
            </View>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateEvent}
            disabled={loading || imageLoading}
          >
            {loading || imageLoading ? (
              <Text style={styles.createButtonText}>Creating Event...</Text>
            ) : (
              <Text style={styles.createButtonText}>Create Event</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  form: {
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  inputHalf: {
    flex: 0.48,
  },
  dateTimeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateTimeGroup: {
    flex: 0.48,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  dateTimeText: {
    fontSize: 16,
    color: '#374151',
    marginLeft: 8,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  categoryCardSelected: {
    borderColor: '#6366F1',
    backgroundColor: '#F0F9FF',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  imageSelector: {
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    borderRadius: 12,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  selectedImage: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  imagePlaceholder: {
    alignItems: 'center',
  },
  imagePlaceholderText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 8,
  },
  removeImageButton: {
    marginTop: 12,
    alignItems: 'center',
  },
  removeImageText: {
    fontSize: 14,
    color: '#EF4444',
    fontWeight: '500',
  },
  // Application Section Styles - ENHANCED
  applicationSection: {
    marginBottom: 32,
  },
  applicationToggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  applicationToggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  applicationToggleLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  applicationToggleDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  applicationDetailsContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  questionGroup: {
    marginBottom: 16,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  questionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  removeQuestionButton: {
    padding: 4,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#F9FAFB',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderRadius: 8,
    marginBottom: 20,
  },
  addQuestionText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 8,
  },
  approvalToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  approvalInfo: {
    flex: 1,
    marginRight: 16,
  },
  approvalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  approvalDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  featureToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 16,
  },
  featureInfo: {
    flex: 1,
    marginRight: 16,
  },
  featureLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: '#6B7280',
  },
  createButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  createButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

