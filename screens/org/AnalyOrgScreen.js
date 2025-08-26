import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useAppContext } from '../../contexts/AppContext';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebaseConfig';

const screenWidth = Dimensions.get('window').width;

export default function AnalyticsScreen({ navigation }) {
  const { user } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('7days'); // 7days, 30days, 90days
  const [metrics, setMetrics] = useState({
    overview: {
      totalFollowers: 0,
      totalEvents: 0,
      totalVolunteers: 0,
      averageRating: 0,
    },
    growth: {
      followerGrowth: [0, 0, 0, 0, 0, 0, 0],
      eventRegistrations: [0, 0, 0, 0, 0, 0, 0],
    },
    engagement: {
      postLikes: [0, 0, 0, 0, 0, 0, 0],
      eventAttendance: [0, 0, 0, 0, 0, 0, 0],
    },
    reports: {
      reportsByCategory: [
        { name: 'Service Issues', count: 5, color: '#E74C3C', legendFontColor: '#7F7F7F', legendFontSize: 14 },
        { name: 'Communication', count: 3, color: '#F39C12', legendFontColor: '#7F7F7F', legendFontSize: 14 },
        { name: 'Event Management', count: 2, color: '#3498DB', legendFontColor: '#7F7F7F', legendFontSize: 14 },
        { name: 'Other', count: 1, color: '#95A5A6', legendFontColor: '#7F7F7F', legendFontSize: 14 },
      ],
      responseTime: 24, // hours
      resolutionRate: 85, // percentage
    },
  });

  useEffect(() => {
    if (!user?.uid) return;

    const fetchAnalyticsData = async () => {
      setLoading(true);
      try {
        // Load organization overview data
        const orgDoc = await getDoc(doc(db, 'organizations', user.uid));
        if (orgDoc.exists()) {
          const orgData = orgDoc.data();
          
          // Update overview metrics
          setMetrics(prev => ({
            ...prev,
            overview: {
              totalFollowers: orgData.followers?.length || 0,
              totalEvents: orgData.totalEvents || 0,
              totalVolunteers: orgData.totalVolunteers || 0,
              averageRating: orgData.averageRating || 4.5,
            },
          }));
        }

        // Mock data for charts - replace with real analytics queries
        setMetrics(prev => ({
          ...prev,
          growth: {
            followerGrowth: [5, 8, 12, 15, 20, 25, 30],
            eventRegistrations: [10, 15, 20, 18, 25, 30, 35],
          },
          engagement: {
            postLikes: [45, 52, 38, 65, 70, 58, 75],
            eventAttendance: [85, 90, 75, 88, 92, 85, 90],
          },
        }));

      } catch (error) {
        console.error('Error loading analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalyticsData();
  }, [user?.uid, selectedPeriod]);

  const chartConfig = {
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    color: (opacity = 1) => `rgba(78, 140, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(43, 43, 43, ${opacity})`,
    strokeWidth: 2,
    barPercentage: 0.7,
    decimalPlaces: 0,
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#4e8cff',
    },
  };

  const renderPeriodSelector = () => (
    <View style={styles.periodSelector}>
      {['7days', '30days', '90days'].map((period) => (
        <TouchableOpacity
          key={period}
          style={[
            styles.periodButton,
            selectedPeriod === period && styles.activePeriodButton,
          ]}
          onPress={() => setSelectedPeriod(period)}
        >
          <Text
            style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.activePeriodButtonText,
            ]}
          >
            {period === '7days' ? '7 Days' : period === '30days' ? '30 Days' : '3 Months'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderOverviewCard = (title, value, icon, color, subtitle) => (
    <View style={[styles.overviewCard, { borderLeftColor: color }]}>
      <View style={[styles.overviewIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={24} color="#fff" />
      </View>
      <View style={styles.overviewText}>
        <Text style={styles.overviewValue}>{value}</Text>
        <Text style={styles.overviewTitle}>{title}</Text>
        {subtitle && <Text style={styles.overviewSubtitle}>{subtitle}</Text>}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4e8cff" />
        <Text style={styles.loadingText}>Loading analytics...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics</Text>
        <Text style={styles.headerSubtitle}>Performance insights and metrics</Text>
      </View>

      {/* Period Selector */}
      {renderPeriodSelector()}

      {/* Overview Cards */}
      <View style={styles.overviewSection}>
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.overviewGrid}>
          {renderOverviewCard(
            'Followers',
            metrics.overview.totalFollowers,
            'people-outline',
            '#4CAF50',
            'Total community'
          )}
          {renderOverviewCard(
            'Events',
            metrics.overview.totalEvents,
            'calendar-outline',
            '#4e8cff',
            'All time'
          )}
          {renderOverviewCard(
            'Volunteers',
            metrics.overview.totalVolunteers,
            'person-outline',
            '#FF9800',
            'Registered'
          )}
          {renderOverviewCard(
            'Rating',
            `${metrics.overview.averageRating}/5`,
            'star-outline',
            '#9C27B0',
            'Average rating'
          )}
        </View>
      </View>

      {/* Growth Metrics */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Growth Metrics</Text>
        
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Follower Growth</Text>
          <LineChart
            data={{
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [{ data: metrics.growth.followerGrowth }],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(76, 175, 80, ${opacity})`,
            }}
            bezier
            style={styles.chart}
          />
        </View>

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Event Registrations</Text>
          <BarChart
            data={{
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [{ data: metrics.growth.eventRegistrations }],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(78, 140, 255, ${opacity})`,
            }}
            style={styles.chart}
          />
        </View>
      </View>

      {/* Engagement Metrics */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Engagement Metrics</Text>
        
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Post Engagement</Text>
          <LineChart
            data={{
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [{ data: metrics.engagement.postLikes }],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(244, 67, 54, ${opacity})`,
            }}
            bezier
            style={styles.chart}
          />
        </View>

        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Event Attendance Rate (%)</Text>
          <BarChart
            data={{
              labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
              datasets: [{ data: metrics.engagement.eventAttendance }],
            }}
            width={screenWidth - 48}
            height={220}
            chartConfig={{
              ...chartConfig,
              color: (opacity = 1) => `rgba(156, 39, 176, ${opacity})`,
            }}
            style={styles.chart}
          />
        </View>
      </View>

      {/* Reports Analysis */}
      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Reports Analysis</Text>
        
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Reports by Category</Text>
          <PieChart
            data={metrics.reports.reportsByCategory}
            width={screenWidth - 48}
            height={220}
            chartConfig={chartConfig}
            accessor="count"
            backgroundColor="transparent"
            paddingLeft="15"
            center={[10, 10]}
            style={styles.chart}
          />
        </View>

        <View style={styles.reportStatsContainer}>
          <View style={styles.reportStat}>
            <Text style={styles.reportStatValue}>{metrics.reports.responseTime}h</Text>
            <Text style={styles.reportStatLabel}>Avg Response Time</Text>
          </View>
          <View style={styles.reportStat}>
            <Text style={styles.reportStatValue}>{metrics.reports.resolutionRate}%</Text>
            <Text style={styles.reportStatLabel}>Resolution Rate</Text>
          </View>
        </View>
      </View>

      {/* Bottom Padding */}
      <View style={styles.bottomPadding} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },

  // Header
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },

  // Period Selector
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activePeriodButton: {
    backgroundColor: '#4e8cff',
  },
  periodButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activePeriodButtonText: {
    color: '#fff',
  },

  // Overview Section
  overviewSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 16,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  overviewCard: {
    width: '48%',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  overviewIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  overviewText: {
    flex: 1,
  },
  overviewValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  overviewTitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  overviewSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 1,
  },

  // Chart Section
  chartSection: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  chartContainer: {
    marginBottom: 24,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 12,
    textAlign: 'center',
  },
  chart: {
    borderRadius: 12,
  },

  // Report Stats
  reportStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  reportStat: {
    alignItems: 'center',
  },
  reportStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4e8cff',
  },
  reportStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },

  // Bottom Padding
  bottomPadding: {
    height: 30,
  },
});
