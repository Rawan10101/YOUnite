import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContext } from '../../../contexts/AppContext';
import { db } from '../../../firebaseConfig';
export default function EditEventScreen({ route, navigation }) {
  const { eventId } = route.params;
  const { user } = useAppContext();
  
  // Form state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [event, setEvent] = useState(null);
  
  // Event details
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('community');
  const [date, setDate] = useState(new Date());
  const [location, setLocation] = useState('');
  const [maxVolunteers, setMaxVolunteers] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [requirements, setRequirements] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [skills, setSkills] = useState('');
  
  // Feature toggles
  const [withChat, setWithChat] = useState(false);
  const [requiresApplication, setRequiresApplication] = useState(false);
  const [applicationQuestions, setApplicationQuestions] = useState(['']);
  
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const categories = [
    { id: 'environment', title: 'Environment', icon: 'leaf-outline' },
    { id: 'education', title: 'Education', icon: 'school-outline' },
    { id: 'healthcare', title: 'Healthcare', icon: 'medical-outline' },
    { id: 'animals', title: 'Animals', icon: 'paw-outline' },
    { id: 'community', title: 'Community', icon: 'people-outline' },
    { id: 'emergency', title: 'Emergency', icon: 'alert-circle-outline' },
    { id: 'seniors', title: 'Seniors', icon: 'heart-outline' },
    { id: 'food', title: 'Food & Hunger', icon: 'restaurant-outline' },
  ];

  // Load event data
  useEffect(() => {
    loadEventData();
  }, [eventId]);

  const loadEventData = async () => {
    try {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        const eventData = eventDoc.data();
        
        // Check if user owns this event
        if (eventData.organizationId !== user?.uid) {
          Alert.alert('Access Denied', 'You can only edit your own events.');
          navigation.goBack();
          return;
        }

        setEvent(eventData);
        
        // Populate form fields
        setTitle(eventData.title || '');
        setDescription(eventData.description || '');
        setCategory(eventData.category || 'community');
        setDate(eventData.date?.toDate ? eventData.date.toDate() : new Date(eventData.date || Date.now()));
        setLocation(eventData.location || '');
        setMaxVolunteers(String(eventData.maxVolunteers || ''));
        setEstimatedHours(String(eventData.estimatedHours || ''));
        setRequirements(eventData.requirements || '');
        setContactEmail(eventData.contactEmail || '');
        setContactPhone(eventData.contactPhone || '');
        setIsRecurring(eventData.isRecurring || false);
        setSkills(eventData.skills || '');
        setWithChat(eventData.withChat || false);
        setRequiresApplication(eventData.requiresApplication || false);
        setApplicationQuestions(eventData.applicationQuestions?.length > 0 ? eventData.applicationQuestions : ['']);
        
      } else {
        Alert.alert('Error', 'Event not found.');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Error loading event:', error);
      Alert.alert('Error', 'Failed to load event data.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async () => {
    // Validation
    if (!title.trim()) {
      Alert.alert('Validation Error', 'Please enter an event title.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Validation Error', 'Please enter an event description.');
      return;
    }
    if (!location.trim()) {
      Alert.alert('Validation Error', 'Please enter an event location.');
      return;
    }
    if (!contactEmail.trim()) {
      Alert.alert('Validation Error', 'Please enter a contact email.');
      return;
    }

    // Validate application questions if required
    if (requiresApplication) {
      const validQuestions = applicationQuestions.filter(q => q.trim().length > 0);
      if (validQuestions.length === 0) {
        Alert.alert('Validation Error', 'Please add at least one application question or disable the application requirement.');
        return;
      }
    }

    setSaving(true);
    try {
      const eventRef = doc(db, 'events', eventId);
      
      const updateData = {
        title: title.trim(),
        description: description.trim(),
        category,
        date,
        location: location.trim(),
        maxVolunteers: parseInt(maxVolunteers) || 50,
        estimatedHours: parseInt(estimatedHours) || 2,
        requirements: requirements.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        isRecurring,
        skills: skills.trim(),
        withChat,
        requiresApplication,
        applicationQuestions: requiresApplication ? 
          applicationQuestions.filter(q => q.trim().length > 0) : [],
        updatedAt: serverTimestamp(),
      };

      await updateDoc(eventRef, updateData);
      
      Alert.alert(
        'Success',
        'Event updated successfully!',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      
    } catch (error) {
      console.error('Error updating event:', error);
      Alert.alert('Error', 'Failed to update event. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const newDate = new Date(date);
      newDate.setFullYear(selectedDate.getFullYear());
      newDate.setMonth(selectedDate.getMonth());
      newDate.setDate(selectedDate.getDate());
      setDate(newDate);
    }
  };

  const handleTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      const newDate = new Date(date);
      newDate.setHours(selectedTime.getHours());
      newDate.setMinutes(selectedTime.getMinutes());
      setDate(newDate);
    }
  };

  const addApplicationQuestion = () => {
    if (applicationQuestions.length < 5) {
      setApplicationQuestions([...applicationQuestions, '']);
    } else {
      Alert.alert('Limit Reached', 'You can add up to 5 application questions.');
    }
  };

  const removeApplicationQuestion = (index) => {
    if (applicationQuestions.length > 1) {
      const newQuestions = applicationQuestions.filter((_, i) => i !== index);
      setApplicationQuestions(newQuestions);
    }
  };

  const updateApplicationQuestion = (index, text) => {
    const newQuestions = [...applicationQuestions];
    newQuestions[index] = text;
    setApplicationQuestions(newQuestions);
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading event...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Event</Text>
          <TouchableOpacity 
            onPress={handleSaveEvent}
            disabled={saving}
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#4CAF50" />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Event Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Enter event title"
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your event..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categoriesContainer}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryChip,
                        category === cat.id && styles.categoryChipSelected
                      ]}
                      onPress={() => setCategory(cat.id)}
                    >
                      <Ionicons 
                        name={cat.icon} 
                        size={16} 
                        color={category === cat.id ? '#FFFFFF' : '#666'} 
                      />
                      <Text style={[
                        styles.categoryChipText,
                        category === cat.id && styles.categoryChipTextSelected
                      ]}>
                        {cat.title}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Date and Time */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date & Time</Text>
            
            <View style={styles.dateTimeRow}>
              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar-outline" size={20} color="#4CAF50" />
                <View style={styles.dateTimeInfo}>
                  <Text style={styles.dateTimeLabel}>Date</Text>
                  <Text style={styles.dateTimeValue}>{formatDate(date)}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.dateTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="time-outline" size={20} color="#4CAF50" />
                <View style={styles.dateTimeInfo}>
                  <Text style={styles.dateTimeLabel}>Time</Text>
                  <Text style={styles.dateTimeValue}>{formatTime(date)}</Text>
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Recurring Event</Text>
                <Text style={styles.switchDescription}>This event repeats regularly</Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: '#E0E0E0', true: '#C8E6C9' }}
                thumbColor={isRecurring ? '#4CAF50' : '#FFFFFF'}
              />
            </View>
          </View>

          {/* Location and Capacity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location & Capacity</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location *</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Enter event location"
                maxLength={200}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Max Volunteers</Text>
                <TextInput
                  style={styles.input}
                  value={maxVolunteers}
                  onChangeText={setMaxVolunteers}
                  placeholder="50"
                  keyboardType="numeric"
                  maxLength={3}
                />
              </View>

              <View style={[styles.inputGroup, styles.halfWidth]}>
                <Text style={styles.label}>Estimated Hours</Text>
                <TextInput
                  style={styles.input}
                  value={estimatedHours}
                  onChangeText={setEstimatedHours}
                  placeholder="2"
                  keyboardType="numeric"
                  maxLength={2}
                />
              </View>
            </View>
          </View>

          {/* Requirements and Skills */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Requirements & Skills</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Requirements</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={requirements}
                onChangeText={setRequirements}
                placeholder="Any specific requirements for volunteers..."
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={300}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Skills Needed</Text>
              <TextInput
                style={styles.input}
                value={skills}
                onChangeText={setSkills}
                placeholder="e.g., First Aid, Teaching, Manual Labor"
                maxLength={200}
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
                value={contactEmail}
                onChangeText={setContactEmail}
                placeholder="contact@organization.com"
                keyboardType="email-address"
                autoCapitalize="none"
                maxLength={100}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={contactPhone}
                onChangeText={setContactPhone}
                placeholder="+1 (555) 123-4567"
                keyboardType="phone-pad"
                maxLength={20}
              />
            </View>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Event Features</Text>
            
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Enable Chat</Text>
                <Text style={styles.switchDescription}>Allow participants to chat</Text>
              </View>
              <Switch
                value={withChat}
                onValueChange={setWithChat}
                trackColor={{ false: '#E0E0E0', true: '#C8E6C9' }}
                thumbColor={withChat ? '#4CAF50' : '#FFFFFF'}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchLabel}>Require Application</Text>
                <Text style={styles.switchDescription}>Volunteers must apply and be approved</Text>
              </View>
              <Switch
                value={requiresApplication}
                onValueChange={setRequiresApplication}
                trackColor={{ false: '#E0E0E0', true: '#C8E6C9' }}
                thumbColor={requiresApplication ? '#4CAF50' : '#FFFFFF'}
              />
            </View>

            {/* Application Questions */}
            {requiresApplication && (
              <View style={styles.applicationSection}>
                <View style={styles.applicationHeader}>
                  <Text style={styles.applicationTitle}>Application Questions</Text>
                  <TouchableOpacity 
                    style={styles.addQuestionButton}
                    onPress={addApplicationQuestion}
                  >
                    <Ionicons name="add" size={20} color="#4CAF50" />
                    <Text style={styles.addQuestionText}>Add Question</Text>
                  </TouchableOpacity>
                </View>

                {applicationQuestions.map((question, index) => (
                  <View key={index} style={styles.questionContainer}>
                    <View style={styles.questionHeader}>
                      <Text style={styles.questionNumber}>Question {index + 1}</Text>
                      {applicationQuestions.length > 1 && (
                        <TouchableOpacity 
                          onPress={() => removeApplicationQuestion(index)}
                          style={styles.removeQuestionButton}
                        >
                          <Ionicons name="trash-outline" size={16} color="#F44336" />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TextInput
                      style={styles.questionInput}
                      value={question}
                      onChangeText={(text) => updateApplicationQuestion(index, text)}
                      placeholder="Enter your question..."
                      multiline
                      maxLength={200}
                    />
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacing} />
        </ScrollView>

        {/* Date/Time Pickers */}
        {showDatePicker && (
          <DateTimePicker
            value={date}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}

        {showTimePicker && (
          <DateTimePicker
            value={date}
            mode="time"
            display="default"
            onChange={handleTimeChange}
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#E8F5E8',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#4CAF50',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#FAFAFA',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  categoriesContainer: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    marginRight: 8,
  },
  categoryChipSelected: {
    backgroundColor: '#4CAF50',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#666',
    marginLeft: 4,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  dateTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  dateTimeButton: {
    flex: 0.48,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dateTimeInfo: {
    marginLeft: 12,
    flex: 1,
  },
  dateTimeLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  dateTimeValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchInfo: {
    flex: 1,
    marginRight: 16,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 14,
    color: '#666',
  },
  applicationSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  applicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  applicationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  addQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E8F5E8',
  },
  addQuestionText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  questionContainer: {
    marginBottom: 12,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  removeQuestionButton: {
    padding: 4,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#FFFFFF',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  bottomSpacing: {
    height: 40,
  },
});

