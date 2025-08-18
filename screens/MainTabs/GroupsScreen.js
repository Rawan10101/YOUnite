import { Button, StyleSheet, Text, View } from 'react-native';

export default function GroupsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Groups</Text>
      <Text style={styles.subtitle}>Create or join volunteer groups.</Text>
      <Button title="Create Group" onPress={() => alert('Create group flow (TODO)')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems:'center', justifyContent:'center' },
  title: { fontSize: 20, fontWeight:'700' },
  subtitle: { color: '#666', marginBottom: 12 }
});
