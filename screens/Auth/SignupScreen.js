import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
    ActivityIndicator, // ✅ Make sure this is imported
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { auth, db } from '../../firebaseConfig';

export default function SignupScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isOrganization, setIsOrganization] = useState(false);

  const validate = () => {
    if (!email || !username || !password || !confirmPassword) {
      setError('Please fill all fields.');
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
      // Create user account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Update user profile with display name
      await updateProfile(user, { displayName: username });

      // Prepare user data for Firestore
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
          location: null,
        }
      };

      // Add role-specific data
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
        };
      }

      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), userData);

      // Create additional role-specific collections
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
          location: null,
          availability: {},
          registeredEvents: [],
          followedOrganizations: [],
          completedEvents: [],
          totalHours: 0,
          badges: [],
          createdAt: new Date(),
        });
      }

      // Show success message and navigate
      const successMessage = isOrganization 
        ? 'Organization account created successfully! Your account is pending verification.'
        : 'Volunteer account created successfully!';
      
      Alert.alert('Success!', successMessage, [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Login')
        }
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

      {/* User Type Selection */}
      <View style={styles.userTypeSection}>
        <Text style={styles.sectionTitle}>Account Type</Text>
        
        <TouchableOpacity
          style={[
            styles.userTypeButton,
            !isOrganization && styles.userTypeButtonActive
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
            <Text style={[
              styles.userTypeTitle,
              !isOrganization && styles.userTypeTextActive
            ]}>
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
            isOrganization && styles.userTypeButtonActive
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
            <Text style={[
              styles.userTypeTitle,
              isOrganization && styles.userTypeTextActive
            ]}>
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

const styles = StyleSheet.create({
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
    borderWidth: 2,
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
});
