import { Ionicons } from '@expo/vector-icons';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../../contexts/AppContext';

export default function ProfileDetailsScreen({ navigation }) {
  const { user } = useAppContext();

  const detailItems = [
    {
      id: '1',
      label: 'Email',
      value: user?.email || 'Not provided',
      icon: 'mail-outline',
    },
    {
      id: '2',
      label: 'Member Since',
      value: user?.metadata?.creationTime ? 
        new Date(user.metadata.creationTime).toLocaleDateString('en-US', { 
          weekday: 'long',
          year: 'numeric', 
          month: 'long', 
          day: 'numeric'
        }) : 
        'Recently',
      icon: 'calendar-outline',
    },
    {
      id: '3',
      label: 'Account Type',
      value: 'Volunteer',
      icon: 'heart-outline',
    },

    {
      id: '5',
      label: 'Email Verified',
      value: user?.emailVerified ? 'Verified' : 'Not verified',
      icon: user?.emailVerified ? 'checkmark-circle-outline' : 'alert-circle-outline',
    },
  ];

  const renderDetailItem = (item) => (
    <Animatable.View
      key={item.id}
      animation="fadeInUp"
      duration={600}
      delay={parseInt(item.id) * 50}
      style={styles.detailItem}
    >
      <View style={styles.detailIcon}>
        <Ionicons 
          name={item.icon} 
          size={20} 
          color={item.id === '5' && !user?.emailVerified ? '#FF6B6B' : '#4e8cff'} 
        />
      </View>
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{item.label}</Text>
        <Text style={styles.detailValue}>{item.value}</Text>
      </View>
    </Animatable.View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Profile Details</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info Header */}
        <Animatable.View animation="fadeInDown" duration={800} style={styles.userHeader}>
          <Text style={styles.userName}>
            {user?.displayName || user?.email?.split('@')[0] || 'Volunteer'}
          </Text>
          <Text style={styles.userSubtitle}>Account Information</Text>
        </Animatable.View>

        {/* Details List */}
        <View style={styles.detailsList}>
          {detailItems.map(renderDetailItem)}
        </View>

        {/* Additional Info */}
        <Animatable.View 
          animation="fadeInUp" 
          duration={800} 
          delay={300}
          style={styles.additionalInfo}
        >
          <Text style={styles.infoTitle}>About Your Account</Text>
          <Text style={styles.infoText}>
            Your account information is used to personalize your volunteer experience 
            and connect you with meaningful opportunities in your community.
          </Text>
        </Animatable.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
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

  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },

  placeholder: {
    width: 24,
  },

  content: {
    flex: 1,
  },

  userHeader: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 20,
  },

  userName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginBottom: 5,
  },

  userSubtitle: {
    fontSize: 16,
    color: '#666',
  },

  detailsList: {
    backgroundColor: '#fff',
    marginBottom: 20,
  },

  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  detailContent: {
    flex: 1,
  },

  detailLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
    fontWeight: '500',
  },

  detailValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },

  additionalInfo: {
    backgroundColor: '#fff',
    padding: 20,
    marginBottom: 20,
  },

  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },

  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});
