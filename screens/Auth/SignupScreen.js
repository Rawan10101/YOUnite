import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  SafeAreaView,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { auth, db } from '../../firebaseConfig';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOrganization, setIsOrganization] = useState(false);

  // Location Picker state
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [initialRegion, setInitialRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        const location = await Location.getCurrentPositionAsync({});
        setInitialRegion({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } else {
        setLocationPermissionGranted(false);
      }
    })();
  }, []);

  const validate = () => {
    if (!email || !username || !password || !confirmPassword) {
      setError('Please fill all fields.');
      return false;
    }
    if (!isOrganization && !selectedLocation) {
      setError('Please select your location.');
      return false;
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email.');
      return false;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSignup = async () => {
    if (!validate()) return;

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: username });

      const userData = {
        uid: user.uid,
        email: email.toLowerCase(),
        displayName: username,
        role: isOrganization ? 'organization' : 'volunteer',
        status: isOrganization ? 'pending' : 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        profile: {
          name: username,
          email: email.toLowerCase(),
          avatar: null,
          phone: null,
          location: isOrganization
            ? null
            : {
                latitude: selectedLocation.latitude,
                longitude: selectedLocation.longitude,
                address: selectedLocation.address || '',
              },
        },
      };

      if (isOrganization) {
        userData.organizationData = {
          organizationName: username,
          type: null,
          description: null,
          website: null,
          focusAreas: [],
          verified: false,
          verificationDocuments: [],
          address: null,
          taxId: null,
        };
      } else {
        userData.volunteerData = {
          interests: [],
          skills: [],
          experience: 'beginner',
          availability: {},
          totalHours: 0,
          eventsAttended: 0,
          badges: [],
          location: userData.profile.location,
        };
      }

      await setDoc(doc(db, 'users', user.uid), userData);

      if (isOrganization) {
        await setDoc(doc(db, 'organizations', user.uid), {
          uid: user.uid,
          name: username,
          email: email.toLowerCase(),
          type: null,
          description: null,
          focusAreas: [],
          verified: false,
          status: 'pending',
          createdAt: new Date(),
          events: [],
          followers: [],
          totalVolunteers: 0,
        });
      } else {
        await setDoc(doc(db, 'volunteers', user.uid), {
          uid: user.uid,
          name: username,
          email: email.toLowerCase(),
          interests: [],
          skills: [],
          experience: 'beginner',
          location: userData.profile.location,
          availability: {},
          registeredEvents: [],
          followedOrganizations: [],
          completedEvents: [],
          totalHours: 0,
          badges: [],
          createdAt: new Date(),
        });
      }

      const successMessage = isOrganization
        ? 'Organization account created successfully! Your account is pending verification.'
        : 'Volunteer account created successfully!';

      Alert.alert('Success!', successMessage, [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (err) {
      console.error('Signup error:', err);
      let errorMessage = 'An error occurred during signup.';
      switch (err.code) {
        case 'auth/email-already-in-use':
          errorMessage = 'This email is already registered.';
          break;
        case 'auth/weak-password':
          errorMessage = 'Password is too weak.';
          break;
        case 'auth/invalid-email':
          errorMessage = 'Invalid email address.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
        default:
          errorMessage = `Signup failed: ${err.message}`;
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Account</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Full Name"
        autoCapitalize="words"
        value={username}
        onChangeText={setUsername}
        editable={!loading}
      />

      {!isOrganization && (
        <>
          <TouchableOpacity
            style={styles.locationPickerButton}
            onPress={() => setLocationModalVisible(true)}
            disabled={loading}
          >
            <Text style={{ color: selectedLocation ? '#000' : '#999' }}>
              {selectedLocation ? selectedLocation.address || 'Location selected' : 'Set your location'}
            </Text>
            <Ionicons name="map" size={20} color="#4e8cff" />
          </TouchableOpacity>

          <Modal
            visible={locationModalVisible}
            animationType="slide"
            onRequestClose={() => setLocationModalVisible(false)}
          >
            <SafeAreaView style={{ flex: 1 }}>
              <MapView
                style={{ flex: 1 }}
                initialRegion={initialRegion}
                onPress={e => {
                  const { latitude, longitude } = e.nativeEvent.coordinate;
                  setSelectedLocation({ latitude, longitude, address: '' });
                }}
                showsUserLocation
                showsMyLocationButton
              >
                {selectedLocation && (
                  <Marker coordinate={{ latitude: selectedLocation.latitude, longitude: selectedLocation.longitude }} />
                )}
              </MapView>
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  onPress={() => setLocationModalVisible(false)}
                  style={styles.modalButton}
                >
                  <Text>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setLocationModalVisible(false)}
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  disabled={!selectedLocation}
                >
                  <Text style={{ color: 'white' }}>Confirm Location</Text>
                </TouchableOpacity>
              </View>
            </SafeAreaView>
          </Modal>
        </>
      )}

      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        editable={!loading}
      />

      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        editable={!loading}
      />

      <View style={styles.userTypeSection}>
        <Text style={styles.sectionTitle}>Account Type</Text>

        <TouchableOpacity
          style={[
            styles.userTypeButton,
            !isOrganization && styles.userTypeButtonActive,
          ]}
          onPress={() => setIsOrganization(false)}
          disabled={loading}
        >
          <Ionicons
            name="person-outline"
            size={20}
            color={!isOrganization ? '#4e8cff' : '#666'}
          />
          <View style={styles.userTypeContent}>
            <Text
              style={[
                styles.userTypeTitle,
                !isOrganization && styles.userTypeTextActive,
              ]}
            >
              I'm a Volunteer
            </Text>
            <Text style={styles.userTypeDescription}>
              Find and join volunteering opportunities
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.userTypeButton,
            isOrganization && styles.userTypeButtonActive,
          ]}
          onPress={() => setIsOrganization(true)}
          disabled={loading}
        >
          <Ionicons
            name="business-outline"
            size={20}
            color={isOrganization ? '#4e8cff' : '#666'}
          />
          <View style={styles.userTypeContent}>
            <Text
              style={[
                styles.userTypeTitle,
                isOrganization && styles.userTypeTextActive,
              ]}
            >
              I'm an Organization
            </Text>
            <Text style={styles.userTypeDescription}>
              Post events and manage volunteers
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignup}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.buttonText}>
            Create {isOrganization ? 'Organization' : 'Volunteer'} Account
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        disabled={loading}
      >
        <Text style={[styles.link, loading && styles.linkDisabled]}>
          Already have an account? Sign in
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = {
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 30,
    alignSelf: 'center',
    color: '#333',
  },
  input: {
    height: 50,
    borderColor: '#ddd',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: '#f8f9fa',
  },
  locationPickerButton: {
    flexDirection: 'row',
    borderColor: '#ddd',
    borderWidth: 1,
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
  },
  button: {
    backgroundColor: '#4e8cff',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 20,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  link: {
    color: '#4e8cff',
    textAlign: 'center',
    fontSize: 16,
  },
  linkDisabled: {
    color: '#ccc',
  },
  error: {
    color: '#FF4757',
    marginBottom: 15,
    textAlign: 'center',
    backgroundColor: '#ffebee',
    padding: 10,
    borderRadius: 8,
  },
  userTypeSection: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 15,
  },
  userTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  userTypeButtonActive: {
    borderColor: '#4e8cff',
    backgroundColor: '#f0f7ff',
  },
  userTypeContent: {
    marginLeft: 12,
    flex: 1,
  },
  userTypeTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  userTypeTextActive: {
    color: '#4e8cff',
    fontWeight: '600',
  },
  userTypeDescription: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#ccc',
  },
  modalButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#eee',
  },
  modalButtonConfirm: {
    backgroundColor: '#4e8cff',
  },
};
