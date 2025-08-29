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
import DiscoverScreen from './screens/MainTabs/DiscoverScreen/DiscoverScreen';
import EventDetailsScreen from './screens/MainTabs/EventsScreen/EventDetailsScreen';
import EventsScreen from './screens/MainTabs/EventsScreen/EventsScreen';
import ChatScreen from './screens/MainTabs/FeedScreen/ChatScreen';
import CommentsScreen from './screens/MainTabs/FeedScreen/CommentsScreen';
import CreateReportScreen from './screens/MainTabs/FeedScreen/CreateReportScreen'; // Fixed import
import FeedScreen from './screens/MainTabs/FeedScreen/FeedScreen';
import OrganizationDetailsScreen from './screens/MainTabs/OrganizationDetailsScreen';
import EditProfileScreen from './screens/MainTabs/ProfileScreen/EditProfileScreen';
import ProfileDetailsScreen from './screens/MainTabs/ProfileScreen/ProfileDetailsScreen';
import ProfileScreen from './screens/MainTabs/ProfileScreen/ProfileScreen';
import SettingsScreen from './screens/MainTabs/ProfileScreen/SettingsScreen';
import ChatMainScreen from './screens/MainTabs/ChatScreen/ChatMainScreen'
import AnalyOrgScreen from './screens/org/AnalyOrgScreen';
// Organization Screens
import CreateEventScreen from './screens/org/CreateEventScreen';
import CreatePostScreen from './screens/org/CreatePostScreen';
import OrganizationDashboard from './screens/org/OrgDashboard';
import OrganizationEvents from './screens/org/OrgEvents';
import VoluntOrgScreen from './screens/org/VoluntOrgScreen';
// Add this import to App.js

// Note: Create these screens when needed:
// import CreateEventScreen from './screens/Organization/CreateEventScreen';
// import EditEventScreen from './screens/Organization/EditEventScreen';
// import EventAnalyticsScreen from './screens/Organization/EventAnalyticsScreen';
// import VolunteerManagement from './screens/Organization/VolunteerManagement';

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

// VOLUNTEER TAB NAVIGATOR (your existing MainTabs)
function ChatStackNavigator() {
  console.log('ChatStackNavigator rendered'); // Add this debug log
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="ChatMain" 
        component={ChatMainScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Chat"  // This is the correct screen name to navigate to
        component={ChatScreen} 
        options={{ headerShown: false }} 
      />
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
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'ChatList') {  // Add this condition
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
      {/* <Tab.Screen name="Feed" component={FeedStackScreen} /> */}
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

          if (route.name === 'Dashboard') {
            iconName = focused ? 'analytics' : 'analytics-outline';
          } else if (route.name === 'Events') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Volunteers') {
            iconName = focused ? 'people' : 'people-outline';
          }
          else if( route.name=='Volunteer'){
            iconName = focused ? 'people' : 'people-outline';
          }
          else if (route.name === 'Profile') {
            iconName = focused ? 'business' : 'business-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2B2B2B', // Gray for organizations
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Dashboard" component={OrganizationDashboardStack} />
      <Tab.Screen name="Events" component={OrganizationEventsStack} />
     <Tab.Screen name="Volunteer" component={VoluntOrgScreen} />
     <Tab.Screen name="Analytics" component={AnalyOrgScreen} />

      <Tab.Screen name="Profile" component={ProfileStackScreen} />
    </Tab.Navigator>
  );
}
// VOLUNTEER STACK SCREENS (existing)
function FeedStackScreen() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="FeedMain" component={FeedScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ headerShown: false }} />
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

function EventDetailsScreenTab () {

  return (
     <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen 
        name="EventDetails" 
        component={EventDetailsScreen} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen 
        name="Chat" 
        component={ChatScreen} 
        options={{ headerShown: false }} 
      />
    </Stack.Navigator>
  )
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
  
  {/* Add these new screens */}
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
// In App.js - OrganizationDashboardStack
function OrganizationDashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain" component={OrganizationDashboard} />
      <Stack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ headerShown: false }} // The screen handles its own header
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
      
      {/* ... other screens */}
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
      {/* { Uncomment when you create these screens: */}
      <Stack.Screen 
        name="CreateEvent" 
        component={CreateEventScreen}
        options={{ headerShown: false, title: 'Create Event' }}
      />
      {/* <Stack.Screen 
        name="EditEvent" 
        component={EditEventScreen}
        options={{ headerShown: true, title: 'Edit Event' }}
      /> */}
      {/* <Stack.Screen 
        name="EventAnalytics" 
        component={EventAnalyticsScreen}
        options={{ headerShown: true, title: 'Event Analytics' }}
      /> */}

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
      {/* Temporarily using DiscoverScreen - replace with VolunteerManagement when created */}
      <Stack.Screen name="VolunteersMain" component={DiscoverScreen} />
      <Stack.Screen
        name="EventDetails"
        component={EventDetailsScreen}
        options={{ headerShown: true, title: 'Event Details' }}
      />
      {/* Uncomment when you create VolunteerManagement screen:
      <Stack.Screen name="VolunteersMain" component={VolunteerManagement} />
      */}
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
            setUserRole('volunteer'); // Default fallback
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole('volunteer'); // Default fallback
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


