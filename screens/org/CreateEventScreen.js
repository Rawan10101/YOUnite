// screens/Organization/CreateEventScreen.js
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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { collection, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useAppContext } from '../../contexts/AppContext';
import { db } from '../../firebaseConfig';

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
  
  // UI state
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');

  const categories = [
    { id: 'environment', name: 'Environment', icon: 'leaf', color: '#4CAF50' },
    { id: 'education', name: 'Education', icon: 'book', color: '#2196F3' },
    { id: 'healthcare', name: 'Healthcare', icon: 'medical', color: '#FF4757' },
    { id: 'community', name: 'Community', icon: 'people', color: '#FF9800' },
    { id: 'seniors', name: 'Seniors', icon: 'heart', color: '#9C27B0' },
    { id: 'animals', name: 'Animals', icon: 'paw', color: '#795548' },
    { id: 'food', name: 'Food Security', icon: 'restaurant', color: '#607D8B' },
    { id: 'disaster', name: 'Disaster Relief', icon: 'warning', color: '#F44336' },
  ];

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
    
    // Check if date is in the future
    const eventDateTime = new Date(date);
    eventDateTime.setHours(time.getHours(), time.getMinutes());
    if (eventDateTime <= new Date()) {
      Alert.alert('Error', 'Event date and time must be in the future');
      return false;
    }

    return true;
  };

  const handleCreateEvent = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      // Combine date and time
      const eventDateTime = new Date(date);
      eventDateTime.setHours(time.getHours(), time.getMinutes());

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
        
        // Organization data
        organizationId: user.uid,
        organizationName: user.displayName || 'Organization',
        
        // Event status
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        
        // Volunteer tracking
        registeredVolunteers: [],
        confirmedVolunteers: [],
        completedVolunteers: [],
        
        // Engagement metrics
        views: 0,
        applications: 0,
        
        // Additional fields
        imageUrl: null, // Can be added later
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
        // Continue anyway, main event was created
      }

      Alert.alert(
        'Success!',
        'Your event has been created successfully and is now live for volunteers to see.',
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
            onPress: () => {
              // Reset form
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
            }
          }
        ]
      );

    } catch (error) {
      console.error('Error creating event:', error);
      Alert.alert(
        'Error',
        'Failed to create event. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
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
            {!loading && <Ionicons name="checkmark-circle" size={20} color="#fff" />}
          </TouchableOpacity>

          <View style={styles.bottomPadding} />
        </View>

        {/* Date/Time Pickers */}
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
    color: '#333',
  },
  form: {
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
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
