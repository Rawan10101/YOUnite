import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import { useAppContext } from '../../contexts/AppContext';

export default function SettingsScreen({ navigation }) {
  const { user } = useAppContext();
  
  // Settings state
  const [notifications, setNotifications] = useState({
    eventReminders: true,
    organizationUpdates: true,
    nearbyOpportunities: false,
    weeklyDigest: true,
  });
  
  const [preferences, setPreferences] = useState({
    locationEnabled: true,
    darkMode: false,
    distanceUnit: 'miles', // 'miles' or 'kilometers'
    maxTravelDistance: 25,
  });

  const [privacy, setPrivacy] = useState({
    profileVisible: true,
    showStatistics: true,
    dataSharing: false,
  });

  const handleNotificationChange = (key, value) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  const handlePreferenceChange = (key, value) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const handlePrivacyChange = (key, value) => {
    setPrivacy(prev => ({ ...prev, [key]: value }));
  };

  const showComingSoon = (feature) => {
    Alert.alert('Coming Soon', `${feature} feature will be available in a future update!`);
  };

  const handleChangePassword = () => {
    showComingSoon('Change Password');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: () => showComingSoon('Account Deletion')
        },
      ]
    );
  };

  const renderSettingItem = (title, subtitle, value, onValueChange, icon) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <Ionicons name={icon} size={20} color="#666" />
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingTitle}>{title}</Text>
          {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#ddd', true: '#4e8cff' }}
        thumbColor={value ? '#fff' : '#f4f3f4'}
      />
    </View>
  );

  const renderMenuButton = (title, subtitle, icon, onPress, showChevron = true) => (
    <TouchableOpacity style={styles.menuButton} onPress={onPress}>
      <View style={styles.menuLeft}>
        <Ionicons name={icon} size={20} color="#666" />
        <View style={styles.menuTextContainer}>
          <Text style={styles.menuTitle}>{title}</Text>
          {subtitle && <Text style={styles.menuSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {showChevron && <Ionicons name="chevron-forward" size={20} color="#ccc" />}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 24 }} />
      </View> */}

      {/* Account Settings */}
      <Animatable.View animation="fadeInUp" duration={600} style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        
        {renderMenuButton(
          'Change Password',
          'Update your account password',
          'lock-closed-outline',
          handleChangePassword
        )}
        
        {renderMenuButton(
          'Email Preferences',
          'Manage email notifications',
          'mail-outline',
          () => showComingSoon('Email Preferences')
        )}
        
        {renderMenuButton(
          'Privacy Settings',
          'Control your data and privacy',
          'shield-outline',
          () => showComingSoon('Privacy Settings')
        )}
      </Animatable.View>

      {/* Notification Settings */}
      <Animatable.View animation="fadeInUp" duration={600} delay={100} style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        
        {renderSettingItem(
          'Event Reminders',
          'Get notified about upcoming events',
          notifications.eventReminders,
          (value) => handleNotificationChange('eventReminders', value),
          'notifications-outline'
        )}
        
        {renderSettingItem(
          'Organization Updates',
          'News from organizations you follow',
          notifications.organizationUpdates,
          (value) => handleNotificationChange('organizationUpdates', value),
          'business-outline'
        )}
        
        {renderSettingItem(
          'Nearby Opportunities',
          'New volunteering opportunities near you',
          notifications.nearbyOpportunities,
          (value) => handleNotificationChange('nearbyOpportunities', value),
          'location-outline'
        )}
        
        {renderSettingItem(
          'Weekly Digest',
          'Weekly summary of your activity',
          notifications.weeklyDigest,
          (value) => handleNotificationChange('weeklyDigest', value),
          'calendar-outline'
        )}
      </Animatable.View>

      {/* App Preferences */}
      <Animatable.View animation="fadeInUp" duration={600} delay={200} style={styles.section}>
        <Text style={styles.sectionTitle}>App Preferences</Text>
        
        {renderSettingItem(
          'Location Services',
          'Allow location-based features',
          preferences.locationEnabled,
          (value) => handlePreferenceChange('locationEnabled', value),
          'location-outline'
        )}
        
        {renderSettingItem(
          'Dark Mode',
          'Use dark theme throughout the app',
          preferences.darkMode,
          (value) => handlePreferenceChange('darkMode', value),
          'moon-outline'
        )}
        
        {renderMenuButton(
          'Language',
          'English (US)',
          'language-outline',
          () => showComingSoon('Language Selection')
        )}
        
        {renderMenuButton(
          'Distance Unit',
          preferences.distanceUnit === 'miles' ? 'Miles' : 'Kilometers',
          'resize-outline',
          () => showComingSoon('Distance Unit Selection')
        )}
      </Animatable.View>

      {/* Volunteering Preferences */}
      <Animatable.View animation="fadeInUp" duration={600} delay={300} style={styles.section}>
        <Text style={styles.sectionTitle}>Volunteering Preferences</Text>
        
        {renderMenuButton(
          'Interest Categories',
          'Environmental, Education, Health...',
          'heart-outline',
          () => showComingSoon('Interest Categories')
        )}
        
        {renderMenuButton(
          'Availability Schedule',
          'Set your preferred volunteering times',
          'time-outline',
          () => showComingSoon('Availability Schedule')
        )}
        
        {renderMenuButton(
          'Travel Distance',
          `Maximum ${preferences.maxTravelDistance} ${preferences.distanceUnit}`,
          'car-outline',
          () => showComingSoon('Travel Distance')
        )}
        
        {renderMenuButton(
          'Skills & Experience',
          'Add your skills and experience level',
          'school-outline',
          () => showComingSoon('Skills & Experience')
        )}
      </Animatable.View>

      {/* Privacy & Security */}
      <Animatable.View animation="fadeInUp" duration={600} delay={400} style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy & Security</Text>
        
        {renderSettingItem(
          'Profile Visibility',
          'Make your profile visible to others',
          privacy.profileVisible,
          (value) => handlePrivacyChange('profileVisible', value),
          'eye-outline'
        )}
        
        {renderSettingItem(
          'Show Statistics',
          'Display your volunteering stats publicly',
          privacy.showStatistics,
          (value) => handlePrivacyChange('showStatistics', value),
          'stats-chart-outline'
        )}
        
        {renderMenuButton(
          'Two-Factor Authentication',
          'Add extra security to your account',
          'shield-checkmark-outline',
          () => showComingSoon('Two-Factor Authentication')
        )}
        
        {renderMenuButton(
          'Login Activity',
          'See recent login history',
          'time-outline',
          () => showComingSoon('Login Activity')
        )}
      </Animatable.View>

      {/* Support & Information */}
      <Animatable.View animation="fadeInUp" duration={600} delay={500} style={styles.section}>
        <Text style={styles.sectionTitle}>Support & Information</Text>
        
        {renderMenuButton(
          'Help Center',
          'Get help and find answers',
          'help-circle-outline',
          () => showComingSoon('Help Center')
        )}
        
        {renderMenuButton(
          'Contact Support',
          'Get in touch with our team',
          'chatbubble-outline',
          () => showComingSoon('Contact Support')
        )}
        
        {renderMenuButton(
          'Rate the App',
          'Share your feedback',
          'star-outline',
          () => showComingSoon('Rate the App')
        )}
        
        {renderMenuButton(
          'Terms of Service',
          'Read our terms and conditions',
          'document-text-outline',
          () => showComingSoon('Terms of Service')
        )}
        
        {renderMenuButton(
          'Privacy Policy',
          'How we handle your data',
          'document-outline',
          () => showComingSoon('Privacy Policy')
        )}
      </Animatable.View>

      {/* Danger Zone */}
      <Animatable.View animation="fadeInUp" duration={600} delay={600} style={styles.section}>
        <Text style={[styles.sectionTitle, { color: '#FF4757' }]}>Danger Zone</Text>
        
        <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={20} color="#FF4757" />
          <Text style={styles.dangerButtonText}>Delete Account</Text>
        </TouchableOpacity>
      </Animatable.View>

      {/* App Version */}
      <View style={styles.versionSection}>
        <Text style={styles.versionText}>Version 1.0.0</Text>
        <Text style={styles.versionSubtext}>© 2025 VolunteerConnect</Text>
      </View>

      <View style={styles.bottomPadding} />
    </ScrollView>
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
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#2B2B2B',
    marginTop: 2,
  },
  menuButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  menuSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4757',
    backgroundColor: '#fff',
  },
  dangerButtonText: {
    color: '#FF4757',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  versionSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  versionSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  bottomPadding: {
    height: 20,
  },
});
