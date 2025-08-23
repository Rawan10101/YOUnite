import { signInWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { auth } from '../../firebaseConfig';
import { useAppContext } from '../../contexts/AppContext'; // Add this import

export default function LoginScreen({ navigation }) {
  const { setUser } = useAppContext(); // Add this hook
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [shakeAnimation] = useState(new Animated.Value(0));

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = userCredential.user; // Get the user data from Firebase
      
      // Use state management instead of manual navigation
      setUser(userData); // This automatically switches to MainTabs due to conditional rendering
      
      // navigation.replace('MainTabs');
      
    } catch (err) {
      setError(err.message);
      shakeError(); // Trigger shake animation on error
    } finally {
      setLoading(false);
    }
  };

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 100, useNativeDriver: true })
    ]).start();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Login</Text>

      {error ? (
        <Animated.View style={{ transform: [{ translateX: shakeAnimation }] }}>
          <Text style={styles.error}>{error}</Text>
        </Animated.View>
      ) : null}

      <Animatable.View animation="fadeInUp" duration={600}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
      </Animatable.View>

      <Animatable.View animation="fadeInUp" duration={600} delay={100}>
        <TextInput
          style={styles.input}
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
      </Animatable.View>

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
      </TouchableOpacity>

      <Text
        style={styles.link}
        onPress={() => navigation.navigate('Signup')}
      >
        Don't have an account? Sign Up
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: 'bold', marginBottom: 20, alignSelf: 'center' },
  input: { height: 50, borderColor: '#ccc', borderWidth: 1, borderRadius: 8, marginBottom: 15, paddingHorizontal: 15 },
  error: { color: 'red', marginBottom: 15, textAlign: 'center' },
  button: {
    backgroundColor: '#4e8cff',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  link: { color: '#4e8cff', marginTop: 20, textAlign: 'center' },
});
