import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function EventCard({ event, onPress }) {
  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(event)}>
      <View style={styles.header}>
        <Text style={styles.title}>{event.title}</Text>
        <Text style={styles.ngo}>{event.ngo}</Text>
      </View>
      <View style={styles.meta}>
        <Text>{event.date} · {event.time}</Text>
        <Text>{event.joined}/{event.capacity} joined</Text>
      </View>
      <Text numberOfLines={2} style={styles.desc}>{event.description}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    padding: 12,
    marginVertical: 8,
    marginHorizontal: 12,
    borderRadius: 10,
    elevation: 2
  },
  header: { marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '600' },
  ngo: { color: '#666', fontSize: 12 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  desc: { marginTop: 8, color: '#333' }
});
