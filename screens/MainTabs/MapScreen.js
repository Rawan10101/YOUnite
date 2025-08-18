import { useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import eventsData from '../../data/events';

export default function MapScreen({ navigation }) {
  const [region, setRegion] = useState({
    latitude: 30.0444, longitude: 31.2357,
    latitudeDelta: 0.1, longitudeDelta: 0.1
  });

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={region}>
        {eventsData.map(ev => (
          <Marker
            key={ev.id}
            coordinate={{ latitude: ev.lat, longitude: ev.lng }}
            title={ev.title}
            description={`${ev.date} · ${ev.time}`}
            onCalloutPress={() => navigation.navigate('EventDetails', { event: ev })}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: Dimensions.get('window').width, height: Dimensions.get('window').height }
});
