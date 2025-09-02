import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, LogBox, StyleSheet, View } from 'react-native';

// Import context from separate file to avoid circular imports
import { AppProvider, useAppContext } from './contexts/AppContext';
import { db } from './firebaseConfig';

// Volunteer Screens
import LoginScreen from './screens/Auth/LoginScreen';
import SignupScreen from './screens/Auth/SignupScreen';
import ChatMainScreen from './screens/MainTabs/ChatScreen/ChatMainScreen';
import DiscoverScreen from './screens/MainTabs/DiscoverScreen/DiscoverScreen';
import EventDetailsScreen from './screens/MainTabs/EventsScreen/EventDetailsScreen';
import EventsScreen from './screens/MainTabs/EventsScreen/EventsScreen';
import ChatScreen from './screens/MainTabs/FeedScreen/ChatScreen';
import CommentsScreen from './screens/MainTabs/FeedScreen/CommentsScreen';
import CreateReportScreen from './screens/MainTabs/FeedScreen/CreateReportScreen';
import FeedScreen from './screens/MainTabs/FeedScreen/FeedScreen';
import OrganizationDetailsScreen from './screens/MainTabs/OrganizationDetailsScreen';
import EditProfileScreen from './screens/MainTabs/ProfileScreen/EditProfileScreen';
import ProfileDetailsScreen from './screens/MainTabs/ProfileScreen/ProfileDetailsScreen';
import ProfileScreen from './screens/MainTabs/ProfileScreen/ProfileScreen';
import SettingsScreen from './screens/MainTabs/ProfileScreen/SettingsScreen';

import VolunteerApplicationsScreen from './screens/org/VolunteerApplicationsScreen';

import CreateEventScreen from './screens/org/CreateEventScreen';
import CreatePostScreen from './screens/org/CreatePostScreen';
import OrganizationDashboard from './screens/org/OrgDashboard';
import OrganizationEvents from './screens/org/OrgEvents';
import VoluntOrgScreen from './screens/org/VoluntOrgScreen';

// NEW: Import Event Participants Screen
import EventParticipantsScreen from './screens/org/EventParticipantsScreen';

// Suppress Firebase Firestore transport warnings
LogBox.ignoreLogs([
  '@firebase/firestore: Firestore',
  'WebChannelConnection RPC',
  'Listen stream',
  'Write stream', 
  'transport errored',
  'Name: undefined Message: undefined'
]);

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Stack Navigator for Login and Signup
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

// Chat Stack Navigator
function ChatStackNavigator() {
  console.log('ChatStackNavigator rendered');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="ChatMain" 
        component={ChatMainScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Chat"
        component={ChatScreen} 
        options={{ headerShown: false }} 
      />
    </Stack.Navigator>
  );
}
// VOLUNTEER STACK SCREENS (existing)
function FeedStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedMain" component={FeedScreen} />
      {/* <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} /> */}
<Stack.Screen 
  name="CreateReport" 
  component={CreateReportScreen}
  options={{ headerShown: false }}/>

      {/* ADD THIS LINE */}
      <Stack.Screen 
        name="Comments" 
        component={CommentsScreen} 
        options={{ headerShown: false }} 
      />
      
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ headerShown: true, title: 'Event Details' }} />
      <Stack.Screen name="OrganizationDetails" component={OrganizationDetailsScreen} options={{ headerShown: true, title: 'Organization' }} />
    </Stack.Navigator>
  );
}

// VOLUNTEER TAB NAVIGATOR (your existing MainTabs)
function VolunteerTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Feed') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Discover') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Events') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Applications') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'ChatList') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2B2B2B',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerShown: false,
      })}
    >
      {<Tab.Screen name="Feed" component={FeedStackScreen} /> }

      <Tab.Screen name="Discover" component={DiscoverStackScreen} />
      
      <Tab.Screen 
        name="ChatList" 
        component={ChatStackNavigator}
        options={{
          title: 'Chats',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles-outline" size={size} color={color} />
          ),
        }}
      />

      <Tab.Screen name="Events" component={EventsStackScreen} />
      
      {/* NEW: Applications Tab for Volunteers */}
      <Tab.Screen 
        name="Applications" 
        component={ApplicationsStackScreen}
        options={{
          title: 'Applications',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text-outline" size={size} color={color} />
          ),
        }}
      />
      
      <Tab.Screen name="Profile" component={ProfileStackScreen} />
    </Tab.Navigator>
  );
}

