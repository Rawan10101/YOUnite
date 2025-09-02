import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAppContext } from '../../contexts/AppContext';
import EventParticipantsManager from '../../utils/EventParticipantsManager';

export default function EventParticipantsScreen({ route, navigation }) {
  const { user } = useAppContext();
  const { event } = route.params;
  
  const [participants, setParticipants] = useState([]);
  const [participantStats, setParticipantStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // all, registered, attended, no-show

  useEffect(() => {
    loadParticipants();
  }, [event.id]);

  const loadParticipants = async () => {
    try {
      setLoading(true);
      
      // Load participants and stats
      const [participantsData, statsData] = await Promise.all([
        EventParticipantsManager.getEventParticipants(event.id),
        EventParticipantsManager.getParticipantStats(event.id)
      ]);
      
      setParticipants(participantsData);
      setParticipantStats(statsData);
      
    } catch (error) {
      console.error('Error loading participants:', error);
      Alert.alert('Error', 'Failed to load participants. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadParticipants();
  };

  const handleRemoveParticipant = (participantId, participantName) => {
    Alert.alert(
      'Remove Participant',
      `Are you sure you want to remove ${participantName} from this event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await EventParticipantsManager.removeParticipant(
                event.id,
                participantId,
                user.uid
              );
              
              // Refresh the list
              await loadParticipants();
              
              Alert.alert('Success', 'Participant removed successfully');
            } catch (error) {
              console.error('Error removing participant:', error);
              Alert.alert('Error', error.message || 'Failed to remove participant');
            }
          },
        },
      ]
    );
  };

  const handleBulkRemove = () => {
    if (selectedParticipants.length === 0) {
      Alert.alert('No Selection', 'Please select participants to remove');
      return;
    }

    Alert.alert(
      'Remove Participants',
      `Are you sure you want to remove ${selectedParticipants.length} participant(s) from this event?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove All',
          style: 'destructive',
          onPress: async () => {
            try {
              const results = await EventParticipantsManager.bulkRemoveParticipants(
                event.id,
                selectedParticipants,
                user.uid
              );
              
              // Refresh the list
              await loadParticipants();
              
              // Clear selection
              setSelectedParticipants([]);
              setSelectionMode(false);
              
              if (results.failed > 0) {
                Alert.alert(
                  'Partial Success',
                  `${results.successful} participants removed successfully. ${results.failed} failed to remove.`
                );
              } else {
                Alert.alert('Success', `${results.successful} participants removed successfully`);
              }
            } catch (error) {
              console.error('Error bulk removing participants:', error);
              Alert.alert('Error', 'Failed to remove participants');
            }
          },
        },
      ]
    );
  };

  const handleUpdateStatus = (participantId, currentStatus) => {
    const statusOptions = [
      { label: 'Registered', value: 'registered' },
      { label: 'Attended', value: 'attended' },
      { label: 'No Show', value: 'no-show' },
    ];

    Alert.alert(
      'Update Status',
      'Select new status for this participant:',
      [
        ...statusOptions.map(option => ({
          text: option.label,
          onPress: async () => {
            if (option.value === currentStatus) return;
            
            try {
              await EventParticipantsManager.updateParticipantStatus(
                event.id,
                participantId,
                option.value,
                user.uid
              );
              
              // Refresh the list
              await loadParticipants();
              
              Alert.alert('Success', 'Participant status updated');
            } catch (error) {
              console.error('Error updating status:', error);
              Alert.alert('Error', 'Failed to update participant status');
            }
          },
        })),
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const toggleParticipantSelection = (participantId) => {
    setSelectedParticipants(prev => {
      if (prev.includes(participantId)) {
        return prev.filter(id => id !== participantId);
      } else {
        return [...prev, participantId];
      }
    });
  };

  const getFilteredParticipants = () => {
    let filtered = participants;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(participant =>
        participant.displayName?.toLowerCase().includes(query) ||
        participant.email?.toLowerCase().includes(query) ||
        participant.location?.toLowerCase().includes(query) ||
        participant.skills?.some(skill => skill.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(participant => 
        participant.participationStatus === statusFilter
      );
    }

    return filtered;
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'attended': return '#4CAF50';
      case 'no-show': return '#F44336';
      case 'registered':
      default: return '#FF9800';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'attended': return 'checkmark-circle';
      case 'no-show': return 'close-circle';
      case 'registered':
      default: return 'time';
    }
  };

  const renderParticipantCard = ({ item }) => {
    const isSelected = selectedParticipants.includes(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.participantCard,
          isSelected && styles.selectedParticipantCard
        ]}
        onPress={() => {
          if (selectionMode) {
            toggleParticipantSelection(item.id);
          }
        }}
        onLongPress={() => {
          if (!selectionMode) {
            setSelectionMode(true);
            toggleParticipantSelection(item.id);
          }
        }}
      >
        {selectionMode && (
          <View style={styles.selectionCheckbox}>
            <Ionicons 
              name={isSelected ? 'checkbox' : 'square-outline'} 
              size={24} 
              color={isSelected ? '#4e8cff' : '#ccc'} 
            />
          </View>
        )}
        
        <Image
          source={{ uri: item.photoURL || 'https://via.placeholder.com/50' }}
          style={styles.avatar}
        />
        
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>
            {item.displayName || 'Unknown User'}
          </Text>
          <Text style={styles.participantEmail}>{item.email}</Text>
          
          {item.location && (
            <Text style={styles.participantLocation}>
              <Ionicons name="location-outline" size={12} color="#999" />
              {' '}{item.location}
            </Text>
          )}
          
          {item.skills && item.skills.length > 0 && (
            <Text style={styles.participantSkills} numberOfLines={1}>
              Skills: {item.skills.slice(0, 3).join(', ')}
              {item.skills.length > 3 && '...'}
            </Text>
          )}
          
          {item.registrationDate && (
            <Text style={styles.registrationDate}>
              Registered: {new Date(item.registrationDate).toLocaleDateString()}
            </Text>
          )}
        </View>
        
        <View style={styles.participantActions}>
          {/* Status Badge */}
          <TouchableOpacity
            style={[
              styles.statusBadge,
              { backgroundColor: getStatusColor(item.participationStatus) }
            ]}
            onPress={() => handleUpdateStatus(item.id, item.participationStatus)}
          >
            <Ionicons 
              name={getStatusIcon(item.participationStatus)} 
              size={12} 
              color="#fff" 
            />
            <Text style={styles.statusText}>
              {item.participationStatus || 'registered'}
            </Text>
          </TouchableOpacity>
          
          {!selectionMode && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => handleRemoveParticipant(item.id, item.displayName)}
            >
              <Ionicons name="trash-outline" size={20} color="#F44336" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={24} color="#2B2B2B" />
      </TouchableOpacity>
      
      <View style={styles.headerContent}>
        <Text style={styles.headerTitle}>Event Participants</Text>
        <Text style={styles.headerSubtitle} numberOfLines={1}>
          {event.title}
        </Text>
      </View>
      
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => setFilterModalVisible(true)}
      >
        <Ionicons name="filter" size={24} color="#2B2B2B" />
      </TouchableOpacity>
    </View>
  );

  const renderStatsCard = () => {
    if (!participantStats) return null;
    
    return (
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{participantStats.totalParticipants}</Text>
          <Text style={styles.statLabel}>Registered</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{participantStats.maxCapacity}</Text>
          <Text style={styles.statLabel}>Capacity</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{participantStats.availableSpots}</Text>
          <Text style={styles.statLabel}>Available</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{participantStats.fillPercentage}%</Text>
          <Text style={styles.statLabel}>Full</Text>
        </View>
      </View>
    );
  };

  const renderSelectionBar = () => {
    if (!selectionMode) return null;
    
    return (
      <View style={styles.selectionBar}>
        <TouchableOpacity
          style={styles.cancelSelectionButton}
          onPress={() => {
            setSelectionMode(false);
            setSelectedParticipants([]);
          }}
        >
          <Text style={styles.cancelSelectionText}>Cancel</Text>
        </TouchableOpacity>
        
        <Text style={styles.selectionCount}>
          {selectedParticipants.length} selected
        </Text>
        
        <TouchableOpacity
          style={styles.bulkRemoveButton}
          onPress={handleBulkRemove}
          disabled={selectedParticipants.length === 0}
        >
          <Ionicons name="trash" size={20} color="#fff" />
          <Text style={styles.bulkRemoveText}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4e8cff" />
        <Text style={styles.loadingText}>Loading participants...</Text>
      </View>
    );
  }

  const filteredParticipants = getFilteredParticipants();

  return (
    <View style={styles.container}>
      {renderHeader()}
      {renderStatsCard()}
      {renderSelectionBar()}
      
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search participants..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Participants List */}
      <FlatList
        data={filteredParticipants}
        keyExtractor={(item) => item.id}
        renderItem={renderParticipantCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>
              {searchQuery || statusFilter !== 'all' 
                ? 'No participants match your filters'
                : 'No participants registered yet'
              }
            </Text>
          </View>
        }
      />

      {/* Filter Modal */}
      <Modal
        visible={filterModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Filter Participants</Text>
            
            <Text style={styles.filterLabel}>Status:</Text>
            {['all', 'registered', 'attended', 'no-show'].map(status => (
              <TouchableOpacity
                key={status}
                style={[
                  styles.filterOption,
                  statusFilter === status && styles.selectedFilterOption
                ]}
                onPress={() => setStatusFilter(status)}
              >
                <Text style={[
                  styles.filterOptionText,
                  statusFilter === status && styles.selectedFilterOptionText
                ]}>
                  {status === 'all' ? 'All Participants' : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setFilterModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2B2B2B',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  filterButton: {
    padding: 8,
    marginLeft: 12,
  },

  // Stats Card
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4e8cff',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },

  // Selection Bar
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4e8cff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 16,
  },
  cancelSelectionButton: {
    padding: 8,
  },
  cancelSelectionText: {
    color: '#fff',
    fontWeight: '600',
  },
  selectionCount: {
    flex: 1,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '600',
  },
  bulkRemoveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F44336',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bulkRemoveText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#2B2B2B',
    marginLeft: 12,
    marginRight: 8,
  },

  // List
  listContainer: {
    padding: 20,
  },

  // Participant Card
  participantCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  selectedParticipantCard: {
    borderWidth: 2,
    borderColor: '#4e8cff',
  },
  selectionCheckbox: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 16,
  },
  participantInfo: {
    flex: 1,
  },
  participantName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
  },
  participantEmail: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  participantLocation: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  participantSkills: {
    fontSize: 12,
    color: '#4e8cff',
    marginTop: 4,
  },
  registrationDate: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  participantActions: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  removeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#FFEBEE',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2B2B2B',
    marginBottom: 20,
    textAlign: 'center',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2B2B2B',
    marginBottom: 12,
  },
  filterOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
  },
  selectedFilterOption: {
    backgroundColor: '#4e8cff',
  },
  filterOptionText: {
    fontSize: 14,
    color: '#2B2B2B',
  },
  selectedFilterOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalButtons: {
    marginTop: 20,
  },
  modalButton: {
    backgroundColor: '#4e8cff',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

