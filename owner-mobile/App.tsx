import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, SafeAreaView } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { LoginScreen } from './src/screens/LoginScreen';
import { OwnerRegistrationScreen } from './src/screens/OwnerRegistrationScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PropertySetupScreen } from './src/screens/PropertySetupScreen';
import { RoomsBedsScreen } from './src/screens/RoomsBedsScreen';
import { ManagementScreen } from './src/screens/ManagementScreen';
import { Property } from './src/types';

const MainNavigator: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'property' | 'rooms' | 'management'>('dashboard');
  const [selectedPropertyForRooms, setSelectedPropertyForRooms] = useState<Property | null>(null);
  const [registrationSkipped, setRegistrationSkipped] = useState(false);

  // 1. If not authenticated -> Login Screen (Mobile + OTP)
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // 2. If newly registered via phone and profile incomplete -> Owner Registration Screen
  const isProfileIncomplete = (!user?.fullName || user.fullName === 'PG Owner') && !registrationSkipped;
  if (isProfileIncomplete) {
    return <OwnerRegistrationScreen onComplete={() => setRegistrationSkipped(true)} />;
  }

  const handleOpenRooms = (property: Property) => {
    setSelectedPropertyForRooms(property);
    setCurrentTab('rooms');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        {/* Tab 1: Dashboard */}
        {currentTab === 'dashboard' && (
          <DashboardScreen
            onSelectPropertyForRooms={handleOpenRooms}
            onNavigateTab={(tab) => {
              if (tab === 'rooms') setCurrentTab('rooms');
              else if (tab === 'tenants' || tab === 'finance') setCurrentTab('management');
            }}
          />
        )}

        {/* Tab 2: Property Setup */}
        {currentTab === 'property' && (
          <PropertySetupScreen onSelectPropertyForRooms={handleOpenRooms} />
        )}

        {/* Tab 3: Rooms and Beds */}
        {currentTab === 'rooms' && (
          <RoomsBedsScreen
            property={selectedPropertyForRooms}
            onBack={() => setCurrentTab('dashboard')}
          />
        )}

        {/* Tab 4: Management (Tenants, Rent, Expenses & Reports) */}
        {currentTab === 'management' && <ManagementScreen />}

        {/* Bottom Navigation Bar with the 4 Dedicated Tabs */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('dashboard')}
          >
            <Text style={styles.navIcon}>📊</Text>
            <Text
              style={[
                styles.navLabel,
                currentTab === 'dashboard' && styles.navLabelActive,
              ]}
            >
              Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('property')}
          >
            <Text style={styles.navIcon}>🏢</Text>
            <Text
              style={[
                styles.navLabel,
                currentTab === 'property' && styles.navLabelActive,
              ]}
            >
              Property
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('rooms')}
          >
            <Text style={styles.navIcon}>🛏️</Text>
            <Text
              style={[
                styles.navLabel,
                currentTab === 'rooms' && styles.navLabelActive,
              ]}
            >
              Rooms & Beds
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navItem}
            onPress={() => setCurrentTab('management')}
          >
            <Text style={styles.navIcon}>📋</Text>
            <Text
              style={[
                styles.navLabel,
                currentTab === 'management' && styles.navLabelActive,
              ]}
            >
              Management
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainNavigator />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 8,
    paddingBottom: 16,
    justifyContent: 'space-around',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 8,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  navLabelActive: {
    color: '#4f46e5',
    fontWeight: '900',
  },
});
