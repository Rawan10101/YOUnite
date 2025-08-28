import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Switch,
  Image,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAppContext } from '../../contexts/AppContext';
import { db, storage } from '../../firebaseConfig';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// Import local category images
import environmentImg from '../../assets/images/environmentCat.jpeg';
import educationImg from '../../assets/images/educationCat.jpeg';
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
  
  // Event Type Feature
  const [eventType, setEventType] = useState('normal');
  const [applicationQuestions, setApplicationQuestions] = useState(['']);
  const [requiresApproval, setRequiresApproval] = useState(true);
  const [externalFormUrl, setExternalFormUrl] = useState('');
  
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

  const eventTypes = [
    {
      id: 'normal',
      name: 'Normal Event',
      description: 'Open registration - volunteers join instantly',
      icon: 'people-outline',
      color: '#4CAF50'
    },
    {
      id: 'application',
      name: 'Application Required',
      description: 'Screen volunteers with custom questions',
      icon: 'clipboard-outline',
      color: '#FF9800'
    },
    {
      id: 'external',
      name: 'External Form',
      description: 'Link to Google Forms or other external form',
      icon: 'link-outline',
      color: '#9C27B0'
    }
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
    
    // Validate event type specific fields
    if (eventType === 'external' && !externalFormUrl.trim()) {
      Alert.alert('Error', 'Please enter an external form URL');
      return false;
    }
    
    if (eventType === 'application') {
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
        
        // Event Type Data
        eventType: eventType,
        
        // Application-specific fields
        ...(eventType === 'application' && {
          applicationQuestions: applicationQuestions.filter(q => q.trim()),
          requiresApproval: requiresApproval,
          applicants: [],
          approvedApplicants: [],
          rejectedApplicants: [],
        }),
        
        // External form specific fields
        ...(eventType === 'external' && {
          externalFormUrl: externalFormUrl.trim(),
        }),
        
        // Organization data
        organizationId: user.uid,
        organizationName: user.displayName || 'Organization',
        
        // Event status
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        
        // Volunteer tracking
        registeredVolunteers: eventType === 'normal' ? [] : undefined,
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

      Alert.alert(
        'Success!',
        `Your event has been created successfully!`,
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
    setEventType('normal');
    setApplicationQuestions(['']);
    setRequiresApproval(true);
    setExternalFormUrl('');
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

  const renderEventTypeSelector = () => (
    <View style={styles.eventTypeSection}>
      <Text style={styles.sectionTitle}>Event Type</Text>
      <Text style={styles.sectionSubtitle}>Choose how volunteers will join your event</Text>
      
      {eventTypes.map((type) => (
        <TouchableOpacity
          key={type.id}
          style={[
            styles.eventTypeOption,
            eventType === type.id && styles.eventTypeOptionSelected
          ]}
          onPress={() => setEventType(type.id)}
        >
          <View style={styles.eventTypeLeft}>
            <View style={[styles.eventTypeIcon, { backgroundColor: type.color }]}>
              <Ionicons name={type.icon} size={24} color="#fff" />
            </View>
            <View style={styles.eventTypeContent}>
              <Text style={styles.eventTypeTitle}>{type.name}</Text>
              <Text style={styles.eventTypeDescription}>{type.description}</Text>
            </View>
          </View>
          <View style={styles.radioButton}>
            {eventType === type.id ? (
              <View style={styles.radioButtonSelected} />
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderApplicationSection = () => (
    <View style={styles.applicationSection}>
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
            Review and approve each application individually
          </Text>
        </View>
        <Switch
          value={requiresApproval}
          onValueChange={setRequiresApproval}
          trackColor={{ false: '#ccc', true: '#4CAF50' }}
          thumbColor={requiresApproval ? '#fff' : '#f4f3f4'}
        />
      </View>
    </View>
  );

  const renderExternalFormSection = () => (
    <View style={styles.externalFormSection}>
      <Text style={styles.sectionTitle}>External Form Link</Text>
      <Text style={styles.sectionSubtitle}>
        Provide a link to your Google Form, Typeform, or other external application form
      </Text>
      
      <View style={styles.inputGroup}>
        <Text style={styles.label}>Form URL *</Text>
        <TextInput
          style={styles.input}
          placeholder="https://docs.google.com/forms/d/..."
          value={externalFormUrl}
          onChangeText={setExternalFormUrl}
          keyboardType="url"
          autoCapitalize="none"
        />
      </View>
      
      <View style={styles.externalFormNote}>
        <Ionicons name="information-circle" size={16} color="#FF9800" />
        <Text style={styles.externalFormNoteText}>
          Volunteers will be redirected to your external form. Make sure the link is accessible and working.
        </Text>
      </View>
    </View>
  );

  const renderCategorySelector = () => (
    <View style={styles.categorySection}>
      <Text style={styles.label}>Event Category *</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryItem,
              selectedCategory === cat.id && styles.categoryItemSelected,
              { borderColor: cat.color }
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons 
              name={cat.icon} 
              size={24} 
              color={selectedCategory === cat.id ? '#fff' : cat.color} 
            />
            <Text style={[
              styles.categoryText,
              selectedCategory === cat.id && styles.categoryTextSelected
            ]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Image upload render function
  const renderImageUpload = () => (
    <View style={styles.imageSection}>
      <Text style={styles.label}>Event Image</Text>
      <Text style={styles.imageSubtitle}>
        {selectedImage 
          ? "Custom image selected - will be uploaded to Firebase" 
          : `Default ${categories.find(c => c.id === selectedCategory)?.name || 'category'} image will be used`
        }
      </Text>
      
      {(selectedImage || selectedCategory) ? (
        <View style={styles.imagePreview}>
          <Image 
            source={
              selectedImage 
                ? { uri: selectedImage }
                : (selectedCategory ? localCategoryImages[selectedCategory] : null) ||
                  { uri: 'https://picsum.photos/300/150' }
            } 
            style={styles.previewImage}
            resizeMode="cover"
          />
          {selectedImage ? (
            <TouchableOpacity 
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
              disabled={imageLoading}
            >
              <Ionicons name="close-circle" size={24} color="#FF4757" />
            </TouchableOpacity>
          ) : null}
          {imageLoading ? (
            <View style={styles.imageLoadingOverlay}>
              <Text style={styles.imageLoadingText}>Uploading...</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      
      <TouchableOpacity 
        style={[styles.imageUploadButton, imageLoading && styles.imageUploadButtonDisabled]} 
        onPress={selectImage}
        disabled={imageLoading}
      >
        <Ionicons 
          name={imageLoading ? "cloud-upload" : "cloud-upload-outline"} 
          size={20} 
          color={imageLoading ? "#ccc" : "#4CAF50"} 
        />
        <Text style={[styles.imageUploadText, imageLoading && styles.imageUploadTextDisabled]}>
          {imageLoading ? 'Processing...' : selectedImage ? 'Change Image' : 'Upload Custom Image'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create New Event</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.form}>
          {/* Event Type Selector */}
          {renderEventTypeSelector()}

          {/* Event Title */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Event Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Beach Cleanup Drive"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
          </View>

          {/* Event Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description *</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe your event, what volunteers will do, and why it matters..."
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          {/* Category Selector */}
          {renderCategorySelector()}

          {/* Image Upload Section */}
          {renderImageUpload()}

          {/* Location */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Location *</Text>
            <TextInput
              style={styles.input}
              placeholder="Full address or landmark"
              value={location}
              onChangeText={setLocation}
            />
          </View>

          {/* Date and Time */}
          <View style={styles.dateTimeRow}>
            <View style={[styles.inputGroup, styles.dateTimeItem]}>
              <Text style={styles.label}>Date *</Text>
              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#666" />
                <Text style={styles.dateTimeButtonText}>
                  {date.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.inputGroup, styles.dateTimeItem]}>
              <Text style={styles.label}>Time *</Text>
              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#666" />
                <Text style={styles.dateTimeButtonText}>
                  {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Number Fields Row */}
          <View style={styles.numberRow}>
            <View style={[styles.inputGroup, styles.numberItem]}>
              <Text style={styles.label}>Volunteers Needed *</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                value={maxVolunteers}
                onChangeText={setMaxVolunteers}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>

            <View style={[styles.inputGroup, styles.numberItem]}>
              <Text style={styles.label}>Estimated Hours *</Text>
              <TextInput
                style={styles.input}
                placeholder="4"
                value={estimatedHours}
                onChangeText={setEstimatedHours}
                keyboardType="number-pad"
                maxLength={2}
              />
            </View>
          </View>

          {/* Conditional Sections Based on Event Type */}
          {eventType === 'application' ? renderApplicationSection() : null}
          {eventType === 'external' ? renderExternalFormSection() : null}

          {/* Requirements */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Requirements</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Any specific requirements, age restrictions, physical demands, etc."
              value={requirements}
              onChangeText={setRequirements}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Skills */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Skills Needed</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., teamwork, physical fitness, communication (comma-separated)"
              value={skills}
              onChangeText={setSkills}
            />
          </View>

          {/* Contact Information */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Email *</Text>
            <TextInput
              style={styles.input}
              placeholder="contact@organization.com"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
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

          {/* Recurring Event Toggle */}
          <View style={styles.toggleGroup}>
            <View style={styles.toggleInfo}>
              <Text style={styles.label}>Recurring Event</Text>
              <Text style={styles.toggleDescription}>
                This event happens regularly (weekly/monthly)
              </Text>
            </View>
            <Switch
              value={isRecurring}
              onValueChange={setIsRecurring}
              trackColor={{ false: '#ccc', true: '#4CAF50' }}
              thumbColor={isRecurring ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createButton, loading && styles.createButtonDisabled]}
            onPress={handleCreateEvent}
            disabled={loading}
          >
            <Text style={styles.createButtonText}>
              {loading ? 'Creating Event...' : 'Create Event'}
            </Text>
            {!loading ? <Ionicons name="checkmark-circle" size={20} color="#fff" /> : null}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </View>

        {/* Date/Time Pickers */}
        {showDatePicker ? (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        ) : null}

        {showTimePicker ? (
          <DateTimePicker
            value={time}
            mode="time"
            display="default"
            onChange={onTimeChange}
          />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#2b2b2b',
  },
  form: {
    padding: 20,
  },
  
  // Image Section Styles
  imageSection: {
    marginBottom: 20,
  },
  imageSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  imagePreview: {
    position: 'relative',
    marginBottom: 12,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  imageUploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    backgroundColor: '#f8fff8',
  },
  imageUploadText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 8,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  imageLoadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  imageUploadButtonDisabled: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ccc',
  },
  imageUploadTextDisabled: {
    color: '#ccc',
  },

  // Event Type Styles
  eventTypeSection: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  eventTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginBottom: 8,
    borderRadius: 8,
  },
  eventTypeOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  eventTypeLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  eventTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventTypeContent: {
    flex: 1,
  },
  eventTypeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 2,
  },
  eventTypeDescription: {
    fontSize: 14,
    color: '#2B2B2B',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#4CAF50',
  },

  // Application Section Styles
  applicationSection: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
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
    fontWeight: '600',
    color: '#2B2B2B',
  },
  removeQuestionButton: {
    padding: 4,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: '#f8f9fa',
    minHeight: 40,
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    borderStyle: 'dashed',
    marginBottom: 16,
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
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  approvalInfo: {
    flex: 1,
    marginRight: 16,
  },
  approvalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  approvalDescription: {
    fontSize: 12,
    color: '#2b2b2b',
    marginTop: 2,
  },

  // External Form Section Styles
  externalFormSection: {
    marginBottom: 24,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  externalFormNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF8E1',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  externalFormNoteText: {
    fontSize: 12,
    color: '#F57C00',
    marginLeft: 8,
    flex: 1,
    lineHeight: 16,
  },

  // Form Styles
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
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryScroll: {
    marginTop: 5,
  },
  categoryItem: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 2,
    backgroundColor: '#fff',
    minWidth: 80,
  },
  categoryItemSelected: {
    backgroundColor: '#2B2B2B',
    borderColor: '#4CAF50',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    textAlign: 'center',
  },
  categoryTextSelected: {
    color: '#fff',
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dateTimeItem: {
    flex: 1,
    marginRight: 10,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  dateTimeButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  numberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  numberItem: {
    flex: 1,
    marginRight: 10,
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 10,
  },
  toggleGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 30,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  createButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 10,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  bottomPadding: {
    height: 20,
  },
});
