// screens/NGODashboardScreen.js
import { StyleSheet, Text, View } from 'react-native';

export default function NGODashboardScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>NGO Dashboard</Text>
      <Text style={styles.description}>Welcome to the NGO Dashboard. Here, you can manage your organization's events, volunteers, and more!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  description: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});