// ORGANIZATION TAB NAVIGATOR
function OrganizationTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Feed') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'Events') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Volunteers') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Chat') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Volunteer') {
            iconName = focused ? 'people' : 'people-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'business' : 'business-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2B2B2B',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Feed" component={OrganizationDashboardStack} />
      <Tab.Screen name="Events" component={OrganizationEventsStack} />
      <Tab.Screen name="Volunteer" component={VoluntOrgScreen} />
      <Tab.Screen name="Chat" component={ChatStackNavigator} />
      <Tab.Screen name="Profile" component={ProfileStackScreen} />
    </Tab.Navigator>
  );
}

// NEW: Applications Stack for Volunteers
function ApplicationsStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="ApplicationsMain" 
        component={VolunteerApplicationsScreen} 
      />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: true, title: 'Event Details' }}
      />
      <Stack.Screen
        name="OrganizationDetails"
        component={OrganizationDetailsScreen}
        options={{ headerShown: true, title: 'Organization' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// VOLUNTEER STACK SCREENS
function FeedStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedMain" component={FeedScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
      <Stack.Screen 
        name="CreateReport" 
        component={CreateReportScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Comments" 
        component={CommentsScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ headerShown: true, title: 'Event Details' }} />
      <Stack.Screen name="OrganizationDetails" component={OrganizationDetailsScreen} options={{ headerShown: true, title: 'Organization' }} />
    </Stack.Navigator>
  );
}

function DiscoverStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DiscoverMain" component={DiscoverScreen} />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: true, title: 'Event Details' }}
      />
      <Stack.Screen
        name="OrganizationDetails"
        component={OrganizationDetailsScreen}
        options={{ headerShown: true, title: 'Organization' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function EventsStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EventsMain" component={EventsScreen} />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: true, title: 'Event Details' }}
      />
      <Stack.Screen
        name="OrganizationDetails"
        component={OrganizationDetailsScreen}
        options={{ headerShown: true, title: 'Organization' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ProfileDetails" 
        component={ProfileDetailsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: true, title: 'Event Details' }}
      />
      <Stack.Screen
        name="OrganizationDetails"
        component={OrganizationDetailsScreen}
        options={{ headerShown: true, title: 'Organization' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: true, title: 'Settings' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ORGANIZATION STACK SCREENS
function OrganizationDashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain" component={OrganizationDashboard} />
      <Stack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PostDetails"
        component={CreatePostScreen}
        options={{ headerShown: false, title: 'Event Details' }}
      />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: false, title: 'Event Details' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function OrganizationEventsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EventsMain" component={OrganizationEvents} />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: false, title: 'Event Details' }}
      />
      <Stack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ headerShown: false, title: 'Create Event' }}
      />
      {/* NEW: Event Participants Screen */}
      <Stack.Screen 
        name="EventParticipants" 
        component={EventParticipantsScreen}
        options={{ headerShown: false, title: 'Event Participants' }}
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

function VolunteerManagementStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="VolunteersMain" component={DiscoverScreen} />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: true, title: 'Event Details' }}
      />
    </Stack.Navigator>
  );
}

// Main App Content that handles routing based on auth state and user role
function AppContent() {
  const { user, loading } = useAppContext();
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // Fetch user role when user is authenticated
  useEffect(() => {
    const fetchUserRole = async () => {
      if (user) {
        setRoleLoading(true);
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserRole(userData.role);
            console.log('User role detected:', userData.role);
          } else {
            console.log('No user document found, defaulting to volunteer');
            setUserRole('volunteer');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole('volunteer');
        } finally {
          setRoleLoading(false);
        }
      }
    };

    fetchUserRole();
  }, [user]);

  if (loading || roleLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2B2B2B" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        // Route based on user role
        userRole === 'organization' ? (
          <Stack.Screen name="OrganizationTabs" component={OrganizationTabs} />
        ) : (
          <Stack.Screen name="VolunteerTabs" component={VolunteerTabs} />
        )
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
}

// Main App
export default function App() {
  return (
    <AppProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <AppContent />
      </NavigationContainer>
    </AppProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

